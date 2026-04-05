"""
MINE 3D Registration for NIfTI volumes
Integrated from Reg_Aymen_3D_NIfTI.ipynb

Direct adaptation of 2D pipeline → 3D volumetric registration
Same architecture: AffineNet3D + MINE, multi-resolution, GPU-accelerated
"""
import os
import math
import time
import random
from typing import Dict, Tuple

import numpy as np
import nibabel as nib
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

from scipy.ndimage import gaussian_filter, sobel, zoom as scipy_zoom


# ============================================================
# Initialize device
# ============================================================
def _get_device(device_name: str = 'auto') -> torch.device:
    if device_name == 'auto':
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    else:
        device = torch.device(device_name)

    # Speed options
    torch.backends.cudnn.benchmark = True
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    return device


# ============================================================
# CELL 3 — Utils (3D adapted)
# ============================================================
def robust_norm01(x: np.ndarray, p_low: float = 1.0, p_high: float = 99.0) -> np.ndarray:
    """Percentile normalisation → [0, 1]. Works for any dimensionality."""
    x = x.astype(np.float32)
    lo, hi = np.percentile(x, p_low), np.percentile(x, p_high)
    if hi <= lo:
        return np.zeros_like(x, dtype=np.float32)
    return np.clip((x - lo) / (hi - lo), 0.0, 1.0).astype(np.float32)


def gradient_magnitude_3d(vol: np.ndarray) -> np.ndarray:
    """
    3D equivalent of Canny edges: Sobel gradient magnitude.
    Replaces cv2.Canny which only works on 2D.
    vol: float [0,1] shape [X,Y,Z]
    returns: float [0,1] gradient magnitude
    """
    gx = sobel(vol, axis=0)
    gy = sobel(vol, axis=1)
    gz = sobel(vol, axis=2)
    mag = np.sqrt(gx**2 + gy**2 + gz**2)
    # threshold at 50th percentile to get informative voxels
    thr = np.percentile(mag, 50)
    return (mag > thr).astype(np.float32)


def pyramid_gaussian_3d(vol: np.ndarray, downscale: float, max_levels: int):
    """
    3D Gaussian pyramid.
    Returns list: [level_0_full_res, level_1, ..., level_max_levels]
    """
    levels = [vol.astype(np.float32)]
    current = vol.astype(np.float32)
    for _ in range(max_levels):
        sigma = downscale / 2.0
        blurred = gaussian_filter(current, sigma=sigma)
        factor = 1.0 / downscale
        downsampled = scipy_zoom(blurred, factor, order=1)
        levels.append(downsampled.astype(np.float32))
        current = downsampled
        if min(current.shape) < 4:
            break
    return levels


def make_grid_3d(D: int, H: int, W: int, device: torch.device) -> torch.Tensor:
    """
    Build a normalised grid [-1,1] in 3D.
    Returns: [D, H, W, 3]  (x=W-axis, y=H-axis, z=D-axis)
    """
    z_ = torch.linspace(-1, 1, D, device=device, dtype=torch.float32)
    y_ = torch.linspace(-1, 1, H, device=device, dtype=torch.float32)
    x_ = torch.linspace(-1, 1, W, device=device, dtype=torch.float32)
    gz, gy, gx = torch.meshgrid(z_, y_, x_, indexing='ij')
    return torch.stack([gx, gy, gz], dim=-1)  # [D,H,W,3]


