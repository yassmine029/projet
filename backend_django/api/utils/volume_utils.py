import numpy as np
from scipy.ndimage import zoom

try:
    import nibabel as nib
except ImportError:
    nib = None

MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024  # 512 MB
ATLAS_SHAPE = (197, 233, 189)


def load_nifti_volume(filepath: str) -> tuple:
    """
    Charge un volume NIfTI en orientation canonique RAS, sans forcer
    de resampling vers la grille atlas. Retourne (volume_3d, best_z).
    """
    if nib is None:
        raise RuntimeError('nibabel not installed')

    img = nib.load(filepath)
    img = nib.as_closest_canonical(img)
    data = img.get_fdata(dtype=np.float32)

    if data.ndim == 4:
        data = data[..., 0]
    elif data.ndim == 2:
        data = data[:, :, np.newaxis]
    elif data.ndim != 3:
        raise ValueError(f'Volume NIfTI non supporte : {data.ndim} dimensions (shape={data.shape})')

    # Force same grid as atlas for consistent slice counts in UI.
    data = _resample_to_atlas_shape(data, ATLAS_SHAPE)

    p1, p99 = np.percentile(data, [1, 99])
    if p99 > p1:
        data = np.clip(data, p1, p99)
        data = (data - p1) / (p99 - p1)
    else:
        data = np.zeros_like(data)

    best_z = _find_best_axial_slice(data)
    return data.astype(np.float32), best_z


def _resample_to_atlas_shape(vol: np.ndarray, target_shape) -> np.ndarray:
    sx, sy, sz = [float(v) for v in vol.shape]
    tx, ty, tz = [float(v) for v in target_shape]
    factors = (tx / max(1.0, sx), ty / max(1.0, sy), tz / max(1.0, sz))
    out = zoom(np.asarray(vol, dtype=np.float32), factors, order=1, mode='nearest', prefilter=False)
    return np.asarray(out, dtype=np.float32)


def _find_best_axial_slice(volume: np.ndarray) -> int:
    counts = np.array([np.count_nonzero(volume[:, :, z]) for z in range(volume.shape[2])])
    return int(np.argmax(counts))


def extract_slice(volume: np.ndarray, axis: str, index: int) -> tuple:
    """Extract oriented 2D slice for display using atlas-RAS conventions."""
    if axis == 'axial':
        max_idx = volume.shape[2] - 1
        index = max(0, min(index, max_idx))
        sl = volume[:, :, index]
        sl = np.flipud(sl.T)
    elif axis == 'coronal':
        max_idx = volume.shape[1] - 1
        index = max(0, min(index, max_idx))
        sl = volume[:, index, :]
        sl = np.flipud(sl.T)
    elif axis == 'sagittal':
        max_idx = volume.shape[0] - 1
        index = max(0, min(index, max_idx))
        sl = volume[index, :, :]
        sl = np.flipud(sl.T)
    else:
        raise ValueError(f'Axe invalide : {axis}')

    return sl, max_idx
