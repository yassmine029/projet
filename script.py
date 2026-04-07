import nibabel as nib

atlas = nib.load('HarvardOxford-cort-maxprob-thr25-2mm.nii.gz')  # ou le chemin exact de ton atlas
patient = nib.load(r'C:\Users\yassm\pfe\sujet-1\pet-dicom\nifti\pet_sujet-1.nii')

print("ATLAS shape:", atlas.shape)
print("ATLAS voxel size:", atlas.header.get_zooms())
print("ATLAS affine:\n", atlas.affine)

print("\nPATIENT shape:", patient.shape)
print("PATIENT voxel size:", patient.header.get_zooms())
print("PATIENT affine:\n", patient.affine)