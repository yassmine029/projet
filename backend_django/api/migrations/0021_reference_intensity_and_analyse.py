# Generated manually for ReferenceIntensity + Analyse models

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0020_merge_0019_patient_emergency_temp_0019_patient_report'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReferenceIntensity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(db_index=True, max_length=100, unique=True)),
                ('mri_original_path', models.TextField(help_text='Chemin absolu du NIfTI source avant recalage.')),
                ('mri_registered_path', models.TextField(help_text='Chemin du volume recalé MNI152 (relatif à MEDIA_ROOT ou absolu).')),
                ('brodmann_intensities', models.JSONField(default=dict, help_text='Map { "1": somme_float, ..., "52": somme_float } sur masques atlas.')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Référence intensité Brodmann',
                'verbose_name_plural': 'Références intensité Brodmann',
                'ordering': ['-date_creation'],
            },
        ),
        migrations.CreateModel(
            name='Analyse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titre', models.CharField(blank=True, default='', help_text='Libellé optionnel (ex. coupe T1 post-recalage).', max_length=200)),
                ('mri_registered', models.FileField(help_text='Fichier NIfTI recalé MNI152 (aligné sur le même espace que l’atlas Brodmann).', max_length=500, upload_to='analyses_mni_registered/%Y/%m/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('doctor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='intensity_analyses', to=settings.AUTH_USER_MODEL)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='analyses', to='api.patient')),
            ],
            options={
                'verbose_name': 'Analyse (volume MNI)',
                'verbose_name_plural': 'Analyses (volumes MNI)',
                'ordering': ['-created_at'],
            },
        ),
    ]
