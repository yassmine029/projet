"""
Archive un compte par email : libère l'adresse dans User.username et/ou User.email
pour permettre une nouvelle inscription avec la même adresse.

Usage:
  python manage.py archive_user_by_email nadinehammami5@gmail.com
  python manage.py archive_user_by_email user@example.com --no-deactivate
"""

import uuid

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from api.models import DoctorProfile, EmergencyLoginAttempt


def _archived_username(user_pk: int) -> str:
    """Identifiant unique, valide comme username Django (évite collision)."""
    return f"archived_u{user_pk}_{uuid.uuid4().hex[:12]}"


class Command(BaseCommand):
    help = (
        "Libère un email utilisé comme username ou email User : renomme le username si besoin, "
        "vide l'email s'il contenait cette adresse, désactive le compte, "
        "et supprime la ligne EmergencyLoginAttempt pour cet email."
    )

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Email à libérer (comparaison insensible à la casse)")
        parser.add_argument(
            "--no-deactivate",
            action="store_true",
            help="Ne pas passer is_active=False (déconseillé)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        raw = (options["email"] or "").strip().lower()
        if not raw or "@" not in raw:
            raise CommandError("Adresse email invalide.")

        user = User.objects.filter(Q(username__iexact=raw) | Q(email__iexact=raw)).first()
        if not user:
            raise CommandError(f"Aucun utilisateur avec username ou email égal à « {raw} ».")

        old_username = user.username
        old_email = (user.email or "").strip()

        new_username = _archived_username(user.pk)
        updates = []

        if user.username.lower() == raw:
            user.username = new_username
            updates.append("username")

        if old_email.lower() == raw:
            user.email = ""
            updates.append("email")

        if not updates:
            raise CommandError(
                "Compte trouvé par la requête mais ni username ni email ne correspond au texte attendu "
                "(anomalie de données)."
            )

        if not options["no_deactivate"]:
            user.is_active = False
            updates.append("is_active")

        user.save(update_fields=list(dict.fromkeys(updates)))

        deleted_e, _ = EmergencyLoginAttempt.objects.filter(email__iexact=raw).delete()

        prof = DoctorProfile.objects.filter(user=user).first()
        if prof is not None and ((prof.order_number or "").strip() != ""):
            prof.order_number = None
            prof.save(update_fields=["order_number"])
            self.stdout.write(self.style.WARNING("DoctorProfile.order_number libéré (None) pour réutilisation lors d'une nouvelle inscription."))

        self.stdout.write(
            self.style.SUCCESS(
                f"Archivé — user id={user.pk} | ancien username={old_username!r} | ancien email={old_email!r} | "
                f"nouveau username={user.username!r} | tentative(s) urgence supprimée(s): {deleted_e}"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"L'adresse « {raw} » peut être réutilisée (inscription ou autre)."
            )
        )
