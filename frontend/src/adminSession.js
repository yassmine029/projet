/** Nettoyage session locale portail admin obsolète. */

const STORAGE_KEY = 'braincore_admin_dashboard_v1';

/** Ancienne session localStorage (sans cookie Django) — effacée au logout et à la connexion classique. */
export function clearAdminDashboardSession() {
  localStorage.removeItem(STORAGE_KEY);
}
