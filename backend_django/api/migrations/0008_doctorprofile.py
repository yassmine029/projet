from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_contactrequest'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DoctorProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(blank=True, default='', max_length=100)),
                ('prenom', models.CharField(blank=True, default='', max_length=100)),
                ('affiliation', models.CharField(blank=True, default='', max_length=255)),
                ('specialty', models.CharField(choices=[('neuroradiologie', 'Neuroradiologie'), ('neurologie', 'Neurologie'), ('medecine_nucleaire', 'Medecine nucleaire'), ('autre', 'Autre')], default='autre', max_length=50)),
                ('grade', models.CharField(blank=True, default='', max_length=80)),
                ('telephone', models.CharField(blank=True, default='', max_length=40)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='doctor_profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
