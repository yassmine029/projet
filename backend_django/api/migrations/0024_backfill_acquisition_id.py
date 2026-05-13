"""
Migration de données : assigne un acquisition_id aux MRIFile existants sans acquisition_id.

Heuristique : les fichiers uploadés dans la même fenêtre de 10 minutes pour le même patient
appartiennent au même IRM (même session d'upload). On leur assigne le même UUID.
"""
import uuid
from datetime import timedelta
from django.db import migrations


def backfill_acquisition_id(apps, schema_editor):
    MRIFile = apps.get_model('api', 'MRIFile')

    # Traiter patient par patient
    patient_ids = (
        MRIFile.objects
        .filter(acquisition_id__isnull=True)
        .values_list('patient_id', flat=True)
        .distinct()
    )

    WINDOW = timedelta(minutes=10)

    for patient_id in patient_ids:
        files = list(
            MRIFile.objects
            .filter(patient_id=patient_id, acquisition_id__isnull=True)
            .order_by('uploaded_at')
        )
        if not files:
            continue

        # Grouper par fenêtre temporelle de 10 min
        current_group_uuid = uuid.uuid4()
        current_group_start = files[0].uploaded_at
        to_update = []

        for f in files:
            if f.uploaded_at and (f.uploaded_at - current_group_start) > WINDOW:
                # Nouvelle session d'upload → nouvel acquisition_id
                current_group_uuid = uuid.uuid4()
                current_group_start = f.uploaded_at

            f.acquisition_id = current_group_uuid
            to_update.append(f)

        # Bulk update par lots
        BATCH = 500
        for i in range(0, len(to_update), BATCH):
            MRIFile.objects.bulk_update(to_update[i:i + BATCH], ['acquisition_id'])


def reverse_backfill(apps, schema_editor):
    MRIFile = apps.get_model('api', 'MRIFile')
    MRIFile.objects.all().update(acquisition_id=None)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_mrifile_acquisition_id'),
    ]

    operations = [
        migrations.RunPython(backfill_acquisition_id, reverse_backfill),
    ]
