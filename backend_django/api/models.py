from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField
from django.core.validators import RegexValidator
import secrets
import uuid

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


# ✅ Tes modèles (Yesmine)
class PatientImageOrientation(models.Model):
    patient_id = models.IntegerField(unique=True, db_index=True)
    rotation = models.IntegerField(default=0)
    flip_h = models.BooleanField(default=False)
    flip_v = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Orientation patient {self.patient_id}"


class PatientImage(models.Model):
    patient_id = models.IntegerField(db_index=True)
    image = models.ImageField(upload_to='patient_images/%Y/%m/%d')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PatientImage {self.id} (patient {self.patient_id})"


# ✅ Modèles de Nadine
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


class AccountActivationToken(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='activation_token')
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        return timezone.now() < self.expires_at and not self.is_used

    def __str__(self):
        return f"Activation token for {self.user.username}"


class EmergencyLoginAttempt(models.Model):
    email = models.EmailField(unique=True)
    count = models.IntegerField(default=0)
    last_attempt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Emergency attempts for {self.email}: {self.count}"


class DoctorProfile(models.Model):
    SPECIALTY_CHOICES = [
        ('neuroradiologie', 'Neuroradiologie'),
        ('neurologie', 'Neurologie'),
        ('medecine_nucleaire', 'Medecine nucleaire'),
        ('autre', 'Autre'),
    ]

    STATUS_CHOICES = [
        ('en_attente', 'En attente'),
        ('actif', 'Actif'),
        ('refuse', 'Refuse'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    nom = models.CharField(max_length=100, blank=True, default='')
    prenom = models.CharField(max_length=100, blank=True, default='')
    order_number = models.CharField(
        max_length=8,
        unique=True,
        null=True,
        blank=True,
        validators=[RegexValidator(regex=r'^(?:\d{4,6}|T-\d{4,6})$', message='Order number must be 4-6 digits or T-4-6 digits.')],
    )
    affiliation = models.CharField(max_length=255, blank=True, default='')
    specialty = models.CharField(max_length=50, choices=SPECIALTY_CHOICES, default='autre')
    grade = models.CharField(max_length=80, blank=True, default='')
    telephone = models.CharField(max_length=40, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='en_attente')
    refusal_reason = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_doctor_profiles')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"DoctorProfile({self.user.username}, {self.specialty})"


dossier_number_regex = RegexValidator(
    regex=r'^DOS-\d{4}-\d{4}$',
    message='Dossier number must be in the format DOS-YYYY-NNNN.'
)

class Patient(models.Model):
    SEX_CHOICES = [('M', 'Masculin'), ('F', 'Féminin')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dossier_number = models.CharField(max_length=50, unique=True, validators=[dossier_number_regex])
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    sexe = models.CharField(max_length=1, choices=SEX_CHOICES)
    autres_maladies = models.TextField(blank=True, null=True)
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nom} {self.prenom} - {self.dossier_number}"


class MRIFile(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='mri_files')
    file = models.FileField(upload_to='patients_mri_files/')
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.original_filename} for {self.patient.dossier_number}"


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


class ContactRequest(models.Model):
    SUBJECT_CHOICES = [
        ('demonstration', 'Demonstration'),
        ('integration', 'Integration clinique'),
        ('support', 'Support technique'),
        ('partnership', 'Partenariat'),
        ('other', 'Autre'),
    ]

    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    institution = models.CharField(max_length=180, blank=True)
    subject = models.CharField(max_length=30, choices=SUBJECT_CHOICES, default='demonstration')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ContactRequest({self.full_name}, {self.email}, {self.subject})"


class Testimonial(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuve'),
        ('rejected', 'Rejete'),
    ]

    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=180)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_testimonials')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Testimonial({self.full_name}, {self.status})"