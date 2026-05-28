import os
import sys
import time
from typing import Dict, List

import cv2
import numpy as np
from scipy import ndimage
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .models import MRIFile

_ONNX_IMPORT_ERROR: str = ''

try:
    import onnxruntime as ort
except Exception as exc:  # pragma: no cover
    ort = None  # type: ignore
    _ONNX_IMPORT_ERROR = f'{type(exc).__name__}: {exc}'


_SESSIONS: Dict[str, "ort.InferenceSession"] = {}

# Training/inference constants copied from the provided UNet++ pipeline.
MODEL_INPUT_SIZE = 256
NORM_MEAN = 0.1311
NORM_STD = 0.1250
# Probabilité minimale (après sigmoid si besoin) pour compter un pixel comme lésion.
# Plus haut = moins de faux positifs sur coupes faibles / bruit ; peut rogner les bords fins.
DEFAULT_THRESHOLD = 0.75

# Coupes quasi vides (noir / sans signal) : ne pas appeler l'ONNX (évite des masques aberrants).
_EMPTY_SLICE_MAX_RAW = 1.0
_EMPTY_SLICE_P99_MAX = 4.0
_EMPTY_SLICE_MEAN_MAX = 1.5


def _is_effectively_empty_slice(gray_u8: np.ndarray) -> bool:
    """
    True si la coupe n'a pas de signal exploitable (noir, tout à zéro, ou quasi uniforme ~0).
    Entrée : image 2D uint8 (0–255), même lecture que pour l'inférence.
    """
    if gray_u8 is None or gray_u8.size == 0:
        return True
    if gray_u8.ndim != 2:
        gray_u8 = np.squeeze(gray_u8)
        if gray_u8.ndim != 2:
            return True
    mx = float(np.max(gray_u8))
    if mx < _EMPTY_SLICE_MAX_RAW:
        return True
    mean = float(np.mean(gray_u8))
    p99 = float(np.percentile(gray_u8, 99))
    if p99 <= _EMPTY_SLICE_P99_MAX and mean <= _EMPTY_SLICE_MEAN_MAX:
        return True
    return False


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _softmax(x: np.ndarray, axis: int = 1) -> np.ndarray:
    x_max = np.max(x, axis=axis, keepdims=True)
    ex = np.exp(x - x_max)
    return ex / np.sum(ex, axis=axis, keepdims=True)


def _truncate_filename(name: str, max_len: int = 80) -> str:
    base = os.path.basename(name or "slice")
    if len(base) <= max_len:
        return base
    return f"{base[:max_len-3]}..."


def resolve_model_path(model_key: str) -> str:
    key = (model_key or "").strip().lower()
    if key in ("unetpp", "u-net++", "unet++"):
        return settings.UNETPP_MODEL_PATH
    if key in ("swinunetr", "swin-unetr", "swin_unetr", "swin"):
        return settings.SWINUNETR_MODEL_PATH
    if key in ("nnunet", "nnu-net", "nnu_net", "model_fold0_2d", "nnunet_fold0_v2", "nnunet_fold0_final_2026-04-05"):
        return settings.NNUNET_MODEL_PATH
    raise ValueError(f"Modele non supporte pour le moment: {model_key}")


def _normalize_model_key(model_key: str) -> str:
    key = (model_key or "").strip().lower()
    if key in ("unetpp", "u-net++", "unet++"):
        return "unetpp"
    if key in ("swinunetr", "swin-unetr", "swin_unetr", "swin"):
        return "swinunetr"
    if key in ("nnunet", "nnu-net", "nnu_net", "model_fold0_2d", "nnunet_fold0_v2", "nnunet_fold0_final_2026-04-05"):
        return "nnunet"
    return key


def _build_session(model_path: str):
    if ort is None:
        hint = (
            f"onnxruntime n'est pas utilisable sur le backend (Python: {sys.executable}). "
            f"Lancez le serveur avec le venv du projet (ex. .venv\\Scripts\\python.exe manage.py runserver). "
            f"Detail import: {_ONNX_IMPORT_ERROR or 'inconnu'}"
        )
        raise RuntimeError(hint)
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Modele ONNX introuvable: {model_path}")

    import multiprocessing
    n_cores = max(1, multiprocessing.cpu_count())
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = n_cores
    opts.inter_op_num_threads = n_cores
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    providers = ["CPUExecutionProvider"]
    return ort.InferenceSession(model_path, sess_options=opts, providers=providers)


