from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField
from django.core.validators import RegexValidator
import secrets
import uuid

User = get_user_model()



def default_user_settings():
    return {
        'general': {
            'language': 'Francais',
            'timezone': 'Africa/Tunis (UTC+1)',
            'dateFormat': 'DD/MM/YYYY',
            'numberFormat': 'fr-TN',
        },
        'viewer': {
            'defaultPreset': 'Brain - T1',
            'interpolationEnabled': True,
            'autoMprSync': True,
            'showOrientationLabels': True,
            'enableAiOverlayByDefault': True,
            'cineLoopFps': 18,
        },
        'workflow': {
            'autoAssignUrgentCases': True,
            'enableDoubleReadForCritical': False,
            'autoOpenLastStudyContext': True,
            'reportTemplate': 'Neuro MRI Standard',
            'defaultPriority': 'Normale',
        },
        'notifications': {
            'studyCompleted': True,
            'aiAnomaly': True,
            'pendingReports': True,
            'reclamationUpdates': True,
            'weeklyDigest': False,
        },
        'security': {
            'sessionTimeoutMinutes': 30,
            'requireTwoFactor': False,
            'maskPatientNameInLists': False,
            'auditTrailEmail': '',
        },
        'integrations': {
            'pacsAeTitle': '',
            'pacsHost': '',
            'pacsPort': 104,
            'risEndpoint': '',
            'modalityWorklistEnabled': False,
            'dicomTlsEnabled': False,
        },
    }




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

    SEX_CHOICES = [
        ('M', 'Masculin'),
        ('F', 'Féminin'),
    ]

    id = models.BigAutoField(primary_key=True)

    
    

    dossier_number = models.CharField(max_length=50, unique=True, validators=[dossier_number_regex])
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    sexe = models.CharField(max_length=1, choices=SEX_CHOICES)
    telephone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    pathologie = models.CharField(max_length=120, blank=True, null=True)
    stade = models.CharField(max_length=80, blank=True, null=True)
    antecedents = models.CharField(max_length=80, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    autres_maladies = models.TextField(blank=True, null=True)
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients')
    created_at = models.DateTimeField(auto_now_add=True)
    emergency_temp = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Dossier jetable créé en session urgence (exclu des listes médecin).',
    )

    def __str__(self):
        return f"{self.nom} {self.prenom} - {self.dossier_number}"


class MRIFile(models.Model):
    FILE_TYPE_CHOICES = [
        ('original', 'Original'),
        ('analysis', 'Analyse'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='mri_files')
    file = models.FileField(upload_to='patients_mri_files/', max_length=500)
    original_filename = models.CharField(max_length=255)
    relative_path = models.CharField(max_length=512, blank=True)
    file_size = models.BigIntegerField(default=0)
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='original')
    image_width = models.PositiveIntegerField(null=True, blank=True)
    image_height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.original_filename} for {self.patient.dossier_number}"


class SegmentationRun(models.Model):
    STATUS_CHOICES = [
        ('running', 'Running'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='segmentation_runs')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='segmentation_runs')
    model_key = models.CharField(max_length=40, default='unetpp')
    threshold = models.FloatField(default=0.75)
    selected_count = models.IntegerField(default=0)
    processed_count = models.IntegerField(default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='running')
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Run #{self.id} - Patient {self.patient_id} - {self.model_key}"


class SegmentationMaskResult(models.Model):
    class ReviewStatus(models.TextChoices):
        PENDING = 'pending', 'En attente'
        VALIDATED = 'validated', 'Validée'
        REJECTED = 'rejected', 'Rejetée'

    run = models.ForeignKey(SegmentationRun, on_delete=models.CASCADE, related_name='results')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='segmentation_masks')
    mri_file = models.ForeignKey(MRIFile, on_delete=models.CASCADE, related_name='segmentation_masks')
    slice_index = models.IntegerField(default=1)
    source_filename = models.CharField(max_length=255)
    source_file = models.CharField(max_length=512)
    source_url = models.CharField(max_length=1024, blank=True, null=True)
    mask_file = models.CharField(max_length=512)
    mask_url = models.CharField(max_length=1024, blank=True, null=True)
    mask_model_key = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='Modèle ayant produit le masque courant (vide = modèle du run à la création).',
    )
    review_status = models.CharField(
        max_length=16,
        choices=ReviewStatus.choices,
        default=ReviewStatus.VALIDATED,
        db_index=True,
    )
    prior_mask_file = models.CharField(max_length=512, blank=True, default='')
    prior_mask_url = models.CharField(max_length=1024, blank=True, null=True)
    prior_mask_model_key = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='Modèle du masque archivé avant la dernière relance (nnU-Net / SwinUNETR / etc.).',
    )
    initial_mask_file = models.CharField(max_length=512, blank=True, default='')
    initial_mask_url = models.CharField(max_length=1024, blank=True, null=True)
    initial_mask_model_key = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='Masque du premier lancement (Modèle 1), conservé comme référence permanente.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['slice_index', 'id']

    def __str__(self):
        return f"Mask #{self.id} - Run {self.run_id} - MRIFile {self.mri_file_id}"


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



class UserSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    settings = models.JSONField(default=default_user_settings)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.user.username}"

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