# ============================================================
# CELL 6 — Models: AffineNet3D + MINE3D
# ============================================================
class AffineNet3D(nn.Module):
    """
    3D replacement for HomographyNet.
    Parametrises a 4×4 homogeneous affine matrix via matrix exponential.
    """
    def __init__(self, device: torch.device, n_basis: int = 9):
        super().__init__()
        B = torch.zeros(n_basis, 4, 4, dtype=torch.float32, device=device)

        # Translations
        B[0, 0, 3] = 1.0   # tx
        B[1, 1, 3] = 1.0   # ty
        B[2, 2, 3] = 1.0   # tz

        # Rotations (skew-symmetric upper-left 3×3)
        B[3, 0, 1] = 1.0
        B[3, 1, 0] = -1.0   # rz
        B[4, 0, 2] = 1.0
        B[4, 2, 0] = -1.0   # ry
        B[5, 1, 2] = 1.0
        B[5, 2, 1] = -1.0   # rx

        # Scaling / shear
        B[6, 0, 0] = 1.0  # sx
        B[7, 1, 1] = 1.0  # sy
        B[8, 2, 2] = 1.0  # sz

        self.register_buffer("B", B)

        self.vL = nn.Parameter(
            torch.zeros(n_basis, 1, 1, dtype=torch.float32, device=device))
        self.v1 = nn.Parameter(
            torch.zeros(n_basis, 1, 1, dtype=torch.float32, device=device))

    def forward(self, s: int) -> torch.Tensor:
        """Returns a 4×4 affine matrix. s=0 → include fine params."""
        C = torch.sum(self.B * self.vL, dim=0)
        if s == 0:
            C = C + torch.sum(self.B * self.v1, dim=0)

        # Matrix exponential (series)
        A = torch.eye(4, dtype=torch.float32, device=C.device)
        M = A.clone()
        for i in range(1, 10):
            A = (A @ C) / float(i)
            M = M + A
        return M


class MINE3D(nn.Module):
    """
    Mutual Information Neural Estimator for 3D
    Handles flat voxel pairs [N, 2] (grayscale volumes).
    """
    def __init__(self, n_features: int = 2, n_neurons: int = 256, dropout_rate: float = 0.1):
        super().__init__()
        self.fc1 = nn.Linear(n_features, n_neurons)
        self.fc2 = nn.Linear(n_neurons, n_neurons)
        self.fc3 = nn.Linear(n_neurons, 1)
        self.dropout = nn.Dropout(dropout_rate)

    def _net(self, z: torch.Tensor) -> torch.Tensor:
        z = F.leaky_relu(self.fc1(z), 0.1)
        z = self.dropout(F.leaky_relu(self.fc2(z), 0.1))
        return self.fc3(z)

    def forward(self, x: torch.Tensor, ind: torch.Tensor,
                max_samples: int = 32768) -> torch.Tensor:
        """
        x   : [D*H*W, 2]  — pairs (I_voxel, J_warped_voxel)
        ind : flat voxel indices to use
        """
        m = ind.numel()
        if m > max_samples:
            sel = torch.randperm(m, device=ind.device)[:max_samples]
            ind_use = ind[sel]
        else:
            ind_use = ind

        perm = ind_use[torch.randperm(ind_use.numel(), device=ind_use.device)]

        pos = x[ind_use]
        neg = torch.stack([x[ind_use, 0], x[perm, 1]], dim=1)

        z1 = self._net(pos)
        z2 = self._net(neg)

        term_pos = z1.mean()
        term_neg = torch.logsumexp(z2, dim=0) - math.log(z2.shape[0])
        return (term_pos - term_neg).squeeze()


# ============================================================
# CELL 7 — 3D Warping & Multi-Resolution Loss
# ============================================================
def affine_transform_3d(J4: torch.Tensor, M: torch.Tensor,
                        grid: torch.Tensor) -> torch.Tensor:
    """
    3D replacement for affine_transform().
    J4   : [1, 1, D, H, W]  — moving volume
    M    : [4, 4]            — affine matrix (homogeneous)
    grid : [D, H, W, 3]     — normalised coordinates xyz in [-1,1]
    Returns: [D, H, W]  warped volume
    """
    D, H, W = grid.shape[:3]

    xyz_flat = grid.reshape(-1, 3)
    ones = torch.ones(xyz_flat.shape[0], 1, device=M.device)
    xyz_hom = torch.cat([xyz_flat, ones], dim=1)

    xyz_warped = xyz_hom @ M.T
    w = xyz_warped[:, 3:4].clamp_min(1e-6)
    xyz_out = xyz_warped[:, :3] / w

    grid_out = xyz_out.reshape(1, D, H, W, 3)

    out = F.grid_sample(
        J4, grid_out,
        mode='bilinear',
        padding_mode='zeros',
        align_corners=True
    )
    return out.squeeze()