def get_session(model_key: str):
    model_path = resolve_model_path(model_key)
    if model_path not in _SESSIONS:
        _SESSIONS[model_path] = _build_session(model_path)
    return _SESSIONS[model_path]


def _infer_input_spec(session) -> tuple:
    input_meta = session.get_inputs()[0]
    shape = input_meta.shape

    # Expected ONNX layout is usually NCHW (2D) or NCDHW (3D).
    if len(shape) >= 5:
        d = shape[2]
        h = shape[3]
        w = shape[4]
        depth = int(d) if isinstance(d, int) and d > 0 else 1
        height = int(h) if isinstance(h, int) and h > 0 else MODEL_INPUT_SIZE
        width = int(w) if isinstance(w, int) and w > 0 else MODEL_INPUT_SIZE
        return True, depth, height, width

    h = shape[2] if len(shape) >= 4 else None
    w = shape[3] if len(shape) >= 4 else None
    height = int(h) if isinstance(h, int) and h > 0 else MODEL_INPUT_SIZE
    width = int(w) if isinstance(w, int) and w > 0 else MODEL_INPUT_SIZE
    return False, 1, height, width


def _prepare_input_from_array(
    image: np.ndarray, target_h: int, target_w: int, model_key: str, expects_3d: bool, target_d: int
) -> tuple:
    original_h, original_w = image.shape[:2]
    model_kind = _normalize_model_key(model_key)

    # Keep preprocessing faithful to each training/inference pipeline.
    resized = cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

    if model_kind in ("nnunet", "swinunetr"):
        x = resized.astype(np.float32)
        mean = float(np.mean(x))
        std = float(np.std(x))
        x = (x - mean) / (std + 1e-8)
        tensor = x
    else:
        tensor = resized.astype(np.float32) / 255.0
        tensor = (tensor - NORM_MEAN) / NORM_STD

    tensor = np.expand_dims(np.expand_dims(tensor, axis=0), axis=0)  # NCHW
    if expects_3d:
        # Some SwinUNETR exports expect NCDHW. We build a shallow volume from the slice.
        tensor = np.expand_dims(tensor, axis=2)  # NCDHW with D=1
        if target_d > 1:
            tensor = np.repeat(tensor, target_d, axis=2)

    return tensor, (original_h, original_w)


def _prepare_input(image_path: str, target_h: int, target_w: int, model_key: str, expects_3d: bool, target_d: int) -> tuple:
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"Impossible de lire l'image: {image_path}")
    return _prepare_input_from_array(image, target_h, target_w, model_key, expects_3d, target_d)


def _post_traitement(binary_mask: np.ndarray) -> np.ndarray:
    """Replicates post_traitement from user's evaluation scripts."""
    clean = ndimage.binary_opening(binary_mask, iterations=1).astype(np.uint8)
    clean = ndimage.binary_closing(clean, iterations=1).astype(np.uint8)
    clean = ndimage.binary_fill_holes(clean).astype(np.uint8)
    labeled, n = ndimage.label(clean)
    if n == 0:
        return clean

    tailles = [(labeled == i).sum() for i in range(1, n + 1)]
    top2 = sorted(range(1, n + 1), key=lambda i: tailles[i - 1], reverse=True)[:2]
    return np.isin(labeled, top2).astype(np.uint8)


