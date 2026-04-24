import os
from typing import Dict, List, Tuple

import cv2
import numpy as np
import trimesh
from scipy import ndimage
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from skimage import measure

from .models import SegmentationRun


DEFAULT_NORMATIVE_TOTAL_MEAN_MM3 = 4860.14
DEFAULT_NORMATIVE_TOTAL_STD_MM3 = 201.16


def _normalize_mask_shapes(masks: List[np.ndarray]) -> Tuple[List[np.ndarray], Tuple[int, int], int]:
    if not masks:
        raise ValueError('Aucun masque disponible pour normalisation.')

    shape_counts: Dict[Tuple[int, int], int] = {}
    for m in masks:
        if m is None or m.ndim != 2:
            raise ValueError('Un masque invalide a ete detecte (format 2D attendu).')
        shape = (int(m.shape[0]), int(m.shape[1]))
        shape_counts[shape] = shape_counts.get(shape, 0) + 1

    # Use the dominant shape to keep the majority untouched.
    target_shape = max(shape_counts.items(), key=lambda item: item[1])[0]

    normalized: List[np.ndarray] = []
    resized_count = 0
    target_h, target_w = target_shape
    for m in masks:
        if m.shape != target_shape:
            resized = cv2.resize(m, (target_w, target_h), interpolation=cv2.INTER_NEAREST)
            normalized.append((resized > 0).astype(np.uint8))
            resized_count += 1
        else:
            normalized.append((m > 0).astype(np.uint8))

    return normalized, target_shape, resized_count


def _to_float(value, default):
    try:
        parsed = float(value)
        return parsed if np.isfinite(parsed) and parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _resolve_step_size(quality: str) -> int:
    q = str(quality or 'standard').strip().lower()
    if q == 'fast':
        return 2
    if q == 'high':
        return 1
    return 1


def _load_mask(mask_path: str) -> np.ndarray:
    if not mask_path:
        raise ValueError('Chemin masque invalide.')
    if not default_storage.exists(mask_path):
        raise FileNotFoundError(f'Masque introuvable: {mask_path}')

    with default_storage.open(mask_path, 'rb') as fp:
        data = fp.read()

    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f'Impossible de decoder le masque: {mask_path}')
    return (img > 127).astype(np.uint8)


def _apply_structure(volume: np.ndarray, structure: str) -> np.ndarray:
    mode = str(structure or 'both').strip().lower()
    if mode not in {'left', 'right', 'both'}:
        mode = 'both'

    if mode == 'both':
        return volume

    z, y, x = volume.shape
    half = x // 2
    out = np.zeros_like(volume)
    if mode == 'left':
        out[:, :, :half] = volume[:, :, :half]
    else:
        out[:, :, half:] = volume[:, :, half:]
    return out


def _count_sides(volume: np.ndarray) -> Tuple[int, int]:
    z, y, x = volume.shape
    half = x // 2
    left_count = int(np.count_nonzero(volume[:, :, :half]))
    right_count = int(np.count_nonzero(volume[:, :, half:]))
    return left_count, right_count


def _keep_largest_component(binary_volume: np.ndarray) -> np.ndarray:
    labeled, num = ndimage.label(binary_volume > 0)
    if num <= 1:
        return (binary_volume > 0).astype(np.uint8)

    sizes = ndimage.sum(binary_volume > 0, labeled, index=np.arange(1, num + 1))
    largest_label = int(np.argmax(sizes)) + 1
    return (labeled == largest_label).astype(np.uint8)


def _sanitize_connected_components(volume: np.ndarray, structure: str) -> np.ndarray:
    mode = str(structure or 'both').strip().lower()
    z, y, x = volume.shape
    half = x // 2

    if mode == 'both':
        out = np.zeros_like(volume, dtype=np.uint8)
        left = _keep_largest_component(volume[:, :, :half])
        right = _keep_largest_component(volume[:, :, half:])
        out[:, :, :half] = left
        out[:, :, half:] = right
        return out

    return _keep_largest_component(volume)


