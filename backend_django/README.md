Django backend for recalage application

Setup (example):

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend_django/requirements.txt
```

2. Configure Postgres env vars (or use local DB):

```bash
export POSTGRES_DB=recalage_db
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=nadine
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
```

3. Run migrations and start server:

```bash
python backend_django/manage.py migrate
python backend_django/manage.py runserver
```

Notes:
- Media files are stored in the original `backend/uploads` folder so the frontend pathing stays compatible.
- The API endpoints aim to mirror the original Flask ones (`/api/register`, `/api/login`, `/api/upload`, `/api/align`, ...).
