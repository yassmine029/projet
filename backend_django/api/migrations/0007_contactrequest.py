from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_merge_20260405_2107'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContactRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=150)),
                ('email', models.EmailField(max_length=254)),
                ('institution', models.CharField(blank=True, max_length=180)),
                ('subject', models.CharField(choices=[('demonstration', 'Demonstration'), ('integration', 'Integration clinique'), ('support', 'Support technique'), ('partnership', 'Partenariat'), ('other', 'Autre')], default='demonstration', max_length=30)),
                ('message', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
