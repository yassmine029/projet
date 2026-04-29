"""
Vérification des deux flux auth (admin crée / inscription).
Exécuter: python verify_workflows.py
"""
import json
import os
import random
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend_django.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth.models import User
from django.test import Client

from api.models import AccountActivationToken, DoctorProfile


def j(client, method, path, data=None, **kwargs):
    if data is not None and "content_type" not in kwargs:
        kwargs["content_type"] = "application/json"
        kwargs["data"] = json.dumps(data)
    fn = getattr(client, method.lower())
    return fn(path, **kwargs)


def main():
    client = Client()
    admin = User.objects.filter(is_staff=True).first()
    if not admin:
        print("ERREUR: aucun utilisateur is_staff en base. Crée un superuser d'abord.")
        return 1

    rnd = random.randint(100000, 999999)
    email_admin_flow = f"wf_admin_{rnd}@test.local"
    order_admin = str(rnd)[-6:]  # 6 chiffres
    email_self_flow = f"wf_self_{rnd + 1}@test.local"
    order_self = str(rnd + 1)[-6:]
    pwd_signup = "TestPass1!"
    pwd_activation = "Activate1!"

    print("=== Flow 1: admin creates account (no password) + activation email ===\n")

    client.force_login(admin)
    create_body = {
        "email": email_admin_flow,
        "nom": "Workflow",
        "prenom": "AdminCreate",
        "order_number": order_admin,
        "affiliation": "CHU Test",
        "specialty": "autre",
        "grade": "",
        "telephone": "",
    }
    r = j(client, "post", "/api/admin/dashboard/accounts/create", create_body)
    d = r.json()
    assert r.status_code == 200 and d.get("ok"), f"create failed: {r.status_code} {d}"
    assert d.get("activation_required") is True, d
    uid1 = d["account"]["user_id"]
    u1 = User.objects.get(id=uid1)
    p1 = DoctorProfile.objects.get(user=u1)
    tok1 = AccountActivationToken.objects.get(user=u1)
    assert u1.is_active is False, "user doit être inactif avant activation"
    assert p1.status == "en_attente", p1.status

    client.logout()
    r_login = j(
        client,
        "post",
        "/api/login",
        {"username": email_admin_flow, "password": pwd_activation},
    )
    assert r_login.status_code == 403, (
        f"connexion avant activation doit être refusée (403), got {r_login.status_code} {r_login.json()}"
    )
    assert r_login.json().get("error_type") == "pending_approval", r_login.json()

    r_act = j(
        client,
        "post",
        "/api/activate_account",
        {"token": tok1.token, "new_password": pwd_activation},
    )
    assert r_act.status_code == 200 and r_act.json().get("ok"), r_act.json()
    u1.refresh_from_db()
    p1.refresh_from_db()
    assert u1.is_active is True
    assert p1.status == "actif"

    r_ok = j(
        client,
        "post",
        "/api/login",
        {"username": email_admin_flow, "password": pwd_activation},
    )
    assert r_ok.status_code == 200 and r_ok.json().get("ok"), r_ok.json()
    print("  OK: admin create -> inactive + en_attente -> login denied -> activate_account -> login OK")

    # Nettoyage flux 1
    u1.delete()

    print("\n=== Flow 2: self-registration + admin validation ===\n")

    r_reg = j(
        client,
        "post",
        "/api/register",
        {
            "username": email_self_flow,
            "password": pwd_signup,
            "nom": "Self",
            "prenom": "Reg",
            "order_number": order_self,
            "affiliation": "CHU Test",
            "specialty": "autre",
            "grade": "",
            "telephone": "",
        },
    )
    assert r_reg.status_code == 200 and r_reg.json().get("ok"), r_reg.json()
    u2 = User.objects.get(username=email_self_flow)
    p2 = DoctorProfile.objects.get(user=u2)
    assert u2.is_active is False
    assert p2.status == "en_attente"

    r_login_pending = j(
        client,
        "post",
        "/api/login",
        {"username": email_self_flow, "password": pwd_signup},
    )
    assert r_login_pending.status_code == 403, r_login_pending.json()
    assert r_login_pending.json().get("error_type") == "pending_approval", r_login_pending.json()
    print("  OK: after signup, login denied (pending_approval)")

    client.force_login(admin)
    r_appr = j(
        client,
        "post",
        f"/api/admin/dashboard/accounts/{u2.id}/approve",
        {},
    )
    assert r_appr.status_code == 200 and r_appr.json().get("ok"), r_appr.json()
    client.logout()

    u2.refresh_from_db()
    assert u2.is_active is True
    r_login_ok = j(
        client,
        "post",
        "/api/login",
        {"username": email_self_flow, "password": pwd_signup},
    )
    assert r_login_ok.status_code == 200 and r_login_ok.json().get("ok"), r_login_ok.json()
    print("  OK: after admin approve, login OK with signup password")

    # Refus
    email_rej = f"wf_rej_{rnd}@test.local"
    order_rej = str(rnd + 2)[-6:]
    r_reg2 = j(
        client,
        "post",
        "/api/register",
        {
            "username": email_rej,
            "password": pwd_signup,
            "nom": "Reject",
            "prenom": "Me",
            "order_number": order_rej,
            "affiliation": "CHU Test",
            "specialty": "autre",
        },
    )
    assert r_reg2.status_code == 200, r_reg2.json()
    u3 = User.objects.get(username=email_rej)
    client.force_login(admin)
    r_rej = j(
        client,
        "post",
        f"/api/admin/dashboard/accounts/{u3.id}/reject",
        {"reason": "Test refus workflow"},
    )
    assert r_rej.status_code == 200 and r_rej.json().get("ok"), r_rej.json()
    client.logout()

    r_login_rej = j(
        client,
        "post",
        "/api/login",
        {"username": email_rej, "password": pwd_signup},
    )
    assert r_login_rej.status_code == 403, r_login_rej.json()
    assert r_login_rej.json().get("error_type") == "account_rejected", r_login_rej.json()
    print("  OK: after admin reject, login denied (account_rejected)")

    u2.delete()
    u3.delete()

    print("\n=== All automated checks passed. ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
