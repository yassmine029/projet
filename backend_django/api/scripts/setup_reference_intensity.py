"""
Script django-extensions : même flux recalage 3D que la plateforme (MINE / Hybrid
via `volume_api.mine_register_nifti_for_reference_pipeline`), puis sommes d'intensité
par zone (carte Harvard–Oxford Nilearn = identification volume_api).

Exécution (une fois ou après changement d'atlas) depuis le dossier backend_django :

    python manage.py runscript setup_reference_intensity

Prérequis : dépendances MINE (PyTorch, etc.) comme pour l'upload 3D — pas ANTsPy.

Variables d'environnement (optionnelles) :
    REFERENCE_INTENSITY_NIFTI_SOURCE   Chemin du NIfTI source (même entrée qu'un patient)
    REFERENCE_INTENSITY_NOM           Nom unique en base : sujet1 ... sujet5 (tranches d'âge
                                      côté application). Relancer le script pour chaque volume
                                      en changeant NOM et SOURCE.
    REFERENCE_INTENSITY_N_ITERS       Itérations MINE (défaut : 60 ; Hybrid : 100–250)
    REFERENCE_INTENSITY_DEVICE        cuda | cpu | auto (défaut : cuda)
    REFERENCE_INTENSITY_HYBRID        1 pour HYBRID, sinon MINE (défaut : 0)
    REFERENCE_INTENSITY_STRICT_GRID   0 pour désactiver strict_atlas_grid (défaut : 1)
"""

from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path

import numpy as np


