from rest_framework import serializers
from django.contrib.auth.models import User
<<<<<<< HEAD
from .models import (
    Series,
    Average,
    Reclamation,
    Patient,
    MRIFile,
    SegmentationRun,
    SegmentationMaskResult,
)
=======
from .models import Series, Average, PatientImageOrientation, PatientImage, Reclamation, Patient, MRIFile, ContactRequest
>>>>>>> origin/yesmine


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username')


class SeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Series
        fields = ('id', 'job_id', 'patient_id', 'user', 'files', 'created_at')


class AverageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Average
        fields = ('id', 'name', 'files', 'created_at')


# ✅ Tes serializers (Yesmine)
class OrientationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientImageOrientation
        fields = ["id", "patient_id", "rotation", "flip_h", "flip_v", "updated_at"]
        read_only_fields = ["id", "updated_at"]

    def validate_rotation(self, value):
        if not (-180 <= int(value) <= 180):
            raise serializers.ValidationError("rotation doit etre entre -180 et 180.")
        return int(value)


class PatientImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = PatientImage
        fields = ["id", "patient_id", "image_url", "uploaded_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


# ✅ Serializers de Nadine
class PatientSerializer(serializers.ModelSerializer):
    patient_id = serializers.IntegerField(source='id', read_only=True)
    num_dossier = serializers.CharField(source='dossier_number', read_only=True)
    mri_files = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Patient
<<<<<<< HEAD
        fields = (
            'id', 'patient_id', 'dossier_number', 'num_dossier', 'nom', 'prenom', 'date_naissance', 'sexe',
            'telephone', 'email', 'pathologie', 'stade', 'antecedents', 'notes',
            'autres_maladies', 'doctor', 'created_at', 'mri_files'
        )
        # dossier_number is included by default as it is in fields
=======
        fields = ('id', 'dossier_number', 'nom', 'prenom', 'date_naissance', 'sexe', 'autres_maladies', 'doctor', 'created_at')
>>>>>>> origin/yesmine
        read_only_fields = ('id', 'doctor', 'created_at')

    def get_mri_files(self, obj):
        files = obj.mri_files.all().order_by('-uploaded_at')
        return MRIFileSerializer(files, many=True, context=self.context).data


class MRIFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField(read_only=True)
    preview_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MRIFile
        fields = ('id', 'patient', 'file', 'file_url', 'preview_url', 'original_filename', 'relative_path', 'file_size', 'uploaded_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

    def get_preview_url(self, obj):
        request = self.context.get('request')
        url = f'/api/mri-files/{obj.id}/preview/'
        if request:
            return request.build_absolute_uri(url)
        return url


class SegmentationMaskResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentationMaskResult
        fields = (
            'id',
            'slice_index',
            'mri_file',
            'source_filename',
            'source_file',
            'source_url',
            'mask_file',
            'mask_url',
            'created_at',
        )


class SegmentationRunSerializer(serializers.ModelSerializer):
    results = SegmentationMaskResultSerializer(many=True, read_only=True)
    model_version = serializers.SerializerMethodField(read_only=True)

    def get_model_version(self, obj):
        key = str(getattr(obj, 'model_key', '') or '').strip().lower()
        if key == 'nnunet':
            return 'nnU-Net fold0 2D ONNX'
        if key == 'unetpp':
            return 'U-Net++ ONNX'
        if key == 'swinunetr':
            return 'SwinUNETR ONNX'
        return key or 'Modele inconnu'

    class Meta:
        model = SegmentationRun
        fields = (
            'id',
            'patient',
            'doctor',
            'model_key',
            'model_version',
            'threshold',
            'selected_count',
            'processed_count',
            'status',
            'error_message',
            'created_at',
            'completed_at',
            'results',
        )


class ReclamationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reclamation
        fields = '__all__'


<<<<<<< HEAD
class ProfileSerializer(serializers.Serializer):
    firstName = serializers.CharField(required=False, allow_blank=True)
    lastName = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    birthDate = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    nationality = serializers.CharField(required=False, allow_blank=True)
    cin = serializers.CharField(required=False, allow_blank=True)
    specialty = serializers.CharField(required=False, allow_blank=True)
    subSpecialty = serializers.CharField(required=False, allow_blank=True)
    institution = serializers.CharField(required=False, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    orderNumber = serializers.CharField(required=False, allow_blank=True)
    experienceYears = serializers.IntegerField(required=False)
    languages = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    bio = serializers.CharField(required=False, allow_blank=True)


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=True)
    newPassword = serializers.CharField(required=True)
    confirmPassword = serializers.CharField(required=True)


class UserSettingsSerializer(serializers.Serializer):
    general = serializers.DictField(required=False)
    viewer = serializers.DictField(required=False)
    workflow = serializers.DictField(required=False)
    notifications = serializers.DictField(required=False)
    security = serializers.DictField(required=False)
    integrations = serializers.DictField(required=False)
=======
class ContactRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactRequest
        fields = ('id', 'full_name', 'email', 'institution', 'subject', 'message', 'created_at')
        read_only_fields = ('id', 'created_at')
>>>>>>> origin/yesmine
