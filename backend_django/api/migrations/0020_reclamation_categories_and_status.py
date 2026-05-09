from django.db import migrations, models


def map_reclamation_status(apps, schema_editor):
    Reclamation = apps.get_model('api', 'Reclamation')
    Reclamation.objects.filter(etat='payee').update(etat='validee')
    Reclamation.objects.filter(etat='rejetee').update(etat='non_validee')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_patient_report'),
    ]

    operations = [
        migrations.AddField(
            model_name='reclamation',
            name='categorie',
            field=models.CharField(choices=[('compte', 'Compte & accès'), ('segmentation', 'Segmentation IA'), ('viewer', 'Visualisation'), ('performance', 'Performance'), ('facturation', 'Facturation'), ('autre', 'Autre')], default='autre', max_length=40),
        ),
        migrations.AddField(
            model_name='reclamation',
            name='priorite',
            field=models.CharField(choices=[('basse', 'Basse'), ('normale', 'Normale'), ('haute', 'Haute'), ('critique', 'Critique')], default='normale', max_length=20),
        ),
        migrations.RunPython(map_reclamation_status, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='reclamation',
            name='etat',
            field=models.CharField(choices=[('en_attente', 'En attente'), ('validee', 'Validée'), ('non_validee', 'Non validée')], default='en_attente', max_length=20),
        ),
    ]
