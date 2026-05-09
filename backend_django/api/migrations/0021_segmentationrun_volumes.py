from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_reclamation_categories_and_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='segmentationrun',
            name='left_volume_mm3',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='segmentationrun',
            name='right_volume_mm3',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='segmentationrun',
            name='total_volume_mm3',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='segmentationrun',
            name='asymmetry_index',
            field=models.FloatField(blank=True, null=True, help_text="Index d'asymétrie en %"),
        ),
        migrations.AddField(
            model_name='segmentationrun',
            name='normality_index',
            field=models.FloatField(blank=True, null=True, help_text='Index de normalité en %'),
        ),
        migrations.AddField(
            model_name='segmentationrun',
            name='z_score',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
