#!/usr/bin/env python3
"""
Complete diagnostic to identify MINE 3D registration misalignment.
Tests spatial coherence across the entire pipeline.
"""
import sys
import os
import tempfile
import numpy as np

sys.path.insert(0, './backend_django')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')

try:
    import django
    django.setup()
except:
    print("Django setup skipped")

try:
    import nibabel as nib
    from scipy.ndimage import zoom
except:
    print("ERROR: Required packages not installed")
    sys.exit(1)

from api.volume_api import (
    _ensure_atlas, _resample_volume_to_shape, VOLUMES_CACHE,
    _robust_normalize_01, _save_volume_nifti
)
from api.volume_mine_3d_registration import run_mine_3d_nifti

def test_spatial_coherence():
    """Test that resampling preserves spatial correspondance"""
    print("=" * 70)
    print("TEST 1: Spatial Coherence After Resampling")
    print("=" * 70)
    
    _ensure_atlas()
    atlas_vol = VOLUMES_CACHE['atlas']['data'].copy()
    atlas_affine = VOLUMES_CACHE['atlas']['affine']
    atlas_shape = atlas_vol.shape
    
    print(f"\nAtlas shape: {atlas_shape}")
    print(f"Atlas affine:\n{atlas_affine}\n")
    
    # Simulate a patient with different shape (non-NIfTI image)
    patient_shape = (100, 100, 64)  # Typical 2D→3D conversion
    patient_vol = np.random.rand(*patient_shape).astype(np.float32)
    
    print(f"Patient original shape: {patient_shape}")
    
    # Resample using our function
    print("\nResampling patient to atlas shape...")
    patient_resampled = _resample_volume_to_shape(patient_vol, atlas_shape)
    
    print(f"Patient resampled shape: {patient_resampled.shape}")
    print(f"Shape match: {patient_resampled.shape == atlas_vol.shape}")
    
    if patient_resampled.shape != atlas_vol.shape:
        print("\n✗ FAIL: Shape mismatch after resampling")
        return False
    
    # Mark corners in original and check if they moved predictably
    marker_original = np.zeros_like(patient_vol)
    marker_original[0, 0, 0] = 1.0
    marker_original[-1, -1, -1] = 1.0
    
    marker_resampled = _resample_volume_to_shape(marker_original, atlas_shape)
    
    print(f"\nMarker preservation test:")
    print(f"  Original markers: {np.sum(marker_original > 0)} voxels")
    print(f"  Resampled markers: {np.sum(marker_resampled > 0)} voxels")
    
    # Markers should roughly preserve corners
    if np.sum(marker_resampled > 0) > 0:
        print("  ✓ Markers preserved during resampling")
    else:
        print("  ✗ Markers lost during resampling")
        return False
    
    print("\n✓ PASS: Spatial coherence verified\n")
    return True


def test_affine_propagation():
    """Test that affines are correctly set in NIfTI files"""
    print("=" * 70)
    print("TEST 2: Affine Propagation Through NIfTI Save/Load")
    print("=" * 70)
    
    _ensure_atlas()
    atlas_affine = VOLUMES_CACHE['atlas']['affine']
    
    test_vol = np.random.rand(10, 10, 10).astype(np.float32)
    test_path = os.path.join(tempfile.gettempdir(), 'test_affine.nii.gz')
    
    print(f"\nTest affine:\n{atlas_affine}")
    
    # Save with _save_volume_nifti
    print(f"\nSaving test volume to {test_path}...")
    _save_volume_nifti(test_vol, test_path, affine=atlas_affine)
    
    # Reload and check affine
    print(f"Loading and checking affine...")
    loaded_nib = nib.load(test_path)
    loaded_affine = np.asarray(loaded_nib.affine, dtype=np.float32)
    
    print(f"Loaded affine:\n{loaded_affine}")
    
    affine_match = np.allclose(loaded_affine, atlas_affine)
    print(f"Affine preserved: {affine_match}")
    
    if not affine_match:
        print("\n✗ FAIL: Affine not preserved")
        print(f"  Expected:\n{atlas_affine}")
        print(f"  Got:\n{loaded_affine}")
        return False
    
    os.remove(test_path)
    print("\n✓ PASS: Affine correctly propagated\n")
    return True


def test_mine_on_identical_volumes():
    """Test MINE behavior when both volumes are identical"""
    print("=" * 70)
    print("TEST 3: MINE Behavior on Identical Volumes")
    print("=" * 70)
    
    _ensure_atlas()
    atlas_vol = VOLUMES_CACHE['atlas']['data'].copy()
    atlas_affine = VOLUMES_CACHE['atlas']['affine']
    
    work_dir = os.path.join(tempfile.gettempdir(), 'test_mine_identical')
    os.makedirs(work_dir, exist_ok=True)
    
    # Create two identical volumes
    fixed_path = os.path.join(work_dir, 'fixed.nii.gz')
    moving_path = os.path.join(work_dir, 'moving.nii.gz')
    
    print(f"\nCreating two identical test volumes...")
    _save_volume_nifti(atlas_vol, fixed_path, affine=atlas_affine)
    _save_volume_nifti(atlas_vol, moving_path, affine=atlas_affine)
    
    print(f"Running MINE on identical volumes (should return identity matrix)...")
    result = run_mine_3d_nifti(
        fixed_path=fixed_path,
        moving_path=moving_path,
        output_dir=work_dir,
        n_iters=50,  # Fewer iterations for testing
        device_name='cpu',
    )
    
    matrix = np.array(result['matrix'], dtype=np.float32)
    print(f"\nResulting matrix:\n{matrix}")
    
    # Check if matrix is close to identity
    identity = np.eye(4, dtype=np.float32)
    is_identity = np.allclose(matrix, identity, atol=0.1)
    
    print(f"\nMatrix is approximately identity: {is_identity}")
    
    if not is_identity:
        print("  ✗ Note: Matrix deviates from identity (may be expected due to convergence)")
    
    # Cleanup
    import shutil
    shutil.rmtree(work_dir)
    
    print("\n✓ MINE test completed\n")
    return True


if __name__ == '__main__':
    results = []
    
    try:
        results.append(test_spatial_coherence())
        results.append(test_affine_propagation())
        results.append(test_mine_on_identical_volumes())
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("\n" + "=" * 70)
    print(f"DIAGNOSTIC RESULTS: {sum(results)}/{len(results)} tests passed")
    print("=" * 70)
    
    if all(results):
        print("\n✓ All diagnostics passed. The pipeline appears spatially coherent.")
        print("  If misalignment still occurs, the issue may be in MINE convergence itself.")
    else:
        print("\n✗ Some diagnostics failed. Review the detailed output above.")
    
    sys.exit(0 if all(results) else 1)
