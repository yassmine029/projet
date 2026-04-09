import os
import io
import sys
import mimetypes
import posixpath
import zipfile
import tempfile
import shutil
import json
import smtplib
import uuid
import base64
import threading
import textwrap
from datetime import datetime
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404, Http404
from django.core.validators import RegexValidator
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated

import numpy as np
import cv2
from PIL import Image, ImageOps
from PIL import ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage

from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
# from django.core.paginator import Paginator # Not used, can be removed
from django.db.models import Q
from .models import (
    Series,
    PasswordResetToken,
    EmergencyLoginAttempt,
    Patient,
    Reclamation,
    MRIFile,
    UserSettings,
    default_user_settings,
    ContactRequest,
    PatientImage,
    PatientImageOrientation,
    SegmentationRun,
    SegmentationMaskResult,
)
from .serializers import (
    ReclamationSerializer, PatientSerializer, MRIFileSerializer, SegmentationRunSerializer,
    ProfileSerializer, ChangePasswordSerializer, UserSettingsSerializer, ContactRequestSerializer,
    PatientImageSerializer, OrientationSerializer
)
# auto_registration (ANTs) supprimé — MINE uniquement
from .mine_registration import run_mine_registration
from .segmentation_inference import run_segmentation_on_files
from .modelisation_3d import run_modelisation_3d, parse_spacing, parse_reference_values

# Setup logging - just flush stdout for real-time output
sys.stdout.flush()
sys.stderr.flush()

# In-memory JOBS like original app
JOBS = {}

UPLOAD_DIR = settings.MEDIA_ROOT
MEDIA_ROOT = settings.MEDIA_ROOT
os.makedirs(UPLOAD_DIR, exist_ok=True)


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return


def send_email_async(subject, message, from_email, recipient_list, html_message=None):
    """Send email in a background thread to avoid blocking HTTP response"""
    def _send():
        try:
            print(f"Nadine Yassmine - [ASYNC EMAIL] Starting send to {recipient_list}", flush=True)
            sys.stdout.flush()
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=recipient_list,
                html_message=html_message,
                fail_silently=False
            )
            print(f"Nadine Yassmine - [ASYNC EMAIL] Success to {recipient_list}", flush=True)
            sys.stdout.flush()
        except Exception as e:
            print(f"Nadine Yassmine - [ASYNC EMAIL] Failed to {recipient_list}: {str(e)}", flush=True)
            import traceback
            print(f"Nadine Yassmine - [ASYNC EMAIL] traceback: {traceback.format_exc()}", flush=True)
            sys.stdout.flush()
    
    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
    print(f"Nadine Yassmine - [ASYNC EMAIL] Thread started for {recipient_list}", flush=True)
    sys.stdout.flush()



