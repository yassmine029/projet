"""
Crée le compte service CTIAMA utilisé quand CTIAMA_MODE=true.
Appelé automatiquement au démarrage du conteneur Docker.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Crée le compte service CTIAMA (auto-login en mode déploiement)'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='ctiama')
        parser.add_argument('--password', default='ctiama_service_2026!')
        parser.add_argument('--email',    default='ctiama@braincore.med')

    def handle(self, *args, **options):
        User = get_user_model()
        username = options['username']

        if User.objects.filter(username=username).exists():
            self.stdout.write(f'[CTIAMA] Compte "{username}" existe déjà — rien à faire.')
            return

        User.objects.create_user(
            username=username,
            email=options['email'],
            password=options['password'],
            first_name='CTIAMA',
            last_name='Service',
            is_active=True,
        )
        self.stdout.write(
            self.style.SUCCESS(f'[CTIAMA] Compte service "{username}" créé avec succès.')
        )
