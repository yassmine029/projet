import base64
import json
import os
import tempfile
import uuid
from typing import Dict

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import zoom
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view
from .utils.volume_utils import extract_slice, MAX_FILE_SIZE_BYTES
from .volume_mine_3d_registration import run_mine_3d_nifti

try:
    import nibabel as nib
except Exception:
    nib = None

try:
    from nilearn import datasets
    from nilearn import image as nilearn_image
except Exception:
    datasets = None
    nilearn_image = None

VOLUMES_CACHE: Dict[str, dict] = {}
JOBS_ROOT_DIR = os.path.join(tempfile.gettempdir(), 'visionmed_volume_jobs')


def _job_state_dir(job_id: str) -> str:
    return os.path.join(JOBS_ROOT_DIR, str(job_id), 'state')


def _job_meta_path(job_id: str) -> str:
    return os.path.join(_job_state_dir(job_id), 'meta.json')


def _job_array_path(job_id: str, key: str) -> str:
    return os.path.join(_job_state_dir(job_id), f'{key}.npy')


def _persist_job_entry(job_id: str):
    entry = VOLUMES_CACHE.get(job_id)
    if entry is None:
        return

    state_dir = _job_state_dir(job_id)
    os.makedirs(state_dir, exist_ok=True)

    array_keys = ('data', 'data_original', 'registered_data', 'pending_registered_data')
    for key in array_keys:
        p = _job_array_path(job_id, key)
        arr = entry.get(key)
        if arr is None:
            if os.path.exists(p):
                os.remove(p)
            continue
        np.save(p, np.asarray(arr, dtype=np.float32))

    meta_keys = (
        'type',
        'nifti_path',
        'pending_registration',
        'selected_label',
        'selected_label_name',
        'selected_slice',
    )
    meta = {k: entry.get(k) for k in meta_keys}
    with open(_job_meta_path(job_id), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=True)


def _load_job_entry_from_disk(job_id: str):
    meta_path = _job_meta_path(job_id)
    if not os.path.exists(meta_path):
        return None

    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)

        entry = {
            'type': meta.get('type', 'patient'),
            'nifti_path': meta.get('nifti_path'),
            'pending_registration': meta.get('pending_registration'),
            'selected_label': meta.get('selected_label'),
            'selected_label_name': meta.get('selected_label_name'),
            'selected_slice': meta.get('selected_slice'),
            'registered_data': None,
            'pending_registered_data': None,
        }

        data_path = _job_array_path(job_id, 'data')
        if not os.path.exists(data_path):
            return None
        entry['data'] = np.load(data_path).astype(np.float32)

        # Load original (unresized) patient data if available
        data_original_path = _job_array_path(job_id, 'data_original')
        if os.path.exists(data_original_path):
            entry['data_original'] = np.load(data_original_path).astype(np.float32)
        else:
            entry['data_original'] = entry['data'].copy()  # Fallback to resized if original not found

        reg_path = _job_array_path(job_id, 'registered_data')
        if os.path.exists(reg_path):
            entry['registered_data'] = np.load(reg_path).astype(np.float32)

        pending_path = _job_array_path(job_id, 'pending_registered_data')
        if os.path.exists(pending_path):
            entry['pending_registered_data'] = np.load(pending_path).astype(np.float32)

        return entry
    except Exception:
        return None


def _get_job_entry(job_id: str):
    if job_id in VOLUMES_CACHE:
        return VOLUMES_CACHE[job_id]
    entry = _load_job_entry_from_disk(job_id)
    if entry is None:
        return None
    VOLUMES_CACHE[job_id] = entry
    return entry


def _save_volume_nifti(vol: np.ndarray, path: str, affine: np.ndarray = None):
    """Save volume as NIfTI with proper affine matrix.
    
    CRITICAL: Always use atlas affine when saving for MINE 3D registration.
    This ensures both fixed and moving volumes share the same world coordinate space.
    
    Args:
        vol: Volume array [X, Y, Z]
        path: Output file path
        affine: Optional explicit affine. If not provided, uses atlas affine.
    """
    if nib is None:
        raise RuntimeError('nibabel not installed')
    
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    # CRITICAL FIX: Always use atlas affine to ensure spatial coherence
    if affine is not None:
        aff = np.asarray(affine, dtype=np.float32)
    else:
        # Ensure atlas is loaded and use its affine
        try:
            _ensure_atlas()
            atlas_affine = VOLUMES_CACHE['atlas'].get('affine')
            if atlas_affine is not None:
                aff = np.asarray(atlas_affine, dtype=np.float32)
            else:
                aff = np.eye(4, dtype=np.float32)
        except Exception:
            aff = np.eye(4, dtype=np.float32)
    
    print(f"[DEBUG_NIFTI] Saving: {os.path.basename(path)}")
    print(f"              Shape: {vol.shape}")
    print(f"              Affine:\n{aff}")
    
    nii = nib.Nifti1Image(np.asarray(vol, dtype=np.float32), aff)
    nii.header.set_data_dtype(np.float32)
    nib.save(nii, path)


def _zone_text_for_name(name: str) -> dict:
    n = (name or '').lower()
    if not n:
        return {
            'desc': 'Region corticale atlas associee a des fonctions cognitives et sensori-motrices.',
            'functionality': 'Traitement cortical multimodal (perception, integration et controle moteur).',
        }

    mapping = [
        ('broca', 'Region du langage expressif dans le lobe frontal inferieur.', 'Production du langage, articulation et planification motrice de la parole.'),
        ('wernicke', 'Region temporo-parietale du langage receptif.', 'Compréhension du langage oral et integration semantique.'),
        ('precentral', 'Cortex moteur primaire situe dans le gyrus precentral.', 'Commande motrice volontaire controlatérale.'),
        ('postcentral', 'Cortex somatosensoriel primaire situe dans le gyrus postcentral.', 'Traitement tactile, proprioceptif et sensibilite corporelle.'),
        ('cuneus', 'Region occipitale mediale impliquant le cortex visuel.', 'Analyse visuelle primaire et integration visuo-spatiale.'),
        ('calcarine', 'Scissure calcarine correspondant au cortex visuel primaire.', 'Traitement initial des informations visuelles retinotopiques.'),
        ('frontal pole', 'Zone anterieure du cortex prefrontal.', 'Fonctions executives, anticipation et controle cognitif de haut niveau.'),
        ('insula', 'Region insulaire profonde reliee aux reseaux salience/autonomes.', 'Integration interoceptive, douleur, emotion et perception corporelle.'),
        ('cingulate', 'Cortex cingulaire medial relie aux reseaux attentionnels.', 'Controle attentionnel, regulation emotionnelle et suivi de conflit.'),
        ('hippocamp', 'Region temporale mediale associee a la memoire episodique.', 'Encodage et consolidation de la memoire.'),
        ('thalam', 'Relais sous-cortical majeur entre voies sensorielles et cortex.', 'Relais sensoriel et modulation de l information corticale.'),
    ]

    for key, desc, functionality in mapping:
        if key in n:
            return {'desc': desc, 'functionality': functionality}

    return {
        'desc': f'Region atlas: {name}. Zone corticale associee a un reseau fonctionnel specifique.',
        'functionality': 'Fonction probable: integration sensori-motrice et traitement cognitif contextuel.',
    }


def _nearest_nonzero_label(sl: np.ndarray, x: int, y: int, max_radius: int = 24):
    h, w = sl.shape
    if x < 0 or y < 0 or x >= w or y >= h:
        return 0

    direct = int(sl[y, x])
    if direct > 0:
        return direct

    for r in range(1, max_radius + 1):
        x0 = max(0, x - r)
        x1 = min(w - 1, x + r)
        y0 = max(0, y - r)
        y1 = min(h - 1, y + r)
        window = sl[y0:y1 + 1, x0:x1 + 1]
        ys, xs = np.where(window > 0)
        if ys.size == 0:
            continue
        gx = xs + x0
        gy = ys + y0
        d2 = (gx - x) ** 2 + (gy - y) ** 2
        best = int(np.argmin(d2))
        return int(sl[int(gy[best]), int(gx[best])])

    return 0


def _component_mask_near_point(mask_u8: np.ndarray, x: int, y: int) -> np.ndarray:
    """Keep only the connected component that matches (or is nearest to) the click."""
    if mask_u8 is None or mask_u8.size == 0:
        return np.zeros((1, 1), dtype=np.uint8)

    base = (mask_u8 > 0).astype(np.uint8)
    if np.count_nonzero(base) == 0:
        return np.zeros_like(base, dtype=np.uint8)

    num, labels, stats, centroids = cv2.connectedComponentsWithStats(base, connectivity=8)
    if num <= 1:
        return (base * 255).astype(np.uint8)

    h, w = base.shape
    x = int(np.clip(x, 0, max(0, w - 1)))
    y = int(np.clip(y, 0, max(0, h - 1)))

    chosen = int(labels[y, x])
    if chosen <= 0:
        # Click landed between components: pick nearest component centroid.
        best_label = 0
        best_d2 = None
        for lab in range(1, num):
            cx, cy = centroids[lab]
            d2 = float((cx - x) ** 2 + (cy - y) ** 2)
            if best_d2 is None or d2 < best_d2:
                best_d2 = d2
                best_label = lab
        chosen = best_label

    if chosen <= 0:
        return np.zeros_like(base, dtype=np.uint8)

    return ((labels == chosen).astype(np.uint8) * 255)


def _patient_foreground_mask(img_u8: np.ndarray) -> np.ndarray:
    """Build a robust patient foreground mask to avoid drawing contours in background."""
    if img_u8 is None or img_u8.size == 0:
        return np.zeros((1, 1), dtype=np.uint8)

    src = img_u8.astype(np.uint8)
    blur = cv2.GaussianBlur(src, (5, 5), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = np.ones((3, 3), dtype=np.uint8)
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel, iterations=1)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)

    num, labels, stats, _ = cv2.connectedComponentsWithStats((th > 0).astype(np.uint8), connectivity=8)
    if num <= 1:
        return th

    # Keep largest non-background component (head region).
    areas = stats[1:, cv2.CC_STAT_AREA]
    best = int(np.argmax(areas)) + 1
    out = ((labels == best).astype(np.uint8) * 255)

    # Slight dilation keeps contour visible at cortical boundary.
    out = cv2.dilate(out, kernel, iterations=1)
    return out


def _encode_png_data_url(img_u8: np.ndarray) -> str:
    ok, buf = cv2.imencode('.png', img_u8)
    if not ok:
        raise ValueError('PNG encoding failed')
    return 'data:image/png;base64,' + base64.b64encode(buf).decode('utf-8')


def _normalize_u8(arr: np.ndarray) -> np.ndarray:
    arr = np.nan_to_num(arr.astype(np.float32), nan=0.0, posinf=0.0, neginf=0.0)
    lo, hi = np.percentile(arr, [1, 99])
    if hi <= lo:
        return np.zeros_like(arr, dtype=np.uint8)
    out = (arr - lo) / (hi - lo)
    out = np.clip(out, 0.0, 1.0)
    return (out * 255.0).astype(np.uint8)


