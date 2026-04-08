from django.urls import path
from . import views

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
    path('profile/', views.profile_view, name='profile'),
    path('user-settings/', views.user_settings_view, name='user_settings'),
    path('profile/change-password/', views.change_password_view, name='change_password'),

    # Upload routes
    path('upload', views.upload, name='upload'),
    path('upload_series', views.upload_series, name='upload_series'),

    # Alignment routes
    path('align', views.align, name='align'),
    path('auto-align', views.auto_align, name='auto_align'),
    path('job/<str:job_id>/tform', views.get_job_tform, name='job_tform'),

    # Preprocessing route
    path('preprocess', views.preprocess_image, name='preprocess'),

    # Apply transformation route
    path('apply_tform', views.apply_tform_to_series, name='apply_tform'),

    # History routes
    path('history', views.history, name='history'),

    # Patient routes
    path('patients/', views.patients_list_create, name='patients_list_create'),
    path('patients/<int:patient_id>/', views.patient_detail_update_delete, name='patient_detail_update_delete'),
    path('patients/<int:patient_id>/mri-files/', views.mri_files_list_upload, name='mri_files_list_upload'),
    path('mri-files/<int:file_id>/preview/', views.mri_file_preview, name='mri_file_preview'),
    path('patients/<int:patient_id>/segment/', views.launch_patient_segmentation, name='launch_patient_segmentation'),
    path('segmentation-runs/', views.segmentation_runs_list, name='segmentation_runs_list'),
    path('segmentation-runs/<int:run_id>/', views.segmentation_run_detail, name='segmentation_run_detail'),
    path('segmentation-runs/<int:run_id>/modelisation-3d/', views.segmentation_run_modelisation_3d, name='segmentation_run_modelisation_3d'),
    path('segmentation-runs/<int:run_id>/report-pdf/', views.segmentation_run_report_pdf, name='segmentation_run_report_pdf'),
    path('patients/<int:patient_id>/download-zip/', views.patient_files_download_zip, name='patient_files_download_zip'),

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