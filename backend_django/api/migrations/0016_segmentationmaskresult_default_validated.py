# Generated manually — nouveau masque : statut par défaut « validé ».

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_segmentationrun_threshold_default'),
    ]

    operations = [
        migrations.AlterField(
            model_name='segmentationmaskresult',
            name='review_status',
            field=models.CharField(
                choices=[
                    ('pending', 'En attente'),
                    ('validated', 'Validée'),
                    ('rejected', 'Rejetée'),
                ],
                db_index=True,
                default='validated',
                max_length=16,
            ),
        ),
    ]