def _safe_asymmetry_index_percent(left_mm3: float, right_mm3: float) -> float:
    avg = (left_mm3 + right_mm3) / 2.0
    if avg <= 0:
        return 0.0
    return ((right_mm3 - left_mm3) / avg) * 100.0


def _interpret_indices(ai_percent: float, ni_percent: float, z_score: float, left_mm3: float, right_mm3: float) -> Dict[str, str]:
    abs_ai = abs(ai_percent)
    if left_mm3 < right_mm3:
        smaller_side = 'gauche'
    elif right_mm3 < left_mm3:
        smaller_side = 'droite'
    else:
        smaller_side = 'indetermine'

    # AI thresholds for MTLE lateralization logic.
    if abs_ai < 10.0:
        ai_text = (
            f'AI={abs_ai:.2f}% (<10%): asymetrie non significative. '
            'Ne permet pas de lateraliser un foyer epileptogene; evoque une atteinte bilaterale '
            'ou une epilepsie extra-temporale.'
        )
    elif abs_ai < 20.0:
        ai_text = (
            f'AI={abs_ai:.2f}% (>=10%): asymetrie significative. '
            f'Oriente vers une lateralisation MTLE du cote du volume le plus petit ({smaller_side}).'
        )
    else:
        ai_text = (
            f'AI={abs_ai:.2f}% (>=20%): asymetrie majeure. '
            f'Argument fort pour une MTLE unilaterale ({smaller_side}).'
        )

    # NI thresholds for MA severity logic.
    if ni_percent > 110.0:
        ni_text = (
            f'NI={ni_percent:.2f}% (>110%): hyperplasie. Rare chez le sujet sain; '
            'evoquer variante anatomique, processus expansif lent ou artefact de segmentation.'
        )
    elif ni_percent >= 90.0:
        ni_text = (
            f'NI={ni_percent:.2f}% (>=90%): volume dans la norme. '
            'N\'appuie pas une atrophie hippocampique.'
        )
    elif ni_percent >= 80.0:
        ni_text = (
            f'NI={ni_percent:.2f}% (80-90%): atrophie legere. '
            'Surveillance requise, possible MA tres precoce.'
        )
    elif ni_percent >= 60.0:
        ni_text = (
            f'NI={ni_percent:.2f}% (60-80%): atrophie moderee. '
            'Evocateur de MA a un stade mild-to-moderate.'
        )
    else:
        ni_text = (
            f'NI={ni_percent:.2f}% (<60%): atrophie severe. '
            'Tres evocateur de MA a un stade avance.'
        )

    # Z-score thresholds for volumetric interpretation.
    if z_score <= -3.0:
        z_text = f'Z={z_score:.2f} (<=-3.0): atrophie severe. Diagnostic de MA tres probable.'
    elif z_score <= -1.5:
        z_text = f'Z={z_score:.2f} (-3.0 a -1.5): atrophie moderee. MA possible, a confirmer cliniquement.'
    elif z_score <= 1.5:
        z_text = f'Z={z_score:.2f} (-1.5 a +1.5): zone de normalite. Pas d\'argument pour une atrophie.'
    elif z_score > 2.0:
        z_text = f'Z={z_score:.2f} (>+2.0): hyperplasie significative, rare; investigation complementaire recommandee.'
    else:
        z_text = f'Z={z_score:.2f} (>+1.5): hyperplasie. Volume superieur a la normale.'

    # Combined pathological atrophy rule using configured thresholds.
    atrophy_probable = (ni_percent < 90.0) or (z_score <= -1.5)
    atrophy_severe = (ni_percent < 60.0) or (z_score <= -3.0)
    mtle_unilateral_probable = abs_ai >= 20.0

    if atrophy_severe:
        summary = 'Synthese: atrophie hippocampique severe probable (profil fortement compatible MA avancee).'
    elif atrophy_probable:
        summary = 'Synthese: atrophie hippocampique probable (profil compatible MA precoce/moderee selon NI/Z).'
    elif z_score > 1.5 or ni_percent > 110.0:
        summary = 'Synthese: profil d\'hyperplasie; verifier contexte clinique et qualite de segmentation.'
    else:
        summary = 'Synthese: profil volumetrique globalement dans la norme pour l\'atrophie hippocampique.'

    if mtle_unilateral_probable:
        mtle_text = f'MTLE: asymetrie majeure compatible avec forme unilaterale ({smaller_side}).'
    elif abs_ai >= 10.0:
        mtle_text = f'MTLE: asymetrie significative avec lateralisation probable ({smaller_side}).'
    else:
        mtle_text = 'MTLE: pas de lateralisation fiable sur AI seul.'

    return {
        'asymmetry': ai_text,
        'normality': ni_text,
        'z_score': z_text,
        'summary': summary,
        'ai_message': ai_text,
        'ni_message': ni_text,
        'z_message': z_text,
        'mtle_message': mtle_text,
        'smaller_side': smaller_side,
        'atrophy_probable': bool(atrophy_probable),
        'atrophy_severe': bool(atrophy_severe),
        'mtle_unilateral_probable': bool(mtle_unilateral_probable),
    }


