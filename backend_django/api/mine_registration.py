import os
import math
import time
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from skimage.color import rgb2gray
from skimage.transform import pyramid_gaussian
from skimage.filters import gaussian

# Utils from Notebook

def to_float01(x):
    """Convert image to float32 in [0,1]."""
    x = x.astype(np.float32)
    if x.max() > 1.0:
        x = x / 255.0
    return np.clip(x, 0.0, 1.0)

def robust_norm01(x, p_low=1, p_high=99):
    """Percentile normalization per image (good for PET/MRI)."""
    x = x.astype(np.float32)
    lo, hi = np.percentile(x, p_low), np.percentile(x, p_high)
    if hi <= lo:
        return np.zeros_like(x, dtype=np.float32)
    x = (x - lo) / (hi - lo)
    return np.clip(x, 0.0, 1.0).astype(np.float32)

def get_gray_np(x):
    """Ensure image is 2D grayscale float32."""
    if x.ndim == 2:
        return x.astype(np.float32)
    return rgb2gray(x).astype(np.float32)

def canny_edges_for_indexing(x_gray):
    """
    x_gray: float [0,1]
    returns uint8 mask edges
    """
    x_u8 = np.clip(x_gray * 255.0, 0, 255).astype(np.uint8)
    blur = cv2.GaussianBlur(x_u8, (11, 11), 0)
    edges = cv2.Canny(blur, 20, 80)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    return edges

def build_pyramids(I0, J0, downscale=2.0, max_levels=6):
    """Build Gaussian pyramids for both images."""
    if I0.ndim == 2:
        nChannel = 1
        pyramid_I = tuple(
            pyramid_gaussian(
                gaussian(I0, sigma=1, channel_axis=None),
                downscale=downscale, channel_axis=None, max_layer=max_levels
            )
        )
        pyramid_J = tuple(
            pyramid_gaussian(
                gaussian(J0, sigma=1, channel_axis=None),
                downscale=downscale, channel_axis=None, max_layer=max_levels
            )
        )
    else:
        nChannel = I0.shape[2]
        pyramid_I = tuple(
            pyramid_gaussian(
                gaussian(I0, sigma=1, channel_axis=-1),
                downscale=downscale, channel_axis=-1, max_layer=max_levels
            )
        )
        pyramid_J = tuple(
            pyramid_gaussian(
                gaussian(J0, sigma=1, channel_axis=-1),
                downscale=downscale, channel_axis=-1, max_layer=max_levels
            )
        )
    return pyramid_I, pyramid_J, nChannel


class HomographyNet(nn.Module):
    def __init__(self, device):
        super().__init__()
        B = torch.zeros(6, 3, 3, dtype=torch.float32, device=device)
        B[0, 0, 2] = 1.0     # tx
        B[1, 1, 2] = 1.0     # ty
        B[2, 0, 1] = 1.0     # shear y
        B[3, 1, 0] = 1.0     # shear x
        B[4, 0, 0], B[4, 1, 1] = 1.0, -1.0
        B[5, 1, 1], B[5, 2, 2] = -1.0, 1.0

        self.register_buffer("B", B)
        self.v1 = nn.Parameter(torch.zeros(6, 1, 1, dtype=torch.float32, device=device), requires_grad=True)
        self.vL = nn.Parameter(torch.zeros(6, 1, 1, dtype=torch.float32, device=device), requires_grad=True)

    def forward(self, s):
        C = torch.sum(self.B * self.vL, dim=0)
        if s == 0:
            C = C + torch.sum(self.B * self.v1, dim=0)

        A = torch.eye(3, dtype=torch.float32, device=C.device)
        H = A.clone()
        for i in range(1, 10):
            A = (A @ C) / float(i)
            H = H + A
        return H


class MINE(nn.Module):
    def __init__(self, n_channels, n_neurons=128, dropout_rate=0.1):
        super().__init__()
        self.fc1 = nn.Linear(2 * n_channels, n_neurons)
        self.fc2 = nn.Linear(n_neurons, n_neurons)
        self.fc3 = nn.Linear(n_neurons, 1)
        self.dropout = nn.Dropout(dropout_rate)

    def _net(self, z):
        z = F.relu(self.fc1(z))
        z = self.dropout(F.relu(self.fc2(z)))
        z = self.fc3(z)
        return z

    def forward(self, x, ind, max_samples=32768):
        x = x.reshape(-1, x.shape[-1])
        m = ind.numel()
        if m > max_samples:
            sel = torch.randperm(m, device=ind.device)[:max_samples]
            ind_use = ind[sel]
        else:
            ind_use = ind
        perm = ind_use[torch.randperm(ind_use.numel(), device=ind_use.device)]
        c = x.shape[1] // 2
        pos = x[ind_use, :]
        neg = torch.cat([x[ind_use, :c], x[perm, c:]], dim=1)
        z1 = self._net(pos)
        z2 = self._net(neg)
        term_pos = z1.mean()
        term_neg = torch.logsumexp(z2, dim=0) - math.log(z2.shape[0])
        return (term_pos - term_neg).squeeze()


