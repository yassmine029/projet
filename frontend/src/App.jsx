import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import Login from './pages/Login'
import { LandingPage } from './pages/LandingPage'
import { RegistrationPage } from './pages/RegistrationPage'
import Upload from './pages/Upload'
import History from './pages/History'
import Patients from './pages/Patients'
import PredictionPage from "./pages/Prediction"
import BrodmannPage from "./pages/Brodmann"
import Brodmann3DPage from "./pages/Brodmann3D"
import ExplorationPage from "./pages/ExplorationPage"
import './index.css'

import api, { checkSession, logout } from './api'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // 🔐 Vérification session au chargement
  useEffect(() => {
    checkSession()
      .then(r => {
        if (r.data.logged_in) {
          const u =
            (r.data.user && typeof r.data.user === 'object')
              ? r.data.user
              : { username: r.data.user, fullName: r.data.user }
          setUser(u)
        }
      })
      .catch(() => { })
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return <div style={{ padding: 40 }}>Vérification session...</div>
  }

  // 🔑 Non connecté → Login
  if (!user) {
    return <Login onLogin={setUser} />
  }

  // 🚪 Déconnexion
  const doLogout = async () => {
    try {
      await logout()
      setUser(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleNavigate = (page) => {
    window.location.pathname = `/${page}`
  }

  return (
    <Routes>
      {/* Landing page par défaut */}
      <Route path="/" element={<LandingPage user={user} onNavigate={handleNavigate} onLogout={doLogout} />} />

      {/* Registration page */}
      <Route path="/registration" element={<RegistrationPage user={user} accessToken={null} onNavigate={handleNavigate} />} />

      {/* Fonctionnalités */}
      <Route path="/upload" element={<Upload />} />
      <Route path="/history" element={<History />} />
      <Route path="/patients" element={<Patients />} />
      <Route path="/prediction" element={<PredictionPage />} />
      <Route path="/brodmann" element={<BrodmannPage />} />
      <Route path="/brodmann3D" element={<Brodmann3DPage />} />
      <Route path="/exploration" element={<ExplorationPage />} />

      {/* Sécurité */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}