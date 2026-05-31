"""
Gestion du cache local pour l'atlas Harvard-Oxford.

Pré-télécharge l'atlas une seule fois et le réutilise depuis le disque local
au lieu de le télécharger à chaque nouveau processus Django.
"""

import os
from pathlib import Path


# Répertoire de cache personnalisé (dossier local du projet)
ATLAS_CACHE_DIR = Path(__file__).parent.parent / '.cache' / 'atlas'

# Configurer NILEARN_DATA immédiatement, avant tout import de nilearn
os.environ['NILEARN_DATA'] = str(ATLAS_CACHE_DIR)


def ensure_atlas_cached(verbose=True):
    """
    Pré-télécharge et cache l'atlas Harvard-Oxford localement.
    
    Cette fonction est appelée au démarrage de Django.
    Si l'atlas est déjà en cache, elle ne fait rien.
    
    Parameters
    ----------
    verbose : bool
        Afficher les messages de progression.
    """
    try:
        # Créer le répertoire de cache s'il n'existe pas
        ATLAS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        if verbose:
            print(f"\n{'='*70}")
            print(f"[ATLAS] HARVARD-OXFORD - CACHE INITIALIZATION")
            print(f"{'='*70}")
            print(f"[PATH] Cache Directory: {ATLAS_CACHE_DIR}")
            print(f"[ENV]  NILEARN_DATA: {os.environ.get('NILEARN_DATA')}")
        
        # Vérifier si l'atlas est déjà en cache
        # Nilearn crée la structure: atlas_data/harvard_oxford/
        atlas_subdir = ATLAS_CACHE_DIR / 'atlas_data' / 'harvard_oxford'
        nii_files = list(atlas_subdir.glob('*.nii.gz')) if atlas_subdir.exists() else []
        
        if nii_files:
            if verbose:
                print(f"[OK]  Atlas already cached ({len(nii_files)} files)")
                for f in nii_files:
                    size_mb = f.stat().st_size / (1024**2)
                    print(f"       - {f.name} ({size_mb:.1f} MB)")
        else:
            if verbose:
                print("[DL]  Downloading Harvard-Oxford atlas for the first time...")
                print("       (This may take 1-2 minutes on first run)")
            
            from nilearn import datasets
            
            # fetch_atlas_harvard_oxford utilise NILEARN_DATA via os.environ
            result = datasets.fetch_atlas_harvard_oxford(
                'cort-maxprob-thr25-2mm',
                symmetric_split=False,
                resume=True  # Continue si interrompu
            )
            
            if verbose:
                atlas_files = list((ATLAS_CACHE_DIR / 'atlas_data' / 'harvard_oxford').glob('*.nii.gz'))
                print(f"[OK]  Atlas downloaded successfully to cache")
                for f in atlas_files:
                    size_mb = f.stat().st_size / (1024**2)
                    print(f"       - {f.name} ({size_mb:.1f} MB)")
                print(f"       - Labels count: {len(result.get('labels', []))}")
        
        if verbose:
            print(f"\n[INFO] All future atlas requests will load from: {ATLAS_CACHE_DIR}")
            print(f"{'='*70}\n")
        
        return True
        
    except Exception as e:
        if verbose:
            print(f"\n[ERROR] ATLAS CACHING FAILED: {e}")
            print(f"        The application will still work but may re-download the atlas.\n")
        import traceback
        traceback.print_exc()
        return False


def get_atlas_cache_dir():
    """Retourne le chemin du répertoire de cache de l'atlas."""
    return ATLAS_CACHE_DIR
