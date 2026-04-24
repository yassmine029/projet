# Generated manually for segmentation confidence default.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_mrifile_image_dimensions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='segmentationrun',
            name='threshold',
            field=models.FloatField(default=0.75),
        ),
    ]
