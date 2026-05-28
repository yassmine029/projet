"""
Script django-extensions : génère les sujets de référence d'intensité pour les deux modes
de recalage (affine via MINE 3D et déformable via Hybrid), en utilisant exactement les mêmes
paramètres que le recalage patient dans auto_align_volume.

Structure du dossier source (REFERENCE_SUBJECTS_DIR) :
    sujet_reference/
        sujet1.nii(.gz)   ← tranche < 24 ans
        sujet2.nii(.gz)   ← tranche 25-54 ans
        sujet3.nii(.gz)   ← tranche 55-64 ans
        sujet4.nii(.gz)   ← tranche 65-75 ans
        sujet5.nii(.gz)   ← tranche > 75 ans

Remplacer les fichiers dans ce dossier et relancer le script pour mettre à jour les références.

Exécution depuis backend_django/ :
    python manage.py runscript setup_reference_intensity

Variables d'environnement optionnelles :
    REFERENCE_SUBJECTS_DIR   Chemin du dossier (défaut : settings.REFERENCE_SUBJECTS_DIR)
    REFERENCE_DEVICE         cuda | cpu | auto (défaut : cuda)
"""

from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path

import numpy as np


# Tranches d'âge correspondant à chaque sujet
AGE_BANDS = {
    'sujet1': '< 24 ans',
    'sujet2': '25-54 ans',
    'sujet3': '55-64 ans',
    'sujet4': '65-75 ans',
    'sujet5': '> 75 ans',
}

# Paramètres identiques à auto_align_volume pour chaque mode.
# MINE affine  : frontend envoie 300, backend clip [30-1000] → 300 réelles.
# Hybrid dèfor.: frontend envoie 300, backend clip [100-250] → 250 réelles.
PARAMS_AFFINE = dict(
    n_iters=300,
    max_levels=3,
    levels_used=2,
    max_samples=16384,
    early_stop_patience=22,
    early_stop_min_iters=35,
    early_stop_min_delta=5e-4,
    save_extended_outputs=False,
)

PARAMS_DEFORMABLE = dict(
    n_iters=250,
    max_levels=3,
    levels_used=2,
    max_samples=8192,
    early_stop_patience=30,
    early_stop_min_iters=80,
    early_stop_min_delta=5e-4,
    save_extended_outputs=False,
    base=16,
    max_disp=0.05,
)


def _find_nifti(folder: Path, nom: str) -> Path | None:
    """Cherche sujetX.nii.gz puis sujetX.nii dans le dossier."""
    for ext in ('.nii.gz', '.nii'):
        p = folder / f'{nom}{ext}'
        if p.exists():
            return p
    return None


def _ascii_copy(src: Path, dst_dir: Path, ext: str) -> Path:
    """Copie vers un chemin ASCII si le source contient des caractères non-ASCII."""
    try:
        str(src).encode('ascii')
        return src
    except UnicodeEncodeError:
        dst = dst_dir / f'_source_ascii{ext}'
        shutil.copy2(src, dst)
        print(f'      Copie ASCII : {dst}')
        return dst


