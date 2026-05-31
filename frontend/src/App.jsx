import React from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'

class ExplorationErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:'100vh', background:'#050b17', color:'#e2e8f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, fontFamily:'monospace' }}>
          <h2 style={{ color:'#f87171', marginBottom:16 }}>Erreur lors du chargement de la page</h2>
          <pre style={{ color:'#94a3b8', fontSize:12, maxWidth:800, whiteSpace:'pre-wrap' }}>{this.state.error?.message}{'\n'}{this.state.error?.stack}</pre>
          <button onClick={() => { this.setState({ error: null }); window.history.back(); }} style={{ marginTop:24, padding:'8px 20px', background:'#1d4ed8', color:'white', border:'none', borderRadius:8, cursor:'pointer' }}>Retour</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import DashboardHome from './pages/Dashboard'
import { LandingPage } from './pages/LandingPage'
import HomePage from './pages/HomePage'
import { RegistrationPage } from './pages/RegistrationPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Upload from './pages/Upload'
import History from './pages/History'
import Patients from './pages/Patients'
import PredictionPage from "./pages/Prediction"
import BrodmannPage from "./pages/Brodmann"
import Brodmann3DPage from "./pages/Brodmann3D"
import ExplorationPage from "./pages/ExplorationPage"
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import PatientsList from './pages/dashboard/PatientsList'
import PatientDetail from './pages/dashboard/PatientDetail'
import ReclamationsList from './pages/dashboard/ReclamationsList'
import AnalysesMRI from './pages/dashboard/AnalysesMRI'
import Parametres from './pages/Parametres'
import NewPatient from './pages/NewPatient'
import MonProfil from './pages/MonProfil'
import NouvelleSegmentation from './pages/NouvelleSegmentation'
import Modelisation3D from './pages/Modelisation3D'
import AppLayout from './components/AppLayout'
import EmergencyDashboard from './pages/EmergencyDashboard'
import './index.css'
import { checkSession, logout } from './api'
import { clearAdminDashboardSession } from './adminSession'
import { APP_MODE, AUTH_DISABLED, isSegMode, isRecalageMode } from './appConfig'

/** Reprise utilisateur après F5 ou ouverture directe /segmentation/… avant check_session */
function readStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u && typeof u === 'object' ? u : null
  } catch {
    return null
  }
}

/** Navigation complète sans garder ?token=… (sinon /login?token= est renvoyé vers /reset-password). */
function goToPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  window.location.replace(`${window.location.origin}${normalized}`)
}

function isPortalAdminUser(user) {
  return Boolean(user?.is_admin_dashboard || user?.username === '__braincore_portal_admin__')
}

function Protected({ user, children }) {
  // CTIAMA mode : auth désactivée → accès direct sans login
  if (AUTH_DISABLED) return <>{children}</>
  if (!user) return <Navigate to="/login" replace />
  if (isPortalAdminUser(user)) return <Navigate to="/admin" replace />
  return children
}

function ProtectedLayout({ user }) {
  // CTIAMA : auth désactivée → accès direct au layout
  if (AUTH_DISABLED) return <AppLayout><Outlet /></AppLayout>
  if (!user) return <Navigate to="/login" replace />
  if (isPortalAdminUser(user)) return <Navigate to="/admin" replace />
  if (user.is_emergency_session) return <Navigate to="/urgence" replace />
  return <AppLayout><Outlet /></AppLayout>
}

