from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_patient_and_mrifile_dashboard_fields'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'api_patient' AND column_name = 'num_dossier'
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'api_patient' AND column_name = 'dossier_number'
                ) THEN
                    ALTER TABLE api_patient RENAME COLUMN num_dossier TO dossier_number;
                END IF;
            END
            $$;
            """,
            reverse_sql="""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'api_patient' AND column_name = 'dossier_number'
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'api_patient' AND column_name = 'num_dossier'
                ) THEN
                    ALTER TABLE api_patient RENAME COLUMN dossier_number TO num_dossier;
                END IF;
            END
            $$;
            """,
        ),
    ]
