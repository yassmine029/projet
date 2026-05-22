import os
import sys
from pathlib import Path
from dotenv import load_dotenv

if sys.platform == 'win32':
    os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
# En dev, réutiliser frontend/.env pour VITE_ADMIN_DASHBOARD_* (portail admin SPA)
_frontend_env = BASE_DIR.parent / 'frontend' / '.env'
if _frontend_env.is_file():
    load_dotenv(_frontend_env)

_secret_key = os.getenv('SECRET_KEY', '')
if not _secret_key:
    raise RuntimeError(
        "SECRET_KEY non défini. Ajoutez SECRET_KEY=<valeur aléatoire> dans votre fichier .env."
    )
SECRET_KEY = _secret_key

DEBUG = os.getenv('DEBUG', '0') == '1'

# En production, définir ALLOWED_HOSTS dans .env sans joker '*'.
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost 127.0.0.1 testserver').split()

INSTALLED_APPS = [
    # ASGI / WebSockets (recalage progression temps réel) — doit précéder staticfiles pour runserver
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'channels',
    'django_extensions',
    'api',
    'django.contrib.postgres',
]

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    # Backend minimal réservé aux sessions d'urgence (ne peut pas initier de session normale).
    'api.emergency_backend.EmergencyOnlyBackend',
]

# Augmenté pour les imports de dossiers DICOM (séries > 100 fichiers)
DATA_UPLOAD_MAX_NUMBER_FILES = 10000
DATA_UPLOAD_MAX_MEMORY_SIZE = 524288000  # 500 MB

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend_django.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend_django.wsgi.application'
# Requis pour WebSockets (/ws/registration/...) — sans cela, le proxy Vite coupe avec ECONNRESET
ASGI_APPLICATION = 'backend_django.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'postgres'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'OPTIONS': {
            'client_encoding': 'UTF8',
        }
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True

STATIC_URL = '/static/'

MEDIA_ROOT = os.getenv('MEDIA_ROOT', str(Path.home() / 'recalage_uploads'))
os.makedirs(MEDIA_ROOT, exist_ok=True)
MEDIA_URL = '/media/'

# Ne pas combiner ALLOW_ALL_ORIGINS + CREDENTIALS : le navigateur refuse les cookies de session.
CORS_ALLOW_ALL_ORIGINS = False


def _local_frontend_origins():
    """Vite prend 5174, 5175… si 5173 est pris ; preview souvent 4173."""
    out = []
    for host in ('localhost', '127.0.0.1'):
        for port in (3000, 4173, 4174, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180):
            out.append(f'http://{host}:{port}')
    return out


CORS_ALLOWED_ORIGINS = _local_frontend_origins()

CORS_ALLOW_CREDENTIALS = True

# Requis pour les POST avec session depuis le front (Django 4+)
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# Session cookie : rester cohérent avec l'URL du front (préférer http://localhost:5173, pas 127.0.0.1 mélangé).
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', '0') == '1'
SESSION_SAVE_EVERY_REQUEST = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-registration-metrics',
]

CORS_EXPOSE_HEADERS = [
    'x-registration-metrics',
    'content-disposition',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'login': '10/min',
        'auth': '5/min',
    },
}

DATA_UPLOAD_MAX_NUMBER_FILES = 10000
DATA_UPLOAD_MAX_MEMORY_SIZE = 10737418240

# Email Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@visionmed.com')

# Frontend URL (for password reset links)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# ONNX model configuration
UNETPP_MODEL_PATH = os.getenv('UNETPP_MODEL_PATH', str(BASE_DIR / 'models' / 'unetpp.onnx'))
SWINUNETR_MODEL_PATH = os.getenv('SWINUNETR_MODEL_PATH', str(BASE_DIR / 'models' / 'swinunetr_best_fold1.onnx'))
_nnunet_final_default = str(BASE_DIR / 'models' / 'nnunet_fold0_final_2026-04-05.onnx')
_nnunet_v2_default = str(BASE_DIR / 'models' / 'nnunet_fold0_v2.onnx')
_nnunet_legacy_default = str(BASE_DIR / 'models' / 'model_fold0_2d.onnx')
NNUNET_MODEL_PATH = (
    os.getenv('NNUNET_MODEL_PATH')
    or (_nnunet_final_default if os.path.exists(_nnunet_final_default) else None)
    or (_nnunet_v2_default if os.path.exists(_nnunet_v2_default) else None)
    or _nnunet_legacy_default
)

# Recalage MINE (2D + 3D) : si True, aucun repli CPU — erreur explicite sans CUDA/MPS.
# Défaut 1 (GPU obligatoire). Mettre MINE_FORCE_GPU=0 pour autoriser le CPU (dev sans GPU).
MINE_FORCE_GPU = os.getenv('MINE_FORCE_GPU', '1').strip().lower() in ('1', 'true', 'yes')

# Carte des régions pour l'identification et les intensités : api.official_atlas (Nilearn, Harvard–Oxford).
# Sujet de référence d'intensité (une seule exécution du script runscript).
REFERENCE_INTENSITY_NIFTI_SOURCE = os.getenv(
    'REFERENCE_INTENSITY_NIFTI_SOURCE',
    r'C:\Users\yassm\Desktop\donnée 3d\registration 3d\sujet1.nii',
)
REFERENCE_INTENSITY_NOM = os.getenv('REFERENCE_INTENSITY_NOM', 'sujet1')