def multi_resolution_loss_3d(affine_net: AffineNet3D, mine_net: MINE3D,
                              I_lst, J_lst, xyz_lst, ind_lst, L: int,
                              max_samples: int = 32768,
                              lambda_reg: float = 1e-4) -> torch.Tensor:
    """
    Multi-resolution MINE loss — 3D analogue
    """
    loss = 0.0
    for s in range(L - 1, -1, -1):
        M = affine_net(s)
        J4 = J_lst[s].unsqueeze(0).unsqueeze(0)

        Jw = affine_transform_3d(J4, M, xyz_lst[s])

        pairs = torch.stack(
            [I_lst[s].reshape(-1), Jw.reshape(-1)], dim=1
        )

        mi = mine_net(pairs, ind_lst[s], max_samples=max_samples)
        loss = loss - (1.0 / L) * mi

    reg = affine_net.vL.pow(2).mean() + affine_net.v1.pow(2).mean()
    return loss + lambda_reg * reg


# ============================================================
# CELL 10 — Warp Full-Resolution Volume
# ============================================================
@torch.no_grad()
def warp_full_resolution_3d(I_np: np.ndarray, J_np: np.ndarray,
                            affine_net: AffineNet3D,
                            device: torch.device) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    3D replacement for warp_full_resolution().
    I_np, J_np : [X, Y, Z]  float32 in [0,1]
    Returns: I_np (fixed), J_warped [X,Y,Z], M_final [4,4]
    """
    I_dhw = np.transpose(I_np, (2, 1, 0))
    J_dhw = np.transpose(J_np, (2, 1, 0))

    D, H, W = I_dhw.shape
    J_t = torch.from_numpy(J_dhw).float().to(device)
    J4 = J_t.unsqueeze(0).unsqueeze(0)

    grid = make_grid_3d(D, H, W, device)
    M = affine_net(0)

    Jw_dhw = affine_transform_3d(J4, M, grid).detach().cpu().numpy()
    J_warped = np.transpose(Jw_dhw, (2, 1, 0))
    M_np = M.detach().cpu().numpy()
    return I_np, J_warped, M_np


# ============================================================
# Main function: run_mine_3d_nifti
# ============================================================
def run_mine_3d_nifti(
    fixed_path: str,
    moving_path: str,
    output_dir: str,
    n_iters: int = 300,
    max_levels: int = 4,
    levels_used: int = 3,
    max_samples: int = 32768,
    lambda_reg: float = 1e-4,
    device_name: str = 'auto',
    save_extended_outputs: bool = True,
) -> dict:
    """
    Complete 3D MINE registration pipeline for NIfTI volumes.

    Args:
        fixed_path: Path to fixed (reference) NIfTI volume
        moving_path: Path to moving (to-warp) NIfTI volume
        output_dir: Output directory for results
        n_iters: Number of training iterations (default 300)
        max_levels: Maximum pyramid levels to generate (default 4)
        levels_used: Number of levels to use in multi-resolution (default 3)
        max_samples: Max voxels per MINE forward pass (default 32768)
        lambda_reg: Regularization weight (default 1e-4)
        device_name: 'auto', 'cuda', 'cpu' (default 'auto')
        save_extended_outputs: Whether to save all intermediate results (default True)

    Returns:
        dict with keys:
            - success: bool
            - warped_path: str path to registered volume
            - matrix_path: str path to 4x4 affine matrix (npy)
            - matrix: list 4x4 matrix
            - mutual_information: float MI score
            - metrics: dict with MSE/MAE/NCC before/after
            - processing_time_ms: float elapsed time
            - device: str device used
    """
    device = _get_device(device_name)
    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)

    # ──── Load NIfTI images ────────────────────────────────────────────────
    I_nib = nib.load(fixed_path)
    J_nib = nib.load(moving_path)

    I_raw = I_nib.get_fdata(dtype=np.float32)
    J_raw = J_nib.get_fdata(dtype=np.float32)

    if I_raw.ndim == 4:
        I_raw = I_raw[..., 0]
    if J_raw.ndim == 4:
        J_raw = J_raw[..., 0]

    # Resample J to I grid if shapes differ
    if I_raw.shape != J_raw.shape:
        factors = tuple(s_i / s_j for s_i, s_j in zip(I_raw.shape, J_raw.shape))
        J_raw = scipy_zoom(J_raw, factors, order=3)

    # ──── Normalize & smooth ───────────────────────────────────────────────
    I0 = robust_norm01(I_raw)
    J0 = robust_norm01(J_raw)

    I0_smooth = gaussian_filter(I0, sigma=1.0)
    J0_smooth = gaussian_filter(J0, sigma=1.0)

    # ──── Build pyramids ───────────────────────────────────────────────────
    pyramid_I = pyramid_gaussian_3d(I0_smooth, downscale=2.0, max_levels=max_levels)
    pyramid_J = pyramid_gaussian_3d(J0_smooth, downscale=2.0, max_levels=max_levels)
    L = min(levels_used, len(pyramid_I), len(pyramid_J))

    # ──── Prepare tensors & sampling ───────────────────────────────────────
    MAX_INDICES = 80000
    EDGE_RATIO = 0.7

    I_lst, J_lst = [], []
    xyz_lst, ind_lst = [], []

    for s in range(L):
        I_np = pyramid_I[s].astype(np.float32)
        J_np = pyramid_J[s].astype(np.float32)

        # [X,Y,Z] → [Z,Y,X]=[D,H,W]
        I_dhw = np.transpose(I_np, (2, 1, 0))
        J_dhw = np.transpose(J_np, (2, 1, 0))

        I_t = torch.from_numpy(I_dhw).float().to(device)
        J_t = torch.from_numpy(J_dhw).float().to(device)
        D_, H_, W_ = I_t.shape

        I_lst.append(I_t)
        J_lst.append(J_t)

        # 3D informative voxel sampling
        grad_mask = gradient_magnitude_3d(I_dhw)
        edge_idx = np.flatnonzero(grad_mask.ravel() > 0)

        total = D_ * H_ * W_
        n_edge = int(MAX_INDICES * EDGE_RATIO)
        n_rand = MAX_INDICES - n_edge

        if edge_idx.size > n_edge:
            edge_pick = np.random.choice(edge_idx, size=n_edge, replace=False)
        else:
            edge_pick = edge_idx

        all_idx = np.arange(total, dtype=np.int64)
        rand_pick = np.random.choice(all_idx, size=min(n_rand, total), replace=False)

        idx = np.unique(np.concatenate([edge_pick, rand_pick]))
        ind_t = torch.from_numpy(idx).long().to(device)
        ind_lst.append(ind_t)

        # Normalised 3D grid
        grid = make_grid_3d(D_, H_, W_, device)
        xyz_lst.append(grid)

    # ──── Initialize models ────────────────────────────────────────────────
    affine_net = AffineNet3D(device).to(device)
    mine_net = MINE3D(n_features=2, n_neurons=256, dropout_rate=0.1).to(device)

    optimizer = optim.Adam(
        [
            {'params': mine_net.parameters(), 'lr': 5e-4},
            {'params': affine_net.vL, 'lr': 2e-3},
            {'params': affine_net.v1, 'lr': 5e-4},
        ],
        amsgrad=True
    )

    scaler = torch.amp.GradScaler('cuda', enabled=(device.type == 'cuda'))

    # ──── Training loop ────────────────────────────────────────────────────
    mi_curve = []
    for itr in range(n_iters):
        optimizer.zero_grad(set_to_none=True)

        with torch.cuda.amp.autocast(enabled=(device.type == 'cuda')):
            loss = multi_resolution_loss_3d(
                affine_net, mine_net,
                I_lst, J_lst, xyz_lst, ind_lst,
                L=L,
                max_samples=max_samples,
                lambda_reg=lambda_reg
            )

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        mi_curve.append((-loss).item())

        if (itr + 1) % 50 == 0 or itr == 0:
            print(f"  iter {itr+1}/{n_iters} | MI proxy: {mi_curve[-1]:.4f}")

    # ──── Warp full resolution ─────────────────────────────────────────────
    I_full = robust_norm01(I_raw)
    J_full = robust_norm01(J_raw)

    _, J_warped, M_final = warp_full_resolution_3d(I_full, J_full, affine_net, device)

    # ──── Compute metrics ──────────────────────────────────────────────────
    diff_before = np.abs(I_full - J_full)
    diff_after = np.abs(I_full - J_warped)

    mse_before = float(np.mean(diff_before ** 2))
    mse_after = float(np.mean(diff_after ** 2))
    mae_before = float(np.mean(diff_before))
    mae_after = float(np.mean(diff_after))

    # NCC (sampled for speed)
    sample_size = min(500000, I_full.size)
    idx_sample = np.random.choice(I_full.size, sample_size, replace=False)
    I_sample = I_full.ravel()[idx_sample]
    J_sample_before = J_full.ravel()[idx_sample]
    J_sample_after = J_warped.ravel()[idx_sample]

    ncc_before = float(np.corrcoef(I_sample, J_sample_before)[0, 1]) if I_sample.size > 1 else 0.0
    ncc_after = float(np.corrcoef(I_sample, J_sample_after)[0, 1]) if I_sample.size > 1 else 0.0

    # Handle NaN
    ncc_before = 0.0 if np.isnan(ncc_before) else ncc_before
    ncc_after = 0.0 if np.isnan(ncc_after) else ncc_after

    # MI from curve
    final_mi = mi_curve[-1] if mi_curve else 0.0

    # ──── Save outputs ────────────────────────────────────────────────────
    warped_path = os.path.join(output_dir, 'warped_mine3d.nii.gz')
    matrix_npy_path = os.path.join(output_dir, 'affine_4x4_mine3d.npy')
    matrix_txt_path = os.path.join(output_dir, 'affine_4x4_mine3d.txt')

    # Save warped volume
    warped_img = nib.Nifti1Image(J_warped.astype(np.float32), I_nib.affine, I_nib.header)
    warped_img.header.set_data_dtype(np.float32)
    nib.save(warped_img, warped_path)

    # Save matrix
    np.save(matrix_npy_path, M_final)
    np.savetxt(matrix_txt_path, M_final, fmt='%.6f')

    if save_extended_outputs:
        # Save intermediate volumes
        I_img = nib.Nifti1Image(I_full.astype(np.float32), I_nib.affine, I_nib.header)
        nib.save(I_img, os.path.join(output_dir, 'fixed_norm.nii.gz'))

        J_img = nib.Nifti1Image(J_full.astype(np.float32), I_nib.affine, I_nib.header)
        nib.save(J_img, os.path.join(output_dir, 'moving_norm.nii.gz'))

        diff_b_img = nib.Nifti1Image(diff_before.astype(np.float32), I_nib.affine, I_nib.header)
        nib.save(diff_b_img, os.path.join(output_dir, 'diff_before.nii.gz'))

        diff_a_img = nib.Nifti1Image(diff_after.astype(np.float32), I_nib.affine, I_nib.header)
        nib.save(diff_a_img, os.path.join(output_dir, 'diff_after.nii.gz'))

        # Save MI curve
        np.save(os.path.join(output_dir, 'mi_curve.npy'), np.array(mi_curve))

    elapsed_ms = round((time.time() - t0) * 1000.0, 2)

    return {
        'success': True,
        'warped_path': warped_path,
        'matrix_path': matrix_npy_path,
        'fixed_norm_path': None,
        'moving_norm_path': None,
        'diff_before_path': None,
        'diff_after_path': None,
        'mi_curve_path': None,
        'weights_path': None,
        'matrix': M_final.tolist(),
        'mutual_information': round(float(final_mi), 4),
        'mi_curve': mi_curve,
        'metrics': {
            'mse_before': mse_before,
            'mse_after': mse_after,
            'mae_before': mae_before,
            'mae_after': mae_after,
            'ncc_before': ncc_before,
            'ncc_after': ncc_after,
        },
        'stage_info': {
            'engine': {
                'name': 'mine_3d',
                'device': str(device),
                'levels': L,
                'iterations': n_iters,
            },
        },
        'processing_time_ms': elapsed_ms,
        'device': str(device),
    }
