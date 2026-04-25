from django.db import migrations, models


def backfill_initial_masks(apps, schema_editor):
    SegmentationMaskResult = apps.get_model('api', 'SegmentationMaskResult')
    for row in SegmentationMaskResult.objects.exclude(mask_file='').iterator():
        if row.initial_mask_file:
            continue
        row.initial_mask_file = row.mask_file
        row.initial_mask_url = row.mask_url
        row.initial_mask_model_key = (row.mask_model_key or '').strip()
        row.save(update_fields=['initial_mask_file', 'initial_mask_url', 'initial_mask_model_key'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_segmentationmaskresult_prior_mask'),
    ]

    operations = [
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='initial_mask_file',
            field=models.CharField(blank=True, default='', max_length=512),
        ),
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='initial_mask_model_key',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Masque du premier lancement (Modèle 1), conservé pour restauration.',
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name='segmentationmaskresult',
            name='initial_mask_url',
            field=models.CharField(blank=True, max_length=1024, null=True),
        ),
        migrations.RunPython(backfill_initial_masks, migrations.RunPython.noop),
    ]
