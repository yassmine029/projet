from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_fix_patient_dossier_column_compat'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DO $$
            DECLARE
                _dtype text;
                _rows bigint;
            BEGIN
                SELECT data_type
                INTO _dtype
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'api_patient'
                  AND column_name = 'id';

                IF _dtype = 'uuid' THEN
                    SELECT COUNT(*) INTO _rows FROM api_patient;

                    IF _rows = 0 THEN
                        ALTER TABLE api_mrifile
                            DROP CONSTRAINT IF EXISTS api_mrifile_patient_id_13998a94_fk_api_patient_id;

                        ALTER TABLE api_mrifile
                            ALTER COLUMN patient_id TYPE BIGINT USING NULL::BIGINT;

                        ALTER TABLE api_patient DROP CONSTRAINT IF EXISTS api_patient_pkey;
                        ALTER TABLE api_patient DROP COLUMN id;
                        ALTER TABLE api_patient ADD COLUMN id BIGSERIAL PRIMARY KEY;

                        ALTER TABLE api_mrifile
                            ADD CONSTRAINT api_mrifile_patient_id_13998a94_fk_api_patient_id
                            FOREIGN KEY (patient_id) REFERENCES api_patient(id)
                            DEFERRABLE INITIALLY DEFERRED;
                    END IF;
                END IF;
            END
            $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
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
