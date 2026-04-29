"""Règles d'accès pour les sessions « mode urgence » (comptes en attente)."""

from __future__ import annotations

from typing import Any, Optional

from django.http import JsonResponse


def is_emergency_session(request) -> bool:
    return bool(
        getattr(request, "session", None) is not None
        and request.session.get("emergency_access")
    )


def deny_if_patient_session_mismatch(
    request,
    patient: Any,
    *,
    legacy_error: bool = False,
) -> Optional[JsonResponse]:
    """
    - Dossiers emergency_temp : accessibles uniquement pendant une session urgence.
    - Session urgence : pas d'accès aux dossiers patients « normaux » (hors import urgence).
    If legacy_error is True, use {'error': msg} only (endpoints volume hérités).
    """
    em = is_emergency_session(request)
    temp = getattr(patient, "emergency_temp", False)
    if temp and not em:
        msg = "Ce dossier temporaire n'est plus accessible."
        payload = {"error": msg} if legacy_error else {"ok": False, "error": msg}
        return JsonResponse(payload, status=403)
    if em and not temp:
        msg = "Mode urgence : utilisez uniquement un dossier importé dans cette session."
        payload = {"error": msg} if legacy_error else {"ok": False, "error": msg}
        return JsonResponse(payload, status=403)
    return None
