# Generated manually for Brodmann reference by age (missing DOB = explicit error).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_reference_intensity_and_analyse'),
    ]

    operations = [
        migrations.AlterField(
            model_name='patient',
            name='date_naissance',
            field=models.DateField(blank=True, null=True),
        ),
    ]
