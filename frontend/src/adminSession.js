/** Identifiants portail admin (Vite) + nettoyage session locale obsolète. */

const STORAGE_KEY = 'neuroscan_admin_dashboard_v1';

/**
 * Identifiants configurés côté build (Vite). Après succès, le front appelle POST /api/admin/portal_login
 * pour obtenir une vraie session Django (cookies).
 */
export function tryMatchAdminPortalLogin(email, password) {
  const expectedEmail = (import.meta.env.VITE_ADMIN_DASHBOARD_EMAIL || '').trim().toLowerCase();
  const expectedPassword = import.meta.env.VITE_ADMIN_DASHBOARD_PASSWORD || '';
  if (!expectedEmail || !expectedPassword) return null;

  const em = String(email || '').trim().toLowerCase();
  if (em !== expectedEmail) return null;
  if (String(password) !== expectedPassword) return null;

  return {
    username: String(email || '').trim(),
    fullName: 'Administrateur',
    is_staff: true,
    is_admin_dashboard: true,
  };
}

/** Ancienne session localStorage (sans cookie Django) — effacée au logout et à la connexion classique. */
export function clearAdminDashboardSession() {
  localStorage.removeItem(STORAGE_KEY);
}
