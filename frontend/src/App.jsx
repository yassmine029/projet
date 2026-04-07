import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { LandingPage } from './pages/LandingPage'
import { RegistrationPage } from './pages/RegistrationPage'
// import Upload from './pages/Upload'
// import History from './pages/History'
// import Patients from './pages/Patients'
// import PredictionPage from "./pages/Prediction"
// import BrodmannPage from "./pages/Brodmann"
// import Brodmann3DPage from "./pages/Brodmann3D"
// import ExplorationPage from "./pages/ExplorationPage"

// import PrivacyPage from './pages/PrivacyPage'
// import TermsPage from './pages/TermsPage'
// import Dashboard from './pages/Dashboard'
// import PatientsList from './pages/dashboard/PatientsList'
// import PatientDetail from './pages/dashboard/PatientDetail'
// import ReclamationsList from './pages/dashboard/ReclamationsList'
// import NewPatient from './pages/NewPatient'
import './index.css'

import { checkSession, logout } from './api'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') return true
    if (saved === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // 🔐 Vérification session au chargement
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

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', isDarkMode)
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  if (checking) {
    return <div style={{ padding: 40 }}>Vérification session...</div>
  }

  const handleNavigate = (page) => {
    if (page === 'dashboard') {
      window.location.pathname = '/dashboard'
      return
    }
    if (page === 'login') {
      window.location.pathname = '/login'
      return
    }
    if (page === 'registration') {
      window.location.pathname = user ? '/registration' : '/login'
      return
    }
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
      <button
        type="button"
        onClick={() => setIsDarkMode((v) => !v)}
        className="theme-toggle-btn"
        aria-label={isDarkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
        title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
      >
        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        <span>{isDarkMode ? 'Clair' : 'Sombre'}</span>
      </button>

      <Routes>
        <Route
          path="/"
          element={<LandingPage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />}
        />
        <Route
          path="/dashboard/*"
          element={user ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/*"
          element={user ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registration"
          element={
            user
              ? <RegistrationPage user={user} accessToken={null} onNavigate={handleNavigate} />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}