function ThemeToggle() {
  const ref = useRef(null)
  const toggle = useCallback(() => {
    const html = document.documentElement
    const nowDark = html.classList.toggle('theme-dark')
    localStorage.setItem('theme', nowDark ? 'dark' : 'light')
    if (ref.current) {
      ref.current.setAttribute('aria-label', nowDark ? 'Activer le mode clair' : 'Activer le mode sombre')
      ref.current.setAttribute('title', nowDark ? 'Mode clair' : 'Mode sombre')
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = saved === 'dark' || (!saved && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('theme-dark', prefersDark)
  }, [])

  return (
    <button ref={ref} type="button" onClick={toggle} className="theme-toggle-btn"
      aria-label="Changer le thème" title="Changer le thème">
      <Moon size={16} className="theme-icon-light" />
      <Sun size={16} className="theme-icon-dark" />
      <span className="theme-label-light">Sombre</span>
      <span className="theme-label-dark">Clair</span>
    </button>
  )
}

// Utilisateur mock utilisé en mode CTIAMA (auth désactivée)
const CTIAMA_USER = { username: 'ctiama', fullName: 'CTIAMA Service', is_staff: false, is_emergency_session: false }

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  // En CTIAMA : user mock prêt immédiatement — sinon lecture localStorage
  const [user, setUser] = useState(() => AUTH_DISABLED ? CTIAMA_USER : readStoredUser())
  // En CTIAMA : pas de vérification de session → checking=false tout de suite
  const [checking, setChecking] = useState(!AUTH_DISABLED)
  const [routeNormalized, setRouteNormalized] = useState(false)
  const devBypassAdmin = import.meta.env.DEV && new URLSearchParams(window.location.search).has('adminBypass')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') return true
    if (saved === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    // CTIAMA : pas de vérification de session — on sort immédiatement
    if (AUTH_DISABLED) return

    const guard = window.setTimeout(() => {
      setChecking(false)
    }, 15000)

    checkSession()
      .then(r => {
        if (r.data.logged_in) {
          clearAdminDashboardSession()
          const u =
            (r.data.user && typeof r.data.user === 'object')
              ? r.data.user
              : { username: r.data.user, fullName: r.data.user, is_staff: r.data.is_staff }
          const merged = {
            ...u,
            is_emergency_session: Boolean(r.data.is_emergency_session),
          }
          setUser(merged)
          try {
            localStorage.setItem('user', JSON.stringify(merged))
          } catch {
            /* ignore */
          }
        } else {
          setUser(null)
          try {
            localStorage.removeItem('user')
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* en cas d’erreur réseau, on garde l’optimistic user du localStorage si présent */
      })
      .finally(() => {
        window.clearTimeout(guard)
        setChecking(false)
      })

    return () => window.clearTimeout(guard)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', isDarkMode)
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = (params.get('token') || '').trim()
    const pathname = window.location.pathname || '/'

    if (!token) {
      setRouteNormalized(true)
      return
    }

    // Some email clients alter path casing, separators or trailing slashes.
    const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '')
    const resetAliases = new Set(['/reset-password', '/reset_password'])
    const activationAliases = new Set(['/activate-account', '/activate_account'])

    if (activationAliases.has(normalizedPath) || resetAliases.has(normalizedPath)) {
      setRouteNormalized(true)
      return
    }

    if (normalizedPath === '/' || normalizedPath === '/login') {
      const qs = params.toString()
      window.location.replace(`/reset-password${qs ? `?${qs}` : ''}`)
      return
    }

    setRouteNormalized(true)
  }, [])

  /** Exposé aux écrans de login qui font setUser après succès — persiste aussi le localStorage */
  const persistUserAndSet = useCallback((u) => {
    setUser(u)
    try {
      if (u && typeof u === 'object') {
        localStorage.setItem('user', JSON.stringify(u))
      } else {
        localStorage.removeItem('user')
      }
    } catch {
      /* ignore */
    }
  }, [])

  /** Navigation SPA : évite window.location.replace qui recharge la page, perd user React et peut envoyer vers /login */
  const handleNavigate = useCallback(
    (page) => {
      if (page.startsWith('/')) {
        if (!user) {
          navigate('/login', { replace: true })
          return
        }
        navigate(page)
        return
      }
      if (page === 'dashboard') {
        if (isPortalAdminUser(user)) { navigate('/admin'); return }
        navigate(user?.is_emergency_session ? '/urgence' : '/dashboard')
        return
      }
      if (page === 'login') {
        navigate('/login')
        return
      }
      if (page === 'registration') {
        navigate(user ? '/registration' : '/login')
        return
      }
      navigate(user?.is_emergency_session ? '/urgence' : '/')
    },
    [user, navigate]
  )

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch (e) {
      console.error(e)
    } finally {
      clearAdminDashboardSession()
      setUser(null)
      try {
        localStorage.removeItem('user')
        sessionStorage.removeItem('emergency_count')
        sessionStorage.removeItem('emergency_max')
        sessionStorage.removeItem('volumeJobId')
        sessionStorage.removeItem('explorationPatientId')
      } catch {
        /* ignore */
      }
      navigate('/', { replace: true })
    }
  }, [navigate])

  const handleAuthNavigate = useCallback(
    (page) => {
      if (page === 'login') {
        navigate('/login')
        return
      }
      if (page === 'forgot-password') {
        navigate('/forgot-password')
        return
      }
      if (page === 'reset-password') {
        navigate('/reset-password')
        return
      }
      if (page === 'activate-account') {
        navigate('/activate-account')
        return
      }
      navigate('/login')
    },
    [navigate]
  )

  if (checking || !routeNormalized) {
    return <div style={{ padding: 40 }}>Vérification session...</div>
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            AUTH_DISABLED
              ? <Navigate to="/dashboard" replace />
              : isPortalAdminUser(user)
                ? <Navigate to="/admin" replace />
                : <HomePage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />
          }
        />
        <Route
          path="/landing"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <LandingPage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />}
        />
        <Route
          path="/login"
          element={
            // CTIAMA : pas de login → Dashboard directement
            AUTH_DISABLED
              ? <Navigate to="/dashboard" replace />
              : isPortalAdminUser(user)
                ? <Navigate to="/admin" replace />
                : user
                  ? <Navigate to="/" replace />
                  : <Login onLogin={persistUserAndSet} />
          }
        />
        {/* Pages auth : uniquement en mode full (local) */}
        {!AUTH_DISABLED && (
          <Route
            path="/forgot-password"
            element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ForgotPasswordPage onNavigate={handleAuthNavigate} />}
          />
        )}
        {!AUTH_DISABLED && (
          <Route
            path="/reset-password"
            element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} />}
          />
        )}
        <Route
          path="/reset-password/"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} />}
        />
        <Route
          path="/reset_password"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} />}
        />
        <Route
          path="/reset_password/"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} />}
        />
        <Route
          path="/activate-account"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} mode="activation" />}
        />
        <Route
          path="/activate-account/"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} mode="activation" />}
        />
        <Route
          path="/activate_account"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} mode="activation" />}
        />
        <Route
          path="/activate_account/"
          element={isPortalAdminUser(user) ? <Navigate to="/admin" replace /> : <ResetPasswordPage onNavigate={handleAuthNavigate} token={new URLSearchParams(window.location.search).get('token')} mode="activation" />}
        />
        <Route
          path="/admin/*"
          element={
            (isPortalAdminUser(user) || devBypassAdmin)
              ? <AdminDashboard user={user} onLogout={handleLogout} />
              : user
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/login" replace />
          }
        />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/urgence"
          element={
            user?.is_emergency_session
              ? <EmergencyDashboard user={user} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />

        {/* ── Dashboard & management pages (with sidebar) ── */}
        <Route element={<ProtectedLayout user={user} />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/patients" element={<PatientsList />} />
          <Route path="/dashboard/patients/:id" element={<PatientDetail />} />
          <Route path="/dashboard/analysesMRI" element={<AnalysesMRI />} />
          <Route path="/dashboard/reports" element={<AnalysesMRI />} />
          <Route path="/dashboard/mri" element={<Navigate to="/dashboard/analysesMRI" replace />} />
          <Route path="/dashboard/reclamations" element={<ReclamationsList />} />
          <Route path="/dashboard/profile" element={<MonProfil />} />
          <Route path="/dashboard/settings" element={<Parametres />} />
          <Route path="/new-patient" element={<NewPatient />} />
          <Route path="/profil" element={<MonProfil />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/history" element={<History />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/prediction" element={<PredictionPage />} />
          <Route path="/brodmann" element={<BrodmannPage />} />
          <Route path="/brodmann3D" element={<Brodmann3DPage />} />
        </Route>

        {/* ── Full-screen tools (no sidebar) ── */}
        <Route path="/exploration" element={<Protected user={user}><ExplorationErrorBoundary><ExplorationPage /></ExplorationErrorBoundary></Protected>} />
        {/* ── Segmentation : visible en mode 'full' et 'segmentation' ── */}
        {isSegMode && <Route path="/segmentation/nouvelle" element={<Protected user={user}><NouvelleSegmentation user={user} /></Protected>} />}
        {isSegMode && <Route path="/segmentation/modelisation" element={<Protected user={user}><Modelisation3D user={user} /></Protected>} />}

        {/* ── Recalage : visible en mode 'full' et 'recalage' ── */}
        {isRecalageMode && <Route path="/registration" element={<Protected user={user}><ExplorationErrorBoundary><RegistrationPage user={user} accessToken={null} onNavigate={handleNavigate} /></ExplorationErrorBoundary></Protected>} />}

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
