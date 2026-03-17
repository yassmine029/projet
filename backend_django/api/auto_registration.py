"""
Auto-registration module for automatic image alignment using ANTs.
"""
import os
import time
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Optional, Tuple
import numpy as np
import cv2

try:
    import ants
    ANTS_AVAILABLE = True
except ImportError:
    ANTS_AVAILABLE = False
    print("WARNING: ANTs not available. Auto-registration will not work.")


def safe_read(path: str) -> 'ants.ANTsImage':
    """
    Read image using ANTs, falling back to OpenCV if ANTs fails (e.g. for PNG).
    Ensures consistent (W, H) orientation for ANTs.
    """
    path = os.path.normpath(path)
    ext = os.path.splitext(path)[1].lower()
    
    # Prefer OpenCV for standard image formats causing issues with ANTs on Windows
    if ext in ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff']:
        try:
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                return ants.from_numpy(img.T)
        except Exception:
            pass  # Fallback to ants.image_read if cv2 fails for some reason

    try:
        return ants.image_read(path)
    except Exception:
        # Fallback: read with cv2 (H, W) and transpose to (W, H)
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Could not read image: {path}")
        # Transpose to match ANTs (x, y) vs numpy (row, col)
        return ants.from_numpy(img.T)


def to_gray_if_rgb(img) -> 'ants.ANTsImage':
    """Convert RGB ANTs image to grayscale if needed."""
    if img.components == 3:
        arr = img.numpy()
        if arr.ndim == 3 and arr.shape[-1] == 3:
            arr = arr.mean(axis=-1)
        return ants.from_numpy(
            arr,
            spacing=img.spacing[:2],
            origin=img.origin[:2],
            direction=img.direction[:4]
        )
    return img


def register_2d_ants(
    fixed_path: str,
    moving_path: str,
    out_prefix: str,
    transform: str = "SyN",
    iters: str = "100x70x50x20",
    metric: str = "Mattes",
    interp: str = "linear"
) -> str:
    """
    Register two 2D images using ANTs.
    
    Args:
        fixed_path: Path to reference/template image
        moving_path: Path to image to be aligned
        out_prefix: Output prefix for result files
        transform: Type of transform (SyN, Affine, Rigid, etc.)
        iters: Iteration schedule (e.g., "100x70x50x20")
        metric: Registration metric (Mattes, MI, CC, etc.)
        interp: Interpolation method (linear, nearestNeighbor, etc.)
    
    Returns:
        Path to warped output image
    """
    if not ANTS_AVAILABLE:
        raise ImportError("ANTs is not installed. Cannot perform automatic registration.")
    
    Path(out_prefix).parent.mkdir(parents=True, exist_ok=True)
    
    # Read images
    fixed = safe_read(fixed_path)
    moving = safe_read(moving_path)
    
    # Convert to grayscale if needed
    fixed = to_gray_if_rgb(fixed)
    moving = to_gray_if_rgb(moving)
    
    if fixed.dimension != 2 or moving.dimension != 2:
        raise ValueError("Both images must be 2D.")
    
    # Resample moving image to match fixed image space
    moving_resampled = ants.resample_image_to_target(
        moving,
        fixed,
        interp_type=interp
    )
    
    # Perform registration
    reg = ants.registration(
        fixed=fixed,
        moving=moving_resampled,
        type_of_transform=transform,
        aff_metric=metric,
        reg_iterations=[int(x) for x in iters.split("x")]
    )
    
    # Apply transforms to get warped image
    warped = ants.apply_transforms(
        fixed=fixed,
        moving=moving,
        transformlist=reg["fwdtransforms"],
        interpolator=interp
    )
    
    # Save warped image
    out_img = f"{out_prefix}_warped.nii.gz"
    ants.image_write(warped, out_img)
    
    # Copy transforms to stable names
    for i, t in enumerate(reg["fwdtransforms"]):
        dst = f"{out_prefix}_transform_{i}.h5" if t.endswith(".h5") else f"{out_prefix}_warp.nii.gz"
        if os.path.abspath(t) != os.path.abspath(dst):
            try:
                shutil.copyfile(t, dst)
            except Exception:
                pass
    
    # Copy inverse transforms
    if "invtransforms" in reg:
        for i, t in enumerate(reg["invtransforms"]):
            if t.endswith(".nii.gz"):
                dst = f"{out_prefix}_inverseWarp.nii.gz" if i == 0 else f"{out_prefix}_inverse_{i}.nii.gz"
                try:
                    shutil.copyfile(t, dst)
                except Exception:
                    pass
    
    return out_img


def calculate_quality_metrics(
    fixed_img_array: np.ndarray,
    warped_img_array: np.ndarray,
    processing_time: float
) -> Dict:
    """
    Calculate quality metrics for the registration result.
    
    Args:
        fixed_img_array: Reference image as numpy array
        warped_img_array: Warped image as numpy array
        processing_time: Time taken for registration
    
    Returns:
        Dictionary containing quality metrics
    """
    # Ensure arrays are float for calculations
    fixed_float = fixed_img_array.astype(np.float32)
    warped_float = warped_img_array.astype(np.float32)
    
    # Calculate RMSE (Root Mean Square Error)
    diff = fixed_float - warped_float
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    
    # Calculate correlation coefficient
    fixed_flat = fixed_float.flatten()
    warped_flat = warped_float.flatten()
    correlation = float(np.corrcoef(fixed_flat, warped_flat)[0, 1])
    
    # Calculate normalized RMSE (0-1 scale)
    max_val = float(max(fixed_float.max(), warped_float.max()))
    normalized_rmse = float(rmse / max_val) if max_val > 0 else 0.0
    
    # Calculate quality score (higher is better)
    quality_score = float((1.0 - normalized_rmse) * correlation)
    
    return {
        'rmse': round(float(rmse), 4),
        'normalized_rmse': round(float(normalized_rmse), 4),
        'correlation': round(float(correlation), 4),
        'processing_time_ms': round(float(processing_time * 1000), 2),
        'quality_score': round(float(quality_score), 4),
        'success': True
    }


