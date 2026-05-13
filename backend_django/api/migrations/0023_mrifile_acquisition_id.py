import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_merge_20260509_2202'),
        ('api', '0022_patient_date_naissance_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='mrifile',
            name='acquisition_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