def _save_mesh_outputs(run: SegmentationRun, mesh: trimesh.Trimesh) -> Dict[str, str]:
    base_dir = f'patients/{run.patient_id}/modelisation3d/run_{run.id}'
    obj_path = f'{base_dir}/hippocampus_{run.id}.obj'
    stl_path = f'{base_dir}/hippocampus_{run.id}.stl'

    obj_blob = mesh.export(file_type='obj')
    if isinstance(obj_blob, str):
        obj_blob = obj_blob.encode('utf-8')

    stl_blob = mesh.export(file_type='stl')
    if isinstance(stl_blob, str):
        stl_blob = stl_blob.encode('utf-8')

    saved_obj = default_storage.save(obj_path, ContentFile(obj_blob))
    saved_stl = default_storage.save(stl_path, ContentFile(stl_blob))

    obj_url = default_storage.url(saved_obj)
    stl_url = default_storage.url(saved_stl)

    return {
      'obj_file': saved_obj,
      'stl_file': saved_stl,
      'obj_url': obj_url,
      'stl_url': stl_url,
    }


def run_modelisation_3d(
    run: SegmentationRun,
    structure: str = 'both',
    quality: str = 'standard',
    smoothing: str = 'low',
    spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0),
    normative_total_mean_mm3: float = DEFAULT_NORMATIVE_TOTAL_MEAN_MM3,
    normative_total_std_mm3: float = DEFAULT_NORMATIVE_TOTAL_STD_MM3,
) -> Dict:
    rows = list(run.results.all().order_by('slice_index', 'id'))
    if not rows:
        raise ValueError('Aucun masque disponible pour ce run.')

    masks: List[np.ndarray] = []
    for row in rows:
        masks.append(_load_mask(row.mask_file))

    masks, target_shape, resized_count = _normalize_mask_shapes(masks)
    full_volume = np.stack(masks, axis=0).astype(np.uint8)  # (Z, Y, X)
    volume = _apply_structure(full_volume, structure)
    volume = _sanitize_connected_components(volume, structure)

    if int(volume.sum()) == 0:
        raise ValueError('Le volume binaire est vide apres filtrage de structure.')

    if min(volume.shape) < 2:
        raise ValueError('Volume insuffisant pour la reconstruction 3D (dimensions trop petites).')

    dz, dy, dx = spacing
    step_size = _resolve_step_size(quality)

    verts, faces, normals, values = measure.marching_cubes(
        volume.astype(np.float32),
        level=0.5,
        spacing=(dz, dy, dx),
        gradient_direction='ascent',
        step_size=step_size,
        allow_degenerate=False,
    )

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)

    smooth = str(smoothing or 'low').strip().lower()
    if smooth in {'low', 'medium'}:
        iterations = 4 if smooth == 'low' else 8
        try:
            trimesh.smoothing.filter_laplacian(mesh, lamb=0.5, iterations=iterations)
        except Exception:
            pass

    mesh_outputs = _save_mesh_outputs(run, mesh)

    voxel_volume_mm3 = float(np.sum(volume > 0)) * float(dz * dy * dx)
    mesh_volume_mm3 = float(abs(mesh.volume)) if mesh.is_watertight else None

    voxel_unit_mm3 = float(dz * dy * dx)
    left_voxels, right_voxels = _count_sides(volume)
    left_mm3 = float(left_voxels) * voxel_unit_mm3
    right_mm3 = float(right_voxels) * voxel_unit_mm3
    total_mm3 = left_mm3 + right_mm3

    mean_ref = _to_float(normative_total_mean_mm3, DEFAULT_NORMATIVE_TOTAL_MEAN_MM3)
    std_ref = _to_float(normative_total_std_mm3, DEFAULT_NORMATIVE_TOTAL_STD_MM3)
    ai_percent = _safe_asymmetry_index_percent(left_mm3, right_mm3)
    ni_percent = (total_mm3 / mean_ref) * 100.0 if mean_ref > 0 else 0.0
    z_score = ((total_mm3 - mean_ref) / std_ref) if std_ref > 0 else 0.0
    interpretation = _interpret_indices(ai_percent, ni_percent, z_score, left_mm3, right_mm3)

    return {
        'run_id': run.id,
        'patient_id': run.patient_id,
        'structure': structure,
        'quality': quality,
        'smoothing': smoothing,
        'spacing': {'z': dz, 'y': dy, 'x': dx},
        'slices_used': len(rows),
        'slice_shape_yx': {'y': int(target_shape[0]), 'x': int(target_shape[1])},
        'resized_slices_count': int(resized_count),
        'mesh_vertices': int(len(mesh.vertices)),
        'mesh_faces': int(len(mesh.faces)),
        'is_watertight': bool(mesh.is_watertight),
        'volume_voxel_mm3': voxel_volume_mm3,
        'volume_voxel_ml': voxel_volume_mm3 / 1000.0,
        'volume_mesh_mm3': mesh_volume_mm3,
        'volume_mesh_ml': (mesh_volume_mm3 / 1000.0) if mesh_volume_mm3 is not None else None,
        'volumes_mm3': {
            'left': left_mm3,
            'right': right_mm3,
            'total': total_mm3,
        },
        'volumes_ml': {
            'left': left_mm3 / 1000.0,
            'right': right_mm3 / 1000.0,
            'total': total_mm3 / 1000.0,
        },
        'clinical_indices': {
            'asymmetry_index_percent': ai_percent,
            'normality_index_percent': ni_percent,
            'z_score': z_score,
        },
        'reference_values_mm3': {
            'normative_total_mean': mean_ref,
            'normative_total_std': std_ref,
        },
        'clinical_thresholds': {
            'ai_significant_percent': 10.0,
            'ai_major_percent': 20.0,
            'ni_low_percent': 90.0,
            'ni_moderate_percent': 80.0,
            'ni_severe_percent': 60.0,
            'ni_hyperplasia_percent': 110.0,
            'z_moderate': -1.5,
            'z_severe': -3.0,
            'z_hyperplasia': 1.5,
            'z_hyperplasia_significant': 2.0,
        },
        'clinical_interpretation': interpretation,
        **mesh_outputs,
    }


def parse_spacing(payload: Dict) -> Tuple[float, float, float]:
    return (
        _to_float(payload.get('spacing_z'), 1.0),
        _to_float(payload.get('spacing_y'), 1.0),
        _to_float(payload.get('spacing_x'), 1.0),
    )


def parse_reference_values(payload: Dict) -> Tuple[float, float]:
    return (
        _to_float(payload.get('normative_total_mean_mm3'), DEFAULT_NORMATIVE_TOTAL_MEAN_MM3),
        _to_float(payload.get('normative_total_std_mm3'), DEFAULT_NORMATIVE_TOTAL_STD_MM3),
    )