def make_preview(path, size=(512, 512)):
    img = Image.open(path).convert('L').resize(size, Image.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('ascii')


def read_gray_image(path):
    """
    Read an image as grayscale while honoring EXIF orientation (browser-like).
    Falls back to OpenCV if PIL fails.
    """
    try:
        im = Image.open(path)
        im = ImageOps.exif_transpose(im)
        im = im.convert('L')
        return np.array(im)
    except Exception:
        return cv2.imread(path, cv2.IMREAD_GRAYSCALE)


def procrustes(X, Y, scaling=True, reflection='best'):
    X = np.asarray(X, dtype=np.float64)
    Y = np.asarray(Y, dtype=np.float64)
    muX, muY = X.mean(0), Y.mean(0)
    X0, Y0 = X - muX, Y - muY
    normX, normY = np.sqrt((X0**2.).sum()), np.sqrt((Y0**2.).sum())
    X0, Y0 = X0 / normX, Y0 / normY
    A = np.dot(X0.T, Y0)
    U, s, Vt = np.linalg.svd(A, full_matrices=False)
    V, T = Vt.T, np.dot(Vt.T, U.T)
    traceTA = s.sum()
    b = traceTA * normX / normY if scaling else 1.0
    Z = normX * traceTA * np.dot(Y0, T) + muX
    c = muX - b * np.dot(muY, T)
    tform = {"rotation": T.tolist(), "scale": float(b), "translation": c.tolist()}
    return None, Z, tform


def affine_from_tform(tform):
    T = np.array(tform["rotation"], dtype=np.float64)
    b = float(tform["scale"])
    c = np.array(tform["translation"], dtype=np.float64)
    M = np.zeros((2, 3), dtype=np.float32)
    M[:, :2] = (b * T).T
    M[:, 2] = c
    return M


def select_brain_candidate(img):
    if img is None:
        return None
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    kernel = np.ones((5, 5), np.uint8)

    def clean_mask(bm):
        m = cv2.morphologyEx(bm, cv2.MORPH_CLOSE, kernel)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel)
        return m

    def score_mask(bm):
        contours, _ = cv2.findContours(bm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        cnt = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(cnt)
        if area <= 1:
            return None
        x, y, w, h = cv2.boundingRect(cnt)
        if w <= 1 or h <= 1:
            return None
        m = cv2.moments(bm, binaryImage=True)
        if m["m00"] > 0:
            cx = m["m10"] / m["m00"]
            cy = m["m01"] / m["m00"]
        else:
            cx = x + w / 2.0
            cy = y + h / 2.0
        ih, iw = img.shape[:2]
        dx = (cx - iw / 2.0) / max(1.0, iw / 2.0)
        dy = (cy - ih / 2.0) / max(1.0, ih / 2.0)
        dist = np.sqrt(dx * dx + dy * dy)
        border_touch = (x <= 1 or y <= 1 or x + w >= iw - 2 or y + h >= ih - 2)
        area_frac = area / float(iw * ih)
        ar = max(w / float(h), h / float(w))
        score = area * (1.0 - min(dist, 1.0)) * (0.1 if border_touch else 1.0) * (0.6 if ar > 4.0 else 1.0)
        return {
            "score": score,
            "area_frac": area_frac,
            "bbox": (x, y, w, h),
            "center": (cx, cy),
            "mask": bm,
        }

    _, bin1 = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bin2 = cv2.bitwise_not(bin1)

    blur = cv2.GaussianBlur(img, (5, 5), 0)
    adap = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 31, 3)
    adap_inv = cv2.bitwise_not(adap)

    med = float(np.median(img))
    mad = float(np.median(np.abs(img - med))) + 1.0
    dev = (np.abs(img - med) > (2.0 * mad)).astype(np.uint8) * 255

    gx = cv2.Sobel(blur, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(blur, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    thr = np.percentile(mag, 75)
    grad = (mag > thr).astype(np.uint8) * 255

    edges = cv2.Canny(blur, 30, 100)
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    filled = edges.copy()
    h2, w2 = filled.shape[:2]
    flood = filled.copy()
    cv2.floodFill(flood, np.zeros((h2 + 2, w2 + 2), np.uint8), (0, 0), 255)
    flood_inv = cv2.bitwise_not(flood)
    canny_mask = filled | flood_inv

    masks = [
        clean_mask(bin1),
        clean_mask(bin2),
        clean_mask(adap),
        clean_mask(adap_inv),
        clean_mask(dev),
        clean_mask(grad),
        clean_mask(canny_mask),
    ]

    scores = [score_mask(m) for m in masks]

    def is_reasonable(s):
        return s and s["area_frac"] > 0.001 and s["area_frac"] < 0.60

    cand = None
    reasonable = [s for s in scores if is_reasonable(s)]
    if reasonable:
        cand = max(reasonable, key=lambda s: s["score"])
    else:
        cand = max([s for s in scores if s], key=lambda s: s["score"], default=None)

    return cand


def normalize_brain_image(img, out_size=(512, 512)):
    try:
        if img is None:
            return None
        if img.ndim == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        cand = select_brain_candidate(img)
        if not cand:
            return cv2.resize(img, out_size, interpolation=cv2.INTER_AREA)

        x, y, w, h = cand["bbox"]
        cx, cy = cand["center"]

        side = int(max(w, h) * 1.10)
        side = max(side, 8)
        x0 = int(round(cx - side / 2))
        y0 = int(round(cy - side / 2))
        x1 = x0 + side
        y1 = y0 + side
        ih, iw = img.shape[:2]
        x0 = max(0, x0)
        y0 = max(0, y0)
        x1 = min(iw, x1)
        y1 = min(ih, y1)
        crop = img[y0:y1, x0:x1]
        if crop.size == 0:
            return cv2.resize(img, out_size, interpolation=cv2.INTER_AREA)
        return cv2.resize(crop, out_size, interpolation=cv2.INTER_AREA)
    except Exception:
        return cv2.resize(img, out_size, interpolation=cv2.INTER_AREA) if img is not None else None


def brain_normalize(img, out_size=(512, 512)):
    if img is None:
        return None, None, None
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    ih, iw = img.shape[:2]
    out_w, out_h = int(out_size[0]), int(out_size[1])

    cand = select_brain_candidate(img)
    if not cand:
        norm_img = cv2.resize(img, (out_w, out_h), interpolation=cv2.INTER_AREA)
        meta = {
            'x0': 0, 'y0': 0, 'x1': int(iw), 'y1': int(ih),
            'in_w': int(iw), 'in_h': int(ih),
            'out_w': out_w, 'out_h': out_h,
            'found': False,
        }
        return norm_img, None, meta

    mask = cand["mask"]
    x, y, w, h = cand["bbox"]
    cx, cy = cand["center"]

    side = int(max(w, h) * 1.10)
    side = max(side, 8)
    x0 = int(round(cx - side / 2))
    y0 = int(round(cy - side / 2))
    x1 = x0 + side
    y1 = y0 + side

    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(iw, x1)
    y1 = min(ih, y1)

    crop_img = img[y0:y1, x0:x1]
    crop_mask = mask[y0:y1, x0:x1]
    if crop_img.size == 0:
        norm_img = cv2.resize(img, (out_w, out_h), interpolation=cv2.INTER_AREA)
        meta = {
            'x0': 0, 'y0': 0, 'x1': int(iw), 'y1': int(ih),
            'in_w': int(iw), 'in_h': int(ih),
            'out_w': out_w, 'out_h': out_h,
            'found': False,
        }
        return norm_img, None, meta

    norm_img = cv2.resize(crop_img, (out_w, out_h), interpolation=cv2.INTER_AREA)
    norm_mask = cv2.resize(crop_mask, (out_w, out_h), interpolation=cv2.INTER_NEAREST)
    norm_mask = (norm_mask > 0).astype(np.uint8) * 255
    meta = {
        'x0': int(x0), 'y0': int(y0), 'x1': int(x1), 'y1': int(y1),
        'in_w': int(iw), 'in_h': int(ih),
        'out_w': out_w, 'out_h': out_h,
        'found': True,
    }
    return norm_img, norm_mask, meta


@api_view(["POST"])
def save_orientation(request):
    patient_id = request.data.get("patient_id")
    if not patient_id:
        return Response({"error": "patient_id est requis."}, status=status.HTTP_400_BAD_REQUEST)

    instance, _ = PatientImageOrientation.objects.get_or_create(patient_id=int(patient_id))
    serializer = OrientationSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def load_orientation(request, patient_id):
    try:
        instance = PatientImageOrientation.objects.get(patient_id=patient_id)
    except PatientImageOrientation.DoesNotExist:
        return Response({"detail": "Aucune orientation trouvee."}, status=status.HTTP_404_NOT_FOUND)

    serializer = OrientationSerializer(instance)
    return Response(serializer.data)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def viewer_upload_image(request):
    patient_id = request.data.get("patient_id")
    image_file = request.FILES.get("image")

    if not patient_id:
        return Response({"error": "patient_id est requis."}, status=status.HTTP_400_BAD_REQUEST)
    if not image_file:
        return Response({"error": "Aucun fichier image fourni."}, status=status.HTTP_400_BAD_REQUEST)

    obj = PatientImage.objects.create(patient_id=int(patient_id), image=image_file)
    serializer = PatientImageSerializer(obj, context={"request": request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def _mask_sdf01(mask_u8):
    m = (mask_u8 > 0).astype(np.uint8)
    dist_in = cv2.distanceTransform(m, cv2.DIST_L2, 3)
    dist_out = cv2.distanceTransform(1 - m, cv2.DIST_L2, 3)
    sdf = dist_in - dist_out
    denom = float(np.max(np.abs(sdf)) + 1e-6)
    sdf = sdf / denom
    sdf01 = (sdf + 1.0) * 0.5
    return sdf01.astype(np.float32)


def _ecc_affine(template_f32, input_f32, max_iter=400, eps=1e-5):
    warp = np.eye(2, 3, dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, int(max_iter), float(eps))
    try:
        _, warp = cv2.findTransformECC(template_f32, input_f32, warp, cv2.MOTION_AFFINE, criteria)
        return warp
    except Exception:
        return None


def _flood_mask_gray(img_u8, seed_x, seed_y, tol):
    h, w = img_u8.shape[:2]
    sx = int(max(0, min(w - 1, int(seed_x))))
    sy = int(max(0, min(h - 1, int(seed_y))))
    tol = int(max(0, min(255, int(tol))))
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    cv2.floodFill(img_u8.copy(), mask, (sx, sy), 0, (tol,), (tol,), flags)
    filled = mask[1:h + 1, 1:w + 1]
    return (filled > 0).astype(np.uint8) * 255


def _resolve_series_file_for_user(user, job_id, relpath):
    try:
        series = Series.objects.get(job_id=job_id, user=user)
    except Series.DoesNotExist:
        return None, None

    if not relpath:
        return series, None

    relpath = relpath.replace('\\', '/').lstrip('/')
    if series.files and relpath in series.files:
        return series, os.path.join(UPLOAD_DIR, relpath)

    candidate = os.path.normpath(os.path.join(UPLOAD_DIR, relpath))
    upload_root = os.path.normpath(UPLOAD_DIR)
    if candidate.startswith(upload_root + os.sep) and os.path.exists(candidate):
        return series, candidate

    return series, None


def _encode_png_b64(img_u8):
    ok, buf = cv2.imencode('.png', img_u8)
    if not ok:
        return None
    return base64.b64encode(buf.tobytes()).decode('ascii')


def _apply_preprocess_method(img_u8, method, intensity):
    method = (method or 'none').strip().lower()
    intensity = float(intensity) if intensity is not None else 1.0
    intensity = max(0.1, min(5.0, intensity))

    if method in ('none', ''):
        return img_u8
    if method in ('equalize',):
        return cv2.equalizeHist(img_u8)
    if method in ('normalize',):
        return cv2.normalize(img_u8, None, 0, 255, cv2.NORM_MINMAX)
    if method in ('blur', 'gaussian'):
        sigma = max(0.2, intensity * 1.2)
        out = cv2.GaussianBlur(img_u8, (0, 0), sigmaX=sigma, sigmaY=sigma)
        return np.clip(out, 0, 255).astype(np.uint8)
    if method in ('brightness',):
        beta = (intensity - 1.0) * 60.0
        return cv2.convertScaleAbs(img_u8, alpha=1.0, beta=beta)
    if method in ('contrast',):
        alpha = max(0.2, min(3.0, intensity))
        return cv2.convertScaleAbs(img_u8, alpha=alpha, beta=0)
    if method in ('sharpen',):
        base = cv2.GaussianBlur(img_u8, (0, 0), sigmaX=1.0)
        out = cv2.addWeighted(img_u8, 1.0 + intensity, base, -intensity, 0)
        return np.clip(out, 0, 255).astype(np.uint8)
    if method in ('edge',):
        t1 = int(max(10, 40 * intensity))
        t2 = int(max(t1 + 5, 120 * intensity))
        return cv2.Canny(img_u8, t1, t2)
    return img_u8


def _segmentation_model_label(model_key):
    key = str(model_key or '').strip().lower()
    if key == 'nnunet':
        return 'nnU-Net fold0 2D ONNX'
    if key == 'unetpp':
        return 'U-Net++ ONNX'
    if key == 'swinunetr':
        return 'SwinUNETR ONNX'
    return key or 'Modele inconnu'


def _safe_relative_path(raw_path, fallback_name):
    path = (raw_path or fallback_name or '').replace('\\', '/').strip()
    path = path.lstrip('/')
    if not path:
        return os.path.basename(fallback_name or 'file.bin')

    normalized = posixpath.normpath(path)
    if normalized in ('', '.'):
        normalized = os.path.basename(fallback_name or 'file.bin')
    if normalized.startswith('../') or normalized == '..':
        normalized = os.path.basename(fallback_name or 'file.bin')
    return normalized


def _next_dossier_number():
    year = timezone.now().year
    prefix = f"DOS-{year}-"
    seq = Patient.objects.filter(dossier_number__startswith=prefix).count() + 1
    while True:
        candidate = f"{prefix}{seq:04d}"
        if not Patient.objects.filter(dossier_number=candidate).exists():
            return candidate
        seq += 1


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    print(f"Yassmine now the register endpoint works - username: {data.get('username')}")
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    full_name = (data.get('fullName') or '').strip()
    email_input = (data.get('email') or '').strip()
    if not username or not password:
        print("Yassmine now the register validation FAILED - missing username or password")
        return JsonResponse({'ok': False, 'error': 'username and password required'}, status=400)

    try:
        with transaction.atomic():
            if User.objects.filter(username=username).exists():
                print(f"Yassmine now the register FAILED - username exists: {username}")
                return JsonResponse({'ok': False, 'error': 'username exists'}, status=400)
            name_parts = [part for part in full_name.split() if part]
            first_name = name_parts[0] if name_parts else ''
            last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

            username_is_email = '@' in username and '.' in username.split('@')[-1]
            email = email_input or (username if username_is_email else '')

            User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            print(f"Nadine Yassmine - register SUCCESS for user: {username}")
            return JsonResponse({'ok': True, 'message': 'Compte créé avec succès'})
    except IntegrityError as e:
        print(f"Yassmine now the register FAILED - IntegrityError for username: {username}, error: {str(e)}")
        return JsonResponse({'ok': False, 'error': 'username already exists'}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        print(f"Nadine Yassmine - login endpoint reached - body: {request.body}")
        data = json.loads(request.body)
        username = (data.get('username') or '').strip().lower()
        password = data.get('password') or ''
        print(f"Nadine Yassmine - login attempt - username: {username}")

        if not username or not password:
            return JsonResponse({'ok': False, 'error': 'email et mot de passe requis'}, status=400)

        # Accept either username or account email as login identifier.
        account = User.objects.filter(Q(username=username) | Q(email__iexact=username)).first()
        if account is None:
            print(f"Nadine Yassmine - login failed - account not found: {username}")
            return JsonResponse({'ok': False, 'error': 'Compte introuvable', 'error_type': 'user_not_found'}, status=401)

        user = authenticate(request, username=account.username, password=password)
        if user is None:
            print(f"Nadine Yassmine - login failed - invalid password for: {account.username}")
            return JsonResponse({'ok': False, 'error': 'Mot de passe incorrect', 'error_type': 'invalid_password'}, status=401)

        login(request, user)
        request.session['username'] = user.username
        print(f"Nadine Yassmine - login success - user: {user.username}")
        return JsonResponse({'ok': True, 'message': 'Connexion réussie', 'user': user.username})
    except Exception as e:
        import traceback
        print(f"Nadine Yassmine - Error in login: {e}")
        print(f"Nadine Yassmine - traceback: {traceback.format_exc()}")
        return JsonResponse({'ok': False, 'error': 'Internal Server Error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    print(f"Yassmine now the logout endpoint works")
    logout(request)
    request.session.flush()
    print(f"Yassmine now the logout SUCCESS")
    return JsonResponse({'message': 'Déconnecté avec succès'})


@api_view(['GET'])
def check_session(request):
    if request.user and request.user.is_authenticated:
        print(f"Yassmine now the check_session works - user: {request.user.username}")
        return JsonResponse({
            'logged_in': True, 
            'user': request.user.username,
            'is_staff': request.user.is_staff
        })
    print(f"Yassmine now the check_session works - no authenticated user")
    return JsonResponse({'logged_in': False})


@csrf_exempt
@require_http_methods(["POST"])
def upload(request):
    print(f"Yassmine now the upload endpoint REACHED - authenticated: {request.user.is_authenticated}, user: {request.user.username if request.user.is_authenticated else 'anonymous'}")
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the upload endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    ref = request.FILES.get('ref_image')
    pat = request.FILES.get('patient_image')
    patient_id = (request.POST.get('patient_id') or '').strip() or 'Unknown'
    print(f"Yassmine now the upload endpoint works - patient_id: {patient_id}, user: {request.user.username}, has_ref: {ref is not None}, has_pat: {pat is not None}")
    if not ref or not pat:
        print(f"Yassmine now the upload FAILED - missing files for patient_id: {patient_id}")
        return JsonResponse({'error': 'ref_image and patient_image required'}, status=400)
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    ref_path = os.path.join(job_dir, 'ref.png')
    pat_path = os.path.join(job_dir, 'patient.png')
    with open(ref_path, 'wb') as f:
        for chunk in ref.chunks():
            f.write(chunk)
    with open(pat_path, 'wb') as f:
        for chunk in pat.chunks():
            f.write(chunk)
    ref_rel = os.path.relpath(ref_path, UPLOAD_DIR).replace('\\', '/')
    pat_rel = os.path.relpath(pat_path, UPLOAD_DIR).replace('\\', '/')
    JOBS[job_id] = {'patient_id': patient_id, 'ref': ref_path, 'patient': pat_path, 'user': request.user.username}
    Series.objects.create(job_id=job_id, patient_id=patient_id, user=request.user, files=[ref_rel, pat_rel])
    print(f"Yassmine now the upload SUCCESS - job_id: {job_id}")
    return JsonResponse({'jobId': job_id, 'refPreview': make_preview(ref_path), 'patPreview': make_preview(pat_path)})


@csrf_exempt
@require_http_methods(["POST"])
def align(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the align endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        print(f"Yassmine now the align FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid JSON'}, status=400)
    job_id = data.get('jobId')
    X = data.get('ct_points')
    Y = data.get('pat_points')
    use_warped = data.get('use_warped', False)  # ✅ mode hybride: utiliser image MINE recalée
    print(f"Yassmine now the align endpoint works - job_id: {job_id}, use_warped: {use_warped}, user: {request.user.username}")
    if not job_id or X is None or Y is None:
        print(f"Yassmine now the align FAILED - missing data for job_id: {job_id}")
        return JsonResponse({'error': 'missing data'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
        if not series.files or len(series.files) < 2:
            print(f"Yassmine now the align FAILED - job files not found in DB: {job_id}")
            return JsonResponse({'error': 'job files not found'}, status=404)
        ref_path = os.path.join(UPLOAD_DIR, series.files[0])
        pat_path = os.path.join(UPLOAD_DIR, series.files[1])
        print(f"Yassmine now the align LOADED job from DB - job_id: {job_id}")
    except Series.DoesNotExist:
        print(f"Yassmine now the align FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    # ✅ Mode hybride: utiliser l'image déjà recalée par MINE comme point de départ
    # au lieu de l'image PET originale
    if use_warped:
        auto_dir = os.path.join(UPLOAD_DIR, 'auto_registration', job_id)
        warped_candidates = [f for f in os.listdir(auto_dir) if f.endswith('_warped.png')] if os.path.exists(auto_dir) else []
        if warped_candidates:
            mine_warped_path = os.path.join(auto_dir, sorted(warped_candidates)[-1])
            pat_path = mine_warped_path
            print(f"Yassmine HYBRID: using MINE warped image as base: {mine_warped_path}")
        else:
            print(f"Yassmine HYBRID: no warped image found, falling back to original")

    X = np.array(X, dtype=np.float64)
    Y = np.array(Y, dtype=np.float64)
    if X.shape != Y.shape or X.shape[0] < 3:
        print(f"Yassmine now the align FAILED - invalid points shape for job_id: {job_id}")
        return JsonResponse({'error': 'invalid points'}, status=400)

    ref = cv2.imread(ref_path, cv2.IMREAD_GRAYSCALE)
    pat = cv2.imread(pat_path, cv2.IMREAD_GRAYSCALE)
    if ref is None or pat is None:
        print(f"Yassmine now the align FAILED - cannot read images for job_id: {job_id}")
        return JsonResponse({'error': 'cannot read images'}, status=500)

    # Keep a fixed working canvas but scale clicked landmarks accordingly.
    # Frontend points are in original image pixel coordinates.
    ref_h0, ref_w0 = ref.shape[:2]
    pat_h0, pat_w0 = pat.shape[:2]
    target_w, target_h = 512, 512

    ref = cv2.resize(ref, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
    pat = cv2.resize(pat, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

    sx_ref = float(target_w) / float(max(ref_w0, 1))
    sy_ref = float(target_h) / float(max(ref_h0, 1))
    sx_pat = float(target_w) / float(max(pat_w0, 1))
    sy_pat = float(target_h) / float(max(pat_h0, 1))

    X_scaled = X.copy()
    Y_scaled = Y.copy()
    X_scaled[:, 0] *= sx_ref
    X_scaled[:, 1] *= sy_ref
    Y_scaled[:, 0] *= sx_pat
    Y_scaled[:, 1] *= sy_pat
    # ✅ RANSAC estimateAffinePartial2D — plus robuste que procrustes
    # ignore automatiquement les points mal placés (outliers)
    src_pts = Y_scaled.astype(np.float32)
    dst_pts = X_scaled.astype(np.float32)
    M, inliers = cv2.estimateAffinePartial2D(
        src_pts, dst_pts,
        method=cv2.RANSAC,
        ransacReprojThreshold=3,
        maxIters=2000,
        confidence=0.99
    )
    if M is None:
        # fallback procrustes si RANSAC échoue
        _, Z, tform = procrustes(X_scaled, Y_scaled)
        M = affine_from_tform(tform)
        inliers = None
        print(f"Yassmine RANSAC failed, fallback to procrustes for job_id: {job_id}")
    else:
        tform = {'M': M.tolist()}
        print(f"Yassmine RANSAC OK — inliers: {int(inliers.sum()) if inliers is not None else '?'} for job_id: {job_id}")

    warped = cv2.warpAffine(pat, M, (512, 512), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    JOBS[job_id]['tform'] = tform
    try:
        series.tform = tform
        series.save()
        print(f"Yassmine now the align SAVED tform to DB for job_id: {job_id}")
    except Exception as e:
        print(f"Yassmine now the align WARNING - failed to save tform: {str(e)}")

    fixed_float = ref.astype(np.float32)
    warped_float = warped.astype(np.float32)
    mse = np.mean((fixed_float - warped_float) ** 2)
    rmse = np.sqrt(mse)
    fixed_flat = fixed_float.flatten()
    warped_flat = warped_float.flatten()
    correlation = float(np.corrcoef(fixed_flat, warped_flat)[0, 1])
    if np.isnan(correlation) or np.isinf(correlation):
        correlation = 0.0
    max_val = float(max(fixed_float.max(), warped_float.max()))
    normalized_rmse = float(rmse / max_val) if max_val > 0 else 0.0
    quality_score = float((1.0 - normalized_rmse) * correlation)

    # ✅ MI précise via histogramme 64 bins (méthode identique à mine_registration.py)
    try:
        hist_2d, _, _ = np.histogram2d(
            fixed_float.flatten(), warped_float.flatten(), bins=64
        )
        pxy = hist_2d / float(hist_2d.sum())
        px  = np.sum(pxy, axis=1)
        py  = np.sum(pxy, axis=0)
        px_py = px[:, None] * py[None, :]
        nz = pxy > 0
        mi_approx = float(np.sum(pxy[nz] * np.log(pxy[nz] / px_py[nz])))
        if np.isnan(mi_approx) or np.isinf(mi_approx):
            mi_approx = 0.0
        mi_approx = round(min(0.6, max(0.0, mi_approx)), 4)
        if mi_approx > 0.5:
            mi_quality = 'Excellent'
        elif mi_approx > 0.3:
            mi_quality = 'Bon'
        else:
            mi_quality = 'Faible'
    except Exception:
        mi_approx = 0.0
        mi_quality = 'Faible'

    metrics = {
        'rmse': round(float(rmse), 4),
        'normalized_rmse': round(float(normalized_rmse), 4),
        'correlation': round(float(correlation), 4),
        'quality_score': round(float(quality_score), 4),
        'mutual_information': mi_approx,   # ✅ affiché dans la gauge
        'mi_quality': mi_quality,
        'success': True,
        'processing_time_ms': 0
    }

    _, buf = cv2.imencode('.png', warped)
    img_b64 = base64.b64encode(buf).decode('utf-8')
    img_data = f"data:image/png;base64,{img_b64}"

    print(f"Yassmine now the align SUCCESS - job_id: {job_id}, RMSE: {metrics['rmse']}")

    return JsonResponse({
        'success': True,
        'metrics': metrics,
        'image': img_data,
        'message': 'Recalage manuel réussi'
    })


@csrf_exempt
@require_http_methods(["POST"])
def auto_align(request):
    """Automatic image alignment using ANTs SyN algorithm or MINE"""
    try:
        if not request.user or not request.user.is_authenticated:
            print(f"Yassmine now the auto_align endpoint FAILED - not authenticated")
            return JsonResponse({'error': 'login required'}, status=401)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            print(f"Yassmine now the auto_align FAILED - invalid JSON")
            return JsonResponse({'error': 'invalid JSON'}, status=400)

        job_id = data.get('jobId')
        transform_type = data.get('transform', 'SyN')
        print(f"Yassmine now the auto_align endpoint works - job_id: {job_id}, transform: {transform_type}, user: {request.user.username}")

        if not job_id:
            print(f"Yassmine now the auto_align FAILED - missing jobId")
            return JsonResponse({'error': 'missing jobId'}, status=400)

        try:
            series = Series.objects.get(job_id=job_id, user=request.user)
            if not series.files or len(series.files) < 2:
                print(f"Yassmine now the auto_align FAILED - job files not found in DB: {job_id}")
                return JsonResponse({'error': 'job files not found'}, status=404)
            ref_path = os.path.join(UPLOAD_DIR, series.files[0])
            pat_path = os.path.join(UPLOAD_DIR, series.files[1])
            print(f"Yassmine now the auto_align LOADED job from DB - job_id: {job_id}")
        except Series.DoesNotExist:
            print(f"Yassmine now the auto_align FAILED - job not found: {job_id}")
            return JsonResponse({'error': 'job not found'}, status=404)

        if not os.path.exists(ref_path) or not os.path.exists(pat_path):
            print(f"Yassmine now the auto_align FAILED - image files not found on disk")
            return JsonResponse({'error': 'image files not found'}, status=404)

        job_dir = os.path.join(UPLOAD_DIR, job_id)
        auto_dir = os.path.join(job_dir, 'auto_registration')

        # ✅ Seul algorithme supporté : MINE (Deep Learning)
        # ANTs supprimé — MINE est plus adapté pour recalage multimodal IRM/PET
        print(f"Yassmine: Starting MINE registration for job {job_id}...")
        os.makedirs(auto_dir, exist_ok=True)
        print(f"AUTO DIR created: {auto_dir}")
        result = run_mine_registration(
            ref_path,
            pat_path,
            os.path.join(auto_dir, f"mine_{job_id}"),
            n_iters=300,
            device_name="auto"
        )

        if not result.get('success', False):
            print(f"Yassmine now the auto_align FAILED - MINE failed")
            return JsonResponse({
                'error': 'alignment failed',
                'message': 'Le recalage MINE a échoué',
            }, status=400)

        warped_path = result['warped_path']
        transform_path = result['transform_path']
        if True:  # bloc conservé pour structure

            try:
                # ✅ Métrique principale : Information Mutuelle (MI)
                # C'est la seule métrique valide pour recalage multimodal IRM/PET
                final_mi = result.get('mutual_information', 0.0)

                # Interprétation de la MI :
                # MI > 0.5  → excellent recalage
                # MI 0.3-0.5 → bon recalage
                # MI < 0.3  → recalage faible
                if final_mi > 0.5:
                    mi_quality = "Excellent"
                    mi_score = min(1.0, final_mi / 0.6)
                elif final_mi > 0.3:
                    mi_quality = "Bon"
                    mi_score = final_mi / 0.6
                else:
                    mi_quality = "Faible"
                    mi_score = final_mi / 0.6

                if np.isnan(final_mi) or np.isinf(final_mi):
                    final_mi = 0.0
                    mi_quality = "Faible"
                    mi_score = 0.0

                metrics = {
                    'mutual_information': round(float(final_mi), 4),
                    'mi_quality': mi_quality,
                    'quality_score': round(float(mi_score), 4),
                    'processing_time_ms': round(float(result['processing_time'] * 1000), 2),
                    'device': result['device'],
                    'success': True,
                }
                print(f"Yassmine: MI = {final_mi:.4f} ({mi_quality})")
            except Exception as e:
                print(f"Yassmine: Failed to calculate metrics for MINE: {str(e)}")
                metrics = {
                    'success': True,
                    'mutual_information': result.get('mutual_information', 0.0),
                    'processing_time_ms': round(result['processing_time'] * 1000, 2),
                    'device': result['device']
                }
        # (ANTs supprimé)

        if not metrics.get('success', False):
            print(f"Yassmine now the auto_align FAILED - alignment failed: {metrics.get('error')}")
            return JsonResponse({
                'error': metrics.get('error', 'alignment failed'),
                'message': metrics.get('message', 'Le recalage automatique a échoué'),
                'metrics': metrics
            }, status=400)

        auto_tform = {
            "method": "mine" if transform_type == 'MINE' else "ants",
            "transform_type": transform_type,
            "transform_file": os.path.relpath(transform_path, UPLOAD_DIR) if transform_path else None,
            "warped_file": os.path.relpath(warped_path, UPLOAD_DIR),
            "metrics": metrics
        }

        try:
            series.tform = auto_tform
            series.save()
            print(f"Yassmine now the auto_align SAVED tform to DB for job_id: {job_id}")
        except Exception as e:
            print(f"Yassmine now the auto_align WARNING - failed to save tform: {str(e)}")

        JOBS[job_id] = {
            'patient_id': series.patient_id,
            'ref': ref_path,
            'patient': pat_path,
            'user': request.user.username,
            'tform': auto_tform
        }

        try:
            # ✅ FIX 5: plt.imsave sauvegarde en RGBA/RGB — lire et convertir correctement
            warped_array = cv2.imread(warped_path, cv2.IMREAD_GRAYSCALE)

            if warped_array is None:
                raise ValueError("Could not read warped image with cv2")

            # ✅ FIX 2: Ne PAS renormaliser — garder les vraies valeurs d'intensité
            warped_array = np.clip(warped_array, 0, 255).astype(np.uint8)

            # Encode as PNG
            _, buf = cv2.imencode('.png', warped_array)
            img_b64 = base64.b64encode(buf).decode('utf-8')
            img_data = f"data:image/png;base64,{img_b64}"

        except Exception as e:
            print(f"Yassmine now the auto_align WARNING - failed to read warped image: {str(e)}")
            return JsonResponse({
                'success': True,
                'message': 'Recalage automatique réussi',
                'metrics': metrics,
                'warped_path': os.path.relpath(warped_path, UPLOAD_DIR)
            })

        print(f"Yassmine now the auto_align SUCCESS - job_id: {job_id}, RMSE: {metrics.get('rmse')}")

        return JsonResponse({
            'success': True,
            'metrics': metrics,
            'image': img_data,
            'message': 'Recalage réussi'
        })

    except Exception as e:
        print(f"Yassmine now the auto_align CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'error': 'Internal Server Error',
            'message': f"Erreur interne du serveur: {str(e)}",
            'details': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def upload_series(request):
    """Upload a series of images and apply transformation"""
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the upload_series FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    job_id = request.POST.get('jobId')
    patient_id = (request.POST.get('patient_id') or '').strip() or None
    files = request.FILES.getlist('files')

    print(f"Yassmine now the upload_series endpoint works - job_id: {job_id}, patient_id: {patient_id}, files: {len(files)}")

    if not job_id or not files:
        print(f"Yassmine now the upload_series FAILED - missing jobId or files")
        return JsonResponse({'error': 'missing jobId or files'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Yassmine now the upload_series FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    tform = series.tform
    if not tform:
        print(f"Yassmine now the upload_series FAILED - no tform for job_id: {job_id}")
        return JsonResponse({
            'error': 'transformation not found',
            'message': "Tu dois faire l'alignement d'abord. Clique sur 'Aligner' pour calculer la transformation."
        }, status=404)

    M = affine_from_tform(tform)

    upload_dir = os.path.join(UPLOAD_DIR, job_id, 'series')
    if os.path.exists(upload_dir):
        print(f"Yassmine now the upload_series DELETING old series directory: {upload_dir}")
        shutil.rmtree(upload_dir)
    os.makedirs(upload_dir, exist_ok=True)

    print(f"Yassmine now the upload_series saving to directory: {upload_dir}")

    saved_files = []
    skipped_files = 0
    for file in files:
        try:
            file_path = os.path.join(upload_dir, file.name)
            with open(file_path, 'wb') as f:
                for chunk in file.chunks():
                    f.write(chunk)
            print(f"Yassmine now the upload_series SAVED file: {file.name}")

            transformed_ok = False
            try:
                img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
                if img is None:
                    print(f"Yassmine now the upload_series WARNING - not an image or unreadable: {file.name}")
                else:
                    img = cv2.resize(img, (512, 512))
                    warped = cv2.warpAffine(img, M, (512, 512))
                    ok = cv2.imwrite(file_path, warped)
                    if ok:
                        print(f"Yassmine now the upload_series TRANSFORMED file: {file.name}")
                        transformed_ok = True
                    else:
                        print(f"Yassmine now the upload_series WARNING - failed to write transformed file: {file.name}")
            except Exception as cv_err:
                print(f"Yassmine now the upload_series WARNING - transformation failed for {file.name}: {str(cv_err)}")

            if transformed_ok and os.path.exists(file_path):
                rel_path = os.path.relpath(file_path, UPLOAD_DIR).replace('\\', '/')
                saved_files.append(rel_path)
            else:
                skipped_files += 1
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as rm_err:
                    print(f"Yassmine now the upload_series WARNING - cleanup failed for {file.name}: {str(rm_err)}")
        except Exception as e:
            print(f"Yassmine now the upload_series FAILED processing file {file.name}: {str(e)}")
            skipped_files += 1

    series.files = saved_files
    if patient_id:
        series.patient_id = patient_id
    series.save()

    print(f"Yassmine now the upload_series SUCCESS - processed {len(saved_files)} files for job_id: {job_id}")
    return JsonResponse({
        'jobId': job_id,
        'series_id': series.id,
        'patient_id': patient_id,
        'produced': len(saved_files),
        'files_count': len(saved_files),
        'skipped': skipped_files,
        'files': saved_files,
        'removed_old_series': 1
    })


@api_view(['GET'])
def get_job_tform(request, job_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the get_job_tform FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Yassmine now the get_job_tform endpoint works - job_id: {job_id}")

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Yassmine now the get_job_tform FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    tform = series.tform
    if not tform:
        print(f"Yassmine now the get_job_tform FAILED - no tform for job_id: {job_id}")
        return JsonResponse({
            'error': 'transformation not found',
            'message': "Tu dois faire l'alignement d'abord. Clique sur 'Aligner' pour calculer la transformation."
        }, status=404)

    print(f"Yassmine now the get_job_tform SUCCESS - job_id: {job_id}")
    return JsonResponse({'tform': tform})


@api_view(['GET'])
def history(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the history endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Yassmine now the history endpoint works - user: {request.user.username}")
    out = []
    qs = Series.objects.filter(user=request.user).order_by('-created_at')
    for s in qs:
        ref_name = 'ref.png'
        pat_name = 'patient.png'
        if s.files and len(s.files) >= 2:
            ref_name = os.path.basename(s.files[0])
            pat_name = os.path.basename(s.files[1])
        out.append({
            'jobId': s.job_id,
            'patient_id': s.patient_id,
            'ref': ref_name,
            'patient': pat_name,
            'user': s.user.username if s.user else 'unknown'
        })
    print(f"Yassmine now the history SUCCESS - returned {len(out)} jobs")
    return JsonResponse(out, safe=False)


@csrf_exempt
@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def patient_detail_update_delete(request, patient_id):
    print(f"Nadine Yassmine - patient_detail_update_delete - id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    if request.method == 'GET':
        serializer = PatientSerializer(patient, context={'request': request})
        return JsonResponse({'ok': True, 'patient': serializer.data})

    elif request.method == 'PATCH':
        serializer = PatientSerializer(patient, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return JsonResponse({'ok': True, 'patient': serializer.data, 'message': 'Patient mis à jour avec succès'})
        return JsonResponse({'ok': False, 'errors': serializer.errors}, status=400)


@api_view(['GET'])
def list_patients(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the list_patients endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Yassmine now the list_patients endpoint works - user: {request.user.username}")
    qs = Series.objects.filter(user=request.user).values_list('patient_id', flat=True).distinct()
    if qs.exists():
        patients = {}
        for pid in qs:
            patients[pid] = {'_id': pid, 'patient_id': pid, 'meta': {'series_count': 0}}
        for s in Series.objects.filter(user=request.user):
            pid = s.patient_id
            if pid in patients:
                patients[pid]['meta']['series_count'] += 1
        print(f"Yassmine now the list_patients SUCCESS - found {len(patients)} patients from DB")
        return JsonResponse(list(patients.values()), safe=False)

    print(f"Yassmine now the list_patients SUCCESS - found 0 patients")
    return JsonResponse([], safe=False)


@api_view(['GET'])
def get_patient_series(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the get_patient_series endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Yassmine now the get_patient_series endpoint works - patient_id: {patient_id}, user: {request.user.username}")
    out = []
    qs = Series.objects.filter(patient_id=patient_id, user=request.user).order_by('-created_at')
    skip_names = {'ref.png', 'patient.png', 'preview_ref.png', 'preview_patient.png'}
    for s in qs:
        for rel in (s.files or []):
            rel_norm = rel.replace('\\', '/')
            name = os.path.basename(rel_norm)
            if name in skip_names:
                continue
            out.append({
                'series_id': s.id,
                'job_id': s.job_id,
                'relpath': rel_norm,
                'filename': name,
                'created_at': s.created_at.isoformat(),
                'user': s.user.username if s.user else None
            })
    print(f"Yassmine now the get_patient_series SUCCESS - patient_id: {patient_id}, returned {len(out)} series")
    return JsonResponse(out, safe=False)


@require_http_methods(["GET", "HEAD"])
def patient_file(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the patient_file endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    job_id = request.GET.get('jobId')
    relpath = request.GET.get('relpath', '')
    print(f"Yassmine now the patient_file endpoint works - job_id: {job_id}, relpath: {relpath}, user: {request.user.username}")
    if not job_id:
        print(f"Yassmine now the patient_file FAILED - missing jobId")
        return JsonResponse({'error': 'missing jobId'}, status=400)

    series = Series.objects.filter(job_id=job_id, user=request.user).first()
    series_patient_id = series.patient_id if series else None

    job_dir = os.path.join(UPLOAD_DIR, job_id)
    if not os.path.isdir(job_dir):
        print(f"Yassmine now the patient_file FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    if not relpath or relpath in ('.', ''):
        for name in ('ref.png', 'patient.png', 'preview_ref.png', 'preview_patient.png'):
            candidate = os.path.join(job_dir, name)
            if os.path.exists(candidate):
                print(f"Yassmine now the patient_file SUCCESS - job_id: {job_id}, file: {name}")
                img = read_gray_image(candidate)
                # ✅ FIX 3: Ne pas normaliser les images recalées MINE
                # normalize_brain_image croppe différemment fixe et mobile → faux décalage visuel
                if series_patient_id != 'brodmann' and 'auto_registration' not in candidate:
                    norm = normalize_brain_image(img)
                    if norm is not None:
                        ok, buf = cv2.imencode('.png', norm)
                        if ok:
                            return HttpResponse(buf.tobytes(), content_type='image/png')
                return FileResponse(open(candidate, 'rb'), content_type='image/png')
        print(f"Yassmine now the patient_file FAILED - file not found for job_id: {job_id}")
        return JsonResponse({'error': 'file not found'}, status=404)

    safe_rel = os.path.normpath(relpath).replace('\\', '/')
    if safe_rel.startswith('..'):
        print(f"Yassmine now the patient_file FAILED - invalid relpath: {relpath}")
        return JsonResponse({'error': 'invalid relpath'}, status=400)

    candidate = os.path.join(UPLOAD_DIR, safe_rel)

    if not os.path.exists(candidate):
        print(f"Yassmine now the patient_file FAILED - file not found: job_id: {job_id}, relpath: {relpath}, path: {candidate}")
        return JsonResponse({'error': 'file not found'}, status=404)

    img = read_gray_image(candidate)
    # ✅ FIX 3: Ne pas normaliser les images recalées MINE
    # normalize_brain_image croppe différemment fixe et mobile → faux décalage visuel
    if series_patient_id != 'brodmann' and 'auto_registration' not in candidate:
        norm = normalize_brain_image(img)
        if norm is not None:
            ok, buf = cv2.imencode('.png', norm)
            if ok:
                print(f"Yassmine now the patient_file SUCCESS (normalized) - job_id: {job_id}, relpath: {relpath}")
                return HttpResponse(buf.tobytes(), content_type='image/png')

    print(f"Yassmine now the patient_file SUCCESS - job_id: {job_id}, relpath: {relpath}")
    return FileResponse(open(candidate, 'rb'), content_type='application/octet-stream')


@require_http_methods(["GET"])
def brain_transform(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)
    job_id = request.GET.get('jobId')
    relpath = request.GET.get('relpath', '')
    if not job_id:
        return JsonResponse({'error': 'missing jobId'}, status=400)
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    if not os.path.isdir(job_dir):
        return JsonResponse({'error': 'job not found'}, status=404)

    if not relpath or relpath in ('.', ''):
        return JsonResponse({'error': 'missing relpath'}, status=400)

    safe_rel = os.path.normpath(relpath).replace('\\', '/')
    if safe_rel.startswith('..'):
        return JsonResponse({'error': 'invalid relpath'}, status=400)

    candidate = os.path.join(UPLOAD_DIR, safe_rel)
    if not os.path.exists(candidate):
        return JsonResponse({'error': 'file not found'}, status=404)

    img = read_gray_image(candidate)
    if img is None:
        return JsonResponse({'error': 'cannot read image'}, status=500)

    cand = select_brain_candidate(img)
    if not cand:
        return JsonResponse({'error': 'brain not found'}, status=404)

    mask = cand["mask"]
    ys, xs = np.where(mask > 0)
    if len(xs) > 50:
        pts = np.stack([xs, ys], axis=1).astype(np.float32)
        mean = pts.mean(axis=0)
        pts0 = pts - mean
        cov = np.cov(pts0.T)
        vals, vecs = np.linalg.eigh(cov)
        order = np.argsort(vals)[::-1]
        vecs = vecs[:, order]
        vx, vy = vecs[:, 0]
        angle = float(np.degrees(np.arctan2(vy, vx)))
    else:
        mean = np.array(cand["center"], dtype=np.float32)
        angle = 0.0

    x, y, w, h = cand["bbox"]
    ih, iw = img.shape[:2]
    return JsonResponse({
        'center': {'x': float(mean[0]), 'y': float(mean[1])},
        'angle': angle,
        'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)},
        'size': {'w': int(iw), 'h': int(ih)},
        'normalized': False
    })


@csrf_exempt
@require_http_methods(["POST"])
def project_brodmann(request):
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'error': 'login required'}, status=401)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    atlas_job = data.get('atlasJobId') or data.get('atlas_jobId') or data.get('atlas_job')
    atlas_rel = data.get('atlasRelpath') or data.get('atlas_relpath')
    patient_job = data.get('patientJobId') or data.get('patient_jobId') or data.get('patient_job')
    patient_rel = data.get('patientRelpath') or data.get('patient_relpath')
    seed_x = data.get('x')
    seed_y = data.get('y')
    tol = data.get('tolerance', 8)

    if not atlas_job or not atlas_rel or not patient_job or not patient_rel:
        return JsonResponse({'error': 'missing jobId/relpath'}, status=400)
    if seed_x is None or seed_y is None:
        return JsonResponse({'error': 'missing click coords'}, status=400)

    try:
        atlas_series = Series.objects.get(job_id=atlas_job, user=request.user)
    except Series.DoesNotExist:
        return JsonResponse({'error': 'atlas job not found'}, status=404)

    try:
        patient_series = Series.objects.get(job_id=patient_job, user=request.user)
    except Series.DoesNotExist:
        return JsonResponse({'error': 'patient job not found'}, status=404)

    def safe_abs_path(job_id, relpath):
        job_dir = os.path.join(UPLOAD_DIR, job_id)
        if not os.path.isdir(job_dir):
            return None
        safe_rel = os.path.normpath(relpath).replace('\\', '/')
        if safe_rel.startswith('..'):
            return None
        p = os.path.join(UPLOAD_DIR, safe_rel)
        if not os.path.exists(p):
            return None
        return p

    atlas_path = safe_abs_path(atlas_job, atlas_rel)
    patient_path = safe_abs_path(patient_job, patient_rel)
    if not atlas_path or not patient_path:
        return JsonResponse({'error': 'file not found'}, status=404)

    atlas_img = read_gray_image(atlas_path)
    patient_img = read_gray_image(patient_path)
    if atlas_img is None or patient_img is None:
        return JsonResponse({'error': 'cannot read images'}, status=500)

    h_orig, w_orig = atlas_img.shape[:2]
    atlas_512 = cv2.resize(atlas_img, (512, 512), interpolation=cv2.INTER_LINEAR)
    patient_512 = cv2.resize(patient_img, (512, 512), interpolation=cv2.INTER_LINEAR)

    scale_x = 512.0 / w_orig
    scale_y = 512.0 / h_orig
    seed_x_512 = int(seed_x * scale_x)
    seed_y_512 = int(seed_y * scale_y)
    seed_x_512 = max(0, min(511, seed_x_512))
    seed_y_512 = max(0, min(511, seed_y_512))

    sel_mask_512 = _flood_mask_gray(atlas_512, seed_x_512, seed_y_512, tol)

    atlas_eq = cv2.equalizeHist(atlas_512)
    patient_eq = cv2.equalizeHist(patient_512)
    atlas_norm = atlas_eq.astype(np.float32) / 255.0
    patient_norm = patient_eq.astype(np.float32) / 255.0

    warp_matrix = _ecc_affine(patient_norm, atlas_norm, max_iter=200, eps=1e-5)

    if warp_matrix is None:
        warped_sel = sel_mask_512
    else:
        warped_sel_float = cv2.warpAffine(
            sel_mask_512.astype(np.float32),
            warp_matrix,
            (512, 512),
            flags=cv2.INTER_LINEAR,
            borderValue=0
        )
        warped_sel = (warped_sel_float > 127).astype(np.uint8) * 255

    ok, buf = cv2.imencode('.png', warped_sel)
    if not ok:
        return JsonResponse({'error': 'encode failed'}, status=500)
    return HttpResponse(buf.tobytes(), content_type='image/png')


@require_http_methods(["POST"])
def delete_series(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the delete_series endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
        series_id = data.get('series_id')
    except:
        print(f"Yassmine now the delete_series endpoint FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid request'}, status=400)

    if not series_id:
        print(f"Yassmine now the delete_series endpoint FAILED - missing series_id")
        return JsonResponse({'error': 'missing series_id'}, status=400)

    try:
        series = Series.objects.get(id=series_id)
    except Series.DoesNotExist:
        print(f"Yassmine now the delete_series endpoint FAILED - series not found: {series_id}")
        return JsonResponse({'error': 'series not found'}, status=404)

    if series.user != request.user:
        print(f"Yassmine now the delete_series endpoint FAILED - user {request.user.username} does not own series {series_id}")
        return JsonResponse({'error': 'permission denied'}, status=403)

    job_id = series.job_id
    print(f"Yassmine now the delete_series endpoint works - deleting series_id: {series_id}, job_id: {job_id}, user: {request.user.username}")

    try:
        series_dir = os.path.join(UPLOAD_DIR, job_id, 'series')
        if os.path.exists(series_dir):
            shutil.rmtree(series_dir)
            print(f"Yassmine now the delete_series - deleted directory: {series_dir}")
    except Exception as e:
        print(f"Yassmine now the delete_series WARNING - failed to delete files: {str(e)}")

    series.delete()
    print(f"Yassmine now the delete_series SUCCESS - series_id: {series_id} deleted from DB")

    return JsonResponse({'message': 'series deleted successfully'})


@require_http_methods(["POST"])
def preprocess_image(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the preprocess endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        print(f"Yassmine now the preprocess FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    job_id = data.get('jobId')
    target = data.get('target')
    method = data.get('method')
    intensity = float(data.get('intensity', 1.0))

    print(f"Yassmine now the preprocess endpoint works - job_id: {job_id}, target: {target}, method: {method}, intensity: {intensity}")

    if not job_id or not target or not method:
        print(f"Yassmine now the preprocess FAILED - missing parameters")
        return JsonResponse({'error': 'missing jobId, target, or method'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
        if not series.files or len(series.files) < 2:
            print(f"Yassmine now the preprocess FAILED - job files not found in DB: {job_id}")
            return JsonResponse({'error': 'job files not found'}, status=404)

        if target == 'ref':
            img_path = os.path.join(UPLOAD_DIR, series.files[0])
        elif target == 'patient':
            img_path = os.path.join(UPLOAD_DIR, series.files[1])
        else:
            return JsonResponse({'error': 'invalid target (must be ref or patient)'}, status=400)

    except Series.DoesNotExist:
        print(f"Yassmine now the preprocess FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"Yassmine now the preprocess FAILED - cannot read image: {img_path}")
        return JsonResponse({'error': 'cannot read image'}, status=500)

    img = cv2.resize(img, (512, 512))

    try:
        if method == 'equalize':
            processed = cv2.equalizeHist(img)
        elif method == 'contrast':
            clahe = cv2.createCLAHE(clipLimit=intensity * 2.0, tileGridSize=(8, 8))
            processed = clahe.apply(img)
        elif method == 'brightness':
            processed = cv2.convertScaleAbs(img, alpha=1.0, beta=intensity * 50)
        elif method == 'blur':
            ksize = int(intensity * 5)
            if ksize % 2 == 0:
                ksize += 1
            ksize = max(3, ksize)
            processed = cv2.GaussianBlur(img, (ksize, ksize), 0)
        elif method == 'sharpen':
            blurred = cv2.GaussianBlur(img, (5, 5), 0)
            processed = cv2.addWeighted(img, 1.0 + intensity, blurred, -intensity, 0)
        else:
            return JsonResponse({'error': f'unknown method: {method}'}, status=400)

        _, buf = cv2.imencode('.png', processed)
        print(f"Yassmine now the preprocess SUCCESS - job_id: {job_id}, method: {method}")
        return HttpResponse(buf.tobytes(), content_type='image/png')

    except Exception as e:
        print(f"Yassmine now the preprocess FAILED - error: {str(e)}")
        return JsonResponse({'error': f'preprocessing failed: {str(e)}'}, status=500)


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def mri_file_preview(request, file_id):
    mri_file = get_object_or_404(
        MRIFile.objects.select_related('patient'),
        id=file_id,
        patient__doctor=request.user,
    )

    abs_path = getattr(mri_file.file, 'path', None)
    if not abs_path or not os.path.exists(abs_path):
        return JsonResponse({'ok': False, 'error': 'Fichier introuvable.'}, status=404)

    image = read_gray_image(abs_path)
    if image is None:
        return JsonResponse({'ok': False, 'error': 'Impossible de lire l\'image.'}, status=500)

    image_u8 = np.clip(image, 0, 255).astype(np.uint8)
    ok, encoded = cv2.imencode('.png', image_u8)
    if not ok:
        return JsonResponse({'ok': False, 'error': 'Echec encodage preview PNG.'}, status=500)

    return HttpResponse(encoded.tobytes(), content_type='image/png')


@csrf_exempt
@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def launch_patient_segmentation(request, patient_id):
    """
    Launch synchronous ONNX segmentation for selected MRI files.
    Request body:
            {
                "model": "unetpp" | "nnunet",
                "file_ids": [1,2,3],
                "threshold": 0.25
            }
    """
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    model = (request.data.get('model') or 'unetpp').strip().lower()
    threshold = request.data.get('threshold', 0.25)

    try:
        threshold = float(threshold)
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'threshold invalide'}, status=400)

    if threshold < 0.0 or threshold > 1.0:
        return JsonResponse({'ok': False, 'error': 'threshold doit etre entre 0 et 1'}, status=400)

    file_ids = request.data.get('file_ids') or []
    if isinstance(file_ids, str):
        try:
            file_ids = json.loads(file_ids)
        except Exception:
            return JsonResponse({'ok': False, 'error': 'file_ids invalide'}, status=400)
    if not isinstance(file_ids, list):
        return JsonResponse({'ok': False, 'error': 'file_ids doit etre une liste'}, status=400)

    queryset = MRIFile.objects.filter(patient=patient).order_by('uploaded_at')
    if file_ids:
        queryset = queryset.filter(id__in=file_ids)

    mri_files = list(queryset)
    if not mri_files:
        return JsonResponse({'ok': False, 'error': 'Aucune coupe IRM selectionnee'}, status=400)

    run = SegmentationRun.objects.create(
        patient=patient,
        doctor=request.user,
        model_key=model,
        threshold=threshold,
        selected_count=len(mri_files),
        status='running',
    )

    try:
        results = run_segmentation_on_files(mri_files, model_key=model, threshold=threshold)

        created_results = []
        with transaction.atomic():
            for item in results:
                seg_row = SegmentationMaskResult.objects.create(
                    run=run,
                    patient=patient,
                    mri_file_id=item['file_id'],
                    slice_index=int(item.get('index') or 1),
                    source_filename=item.get('source_filename') or '',
                    source_file=item.get('source_file') or '',
                    source_url=item.get('source_url') or '',
                    mask_file=item.get('mask_file') or '',
                    mask_url=item.get('mask_url') or '',
                )
                created_results.append(seg_row)

            run.status = 'done'
            run.processed_count = len(created_results)
            run.completed_at = timezone.now()
            run.error_message = ''
            run.save(update_fields=['status', 'processed_count', 'completed_at', 'error_message'])

    except FileNotFoundError as e:
        run.status = 'failed'
        run.error_message = str(e)
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return JsonResponse({'ok': False, 'error': str(e), 'run_id': run.id}, status=500)
    except ValueError as e:
        run.status = 'failed'
        run.error_message = str(e)
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return JsonResponse({'ok': False, 'error': str(e), 'run_id': run.id}, status=400)
    except RuntimeError as e:
        run.status = 'failed'
        run.error_message = str(e)
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return JsonResponse({'ok': False, 'error': str(e), 'run_id': run.id}, status=500)
    except Exception as e:
        run.status = 'failed'
        run.error_message = f'Echec segmentation: {str(e)}'
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return JsonResponse({'ok': False, 'error': f'Echec segmentation: {str(e)}', 'run_id': run.id}, status=500)

    return JsonResponse(
        {
            'ok': True,
            'run_id': run.id,
            'patient_id': patient.id,
            'model': model,
            'model_version': _segmentation_model_label(model),
            'threshold': threshold,
            'count': len(results),
            'results': results,
        },
        status=200,
    )


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def segmentation_runs_list(request):
    limit_raw = request.GET.get('limit', 20)
    try:
        limit = int(limit_raw)
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(limit, 100))

    runs_qs = (
        SegmentationRun.objects
        .filter(doctor=request.user)
        .select_related('patient')
        .order_by('-created_at')[:limit]
    )

    runs = []
    for run in runs_qs:
        patient = run.patient
        full_name = f"{(patient.prenom or '').strip()} {(patient.nom or '').strip()}".strip()
        runs.append({
            'id': run.id,
            'patient_id': patient.id,
            'patient_name': full_name or f'Patient #{patient.id}',
            'model_key': run.model_key,
            'model_version': _segmentation_model_label(run.model_key),
            'status': run.status,
            'selected_count': run.selected_count,
            'processed_count': run.processed_count,
            'created_at': run.created_at.isoformat() if run.created_at else None,
            'completed_at': run.completed_at.isoformat() if run.completed_at else None,
            'error_message': run.error_message,
        })

    return JsonResponse({'ok': True, 'runs': runs}, status=200)


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def segmentation_run_detail(request, run_id):
    run = get_object_or_404(SegmentationRun, id=run_id, doctor=request.user)
    serializer = SegmentationRunSerializer(run)
    return JsonResponse({'ok': True, 'run': serializer.data}, status=200)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def segmentation_run_modelisation_3d(request, run_id):
    run = get_object_or_404(SegmentationRun, id=run_id, doctor=request.user)

    if run.status != 'done':
        return JsonResponse({'ok': False, 'error': 'Le run doit etre termine avant la modelisation 3D.'}, status=400)

    structure = str(request.data.get('structure') or 'both').strip().lower()
    quality = str(request.data.get('quality') or 'standard').strip().lower()
    smoothing = str(request.data.get('smoothing') or 'low').strip().lower()

    spacing = parse_spacing(
        {
            'spacing_z': request.data.get('spacing_z'),
            'spacing_y': request.data.get('spacing_y'),
            'spacing_x': request.data.get('spacing_x'),
        }
    )
    normative_total_mean_mm3, normative_total_std_mm3 = parse_reference_values(
        {
            'normative_total_mean_mm3': request.data.get('normative_total_mean_mm3'),
            'normative_total_std_mm3': request.data.get('normative_total_std_mm3'),
        }
    )

    try:
        result = run_modelisation_3d(
            run=run,
            structure=structure,
            quality=quality,
            smoothing=smoothing,
            spacing=spacing,
            normative_total_mean_mm3=normative_total_mean_mm3,
            normative_total_std_mm3=normative_total_std_mm3,
        )
        return JsonResponse({'ok': True, 'modelisation': result}, status=200)
    except FileNotFoundError as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=404)
    except ValueError as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': f'Echec modelisation 3D: {str(e)}'}, status=500)


def _compute_age(date_naissance):
    if not date_naissance:
        return None
    today = timezone.now().date()
    years = today.year - date_naissance.year
    if (today.month, today.day) < (date_naissance.month, date_naissance.day):
        years -= 1
    return max(0, years)


def _read_storage_gray(path):
    if not path or not default_storage.exists(path):
        return None
    with default_storage.open(path, 'rb') as fp:
        raw = fp.read()
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)


def _make_slice_overlay_png(row, label):
    src = _read_storage_gray(getattr(row, 'source_file', ''))
    msk = _read_storage_gray(getattr(row, 'mask_file', ''))
    if src is None:
        return None

    if msk is None:
        vis = cv2.cvtColor(src, cv2.COLOR_GRAY2BGR)
    else:
        m = (msk > 127).astype(np.uint8) * 255
        vis = cv2.cvtColor(src, cv2.COLOR_GRAY2BGR)
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(vis, contours, -1, (40, 40, 255), 2)

    cv2.putText(vis, label, (14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(vis, label, (14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (30, 60, 120), 1, cv2.LINE_AA)
    ok, png_buf = cv2.imencode('.png', vis)
    if not ok:
        return None
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    tmp.write(png_buf.tobytes())
    tmp.close()
    return tmp.name


def _build_volume_projection_png(rows):
    masks = []
    for row in rows:
        m = _read_storage_gray(getattr(row, 'mask_file', ''))
        if m is not None:
            masks.append((m > 127).astype(np.uint8))
    if not masks:
        return None

    vol = np.stack(masks, axis=0)
    ax = (np.max(vol, axis=0) * 255).astype(np.uint8)
    cor = (np.max(vol, axis=1) * 255).astype(np.uint8)
    sag = (np.max(vol, axis=2) * 255).astype(np.uint8)

    h = 220
    ax = cv2.resize(ax, (260, h), interpolation=cv2.INTER_NEAREST)
    cor = cv2.resize(cor, (260, h), interpolation=cv2.INTER_NEAREST)
    sag = cv2.resize(sag, (260, h), interpolation=cv2.INTER_NEAREST)

    canvas = np.zeros((h + 40, 800, 3), dtype=np.uint8)
    canvas[:] = (244, 248, 255)
    for i, img in enumerate([ax, cor, sag]):
        col = cv2.applyColorMap(img, cv2.COLORMAP_OCEAN)
        x0 = 10 + i * 265
        canvas[10:10 + h, x0:x0 + 260] = col

    cv2.putText(canvas, 'Vue 3D (projections volumiques)', (12, h + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (38, 65, 112), 2, cv2.LINE_AA)
    ok, png_buf = cv2.imencode('.png', canvas)
    if not ok:
        return None
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    tmp.write(png_buf.tobytes())
    tmp.close()
    return tmp.name


def _build_comparison_chart_png(volumes_mm3, ref_mean, ref_std):
    w, h = 900, 340
    im = Image.new('RGB', (w, h), (248, 251, 255))
    draw = ImageDraw.Draw(im)

    labels = ['Gauche', 'Droite', 'Total', 'Norme']
    values = [
        float(volumes_mm3.get('left') or 0.0),
        float(volumes_mm3.get('right') or 0.0),
        float(volumes_mm3.get('total') or 0.0),
        float(ref_mean or 0.0),
    ]
    colors_bars = [(73, 128, 224), (89, 166, 242), (62, 194, 160), (155, 173, 204)]

    maxv = max(max(values), 1.0)
    x0, y0 = 70, 60
    chart_w, chart_h = 760, 220
    draw.rectangle([x0, y0, x0 + chart_w, y0 + chart_h], outline=(200, 212, 233), width=1)
    for i in range(6):
        yy = y0 + int((chart_h / 5) * i)
        draw.line([x0, yy, x0 + chart_w, yy], fill=(230, 236, 247), width=1)

    bar_w = 110
    gap = 65
    start_x = x0 + 75
    for i, (label, val, c) in enumerate(zip(labels, values, colors_bars)):
        bx = start_x + i * (bar_w + gap)
        bh = int((val / maxv) * (chart_h - 16))
        by = y0 + chart_h - bh
        draw.rectangle([bx, by, bx + bar_w, y0 + chart_h], fill=c)
        draw.text((bx, y0 + chart_h + 8), label, fill=(63, 89, 137))
        draw.text((bx, by - 18), f'{val:.0f}', fill=(32, 58, 104))

    draw.text((x0, 20), 'Graphique comparatif: volumes patient vs norme', fill=(31, 60, 110))
    draw.text((x0, h - 28), f'Norme totale: {ref_mean:.2f} +/- {ref_std:.2f} mm3', fill=(90, 109, 143))

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    im.save(tmp.name, format='PNG')
    tmp.close()
    return tmp.name


def _build_report_pdf(run, modelisation):
    cleanup_paths = []
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1.3 * cm, rightMargin=1.3 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm)
    styles = getSampleStyleSheet()
    story = []

    patient = run.patient
    age = _compute_age(getattr(patient, 'date_naissance', None))
    sex = patient.get_sexe_display() if hasattr(patient, 'get_sexe_display') else (patient.sexe or '-')
    exam_date = (run.completed_at or run.created_at or timezone.now()).date().isoformat()

    story.append(Paragraph('Rapport Clinique - Segmentation Hippocampique', styles['Title']))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(f'Run #{run.id} | Date: {exam_date}', styles['Normal']))
    story.append(Spacer(1, 0.2 * cm))

    patient_table = Table([
        ['Resume patient (anonyme)', 'Valeur'],
        ['Age', str(age) if age is not None else '-'],
        ['Sexe', str(sex or '-')],
        ['Date examen', exam_date],
    ], colWidths=[7.5 * cm, 8.5 * cm])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f3a63')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.6, colors.HexColor('#d2d9e6')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 0.35 * cm))

    ci = modelisation.get('clinical_indices', {})
    vols = modelisation.get('volumes_mm3', {})
    measures_table = Table([
        ['Mesure', 'Valeur'],
        ['Volume gauche (mm3)', f"{float(vols.get('left') or 0.0):.2f}"],
        ['Volume droit (mm3)', f"{float(vols.get('right') or 0.0):.2f}"],
        ['Volume total (mm3)', f"{float(vols.get('total') or 0.0):.2f}"],
        ['Asymetrie IA (%)', f"{float(ci.get('asymmetry_index_percent') or 0.0):.2f}"],
        ['Indice IN (%)', f"{float(ci.get('normality_index_percent') or 0.0):.2f}"],
        ['Z-score', f"{float(ci.get('z_score') or 0.0):.2f}"],
    ], colWidths=[7.5 * cm, 8.5 * cm])
    measures_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2e4f9e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.6, colors.HexColor('#d2d9e6')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(measures_table)
    story.append(Spacer(1, 0.35 * cm))

    interp = modelisation.get('clinical_interpretation', {})
    interp_text = interp.get('summary') or 'Interpretation indisponible.'
    story.append(Paragraph('Interpretation textuelle automatique', styles['Heading3']))
    story.append(Paragraph(interp_text, styles['BodyText']))
    story.append(Spacer(1, 0.3 * cm))

    rows = list(run.results.all().order_by('slice_index', 'id'))
    if rows:
        idxs = [0, len(rows) // 2, len(rows) - 1]
        used = []
        for i in idxs:
            if i not in used and 0 <= i < len(rows):
                used.append(i)
        story.append(Paragraph('Images cles - Slices annotes', styles['Heading3']))
        for i in used:
            row = rows[i]
            img_path = _make_slice_overlay_png(row, f'Slice {row.slice_index}')
            if img_path:
                cleanup_paths.append(img_path)
                story.append(RLImage(img_path, width=16.8 * cm, height=5.0 * cm))
                story.append(Spacer(1, 0.15 * cm))

    projection_path = _build_volume_projection_png(rows)
    if projection_path:
        cleanup_paths.append(projection_path)
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph('Vue 3D', styles['Heading3']))
        story.append(RLImage(projection_path, width=16.8 * cm, height=5.0 * cm))

    ref = modelisation.get('reference_values_mm3', {})
    chart_path = _build_comparison_chart_png(
        volumes_mm3=vols,
        ref_mean=float(ref.get('normative_total_mean') or 0.0),
        ref_std=float(ref.get('normative_total_std') or 0.0),
    )
    if chart_path:
        cleanup_paths.append(chart_path)
        story.append(Spacer(1, 0.2 * cm))
        story.append(RLImage(chart_path, width=16.8 * cm, height=6.0 * cm))

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()

    for p in cleanup_paths:
        try:
            os.remove(p)
        except Exception:
            pass

    return pdf


@csrf_exempt
@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def segmentation_run_report_pdf(request, run_id):
    run = get_object_or_404(SegmentationRun, id=run_id, doctor=request.user)
    if run.status != 'done':
        return JsonResponse({'ok': False, 'error': 'Le run doit etre termine avant generation du rapport PDF.'}, status=400)

    structure = str(request.data.get('structure') or 'both').strip().lower()
    quality = str(request.data.get('quality') or 'standard').strip().lower()
    smoothing = str(request.data.get('smoothing') or 'low').strip().lower()
    spacing = parse_spacing(
        {
            'spacing_z': request.data.get('spacing_z'),
            'spacing_y': request.data.get('spacing_y'),
            'spacing_x': request.data.get('spacing_x'),
        }
    )
    ref_mean, ref_std = parse_reference_values(
        {
            'normative_total_mean_mm3': request.data.get('normative_total_mean_mm3'),
            'normative_total_std_mm3': request.data.get('normative_total_std_mm3'),
        }
    )

    try:
        modelisation = run_modelisation_3d(
            run=run,
            structure=structure,
            quality=quality,
            smoothing=smoothing,
            spacing=spacing,
            normative_total_mean_mm3=ref_mean,
            normative_total_std_mm3=ref_std,
        )
        pdf_data = _build_report_pdf(run, modelisation)
        filename = f"rapport_segmentation_run_{run.id}.pdf"
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        return JsonResponse({'ok': False, 'error': f'Echec generation rapport PDF: {str(e)}'}, status=500)


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def patient_files_download_zip(request, patient_id):
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)
    mri_files = MRIFile.objects.filter(patient=patient).order_by('uploaded_at')

    if not mri_files.exists():
        return JsonResponse({'ok': False, 'error': 'Aucun fichier MRI disponible pour ce patient.'}, status=404)

    zip_buffer = io.BytesIO()
    written = 0
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for mri in mri_files:
            stored_name = getattr(mri.file, 'name', '')
            if not stored_name or not default_storage.exists(stored_name):
                continue

            fallback_name = os.path.basename(stored_name)
            arcname = _safe_relative_path(mri.relative_path or mri.original_filename, fallback_name)
            if not arcname:
                arcname = fallback_name or f"file_{mri.id}"

            with default_storage.open(stored_name, 'rb') as file_handle:
                zip_file.writestr(arcname, file_handle.read())
                written += 1

    if written == 0:
        return JsonResponse({'ok': False, 'error': 'Aucun fichier lisible n\'a ete trouve.'}, status=404)

    zip_buffer.seek(0)
    filename = f"{patient.dossier_number}_dossier.zip"
    response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Content-Length'] = str(len(response.content))
    return response


@csrf_exempt
@require_http_methods(["POST"])
def apply_tform_to_series(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the apply_tform endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        print(f"Yassmine now the apply_tform FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    job_id = data.get('jobId')
    source_dir = data.get('source_dir', '')
    pattern = data.get('pattern', '*.*')

    print(f"Yassmine now the apply_tform endpoint works - job_id: {job_id}, source_dir: {source_dir}")

    if not job_id:
        print(f"Yassmine now the apply_tform FAILED - missing jobId")
        return JsonResponse({'error': 'missing jobId'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
        tform = series.tform
        if not tform:
            print(f"Yassmine now the apply_tform FAILED - no tform for job_id: {job_id}")
            return JsonResponse({'error': 'transformation not found'}, status=404)
    except Series.DoesNotExist:
        print(f"Yassmine now the apply_tform FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    M = affine_from_tform(tform)

    temp_dir = tempfile.mkdtemp()
    try:
        zip_path = os.path.join(temp_dir, 'transformed.zip')

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            if source_dir:
                search_dir = os.path.join(UPLOAD_DIR, source_dir)
            else:
                search_dir = os.path.join(UPLOAD_DIR, job_id, 'series')

            if not os.path.exists(search_dir):
                return JsonResponse({'error': 'source directory not found'}, status=404)

            count = 0
            for filename in os.listdir(search_dir):
                file_path = os.path.join(search_dir, filename)
                if not os.path.isfile(file_path):
                    continue

                try:
                    img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
                    if img is None:
                        continue
                    img = cv2.resize(img, (512, 512))
                    warped = cv2.warpAffine(img, M, (512, 512))
                    temp_img_path = os.path.join(temp_dir, filename)
                    cv2.imwrite(temp_img_path, warped)
                    zipf.write(temp_img_path, filename)
                    os.remove(temp_img_path)
                    count += 1
                except Exception as e:
                    print(f"Yassmine now the apply_tform WARNING - failed to process {filename}: {str(e)}")
                    continue

        print(f"Yassmine now the apply_tform SUCCESS - job_id: {job_id}, processed {count} files")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="transformed_{job_id}.zip"'
            return response

    except Exception as e:
        print(f"Yassmine now the apply_tform FAILED - error: {str(e)}")
        return JsonResponse({'error': f'transformation failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@api_view(['GET'])
def download_series(request, series_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the download_series endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Yassmine now the download_series endpoint works - series_id: {series_id}, user: {request.user.username}")

    try:
        series = Series.objects.get(id=series_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Yassmine now the download_series FAILED - series not found: {series_id}")
        return JsonResponse({'error': 'series not found'}, status=404)

    if not series.files:
        print(f"Yassmine now the download_series FAILED - no files in series: {series_id}")
        return JsonResponse({'error': 'no files in series'}, status=404)

    temp_dir = tempfile.mkdtemp()
    try:
        zip_path = os.path.join(temp_dir, f'series_{series_id}.zip')

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for rel_path in series.files:
                abs_path = os.path.join(UPLOAD_DIR, rel_path)
                if os.path.exists(abs_path):
                    filename = os.path.basename(rel_path)
                    zipf.write(abs_path, filename)

        print(f"Yassmine now the download_series SUCCESS - series_id: {series_id}, files: {len(series.files)}")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="series_{series.patient_id}_{series_id}.zip"'
            return response

    except Exception as e:
        print(f"Yassmine now the download_series FAILED - error: {str(e)}")
        return JsonResponse({'error': f'download failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@api_view(['GET'])
def download_patient(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the download_patient endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Yassmine now the download_patient endpoint works - patient_id: {patient_id}, user: {request.user.username}")

    series_list = Series.objects.filter(patient_id=patient_id, user=request.user)

    if not series_list.exists():
        print(f"Yassmine now the download_patient FAILED - no series found for patient: {patient_id}")
        return JsonResponse({'error': 'no series found for patient'}, status=404)

    temp_dir = tempfile.mkdtemp()
    try:
        zip_path = os.path.join(temp_dir, f'patient_{patient_id}.zip')

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for series in series_list:
                series_folder = f"series_{series.id}"
                for rel_path in (series.files or []):
                    abs_path = os.path.join(UPLOAD_DIR, rel_path)
                    if os.path.exists(abs_path):
                        filename = os.path.basename(rel_path)
                        zipf.write(abs_path, os.path.join(series_folder, filename))

        print(f"Yassmine now the download_patient SUCCESS - patient_id: {patient_id}, series: {series_list.count()}")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="patient_{patient_id}.zip"'
            return response

    except Exception as e:
        print(f"Yassmine now the download_patient FAILED - error: {str(e)}")
        return JsonResponse({'error': f'download failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@csrf_exempt
@api_view(['DELETE'])
def delete_patient(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Yassmine now the delete_patient endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Yassmine now the delete_patient endpoint works - patient_id: {patient_id}, user: {request.user.username}")

    series_list = Series.objects.filter(patient_id=patient_id, user=request.user)

    if not series_list.exists():
        print(f"Yassmine now the delete_patient FAILED - no series found for patient: {patient_id}")
        return JsonResponse({'error': 'no series found for patient'}, status=404)

    deleted_count = 0
    for series in series_list:
        job_id = series.job_id
        try:
            job_dir = os.path.join(UPLOAD_DIR, job_id)
            if os.path.exists(job_dir):
                shutil.rmtree(job_dir)
                print(f"Yassmine now the delete_patient - deleted directory: {job_dir}")
        except Exception as e:
            print(f"Yassmine now the delete_patient WARNING - failed to delete files for series {series.id}: {str(e)}")

        series.delete()
        deleted_count += 1

    print(f"Nadine Yassmine - delete_patient SUCCESS - patient_id: {patient_id}, deleted {deleted_count} series")
    return JsonResponse({'message': f'patient deleted successfully ({deleted_count} series)'})


@csrf_exempt
@require_http_methods(["POST"])
def emergency_login(request):
    try:
        data = json.loads(request.body)
        email = (data.get('email') or '').strip().lower()
        if not email:
            return JsonResponse({'ok': False, 'error': 'Email requis'}, status=400)
        try:
            user = User.objects.filter(Q(username=email) | Q(email__iexact=email)).first()
            if not user:
                raise User.DoesNotExist
        except User.DoesNotExist:
            return JsonResponse({'ok': False, 'error': 'Aucun compte trouvé avec cet email professionnel.'}, status=404)
        attempt, created = EmergencyLoginAttempt.objects.get_or_create(email=email)
        if attempt.count >= 5:
            return JsonResponse({'ok': False, 'error': 'Limite d\'accès d\'urgence atteinte (max 5).'}, status=403)
        attempt.count += 1
        attempt.save()
        login(request, user)
        request.session['username'] = user.username
        return JsonResponse({'ok': True, 'message': f'Connexion d\'urgence réussie ({attempt.count}/5)', 'user': user.username, 'count': attempt.count})
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': 'Erreur serveur interne'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def check_emergency_limit(request):
    try:
        data = json.loads(request.body)
        email = (data.get('email') or '').strip().lower()
        if not email:
            return JsonResponse({'ok': False, 'error': 'Email requis'}, status=400)
        attempt = EmergencyLoginAttempt.objects.filter(email=email).first()
        count = attempt.count if attempt else 0
        return JsonResponse({'ok': True, 'count': count, 'remaining': max(0, 5 - count)})
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': 'Erreur serveur interne'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password(request):
    print(f"Nadine Yassmine - FORGOT_PASSWORD ENDPOINT CALLED", flush=True)
    sys.stdout.flush()
    try:
        data = json.loads(request.body)
        email = (data.get('email') or '').strip().lower()
        print(f"Nadine Yassmine - forgot_password: received email: {email}", flush=True)
        sys.stdout.flush()
        if not email:
            return JsonResponse({'ok': False, 'error': 'email required'}, status=400)
        try:
            print(f"Nadine Yassmine - forgot_password: searching for user with email: {email}", flush=True)
            sys.stdout.flush()
            user = User.objects.filter(Q(username=email) | Q(email=email)).first()
            if not user:
                raise User.DoesNotExist
            print(f"Nadine Yassmine - forgot_password: user FOUND: {user.username}", flush=True)
            sys.stdout.flush()
        except User.DoesNotExist:
            print(f"Nadine Yassmine - forgot_password: user NOT FOUND with email: {email}", flush=True)
            sys.stdout.flush()
            return JsonResponse({'ok': True, 'message': 'Si cet email existe, un lien de réinitialisation sera envoyé.'})

        PasswordResetToken.objects.filter(user=user).delete()
        reset_token = PasswordResetToken.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(minutes=15)
        )

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token.token}"

        subject = "NeuroScan - Lien de réinitialisation de mot de passe"
        html_message = f"""
        <html><body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #4f46e5;">NeuroScan</h1>
                <h2>Réinitialisation de votre mot de passe</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe NeuroScan.</p>
                <p style="margin: 30px 0;">
                    <a href="{reset_link}" style="padding: 12px 30px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">
                        Réinitialiser mon mot de passe
                    </a>
                </p>
                <p style="color: #666; font-size: 12px;">Ce lien reste valide pendant 15 minutes.</p>
            </div>
        </body></html>
        """
        plain_message = f"Réinitialisez votre mot de passe NeuroScan:\n\n{reset_link}\n\nCe lien est valide 15 minutes."

        using_smtp = settings.EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend'
        sender_email = settings.EMAIL_HOST_USER or settings.DEFAULT_FROM_EMAIL

        if using_smtp and (not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD):
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Configuration email incomplète: renseignez EMAIL_HOST_USER et EMAIL_HOST_PASSWORD dans .env puis redémarrez le serveur.'
                },
                status=500,
            )

        try:
            print(f"Nadine Yassmine - forgot_password: Attempting to send email to {email}", flush=True)
            print(f"Nadine Yassmine - EMAIL_BACKEND: {settings.EMAIL_BACKEND}", flush=True)
            print(f"Nadine Yassmine - DEFAULT_FROM_EMAIL: {sender_email}", flush=True)
            print(f"Nadine Yassmine - reset_link: {reset_link}", flush=True)
            sys.stdout.flush()

            # In DEBUG, send synchronously so configuration errors are visible immediately.
            if settings.DEBUG:
                send_mail(
                    subject=subject,
                    message=plain_message,
                    from_email=sender_email,
                    recipient_list=[email],
                    html_message=html_message,
                    fail_silently=False,
                )
            else:
                # In production keep async behavior to reduce request latency.
                send_email_async(
                    subject=subject,
                    message=plain_message,
                    from_email=sender_email,
                    recipient_list=[email],
                    html_message=html_message
                )
            print(f"Nadine Yassmine - forgot_password: Email request queued for {email}", flush=True)
            sys.stdout.flush()
        except (smtplib.SMTPAuthenticationError, smtplib.SMTPSenderRefused):
            print("Nadine Yassmine - Email auth error: check EMAIL_HOST_USER/EMAIL_HOST_PASSWORD and sender address", flush=True)
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Authentification SMTP échouée. Vérifiez EMAIL_HOST_USER, EMAIL_HOST_PASSWORD (App Password) et DEFAULT_FROM_EMAIL.'
                },
                status=500,
            )
        except Exception as e:
            print(f"Nadine Yassmine - Error queuing email: {str(e)}", flush=True)
            import traceback
            print(f"Nadine Yassmine - traceback: {traceback.format_exc()}", flush=True)
            sys.stdout.flush()
            if settings.DEBUG:
                return JsonResponse({'ok': False, 'error': f'Email send failed: {str(e)}'}, status=500)

        resp = {'ok': True, 'message': 'Si cet email existe, un lien de réinitialisation sera envoyé.'}
        if settings.DEBUG and settings.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
            resp['debug_warning'] = 'EMAIL_BACKEND=console: le mail est affiche dans le terminal, pas envoye vers une boite mail.'
        return JsonResponse(resp)

    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    except Exception as e:
        import traceback
        print(f"Nadine Yassmine - forgot_password OUTER exception: {str(e)}", flush=True)
        print(f"Nadine Yassmine - forgot_password OUTER traceback: {traceback.format_exc()}", flush=True)
        if settings.DEBUG:
            return JsonResponse({'ok': False, 'error': f'Internal Server Error: {str(e)}'}, status=500)
        return JsonResponse({'ok': False, 'error': 'Internal Server Error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def validate_reset_token(request):
    try:
        data = json.loads(request.body)
        token = (data.get('token') or '').strip()
        if not token:
            return JsonResponse({'ok': False, 'error': 'token required'}, status=400)
        try:
            reset_token = PasswordResetToken.objects.get(token=token)
        except PasswordResetToken.DoesNotExist:
            return JsonResponse({'ok': False, 'error_type': 'token_invalid', 'error': 'Lien invalide'}, status=400)
        if not reset_token.is_valid():
            if timezone.now() > reset_token.expires_at:
                return JsonResponse({'ok': False, 'error_type': 'token_expired', 'error': 'Lien expiré'}, status=400)
            return JsonResponse({'ok': False, 'error_type': 'token_invalid', 'error': 'Lien déjà utilisé'}, status=400)
        return JsonResponse({'ok': True, 'message': 'Token valide'})
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': 'Internal Server Error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    try:
        data = json.loads(request.body)
        token = (data.get('token') or '').strip()
        new_password = data.get('new_password') or ''
        if not token or not new_password:
            return JsonResponse({'ok': False, 'error': 'token and new_password required'}, status=400)
        try:
            reset_token = PasswordResetToken.objects.get(token=token)
        except PasswordResetToken.DoesNotExist:
            return JsonResponse({'ok': False, 'error_type': 'token_invalid', 'error': 'Lien invalide'}, status=400)
        if not reset_token.is_valid():
            if timezone.now() > reset_token.expires_at:
                return JsonResponse({'ok': False, 'error_type': 'token_expired', 'error': 'Lien expiré'}, status=400)
            return JsonResponse({'ok': False, 'error_type': 'token_invalid', 'error': 'Lien déjà utilisé'}, status=400)
        user = reset_token.user
        user.set_password(new_password)
        user.save()
        reset_token.is_used = True
        reset_token.save()
        return JsonResponse({'ok': True, 'message': 'Mot de passe réinitialisé avec succès'})
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': 'Internal Server Error'}, status=500)


PROFILE_DEFAULTS = {
    'phone': '',
    'birthDate': '',
    'gender': 'Femme',
    'nationality': 'Tunisienne',
    'cin': 'MED-000000-TN',
    'specialty': 'Neurologue',
    'subSpecialty': 'Epileptologie',
    'institution': 'CHU Monastir',
    'department': 'Service de Neurologie',
    'orderNumber': 'ONM-0000-00000',
    'experienceYears': 0,
    'languages': ['Francais', 'Arabe', 'Anglais'],
    'bio': '',
}


def _derive_names_from_username(username):
    raw = (username or '').strip()
    if not raw:
        return '', ''

    local_part = raw.split('@', 1)[0]
    cleaned = ''.join(ch if (ch.isalpha() or ch in '._- ') else ' ' for ch in local_part)
    for sep in ['.', '_', '-']:
        cleaned = cleaned.replace(sep, ' ')

    parts = [p for p in cleaned.split() if p]
    if not parts:
        return '', ''

    first_name = parts[0].capitalize()
    last_name = ' '.join(p.capitalize() for p in parts[1:])
    return first_name, last_name


def _decode_bearer_payload(token):
    parts = (token or '').split('.')
    if len(parts) != 3:
        return None
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode((payload + padding).encode('utf-8'))
        return json.loads(raw.decode('utf-8'))
    except Exception:
        return None


def _get_request_user(request):
    if request.user and request.user.is_authenticated:
        return request.user

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ', 1)[1].strip()
    payload = _decode_bearer_payload(token)
    if not payload:
        return None

    user_id = payload.get('user_id') or payload.get('id') or payload.get('sub')
    if user_id is None:
        return None

    try:
        return User.objects.get(id=int(user_id))
    except (ValueError, User.DoesNotExist):
        return None


def _profile_payload_for_user(user):
    derived_first, derived_last = _derive_names_from_username(user.username)
    first_name = (user.first_name or '').strip() or derived_first
    last_name = (user.last_name or '').strip() or derived_last
    return {
        'firstName': first_name,
        'lastName': last_name,
        'email': user.email or user.username or '',
        **PROFILE_DEFAULTS,
    }


def _deep_merge_settings(base, patch):
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge_settings(merged[key], value)
        else:
            merged[key] = value
    return merged


@api_view(['GET', 'PUT'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def profile_view(request):
    user = _get_request_user(request)
    if not user:
        return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)

    if request.method == 'GET':
        return JsonResponse(_profile_payload_for_user(user))

    serializer = ProfileSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return JsonResponse({'errors': serializer.errors}, status=400)

    data = serializer.validated_data
    if 'firstName' in data:
        user.first_name = data['firstName']
    if 'lastName' in data:
        user.last_name = data['lastName']
    if 'email' in data:
        user.email = data['email']
    user.save(update_fields=['first_name', 'last_name', 'email'])

    response_data = _profile_payload_for_user(user)
    response_data.update(data)
    response_data['email'] = user.email or user.username or ''
    return JsonResponse(response_data)


@api_view(['GET', 'PUT'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def user_settings_view(request):
    user = _get_request_user(request)
    if not user:
        return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)

    settings_obj, _ = UserSettings.objects.get_or_create(user=user)

    if request.method == 'GET':
        payload = settings_obj.settings or default_user_settings()
        return JsonResponse(payload)

    serializer = UserSettingsSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return JsonResponse({'errors': serializer.errors}, status=400)

    current = settings_obj.settings or default_user_settings()
    merged = _deep_merge_settings(current, serializer.validated_data)
    settings_obj.settings = merged
    settings_obj.save(update_fields=['settings', 'updated_at'])
    return JsonResponse(settings_obj.settings)


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def change_password_view(request):
    user = _get_request_user(request)
    if not user:
        return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)

    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return JsonResponse({'errors': serializer.errors}, status=400)

    data = serializer.validated_data
    if data['newPassword'] != data['confirmPassword']:
        return JsonResponse({'error': 'Les mots de passe ne correspondent pas.'}, status=400)

    if not user.check_password(data['currentPassword']):
        return JsonResponse({'error': 'Mot de passe actuel incorrect.'}, status=400)

    user.set_password(data['newPassword'])
    user.save()

    return JsonResponse({'ok': True, 'message': 'Mot de passe mis a jour avec succes.'})


def _dashboard_patient_payload(patient):
    mri_files = list(patient.mri_files.all())
    slices_count = len(mri_files)
    last_exam = None
    if slices_count > 0:
        # Use latest uploaded MRI file as last exam proxy for dashboard cards.
        dated_rows = [row for row in mri_files if row.uploaded_at]
        if dated_rows:
            last_row = max(dated_rows, key=lambda row: row.uploaded_at)
            last_exam = last_row.uploaded_at.isoformat()

    return {
        'id': str(patient.id),
        'num_dossier': patient.dossier_number,
        'nom': patient.nom,
        'prenom': patient.prenom,
        'date_naissance': patient.date_naissance.isoformat() if patient.date_naissance else None,
        'sexe': patient.sexe,
        'autres_maladies': patient.autres_maladies,
        'slices_count': slices_count,
        'last_exam': last_exam,
        'created_at': patient.created_at.isoformat() if patient.created_at else None,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
@login_required
def patients_list_create(request):
    if request.method == 'GET':
        qs = Patient.objects.filter(doctor=request.user).prefetch_related('mri_files').order_by('-created_at')

        # Dashboard filters from query params
        search = (request.GET.get('id') or '').strip()
        num_dossier = (request.GET.get('num_dossier') or '').strip()
        date_naissance = (request.GET.get('date_naissance') or '').strip()
        sexe = (request.GET.get('sexe') or '').strip()
        autres_maladies = (request.GET.get('autres_maladies') or '').strip()

        if search:
            qs = qs.filter(
                Q(nom__icontains=search)
                | Q(prenom__icontains=search)
                | Q(dossier_number__icontains=search)
                | Q(id__icontains=search)
            )
        if num_dossier:
            qs = qs.filter(dossier_number__icontains=num_dossier)
        if date_naissance:
            qs = qs.filter(date_naissance=date_naissance)
        if sexe:
            qs = qs.filter(sexe=sexe)
        if autres_maladies:
            qs = qs.filter(autres_maladies__icontains=autres_maladies)

        data = [_dashboard_patient_payload(p) for p in qs]
        return JsonResponse({'ok': True, 'patients': data})

    try:
        is_json = bool(request.content_type and 'application/json' in request.content_type)
        if is_json:
            raw_data = json.loads(request.body or '{}')
            files = []
            relative_paths = []
        else:
            raw_data = request.POST
            files = request.FILES.getlist('files')
            relative_paths = request.POST.getlist('relative_paths')

        dossier_number = (raw_data.get('dossier_number') or raw_data.get('num_dossier') or '').strip()
        if not dossier_number:
            return JsonResponse({'ok': False, 'error': 'Le numero de dossier est obligatoire.'}, status=400)

        payload = {
            'dossier_number': dossier_number,
            # Keep compatibility with current creation UI that only asks for dossier/date/sexe.
            'nom': (raw_data.get('nom') or 'Patient').strip(),
            'prenom': (raw_data.get('prenom') or dossier_number).strip(),
            'date_naissance': raw_data.get('date_naissance') or '1900-01-01',
            'sexe': raw_data.get('sexe') or 'M',
            'telephone': raw_data.get('telephone') or None,
            'email': raw_data.get('email') or None,
            'pathologie': raw_data.get('pathologie') or None,
            'stade': raw_data.get('stade') or None,
            'antecedents': raw_data.get('antecedents') or None,
            'notes': raw_data.get('notes') or None,
            'autres_maladies': raw_data.get('autres_maladies') or raw_data.get('notes') or None,
        }

        serializer = PatientSerializer(data=payload, context={'request': request})
        if not serializer.is_valid():
            first_error = 'Invalid patient data'
            if serializer.errors:
                first_key = next(iter(serializer.errors))
                first_value = serializer.errors[first_key]
                if isinstance(first_value, list) and first_value:
                    first_error = str(first_value[0])
                else:
                    first_error = str(first_value)
            return JsonResponse({'ok': False, 'error': first_error, 'errors': serializer.errors}, status=400)

        with transaction.atomic():
            patient = serializer.save(doctor=request.user)

            # Optional in JSON mode, mandatory in multipart mode from NewPatient screen.
            if not is_json and not files:
                transaction.set_rollback(True)
                return JsonResponse({'ok': False, 'error': 'Un dossier contenant au moins un fichier est obligatoire.'}, status=400)

            for index, uploaded_file in enumerate(files):
                rel_from_client = relative_paths[index] if index < len(relative_paths) else ''
                safe_rel = _safe_relative_path(rel_from_client, uploaded_file.name)
                storage_path = f"patients/{patient.id}/mri_files/{safe_rel}"
                saved_path = default_storage.save(storage_path, uploaded_file)

                MRIFile.objects.create(
                    patient=patient,
                    file=saved_path,
                    original_filename=uploaded_file.name,
                    relative_path=safe_rel,
                    file_size=int(getattr(uploaded_file, 'size', 0) or 0),
                )

        out_serializer = PatientSerializer(patient, context={'request': request})
        return JsonResponse(
            {
                'ok': True,
                'message': 'Patient créé avec succès',
                'patient': out_serializer.data,
            },
            status=201,
        )
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Invalid JSON payload'}, status=400)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': f'Internal Server Error: {str(e)}'}, status=500)


@login_required
def patient_detail_update_delete_legacy(request, patient_id: uuid.UUID):
    print(f"Nadine Yassmine - patient_detail_update_delete endpoint works - patient_id: {patient_id}, method: {request.method}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    if request.method == 'GET':
        serializer = PatientSerializer(patient)
        return JsonResponse({'ok': True, 'patient': serializer.data})

    elif request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            # Validate dossier_number if it's being updated
            if 'dossier_number' in data and data['dossier_number'] != patient.dossier_number:
                dossier_number_validator = RegexValidator(regex=r'^DOS-\d{4}-\d{4}$', message='Dossier number must be in the format DOS-YYYY-NNNN.')
                try:
                    dossier_number_validator(data['dossier_number'])
                except Exception as e:
                    return JsonResponse({'ok': False, 'error': str(e)}, status=400)
                # Check for uniqueness if changed
                if Patient.objects.filter(dossier_number=data['dossier_number']).exclude(id=patient_id).exists():
                    return JsonResponse({'ok': False, 'error': f"Dossier number '{data['dossier_number']}' already exists."}, status=400)

            serializer = PatientSerializer(patient, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return JsonResponse({'ok': True, 'patient': serializer.data, 'message': 'Patient updated successfully'})
            return JsonResponse({'ok': False, 'errors': serializer.errors}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'ok': False, 'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            print(f"Nadine Yassmine - PATCH /patients/{patient_id}/ FAILED - Exception: {str(e)}", flush=True)
            import traceback
            print(f"Nadine Yassmine - PATCH /patients/{patient_id}/ traceback: {traceback.format_exc()}", flush=True)
            return JsonResponse({'ok': False, 'error': f'Internal Server Error: {str(e)}'}, status=500)

    elif request.method == 'DELETE':
        try:
            # Delete associated Series (using dossier_number as the link)
            series_to_delete = Series.objects.filter(patient_id=patient.dossier_number, user=request.user)
            for s in series_to_delete:
                job_dir = os.path.join(UPLOAD_DIR, s.job_id)
                if os.path.exists(job_dir):
                    shutil.rmtree(job_dir)
                    print(f"Nadine Yassmine - delete_patient - deleted series directory: {job_dir}")
                s.delete()
            
            # Delete MRI files directory
            patient_mri_dir = os.path.join(settings.MEDIA_ROOT, 'patients', str(patient.id))
            if os.path.exists(patient_mri_dir):
                shutil.rmtree(patient_mri_dir)
                print(f"Nadine Yassmine - delete_patient - deleted MRI files directory: {patient_mri_dir}")

            patient.delete() # This will CASCADE delete MRIFile objects
            return JsonResponse({'ok': True, 'message': 'Patient and all associated data deleted successfully'})
        except Exception as e:
            print(f"Nadine Yassmine - DELETE /patients/{patient_id}/ FAILED - Exception: {str(e)}", flush=True)
            import traceback
            print(f"Nadine Yassmine - DELETE /patients/{patient_id}/ traceback: {traceback.format_exc()}", flush=True)
            return JsonResponse({'ok': False, 'error': f'Internal Server Error: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@login_required
def upload_mri_files(request, patient_id: int):
    print(f"Nadine Yassmine - upload_mri_files endpoint works - patient_id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    files = request.FILES.getlist('files')
    if not files:
        return JsonResponse({'ok': False, 'error': 'No files provided'}, status=400)

    uploaded_count = 0
    errors = []
    relative_paths = request.POST.getlist('relative_paths')

    for index, f in enumerate(files):
        try:
            rel_from_client = relative_paths[index] if index < len(relative_paths) else ''
            safe_rel = _safe_relative_path(rel_from_client, f.name)
            storage_path = f"patients/{patient.id}/mri_files/{safe_rel}"
            saved_path = default_storage.save(storage_path, f)
            
            MRIFile.objects.create(
                patient=patient,
                file=saved_path,
                original_filename=f.name,
                relative_path=safe_rel,
                file_size=int(getattr(f, 'size', 0) or 0),
            )
            uploaded_count += 1
        except Exception as e:
            errors.append(f"Failed to upload {f.name}: {str(e)}")
            print(f"Nadine Yassmine - upload_mri_files FAILED for {f.name}: {str(e)}")

    if errors:
        return JsonResponse({'ok': False, 'message': f'Uploaded {uploaded_count} files with errors: {"; ".join(errors)}'}, status=400)
    return JsonResponse({'ok': True, 'message': f'Successfully uploaded {uploaded_count} files for patient {patient.dossier_number}'})


@api_view(['GET'])
@login_required
def list_mri_files(request, patient_id: int):
    print(f"Nadine Yassmine - list_mri_files endpoint works - patient_id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)
    mri_files = MRIFile.objects.filter(patient=patient).order_by('-uploaded_at')
    serializer = MRIFileSerializer(mri_files, many=True, context={'request': request})
    return JsonResponse({'ok': True, 'mri_files': serializer.data})


@csrf_exempt
@require_http_methods(["GET", "POST"])
@login_required
def mri_files_list_upload(request, patient_id: int):
    if request.method == 'GET':
        return list_mri_files(request, patient_id)
    return upload_mri_files(request, patient_id)


# The original get_patient_series and patient_file views remain, as they deal with Series objects
# which are still linked by CharField patient_id and job_id.
# If the intention was to replace Series with MRIFile for all image handling,
# then these views would need significant refactoring or removal.
# Based on the prompt, MRIFile is an *additional* model for patient-specific files,
# not necessarily replacing the Series concept for alignment jobs.


# The original delete_patient view is now replaced by the DELETE method in patient_detail_update_delete.
# The original patient_detail_view is now replaced by the GET method in patient_detail_update_delete.

# The original list_patients is now list_patients_create.


@csrf_exempt
@login_required
def reclamations_list_create(request):
    user = request.user
    if request.method == 'GET':
        queryset = Reclamation.objects.filter(user=user).order_by('-date')
        data = []
        for rec in queryset:
            rec_data = ReclamationSerializer(rec).data
            rec_data['fichier_url'] = rec.fichier.url if rec.fichier else None
            data.append(rec_data)
        return JsonResponse({'ok': True, 'reclamations': data})

    elif request.method == 'POST':
        description = request.POST.get('description', '')
        if not description:
            return JsonResponse({'ok': False, 'error': 'description required'}, status=400)
        fichier = request.FILES.get('fichier', None)
        try:
            reclamation = Reclamation.objects.create(user=user, description=description, fichier=fichier)
            rec_data = ReclamationSerializer(reclamation).data
            rec_data['fichier_url'] = reclamation.fichier.url if reclamation.fichier else None
            return JsonResponse({'ok': True, 'reclamation': rec_data}, status=201)
        except Exception as e:
            return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@csrf_exempt
@login_required
def reclamation_detail(request, reclamation_id):
    user = request.user
    try:
        reclamation = Reclamation.objects.get(id=reclamation_id, user=user)
    except Reclamation.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Reclamation not found'}, status=404)

    if request.method == 'GET':
        rec_data = ReclamationSerializer(reclamation).data
        rec_data['fichier_url'] = reclamation.fichier.url if reclamation.fichier else None
        return JsonResponse({'ok': True, 'reclamation': rec_data})

    if request.method in ['PATCH', 'PUT', 'POST']:
        payload = {}
        if request.method == 'POST':
            payload = request.POST or {}
        else:
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}

        description = payload.get('description')
        etat = payload.get('etat')
        fichier = request.FILES.get('fichier') if hasattr(request, 'FILES') else None

        if description is not None:
            description = str(description).strip()
            if not description:
                return JsonResponse({'ok': False, 'error': 'description required'}, status=400)
            reclamation.description = description

        if etat is not None:
            allowed = {'en_attente', 'payee', 'rejetee'}
            if etat not in allowed:
                return JsonResponse({'ok': False, 'error': 'etat invalide'}, status=400)
            reclamation.etat = etat

        if fichier is not None:
            if reclamation.fichier:
                try:
                    reclamation.fichier.delete(save=False)
                except Exception:
                    pass
            reclamation.fichier = fichier

        reclamation.save()
        rec_data = ReclamationSerializer(reclamation).data
        rec_data['fichier_url'] = reclamation.fichier.url if reclamation.fichier else None
        return JsonResponse({'ok': True, 'reclamation': rec_data, 'message': 'Reclamation modifiee avec succes'})

    if request.method == 'DELETE':
        reclamation.delete()
        return JsonResponse({'ok': True, 'message': 'Reclamation supprimee avec succes'})

    return JsonResponse({'ok': False, 'error': 'Method not allowed'}, status=405)



@api_view(['POST'])
@permission_classes([AllowAny])
def create_contact_request(request):
    data = request.data if hasattr(request, 'data') else {}

    subject_map = {
        'Demande de démonstration': 'demonstration',
        'Intégration clinique': 'integration',
        'Support technique': 'support',
        'Partenariat': 'partnership',
        'Autre': 'other',
    }

    normalized_subject = subject_map.get(str(data.get('subject', '')).strip(), str(data.get('subject', 'demonstration')).strip().lower())
    if normalized_subject not in {'demonstration', 'integration', 'support', 'partnership', 'other'}:
        normalized_subject = 'other'

    payload = {
        'full_name': data.get('full_name') or data.get('fullName') or '',
        'email': data.get('email') or '',
        'institution': data.get('institution') or '',
        'subject': normalized_subject,
        'message': data.get('message') or '',
    }

    serializer = ContactRequestSerializer(data=payload)
    if serializer.is_valid():
        contact = serializer.save()
        return Response(
            {
                'ok': True,
                'message': 'Contact request created successfully',
                'contact_request_id': contact.id,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(
        {
            'ok': False,
            'error': 'Invalid contact request data',
            'errors': serializer.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def _admin_scope_users(request):
    if request.user.is_staff:
        return User.objects.all()
    return User.objects.filter(id=request.user.id)


def _admin_scope_patients(request):
    if request.user.is_staff:
        return Patient.objects.all()
    return Patient.objects.filter(doctor=request.user)


def _admin_scope_series(request):
    if request.user.is_staff:
        return Series.objects.all()
    return Series.objects.filter(user=request.user)


def _admin_scope_reclamations(request):
    if request.user.is_staff:
        return Reclamation.objects.all()
    return Reclamation.objects.filter(user=request.user)


@api_view(['GET'])
@login_required
def admin_dashboard_overview(request):
    series_qs = _admin_scope_series(request)
    patients_qs = _admin_scope_patients(request)
    reclamations_qs = _admin_scope_reclamations(request)

    analyses_totales = int(series_qs.count())
    patients_actifs = int(patients_qs.count())
    rapports_generes = int(reclamations_qs.count())

    recent = []
    for s in series_qs.order_by('-created_at')[:6]:
        recent.append({
            'action': 'Analyse IRM cérébrale',
            'user': (s.user.username if s.user else 'Utilisateur inconnu'),
            'type': 'Segmentation',
            'status': 'segmentation',
            'date': s.created_at.isoformat() if s.created_at else None,
        })
    for r in reclamations_qs.order_by('-date')[:6]:
        recent.append({
            'action': f'Réclamation {r.numero}',
            'user': r.user.username,
            'type': 'Rapport',
            'status': 'rapport',
            'date': r.date.isoformat() if r.date else None,
        })
    recent.sort(key=lambda x: x.get('date') or '', reverse=True)

    return JsonResponse({
        'ok': True,
        'stats': {
            'analyses_totales': analyses_totales,
            'patients_actifs': patients_actifs,
            'rapports_generes': rapports_generes,
            'taux_precision': 99.2,
            'deltas': {
                'analyses_totales': 12.5,
                'patients_actifs': 8.2,
                'rapports_generes': 23.1,
                'taux_precision': 0.3,
            }
        },
        'activity': recent[:8],
        'repartition': [
            {'label': 'Segmentation IRM', 'percent': 42},
            {'label': 'PET-Scan', 'percent': 28},
            {'label': 'SPECT', 'percent': 18},
            {'label': 'Rapports', 'percent': 12},
        ]
    })


@api_view(['GET'])
@login_required
def admin_dashboard_accounts(request):
    users_qs = _admin_scope_users(request).order_by('-date_joined')
    accounts = []
    for i, u in enumerate(users_qs[:100], start=1):
        if not u.last_login:
            status_label = 'En attente'
        else:
            status_label = 'Actif' if u.is_active else 'Inactif'
        accounts.append({
            'id': f'USR-{i:03d}',
            'username': u.username,
            'full_name': (u.get_full_name() or u.username),
            'email': u.email or '-',
            'role': 'Super Admin' if u.is_superuser else ('Admin' if u.is_staff else 'Clinicien'),
            'status': status_label,
            'last_login': u.last_login.isoformat() if u.last_login else None,
        })

    return JsonResponse({'ok': True, 'count': len(accounts), 'accounts': accounts})


@api_view(['GET'])
@login_required
def admin_dashboard_history(request):
    series_qs = _admin_scope_series(request)
    reclamations_qs = _admin_scope_reclamations(request)

    items = []
    for s in series_qs.order_by('-created_at')[:20]:
        items.append({
            'title': 'Analyse IRM cérébrale',
            'subtitle': f"{s.user.username if s.user else 'Utilisateur'} · Série {s.job_id[:8]}",
            'type': 'Segmentation',
            'status': 'segmentation',
            'date': s.created_at.isoformat() if s.created_at else None,
        })
    for r in reclamations_qs.order_by('-date')[:20]:
        items.append({
            'title': f'Réclamation {r.numero}',
            'subtitle': f'{r.user.username} · Ticket support',
            'type': 'Rapport',
            'status': 'rapport',
            'date': r.date.isoformat() if r.date else None,
        })

    items.sort(key=lambda x: x.get('date') or '', reverse=True)
    return JsonResponse({'ok': True, 'items': items[:20]})


@api_view(['GET'])
@login_required
def admin_dashboard_settings(request):
    user = request.user
    return JsonResponse({
        'ok': True,
        'profile': {
            'full_name': user.get_full_name() or user.username,
            'email': user.email or '-',
            'role': 'Super Admin' if user.is_superuser else ('Admin' if user.is_staff else 'Clinicien'),
        },
        'security': {
            'two_factor': True,
            'session_expiration': '30 min',
            'password_rotation': '90 jours',
        },
        'notifications': {
            'email': True,
            'push': True,
            'auto_reports': False,
            'security_alerts': True,
        },
        'platform': {
            'language': 'Français',
            'timezone': 'Europe/Paris (UTC+2)',
            'date_format': 'DD/MM/YYYY',
        }
    })
