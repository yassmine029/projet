import os
import shutil
import subprocess
import time
from typing import Dict

import nibabel as nib
import numpy as np


def _find_flirt_binary() -> str:
    flirt = shutil.which('flirt')
    if flirt:
        return flirt

    fsldir = os.environ.get('FSLDIR', '')
    if fsldir:
        for name in ('flirt', 'flirt.exe'):
            p = os.path.join(fsldir, 'bin', name)
            if os.path.exists(p):
                return p

    raise RuntimeError(
        'FSL FLIRT introuvable. Installez FSL et ajoutez flirt au PATH '
        'ou configurez la variable FSLDIR.'
    )


def _robust_norm01(arr: np.ndarray, p_low: float = 1.0, p_high: float = 99.0) -> np.ndarray:
    x = np.asarray(arr, dtype=np.float32)
    lo, hi = np.percentile(x, [p_low, p_high])
    if hi <= lo:
        return np.zeros_like(x, dtype=np.float32)
    return np.clip((x - lo) / (hi - lo), 0.0, 1.0)


def _safe_corrcoef(a: np.ndarray, b: np.ndarray, max_points: int = 500000) -> float:
    av = np.asarray(a, dtype=np.float32).reshape(-1)
    bv = np.asarray(b, dtype=np.float32).reshape(-1)
    if av.size == 0 or bv.size == 0:
        return 0.0
    n = min(int(max_points), av.size, bv.size)
    c = float(np.corrcoef(av[:n], bv[:n])[0, 1])
    if np.isnan(c) or np.isinf(c):
        return 0.0
    return c


def _mutual_information(a: np.ndarray, b: np.ndarray, bins: int = 64) -> float:
    aa = np.asarray(a, dtype=np.float32).reshape(-1)
    bb = np.asarray(b, dtype=np.float32).reshape(-1)
    if aa.size == 0 or bb.size == 0:
        return 0.0
    hist2d, _, _ = np.histogram2d(aa, bb, bins=bins, range=[[0.0, 1.0], [0.0, 1.0]])
    pxy = hist2d / max(float(hist2d.sum()), 1.0)
    px = np.sum(pxy, axis=1)
    py = np.sum(pxy, axis=0)
    nz = pxy > 0
    px_py = np.outer(px, py)
    mi = float(np.sum(pxy[nz] * np.log(pxy[nz] / np.maximum(px_py[nz], 1e-12))))
    hx = float(-np.sum(px[px > 0] * np.log(px[px > 0])))
    hy = float(-np.sum(py[py > 0] * np.log(py[py > 0])))
    denom = max(hx + hy, 1e-12)
    nmi = (2.0 * mi) / denom
    return float(np.clip(nmi, 0.0, 1.0))


def run_auto_registration_3d_nifti(
    fixed_path: str,
    moving_path: str,
    output_dir: str,
    n_iters: int = 120,
    max_levels: int = 3,
    levels_used: int = 3,
    max_samples: int = 32768,
    lambda_reg: float = 1e-4,
    device_name: str = 'auto',
    save_extended_outputs: bool = True,
) -> dict:
    del n_iters, max_levels, levels_used, max_samples, lambda_reg, device_name, save_extended_outputs

    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)

    flirt_bin = _find_flirt_binary()
    warped_path = os.path.join(output_dir, 'warped_auto3d.nii.gz')
    matrix_txt_path = os.path.join(output_dir, 'affine_4x4_auto3d.mat')
    matrix_npy_path = os.path.join(output_dir, 'affine_4x4_auto3d.npy')

    cmd = [
        flirt_bin,
        '-in', moving_path,
        '-ref', fixed_path,
        '-out', warped_path,
        '-omat', matrix_txt_path,
        '-dof', '12',
        '-cost', 'corratio',
        '-searchrx', '-90', '90',
        '-searchry', '-90', '90',
        '-searchrz', '-90', '90',
        '-interp', 'spline',
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f'FSL flirt a echoue: {proc.stderr.strip() or proc.stdout.strip()}')

    matrix = np.loadtxt(matrix_txt_path).astype(np.float32)
    np.save(matrix_npy_path, matrix)

    fixed = nib.load(fixed_path).get_fdata(dtype=np.float32)
    moving = nib.load(moving_path).get_fdata(dtype=np.float32)
    warped = nib.load(warped_path).get_fdata(dtype=np.float32)

    fixed_n = _robust_norm01(fixed)
    moving_n = _robust_norm01(moving)
    warped_n = _robust_norm01(warped)

    diff_before = np.abs(fixed_n - moving_n)
    diff_after = np.abs(fixed_n - warped_n)
    mse_before = float(np.mean(diff_before ** 2))
    mse_after = float(np.mean(diff_after ** 2))
    mae_before = float(np.mean(diff_before))
    mae_after = float(np.mean(diff_after))
    ncc_before = _safe_corrcoef(fixed_n, moving_n)
    ncc_after = _safe_corrcoef(fixed_n, warped_n)
    final_mi = _mutual_information(fixed_n, warped_n)

    elapsed_ms = round((time.time() - t0) * 1000.0, 2)
    stage_info: Dict[str, dict] = {
        'engine': {
            'name': 'fsl_flirt',
            'binary': flirt_bin,
            'matrix_txt_path': matrix_txt_path,
        },
        'metrics': {
            'mse_before': mse_before,
            'mse_after': mse_after,
            'mae_before': mae_before,
            'mae_after': mae_after,
            'ncc_before': ncc_before,
            'ncc_after': ncc_after,
        },
    }

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
        'matrix': matrix.tolist(),
        'mutual_information': round(float(final_mi), 4),
        'mi_curve': [],
        'metrics': {
            'mse_before': mse_before,
            'mse_after': mse_after,
            'mae_before': mae_before,
            'mae_after': mae_after,
            'ncc_before': ncc_before,
            'ncc_after': ncc_after,
        },
        'stage_info': stage_info,
        'processing_time_ms': elapsed_ms,
        'device': 'cpu',
    }
