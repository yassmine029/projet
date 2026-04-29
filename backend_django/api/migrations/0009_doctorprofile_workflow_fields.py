from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_doctorprofile'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorprofile',
            name='refusal_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_doctor_profiles', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='doctorprofile',
            name='status',
            field=models.CharField(choices=[('en_attente', 'En attente'), ('actif', 'Actif'), ('refuse', 'Refuse')], default='en_attente', max_length=20),
        ),
    ]
