import os
import io
import sys
import zipfile
import tempfile
import shutil
import json
import uuid
import base64
from datetime import datetime
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from .models import Series
from django.shortcuts import get_object_or_404

import numpy as np
import cv2
from PIL import Image, ImageOps

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
    print(f"Yassmine now the register endpoint works - username: {data.get('username')}")
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        print("Yassmine now the register validation FAILED - missing username or password")
        return JsonResponse({'ok': False, 'error': 'username and password required'}, status=400)

    try:
        with transaction.atomic():
            if User.objects.filter(username=username).exists():
                print(f"Yassmine now the register FAILED - username exists: {username}")
                return JsonResponse({'ok': False, 'error': 'username exists'}, status=400)
            User.objects.create_user(username=username, password=password)
            print(f"Yassmine now the register SUCCESS for user: {username}")
            return JsonResponse({'ok': True, 'message': 'Compte créé avec succès'})
    except IntegrityError as e:
        print(f"Yassmine now the register FAILED - IntegrityError for username: {username}, error: {str(e)}")
        return JsonResponse({'ok': False, 'error': 'username already exists'}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''

        user = authenticate(request, username=username, password=password)
        if user is None:
            return JsonResponse({'ok': False, 'error': 'invalid credentials'}, status=401)

        login(request, user)
        request.session['username'] = username
        return JsonResponse({'ok': True, 'message': 'Connexion réussie', 'user': username})
    except Exception as e:
        print(f"Error in login: {e}")
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
        return JsonResponse({'logged_in': True, 'user': request.user.username})
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


@csrf_exempt
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

    print(f"Yassmine now the delete_patient SUCCESS - patient_id: {patient_id}, deleted {deleted_count} series")
    return JsonResponse({'message': f'patient deleted successfully ({deleted_count} series)'})