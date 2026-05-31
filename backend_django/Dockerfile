FROM python:3.10-slim

WORKDIR /app

# Argument de build : USE_GPU=true installe PyTorch avec CUDA
# USE_GPU=false (défaut) installe PyTorch CPU-only pour le local
ARG USE_GPU=false

# Dépendances système requises par OpenCV, psycopg2, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    libpq-dev \
    libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copie des dépendances Python
COPY requirements.txt .

# Installer PyTorch selon USE_GPU
# GPU  → version CUDA 12.1 (compatible RTX 3050 + CUDA 12.5)
# CPU  → version standard (local dev)
RUN if [ "$USE_GPU" = "true" ]; then \
        pip install --no-cache-dir torch torchvision \
            --index-url https://download.pytorch.org/whl/cu121; \
    fi

# Installer le reste des dépendances (torch déjà installé si GPU)
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code
COPY . .

# Pré-télécharger l'atlas Nilearn
RUN python -c "from nilearn import datasets; datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm'); print('Atlas téléchargé')" || echo "Atlas download skipped"

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend_django.asgi:application"]
