from django.db import migrations, models


def unlock_where_prior_exists(apps, schema_editor):
    SegmentationMaskResult = apps.get_model('api', 'SegmentationMaskResult')
    SegmentationMaskResult.objects.exclude(prior_mask_file='').update(restore_model1_unlocked=True)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_segmentationmaskresult_initial_mask'),
    ]

    operations = [
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='restore_model1_unlocked',
            field=models.BooleanField(
                default=False,
                help_text='True après au moins une relance Modèle 2 ou 3 ; réinitialisé après rétablissement Modèle 1.',
            ),
        ),
        migrations.RunPython(unlock_where_prior_exists, migrations.RunPython.noop),
    ]
