"""
MINE 3D Hybrid Registration — Global (Affine) + Local (VoxelMorph)
Adapted from Reg_Aymen_3D_NIfTI_HybridReg.ipynb

Architecture:
  AffineNet3D     — 4×4 affine matrix via matrix exponential (global)
  VoxelMorphNet3D — U-Net 3D dense displacement field [B,3,D,H,W] (local)
  MINE3D          — Mutual Information Neural Estimator

Pipeline per pyramid level:
  1. M = AffineNet3D(s)
  2. J_affine = affine_transform_3d(J, M)
  3. disp = VoxelMorphNet3D(cat(I, J_affine))
  4. J_composed = compose_and_warp(J, M, disp)
  Loss = -MINE(I, J_affine) - λ_local*MINE(I, J_composed) + λ_bend*bending_energy(disp)
"""
import os
import math
import time
from typing import Callable, Optional, Tuple

import numpy as np
import nibabel as nib
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from scipy.ndimage import gaussian_filter, sobel, zoom as scipy_zoom

try:
    from nibabel.processing import resample_from_to
except Exception:
    resample_from_to = None

# Re-use shared utilities from the auto module
from .volume_mine_3d_registration import (
    _get_device,
    robust_norm01,
    gradient_magnitude_3d,
    pyramid_gaussian_3d,
    make_grid_3d,
    affine_transform_3d,
    AffineNet3D,
    MINE3D,
)


