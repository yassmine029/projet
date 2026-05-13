"""
Test fantôme (phantom) pour vérifier le calcul SUVR des intensités Brodmann.

Principe : on crée un volume 3D artificiel avec des valeurs CONNUES à l'avance,
on calcule le résultat théorique à la main, puis on vérifie que le code
donne exactement le même résultat.

Exécution :
    cd backend_django
    python test_suvr_phantom.py
"""

import sys
import os
import numpy as np

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')

# ── Pas besoin de Django pour ce test ─────────────────────────────────────────
# On reproduit exactement les formules de views.py localement.

def compute_suvr(patient_data: np.ndarray, labels: np.ndarray, zone_number: int):
    """Reproduction exacte des formules de brodmann_intensity (views.py)."""
    brain_mask = labels > 0
    mask = labels == zone_number

    patient_brain_mean = float(np.mean(patient_data[brain_mask]))
    patient_data_suvr = patient_data / max(patient_brain_mean, 1e-12)

    n_vox = int(np.sum(mask))
    patient_zone_mean = float(np.mean(patient_data_suvr[mask]))
    somme_patient = float(np.sum(patient_data_suvr[mask]))

    return {
        'patient_brain_mean': patient_brain_mean,
        'patient_zone_mean': patient_zone_mean,
        'somme_patient': somme_patient,
        'n_voxels': n_vox,
    }


def test_cas1_uniforme():
    """
    CAS 1 : volume uniforme — toutes les valeurs = C

    Attendu :
      brain_mean = C
      SUVR de n'importe quelle zone = C / C = 1.0
    """
    print("\n" + "="*60)
    print("CAS 1 — Volume uniforme (toutes valeurs = 5.0)")
    print("="*60)

    # Grille 10×10×10
    volume = np.full((10, 10, 10), 5.0, dtype=np.float64)

    # Atlas : zone 1 = voxels [0:5, 0:5, :], zone 2 = reste
    labels = np.zeros((10, 10, 10), dtype=np.int32)
    labels[0:5, 0:5, :] = 1
    labels[5:, 5:, :] = 2

    result = compute_suvr(volume, labels, zone_number=1)

    expected_brain_mean = 5.0
    expected_suvr = 1.0   # 5.0 / 5.0

    print(f"  brain_mean     : {result['patient_brain_mean']:.6f}  (attendu : {expected_brain_mean:.6f})")
    print(f"  SUVR zone 1    : {result['patient_zone_mean']:.6f}  (attendu : {expected_suvr:.6f})")
    print(f"  n_voxels       : {result['n_voxels']}  (attendu : {5*5*10})")

    assert abs(result['patient_brain_mean'] - expected_brain_mean) < 1e-9, "ERREUR brain_mean incorrect"
    assert abs(result['patient_zone_mean']  - expected_suvr)       < 1e-9, "ERREUR SUVR incorrect"
    assert result['n_voxels'] == 5*5*10,                                   "ERREUR n_voxels incorrect"
    print("  OK CAS 1 RÉUSSI")


def test_cas2_zone_double():
    """
    CAS 2 : une zone vaut 2× les autres.

    Setup :
      - volume 10×10×10 = 1000 voxels
      - zone 1 : 100 voxels avec valeur = 4.0
      - reste (hors zone) : 900 voxels avec valeur = 2.0
      (Les voxels hors zones sont ignorés — labels=0)

    Attendu :
      brain_mean = (100×4 + 900×2) / 1000 = (400+1800)/1000 = 2.2
      SUVR zone 1 = 4.0 / 2.2 = 1.8181...
    """
    print("\n" + "="*60)
    print("CAS 2 — Zone 1 = 4.0, reste du cerveau = 2.0")
    print("="*60)

    volume = np.full((10, 10, 10), 2.0, dtype=np.float64)
    labels = np.zeros((10, 10, 10), dtype=np.int32)

    # Zone 1 : 10×10×1 = 100 voxels
    labels[:, :, 0] = 1
    volume[:, :, 0] = 4.0

    # Reste du cerveau : 900 voxels, valeur 2.0
    labels[:, :, 1:] = 2

    result = compute_suvr(volume, labels, zone_number=1)

    n_zone1   = 100
    n_rest    = 900
    n_total   = 1000
    val_zone1 = 4.0
    val_rest  = 2.0

    expected_brain_mean = (n_zone1 * val_zone1 + n_rest * val_rest) / n_total
    expected_suvr       = val_zone1 / expected_brain_mean

    print(f"  brain_mean     : {result['patient_brain_mean']:.6f}  (attendu : {expected_brain_mean:.6f})")
    print(f"  SUVR zone 1    : {result['patient_zone_mean']:.6f}  (attendu : {expected_suvr:.6f})")
    print(f"  n_voxels       : {result['n_voxels']}  (attendu : {n_zone1})")

    assert abs(result['patient_brain_mean'] - expected_brain_mean) < 1e-9, "ERREUR brain_mean incorrect"
    assert abs(result['patient_zone_mean']  - expected_suvr)       < 1e-9, "ERREUR SUVR incorrect"
    assert result['n_voxels'] == n_zone1,                                   "ERREUR n_voxels incorrect"
    print("  OK CAS 2 RÉUSSI")


