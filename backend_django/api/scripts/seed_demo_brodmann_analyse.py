"""
Crée (ou recrée) un patient + une Analyse dont le NIfTI MNI est une copie du volume
référence déjà recalé — pour tester l’API /api/brodmann/intensity/ et le panneau React.

Usage :
    python manage.py runscript seed_demo_brodmann_analyse
"""

from __future__ import annotations

import os
import shutil
from datetime import date
from pathlib import Path


def run():
    import django

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
    django.setup()

    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.files import File

    from api.models import Analyse, Patient, ReferenceIntensity

    if not ReferenceIntensity.objects.exists():
        print('[seed_demo_brodmann_analyse] Exécuter d’abord : runscript setup_reference_intensity')
        return

    User = get_user_model()
    user = User.objects.order_by('pk').first()
    if user is None:
        user = User.objects.create_user(
            username='brodmann_demo',
            password='Changeme!123',
            email='brodmann_demo@local.test',
        )
        print(f'[seed_demo_brodmann_analyse] Utilisateur créé : {user.username} / Changeme!123')

    dossier = 'DOS-2026-9999'
    patient, _ = Patient.objects.get_or_create(
        dossier_number=dossier,
        defaults={
            'doctor': user,
            'nom': 'Demo',
            'prenom': 'IntensiteBrodmann',
            'date_naissance': date(1990, 1, 1),
            'sexe': 'M',
        },
    )
    if patient.doctor_id != user.id:
        patient.doctor = user
        patient.save(update_fields=['doctor'])

    reg_src = Path(settings.MEDIA_ROOT) / 'reference_intensity' / 'sujet1_mni152_SyN.nii.gz'
    if not reg_src.is_file():
        print(f'[seed_demo_brodmann_analyse] Volume référence MNI introuvable : {reg_src}')
        return

    demo_dir = Path(settings.MEDIA_ROOT) / 'brodmann_demo_intensity'
    demo_dir.mkdir(parents=True, exist_ok=True)
    demo_vol = demo_dir / f'{dossier}_mni152_demo.nii.gz'
    shutil.copy2(reg_src, demo_vol)

    # Une seule ligne de démo par dossier (évite doublons si on relance le script)
    Analyse.objects.filter(patient=patient, titre='Démo panneau intensités Brodmann').delete()
    analyse = Analyse.objects.create(
        patient=patient,
        doctor=user,
        titre='Démo panneau intensités Brodmann',
    )
    with open(demo_vol, 'rb') as fh:
        analyse.mri_registered.save(demo_vol.name, File(fh), save=True)

    print('[seed_demo_brodmann_analyse] Terminé.')
    print(f'  Patient : {patient.dossier_number} (pk={patient.pk})')
    print(f'  Analyse pk = {analyse.pk}')
    print(f'  Frontend recalage avancé : ajouter ?brodmannAnalyseId={analyse.pk}')
    print(f'  Ou se connecter en tant que : {user.username}')