def _center_foreground_u8(img_u8: np.ndarray, threshold: int = 12) -> np.ndarray:
    """Display-only centering based on largest foreground component bbox center."""
    if img_u8 is None or img_u8.size == 0:
        return img_u8

    mask = (img_u8 > int(threshold)).astype(np.uint8)
    if np.count_nonzero(mask) == 0:
        return img_u8

    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num <= 1:
        ys, xs = np.where(mask > 0)
        if xs.size == 0 or ys.size == 0:
            return img_u8
        min_x, max_x = int(xs.min()), int(xs.max())
        min_y, max_y = int(ys.min()), int(ys.max())
    else:
        # Ignore background component 0 and keep largest blob.
        areas = stats[1:, cv2.CC_STAT_AREA]
        best = int(np.argmax(areas)) + 1
        min_x = int(stats[best, cv2.CC_STAT_LEFT])
        min_y = int(stats[best, cv2.CC_STAT_TOP])
        w_box = int(stats[best, cv2.CC_STAT_WIDTH])
        h_box = int(stats[best, cv2.CC_STAT_HEIGHT])
        max_x = min_x + w_box - 1
        max_y = min_y + h_box - 1

    h, w = img_u8.shape[:2]
    cx = 0.5 * (min_x + max_x)
    cy = 0.5 * (min_y + max_y)
    tx = (w - 1) * 0.5
    ty = (h - 1) * 0.5

    dx = int(round(tx - cx))
    dy = int(round(ty - cy))
    M = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float32)
    centered = cv2.warpAffine(
        img_u8,
        M,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    return centered


def _resize_u8_to_shape(img_u8: np.ndarray, target_shape_hw) -> np.ndarray:
    """Resize a grayscale slice to (h, w) while preserving uint8 output."""
    if img_u8 is None:
        return img_u8
    target_h, target_w = int(target_shape_hw[0]), int(target_shape_hw[1])
    h, w = img_u8.shape[:2]
    if h == target_h and w == target_w:
        return img_u8
    return cv2.resize(img_u8, (target_w, target_h), interpolation=cv2.INTER_LINEAR)


def _resize_mask_to_shape(mask_u8: np.ndarray, target_shape_hw) -> np.ndarray:
    """Resize binary mask to (h, w) with nearest-neighbor to preserve labels."""
    if mask_u8 is None:
        return mask_u8
    target_h, target_w = int(target_shape_hw[0]), int(target_shape_hw[1])
    h, w = mask_u8.shape[:2]
    if h == target_h and w == target_w:
        return mask_u8
    out = cv2.resize(mask_u8, (target_w, target_h), interpolation=cv2.INTER_NEAREST)
    return (out > 0).astype(np.uint8) * 255


def _compute_ncc(fixed_u8: np.ndarray, moving_u8: np.ndarray) -> float:
    """Compute normalized cross-correlation in [0, 1] for two same-shape slices."""
    if fixed_u8 is None or moving_u8 is None or fixed_u8.shape != moving_u8.shape:
        return 0.0
    a = fixed_u8.astype(np.float32)
    b = moving_u8.astype(np.float32)
    a -= float(np.mean(a))
    b -= float(np.mean(b))
    denom = float(np.sqrt(np.sum(a * a) * np.sum(b * b)))
    if denom <= 1e-8:
        return 0.0
    ncc = float(np.sum(a * b) / denom)
    # Keep an intuitive clinical score scale [0, 1].
    return float(np.clip((ncc + 1.0) * 0.5, 0.0, 1.0))


def _compute_mutual_information(fixed_u8: np.ndarray, moving_u8: np.ndarray, bins: int = 64) -> float:
    """Compute normalized mutual information in [0, 1] for two same-shape slices."""
    if fixed_u8 is None or moving_u8 is None or fixed_u8.shape != moving_u8.shape:
        return 0.0

    a = fixed_u8.reshape(-1).astype(np.float32)
    b = moving_u8.reshape(-1).astype(np.float32)
    if a.size == 0 or b.size == 0:
        return 0.0

    hist2d, _, _ = np.histogram2d(a, b, bins=bins, range=[[0, 255], [0, 255]])
    pxy = hist2d / np.maximum(float(np.sum(hist2d)), 1.0)
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


def load_patient(filepath: str):
    if nib is None:
        raise RuntimeError('nibabel not installed')
    img = nib.load(filepath)
    # Standardize orientation to canonical axes (RAS) so axial/coronal/sagittal
    # slicing stays consistent with the atlas reference volume.
    img = nib.as_closest_canonical(img)
    volume = img.get_fdata().astype(np.float32)
    z_milieu = volume.shape[2] // 2
    slice_mediane = volume[:, :, z_milieu]
    return volume, slice_mediane


def slice_to_png(slice_2d: np.ndarray):
    arr = np.asarray(slice_2d, dtype=np.float32)
    vmin = float(np.min(arr))
    vmax = float(np.max(arr))
    if vmax <= vmin:
        slice_norm = np.zeros_like(arr, dtype=np.uint8)
    else:
        slice_norm = ((arr - vmin) / (vmax - vmin) * 255.0).astype(np.uint8)
    return Image.fromarray(slice_norm)


def _slice_to_data_url(slice_2d: np.ndarray) -> str:
    pil_img = slice_to_png(slice_2d)
    img_u8 = np.array(pil_img, dtype=np.uint8)
    return _encode_png_data_url(np.rot90(img_u8))


def _render_slice(vol: np.ndarray, index: int, axis: str = 'axial') -> np.ndarray:
    axis = (axis or 'axial').lower()
    if axis == 'sagittal':
        sl = vol[index, :, :]
    elif axis == 'coronal':
        sl = vol[:, index, :]
    else:
        sl = vol[:, :, index]
    return np.rot90(sl)


def _render_label_slice_rgb(labels_vol: np.ndarray, index: int, axis: str = 'axial') -> np.ndarray:
    labels_2d = _render_slice(labels_vol, index, axis).astype(np.int32)
    h, w = labels_2d.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)

    unique_labels = np.unique(labels_2d)
    for label in unique_labels:
        if label <= 0:
            continue
        # Deterministic vivid color per label id.
        r = int((37 * int(label) + 71) % 205) + 50
        g = int((53 * int(label) + 29) % 205) + 50
        b = int((97 * int(label) + 11) % 205) + 50
        rgb[labels_2d == label] = (r, g, b)
    return rgb


def _draw_clinical_contour(img_rgb: np.ndarray, contours) -> np.ndarray:
    if img_rgb is None or len(contours) == 0:
        return img_rgb

    # Clinical turquoise palette (OpenCV channel order) for very high visibility.
    glow = img_rgb.copy()
    cv2.drawContours(glow, contours, -1, (255, 240, 120), 7, lineType=cv2.LINE_AA)
    out = cv2.addWeighted(glow, 0.40, img_rgb, 0.60, 0)

    # White edge + bright turquoise core to keep the contour readable for radiologists.
    cv2.drawContours(out, contours, -1, (255, 255, 255), 2, lineType=cv2.LINE_AA)
    cv2.drawContours(out, contours, -1, (255, 255, 0), 2, lineType=cv2.LINE_AA)
    return out


def _estimate_residual_xy_shift(
    atlas_u8: np.ndarray,
    patient_u8: np.ndarray,
    max_shift_ratio: float = 0.18,
    min_phase_response: float = 0.02,
) -> tuple:
    """Estimate small residual translation to align atlas anatomy to patient anatomy."""
    if atlas_u8 is None or patient_u8 is None:
        return 0.0, 0.0
    if atlas_u8.shape != patient_u8.shape:
        patient_u8 = _resize_u8_to_shape(patient_u8, atlas_u8.shape)

    try:
        a = cv2.GaussianBlur(atlas_u8.astype(np.float32), (5, 5), 0)
        b = cv2.GaussianBlur(patient_u8.astype(np.float32), (5, 5), 0)
        # phaseCorrelate returns the shift to apply to src2 (patient) to match src1 (atlas).
        # To draw atlas contours on patient, we apply the opposite shift.
        (dx, dy), response = cv2.phaseCorrelate(a, b)
        if not np.isfinite(dx) or not np.isfinite(dy) or response < float(min_phase_response):
            return 0.0, 0.0

        ratio = float(np.clip(max_shift_ratio, 0.02, 0.30))
        max_shift_x = float(max(2, int(atlas_u8.shape[1] * ratio)))
        max_shift_y = float(max(2, int(atlas_u8.shape[0] * ratio)))
        dx = float(np.clip(dx, -max_shift_x, max_shift_x))
        dy = float(np.clip(dy, -max_shift_y, max_shift_y))
        return -dx, -dy
    except Exception:
        return 0.0, 0.0


def _translate_contours(contours, dx: float, dy: float):
    if not contours:
        return contours
    out = []
    for c in contours:
        c_shift = c.astype(np.float32).copy()
        c_shift[:, 0, 0] += float(dx)
        c_shift[:, 0, 1] += float(dy)
        out.append(np.round(c_shift).astype(np.int32))
    return out