def _register_one(
    source_path: Path,
    nom: str,
    mode: str,
    work_base: Path,
    out_dir: Path,
    device_name: str,
):
    """
    Recale un sujet de référence sur l'atlas MNI152 avec le mode indiqué,
    calcule les sommes d'intensité par zone Harvard-Oxford, et sauvegarde en base.
    """
    import nibabel as nib
    from nilearn.image import resample_to_img

    from api.models import ReferenceIntensity
    from api.official_atlas import load_official_mni_atlas_bundle
    from api.volume_api import (
        VOLUMES_CACHE,
        _ensure_atlas,
        mine_register_nifti_for_reference_pipeline,
    )

    label = f'{nom} [{mode}]'
    use_hybrid = (mode == 'deformable')
    params = PARAMS_DEFORMABLE if use_hybrid else PARAMS_AFFINE

    work_dir = str(work_base / f'{nom}_{mode}_{uuid.uuid4().hex[:8]}')
    os.makedirs(work_dir, exist_ok=True)

    # Copie ASCII si nécessaire
    ext = '.nii.gz' if str(source_path).endswith('.nii.gz') else '.nii'
    src = _ascii_copy(source_path, Path(work_dir), ext)

    print(f'\n  [{label}] Recalage en cours...')
    print(f'    Source    : {source_path}')
    print(f'    Mode      : {mode} | n_iters={params["n_iters"]} | device={device_name}')

    _ensure_atlas()

    # Recalage via le même pipeline que auto_align_volume
    ref_data, mine_info = mine_register_nifti_for_reference_pipeline(
        str(src),
        work_dir,
        n_iters=params['n_iters'],
        strict_atlas_grid=True,
        use_hybrid=use_hybrid,
        device_name=device_name,
    )

    mi = mine_info.get('mutual_information')
    print(f'    MI finale : {mi:.4f}' if mi is not None else '    MI finale : N/A')

    # Sauvegarder le volume recalé
    registered_filename = f'{nom}_{mode}_mni152.nii.gz'
    registered_abs = out_dir / registered_filename

    atlas_affine = np.asarray(VOLUMES_CACHE['atlas'].get('affine'), dtype=np.float64)
    ref_img = nib.Nifti1Image(np.asarray(ref_data, dtype=np.float32), atlas_affine)
    ref_img.header.set_data_dtype(np.float32)
    nib.save(ref_img, str(registered_abs))
    print(f'    Volume sauvegardé : {registered_abs}')

    # Calcul des sommes d'intensité par label Harvard-Oxford
    print(f'    Calcul des intensités par zone...')
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
        print(f'    [ERREUR] Shape atlas {labels.shape} != volume {ref_arr.shape}')
        return False

    brodmann_intensities: dict[str, float] = {}
    for zone in sorted(np.unique(labels)):
        if zone == 0:
            continue
        mask = labels == zone
        if not np.any(mask):
            continue
        brodmann_intensities[str(int(zone))] = float(np.sum(ref_arr[mask]))

    print(f'    {len(brodmann_intensities)} zones enregistrées.')

    # Chemin relatif à MEDIA_ROOT
    from django.conf import settings as dj_settings
    rel_media = str(Path('reference_intensity') / registered_filename).replace('\\', '/')

    obj, created = ReferenceIntensity.objects.update_or_create(
        nom=nom,
        mode=mode,
        defaults={
            'mri_original_path': str(source_path.resolve()),
            'mri_registered_path': rel_media,
            'brodmann_intensities': brodmann_intensities,
        },
    )
    action = 'créé' if created else 'mis à jour'
    print(f'    ReferenceIntensity « {nom} » [{mode}] {action} (pk={obj.pk}).')
    return True


def run():
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
    django.setup()

    from django.conf import settings

    subjects_dir = Path(
        os.getenv('REFERENCE_SUBJECTS_DIR', getattr(settings, 'REFERENCE_SUBJECTS_DIR', ''))
    )
    device_name = os.getenv(
        'REFERENCE_DEVICE',
        getattr(settings, 'REFERENCE_INTENSITY_DEVICE', 'cuda'),
    ).strip().lower()
    if device_name not in ('cuda', 'cpu', 'auto', 'mps'):
        device_name = 'cuda'

    if not subjects_dir or not subjects_dir.is_dir():
        print(f'[setup_reference_intensity] Dossier introuvable : {subjects_dir!r}')
        print('  → Créez le dossier et placez-y sujet1.nii(.gz) .. sujet5.nii(.gz)')
        return

    print('=' * 60)
    print('  setup_reference_intensity')
    print(f'  Dossier source : {subjects_dir}')
    print(f'  Device         : {device_name}')
    print('=' * 60)

    from django.conf import settings as dj_settings
    out_dir = Path(dj_settings.MEDIA_ROOT) / 'reference_intensity'
    out_dir.mkdir(parents=True, exist_ok=True)
    work_base = Path(tempfile.gettempdir()) / 'visionmed_ref_intensity'
    work_base.mkdir(parents=True, exist_ok=True)

    modes = ['affine', 'deformable']
    sujets = list(AGE_BANDS.keys())  # sujet1 .. sujet5

    total = len(sujets) * len(modes)
    done = 0
    errors = []

    for nom in sujets:
        src = _find_nifti(subjects_dir, nom)
        if src is None:
            print(f'\n  [MANQUANT] {nom}.nii(.gz) absent de {subjects_dir} — ignoré.')
            errors.append(f'{nom} : fichier source introuvable')
            continue

        print(f'\n{"─"*60}')
        print(f'  Sujet : {nom} | Tranche : {AGE_BANDS[nom]}')
        print(f'  Fichier source : {src.name}')

        for mode in modes:
            try:
                ok = _register_one(src, nom, mode, work_base, out_dir, device_name)
                if ok:
                    done += 1
                else:
                    errors.append(f'{nom}/{mode} : erreur shape atlas')
            except Exception as exc:
                print(f'    [ERREUR] {nom} [{mode}] : {exc}')
                errors.append(f'{nom}/{mode} : {exc}')

    print(f'\n{"=" * 60}')
    print(f'  Terminé : {done}/{total} références créées/mises à jour.')
    if errors:
        print(f'  Erreurs ({len(errors)}) :')
        for e in errors:
            print(f'    - {e}')
    else:
        print('  Aucune erreur.')
    print('=' * 60)
    print()
    print('  Pour mettre à jour une référence :')
    print(f'    1. Remplacer le fichier dans {subjects_dir}')
    print('    2. Relancer : python manage.py runscript setup_reference_intensity')
