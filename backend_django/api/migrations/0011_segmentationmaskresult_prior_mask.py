from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_segmentationmaskresult_review_and_mask_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='prior_mask_file',
            field=models.CharField(blank=True, default='', max_length=512),
        ),
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='prior_mask_model_key',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Modèle du masque archivé avant la dernière relance (nnU-Net / SwinUNETR / etc.).',
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='prior_mask_url',
            field=models.CharField(blank=True, max_length=1024, null=True),
        ),
    ]
