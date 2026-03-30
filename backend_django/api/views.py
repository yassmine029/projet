import os
import io
import sys
import zipfile
import tempfile
import shutil
import json
import uuid
import base64
import threading
from datetime import datetime
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.core.validators import RegexValidator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Series
from django.shortcuts import get_object_or_404, Http404

import numpy as np
import cv2
from PIL import Image, ImageOps

from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
# from django.core.paginator import Paginator # Not used, can be removed
from django.db.models import Q
from .models import Series, PasswordResetToken, EmergencyLoginAttempt, Patient, Reclamation, MRIFile
from .serializers import ReclamationSerializer, PatientSerializer, MRIFileSerializer

# auto_registration (ANTs) supprimé — MINE uniquement
from .mine_registration import run_mine_registration

# Setup logging - just flush stdout for real-time output
sys.stdout.flush()
sys.stderr.flush()

# In-memory JOBS like original app
JOBS = {}

UPLOAD_DIR = settings.MEDIA_ROOT
MEDIA_ROOT = settings.MEDIA_ROOT
os.makedirs(UPLOAD_DIR, exist_ok=True)


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


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    print(f"Nadine Yassmine - register endpoint works - username: {data.get('username')}")
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        print("Nadine Yassmine - register validation FAILED - missing username or password")
        return JsonResponse({'ok': False, 'error': 'username and password required'}, status=400)

    try:
        with transaction.atomic():
            if User.objects.filter(username=username).exists():
                print(f"Nadine Yassmine - register FAILED - username exists: {username}")
                return JsonResponse({'ok': False, 'error': 'username exists'}, status=400)
            User.objects.create_user(username=username, password=password)
            print(f"Nadine Yassmine - register SUCCESS for user: {username}")
            return JsonResponse({'ok': True, 'message': 'Compte créé avec succès'})
    except IntegrityError as e:
        print(f"Nadine Yassmine - register FAILED - IntegrityError for username: {username}, error: {str(e)}")
        return JsonResponse({'ok': False, 'error': 'username already exists'}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        print(f"Nadine Yassmine - login endpoint reached - body: {request.body}")
        data = json.loads(request.body)
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        print(f"Nadine Yassmine - login attempt - username: {username}")

        user = authenticate(request, username=username, password=password)
        if user is None:
            print(f"Nadine Yassmine - login failed - user not found: {username}")
            return JsonResponse({'ok': False, 'error': 'invalid credentials'}, status=401)

        login(request, user)
        request.session['username'] = username
        print(f"Nadine Yassmine - login success - user: {username}")
        return JsonResponse({'ok': True, 'message': 'Connexion réussie', 'user': username})
    except Exception as e:
        import traceback
        print(f"Nadine Yassmine - Error in login: {e}")
        print(f"Nadine Yassmine - traceback: {traceback.format_exc()}")
        return JsonResponse({'ok': False, 'error': 'Internal Server Error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    print(f"Nadine Yassmine - logout endpoint works")
    logout(request)
    request.session.flush()
    print(f"Nadine Yassmine - logout SUCCESS")
    return JsonResponse({'message': 'Déconnecté avec succès'})


@api_view(['GET'])
def check_session(request):
    if request.user and request.user.is_authenticated:
        print(f"Nadine Yassmine - check_session works - user: {request.user.username}")
        return JsonResponse({'logged_in': True, 'user': request.user.username})
    print(f"Nadine Yassmine - check_session works - no authenticated user")
    return JsonResponse({'logged_in': False})


@csrf_exempt
@require_http_methods(["POST"])
def upload(request):
    print(f"Nadine Yassmine - upload endpoint REACHED - authenticated: {request.user.is_authenticated}, user: {request.user.username if request.user.is_authenticated else 'anonymous'}")
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - upload endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    ref = request.FILES.get('ref_image')
    pat = request.FILES.get('patient_image')
    patient_id = (request.POST.get('patient_id') or '').strip() or 'Unknown'
    print(f"Nadine Yassmine - upload endpoint works - patient_id: {patient_id}, user: {request.user.username}, has_ref: {ref is not None}, has_pat: {pat is not None}")
    if not ref or not pat:
        print(f"Nadine Yassmine - upload FAILED - missing files for patient_id: {patient_id}")
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
    print(f"Nadine Yassmine - upload SUCCESS - job_id: {job_id}")
    return JsonResponse({'jobId': job_id, 'refPreview': make_preview(ref_path), 'patPreview': make_preview(pat_path)})


@csrf_exempt
@require_http_methods(["POST"])
def align(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - align endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        print(f"Nadine Yassmine - align FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid JSON'}, status=400)
    job_id = data.get('jobId')
    X = data.get('ct_points')
    Y = data.get('pat_points')
    use_warped = data.get('use_warped', False)  # ✅ mode hybride: utiliser image MINE recalée
    print(f"Nadine Yassmine - align endpoint works - job_id: {job_id}, use_warped: {use_warped}, user: {request.user.username}")
    if not job_id or X is None or Y is None:
        print(f"Nadine Yassmine - align FAILED - missing data for job_id: {job_id}")
        return JsonResponse({'error': 'missing data'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
        if not series.files or len(series.files) < 2:
            print(f"Nadine Yassmine - align FAILED - job files not found in DB: {job_id}")
            return JsonResponse({'error': 'job files not found'}, status=404)
        ref_path = os.path.join(UPLOAD_DIR, series.files[0])
        pat_path = os.path.join(UPLOAD_DIR, series.files[1])
        print(f"Nadine Yassmine - align LOADED job from DB - job_id: {job_id}")
    except Series.DoesNotExist:
        print(f"Nadine Yassmine - align FAILED - job not found: {job_id}")
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
        print(f"Nadine Yassmine - align FAILED - invalid points shape for job_id: {job_id}")
        return JsonResponse({'error': 'invalid points'}, status=400)

    ref = cv2.imread(ref_path, cv2.IMREAD_GRAYSCALE)
    pat = cv2.imread(pat_path, cv2.IMREAD_GRAYSCALE)
    if ref is None or pat is None:
        print(f"Nadine Yassmine - align FAILED - cannot read images for job_id: {job_id}")
        return JsonResponse({'error': 'cannot read images'}, status=500)
    ref = cv2.resize(ref, (512, 512))
    pat = cv2.resize(pat, (512, 512))
    # ✅ RANSAC estimateAffinePartial2D — plus robuste que procrustes
    # ignore automatiquement les points mal placés (outliers)
    src_pts = Y.astype(np.float32)
    dst_pts = X.astype(np.float32)
    M, inliers = cv2.estimateAffinePartial2D(
        src_pts, dst_pts,
        method=cv2.RANSAC,
        ransacReprojThreshold=3,
        maxIters=2000,
        confidence=0.99
    )
    if M is None:
        # fallback procrustes si RANSAC échoue
        _, Z, tform = procrustes(X, Y)
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
        print(f"Nadine Yassmine - align SAVED tform to DB for job_id: {job_id}")
    except Exception as e:
        print(f"Nadine Yassmine - align WARNING - failed to save tform: {str(e)}")

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

    print(f"Nadine Yassmine - align SUCCESS - job_id: {job_id}, RMSE: {metrics['rmse']}")

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
            print(f"Nadine Yassmine - auto_align endpoint FAILED - not authenticated")
            return JsonResponse({'error': 'login required'}, status=401)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            print(f"Nadine Yassmine - auto_align FAILED - invalid JSON")
            return JsonResponse({'error': 'invalid JSON'}, status=400)

        job_id = data.get('jobId')
        transform_type = data.get('transform', 'SyN')
        print(f"Nadine Yassmine - auto_align endpoint works - job_id: {job_id}, transform: {transform_type}, user: {request.user.username}")

        if not job_id:
            print(f"Nadine Yassmine - auto_align FAILED - missing jobId")
            return JsonResponse({'error': 'missing jobId'}, status=400)

        try:
            series = Series.objects.get(job_id=job_id, user=request.user)
            if not series.files or len(series.files) < 2:
                print(f"Nadine Yassmine - auto_align FAILED - job files not found in DB: {job_id}")
                return JsonResponse({'error': 'job files not found'}, status=404)
            ref_path = os.path.join(UPLOAD_DIR, series.files[0])
            pat_path = os.path.join(UPLOAD_DIR, series.files[1])
            print(f"Nadine Yassmine - auto_align LOADED job from DB - job_id: {job_id}")
        except Series.DoesNotExist:
            print(f"Nadine Yassmine - auto_align FAILED - job not found: {job_id}")
            return JsonResponse({'error': 'job not found'}, status=404)

        if not os.path.exists(ref_path) or not os.path.exists(pat_path):
            print(f"Nadine Yassmine - auto_align FAILED - image files not found on disk")
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
            print(f"Nadine Yassmine - auto_align FAILED - MINE failed")
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
            print(f"Nadine Yassmine - auto_align FAILED - alignment failed: {metrics.get('error')}")
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
            print(f"Nadine Yassmine - auto_align SAVED tform to DB for job_id: {job_id}")
        except Exception as e:
            print(f"Nadine Yassmine - auto_align WARNING - failed to save tform: {str(e)}")

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
            print(f"Nadine Yassmine - auto_align WARNING - failed to read warped image: {str(e)}")
            return JsonResponse({
                'success': True,
                'message': 'Recalage automatique réussi',
                'metrics': metrics,
                'warped_path': os.path.relpath(warped_path, UPLOAD_DIR)
            })

        print(f"Nadine Yassmine - auto_align SUCCESS - job_id: {job_id}, RMSE: {metrics.get('rmse')}")

        return JsonResponse({
            'success': True,
            'metrics': metrics,
            'image': img_data,
            'message': 'Recalage réussi'
        })

    except Exception as e:
        print(f"Nadine Yassmine - auto_align CRITICAL ERROR: {str(e)}")
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
        print(f"Nadine Yassmine - upload_series FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    job_id = request.POST.get('jobId')
    patient_id = (request.POST.get('patient_id') or '').strip() or None
    files = request.FILES.getlist('files')

    print(f"Nadine Yassmine - upload_series endpoint works - job_id: {job_id}, patient_id: {patient_id}, files: {len(files)}")

    if not job_id or not files:
        print(f"Nadine Yassmine - upload_series FAILED - missing jobId or files")
        return JsonResponse({'error': 'missing jobId or files'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Nadine Yassmine - upload_series FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    tform = series.tform
    if not tform:
        print(f"Nadine Yassmine - upload_series FAILED - no tform for job_id: {job_id}")
        return JsonResponse({
            'error': 'transformation not found',
            'message': "Tu dois faire l'alignement d'abord. Clique sur 'Aligner' pour calculer la transformation."
        }, status=404)

    M = affine_from_tform(tform)

    upload_dir = os.path.join(UPLOAD_DIR, job_id, 'series')
    if os.path.exists(upload_dir):
        print(f"Nadine Yassmine - upload_series DELETING old series directory: {upload_dir}")
        shutil.rmtree(upload_dir)
    os.makedirs(upload_dir, exist_ok=True)

    print(f"Nadine Yassmine - upload_series saving to directory: {upload_dir}")

    saved_files = []
    skipped_files = 0
    for file in files:
        try:
            file_path = os.path.join(upload_dir, file.name)
            with open(file_path, 'wb') as f:
                for chunk in file.chunks():
                    f.write(chunk)
            print(f"Nadine Yassmine - upload_series SAVED file: {file.name}")

            transformed_ok = False
            try:
                img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
                if img is None:
                    print(f"Nadine Yassmine - upload_series WARNING - not an image or unreadable: {file.name}")
                else:
                    img = cv2.resize(img, (512, 512))
                    warped = cv2.warpAffine(img, M, (512, 512))
                    ok = cv2.imwrite(file_path, warped)
                    if ok:
                        print(f"Nadine Yassmine - upload_series TRANSFORMED file: {file.name}")
                        transformed_ok = True
                    else:
                        print(f"Nadine Yassmine - upload_series WARNING - failed to write transformed file: {file.name}")
            except Exception as cv_err:
                print(f"Nadine Yassmine - upload_series WARNING - transformation failed for {file.name}: {str(cv_err)}")

            if transformed_ok and os.path.exists(file_path):
                rel_path = os.path.relpath(file_path, UPLOAD_DIR).replace('\\', '/')
                saved_files.append(rel_path)
            else:
                skipped_files += 1
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as rm_err:
                    print(f"Nadine Yassmine - upload_series WARNING - cleanup failed for {file.name}: {str(rm_err)}")
        except Exception as e:
            print(f"Nadine Yassmine - upload_series FAILED processing file {file.name}: {str(e)}")
            skipped_files += 1

    series.files = saved_files
    if patient_id:
        series.patient_id = patient_id
    series.save()

    print(f"Nadine Yassmine - upload_series SUCCESS - processed {len(saved_files)} files for job_id: {job_id}")
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
        print(f"Nadine Yassmine - get_job_tform FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Nadine Yassmine - get_job_tform endpoint works - job_id: {job_id}")

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Nadine Yassmine - get_job_tform FAILED - job not found: {job_id}")
        return JsonResponse({'error': 'job not found'}, status=404)

    tform = series.tform
    if not tform:
        print(f"Nadine Yassmine - get_job_tform FAILED - no tform for job_id: {job_id}")
        return JsonResponse({
            'error': 'transformation not found',
            'message': "Tu dois faire l'alignement d'abord. Clique sur 'Aligner' pour calculer la transformation."
        }, status=404)

    print(f"Nadine Yassmine - get_job_tform SUCCESS - job_id: {job_id}")
    return JsonResponse({'tform': tform})


@api_view(['GET'])
def history(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - history endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)
    print(f"Nadine Yassmine - history endpoint works - user: {request.user.username}")
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
    print(f"Nadine Yassmine - history SUCCESS - returned {len(out)} jobs")
    return JsonResponse(out, safe=False)


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def patients_list_create(request):
    print(f"Nadine Yassmine - patients_list_create endpoint - user: {request.user.username}", flush=True)
    if request.method == 'GET':
        patients = Patient.objects.filter(doctor=request.user)
        serializer = PatientSerializer(patients, many=True)
        return JsonResponse({'ok': True, 'patients': serializer.data})
    
    elif request.method == 'POST':
        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(doctor=request.user)
            return JsonResponse({
                'ok': True, 
                'patient': serializer.data, 
                'message': 'Patient créé avec succès'
            }, status=201)
        return JsonResponse({'ok': False, 'errors': serializer.errors}, status=400)


@csrf_exempt
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def patient_detail_update_delete(request, patient_id):
    print(f"Nadine Yassmine - patient_detail_update_delete - id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    if request.method == 'GET':
        serializer = PatientSerializer(patient)
        return JsonResponse({'ok': True, 'patient': serializer.data})

    elif request.method == 'PATCH':
        serializer = PatientSerializer(patient, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse({'ok': True, 'patient': serializer.data, 'message': 'Patient mis à jour avec succès'})
        return JsonResponse({'ok': False, 'errors': serializer.errors}, status=400)

    elif request.method == 'DELETE':
        # Clean up related files/series if necessary before deletion
        series_to_delete = Series.objects.filter(patient_id=patient.dossier_number, user=request.user)
        for s in series_to_delete:
            job_dir = os.path.join(UPLOAD_DIR, s.job_id)
            if os.path.exists(job_dir):
                shutil.rmtree(job_dir)
            s.delete()
        
        patient.delete()
        return JsonResponse({'ok': True, 'message': 'Patient supprimé avec succès'})


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mri_files_list_upload(request, patient_id):
    print(f"Nadine Yassmine - mri_files_list_upload - id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    if request.method == 'GET':
        mri_files = MRIFile.objects.filter(patient=patient).order_by('-uploaded_at')
        serializer = MRIFileSerializer(mri_files, many=True)
        return JsonResponse({'ok': True, 'mri_files': serializer.data})

    elif request.method == 'POST':
        files = request.FILES.getlist('files')
        if not files:
            return JsonResponse({'ok': False, 'error': 'No files provided'}, status=400)

        patient_mri_dir = os.path.join(settings.MEDIA_ROOT, 'patients', str(patient.id), 'mri_files')
        os.makedirs(patient_mri_dir, exist_ok=True)

        uploaded_count = 0
        for f in files:
            file_path = os.path.join(patient_mri_dir, f.name)
            with open(file_path, 'wb+') as destination:
                for chunk in f.chunks():
                    destination.write(chunk)
            
            MRIFile.objects.create(
                patient=patient,
                file=os.path.relpath(file_path, settings.MEDIA_ROOT),
                original_filename=f.name
            )
            uploaded_count += 1

        return JsonResponse({
            'ok': True, 
            'message': f'Successfully uploaded {uploaded_count} files'
        }, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def apply_tform_to_series(request):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - apply_tform endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        print(f"Nadine Yassmine - apply_tform FAILED - invalid JSON")
        return JsonResponse({'error': 'invalid JSON'}, status=400)

    job_id = data.get('jobId')
    source_dir = data.get('source_dir', '')
    pattern = data.get('pattern', '*.*')

    print(f"Nadine Yassmine - apply_tform endpoint works - job_id: {job_id}, source_dir: {source_dir}")

    if not job_id:
        print(f"Nadine Yassmine - apply_tform FAILED - missing jobId")
        return JsonResponse({'error': 'missing jobId'}, status=400)

    try:
        series = Series.objects.get(job_id=job_id, user=request.user)
        tform = series.tform
        if not tform:
            print(f"Nadine Yassmine - apply_tform FAILED - no tform for job_id: {job_id}")
            return JsonResponse({'error': 'transformation not found'}, status=404)
    except Series.DoesNotExist:
        print(f"Nadine Yassmine - apply_tform FAILED - job not found: {job_id}")
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
                    print(f"Nadine Yassmine - apply_tform WARNING - failed to process {filename}: {str(e)}")
                    continue

        print(f"Nadine Yassmine - apply_tform SUCCESS - job_id: {job_id}, processed {count} files")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="transformed_{job_id}.zip"'
            return response

    except Exception as e:
        print(f"Nadine Yassmine - apply_tform FAILED - error: {str(e)}")
        return JsonResponse({'error': f'transformation failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@api_view(['GET'])
def download_series(request, series_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - download_series endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Nadine Yassmine - download_series endpoint works - series_id: {series_id}, user: {request.user.username}")

    try:
        series = Series.objects.get(id=series_id, user=request.user)
    except Series.DoesNotExist:
        print(f"Nadine Yassmine - download_series FAILED - series not found: {series_id}")
        return JsonResponse({'error': 'series not found'}, status=404)

    if not series.files:
        print(f"Nadine Yassmine - download_series FAILED - no files in series: {series_id}")
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

        print(f"Nadine Yassmine - download_series SUCCESS - series_id: {series_id}, files: {len(series.files)}")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="series_{series.patient_id}_{series_id}.zip"'
            return response

    except Exception as e:
        print(f"Nadine Yassmine - download_series FAILED - error: {str(e)}")
        return JsonResponse({'error': f'download failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@api_view(['GET'])
def download_patient(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - download_patient endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Nadine Yassmine - download_patient endpoint works - patient_id: {patient_id}, user: {request.user.username}")

    series_list = Series.objects.filter(patient_id=patient_id, user=request.user)

    if not series_list.exists():
        print(f"Nadine Yassmine - download_patient FAILED - no series found for patient: {patient_id}")
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

        print(f"Nadine Yassmine - download_patient SUCCESS - patient_id: {patient_id}, series: {series_list.count()}")

        with open(zip_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="patient_{patient_id}.zip"'
            return response

    except Exception as e:
        print(f"Nadine Yassmine - download_patient FAILED - error: {str(e)}")
        return JsonResponse({'error': f'download failed: {str(e)}'}, status=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@csrf_exempt
@api_view(['DELETE'])
def delete_patient(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f"Nadine Yassmine - delete_patient endpoint FAILED - not authenticated")
        return JsonResponse({'error': 'login required'}, status=401)

    print(f"Nadine Yassmine - delete_patient endpoint works - patient_id: {patient_id}, user: {request.user.username}")

    series_list = Series.objects.filter(patient_id=patient_id, user=request.user)

    if not series_list.exists():
        print(f"Nadine Yassmine - delete_patient FAILED - no series found for patient: {patient_id}")
        return JsonResponse({'error': 'no series found for patient'}, status=404)

    deleted_count = 0
    for series in series_list:
        job_id = series.job_id
        try:
            job_dir = os.path.join(UPLOAD_DIR, job_id)
            if os.path.exists(job_dir):
                shutil.rmtree(job_dir)
                print(f"Nadine Yassmine - delete_patient - deleted directory: {job_dir}")
        except Exception as e:
            print(f"Nadine Yassmine - delete_patient WARNING - failed to delete files for series {series.id}: {str(e)}")

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
            user = User.objects.get(username=email)
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
            user = User.objects.get(username=email)
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

        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        reset_link = f"{frontend_url}/reset-password?token={reset_token.token}"

        subject = "VisionMed - Lien de réinitialisation de mot de passe"
        html_message = f"""
        <html><body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #2563eb;">VisionMed</h1>
                <h2>Réinitialisation de votre mot de passe</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe VisionMed.</p>
                <p style="margin: 30px 0;">
                    <a href="{reset_link}" style="padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                        Réinitialiser mon mot de passe
                    </a>
                </p>
                <p style="color: #666; font-size: 12px;">Ce lien reste valide pendant 15 minutes.</p>
            </div>
        </body></html>
        """
        plain_message = f"Réinitialisez votre mot de passe VisionMed:\n\n{reset_link}\n\nCe lien est valide 15 minutes."

        try:
            print(f"Nadine Yassmine - forgot_password: Attempting to send email to {email}", flush=True)
            print(f"Nadine Yassmine - EMAIL_BACKEND: {settings.EMAIL_BACKEND}", flush=True)
            print(f"Nadine Yassmine - DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}", flush=True)
            print(f"Nadine Yassmine - reset_link: {reset_link}", flush=True)
            sys.stdout.flush()
            
            # Send email asynchronously to avoid blocking HTTP response
            send_email_async(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message
            )
            print(f"Nadine Yassmine - forgot_password: Email request queued for {email}", flush=True)
            sys.stdout.flush()
        except Exception as e:
            print(f"Nadine Yassmine - Error queuing email: {str(e)}", flush=True)
            import traceback
            print(f"Nadine Yassmine - traceback: {traceback.format_exc()}", flush=True)
            sys.stdout.flush()

        return JsonResponse({'ok': True, 'message': 'Si cet email existe, un lien de réinitialisation sera envoyé.'})

    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'invalid JSON'}, status=400)
    except Exception as e:
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


@login_required
def patient_detail_update_delete(request, patient_id: uuid.UUID):
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
def upload_mri_files(request, patient_id: uuid.UUID):
    print(f"Nadine Yassmine - upload_mri_files endpoint works - patient_id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)

    files = request.FILES.getlist('files')
    if not files:
        return JsonResponse({'ok': False, 'error': 'No files provided'}, status=400)

    patient_mri_dir = os.path.join(settings.MEDIA_ROOT, 'patients', str(patient.id), 'mri_files')
    os.makedirs(patient_mri_dir, exist_ok=True)

    uploaded_count = 0
    errors = []
    for f in files:
        try:
            file_path = os.path.join(patient_mri_dir, f.name)
            with open(file_path, 'wb+') as destination:
                for chunk in f.chunks():
                    destination.write(chunk)
            
            MRIFile.objects.create(
                patient=patient,
                file=os.path.relpath(file_path, settings.MEDIA_ROOT),
                original_filename=f.name
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
def list_mri_files(request, patient_id: uuid.UUID):
    print(f"Nadine Yassmine - list_mri_files endpoint works - patient_id: {patient_id}, user: {request.user.username}")
    patient = get_object_or_404(Patient, id=patient_id, doctor=request.user)
    mri_files = MRIFile.objects.filter(patient=patient).order_by('-uploaded_at')
    serializer = MRIFileSerializer(mri_files, many=True)
    return JsonResponse({'ok': True, 'mri_files': serializer.data})


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