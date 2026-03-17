from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField

User = get_user_model()


class Series(models.Model):
    job_id = models.CharField(max_length=64, unique=True)
    patient_id = models.CharField(max_length=256, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    files = ArrayField(models.CharField(max_length=512), default=list, blank=True)
    tform = models.JSONField(null=True, blank=True)  # Store transformation data
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Series {self.job_id} ({self.patient_id})"


class Average(models.Model):
    name = models.CharField(max_length=128, default='average')
    files = ArrayField(models.CharField(max_length=512), default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name
