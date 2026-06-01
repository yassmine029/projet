# ARG global (avant tout FROM) pour sélectionner le stage de base
ARG USE_GPU=false

# ── Stage CPU : base légère Python ─────────────────────────────────────────
FROM python:3.10-slim AS base-false

# ── Stage GPU : base NVIDIA CUDA 12.1 + cuDNN 8 (libcublas inclus) ────────
# Ubuntu 22.04 : Python 3.10 natif, pas besoin de PPA
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS base-true
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-dev \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/pip3   /usr/bin/pip

# ── Image finale : CPU ou GPU selon USE_GPU ────────────────────────────────
FROM base-${USE_GPU} AS final

WORKDIR /app

# Redéclarer ARG après FROM (obligatoire en multi-stage)
ARG USE_GPU=false

# Dépendances système (OpenCV, psycopg2…)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ \
        libpq-dev \
        libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 \
        cmake \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# PyTorch : GPU → CUDA 11.8  |  CPU → version légère sans CUDA (~200 MB)
RUN if [ "$USE_GPU" = "true" ]; then \
        pip install --no-cache-dir --retries 5 torch torchvision \
            --index-url https://download.pytorch.org/whl/cu118; \
    else \
        pip install --no-cache-dir --retries 5 torch torchvision \
            --index-url https://download.pytorch.org/whl/cpu; \
    fi

# Reste des dépendances (onnxruntime CPU inclus via requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# GPU : remplacer onnxruntime par onnxruntime-gpu 1.17.3 (cuDNN 8 + CUDA 12.1)
RUN if [ "$USE_GPU" = "true" ]; then \
        pip uninstall -y onnxruntime || true; \
        pip install --no-cache-dir "onnxruntime-gpu==1.18.1"; \
    fi

COPY . .

# Pré-télécharger l'atlas Nilearn
RUN python -c "from nilearn import datasets; datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm'); print('Atlas téléchargé')" || echo "Atlas download skipped"

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend_django.asgi:application"]
