# backend_django/api/urls.py - VERSION COMPLÈTE MISE À JOUR
from django.urls import path
from . import views
from . import volume_api

urlpatterns = [
    # Auth routes
    path('register', views.register, name='register'),
    path('login', views.login_view, name='login'),
    path('emergency_login', views.emergency_login, name='emergency_login'),
    path('emergency_check', views.check_emergency_limit, name='emergency_check'),
    path('logout', views.logout_view, name='logout'),
    path('check_session', views.check_session, name='check_session'),
    path('forgot_password', views.forgot_password, name='forgot_password'),
    path('validate_reset_token', views.validate_reset_token, name='validate_reset_token'),
    path('reset_password', views.reset_password, name='reset_password'),

    # Upload routes
    path('upload', views.upload, name='upload'),
    path('upload_series', views.upload_series, name='upload_series'),
    path('viewer/orientation/save/', views.save_orientation, name='orientation_save'),
    path('viewer/orientation/<int:patient_id>/', views.load_orientation, name='orientation_load'),
    path('viewer/upload/', views.viewer_upload_image, name='viewer_upload_image'),

    # Alignment routes
    path('align', views.align, name='align'),
    path('auto-align', views.auto_align, name='auto_align'),
    path('job/<str:job_id>/tform', views.get_job_tform, name='job_tform'),

    # 3D Volume routes
    path('volume/atlas_slice', volume_api.get_atlas_slice, name='get_atlas_slice'),
    path('volume/upload-atlas', volume_api.upload_atlas, name='upload_atlas'),
    path('volume/use-official-atlas', volume_api.use_official_atlas, name='use_official_atlas'),
    path('volume/slice', volume_api.get_volume_slice, name='get_volume_slice'),
    path('volume/upload', volume_api.upload_volume, name='upload_volume'),
    path('volume/get-slice', volume_api.get_slice, name='get_slice'),
    path('volume/confirm-slice', volume_api.confirm_slice, name='confirm_slice'),
    path('volume/load-demo', volume_api.load_demo_patient, name='load_demo_patient'),
    path('volume/patient_slice', volume_api.get_patient_slice, name='get_patient_slice'),
    path('volume/brodmann', volume_api.get_brodmann_zone, name='get_brodmann_zone'),
    path('volume/cortical-zones', volume_api.get_cortical_zones, name='get_cortical_zones'),
    path('volume/auto-align', volume_api.auto_align_volume, name='auto_align_volume'),
    path('volume/manual-align', volume_api.manual_align_volume, name='manual_align_volume'),
    path('volume/validate-registration', volume_api.validate_volume_registration, name='validate_volume_registration'),
    path('volume/reject-registration', volume_api.reject_volume_registration, name='reject_volume_registration'),
    path('volume/viewer', volume_api.slice_viewer_page, name='slice_viewer_page'),

    # Preprocessing route
    path('preprocess', views.preprocess_image, name='preprocess'),

    # Apply transformation route
    path('apply_tform', views.apply_tform_to_series, name='apply_tform'),

    # History routes
    path('history', views.history, name='history'),

    # Patient routes (Yesmine - anciennes)
    path('patients', views.list_patients, name='patients'),
    path('patient/<str:patient_id>/series', views.get_patient_series, name='patient_series'),
    path('patient/<str:patient_id>/download', views.download_patient, name='download_patient'),
    path('patient/<str:patient_id>', views.delete_patient, name='delete_patient'),

    # Patient routes (Nadine - DRF style)
    path('patients/', views.patients_list_create, name='patients_list_create'),
    path('patients/<uuid:patient_id>/', views.patient_detail_update_delete, name='patient_detail_update_delete'),
    path('patients/<uuid:patient_id>/mri-files/', views.mri_files_list_upload, name='mri_files_list_upload'),

    # Reclamation routes
    path('reclamations/', views.reclamations_list_create, name='reclamations_list_create'),
    path('reclamations/<int:reclamation_id>/', views.reclamation_detail, name='reclamation_detail'),

    # Series routes
    path('series/<int:series_id>/download', views.download_series, name='download_series'),
    path('delete_series', views.delete_series, name='delete_series'),

    # File routes
    path('patient_file', views.patient_file, name='patient_file'),
    path('brain_transform', views.brain_transform, name='brain_transform'),

    # Brodmann projection route
    path('project_brodmann', views.project_brodmann, name='project_brodmann'),
]