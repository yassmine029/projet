from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField
import secrets
import uuid

User = get_user_model()


class Series(models.Model):
    job_id = models.CharField(max_length=64, unique=True)
    patient_id = models.CharField(max_length=256, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    files = ArrayField(models.CharField(max_length=512), default=list, blank=True)
    tform = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Series {self.job_id} ({self.patient_id})"


class Average(models.Model):
    name = models.CharField(max_length=128, default='average')
    files = ArrayField(models.CharField(max_length=512), default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


class PasswordResetToken(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='reset_token')
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        return timezone.now() < self.expires_at and not self.is_used

    def __str__(self):
        return f"Reset token for {self.user.username}"


class EmergencyLoginAttempt(models.Model):
    email = models.EmailField(unique=True)
    count = models.IntegerField(default=0)
    last_attempt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Emergency attempts for {self.email}: {self.count}"


class Patient(models.Model):
    SEX_CHOICES = [
        ('M', 'Masculin'),
        ('F', 'Féminin'),
    ]

    id = models.BigAutoField(primary_key=True)
    num_dossier = models.CharField(max_length=50, unique=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    sexe = models.CharField(max_length=1, choices=SEX_CHOICES)
    autres_maladies = models.TextField(blank=True, null=True)
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nom} {self.prenom} - {self.num_dossier}"


class Reclamation(models.Model):
    ETAT_CHOICES = [
        ('en_attente', 'En attente'),
        ('payee', 'Payée'),
        ('rejetee', 'Rejetée'),
    ]

    id = models.BigAutoField(primary_key=True)
    numero = models.CharField(max_length=50, unique=True, blank=True)
    description = models.TextField()
    date = models.DateTimeField(auto_now_add=True)
    etat = models.CharField(max_length=20, choices=ETAT_CHOICES, default='en_attente')
    fichier = models.FileField(upload_to='reclamations/', blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reclamations')

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = uuid.uuid4().hex[:13].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Réclamation {self.numero} - {self.user.username}"