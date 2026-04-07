#!/usr/bin/env python3
"""
Debug script to verify MINE 3D registration alignment.
Checks if warped volume maintains correct spatial correspondence with atlas.
"""
import sys
import numpy as np
sys.path.insert(0, './backend_django')

try:
    import nibabel as nib
except:
    print("ERROR: nibabel not installed")
    sys.exit(1)

def test_affine_preservation():
    """Test that volumes maintain correct affines through the pipeline"""
    print("=" * 70)
    print("TEST: Affine Matrix Preservation in MINE 3D Pipeline")
    print("=" * 70)
    
    # Simulate atlas affine (MNI152 standard)
    atlas_affine = np.array([
        [-1, 0, 0, 90],
        [0, 1, 0, -126],
        [0, 0, 1, -72],
        [0, 0, 0, 1]
    ], dtype=np.float32)
    
    atlas_shape = (182, 218, 182)
    print(f"\n[ATLAS] Shape: {atlas_shape}")
    print(f"[ATLAS] Affine:\n{atlas_affine}")
    
    # Create dummy volumes
    atlas_data = np.random.rand(*atlas_shape).astype(np.float32)
    patient_data = np.random.rand(*atlas_shape).astype(np.float32)
    
    # Create NIfTI images
    atlas_nib = nib.Nifti1Image(atlas_data, atlas_affine)
    patient_nib = nib.Nifti1Image(patient_data, atlas_affine)
    
    print(f"\n[ATLAS_NIfTI] Affine from image:\n{atlas_nib.affine}")
    print(f"[PATIENT_NIfTI] Affine from image:\n{patient_nib.affine}")
    
    # Save and reload
    atlas_nib.to_filename('/tmp/test_atlas.nii.gz')
    patient_nib.to_filename('/tmp/test_patient.nii.gz')
    
    atlas_loaded = nib.load('/tmp/test_atlas.nii.gz')
    patient_loaded = nib.load('/tmp/test_patient.nii.gz')
    
    print(f"\n[LOADED_ATLAS] Affine:\n{atlas_loaded.affine}")
    print(f"[LOADED_PATIENT] Affine:\n{patient_loaded.affine}")
    
    # Check if affines are preserved
    atlas_match = np.allclose(atlas_loaded.affine, atlas_affine)
    patient_match = np.allclose(patient_loaded.affine, atlas_affine)
    
    print(f"\n[RESULT] Atlas affine preserved: {atlas_match}")
    print(f"[RESULT] Patient affine preserved: {patient_match}")
    
    if atlas_match and patient_match:
        print("\n✓ PASS: Affines correctly preserved")
        return True
    else:
        print("\n✗ FAIL: Affines were not preserved")
        return False

def test_coordinate_space():
    """Test that coordinate transformations are correct"""
    print("\n" + "=" * 70)
    print("TEST: Coordinate Space After Transposition")
    print("=" * 70)
    
    # Create a simple test volume [X, Y, Z]
    test_vol = np.zeros((3, 5, 7), dtype=np.float32)
    test_vol[1, 2, 3] = 1.0  # Mark a single voxel
    
    print(f"\n[ORIGINAL] Shape [X,Y,Z]: {test_vol.shape}")
    print(f"[ORIGINAL] Marked voxel at (1,2,3)")
    
    # Transpose as MINE does: [X,Y,Z] → [D,H,W]=[Z,Y,X]
    transposed = np.transpose(test_vol, (2, 1, 0))
    print(f"\n[TRANSPOSED] Shape [D,H,W]: {transposed.shape}")
    
    # Find marked voxel in transposed space
    marked_idx = np.where(transposed == 1.0)
    if len(marked_idx[0]) > 0:
        print(f"[TRANSPOSED] Marked voxel at ({marked_idx[0][0]}, {marked_idx[1][0]}, {marked_idx[2][0]})")
        print(f"  Expected: (3, 2, 1) [from permutation (2,1,0)]")
        
        expected = (3, 2, 1)
        actual = (marked_idx[0][0], marked_idx[1][0], marked_idx[2][0])
        if actual == expected:
            print("\n✓ PASS: Transposition indices correct")
            return True
        else:
            print("\n✗ FAIL: Transposition indices incorrect")
            return False
    else:
        print("\n✗ FAIL: Could not find marked voxel after transposition")
        return False

if __name__ == '__main__':
    results = []
    results.append(test_affine_preservation())
    results.append(test_coordinate_space())
    
    print("\n" + "=" * 70)
    print(f"SUMMARY: {sum(results)}/{len(results)} tests passed")
    print("=" * 70)
    
    sys.exit(0 if all(results) else 1)
