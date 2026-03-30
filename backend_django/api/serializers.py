from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Series, Average, Reclamation, Patient, MRIFile


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


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ('id', 'dossier_number', 'nom', 'prenom', 'date_naissance', 'sexe', 'autres_maladies', 'doctor', 'created_at')
        # dossier_number is included by default as it is in fields
        read_only_fields = ('id', 'doctor', 'created_at')


class MRIFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MRIFile
        fields = '__all__'


class ReclamationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reclamation
        fields = '__all__'