def auto_align_images(
    fixed_path: str,
    moving_path: str,
    output_dir: str,
    job_id: str,
    transform: str = "SyN",
    timeout_seconds: float = 60.0
) -> Tuple[Optional[str], Optional[str], Dict]:
    """
    Perform automatic image alignment using ANTs.
    
    Args:
        fixed_path: Path to reference/template image
        moving_path: Path to image to be aligned
        output_dir: Directory to save output files
        job_id: Job identifier for naming output files
        transform: Type of transform (SyN, Affine, Rigid, etc.)
        timeout_seconds: Maximum time allowed for registration
    
    Returns:
        Tuple of (warped_image_path, transform_path, metrics_dict)
        Returns (None, None, error_dict) on failure
    """
    if not ANTS_AVAILABLE:
        return None, None, {
            'success': False,
            'error': 'ANTs not available',
            'message': 'Le module ANTs n\'est pas installé sur le serveur.'
        }
    
    start_time = time.time()
    
    try:
        # Validate inputs
        if not os.path.exists(fixed_path):
            return None, None, {
                'success': False,
                'error': 'Fixed image not found',
                'message': 'L\'image de référence n\'a pas été trouvée.'
            }
        
        if not os.path.exists(moving_path):
            return None, None, {
                'success': False,
                'error': 'Moving image not found',
                'message': 'L\'image patient n\'a pas été trouvée.'
            }
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        out_prefix = os.path.join(output_dir, f"auto_{job_id}")
        
        # Perform registration
        print(f"Starting ANTs registration for job {job_id}...")
        warped_path = register_2d_ants(
            fixed_path,
            moving_path,
            out_prefix,
            transform=transform,
            iters="100x70x50x20",
            metric="Mattes",
            interp="linear"
        )
        
        # Check timeout
        processing_time = time.time() - start_time
        if processing_time > timeout_seconds:
            return None, None, {
                'success': False,
                'error': 'Timeout',
                'message': f'Le recalage a pris trop de temps ({processing_time:.1f}s). Essayez le mode manuel.'
            }
        
        # Read images for quality metrics
        fixed_img = safe_read(fixed_path)
        warped_img = safe_read(warped_path)
        
        fixed_img = to_gray_if_rgb(fixed_img)
        warped_img = to_gray_if_rgb(warped_img)
        
        # Calculate metrics
        metrics = calculate_quality_metrics(
            fixed_img.numpy(),
            warped_img.numpy(),
            processing_time
        )
        
        # Find transform file
        transform_path = None
        for ext in ['.h5', '.mat']:
            candidate = f"{out_prefix}_transform_0{ext}"
            if os.path.exists(candidate):
                transform_path = candidate
                break
        
        print(f"ANTs registration completed for job {job_id}: RMSE={metrics.get('rmse')}, time={processing_time:.2f}s")
        
        return warped_path, transform_path, metrics
        
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"ANTs registration failed for job {job_id}: {str(e)}")
        
        # Log error to file for debugging
        try:
            with open(os.path.join(os.path.dirname(output_dir), 'ants_error.log'), 'a') as f:
                f.write(f"Job {job_id} failed at {time.ctime()}:\n")
                f.write(f"Error: {str(e)}\n")
                import traceback
                f.write(traceback.format_exc())
                f.write("\n" + "-"*50 + "\n")
        except:
             pass

        return None, None, {
            'success': False,
            'error': 'Registration failed',
            'message': 'Le recalage automatique a échoué. Les images sont peut-être trop différentes. Essayez le mode manuel.',
            'technical_error': str(e),
            'processing_time_ms': round(processing_time * 1000, 2)
        }


def hybrid_align(
    fixed_path: str,
    moving_path: str,
    output_dir: str,
    job_id: str,
    quality_threshold: float = 0.7
) -> Tuple[Optional[str], Optional[str], Dict, str]:
    """
    Hybrid alignment: Try automatic first, fallback to manual if quality is poor.
    
    Args:
        fixed_path: Path to reference/template image
        moving_path: Path to image to be aligned
        output_dir: Directory to save output files
        job_id: Job identifier
        quality_threshold: Minimum quality score to accept automatic result (0-1)
    
    Returns:
        Tuple of (warped_path, transform_path, metrics, mode)
        mode is either 'auto_success', 'auto_poor_quality', or 'auto_failed'
    """
    # Try automatic alignment first
    warped_path, transform_path, metrics = auto_align_images(
        fixed_path,
        moving_path,
        output_dir,
        job_id,
        transform="SyN",
        timeout_seconds=60.0
    )
    
    # Check if automatic alignment succeeded
    if not metrics.get('success', False):
        return None, None, metrics, 'auto_failed'
    
    # Check quality score
    quality_score = metrics.get('quality_score', 0.0)
    
    if quality_score >= quality_threshold:
        # Automatic alignment succeeded with good quality
        metrics['mode'] = 'automatic'
        metrics['recommendation'] = 'accept'
        metrics['message'] = f"Recalage automatique réussi ! Score de qualité: {quality_score:.2f}"
        return warped_path, transform_path, metrics, 'auto_success'
    else:
        # Automatic alignment succeeded but quality is poor
        metrics['mode'] = 'automatic'
        metrics['recommendation'] = 'manual'
        metrics['message'] = f"Recalage automatique terminé (score: {quality_score:.2f}), mais la qualité est insuffisante. Mode manuel recommandé."
        return warped_path, transform_path, metrics, 'auto_poor_quality'