import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'

import Login from './pages/Login'
import DashboardHome from './pages/Dashboard'
import { LandingPage } from './pages/LandingPage'
import { RegistrationPage } from './pages/RegistrationPage'
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
import './index.css'

import { checkSession, logout } from './api'

function Protected({ user, children }) {
  return user ? children : <Navigate to="/login" replace />
}

function ProtectedLayout({ user }) {
  return user ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/login" replace />
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

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkSession()
      .then(r => {
        if (r.data.logged_in) {
          const u =
            (r.data.user && typeof r.data.user === 'object')
              ? r.data.user
              : { username: r.data.user, fullName: r.data.user, is_staff: r.data.is_staff }
          setUser(u)
        }
      })
      .catch(() => { })
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="text-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
        <p className="mt-3 text-sm font-medium text-slate-500">Vérification de la session...</p>
      </div>
    </div>
  }

  const handleNavigate = (page) => {
    if (page.startsWith('/')) {
      window.location.pathname = user ? page : '/login'
      return
    }
    if (page === 'dashboard') { window.location.pathname = '/dashboard'; return }
    if (page === 'login') { window.location.pathname = '/login'; return }
    if (page === 'registration') { window.location.pathname = user ? '/registration' : '/login'; return }
    window.location.pathname = '/'
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (e) {
      console.error(e)
    } finally {
      setUser(null)
      window.location.pathname = '/'
    }
  }

  return (
    <>
      <ThemeToggle />

      <Routes>
        {/* ── Public: Landing + Login ── */}
        <Route path="/" element={<LandingPage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* ── Dashboard & management pages (with sidebar) ── */}
        <Route element={<ProtectedLayout user={user} />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/patients" element={<PatientsList />} />
          <Route path="/dashboard/patients/:id" element={<PatientDetail />} />
          <Route path="/dashboard/analysesMRI" element={<AnalysesMRI />} />
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
          <Route path="/exploration" element={<ExplorationPage />} />
        </Route>

        {/* ── Full-screen tools (no sidebar) ── */}
        <Route path="/segmentation/nouvelle" element={<Protected user={user}><NouvelleSegmentation /></Protected>} />
        <Route path="/segmentation/modelisation" element={<Protected user={user}><Modelisation3D /></Protected>} />
        <Route path="/registration" element={<Protected user={user}><RegistrationPage user={user} accessToken={null} onNavigate={handleNavigate} /></Protected>} />

        <Route path="/admin/*" element={<Protected user={user}><AppLayout><DashboardHome /></AppLayout></Protected>} />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