def affine_transform(I4, H, xv, yv):
    den = (xv * H[2, 0] + yv * H[2, 1] + H[2, 2]).clamp_min(1e-6)
    xvt = (xv * H[0, 0] + yv * H[0, 1] + H[0, 2]) / den
    yvt = (xv * H[1, 0] + yv * H[1, 1] + H[1, 2]) / den
    grid = torch.stack([xvt, yvt], dim=2).unsqueeze(0)
    out = F.grid_sample(
        I4, grid,
        mode='bilinear',
        padding_mode='zeros',
        align_corners=False
    )
    return out.squeeze(0)


def multi_resolution_loss(homography_net, mine_net, I_lst, J_lst, xy_lst, ind_lst, L,
                          nChannel, max_samples=32768, lambda_reg=1e-4):
    loss = 0.0
    for s in range(L - 1, -1, -1):
        Hs = homography_net(s)
        if nChannel > 1:
            Jw = affine_transform(J_lst[s].unsqueeze(0), Hs, xy_lst[s][:, :, 0], xy_lst[s][:, :, 1])
            xcat = torch.cat([I_lst[s], Jw], dim=0).permute(1, 2, 0).contiguous()
        else:
            Jw = affine_transform(J_lst[s].unsqueeze(0).unsqueeze(0), Hs, xy_lst[s][:, :, 0], xy_lst[s][:, :, 1]).squeeze(0)
            xcat = torch.stack([I_lst[s], Jw], dim=2).contiguous()
        mi = mine_net(xcat, ind_lst[s], max_samples=max_samples)
        loss = loss - (1.0 / L) * mi
    reg = (homography_net.vL.pow(2).mean() + homography_net.v1.pow(2).mean())
    loss = loss + lambda_reg * reg
    return loss


@torch.no_grad()
def warp_full_resolution(I_np, J_np, homography_net, device):
    I_f = torch.from_numpy(I_np.astype(np.float32)).to(device)
    J_f = torch.from_numpy(J_np.astype(np.float32)).to(device)

    if I_f.ndim == 3:
        I_t = I_f.permute(2, 0, 1).contiguous()
        J_t = J_f.permute(2, 0, 1).contiguous()
        c, h, w = I_t.shape
    else:
        I_t = I_f
        J_t = J_f
        h, w = I_t.shape

    y_, x_ = torch.meshgrid(
        torch.arange(h, device=device, dtype=torch.float32),
        torch.arange(w, device=device, dtype=torch.float32),
        indexing='ij'
    )
    y_ = 2.0 * y_ / max(h - 1, 1) - 1.0
    x_ = 2.0 * x_ / max(w - 1, 1) - 1.0

    H = homography_net(0)
    if I_t.ndim == 3:
        Jw = affine_transform(J_t.unsqueeze(0), H, x_, y_)
        Jw_np = Jw.permute(1, 2, 0).detach().cpu().numpy()
        I_np_out = I_t.permute(1, 2, 0).detach().cpu().numpy()
    else:
        Jw = affine_transform(J_t.unsqueeze(0).unsqueeze(0), H, x_, y_).squeeze(0)
        Jw_np = Jw.detach().cpu().numpy()
        I_np_out = I_t.detach().cpu().numpy()

    return I_np_out, Jw_np, H.detach().cpu().numpy()


