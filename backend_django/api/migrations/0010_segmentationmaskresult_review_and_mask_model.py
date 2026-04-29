from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_merge_20260409_1500'),
    ]

    operations = [
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='mask_model_key',
            field=models.CharField(blank=True, default='', help_text='Modèle ayant produit le masque courant (vide = modèle du run à la création).', max_length=40),
        ),
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='review_status',
            field=models.CharField(
                choices=[('pending', 'En attente'), ('validated', 'Validée'), ('rejected', 'Rejetée')],
                db_index=True,
                default='pending',
                max_length=16,
            ),
        ),
    ]
