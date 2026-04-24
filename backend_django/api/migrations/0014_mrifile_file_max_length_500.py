from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_merge_20260412_2235'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mrifile',
            name='file',
            field=models.FileField(max_length=500, upload_to='patients_mri_files/'),
        ),
    ]
