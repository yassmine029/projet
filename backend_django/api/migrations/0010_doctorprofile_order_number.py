from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_doctorprofile_workflow_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorprofile',
            name='order_number',
            field=models.CharField(
                blank=True,
                max_length=8,
                null=True,
                unique=True,
                validators=[
                    RegexValidator(
                        message='Order number must be 4-6 digits or T-4-6 digits.',
                        regex='^(?:\\d{4,6}|T-\\d{4,6})$',
                    )
                ],
            ),
        ),
    ]
