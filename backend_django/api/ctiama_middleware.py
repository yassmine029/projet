"""
Middleware CTIAMA + Authentification DRF pour le mode déploiement sans auth.

Comment ça marche :
  1. On lit la variable d'environnement CTIAMA_MODE au démarrage du serveur.
  2. Si CTIAMA_MODE=true ET que la requête arrive sans utilisateur connecté
     (AnonymousUser), on remplace automatiquement par le compte service "ctiama".
  3. Tout le reste du code Django (vues, filtres patients, etc.) fonctionne
     normalement — il voit juste un utilisateur "ctiama" connecté.

En local (CTIAMA_MODE non défini) : ce middleware ne fait RIEN du tout.
"""
import os
from django.contrib.auth.models import AnonymousUser


# Lu une seule fois au démarrage du serveur
_CTIAMA_MODE         = os.getenv('CTIAMA_MODE', '').lower() in ('1', 'true', 'yes')
_CTIAMA_SERVICE_USER = os.getenv('CTIAMA_SERVICE_USER', 'ctiama')

# Cache du compte service — chargé une seule fois en mémoire
_service_user_cache = None


def _get_service_user():
    """Charge le compte service depuis la DB (une seule fois)."""
    global _service_user_cache
    if _service_user_cache is not None:
        return _service_user_cache
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        _service_user_cache = User.objects.get(username=_CTIAMA_SERVICE_USER)
        print(f'[CTIAMA] Compte service chargé : {_CTIAMA_SERVICE_USER}')
    except Exception as e:
        print(f'[CTIAMA] ATTENTION : compte service introuvable ({e}). Vérifiez que create_ctiama_user a été exécuté.')
        _service_user_cache = None
    return _service_user_cache


class CtiamaModeMiddleware:
    """
    Middleware qui injecte le user service sur chaque requête en mode CTIAMA.
    En local (CTIAMA_MODE non défini), __call__ est appelé mais ne fait rien.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        if _CTIAMA_MODE:
            print(f'[CTIAMA] Mode CTIAMA activé — auto-login avec "{_CTIAMA_SERVICE_USER}"')
        else:
            print('[CTIAMA] Mode local — middleware inactif')

    def __call__(self, request):
        # En local → on ne touche à rien
        if not _CTIAMA_MODE:
            return self.get_response(request)

        # En CTIAMA → si pas de user connecté, on injecte le compte service
        if isinstance(getattr(request, 'user', None), AnonymousUser):
            user = _get_service_user()
            if user is not None:
                request.user = user

        return self.get_response(request)


# ── Authentification DRF pour CTIAMA ────────────────────────────────────────
# DRF fait sa propre vérification d'auth APRÈS le middleware Django.
# Sans cette classe, DRF ignore le user injecté par le middleware et retourne 403.
# Cette classe dit à DRF : "si CTIAMA_MODE=true, utilise le compte service directement".

class CtiamaDRFAuthentication:
    """
    Classe d'authentification DRF pour le mode CTIAMA.
    Retourne le compte service automatiquement sans vérifier de session/token.
    En local (CTIAMA_MODE=false) : retourne None → DRF utilise ses classes normales.
    """

    def authenticate(self, request):
        if not _CTIAMA_MODE:
            return None   # DRF continue avec les autres classes d'auth normales
        user = _get_service_user()
        if user is None:
            return None
        return (user, None)   # (user, auth_token) — None = pas de token

    def authenticate_header(self, request):
        return None
