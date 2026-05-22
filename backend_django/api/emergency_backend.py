from django.contrib.auth import get_user_model


class EmergencyOnlyBackend:
    """
    Backend d'authentification réservé aux sessions d'urgence.

    authenticate() retourne toujours None — ce backend ne peut pas initier
    une session. Il est invoqué exclusivement via login(..., backend=...) dans
    la vue emergency_login, et Django l'utilise ensuite pour récupérer
    l'utilisateur depuis la session (get_user) sans vérifier is_active.
    """

    def authenticate(self, request, **kwargs):
        return None

    def get_user(self, user_id):
        User = get_user_model()
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None
