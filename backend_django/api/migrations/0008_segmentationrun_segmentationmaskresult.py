from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_usersettings'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SegmentationRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model_key', models.CharField(default='unetpp', max_length=40)),
                ('threshold', models.FloatField(default=0.25)),
                ('selected_count', models.IntegerField(default=0)),
                ('processed_count', models.IntegerField(default=0)),
                ('status', models.CharField(choices=[('running', 'Running'), ('done', 'Done'), ('failed', 'Failed')], default='running', max_length=12)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('doctor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segmentation_runs', to=settings.AUTH_USER_MODEL)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segmentation_runs', to='api.patient')),
            ],
        ),
        migrations.CreateModel(
            name='SegmentationMaskResult',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slice_index', models.IntegerField(default=1)),
                ('source_filename', models.CharField(max_length=255)),
                ('source_file', models.CharField(max_length=512)),
                ('source_url', models.CharField(blank=True, max_length=1024, null=True)),
                ('mask_file', models.CharField(max_length=512)),
                ('mask_url', models.CharField(blank=True, max_length=1024, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('mri_file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segmentation_masks', to='api.mrifile')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segmentation_masks', to='api.patient')),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='results', to='api.segmentationrun')),
            ],
            options={
                'ordering': ['slice_index', 'id'],
            },
        ),
    ]