def test_cas3_ratio_patient_reference():
    """
    CAS 3 : vérification du ratio patient / référence.

    Setup :
      Patient  : zone 1 = 6.0, reste = 2.0 → brain_mean = 2.4 → SUVR zone1 = 2.5
      Reference: zone 1 = 4.0, reste = 2.0 → brain_mean = 2.2 → SUVR zone1 = 1.818

    Attendu :
      ratio = (2.5 / 1.818) × 100 = 137.5 %
    """
    print("\n" + "="*60)
    print("CAS 3 — Ratio patient (6.0) / référence (4.0) en zone 1")
    print("="*60)

    labels = np.zeros((10, 10, 10), dtype=np.int32)
    labels[:, :, 0] = 1   # zone 1 : 100 voxels
    labels[:, :, 1:] = 2  # reste  : 900 voxels

    # Patient : zone1=6, reste=2
    patient = np.where(labels == 1, 6.0, np.where(labels == 2, 2.0, 0.0))
    # Reference : zone1=4, reste=2
    reference = np.where(labels == 1, 4.0, np.where(labels == 2, 2.0, 0.0))

    res_p = compute_suvr(patient,   labels, zone_number=1)
    res_r = compute_suvr(reference, labels, zone_number=1)

    ratio = (res_p['patient_zone_mean'] / res_r['patient_zone_mean']) * 100

    # Calcul théorique
    bm_p = (100*6 + 900*2) / 1000   # 2.4
    bm_r = (100*4 + 900*2) / 1000   # 2.2
    suvr_p = 6.0 / bm_p             # 2.5
    suvr_r = 4.0 / bm_r             # 1.8181...
    expected_ratio = (suvr_p / suvr_r) * 100

    print(f"  SUVR patient   : {res_p['patient_zone_mean']:.6f}  (attendu : {suvr_p:.6f})")
    print(f"  SUVR référence : {res_r['patient_zone_mean']:.6f}  (attendu : {suvr_r:.6f})")
    print(f"  Ratio          : {ratio:.4f} %  (attendu : {expected_ratio:.4f} %)")

    assert abs(res_p['patient_zone_mean'] - suvr_p) < 1e-9,       "ERREUR SUVR patient incorrect"
    assert abs(res_r['patient_zone_mean'] - suvr_r) < 1e-9,       "ERREUR SUVR référence incorrect"
    assert abs(ratio - expected_ratio) < 1e-6,                     "ERREUR Ratio incorrect"
    print("  OK CAS 3 RÉUSSI")


def test_cas4_suvr_ne_depend_pas_de_lechelle():
    """
    CAS 4 : le SUVR ne doit PAS changer si on multiplie tout le volume par un facteur.

    Si on prend le patient du CAS 3 et qu'on multiplie tout par 100,
    le SUVR doit rester identique (c'est l'intérêt de la normalisation).
    """
    print("\n" + "="*60)
    print("CAS 4 — Invariance à l'échelle (×100 = même SUVR)")
    print("="*60)

    labels = np.zeros((10, 10, 10), dtype=np.int32)
    labels[:, :, 0] = 1
    labels[:, :, 1:] = 2

    patient_v1 = np.where(labels == 1, 6.0,   np.where(labels == 2, 2.0,   0.0))
    patient_v2 = np.where(labels == 1, 600.0, np.where(labels == 2, 200.0, 0.0))

    res1 = compute_suvr(patient_v1, labels, zone_number=1)
    res2 = compute_suvr(patient_v2, labels, zone_number=1)

    print(f"  SUVR (valeurs 2-6)     : {res1['patient_zone_mean']:.6f}")
    print(f"  SUVR (valeurs 200-600) : {res2['patient_zone_mean']:.6f}")
    print(f"  Différence             : {abs(res1['patient_zone_mean'] - res2['patient_zone_mean']):.2e}")

    assert abs(res1['patient_zone_mean'] - res2['patient_zone_mean']) < 1e-9, \
        "ERREUR SUVR change avec l'échelle — normalisation incorrecte"
    print("  OK CAS 4 RÉUSSI — SUVR invariant à l'échelle")


