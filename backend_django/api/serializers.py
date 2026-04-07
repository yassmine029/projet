from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Series, Average, PatientImageOrientation, PatientImage, Reclamation, Patient, MRIFile, ContactRequest


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
    class Meta:
        model = Patient
        fields = ('id', 'dossier_number', 'nom', 'prenom', 'date_naissance', 'sexe', 'autres_maladies', 'doctor', 'created_at')
        read_only_fields = ('id', 'doctor', 'created_at')


class MRIFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MRIFile
        fields = '__all__'


class ReclamationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reclamation
        fields = '__all__'


class ContactRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactRequest
        fields = ('id', 'full_name', 'email', 'institution', 'subject', 'message', 'created_at')
        read_only_fields = ('id', 'created_at')