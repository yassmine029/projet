from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Series, Average


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