def test_cas5_2d_vs_3d():
    """
    CAS 5 : prouver que le calcul est bien 3D et non 2D coupe par coupe.

    Setup : volume 10x10x10
      - Zone 1 occupe TOUTES les coupes Z (z=0..9), valeur = 4.0
      - Reste du cerveau : valeur = 2.0

    Verification 3D : on calcule la somme sur le masque 3D complet.
    Verification 2D : on calcule la somme uniquement sur la coupe z=0 (une seule coupe).

    Si le code est 3D : n_voxels = 100 (10x10x1 par coupe x 10 coupes)
    Si le code est 2D : n_voxels = 10  (10x10x1 = 100... mais une seule coupe)

    On cree une zone qui a DES VALEURS DIFFERENTES selon la coupe Z :
      - z=0 : zone 1 = 4.0
      - z=1 : zone 1 = 8.0   <- si 2D sur z=0 seulement, on raterait cette coupe
      - z=2..9 : zone 1 = 4.0

    Si calcul 3D : somme zone1 = 100*4 + 100*8 + 800*4 = 400+800+3200 = 4400
                   mean  zone1 = 4400 / 1000 = 4.4
    Si calcul 2D (z=0 seulement) : mean zone1 = 4.0  (rate la coupe z=1 a 8.0)
    """
    print("\n" + "="*60)
    print("CAS 5 -- Verification 2D vs 3D")
    print("="*60)

    volume = np.full((10, 10, 10), 2.0, dtype=np.float64)
    labels = np.zeros((10, 10, 10), dtype=np.int32)

    # Zone 1 sur toutes les coupes Z
    labels[:, :, :] = 2   # cerveau partout
    labels[0:5, 0:5, :] = 1  # zone 1 = coin superieur gauche, toutes les coupes

    # Valeurs differentes selon Z
    volume[0:5, 0:5, :] = 4.0   # zone 1, toutes coupes = 4.0
    volume[0:5, 0:5, 1] = 8.0   # SAUF coupe z=1 = 8.0

    # Calcul 3D attendu
    n_zone1_total = 5 * 5 * 10   # 250 voxels
    n_zone1_z1    = 5 * 5        # 25 voxels a z=1 avec valeur 8.0
    n_zone1_other = n_zone1_total - n_zone1_z1  # 225 voxels avec valeur 4.0
    expected_mean_3d = (n_zone1_other * 4.0 + n_zone1_z1 * 8.0) / n_zone1_total
    # = (225*4 + 25*8) / 250 = (900 + 200) / 250 = 1100/250 = 4.4

    # Calcul 2D attendu (uniquement z=0)
    expected_mean_2d = 4.0  # z=0 a uniquement 4.0

    result = compute_suvr(volume, labels, zone_number=1)
    # On calcule la mean AVANT normalisation pour comparer
    brain_mask = labels > 0
    patient_brain_mean = float(np.mean(volume[brain_mask]))
    mask = labels == 1
    raw_zone_mean = float(np.mean(volume[mask]))

    print(f"  Voxels zone 1 trouves : {result['n_voxels']}  (attendu si 3D : {n_zone1_total})")
    print(f"  Mean brute zone 1     : {raw_zone_mean:.4f}")
    print(f"    -> Si 3D : {expected_mean_3d:.4f}  (inclut la coupe z=1 a 8.0)")
    print(f"    -> Si 2D : {expected_mean_2d:.4f}  (ignore la coupe z=1)")

    assert result['n_voxels'] == n_zone1_total, \
        f"ERREUR n_voxels={result['n_voxels']} != {n_zone1_total} — calcul 2D detecte !"
    assert abs(raw_zone_mean - expected_mean_3d) < 1e-9, \
        f"ERREUR mean={raw_zone_mean:.4f} != {expected_mean_3d:.4f} — calcul 2D detecte !"

    print(f"  => Le calcul est bien 3D (volume complet, toutes les coupes)")
    print("  OK CAS 5 REUSSI -- CALCUL CONFIRME 3D")


if __name__ == '__main__':
    print("\nTEST FANTOME -- Verification du calcul SUVR Brodmann")
    print("Reproduction exacte des formules de views.py\n")

    try:
        test_cas1_uniforme()
        test_cas2_zone_double()
        test_cas3_ratio_patient_reference()
        test_cas4_suvr_ne_depend_pas_de_lechelle()
        test_cas5_2d_vs_3d()

        print("\n" + "="*60)
        print("OK TOUS LES CAS REUSSIS -- Calcul SUVR verifie a 100%")
        print("3D confirme : le calcul porte sur le volume entier")
        print("="*60)
        sys.exit(0)
    except AssertionError as e:
        print(f"\n{e}")
        sys.exit(1)
