FROM python:3.10-slim

WORKDIR /app

# Dépendances système requises par OpenCV, psycopg2, antspyx, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    libpq-dev \
    libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copie et installation des dépendances Python (OBLIGATOIRE)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du reste du code backend
COPY . .

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend_django.asgi:application"]
