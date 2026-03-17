# backend_django/api/urls.py - VERSION COMPLÈTE MISE À JOUR
# Remplacez votre fichier api/urls.py par celui-ci

from django.urls import path
from . import views

urlpatterns = [
    # Auth routes
    path('register', views.register, name='register'),
    path('login', views.login_view, name='login'),
    path('logout', views.logout_view, name='logout'),
    path('check_session', views.check_session, name='check_session'),
    
    # Upload routes
    path('upload', views.upload, name='upload'),
    path('upload_series', views.upload_series, name='upload_series'),
    
    # Alignment routes
    path('align', views.align, name='align'),
    path('auto-align', views.auto_align, name='auto_align'),
    path('job/<str:job_id>/tform', views.get_job_tform, name='job_tform'),
    
    # Preprocessing route (NOUVEAU)
    path('preprocess', views.preprocess_image, name='preprocess'),
    
    # Apply transformation route (NOUVEAU)
    path('apply_tform', views.apply_tform_to_series, name='apply_tform'),
    
    # History routes
    path('history', views.history, name='history'),
    
    # Patient routes
    path('patients', views.list_patients, name='patients'),
    path('patient/<str:patient_id>/series', views.get_patient_series, name='patient_series'),
    path('patient/<str:patient_id>/download', views.download_patient, name='download_patient'),  # NOUVEAU
    path('patient/<str:patient_id>', views.delete_patient, name='delete_patient'),  # NOUVEAU
    
    # Series routes
    path('series/<int:series_id>/download', views.download_series, name='download_series'),  # NOUVEAU
    path('delete_series', views.delete_series, name='delete_series'),
    
    # File routes
    path('patient_file', views.patient_file, name='patient_file'),
    path('brain_transform', views.brain_transform, name='brain_transform'),
    
    # Brodmann projection route
    path('project_brodmann', views.project_brodmann, name='project_brodmann'),
]

