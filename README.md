
Recalage Procrustes - projet corrigé (backend + frontend)

Backend (Flask):
  cd backend
  python -m venv .venv
  .venv\Scripts\activate   # Windows (PowerShell: .venv\Scripts\Activate.ps1) or use cmd .venv\Scripts\activate
  pip install -r requirements.txt
  python app.py

Frontend (Vite + React):
  cd frontend
  npm install
  npm run dev

Frontend runs at http://localhost:5173 and proxies /api to http://localhost:5000

Instructions:
1. Go to Upload page.
2. Select patient id and choose two images (ref + patient).
3. Click Upload; two 512x512 previews will appear.
4. Click alternately on CT (left) then Patient (right) to create point pairs.
5. When at least 3 pairs are set, click "Align (Procrustes)". Result will display and you can download it.
