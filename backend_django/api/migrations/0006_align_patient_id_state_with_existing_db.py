from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_fix_patient_dossier_column_compat'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='patient',
                    name='id',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
            ],
        ),
    ]
