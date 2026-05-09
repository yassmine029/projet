"""Paramètre MINE_FORCE_GPU : pas de repli CPU si activé (voir settings.py / .env)."""
import os
import shutil
import subprocess


def mine_force_gpu() -> bool:
    try:
        from django.conf import settings

        if getattr(settings, 'configured', False):
            return bool(getattr(settings, 'MINE_FORCE_GPU', False))
    except Exception:
        pass
    return os.getenv('MINE_FORCE_GPU', '1').strip().lower() in ('1', 'true', 'yes')


def mine_torch_built_with_cuda() -> bool:
    """True si cette build PyTorch embarque le runtime CUDA (peut être False avec une roue cpu-only)."""
    try:
        import torch

        return bool(getattr(torch.version, 'cuda', None))
    except Exception:
        return False


def mine_torch_cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def mine_nvidia_smi_tail() -> str:
    """Premières lignes utiles de nvidia-smi pour le diagnostic (sans bloquer longtemps)."""
    exe = shutil.which('nvidia-smi')
    if not exe:
        return 'nvidia-smi introuvable (pilote NVIDIA non installé ou PATH incomplet).'
    try:
        r = subprocess.run(
            [exe, '-L'],
            capture_output=True,
            text=True,
            timeout=6,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0,
        )
        out = (r.stdout or '').strip() or (r.stderr or '').strip()
        return out[:500] if out else f'nvidia-smi code {r.returncode}'
    except Exception as e:
        return f'nvidia-smi erreur: {e}'


def mine_gpu_unavailable_hint() -> str:
    """
    Texte additionnel quand le recalage exige un GPU mais PyTorch ne voit pas CUDA.
    Couvre : build cpu-only, pilote manquant, GPU « lost », PC portable sans GPU dédié actif.
    """
    try:
        import torch

        ver = getattr(torch, '__version__', '?')
    except Exception:
        ver = '?'

    lines = [f'PyTorch {ver}.']

    if mine_torch_built_with_cuda():
        smi = mine_nvidia_smi_tail()
        lines.append(f'GPU / pilote (extrait nvidia-smi) : {smi}')
        lines.append(
            'Si vous voyez "GPU is lost" dans nvidia-smi : redemarrage du PC, pilote NVIDIA a jour, '
            "eventuellement debrancher le secteur 30 s (reset d'alimentation du laptop). "
            'Sur laptop : Parametres Windows -> Graphiques : ajoutez python.exe en "Hautes performances" '
            '(carte NVIDIA), ou activez le mode graphique dedie dans le logiciel constructeur.'
        )
    else:
        lines.append(
            'Cette installation PyTorch est probablement "CPU-only". Dans le dossier backend_django, '
            'reinstallez une build CUDA adaptee (ex. cu118) depuis https://pytorch.org/get-started/locally/ '
            'dans le meme .venv que run-dev.ps1.'
        )

    lines.append(
        "En attendant qu'un GPU soit visible (torch.cuda.is_available() == True), "
        'mettez MINE_FORCE_GPU=0 dans .env pour le recalage sur CPU.'
    )
    return ' '.join(lines)