def run():
    import django

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
    django.setup()

    from django.conf import settings
    from nilearn.image import resample_to_img
    import nibabel as nib

    from api.models import ReferenceIntensity
    from api.official_atlas import load_official_mni_atlas_bundle
    from api.volume_api import (
        VOLUMES_CACHE,
        _ensure_atlas,
        mine_register_nifti_for_reference_pipeline,
    )

    source_path = os.getenv(
        'REFERENCE_INTENSITY_NIFTI_SOURCE',
        getattr(settings, 'REFERENCE_INTENSITY_NIFTI_SOURCE', ''),
    )
    nom = os.getenv(
        'REFERENCE_INTENSITY_NOM',
        getattr(settings, 'REFERENCE_INTENSITY_NOM', 'sujet1'),
    )

    try:
        n_iters = int(
            os.getenv(
                'REFERENCE_INTENSITY_N_ITERS',
                str(getattr(settings, 'REFERENCE_INTENSITY_N_ITERS', 60)),
            )
        )
    except ValueError:
        n_iters = 60

    device_name = os.getenv(
        'REFERENCE_INTENSITY_DEVICE',
        getattr(settings, 'REFERENCE_INTENSITY_DEVICE', 'cuda'),
    ).strip().lower()
    if device_name not in ('cuda', 'cpu', 'auto', 'mps'):
        device_name = 'cuda'

    use_hybrid = os.getenv(
        'REFERENCE_INTENSITY_HYBRID',
        str(getattr(settings, 'REFERENCE_INTENSITY_HYBRID', '0')),
    ).strip() in ('1', 'true', 'True', 'yes', 'YES')
    strict_atlas_grid = os.getenv(
        'REFERENCE_INTENSITY_STRICT_GRID',
        str(getattr(settings, 'REFERENCE_INTENSITY_STRICT_GRID', '1')),
    ).strip() not in ('0', 'false', 'False', 'no', 'NO')

    if not source_path or not os.path.isfile(source_path):
        print(f'[setup_reference_intensity] Fichier source introuvable : {source_path!r}')
        return

    original_source_abs = os.path.abspath(source_path)

    # Copie vers un chemin ASCII si le disque contient des accents (ex. dossier « référence »).
    # L’extension doit être la même que le fichier source (.nii vs .nii.gz), sinon nibabel refuse de l’ouvrir.
    try:
        source_path.encode('ascii')
    except UnicodeEncodeError:
        media_root = Path(settings.MEDIA_ROOT)
        out_dir_pre = media_root / 'reference_intensity'
        out_dir_pre.mkdir(parents=True, exist_ok=True)
        src_lower = original_source_abs.lower()
        if src_lower.endswith('.nii.gz'):
            ascii_ext = '.nii.gz'
        elif src_lower.endswith('.nii'):
            ascii_ext = '.nii'
        else:
            ascii_ext = Path(original_source_abs).suffix or '.nii'
        ascii_copy = out_dir_pre / f'_source_ascii_for_pipeline{ascii_ext}'
        shutil.copy2(source_path, ascii_copy)
        print(f'      Copie vers chemin ASCII : {ascii_copy}')
        source_path = str(ascii_copy)

    media_root = Path(settings.MEDIA_ROOT)
    out_dir = media_root / 'reference_intensity'
    out_dir.mkdir(parents=True, exist_ok=True)

    registered_filename = f'{nom}_mni152_mine.nii.gz'
    registered_abs = out_dir / registered_filename

    work_dir = os.path.join(
        tempfile.gettempdir(),
        f'reference_intensity_mine_{nom}_{uuid.uuid4().hex[:12]}',
    )

    mode = 'HYBRID' if use_hybrid else 'MINE'
    print(f'[1/5] Source : {original_source_abs}')
    print(f'[2/5] Mode plateforme : {mode} (device={device_name}, n_iters={n_iters}, '
          f'strict_atlas_grid={strict_atlas_grid})')
    print(f'      Dossier travail : {work_dir}')
    print(f'      Sortie NIfTI : {registered_abs}')

    try:
        _ensure_atlas()
        ref_data, mine_info = mine_register_nifti_for_reference_pipeline(
            source_path,
            work_dir,
            n_iters=n_iters,
            strict_atlas_grid=strict_atlas_grid,
            use_hybrid=use_hybrid,
            device_name=device_name,
        )
    except Exception as exc:
        print(f'[setup_reference_intensity] Échec recalage MINE : {exc}')
        raise

    affine = np.asarray(VOLUMES_CACHE['atlas'].get('affine'), dtype=np.float64)
    ref_img = nib.Nifti1Image(np.asarray(ref_data, dtype=np.float32), affine)
    ref_img.header.set_data_dtype(np.float32)
    nib.save(ref_img, str(registered_abs))
    print(f'[3/5] Volume recalé (plateforme) sauvegardé : {registered_abs}')
    if mine_info.get('mutual_information') is not None:
        print(f'      MI finale : {mine_info.get("mutual_information"):.4f}')

    print('[4/5] Calcul des sommes par label (indices Harvard–Oxford)...')
    template_img, labels_img, _lut = load_official_mni_atlas_bundle()
    ref_nii = nib.load(str(registered_abs))
    ref_arr = np.asanyarray(ref_nii.dataobj).astype(np.float64)

    atlas_on_ref = resample_to_img(
        labels_img,
        ref_nii,
        interpolation='nearest',
        force_resample=True,
    )
    labels = np.rint(np.asanyarray(atlas_on_ref.dataobj)).astype(np.int32)

    if labels.shape != ref_arr.shape:
        print(
            f'[ERREUR] Shape atlas {labels.shape} != volume {ref_arr.shape} après resample.'
        )
        return

    brodmann_intensities: dict[str, float] = {}
    for zone in sorted(np.unique(labels)):
        if zone == 0:
            continue
        mask = labels == zone
        if not np.any(mask):
            continue
        somme = float(np.sum(ref_arr[mask]))
        brodmann_intensities[str(int(zone))] = somme

    print(f'      {len(brodmann_intensities)} zones non nulles enregistrées.')

    rel_media = str(Path('reference_intensity') / registered_filename).replace('\\', '/')
    obj, created = ReferenceIntensity.objects.update_or_create(
        nom=nom,
        defaults={
            'mri_original_path': original_source_abs,
            'mri_registered_path': rel_media,
            'brodmann_intensities': brodmann_intensities,
        },
    )
    action = 'créé' if created else 'mis à jour'
    print(f'[5/5] ReferenceIntensity « {nom} » {action} (pk={obj.pk}).')
    print('[setup_reference_intensity] Terminé (flux identique plateforme : MINE + stabilisation).')