def _extract_patient_contours(
    mask_u8: np.ndarray,
    patient_u8: np.ndarray,
    atlas_u8: np.ndarray = None,
    max_shift_ratio: float = 0.18,
    min_phase_response: float = 0.02,
):
    """Extract contours on patient slice with robust fallbacks for all viewing axes."""
    if mask_u8 is None or patient_u8 is None or mask_u8.size == 0 or patient_u8.size == 0:
        return []

    base_mask = (mask_u8 > 0).astype(np.uint8) * 255
    if np.count_nonzero(base_mask) == 0:
        return []

    shifted_mask = base_mask
    if atlas_u8 is not None:
        dx, dy = _estimate_residual_xy_shift(
            atlas_u8,
            patient_u8,
            max_shift_ratio=max_shift_ratio,
            min_phase_response=min_phase_response,
        )
        M = np.array([[1.0, 0.0, float(dx)], [0.0, 1.0, float(dy)]], dtype=np.float32)
        shifted_mask = cv2.warpAffine(
            base_mask,
            M,
            (patient_u8.shape[1], patient_u8.shape[0]),
            flags=cv2.INTER_NEAREST,
            borderValue=0,
        )

    patient_fg = _patient_foreground_mask(patient_u8)
    candidates = [
        cv2.bitwise_and(shifted_mask, patient_fg),
        shifted_mask,
        cv2.bitwise_and(base_mask, patient_fg),
        base_mask,
    ]

    for candidate in candidates:
        if candidate is None or np.count_nonzero(candidate) == 0:
            continue
        contours, _ = cv2.findContours(candidate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            return contours

    return []


def _remap_mask_atlas_to_patient(
    mask_atlas: np.ndarray,
    atlas_vol_shape: tuple,
    patient_vol_shape: tuple,
    axis: str,
    patient_img_shape: tuple,
) -> np.ndarray:
    """
    Reproject a mask from atlas slice space to patient slice space while
    respecting 3D voxel-grid proportions for the current viewing axis.
    """
    axis = (axis or 'axial').lower()

    # _render_slice + rot90 mapping to 2D (h, w) voxel extents.
    if axis == 'sagittal':
        atlas_h_vox = atlas_vol_shape[2]
        atlas_w_vox = atlas_vol_shape[1]
        patient_h_vox = patient_vol_shape[2]
        patient_w_vox = patient_vol_shape[1]
    elif axis == 'coronal':
        atlas_h_vox = atlas_vol_shape[2]
        atlas_w_vox = atlas_vol_shape[0]
        patient_h_vox = patient_vol_shape[2]
        patient_w_vox = patient_vol_shape[0]
    else:  # axial
        atlas_h_vox = atlas_vol_shape[1]
        atlas_w_vox = atlas_vol_shape[0]
        patient_h_vox = patient_vol_shape[1]
        patient_w_vox = patient_vol_shape[0]

    ah, aw = mask_atlas.shape[:2]
    ph, pw = patient_img_shape[:2]

    cx_atlas = aw / 2.0
    cy_atlas = ah / 2.0
    cx_patient = pw / 2.0
    cy_patient = ph / 2.0

    # Pixel-atlas -> pixel-patient centered affine scale.
    sx = (pw / max(aw, 1)) * (atlas_w_vox / max(patient_w_vox, 1))
    sy = (ph / max(ah, 1)) * (atlas_h_vox / max(patient_h_vox, 1))
    tx = cx_patient - cx_atlas * sx
    ty = cy_patient - cy_atlas * sy

    M = np.array([[sx, 0.0, tx], [0.0, sy, ty]], dtype=np.float32)
    mask_patient = cv2.warpAffine(
        mask_atlas,
        M,
        (pw, ph),
        flags=cv2.INTER_NEAREST,
        borderValue=0,
    )
    return mask_patient


def _extract_patient_contours_v2(
    mask_patient: np.ndarray,
    patient_img: np.ndarray,
    vol_state: str = 'raw',
) -> list:
    """
    Simpler and more stable extraction: avoid phase-correlation shifts and
    prioritize overlap with patient foreground.
    """
    if mask_patient is None or np.count_nonzero(mask_patient) == 0:
        return []

    patient_fg = _patient_foreground_mask(patient_img)

    candidate = cv2.bitwise_and(mask_patient, patient_fg)
    if np.count_nonzero(candidate) > 0:
        contours, _ = cv2.findContours(candidate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            return contours

    contours, _ = cv2.findContours(mask_patient, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return contours if contours else []


def _max_index(shape, axis: str) -> int:
    axis = (axis or 'axial').lower()
    if axis == 'sagittal':
        return max(0, shape[0] - 1)
    if axis == 'coronal':
        return max(0, shape[1] - 1)
    return max(0, shape[2] - 1)


def _resample_volume_to_shape(vol: np.ndarray, target_shape) -> np.ndarray:
    """Resize 3D volume to target (x, y, z) using proper volumetric interpolation."""
    target_x, target_y, target_z = [int(v) for v in target_shape]
    sx, sy, sz = [int(v) for v in vol.shape]

    if (sx, sy, sz) == (target_x, target_y, target_z):
        return vol.astype(np.float32)

    src = np.asarray(vol, dtype=np.float32)
    zoom_factors = (
        float(target_x) / max(1.0, float(sx)),
        float(target_y) / max(1.0, float(sy)),
        float(target_z) / max(1.0, float(sz)),
    )

    # order=1 keeps anatomy smooth without introducing ringing artifacts.
    out = zoom(src, zoom_factors, order=1, mode='nearest', prefilter=False)
    return np.asarray(out, dtype=np.float32)


def _resample_patient_to_atlas_grid(vol: np.ndarray, suggested_z: int):
    """Map patient volume to the atlas grid and remap suggested axial index."""
    _ensure_atlas()
    atlas_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)

    sx, sy, sz = [int(v) for v in vol.shape]
    tx, ty, tz = atlas_shape

    mapped_z = int(round(float(suggested_z) * max(tz - 1, 1) / max(sz - 1, 1))) if sz > 1 else tz // 2
    mapped_z = int(np.clip(mapped_z, 0, max(0, tz - 1)))

    resized = _resample_volume_to_shape(vol, atlas_shape)
    return resized, mapped_z


def _robust_normalize_01(data: np.ndarray) -> np.ndarray:
    arr = np.asarray(data, dtype=np.float32)
    p1, p99 = np.percentile(arr, [1, 99])
    if p99 <= p1:
        return np.zeros_like(arr, dtype=np.float32)
    arr = np.clip(arr, p1, p99)
    return ((arr - p1) / (p99 - p1)).astype(np.float32)


def _best_axial_index(vol: np.ndarray) -> int:
    if vol.ndim != 3 or vol.shape[2] <= 1:
        return 0
    counts = np.array([np.count_nonzero(vol[:, :, z] > 0.02) for z in range(vol.shape[2])])
    return int(np.argmax(counts))


def _center_volume_by_foreground(vol: np.ndarray) -> np.ndarray:
    """Center a 3D volume by foreground bbox center (integer shifts, no wrap artifacts)."""
    arr = np.asarray(vol, dtype=np.float32)
    if arr.ndim != 3:
        return arr

    norm = _robust_normalize_01(arr)
    mask = norm > 0.10
    if np.count_nonzero(mask) == 0:
        return arr

    xs, ys, zs = np.where(mask)
    cx = 0.5 * (float(xs.min()) + float(xs.max()))
    cy = 0.5 * (float(ys.min()) + float(ys.max()))
    cz = 0.5 * (float(zs.min()) + float(zs.max()))

    tx = 0.5 * float(arr.shape[0] - 1)
    ty = 0.5 * float(arr.shape[1] - 1)
    tz = 0.5 * float(arr.shape[2] - 1)

    dx = int(round(tx - cx))
    dy = int(round(ty - cy))
    dz = int(round(tz - cz))

    out = np.roll(arr, shift=(dx, dy, dz), axis=(0, 1, 2))

    # Remove wrapped borders introduced by np.roll.
    if dx > 0:
        out[:dx, :, :] = 0
    elif dx < 0:
        out[dx:, :, :] = 0
    if dy > 0:
        out[:, :dy, :] = 0
    elif dy < 0:
        out[:, dy:, :] = 0
    if dz > 0:
        out[:, :, :dz] = 0
    elif dz < 0:
        out[:, :, dz:] = 0

    return out.astype(np.float32)


def _stabilize_translation_to_reference(
    moving_vol: np.ndarray,
    ref_vol: np.ndarray,
    threshold: float = 0.10,
    max_shift_ratio: float = 0.10,
) -> tuple:
    """Apply a small global translation so moving and reference foreground centers overlap."""
    moving = np.asarray(moving_vol, dtype=np.float32)
    ref = np.asarray(ref_vol, dtype=np.float32)
    if moving.shape != ref.shape or moving.ndim != 3:
        return moving, (0, 0, 0)

    mov_mask = _robust_normalize_01(moving) > float(threshold)
    ref_mask = _robust_normalize_01(ref) > float(threshold)
    if np.count_nonzero(mov_mask) == 0 or np.count_nonzero(ref_mask) == 0:
        return moving, (0, 0, 0)

    mov_pts = np.where(mov_mask)
    ref_pts = np.where(ref_mask)

    mov_center = np.array([np.mean(mov_pts[0]), np.mean(mov_pts[1]), np.mean(mov_pts[2])], dtype=np.float32)
    ref_center = np.array([np.mean(ref_pts[0]), np.mean(ref_pts[1]), np.mean(ref_pts[2])], dtype=np.float32)

    raw_shift = ref_center - mov_center
    max_shift = np.array([
        max(1, int(round(moving.shape[0] * max_shift_ratio))),
        max(1, int(round(moving.shape[1] * max_shift_ratio))),
        max(1, int(round(moving.shape[2] * max_shift_ratio))),
    ], dtype=np.int32)

    shift = np.clip(np.round(raw_shift).astype(np.int32), -max_shift, max_shift)
    dx, dy, dz = int(shift[0]), int(shift[1]), int(shift[2])
    if dx == 0 and dy == 0 and dz == 0:
        return moving, (0, 0, 0)

    out = np.roll(moving, shift=(dx, dy, dz), axis=(0, 1, 2))

    # Remove wrapped borders introduced by np.roll.
    if dx > 0:
        out[:dx, :, :] = 0
    elif dx < 0:
        out[dx:, :, :] = 0
    if dy > 0:
        out[:, :dy, :] = 0
    elif dy < 0:
        out[:, dy:, :] = 0
    if dz > 0:
        out[:, :, :dz] = 0
    elif dz < 0:
        out[:, :, dz:] = 0

    return out.astype(np.float32), (dx, dy, dz)


def _center_crop_or_pad_volume(vol: np.ndarray, target_shape: tuple) -> np.ndarray:
    """Center-crop/pad a 3D volume to target shape."""
    src = np.asarray(vol, dtype=np.float32)
    tx, ty, tz = [int(v) for v in target_shape]
    sx, sy, sz = [int(v) for v in src.shape]
    out = np.zeros((tx, ty, tz), dtype=np.float32)

    copy_x = min(sx, tx)
    copy_y = min(sy, ty)
    copy_z = min(sz, tz)

    src_x0 = max(0, (sx - copy_x) // 2)
    src_y0 = max(0, (sy - copy_y) // 2)
    src_z0 = max(0, (sz - copy_z) // 2)

    dst_x0 = max(0, (tx - copy_x) // 2)
    dst_y0 = max(0, (ty - copy_y) // 2)
    dst_z0 = max(0, (tz - copy_z) // 2)

    out[
        dst_x0:dst_x0 + copy_x,
        dst_y0:dst_y0 + copy_y,
        dst_z0:dst_z0 + copy_z,
    ] = src[
        src_x0:src_x0 + copy_x,
        src_y0:src_y0 + copy_y,
        src_z0:src_z0 + copy_z,
    ]
    return out


def _stabilize_similarity_to_reference(
    moving_vol: np.ndarray,
    ref_vol: np.ndarray,
    threshold: float = 0.10,
    max_shift_ratio: float = 0.10,
    max_scale_delta: float = 0.14,
    min_scale_trigger: float = 0.08,
) -> tuple:
    """Bounded post-MINE similarity stabilization (global scale + translation)."""
    moving = np.asarray(moving_vol, dtype=np.float32)
    ref = np.asarray(ref_vol, dtype=np.float32)
    if moving.shape != ref.shape or moving.ndim != 3:
        return moving, {'scale': 1.0, 'shift': (0, 0, 0)}

    mov_mask = _robust_normalize_01(moving) > float(threshold)
    ref_mask = _robust_normalize_01(ref) > float(threshold)
    if np.count_nonzero(mov_mask) == 0 or np.count_nonzero(ref_mask) == 0:
        return moving, {'scale': 1.0, 'shift': (0, 0, 0)}

    mov_pts = np.where(mov_mask)
    ref_pts = np.where(ref_mask)

    mov_ext = np.array([
        float(np.max(mov_pts[0]) - np.min(mov_pts[0]) + 1),
        float(np.max(mov_pts[1]) - np.min(mov_pts[1]) + 1),
        float(np.max(mov_pts[2]) - np.min(mov_pts[2]) + 1),
    ], dtype=np.float32)
    ref_ext = np.array([
        float(np.max(ref_pts[0]) - np.min(ref_pts[0]) + 1),
        float(np.max(ref_pts[1]) - np.min(ref_pts[1]) + 1),
        float(np.max(ref_pts[2]) - np.min(ref_pts[2]) + 1),
    ], dtype=np.float32)

    valid = mov_ext > 1.0
    raw_scale = float(np.mean(ref_ext[valid] / np.maximum(mov_ext[valid], 1.0))) if np.any(valid) else 1.0
    lo = max(0.75, 1.0 - float(max_scale_delta))
    hi = min(1.25, 1.0 + float(max_scale_delta))
    bounded_scale = float(np.clip(raw_scale, lo, hi))

    scaled = moving
    applied_scale = 1.0
    if abs(bounded_scale - 1.0) >= float(min_scale_trigger):
        zoomed = zoom(
            moving,
            (bounded_scale, bounded_scale, bounded_scale),
            order=1,
            mode='nearest',
            prefilter=False,
        )
        scaled = _center_crop_or_pad_volume(zoomed, moving.shape)
        applied_scale = bounded_scale

    translated, shift = _stabilize_translation_to_reference(
        scaled,
        ref,
        threshold=threshold,
        max_shift_ratio=max_shift_ratio,
    )
    return translated, {'scale': applied_scale, 'shift': shift}


def _force_extent_alignment_to_reference(
    moving_vol: np.ndarray,
    ref_vol: np.ndarray,
    threshold: float = 0.10,
    max_scale_delta: float = 0.30,
) -> tuple:
    """Strict mode: match global foreground extent to reference with bounded isotropic scale."""
    moving = np.asarray(moving_vol, dtype=np.float32)
    ref = np.asarray(ref_vol, dtype=np.float32)
    if moving.shape != ref.shape or moving.ndim != 3:
        return moving, 1.0

    mov_mask = _robust_normalize_01(moving) > float(threshold)
    ref_mask = _robust_normalize_01(ref) > float(threshold)
    if np.count_nonzero(mov_mask) == 0 or np.count_nonzero(ref_mask) == 0:
        return moving, 1.0

    mov_pts = np.where(mov_mask)
    ref_pts = np.where(ref_mask)

    mov_ext = np.array([
        float(np.max(mov_pts[0]) - np.min(mov_pts[0]) + 1),
        float(np.max(mov_pts[1]) - np.min(mov_pts[1]) + 1),
        float(np.max(mov_pts[2]) - np.min(mov_pts[2]) + 1),
    ], dtype=np.float32)
    ref_ext = np.array([
        float(np.max(ref_pts[0]) - np.min(ref_pts[0]) + 1),
        float(np.max(ref_pts[1]) - np.min(ref_pts[1]) + 1),
        float(np.max(ref_pts[2]) - np.min(ref_pts[2]) + 1),
    ], dtype=np.float32)

    ratio = ref_ext / np.maximum(mov_ext, 1.0)
    raw_scale = float(np.median(ratio))
    lo = max(0.60, 1.0 - float(max_scale_delta))
    hi = min(1.60, 1.0 + float(max_scale_delta))
    bounded_scale = float(np.clip(raw_scale, lo, hi))

    if abs(bounded_scale - 1.0) < 0.02:
        return moving, 1.0

    zoomed = zoom(
        moving,
        (bounded_scale, bounded_scale, bounded_scale),
        order=1,
        mode='nearest',
        prefilter=False,
    )
    aligned = _center_crop_or_pad_volume(zoomed, moving.shape)
    return aligned, bounded_scale


def _is_suspicious_spatial_position(vol: np.ndarray) -> bool:
    """Heuristic to detect bad affine placement (brain clipped/off-center in atlas grid)."""
    arr = np.asarray(vol, dtype=np.float32)
    if arr.ndim != 3:
        return True

    norm = _robust_normalize_01(arr)
    mask = norm > 0.10
    nz = int(np.count_nonzero(mask))
    total = int(mask.size)
    if total <= 0 or nz <= 0:
        return True

    fill_ratio = float(nz) / float(total)
    # Too little foreground almost always means clipping/out-of-FOV after affine mapping.
    if fill_ratio < 0.01:
        return True

    xs, ys, zs = np.where(mask)
    cx = 0.5 * (float(xs.min()) + float(xs.max()))
    cy = 0.5 * (float(ys.min()) + float(ys.max()))
    cz = 0.5 * (float(zs.min()) + float(zs.max()))

    tx = 0.5 * float(arr.shape[0] - 1)
    ty = 0.5 * float(arr.shape[1] - 1)
    tz = 0.5 * float(arr.shape[2] - 1)

    nx = abs(cx - tx) / max(1.0, float(arr.shape[0]))
    ny = abs(cy - ty) / max(1.0, float(arr.shape[1]))
    nzr = abs(cz - tz) / max(1.0, float(arr.shape[2]))

    # If centroid is very far from center in any axis, likely wrong world-space placement.
    return (nx > 0.23) or (ny > 0.23) or (nzr > 0.23)


def _is_suspicious_affine_matrix_3d(matrix_like) -> bool:
    """Detect unstable 3D affine (too much rotation/shear/scale/translation)."""
    try:
        m = np.asarray(matrix_like, dtype=np.float32)
        if m.shape != (4, 4) or not np.all(np.isfinite(m)):
            return True

        a = m[:3, :3]
        t = m[:3, 3]

        # Per-axis scale from column norms.
        col_norms = np.linalg.norm(a, axis=0)
        if np.any(col_norms < 0.80) or np.any(col_norms > 1.20):
            return True

        # Normalize columns then inspect residual off-diagonal energy (shear/oblique rotation).
        a_n = a / np.maximum(col_norms[np.newaxis, :], 1e-6)
        off_diag = a_n - np.diag(np.diag(a_n))
        if float(np.max(np.abs(off_diag))) > 0.18:
            return True

        # Translation in normalized coordinates should stay moderate after MNI pre-alignment.
        if float(np.max(np.abs(t))) > 0.35:
            return True

        return False
    except Exception:
        return True


def _get_patient_volume(job_id: str, prefer_pending: bool = False):
    """Return the most relevant patient volume for display/projection."""
    entry = _get_job_entry(job_id) or {}
    if prefer_pending:
        vol = entry.get('pending_registered_data')
        if vol is not None:
            return vol, 'pending_registered'
    vol = entry.get('registered_data')
    if vol is not None:
        return vol, 'registered'
    vol = entry.get('data')
    return vol, 'raw'


def _ensure_atlas():
    if 'atlas' in VOLUMES_CACHE:
        return

    vol = None
    labels = None
    lut = None
    atlas_affine = None

    if datasets is not None:
        try:
            template_img = datasets.load_mni152_template()
            vol = template_img.get_fdata().astype(np.float32)
            atlas_affine = np.asarray(template_img.affine, dtype=np.float32)
        except Exception:
            vol = None

        if nilearn_image is not None:
            try:
                ho = datasets.fetch_atlas_harvard_oxford(
                    'cort-maxprob-thr25-2mm',
                    symmetric_split=False
                )
                ho_img = ho['maps']

                # Toujours resampler sur le template pour avoir la même shape
                if vol is not None and tuple(ho_img.shape) != tuple(vol.shape):
                    ho_img = nilearn_image.resample_to_img(
                        ho_img,
                        template_img,
                        interpolation='nearest'
                    )

                labels = ho_img.get_fdata().astype(np.int16)
                raw_labels = list(ho.get('labels', []))
                lut = {
                    i: str(name)
                    for i, name in enumerate(raw_labels)
                    if i > 0 and str(name).strip()
                }
            except Exception:
                labels = None
                lut = None

    # Fallbacks inchangés...
    if vol is None:
        vol = np.zeros((182, 218, 182), dtype=np.float32)
        atlas_affine = np.array([
            [-1, 0, 0, 90],
            [0, 1, 0, -126],
            [0, 0, 1, -72],
            [0, 0, 0, 1]
        ], dtype=np.float32)

    if labels is None:
        labels = np.zeros(vol.shape, dtype=np.int16)
        lut = {}

    VOLUMES_CACHE['atlas'] = {
        'data': vol,
        'labels': labels,
        'lut': lut or {},
        'source': 'official',
        'affine': np.asarray(atlas_affine, dtype=np.float32),
    }


def _register_patient_to_atlas(patient_nib):
    """
    Recale le volume patient dans l'espace MNI de l'atlas.
    Retourne le volume recalé en numpy array.
    """
    _ensure_atlas()

    atlas_affine = VOLUMES_CACHE['atlas']['affine']
    atlas_shape = VOLUMES_CACHE['atlas']['data'].shape

    # Créer une image nibabel fictive pour l'atlas (espace cible)
    import nibabel as nib
    atlas_ref_img = nib.Nifti1Image(
        VOLUMES_CACHE['atlas']['data'],
        atlas_affine
    )

    # Resampler le patient dans l'espace atlas
    patient_resampled = nilearn_image.resample_to_img(
        patient_nib,
        atlas_ref_img,
        interpolation='continuous',
        copy=True,
    )

    return patient_resampled.get_fdata().astype(np.float32)

def _set_custom_atlas_volume(vol: np.ndarray):
    _ensure_atlas()
    target_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)
    target_affine = np.asarray(VOLUMES_CACHE['atlas'].get('affine', np.eye(4)), dtype=np.float32)

    atlas_vol = np.asarray(vol, dtype=np.float32)
    if atlas_vol.ndim == 2:
        atlas_vol = np.stack([atlas_vol] * target_shape[2], axis=2)
    elif atlas_vol.ndim == 4:
        atlas_vol = atlas_vol[..., 0]
    elif atlas_vol.ndim != 3:
        raise ValueError('format volume atlas non supporte')

    if tuple(int(v) for v in atlas_vol.shape) != target_shape:
        atlas_vol = _resample_volume_to_shape(atlas_vol, target_shape)

    atlas_vol = _robust_normalize_01(atlas_vol)
    labels = np.zeros_like(atlas_vol, dtype=np.int16)

    VOLUMES_CACHE['atlas'] = {
        'data': atlas_vol.astype(np.float32),
        'labels': labels,
        'lut': {},
        'source': 'custom',
        'affine': target_affine,
    }


@api_view(['GET'])
def get_atlas_slice(request):
    _ensure_atlas()
    atlas_data = VOLUMES_CACHE['atlas']['data']
    atlas_labels = VOLUMES_CACHE['atlas']['labels']
    axis = request.GET.get('axis', 'axial')
    idx = int(request.GET.get('index', request.GET.get('z', _max_index(atlas_data.shape, axis) // 2)))
    idx = int(np.clip(idx, 0, _max_index(atlas_data.shape, axis)))

    job_id = request.GET.get('jobId')
    show_contour = request.GET.get('showContour', '0') in ('1', 'true', 'True')
    show_labels = request.GET.get('showLabels', '0') in ('1', 'true', 'True')
    selected_label = (_get_job_entry(job_id) or {}).get('selected_label') if (job_id and show_contour) else None
    atlas_source = VOLUMES_CACHE.get('atlas', {}).get('source', 'official')
    
    # Use colored labels ONLY in Phase 3 (when selected_label is set)
    # or in Exploration mode (when job_id is absent).
    # In Phase 2 results (job_id present, but no selected_label), 
    # use grayscale anatomy for professional comparison.
    if atlas_source == 'official' and (selected_label or not job_id or show_labels):
        img_rgb = _render_label_slice_rgb(atlas_labels, idx, axis)
    else:
        # Phase 2 Results: Grayscale anatomy
        img_u8 = _normalize_u8(_render_slice(atlas_data, idx, axis))
        img_rgb = cv2.cvtColor(img_u8, cv2.COLOR_GRAY2RGB)

    if selected_label:
        sl_labels = _render_slice(atlas_labels, idx, axis)
        mask = (sl_labels == selected_label).astype(np.uint8) * 255
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        img_rgb = _draw_clinical_contour(img_rgb, contours)

    return JsonResponse({
        'success': True,
        'axis': axis,
        'index': idx,
        'max_index': _max_index(atlas_data.shape, axis),
        'z': idx if axis == 'axial' else None,
        'max_z': _max_index(atlas_data.shape, axis) if axis == 'axial' else None,
        'image': _encode_png_data_url(img_rgb),
        'source': atlas_source,
    })


@api_view(['GET'])
def get_volume_slice(request):
    target = request.GET.get('target', 'atlas')
    if target == 'patient':
        return get_patient_slice(request)
    return get_atlas_slice(request)


@csrf_exempt
@require_http_methods(["POST"])
def upload_volume(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)
    f = request.FILES.get('file')
    if not f:
        return JsonResponse({'error': 'file required'}, status=400)
    if f.size > MAX_FILE_SIZE_BYTES:
        return JsonResponse(
            {'error': f'File too large (max {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB)'},
            status=413,
        )

    safe_name = os.path.basename(f.name).lower()
    if not safe_name:
        return JsonResponse({'error': 'invalid filename'}, status=400)

    job_id = str(uuid.uuid4())

    try:
        shape_before = None
        resample_mode = 'shape-only'
        nifti_meta = None
        patient_nifti_path = None
        if safe_name.endswith('.nii.gz') or safe_name.endswith('.nii'):
            storage_dir = os.path.join(tempfile.gettempdir(), 'visionmed_volume_jobs', job_id)
            os.makedirs(storage_dir, exist_ok=True)
            patient_nifti_path = os.path.join(storage_dir, f'patient_{safe_name}')
            f.seek(0)
            with open(patient_nifti_path, 'wb') as out_f:
                for chunk in f.chunks():
                    out_f.write(chunk)
            f.seek(0)
            vol, best_z, nifti_meta = _load_nifti(f, safe_name)
            shape_before = tuple(int(v) for v in vol.shape)
            resample_mode = 'affine-mni'
        else:
            vol, best_z = _load_image_as_volume(f)
            shape_before = tuple(int(v) for v in vol.shape)
            # Keep non-NIfTI images in their native geometry for display
            # Don't resample here - do it only for registration

        shape_after = tuple(int(v) for v in vol.shape)

        VOLUMES_CACHE[job_id] = {
            'type': 'patient',
            'data': vol,
            'data_original': vol.copy(),  # NEW: Garder la version originale pour MINE
            'nifti_path': patient_nifti_path,
            'registered_data': None,
            'pending_registered_data': None,
            'pending_registration': None,
            'selected_label': None,
            'selected_label_name': None,
            'selected_slice': None,
        }
        _persist_job_entry(job_id)

        # Backward-compatible payload + new shape/suggested payload.
        median_slice = vol[:, :, best_z]
        return JsonResponse({
            'success': True,
            'jobId': job_id,
            'shape': {
                'x': int(vol.shape[0]),
                'y': int(vol.shape[1]),
                'z': int(vol.shape[2]),
            },
            'debug': {
                'shape_before': {
                    'x': int(shape_before[0]),
                    'y': int(shape_before[1]),
                    'z': int(shape_before[2]),
                } if shape_before else None,
                'shape_after': {
                    'x': int(shape_after[0]),
                    'y': int(shape_after[1]),
                    'z': int(shape_after[2]),
                },
                'resample_mode': resample_mode,
                'patient_nifti': nifti_meta,
            },
            'suggested': {
                'axis': 'axial',
                'index': int(best_z),
            },
            'z': int(best_z),
            'max_z': int(vol.shape[2] - 1),
            'median_slice': _slice_to_data_url(median_slice),
        })
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=422)
    except RuntimeError as e:
        return JsonResponse({'error': str(e)}, status=500)
    except Exception as e:
        return JsonResponse({'error': f'unexpected error: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def upload_atlas(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)

    f = request.FILES.get('file')
    if not f:
        return JsonResponse({'error': 'file required'}, status=400)
    if f.size > MAX_FILE_SIZE_BYTES:
        return JsonResponse(
            {'error': f'File too large (max {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB)'},
            status=413,
        )

    safe_name = os.path.basename(f.name).lower()
    if not safe_name:
        return JsonResponse({'error': 'invalid filename'}, status=400)

    try:
        if safe_name.endswith('.nii.gz') or safe_name.endswith('.nii'):
            atlas_vol, best_z, _ = _load_nifti(f, safe_name)
        else:
            atlas_vol, best_z = _load_image_as_volume(f)

        _set_custom_atlas_volume(atlas_vol)

        axis = 'axial'
        idx = int(np.clip(best_z, 0, _max_index(VOLUMES_CACHE['atlas']['data'].shape, axis)))
        atlas_img = _normalize_u8(_render_slice(VOLUMES_CACHE['atlas']['data'], idx, axis))
        return JsonResponse({
            'success': True,
            'source': 'custom',
            'axis': axis,
            'index': idx,
            'max_index': _max_index(VOLUMES_CACHE['atlas']['data'].shape, axis),
            'image': _encode_png_data_url(atlas_img),
            'message': 'Atlas personnalise charge avec succes.',
        })
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=422)
    except RuntimeError as e:
        return JsonResponse({'error': str(e)}, status=500)
    except Exception as e:
        return JsonResponse({'error': f'unexpected error: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def use_official_atlas(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)

    if 'atlas' in VOLUMES_CACHE:
        del VOLUMES_CACHE['atlas']
    _ensure_atlas()

    axis = 'axial'
    idx = _max_index(VOLUMES_CACHE['atlas']['data'].shape, axis) // 2
    atlas_img = _render_label_slice_rgb(VOLUMES_CACHE['atlas']['labels'], idx, axis)
    return JsonResponse({
        'success': True,
        'source': 'official',
        'axis': axis,
        'index': int(idx),
        'max_index': _max_index(VOLUMES_CACHE['atlas']['data'].shape, axis),
        'image': _encode_png_data_url(atlas_img),
        'message': 'Atlas Harvard-Oxford charge.',
    })


def _load_nifti(f, safe_name: str) -> tuple:
    suffix = '.nii.gz' if safe_name.endswith('.nii.gz') else '.nii'
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in f.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        if nib is None:
            raise RuntimeError('nibabel not installed')

        _ensure_atlas()
        raw_img = nib.load(tmp_path)
        src_img = nib.as_closest_canonical(raw_img)

        raw_orientation = tuple(str(v) for v in nib.aff2axcodes(raw_img.affine))
        canonical_orientation = tuple(str(v) for v in nib.aff2axcodes(src_img.affine))

        atlas_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)
        atlas_affine = np.asarray(VOLUMES_CACHE['atlas'].get('affine', np.eye(4)), dtype=np.float32)

        src_data = src_img.get_fdata(dtype=np.float32)
        if src_data.ndim == 4:
            src_data = src_data[..., 0]
        elif src_data.ndim == 2:
            src_data = src_data[:, :, np.newaxis]
        elif src_data.ndim != 3:
            raise ValueError(f'Volume NIfTI non supporte : {src_data.ndim} dimensions (shape={src_data.shape})')

        resample_mode = 'shape-only'
        try:
            from nibabel.processing import resample_from_to

            resampled_img = resample_from_to(
                src_img,
                (atlas_shape, atlas_affine),
                order=1,
                mode='nearest',
                cval=0.0,
            )
            data = resampled_img.get_fdata(dtype=np.float32)
            resample_mode = 'affine-mni'
            if _is_suspicious_spatial_position(data):
                # Some NIfTI files carry inconsistent affine/origin; keep a robust centered fallback.
                data = _resample_volume_to_shape(np.asarray(src_data, dtype=np.float32), atlas_shape)
                data = _center_volume_by_foreground(data)
                resample_mode = 'shape-center-fallback'
        except Exception:
            data = _resample_volume_to_shape(np.asarray(src_data, dtype=np.float32), atlas_shape)
            data = _center_volume_by_foreground(data)
            resample_mode = 'shape-center-fallback'

        p1, p99 = np.percentile(data, [1, 99])
        if p99 > p1:
            data = np.clip(data, p1, p99)
            data = (data - p1) / (p99 - p1)
        else:
            data = np.zeros_like(data)

        vol = np.asarray(data, dtype=np.float32)
        best_z = _best_axial_index(vol)

        meta = {
            'raw_shape': [int(v) for v in raw_img.shape[:3]],
            'raw_zooms': [float(v) for v in raw_img.header.get_zooms()[:3]],
            'raw_affine': np.asarray(raw_img.affine, dtype=np.float64).round(6).tolist(),
            'raw_orientation': list(raw_orientation),
            'is_ras': raw_orientation == ('R', 'A', 'S'),
            'canonical_shape': [int(v) for v in src_img.shape[:3]],
            'canonical_zooms': [float(v) for v in src_img.header.get_zooms()[:3]],
            'canonical_affine': np.asarray(src_img.affine, dtype=np.float64).round(6).tolist(),
            'canonical_orientation': list(canonical_orientation),
            'resample_mode': resample_mode,
            'target_shape': [int(v) for v in atlas_shape],
            'target_affine': np.asarray(atlas_affine, dtype=np.float64).round(6).tolist(),
            'fallback': None,
        }

        return vol, best_z, meta
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def _load_image_as_volume(f) -> tuple:
    if cv2 is None:
        raise RuntimeError('opencv-python not installed')
    arr = np.frombuffer(f.read(), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError('unsupported file format')
    img = np.rot90(img, -1).astype(np.float32)
    if float(np.max(img)) > 0.0:
        img /= float(np.max(img))
    vol = np.stack([img] * 64, axis=2)
    best_z = vol.shape[2] // 2
    return vol, best_z


@require_http_methods(["GET"])
def get_slice(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)

    job_id = request.GET.get('jobId')
    axis = request.GET.get('axis', 'axial')
    index = request.GET.get('index')

    if not job_id:
        return JsonResponse({'error': 'job not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'job not found'}, status=404)
    if axis not in ('axial', 'coronal', 'sagittal'):
        return JsonResponse({'error': 'invalid axis'}, status=400)

    try:
        index = int(index)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'invalid index'}, status=400)

    vol = entry['data']
    max_idx = _max_index(vol.shape, axis)
    index = int(np.clip(index, 0, max_idx))

    # Keep patient orientation strictly identical to atlas rendering.
    sl = _render_slice(vol, index, axis)
    sl_u8 = _normalize_u8(sl)
    encoded = _encode_png_data_url(sl_u8)
    return JsonResponse({
        'slice': encoded,
        'image': encoded,
        'index': int(index),
        'max_index': int(max_idx),
    })


@csrf_exempt
@require_http_methods(["POST"])
def confirm_slice(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    job_id = body.get('jobId')
    axis = body.get('axis')
    index = body.get('index')

    if not job_id:
        return JsonResponse({'error': 'job not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'job not found'}, status=404)
    if axis not in ('axial', 'coronal', 'sagittal'):
        return JsonResponse({'error': 'invalid axis'}, status=400)
    if index is None:
        return JsonResponse({'error': 'index required'}, status=400)

    try:
        index = int(index)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'invalid index'}, status=400)

    entry['selected_slice'] = {
        'axis': axis,
        'index': int(index),
    }
    _persist_job_entry(job_id)

    return JsonResponse({'success': True, 'axis': axis, 'index': int(index)})


@require_http_methods(["GET"])
def slice_viewer_page(request):
    return render(request, 'api/slice_viewer.html')


@csrf_exempt
@require_http_methods(["POST"])
def load_demo_patient(request):
    vol = None
    if datasets is not None and nib is not None:
        try:
            template_img = datasets.load_mni152_template()
            with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
                nib.save(template_img, tmp.name)
                tmp_path = tmp.name
            vol, _ = load_patient(tmp_path)
            os.remove(tmp_path)
        except Exception:
            vol = None

    if vol is None:
        _ensure_atlas()
        atlas = VOLUMES_CACHE['atlas']['data']
        vol = np.roll(atlas.copy(), shift=2, axis=0)

    vol = np.roll(vol, shift=2, axis=0)
    job_id = str(uuid.uuid4())
    VOLUMES_CACHE[job_id] = {
        'type': 'patient',
        'data': vol,
        'registered_data': None,
        'pending_registered_data': None,
        'pending_registration': None,
        'selected_label': None,
        'selected_label_name': None,
        'selected_slice': None,
    }
    _persist_job_entry(job_id)
    z = vol.shape[2] // 2
    return JsonResponse({
        'success': True,
        'jobId': job_id,
        'z': z,
        'max_z': vol.shape[2] - 1,
        'median_slice': _slice_to_data_url(vol[:, :, z]),
    })


@api_view(['GET'])
def get_patient_slice(request):
    job_id = request.GET.get('jobId')
    if not job_id:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    axis = request.GET.get('axis', 'axial')
    
    # CRITICAL FIX: After registration, use the warped volume for display
    # to ensure consistency with atlas for overlay positioning
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    
    pending = entry.get('pending_registration')
    has_registration = bool(pending) or bool(entry.get('registered_data') is not None)
    
    if has_registration:
        vol, vol_state = _get_patient_volume(job_id, prefer_pending=True)
        print(f"[PATIENT_SLICE] Using registered volume (shape {vol.shape})")
    else:
        vol, vol_state = _get_patient_volume(job_id, prefer_pending=False)
        print(f"[PATIENT_SLICE] No registration - using original volume (shape {vol.shape})")
    
    idx = int(request.GET.get('index', request.GET.get('z', _max_index(vol.shape, axis) // 2)))
    idx = int(np.clip(idx, 0, _max_index(vol.shape, axis)))
    
    img_u8 = _normalize_u8(_render_slice(vol, idx, axis))

    _ensure_atlas()
    atlas_labels = VOLUMES_CACHE['atlas']['labels']
    atlas_max_idx = _max_index(atlas_labels.shape, axis)
    atlas_idx = int(np.clip(idx, 0, atlas_max_idx))
    
    show_contour = request.GET.get('showContour', '0') in ('1', 'true', 'True')
    selected_label = entry.get('selected_label') if show_contour else None
    if selected_label:
        # Identification phase: draw contour of selected zone
        img_rgb = cv2.cvtColor(img_u8, cv2.COLOR_GRAY2RGB)
        # The contour is always from the atlas labels (recalé space)
        sl_labels = _render_slice(atlas_labels, atlas_idx, axis)
        mask = (sl_labels == selected_label).astype(np.uint8) * 255
        mask = _resize_mask_to_shape(mask, img_u8.shape)
        # Residual 2D shift can compensate small slice-level mismatch.
        # For MINE-registered volumes: use larger shift ratio to handle 3D→2D projection errors
        atlas_img_u8 = _normalize_u8(_render_slice(VOLUMES_CACHE['atlas']['data'], atlas_idx, axis))
        max_shift_ratio = 0.18 if vol_state == 'raw' else 0.25
        contours = _extract_patient_contours(
            mask,
            img_u8,
            atlas_u8=atlas_img_u8,
            max_shift_ratio=max_shift_ratio,
            min_phase_response=0.015,
        )
        img_to_encode = _draw_clinical_contour(img_rgb, contours)
    else:
        img_to_encode = img_u8

    return JsonResponse({
        'success': True,
        'axis': axis,
        'index': idx,
        'max_index': _max_index(vol.shape, axis),
        'z': idx if axis == 'axial' else None,
        'max_z': _max_index(vol.shape, axis) if axis == 'axial' else None,
        'patient_volume_state': vol_state,
        'image': _encode_png_data_url(img_to_encode),
    })


@api_view(['GET'])
def get_brodmann_zone(request):
    _ensure_atlas()
    job_id = request.GET.get('jobId')
    if not job_id:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)

    axis = request.GET.get('axis', 'axial')
    atlas_labels = VOLUMES_CACHE['atlas']['labels']
    max_idx = _max_index(atlas_labels.shape, axis)
    index = int(np.clip(int(request.GET.get('index', request.GET.get('z', max_idx // 2))), 0, max_idx))

    sl_labels = _render_slice(atlas_labels, index, axis)
    h, w = sl_labels.shape

    label = 0
    mask_atlas = None
    label_param = request.GET.get('labelId')

    if label_param is not None:
        try:
            requested_label = int(label_param)
        except (TypeError, ValueError):
            requested_label = 0

        if requested_label > 0:
            # If label is absent on the current slice, jump to the nearest slice where it exists.
            if axis == 'axial':
                hit_indices = np.where(np.any(atlas_labels == requested_label, axis=(0, 1)))[0]
            elif axis == 'coronal':
                hit_indices = np.where(np.any(atlas_labels == requested_label, axis=(0, 2)))[0]
            else:  # sagittal
                hit_indices = np.where(np.any(atlas_labels == requested_label, axis=(1, 2)))[0]

            if hit_indices.size > 0 and requested_label not in sl_labels:
                nearest_idx = int(hit_indices[np.argmin(np.abs(hit_indices - index))])
                index = int(np.clip(nearest_idx, 0, max_idx))
                sl_labels = _render_slice(atlas_labels, index, axis)
                h, w = sl_labels.shape

            candidate_mask = (sl_labels == requested_label).astype(np.uint8) * 255
            if np.count_nonzero(candidate_mask) > 0:
                label = requested_label
                # From list selection, keep the component nearest to slice center.
                center_x = int(np.clip((w - 1) // 2, 0, max(0, w - 1)))
                center_y = int(np.clip((h - 1) // 2, 0, max(0, h - 1)))
                mask_atlas = _component_mask_near_point(candidate_mask, center_x, center_y)
    else:
        xr = float(request.GET.get('xRatio', 0.5))
        yr = float(request.GET.get('yRatio', 0.5))
        x = int(np.clip(xr * (w - 1), 0, w - 1))
        y = int(np.clip(yr * (h - 1), 0, h - 1))
        snap_radius = max(3, min(8, min(h, w) // 64))
        label = _nearest_nonzero_label(sl_labels, x, y, max_radius=snap_radius)
        if label > 0:
            candidate_mask = (sl_labels == label).astype(np.uint8) * 255
            mask_atlas = _component_mask_near_point(candidate_mask, x, y)

    entry['selected_label'] = label if label > 0 else None
    name = VOLUMES_CACHE['atlas']['lut'].get(label, f'Region {label}') if label > 0 else None
    entry['selected_label_name'] = name
    entry['selected_slice'] = {'axis': axis, 'index': int(index)}
    _persist_job_entry(job_id)

    atlas_img = _normalize_u8(_render_slice(VOLUMES_CACHE['atlas']['data'], index, axis))
    
    # CRITICAL FIX: After registration, use the registered (warped) volume
    # to ensure shapes match atlas for correct overlay positioning
    pending = entry.get('pending_registration')
    has_registration = bool(pending) or bool(entry.get('registered_data') is not None)
    
    if has_registration:
        patient_vol, vol_state = _get_patient_volume(job_id, prefer_pending=True)
        print(f"[BRODMANN] Using registered/warped volume (shape {patient_vol.shape} matching atlas)")
    else:
        patient_vol, vol_state = _get_patient_volume(job_id, prefer_pending=False)
        print(f"[BRODMANN] No registration - using original volume (shape {patient_vol.shape})")
    
    patient_max_idx = _max_index(patient_vol.shape, axis)
    patient_index = int(np.clip(index, 0, patient_max_idx))
    patient_img = _normalize_u8(_render_slice(patient_vol, patient_index, axis))

    images = {}

    if label <= 0:
        images = {
            'patient': _encode_png_data_url(patient_img),
            'atlas': _encode_png_data_url(atlas_img),
        }
        return JsonResponse({
            'success': True,
            'insideBrain': False,
            'zone': None,
            'images': images,
            'axis': axis,
            'index': index,
            'max_index': max_idx,
        })

    # Atlas mask in atlas 2D slice space.
    if mask_atlas is None:
        mask_atlas = (sl_labels == label).astype(np.uint8) * 255

    # Correct reprojection: atlas voxel grid -> patient voxel grid.
    mask_patient = _remap_mask_atlas_to_patient(
        mask_atlas,
        atlas_vol_shape=atlas_labels.shape,
        patient_vol_shape=patient_vol.shape,
        axis=axis,
        patient_img_shape=patient_img.shape,
    )

    contours_atlas, _ = cv2.findContours(mask_atlas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    atlas_labels_rgb = _render_label_slice_rgb(atlas_labels, index, axis)
    patient_rgb = cv2.cvtColor(patient_img, cv2.COLOR_GRAY2RGB)

    # Light residual stabilization only through brain-foreground intersection.
    contours_patient = _extract_patient_contours_v2(
        mask_patient,
        patient_img,
        vol_state=vol_state,
    )

    atlas_labels_rgb = _draw_clinical_contour(atlas_labels_rgb, contours_atlas)
    patient_rgb = _draw_clinical_contour(patient_rgb, contours_patient)

    images = {
        'patient': _encode_png_data_url(patient_rgb),
        'atlas': _encode_png_data_url(atlas_labels_rgb),
    }

    zone_text = _zone_text_for_name(name)

    return JsonResponse({
        'success': True,
        'insideBrain': True,
        'zone': {
            'id': label,
            'name': name,
            'desc': zone_text['desc'],
            'functionality': zone_text['functionality'],
        },
        'images': images,
        'axis': axis,
        'index': index,
        'max_index': max_idx,
        'patient_volume_state': vol_state,
    })


@api_view(['GET'])
def get_cortical_zones(request):
    _ensure_atlas()

    atlas_source = VOLUMES_CACHE.get('atlas', {}).get('source', 'official')
    lut = VOLUMES_CACHE.get('atlas', {}).get('lut', {}) or {}

    zones = []
    for label, name in lut.items():
        try:
            label_int = int(label)
        except (TypeError, ValueError):
            continue
        if label_int <= 0:
            continue
        label_name = str(name).strip()
        if not label_name:
            continue
        zones.append({'id': label_int, 'name': label_name})

    zones.sort(key=lambda item: item['id'])

    return JsonResponse({
        'success': True,
        'source': atlas_source,
        'count': len(zones),
        'zones': zones,
    })


@csrf_exempt
@require_http_methods(["POST"])
def manual_align_volume(request):
    try:
        payload = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    job_id = payload.get('jobId')
    ct = payload.get('ct_points')
    pat = payload.get('pat_points')
    if not job_id or ct is None or pat is None:
        return JsonResponse({'error': 'missing data'}, status=400)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'missing data'}, status=400)

    X = np.array(ct, dtype=np.float32)
    Y = np.array(pat, dtype=np.float32)
    if X.shape != Y.shape or X.shape[0] < 4:
        return JsonResponse({'error': 'invalid points', 'message': 'Minimum 4 points correspondants requis.'}, status=400)

    _ensure_atlas()
    selected = entry.get('selected_slice') or {}
    axis = str(payload.get('axis', selected.get('axis', 'axial'))).lower()
    if axis not in ('axial', 'coronal', 'sagittal'):
        axis = 'axial'

    atlas_vol = VOLUMES_CACHE['atlas']['data']
    patient_vol = entry['data']

    atlas_max_idx = _max_index(atlas_vol.shape, axis)
    patient_max_idx = _max_index(patient_vol.shape, axis)
    idx = int(payload.get('index', selected.get('index', min(atlas_max_idx, patient_max_idx) // 2)))
    idx = int(np.clip(idx, 0, min(atlas_max_idx, patient_max_idx)))
    entry['selected_slice'] = {'axis': axis, 'index': idx}

    fixed = _normalize_u8(_render_slice(atlas_vol, idx, axis))
    moving_raw = _normalize_u8(_render_slice(patient_vol, idx, axis))
    fh, fw = int(fixed.shape[0]), int(fixed.shape[1])
    mh, mw = int(moving_raw.shape[0]), int(moving_raw.shape[1])

    # Les clics sont dans l'espace pixel de chaque image servie au navigateur.
    # On redimensionne le patient pour l'aligner sur l'atlas : il faut ramener Y dans le même repère que X.
    X = np.asarray(X, dtype=np.float64)
    Y = np.asarray(Y, dtype=np.float64)
    if mw > 0 and mh > 0 and (mw != fw or mh != fh):
        Y = Y.copy()
        Y[:, 0] = Y[:, 0] * (float(fw) / float(mw))
        Y[:, 1] = Y[:, 1] * (float(fh) / float(mh))

    moving = _resize_u8_to_shape(moving_raw, fixed.shape)

    M, _ = cv2.estimateAffinePartial2D(
        Y.astype(np.float32),
        X.astype(np.float32),
        method=cv2.RANSAC,
        ransacReprojThreshold=4.0,
        maxIters=3000,
        confidence=0.995,
    )
    if M is None:
        M, _ = cv2.estimateAffinePartial2D(
            Y.astype(np.float32),
            X.astype(np.float32),
            method=cv2.LMEDS,
        )
    if M is None:
        return JsonResponse({'error': 'manual registration failed', 'message': 'Echec du calcul de transformation affine.'}, status=400)

    warped = cv2.warpAffine(moving, M, (fixed.shape[1], fixed.shape[0]))
    rmse = float(np.sqrt(np.mean((fixed.astype(np.float32) - warped.astype(np.float32)) ** 2)))
    mi = _compute_mutual_information(fixed, warped)
    if mi > 0.5:
        mi_quality = 'Excellent'
    elif mi > 0.3:
        mi_quality = 'Bon'
    else:
        mi_quality = 'Faible'

    entry['pending_registration'] = {
        'mode': 'manual',
        'matrix': M.tolist(),
        'axis': axis,
        'index': idx,
    }
    _persist_job_entry(job_id)

    return JsonResponse({
        'success': True,
        'image': _encode_png_data_url(warped),
        'metrics': {
            'rmse': round(rmse, 4),
            'mutual_information': round(mi, 4),
            'mi_quality': mi_quality,
            'success': True,
            'processing_time_ms': 0,
        },
        'requires_validation': True,
    })


@csrf_exempt
@require_http_methods(["POST"])
def auto_align_volume(request):
    try:
        payload = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    job_id = payload.get('jobId')
    if not job_id:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)

    # Default plus court : chaque iter coute L passes multi-resolution (GPU).
    # Les sorties intermediaires NIfTI (save_extended_outputs) ralentissaient fortement l'I/O disque.
    raw_n_iters = payload.get('n_iters', payload.get('iterations', 60))
    try:
        n_iters = int(raw_n_iters)
    except (TypeError, ValueError):
        n_iters = 60
    n_iters = int(np.clip(n_iters, 30, 1000))

    strict_atlas_grid = bool(payload.get('strict_atlas_grid', True))

    _ensure_atlas()
    selected = entry.get('selected_slice') or {}
    axis = str(payload.get('axis', selected.get('axis', 'axial'))).lower()
    if axis not in ('axial', 'coronal', 'sagittal'):
        axis = 'axial'

    atlas_vol = VOLUMES_CACHE['atlas']['data']
    patient_vol = entry['data']
    patient_nifti_path = entry.get('nifti_path')

    atlas_max_idx = _max_index(atlas_vol.shape, axis)
    patient_max_idx = _max_index(patient_vol.shape, axis)
    idx = int(payload.get('index', selected.get('index', min(atlas_max_idx, patient_max_idx) // 2)))
    idx = int(np.clip(idx, 0, min(atlas_max_idx, patient_max_idx)))
    entry['selected_slice'] = {'axis': axis, 'index': idx}

    work_dir = os.path.join(tempfile.gettempdir(), 'visionmed_volume_jobs', job_id, 'auto3d')
    os.makedirs(work_dir, exist_ok=True)
    atlas_nifti_path = os.path.join(work_dir, 'atlas_fixed.nii.gz')
    moving_prepared_nifti_path = os.path.join(work_dir, 'moving_prepared.nii.gz')

    try:
        # Prepare moving volume in atlas grid without introducing synthetic affine drift.
        patient_vol_for_mine = np.asarray(patient_vol, dtype=np.float32)
        atlas_shape = tuple(int(v) for v in atlas_vol.shape)
        patient_shape = tuple(int(v) for v in patient_vol.shape)
        
        if patient_shape != atlas_shape:
            print(f"[AUTO_ALIGN] Patient shape {patient_shape} != atlas {atlas_shape}")
            print(f"[AUTO_ALIGN] Resampling moving volume to atlas grid...")
            
            try:
                atlas_affine = np.asarray(VOLUMES_CACHE['atlas'].get('affine', np.eye(4)), dtype=np.float32)
                if patient_nifti_path and nib is not None and os.path.exists(patient_nifti_path):
                    from nibabel.processing import resample_from_to

                    src_img = nib.as_closest_canonical(nib.load(patient_nifti_path))
                    patient_resampled_nii = resample_from_to(
                        src_img,
                        (atlas_shape, atlas_affine),
                        order=1,
                        mode='nearest',
                        cval=0.0,
                    )
                    patient_vol_for_mine = patient_resampled_nii.get_fdata(dtype=np.float32)
                    if _is_suspicious_spatial_position(patient_vol_for_mine):
                        raise ValueError('affine resampling produced suspicious position')
                    print("[AUTO_ALIGN] Affine-aware resampling from original NIfTI succeeded")
                else:
                    raise ValueError('original nifti path unavailable')
                
            except Exception as e:
                print(f"[AUTO_ALIGN] Affine resampling unavailable/failed ({e}), fallback to shape+center")
                source_vol = np.asarray(entry.get('data_original', patient_vol), dtype=np.float32)
                patient_vol_for_mine = _resample_volume_to_shape(source_vol, atlas_shape)
                patient_vol_for_mine = _center_volume_by_foreground(patient_vol_for_mine)
            
            # Robustly normalize to match atlas intensity range
            patient_vol_for_mine = _robust_normalize_01(patient_vol_for_mine)
        
        # Save with guaranteed atlas affine coherence
        _ensure_atlas()
        print(f"[AUTO_ALIGN] Saving atlas NIfTI: {atlas_nifti_path}")
        _save_volume_nifti(atlas_vol, atlas_nifti_path, 
                          affine=VOLUMES_CACHE['atlas'].get('affine'))
        
        print(f"[AUTO_ALIGN] Saving patient NIfTI: {moving_prepared_nifti_path}")
        _save_volume_nifti(patient_vol_for_mine, moving_prepared_nifti_path,
                          affine=VOLUMES_CACHE['atlas'].get('affine'))
        
        print(f"[AUTO_ALIGN] Running MINE 3D registration with n_iters={n_iters}...")
        result = run_mine_3d_nifti(
            fixed_path=atlas_nifti_path,
            moving_path=moving_prepared_nifti_path,
            output_dir=work_dir,
            n_iters=n_iters,
            max_levels=3,
            levels_used=2,
            max_samples=16384,
            device_name='cuda',
            save_extended_outputs=False,
            early_stop_patience=22,
            early_stop_min_iters=35,
            early_stop_min_delta=5e-4,
        )
    except Exception as e:
        return JsonResponse({
            'error': 'auto registration failed',
            'message': str(e),
        }, status=500)

    warped_path = result.get('warped_path')
    if not warped_path or not os.path.exists(warped_path):
        return JsonResponse({'error': 'warped volume not found'}, status=500)

    warped_vol = nib.load(warped_path).get_fdata(dtype=np.float32)
    warped_nib = nib.load(warped_path)
    
    print(f"[DEBUG_WARPED] Loaded warped volume")
    print(f"              Shape: {warped_vol.shape}")
    print(f"              Affine from NIfTI:\n{warped_nib.affine}")
    print(f"              Atlas shape: {atlas_vol.shape}")
    print(f"              Atlas affine:\n{VOLUMES_CACHE['atlas'].get('affine')}")
    
    if tuple(int(v) for v in warped_vol.shape) != tuple(int(v) for v in atlas_vol.shape):
        print(f"[WARNING] Shape mismatch after warping, resampling...")
        warped_vol = _resample_volume_to_shape(warped_vol, atlas_vol.shape)
    else:
        print(f"[OK] Warped volume shape matches atlas")

    strict_scale = 1.0
    if strict_atlas_grid:
        warped_vol, strict_scale = _force_extent_alignment_to_reference(
            np.asarray(warped_vol, dtype=np.float32),
            np.asarray(atlas_vol, dtype=np.float32),
            threshold=0.10,
            max_scale_delta=0.30,
        )

    # Final bounded similarity stabilization to remove residual scale/position offsets.
    warped_vol, stabilization = _stabilize_similarity_to_reference(
        np.asarray(warped_vol, dtype=np.float32),
        np.asarray(atlas_vol, dtype=np.float32),
        threshold=0.10,
        max_shift_ratio=0.15 if strict_atlas_grid else 0.08,
        max_scale_delta=0.30 if strict_atlas_grid else 0.14,
        min_scale_trigger=0.03 if strict_atlas_grid else 0.08,
    )
    print(
        f"[AUTO_ALIGN] strict_atlas_grid={strict_atlas_grid} | "
        f"strict_scale={strict_scale:.4f} | "
        f"similarity_scale={stabilization.get('scale', 1.0):.4f}, "
        f"shift={stabilization.get('shift', (0, 0, 0))}"
    )

    matrix_4x4 = result.get('matrix')
    suspicious_matrix = _is_suspicious_affine_matrix_3d(matrix_4x4)
    # For MINE 3D: disable suspicious_position check since MINE handles small volumes well
    suspicious_position = False
    auto_fallback_used = bool(suspicious_matrix)

    # Keep auto result pending until clinician validates it.
    entry['pending_registered_data'] = np.asarray(warped_vol, dtype=np.float32)
    entry['pending_registration'] = {
        'mode': 'auto3d',
        'axis': axis,
        'index': idx,
        'n_iters': n_iters,
        'strict_atlas_grid': strict_atlas_grid,
        'matrix_4x4': matrix_4x4,
        'warped_path': warped_path,
        'fallback_used': auto_fallback_used,
        'fallback_reason': 'suspicious_matrix' if suspicious_matrix else None,
        'stabilization': {
            'strict_scale': float(strict_scale),
            'similarity_scale': float(stabilization.get('scale', 1.0)),
            'shift': list(stabilization.get('shift', (0, 0, 0))),
        },
    }
    _persist_job_entry(job_id)

    atlas_idx = int(np.clip(idx, 0, _max_index(atlas_vol.shape, axis)))
    patient_idx = int(np.clip(idx, 0, _max_index(entry['pending_registered_data'].shape, axis)))
    atlas_img = _normalize_u8(_render_slice(atlas_vol, atlas_idx, axis))
    patient_img = _normalize_u8(_render_slice(entry['pending_registered_data'], patient_idx, axis))

    final_mi = float(result.get('mutual_information', 0.0))
    if final_mi > 0.5:
        mi_quality = 'Excellent'
    elif final_mi > 0.3:
        mi_quality = 'Bon'
    else:
        mi_quality = 'Faible'

    return JsonResponse({
        'success': True,
        'auto_applied': False,
        'requires_validation': True,
        'fallback_used': auto_fallback_used,
        'fallback_reason': 'suspicious_matrix' if suspicious_matrix else None,
        'image': _encode_png_data_url(patient_img),
        'images': {
            'patient': _encode_png_data_url(patient_img),
            'atlas': _encode_png_data_url(atlas_img),
        },
        'axis': axis,
        'index': idx,
        'n_iters': n_iters,
        'strict_atlas_grid': strict_atlas_grid,
        'metrics': {
            'n_iters': n_iters,
            'strict_atlas_grid': strict_atlas_grid,
            'mutual_information': round(final_mi, 4),
            'mi_quality': mi_quality,
            'mse_before': float(result.get('metrics', {}).get('mse_before', 0.0)),
            'mse_after': float(result.get('metrics', {}).get('mse_after', 0.0)),
            'mae_before': float(result.get('metrics', {}).get('mae_before', 0.0)),
            'mae_after': float(result.get('metrics', {}).get('mae_after', 0.0)),
            'ncc_before': float(result.get('metrics', {}).get('ncc_before', 0.0)),
            'ncc_after': float(result.get('metrics', {}).get('ncc_after', 0.0)),
            'processing_time_ms': float(result.get('processing_time_ms', 0.0)),
            'device': result.get('device', 'cpu'),
            'success': True,
        },
        'pipeline': {
            'stage_info': result.get('stage_info', {}),
            'saved_outputs': {
                'warped_path': result.get('warped_path'),
                'matrix_path': result.get('matrix_path'),
                'fixed_norm_path': result.get('fixed_norm_path'),
                'moving_norm_path': result.get('moving_norm_path'),
                'diff_before_path': result.get('diff_before_path'),
                'diff_after_path': result.get('diff_after_path'),
                'mi_curve_path': result.get('mi_curve_path'),
                'weights_path': result.get('weights_path'),
            },
        },
    })


@csrf_exempt
@require_http_methods(["POST"])
def validate_volume_registration(request):
    try:
        payload = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)
    job_id = payload.get('jobId')
    if not job_id:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)

    pending = entry.get('pending_registration')
    if pending and str(pending.get('mode', '')).lower() == 'auto3d':
        pending_vol = entry.get('pending_registered_data')
        if pending_vol is None:
            return JsonResponse({'error': 'pending auto result missing'}, status=400)

        atlas_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)
        vol_out = np.asarray(pending_vol, dtype=np.float32)
        if tuple(int(v) for v in vol_out.shape) != atlas_shape:
            vol_out = _resample_volume_to_shape(vol_out, atlas_shape)

        entry['registered_data'] = vol_out
        entry['pending_registration'] = None
        entry['pending_registered_data'] = None
        _persist_job_entry(job_id)

        z = VOLUMES_CACHE['atlas']['data'].shape[2] // 2
        atlas_img = _render_label_slice_rgb(VOLUMES_CACHE['atlas']['labels'], z, 'axial')
        patient_img = _normalize_u8(_render_slice(entry['registered_data'], z, 'axial'))

        return JsonResponse({
            'success': True,
            'message': 'Recalage automatique valide et applique au volume complet.',
            'registered_shape': list(entry['registered_data'].shape),
            'images': {
                'patient': _encode_png_data_url(patient_img),
                'atlas': _encode_png_data_url(atlas_img),
            },
            'z': z,
        })

    if pending and 'matrix' in pending:
        # Apply the 2D matrix to the entire 3D volume (axial by axial)
        M = np.array(pending['matrix'], dtype=np.float32)
        mode = str(pending.get('mode', '')).lower()
        axis = str(pending.get('axis', 'axial')).lower()
        if axis not in ('axial', 'coronal', 'sagittal'):
            axis = 'axial'
        vol_in = entry['data']
        vol_out = np.zeros_like(vol_in)

        num_slices = vol_in.shape[2] if axis == 'axial' else vol_in.shape[1] if axis == 'coronal' else vol_in.shape[0]
        for i in range(num_slices):
            if axis == 'axial':
                sl = vol_in[:, :, i]
            elif axis == 'coronal':
                sl = vol_in[:, i, :]
            else:
                sl = vol_in[i, :, :]

            # Warp in the exact same 2D display orientation as calibration preview.
            sl_rot = np.rot90(sl)
            h_rot, w_rot = sl_rot.shape
            warp_flags = cv2.INTER_LINEAR
            if mode == 'auto':
                warp_flags |= cv2.WARP_INVERSE_MAP

            warped_rot = cv2.warpAffine(
                sl_rot,
                M,
                (w_rot, h_rot),
                flags=warp_flags,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=0,
            )
            sl_final = np.rot90(warped_rot, -1)

            if axis == 'axial':
                vol_out[:, :, i] = sl_final
            elif axis == 'coronal':
                vol_out[:, i, :] = sl_final
            else:
                vol_out[i, :, :] = sl_final
            
        atlas_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)
        if tuple(int(v) for v in vol_out.shape) != atlas_shape:
            vol_out = _resample_volume_to_shape(vol_out, atlas_shape)

        entry['registered_data'] = vol_out
        print(f"✅ Volume registered using transformation matrix for job {job_id}")
    else:
        vol_out = entry['data'].copy()
        atlas_shape = tuple(int(v) for v in VOLUMES_CACHE['atlas']['data'].shape)
        if tuple(int(v) for v in vol_out.shape) != atlas_shape:
            vol_out = _resample_volume_to_shape(vol_out, atlas_shape)
        entry['registered_data'] = vol_out
        print(f"⚠️ No transformation matrix found for job {job_id}, using raw data")

    entry['pending_registration'] = None
    entry['pending_registered_data'] = None
    _persist_job_entry(job_id)

    z = VOLUMES_CACHE['atlas']['data'].shape[2] // 2
    atlas_img = _render_label_slice_rgb(VOLUMES_CACHE['atlas']['labels'], z, 'axial')
    patient_img = _normalize_u8(_render_slice(entry['registered_data'], z, 'axial'))

    return JsonResponse({
        'success': True,
        'message': 'Transformation validee et appliquee au volume complet.',
        'registered_shape': list(entry['registered_data'].shape),
        'images': {
            'patient': _encode_png_data_url(patient_img),
            'atlas': _encode_png_data_url(atlas_img),
        },
        'z': z,
    })


@csrf_exempt
@require_http_methods(["POST"])
def reject_volume_registration(request):
    try:
        payload = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)
    job_id = payload.get('jobId')
    if not job_id:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry = _get_job_entry(job_id)
    if entry is None:
        return JsonResponse({'error': 'jobId not found'}, status=404)
    entry['pending_registration'] = None
    entry['pending_registered_data'] = None
    _persist_job_entry(job_id)
    return JsonResponse({'success': True, 'message': 'Resultat rejete. Relancez avec d autres parametres.'})