def run_mine_registration(
    fixed_path: str,
    moving_path: str,
    output_prefix: str,
    n_iters: int = 300,
    max_levels: int = 6,
    L: int = 4,
    max_samples: int = 32768,
    lambda_reg: float = 1e-4,
    device_name: str = "auto"
) -> dict:
    """
    Complete registration pipeline.
    FIX: Load images as GRAYSCALE (same as Colab notebook).
    """
    if device_name == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device_name)

    print(f"MINE registration using device: {device}")
    start_time = time.time()

    # ✅ FIX 1: Load images as GRAYSCALE (identical to Colab)
    I_raw = cv2.imread(fixed_path, cv2.IMREAD_GRAYSCALE)
    J_raw = cv2.imread(moving_path, cv2.IMREAD_GRAYSCALE)

    if I_raw is None or J_raw is None:
        raise ValueError(f"Could not read images: {fixed_path}, {moving_path}")

    # Resize J to I size if needed
    if I_raw.shape[:2] != J_raw.shape[:2]:
        J_raw = cv2.resize(J_raw, (I_raw.shape[1], I_raw.shape[0]), interpolation=cv2.INTER_LINEAR)

    # Normalize to [0, 1]
    I0 = robust_norm01(I_raw)
    J0 = robust_norm01(J_raw)

    # Build pyramids
    pyramid_I, pyramid_J, nChannel = build_pyramids(I0, J0, max_levels=max_levels)
    L = min(L, len(pyramid_I), len(pyramid_J))

    print(f"nChannel: {nChannel}, Pyramid levels used: {L}")

    # Prepare tensors for each level
    I_lst, J_lst = [], []
    h_lst, w_lst = [], []
    xy_lst, ind_lst = [], []

    MAX_INDICES = 120000
    EDGE_RATIO = 0.7

    for s in range(L):
        I_np = pyramid_I[s].astype(np.float32)
        J_np = pyramid_J[s].astype(np.float32)

        if nChannel > 1:
            I_t = torch.from_numpy(I_np).permute(2, 0, 1).contiguous().to(device)
            J_t = torch.from_numpy(J_np).permute(2, 0, 1).contiguous().to(device)
            h_, w_ = I_t.shape[1], I_t.shape[2]
            I_gray = get_gray_np(I_np)
        else:
            I_t = torch.from_numpy(I_np).contiguous().to(device)
            J_t = torch.from_numpy(J_np).contiguous().to(device)
            h_, w_ = I_t.shape[0], I_t.shape[1]
            I_gray = I_np

        I_lst.append(I_t)
        J_lst.append(J_t)
        h_lst.append(h_)
        w_lst.append(w_)

        edges = canny_edges_for_indexing(I_gray)
        edge_idx = np.flatnonzero(edges.reshape(-1) > 0)
        total = h_ * w_
        all_idx = np.arange(total, dtype=np.int64)

        n_edge = int(MAX_INDICES * EDGE_RATIO)
        n_rand = MAX_INDICES - n_edge

        if edge_idx.size > 0:
            edge_pick = np.random.choice(edge_idx, size=min(n_edge, edge_idx.size), replace=False)
        else:
            edge_pick = np.array([], dtype=np.int64)

        rand_pick = np.random.choice(all_idx, size=min(n_rand, total), replace=False)
        idx = np.unique(np.concatenate([edge_pick, rand_pick]))
        ind_lst.append(torch.from_numpy(idx).long().to(device))

        y_, x_ = torch.meshgrid(
            torch.arange(h_, device=device, dtype=torch.float32),
            torch.arange(w_, device=device, dtype=torch.float32),
            indexing='ij'
        )
        y_ = 2.0 * y_ / max(h_ - 1, 1) - 1.0
        x_ = 2.0 * x_ / max(w_ - 1, 1) - 1.0
        xy_lst.append(torch.stack([x_, y_], dim=2))

    # Init models
    homography_net = HomographyNet(device).to(device)
    mine_net = MINE(n_channels=nChannel, n_neurons=200, dropout_rate=0.1).to(device)

    optimizer = optim.Adam([
        {'params': mine_net.parameters(), 'lr': 5e-4},
        {'params': homography_net.vL, 'lr': 2e-3},
        {'params': homography_net.v1, 'lr': 5e-4},
    ], amsgrad=True)

    scaler = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    # Training loop
    for itr in range(n_iters):
        optimizer.zero_grad(set_to_none=True)
        with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
            loss = multi_resolution_loss(
                homography_net, mine_net, I_lst, J_lst, xy_lst, ind_lst,
                L=L, nChannel=nChannel, max_samples=max_samples, lambda_reg=lambda_reg
            )
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        if (itr + 1) % 50 == 0:
            print(f"  iter {itr+1}/{n_iters} | MI proxy: {(-loss).item():.4f}")

    # Final warp at full resolution
    I_aligned, J_warped, H_final = warp_full_resolution(I0, J0, homography_net, device)

    # ✅ Calculer la MI finale - la vraie métrique pour recalage multimodal IRM/PET
    homography_net.eval()
    mine_net.eval()
    final_mi = 0.0
    try:
        with torch.no_grad():
            with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                final_loss = multi_resolution_loss(
                    homography_net, mine_net, I_lst, J_lst, xy_lst, ind_lst,
                    L=L, nChannel=nChannel, max_samples=max_samples, lambda_reg=0.0
                )
                final_mi = float(-final_loss.item())
        print(f"✓ Information Mutuelle finale (MI) : {final_mi:.4f}")
    except Exception as e:
        print(f"Warning: could not compute final MI: {e}")
        final_mi = 0.0

    # Save results
    # ✅ FIX 4: Créer tous les dossiers parents nécessaires
    output_dir = os.path.dirname(output_prefix)
    os.makedirs(output_dir, exist_ok=True)
    print(f"Saving results to: {output_dir}")

    warped_path = f"{output_prefix}_warped.png"
    transform_path = f"{output_prefix}_H.npy"

    # ✅ FIX 5: Sauvegarder avec matplotlib + cmap='gray' comme dans Colab
    J_warped_squeezed = J_warped.squeeze()
    J_warped_u8 = np.clip(J_warped_squeezed * 255.0, 0, 255).astype(np.uint8)
    cv2.imwrite(warped_path, J_warped_u8)
    print(f"✓ Image recalée sauvegardée (uint8 grayscale) : {warped_path}")

    np.save(transform_path, H_final)
    print(f"✓ Matrice H sauvegardée : {transform_path}")

    elapsed = time.time() - start_time
    print(f"MINE registration done in {elapsed:.1f}s on {device}")

    return {
        "success": True,
        "warped_path": warped_path,
        "transform_path": transform_path,
        "processing_time": elapsed,
        "device": str(device),
        "mutual_information": round(final_mi, 4),
    }