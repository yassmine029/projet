from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_mrifile_file_max_length_500'),
    ]

    operations = [
        migrations.AddField(
            model_name='mrifile',
            name='file_type',
            field=models.CharField(
                choices=[('original', 'Original'), ('analysis', 'Analyse')],
                default='original',
                max_length=20,
            ),
        ),
    ]
