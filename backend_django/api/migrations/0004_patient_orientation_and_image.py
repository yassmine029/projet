from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_complaint'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('patient_id', models.IntegerField(db_index=True)),
                ('image', models.ImageField(upload_to='patient_images/%Y/%m/%d')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='PatientImageOrientation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('patient_id', models.IntegerField(db_index=True, unique=True)),
                ('rotation', models.IntegerField(default=0)),
                ('flip_h', models.BooleanField(default=False)),
                ('flip_v', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
