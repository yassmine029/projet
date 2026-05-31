"""
Carte des régions corticales « officielle » partagée par tout le backend.

Même source que l'identification interactive (volume_api._ensure_atlas) :
template MNI152 Nilearn + atlas Harvard–Oxford cort-maxprob-thr25-2mm recalé dessus.

Les numéros de zone sont ceux de la liste /api/volume/cortical-zones (LUT Harvard–Oxford),
pas un fichier brodmann_atlas.nii.gz séparé.

L'atlas est pré-téléchargé une seule fois et mis en cache localement pour éviter
les téléchargements répétés depuis les serveurs FSL.
"""

from __future__ import annotations

import functools
from typing import Any

import nibabel as nib
import numpy as np

# IMPORTANT: Importer atlas_cache en premier pour configurer NILEARN_DATA
# avant tout import de nilearn
from .atlas_cache import get_atlas_cache_dir
_ = get_atlas_cache_dir()  # Ensure NILEARN_DATA is set


@functools.lru_cache(maxsize=1)
def load_official_mni_atlas_bundle():
    """
    Charge une fois (mise en cache) le couple anatomie + étiquettes régions.
    
    L'atlas Harvard-Oxford est chargé depuis le cache local. Il est pré-téléchargé
    une seule fois au démarrage de Django.

    Returns
    -------
    template_img : nibabel.Nifti1Image
        MNI152 T1 (Nilearn).
    labels_img : nibabel.Nifti1Image
        Carte d'entiers (Harvard–Oxford), même grille que template_img après resample.
    lut : dict[int, str]
        index -> nom affichable (même convention que VOLUMES_CACHE['atlas']['lut']).
    """
    from nilearn import datasets
    from nilearn import image as nilearn_image

    template_img = datasets.load_mni152_template()
    
    # Charge depuis le cache local (path configuré via os.environ['NILEARN_DATA'])
    ho = datasets.fetch_atlas_harvard_oxford(
        'cort-maxprob-thr25-2mm',
        symmetric_split=False,
    )
    ho_maps = ho['maps']
    if tuple(ho_maps.shape) != tuple(template_img.shape):
        ho_maps = nilearn_image.resample_to_img(
            ho_maps,
            template_img,
            interpolation='nearest',
        )

    labels_data = np.asanyarray(ho_maps.dataobj).astype(np.int16)
    labels_img = nib.Nifti1Image(labels_data, ho_maps.affine, ho_maps.header)

    raw_labels = list(ho.get('labels', []))
    lut: dict[int, str] = {
        i: str(name)
        for i, name in enumerate(raw_labels)
        if i > 0 and str(name).strip()
    }

    return template_img, labels_img, lut