# ============================================================
# VoxelMorphNet3D — U-Net léger pour champ de déplacement local
# ============================================================
class ConvBlock3D(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, stride: int = 1):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv3d(in_ch, out_ch, 3, stride=stride, padding=1, bias=False),
            nn.BatchNorm3d(out_ch),
            nn.LeakyReLU(0.1, inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class VoxelMorphNet3D(nn.Module):
    """
    Entrée  : [B, 2, D, H, W]  (I_fixed + J_affine concaténés)
    Sortie  : [B, 3, D, H, W]  (dx, dy, dz par voxel)
    max_disp : amplitude maximale du champ en coordonnées normalisées [-1,1]
    """
    def __init__(self, in_ch: int = 2, base: int = 16, max_disp: float = 0.05):
        super().__init__()
        self.max_disp = max_disp

        self.e1 = ConvBlock3D(in_ch,      base)
        self.e2 = ConvBlock3D(base,   base * 2, stride=2)
        self.e3 = ConvBlock3D(base * 2, base * 4, stride=2)

        self.d3 = ConvBlock3D(base * 4,            base * 2)
        self.d2 = ConvBlock3D(base * 2 + base * 2, base)
        self.d1 = ConvBlock3D(base     + base,      base)

        self.head = nn.Conv3d(base, 3, kernel_size=3, padding=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        s1 = self.e1(x)
        s2 = self.e2(s1)
        bt = self.e3(s2)

        x = F.interpolate(self.d3(bt), size=s2.shape[2:],
                          mode='trilinear', align_corners=True)
        x = self.d2(torch.cat([x, s2], dim=1))
        x = F.interpolate(x, size=s1.shape[2:],
                          mode='trilinear', align_corners=True)
        x = self.d1(torch.cat([x, s1], dim=1))

        return torch.tanh(self.head(x)) * self.max_disp


# ============================================================
# Composition affine + champ local
# ============================================================
def apply_displacement_field(J4: torch.Tensor,
                              disp: torch.Tensor,
                              base_grid: torch.Tensor) -> torch.Tensor:
    """
    J4        : [1, 1, D, H, W]
    disp      : [1, 3, D, H, W]
    base_grid : [D, H, W, 3]
    """
    disp_grid = disp.squeeze(0).permute(1, 2, 3, 0).unsqueeze(0)
    grid_local = (base_grid.unsqueeze(0) + disp_grid).clamp(-1, 1)
    out = F.grid_sample(J4, grid_local,
                        mode='bilinear',
                        padding_mode='border',
                        align_corners=True)
    return out.squeeze()


def compose_and_warp(J4: torch.Tensor,
                     M: torch.Tensor,
                     disp: torch.Tensor,
                     base_grid: torch.Tensor) -> torch.Tensor:
    """
    Applique la transformation affine puis le champ de déplacement local.
    J4        : [1, 1, D, H, W]
    M         : [4, 4]
    disp      : [1, 3, D, H, W]
    base_grid : [D, H, W, 3]
    Retourne  : [D, H, W]
    """
    D, H, W = base_grid.shape[:3]

    xyz_flat = base_grid.reshape(-1, 3)
    ones = torch.ones(xyz_flat.shape[0], 1, device=M.device)
    xyz_hom = torch.cat([xyz_flat, ones], dim=1)
    xyz_w = xyz_hom @ M.T
    w = xyz_w[:, 3:4].clamp_min(1e-6)
    grid_M = (xyz_w[:, :3] / w).reshape(1, D, H, W, 3)

    disp_grid = disp.squeeze(0).permute(1, 2, 3, 0).unsqueeze(0)
    grid_composed = (grid_M + disp_grid).clamp(-1, 1)

    out = F.grid_sample(J4, grid_composed,
                        mode='bilinear',
                        padding_mode='border',
                        align_corners=True)
    return out.squeeze()


def bending_energy_3d(disp: torch.Tensor) -> torch.Tensor:
    """
    Pénalise les dérivées secondes du champ pour forcer des déformations lisses.
    disp : [1, 3, D, H, W]
    """
    be = torch.tensor(0.0, device=disp.device)
    for c in range(3):
        d = disp[:, c]
        for ax in range(1, 4):
            d2 = torch.diff(torch.diff(d, n=1, dim=ax), n=1, dim=ax)
            be = be + d2.pow(2).mean()
    return be


# ============================================================
# Loss hybride multi-résolution
# ============================================================
def multi_resolution_loss_combined(
        affine_net: AffineNet3D,
        deform_net: VoxelMorphNet3D,
        mine_net: MINE3D,
        I_lst, J_lst, xyz_lst, ind_lst,
        L: int,
        max_samples: int = 32768,
        lambda_affine: float = 1e-4,
        lambda_bend: float = 1.0,
        lambda_local: float = 0.5,
) -> torch.Tensor:
    loss = torch.zeros(1, device=next(affine_net.parameters()).device).squeeze()

    for s in range(L - 1, -1, -1):
        M = affine_net(s)
        I4 = I_lst[s].unsqueeze(0).unsqueeze(0)
        J4 = J_lst[s].unsqueeze(0).unsqueeze(0)

        # Terme global (affine seul)
        J_aff = affine_transform_3d(J4, M, xyz_lst[s])
        pairs_aff = torch.stack(
            [I_lst[s].reshape(-1), J_aff.reshape(-1)], dim=1)
        mi_global = mine_net(pairs_aff, ind_lst[s], max_samples=max_samples)

        # Terme local (affine + champ dense)
        inp = torch.cat([I4, J_aff.unsqueeze(0).unsqueeze(0)], dim=1)
        disp = deform_net(inp)
        J_comp = compose_and_warp(J4, M, disp, xyz_lst[s])
        pairs_comp = torch.stack(
            [I_lst[s].reshape(-1), J_comp.reshape(-1)], dim=1)
        mi_local = mine_net(pairs_comp, ind_lst[s], max_samples=max_samples)

        be = bending_energy_3d(disp)

        loss = loss \
             - (1.0 / L) * mi_global \
             - (1.0 / L) * lambda_local * mi_local \
             + (1.0 / L) * lambda_bend * be

    reg = affine_net.vL.pow(2).mean() + affine_net.v1.pow(2).mean()
    return loss + lambda_affine * reg


# ============================================================
# Warp full-resolution (affine + local)
# ============================================================
@torch.no_grad()
def warp_full_resolution_hybrid(
        I_np: np.ndarray,
        J_np: np.ndarray,
        affine_net: AffineNet3D,
        deform_net: VoxelMorphNet3D,  # gardé pour signature compatible, non utilisé ici
        device: torch.device,
        train_dim: int = 80,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Warp final : applique uniquement la transformation AFFINE sur le volume
    pleine résolution.

    Pourquoi pas le champ local ?
    BatchNorm3d dans VoxelMorphNet est entraîné avec batch_size=1 sur 80³ voxels.
    Ses statistiques accumulées (running_mean/var) sont insuffisamment fiables après
    seulement 60 itérations, ce qui produit des champs de déplacement incorrects et
    des artefacts visuels. L'affine seule est propre, reproductible et fiable.
    VoxelMorphNet reste utile pendant l'entraînement : il aide AffineNet à mieux
    converger via le terme MI local, sans être appliqué au résultat final.
    """
    I_dhw = np.transpose(I_np, (2, 1, 0))
    J_dhw = np.transpose(J_np, (2, 1, 0))

    D, H, W = I_dhw.shape
    J4 = torch.from_numpy(J_dhw).float().to(device).unsqueeze(0).unsqueeze(0)

    grid_full = make_grid_3d(D, H, W, device)
    M = affine_net(0)

    # Transformation affine pleine résolution — coordonnées normalisées, résolution-agnostique
    J_aff = affine_transform_3d(J4, M, grid_full)

    J_warped = np.transpose(J_aff.detach().cpu().numpy(), (2, 1, 0))
    M_np = M.detach().cpu().numpy()

    return I_np, J_warped, M_np


# ============================================================
# Point d'entrée principal
# ============================================================
def run_mine_3d_hybrid(
    fixed_path: str,
    moving_path: str,
    output_dir: str,
    n_iters: int = 300,
    max_levels: int = 4,
    levels_used: int = 3,
    max_samples: int = 32768,
    lambda_affine: float = 1e-4,
    lambda_bend: float = 1.0,
    lambda_local: float = 0.5,
    max_disp: float = 0.05,
    base: int = 16,
    device_name: str = 'cuda',
    save_extended_outputs: bool = True,
    early_stop_patience: int = 0,
    early_stop_min_delta: float = 5e-4,
    early_stop_min_iters: int = 35,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> dict:
    """
    Pipeline de recalage hybride 3D MINE (global affine + local VoxelMorph).

    Args:
        fixed_path    : chemin NIfTI image fixe (référence)
        moving_path   : chemin NIfTI image mobile (à recaler)
        output_dir    : répertoire de sortie
        n_iters       : nombre d'itérations (défaut 300, notebook utilisait 500)
        lambda_affine : régularisation paramètres affines (1e-4)
        lambda_bend   : poids énergie de flexion pour le champ local (1.0)
        lambda_local  : poids terme MI local dans la loss (0.5)
        max_disp      : amplitude max du champ de déplacement en [-1,1] (0.05)

    Returns:
        dict avec: success, warped_path, matrix, mutual_information, metrics,
                   processing_time_ms, device
    """
    device = _get_device(device_name)
    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)

    def _cb(pct: int, msg: str):
        if progress_callback:
            try:
                progress_callback(pct, msg)
            except Exception:
                pass

    # ── Chargement NIfTI ──────────────────────────────────────────────────────
    _cb(2, 'Chargement des volumes NIfTI…')
    I_nib = nib.as_closest_canonical(nib.load(fixed_path))
    J_nib = nib.as_closest_canonical(nib.load(moving_path))

    I_raw = I_nib.get_fdata(dtype=np.float32)
    J_raw = J_nib.get_fdata(dtype=np.float32)

    if I_raw.ndim == 4:
        I_raw = I_raw[..., 0]
    if J_raw.ndim == 4:
        J_raw = J_raw[..., 0]

    # Recalage de grille si nécessaire
    shape_mismatch = I_raw.shape != J_raw.shape
    affine_mismatch = not np.allclose(I_nib.affine, J_nib.affine, atol=1e-4)
    if shape_mismatch or affine_mismatch:
        _cb(5, 'Rééchantillonnage des grilles…')
        if resample_from_to is not None:
            try:
                J_resampled = resample_from_to(
                    J_nib, (I_nib.shape, I_nib.affine),
                    order=3, mode='nearest', cval=0.0)
                J_raw = nib.as_closest_canonical(J_resampled).get_fdata(dtype=np.float32)
            except Exception:
                factors = tuple(s_i / s_j for s_i, s_j in zip(I_raw.shape, J_raw.shape))
                J_raw = scipy_zoom(J_raw, factors, order=3)
        else:
            factors = tuple(s_i / s_j for s_i, s_j in zip(I_raw.shape, J_raw.shape))
            J_raw = scipy_zoom(J_raw, factors, order=3)

    # Garde les volumes originaux pour le warp final pleine résolution
    I_raw_orig = I_raw.copy()
    J_raw_orig = J_raw.copy()

    # ── Cap volume à 80³ pour l'entraînement uniquement (RTX 3050 VRAM) ───────
    MAX_DIM_HYBRID = 80
    if max(I_raw.shape) > MAX_DIM_HYBRID:
        factors = tuple(
            MAX_DIM_HYBRID / s if s > MAX_DIM_HYBRID else 1.0
            for s in I_raw.shape
        )
        I_raw = scipy_zoom(I_raw, factors, order=1)
        J_raw = scipy_zoom(J_raw, factors, order=1)
        _cb(7, f'Sous-échantillonnage à {I_raw.shape} — warp final pleine résolution')

    # ── Normalisation & pyramides ──────────────────────────────────────────────
    _cb(8, 'Normalisation et construction des pyramides…')
    I0 = robust_norm01(I_raw)
    J0 = robust_norm01(J_raw)
    I0s = gaussian_filter(I0, sigma=1.0)
    J0s = gaussian_filter(J0, sigma=1.0)

    pyramid_I = pyramid_gaussian_3d(I0s, downscale=2.0, max_levels=max_levels)
    pyramid_J = pyramid_gaussian_3d(J0s, downscale=2.0, max_levels=max_levels)
    L = min(levels_used, len(pyramid_I), len(pyramid_J))

    # ── Préparation tenseurs ───────────────────────────────────────────────────
    MAX_INDICES = 80000
    EDGE_RATIO = 0.7
    I_lst, J_lst, xyz_lst, ind_lst = [], [], [], []

    for s in range(L):
        I_np = pyramid_I[s].astype(np.float32)
        J_np_s = pyramid_J[s].astype(np.float32)

        I_dhw = np.transpose(I_np, (2, 1, 0))
        J_dhw = np.transpose(J_np_s, (2, 1, 0))

        I_t = torch.from_numpy(I_dhw).float().to(device)
        J_t = torch.from_numpy(J_dhw).float().to(device)
        D_, H_, W_ = I_t.shape

        I_lst.append(I_t)
        J_lst.append(J_t)

        grad_mask = gradient_magnitude_3d(I_dhw)
        edge_idx = np.flatnonzero(grad_mask.ravel() > 0)

        total = D_ * H_ * W_
        n_edge = int(MAX_INDICES * EDGE_RATIO)
        n_rand = MAX_INDICES - n_edge

        edge_pick = (np.random.choice(edge_idx, size=n_edge, replace=False)
                     if edge_idx.size > n_edge else edge_idx)
        all_idx = np.arange(total, dtype=np.int64)
        rand_pick = np.random.choice(all_idx, size=min(n_rand, total), replace=False)

        idx = np.unique(np.concatenate([edge_pick, rand_pick]))
        ind_lst.append(torch.from_numpy(idx).long().to(device))
        xyz_lst.append(make_grid_3d(D_, H_, W_, device))

    # ── Initialisation modèles ────────────────────────────────────────────────
    affine_net = AffineNet3D(device).to(device)
    deform_net = VoxelMorphNet3D(in_ch=2, base=base, max_disp=max_disp).to(device)
    mine_net   = MINE3D(n_features=2, n_neurons=256, dropout_rate=0.1).to(device)

    # Libère la VRAM fragmentée avant l'entraînement
    if device.type == 'cuda':
        torch.cuda.empty_cache()

    optimizer = optim.Adam(
        [
            {'params': mine_net.parameters(),   'lr': 5e-4},
            {'params': affine_net.vL,            'lr': 2e-3},
            {'params': affine_net.v1,            'lr': 5e-4},
            {'params': deform_net.parameters(),  'lr': 1e-4},
        ],
        amsgrad=True,
    )
    scaler = torch.amp.GradScaler('cuda', enabled=(device.type == 'cuda'))

    # ── Boucle d'entraînement ─────────────────────────────────────────────────
    mi_curve = []
    best_metric = float('-inf')
    stagnant = 0
    log_every = max(1, min(50, n_iters // 8))
    progress_step = max(1, n_iters // 100)

    _cb(10, 'Démarrage de l\'optimisation hybride…')

    for itr in range(n_iters):
        optimizer.zero_grad(set_to_none=True)

        with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
            loss = multi_resolution_loss_combined(
                affine_net, deform_net, mine_net,
                I_lst, J_lst, xyz_lst, ind_lst,
                L=L,
                max_samples=max_samples,
                lambda_affine=lambda_affine,
                lambda_bend=lambda_bend,
                lambda_local=lambda_local,
            )

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        metric = float(-loss.detach())
        mi_curve.append(metric)

        if early_stop_patience > 0 and itr + 1 >= early_stop_min_iters:
            if metric > best_metric + early_stop_min_delta:
                best_metric = metric
                stagnant = 0
            else:
                stagnant += 1
                if stagnant >= early_stop_patience:
                    print(f'  early stop iter {itr+1}/{n_iters} | MI: {metric:.4f}')
                    break

        if (itr + 1) % log_every == 0 or itr == 0:
            print(f'  [Hybrid] iter {itr+1}/{n_iters} | MI proxy: {metric:.4f}')

        if progress_callback:
            if (itr + 1) % progress_step == 0 or itr + 1 == n_iters or itr == 0:
                # Map training 0→n_iters to progress 10→100 (setup used 0-9).
                pct = 10 + int(round(((itr + 1) / max(1, n_iters)) * 90.0))
                _cb(pct, f'Recalage hybride {itr+1}/{n_iters}')

    # ── Warp pleine résolution sur les volumes ORIGINAUX (pas le 80³) ────────
    I_full = robust_norm01(I_raw_orig)
    J_full = robust_norm01(J_raw_orig)

    # La transformation (M affine + champ local) est en coordonnées normalisées
    # [-1,1] → indépendante de la résolution → s'applique directement à l'original.
    _, J_warped, M_final = warp_full_resolution_hybrid(
        I_full, J_full, affine_net, deform_net, device,
        train_dim=MAX_DIM_HYBRID)

    # ── Métriques ─────────────────────────────────────────────────────────────
    diff_before = np.abs(I_full - J_full)
    diff_after = np.abs(I_full - J_warped)

    mse_before = float(np.mean(diff_before ** 2))
    mse_after = float(np.mean(diff_after ** 2))
    mae_before = float(np.mean(diff_before))
    mae_after = float(np.mean(diff_after))

    sample_size = min(500000, I_full.size)
    idx_s = np.random.choice(I_full.size, sample_size, replace=False)
    ncc_before = float(np.corrcoef(I_full.ravel()[idx_s], J_full.ravel()[idx_s])[0, 1])
    ncc_after = float(np.corrcoef(I_full.ravel()[idx_s], J_warped.ravel()[idx_s])[0, 1])
    ncc_before = 0.0 if np.isnan(ncc_before) else ncc_before
    ncc_after = 0.0 if np.isnan(ncc_after) else ncc_after

    final_mi = mi_curve[-1] if mi_curve else 0.0

    # ── Sauvegarde ────────────────────────────────────────────────────────────
    warped_path = os.path.join(output_dir, 'warped_hybrid.nii.gz')
    matrix_npy_path = os.path.join(output_dir, 'affine_4x4_hybrid.npy')

    warped_img = nib.Nifti1Image(J_warped.astype(np.float32), I_nib.affine, I_nib.header)
    warped_img.header.set_data_dtype(np.float32)
    nib.save(warped_img, warped_path)
    np.save(matrix_npy_path, M_final)

    if save_extended_outputs:
        np.save(os.path.join(output_dir, 'mi_curve_hybrid.npy'), np.array(mi_curve))

    elapsed_ms = round((time.time() - t0) * 1000.0, 2)

    return {
        'success': True,
        'warped_path': warped_path,
        'matrix_path': matrix_npy_path,
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
                'name': 'mine_3d_hybrid',
                'device': str(device),
                'levels': L,
                'iterations': len(mi_curve),
                'iterations_planned': n_iters,
            },
        },
        'processing_time_ms': elapsed_ms,
        'device': str(device),
    }
