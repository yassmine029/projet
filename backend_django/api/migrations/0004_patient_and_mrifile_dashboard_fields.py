from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_emergencyloginattempt_passwordresettoken_patient_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE TABLE IF NOT EXISTS api_mrifile ("
                "id bigserial PRIMARY KEY, "
                "file varchar(100) NOT NULL, "
                "original_filename varchar(255) NOT NULL, "
                "uploaded_at timestamptz NOT NULL, "
                "patient_id bigint NOT NULL"
                ");"
            ),
            reverse_sql="DROP TABLE IF EXISTS api_mrifile;",
        ),
        migrations.AddField(
            model_name='patient',
            name='antecedents',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='pathologie',
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='stade',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='telephone',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='mrifile',
            name='file_size',
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='mrifile',
            name='relative_path',
            field=models.CharField(blank=True, max_length=512),
        ),
    ]
