# Suppression du champ lié au bouton « Rétablir le Modèle 1 » (référence M1 toujours conservée ailleurs).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_segmentationmaskresult_default_validated'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='segmentationmaskresult',
            name='restore_model1_unlocked',
        ),
    ]
