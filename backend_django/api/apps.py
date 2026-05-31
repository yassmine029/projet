from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    
    def ready(self):
        """
        Appelé au démarrage de Django.
        Pré-télécharge l'atlas Harvard-Oxford localement s'il ne l'est pas déjà.
        """
        from .atlas_cache import ensure_atlas_cached
        ensure_atlas_cached(verbose=True)
