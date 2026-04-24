from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_segmentationmaskresult_restore_m1_unlocked'),
    ]

    operations = [
        migrations.AddField(
            model_name='mrifile',
            name='image_height',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mrifile',
            name='image_width',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
