from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_volume_registration_job'),
    ]

    operations = [
        # 1. Supprimer l'ancienne contrainte unique sur nom seul
        migrations.AlterField(
            model_name='referenceintensity',
            name='nom',
            field=models.CharField(db_index=True, max_length=100),
        ),
        # 2. Ajouter le champ mode
        migrations.AddField(
            model_name='referenceintensity',
            name='mode',
            field=models.CharField(
                choices=[('affine', 'Affine (MINE 3D)'), ('deformable', 'Déformable (Hybrid)')],
                default='affine',
                db_index=True,
                help_text='Mode de recalage utilisé pour produire ce volume de référence.',
                max_length=20,
            ),
        ),
        # 3. Contrainte unique sur le couple (nom, mode)
        migrations.AlterUniqueTogether(
            name='referenceintensity',
            unique_together={('nom', 'mode')},
        ),
    ]