def _postprocess_mask(output: np.ndarray, original_shape: tuple, threshold: float, model_key: str) -> np.ndarray:
    model_kind = _normalize_model_key(model_key)
    mask = output

    if model_kind in ("nnunet", "swinunetr"):
        if mask.ndim not in (4, 5):
            raise ValueError("Sortie du modele invalide: logits attendus [N,C,H,W] ou [N,C,D,H,W].")

        if mask.shape[1] >= 2:
            probs = _softmax(mask, axis=1)
            labels = np.argmax(probs, axis=1)
            if labels.ndim == 3:
                binary = (labels[0] == 1).astype(np.uint8)
            elif labels.ndim == 4:
                center_d = labels.shape[1] // 2
                binary = (labels[0, center_d] == 1).astype(np.uint8)
            else:
                raise ValueError("Sortie classes invalide apres argmax.")
        else:
            score = mask
            if score.ndim == 5:
                score = score[0, 0, score.shape[2] // 2]
            elif score.ndim == 4:
                score = score[0, 0]
            if np.min(score) < 0.0 or np.max(score) > 1.0:
                score = _sigmoid(score)
            binary = (score >= float(threshold)).astype(np.uint8)
        binary = ndimage.binary_closing(binary, iterations=1).astype(np.uint8)
        binary = ndimage.binary_fill_holes(binary).astype(np.uint8)
    else:
        if mask.ndim == 5:
            mask = mask[0, 0, mask.shape[2] // 2]
        elif mask.ndim == 4:
            mask = mask[0, 0]
        elif mask.ndim == 3:
            mask = mask[0]

        if np.min(mask) < 0.0 or np.max(mask) > 1.0:
            mask = _sigmoid(mask)

        binary = (mask >= float(threshold)).astype(np.uint8)
        binary = _post_traitement(binary)

    original_h, original_w = original_shape
    resized_back = cv2.resize(binary, (original_w, original_h), interpolation=cv2.INTER_NEAREST)
    resized_back = (resized_back > 0).astype(np.uint8) * 255
    return resized_back


def _save_mask(mask_u8: np.ndarray, patient_id: int, mri_file_id: int, model_key: str, source_name: str) -> str:
    model_safe = (model_key or "unetpp").replace("+", "p").replace(" ", "").lower()
    base_name = os.path.splitext(_truncate_filename(source_name))[0]
    file_name = f"{int(time.time())}_{mri_file_id}_{model_safe}_{base_name}_mask.png"
    storage_path = f"patients/{patient_id}/segmentations/{file_name}"

    ok, encoded = cv2.imencode(".png", mask_u8)
    if not ok:
        raise RuntimeError("Echec d'encodage du masque PNG")

    saved_path = default_storage.save(storage_path, ContentFile(encoded.tobytes()))
    return saved_path


def _save_source_preview_from_array(source_u8: np.ndarray, patient_id: int, mri_file_id: int, source_name: str) -> str:
    """Encode une preview PNG à partir du tableau grayscale déjà chargé."""
    base_name = os.path.splitext(_truncate_filename(source_name))[0]
    file_name = f"{int(time.time())}_{mri_file_id}_{base_name}_source.png"
    storage_path = f"patients/{patient_id}/segmentations/{file_name}"

    ok, encoded = cv2.imencode(".png", source_u8)
    if not ok:
        raise RuntimeError("Echec d'encodage de la preview source PNG")

    saved_path = default_storage.save(storage_path, ContentFile(encoded.tobytes()))
    return saved_path


def _save_source_preview(source_path: str, patient_id: int, mri_file_id: int, source_name: str) -> str:
    """Create a PNG preview for original slices (e.g. TIFF) so browsers can render it."""
    source_u8 = cv2.imread(source_path, cv2.IMREAD_GRAYSCALE)
    if source_u8 is None:
        raise ValueError(f"Impossible de lire la source pour preview: {source_path}")
    return _save_source_preview_from_array(source_u8, patient_id, mri_file_id, source_name)


def run_segmentation_on_files(mri_files: List[MRIFile], model_key: str, threshold: float = DEFAULT_THRESHOLD) -> List[dict]:
    session = get_session(model_key)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    expects_3d, target_d, target_h, target_w = _infer_input_spec(session)

    results = []
    for index, mri in enumerate(mri_files, start=1):
        source_path = getattr(mri.file, "path", None)
        if not source_path:
            raise ValueError(f"Fichier source invalide pour MRIFile {mri.id}")

        image = cv2.imread(source_path, cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise ValueError(f"Impossible de lire l'image: {source_path}")

        source_preview_path = _save_source_preview_from_array(image, mri.patient_id, mri.id, mri.original_filename)

        if _is_effectively_empty_slice(image):
            mask_u8 = np.zeros(image.shape[:2], dtype=np.uint8)
        else:
            tensor, original_shape = _prepare_input_from_array(
                image,
                target_h,
                target_w,
                model_key=model_key,
                expects_3d=expects_3d,
                target_d=target_d,
            )
            output = session.run([output_name], {input_name: tensor})[0]
            mask_u8 = _postprocess_mask(output, original_shape, threshold, model_key=model_key)
        saved_path = _save_mask(mask_u8, mri.patient_id, mri.id, model_key, mri.original_filename)

        file_url = None
        try:
            file_url = default_storage.url(saved_path)
        except Exception:
            file_url = saved_path

        source_url = None
        try:
            source_url = default_storage.url(source_preview_path)
        except Exception:
            source_url = source_preview_path

        results.append(
            {
                "index": index,
                "file_id": mri.id,
                "source_filename": mri.original_filename,
                "source_file": mri.file.name,
                "source_url": source_url,
                "mask_file": saved_path,
                "mask_url": file_url,
            }
        )

    return results