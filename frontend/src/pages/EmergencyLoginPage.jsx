import React, { useState, useEffect, useCallback } from 'react'
import { Activity, Mail, AlertTriangle, ArrowLeft, ShieldAlert, Clock, Zap, CheckCircle, Info } from 'lucide-react'
import { emergencyLogin, checkEmergencyLimit } from '../api'

export default function EmergencyLoginPage({ onBack, onEmergencyLogin }) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [sent, setSent] = useState(false)

  const validateEmail = (e) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(e)
  }

  const isPersonalEmailDomain = (email) => {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
    const domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase()
    return personalDomains.includes(domain)
  }

  // Fetch remaining attempts
  const fetchRemaining = useCallback(async (targetEmail) => {
    if (!validateEmail(targetEmail) || isPersonalEmailDomain(targetEmail)) {
      setRemainingAttempts(null)
      return
    }
    try {
      const r = await checkEmergencyLimit(targetEmail)
      if (r.data && r.data.ok) {
        setRemainingAttempts(r.data.remaining)
      }
    } catch (err) {
      console.error('Error fetching limit:', err)
    }
  }, [])

  // Debounced check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email) fetchRemaining(email)
    }, 600)
    return () => clearTimeout(timer)
  }, [email, fetchRemaining])

  // Countdown timer after sending
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const interval = setInterval(() => {
      setSecondsLeft(prev => (prev <= 1 ? null : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [secondsLeft])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEmailError('')
    setSuccessMessage('')

    if (!validateEmail(email)) {
      setEmailError('Adresse email invalide.')
      return
    }
    if (isPersonalEmailDomain(email)) {
      setEmailError('Veuillez utiliser votre email professionnel uniquement.')
      return
    }

    setIsLoading(true)
    try {
      const r = await emergencyLogin(email)
      if (r.data && r.data.ok) {
        const remaining = 5 - r.data.count
        setSuccessMessage(`Connexion réussie ! (Reste: ${remaining}/5) Redirection...`)
        setSent(true)
        if (onEmergencyLogin) onEmergencyLogin(r.data.user)
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      } else {
        setEmailError(r.data?.error || 'Une erreur est survenue.')
      }
    } catch (err) {
      console.error(err)
      const msg = err.response?.data?.error || 'Erreur serveur. Veuillez vérifier votre connexion.'
      setEmailError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff] font-sans flex">

      {/* Left - Form Panel */}
      <div className="flex-1 flex flex-col justify-between px-8 sm:px-16 lg:px-24 py-12">

        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0A1172] rounded-xl flex items-center justify-center shadow-md shadow-blue-900/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-800 tracking-tight">VisionMed</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A1172] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Retour à la connexion
          </button>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm mx-auto">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            MODE URGENCE
          </div>

          <h1 className="text-3xl font-extrabold text-[#0A1172] tracking-tight leading-snug mb-2">
            Accès d'urgence
          </h1>
          <p className="text-gray-500 text-sm font-light mb-8 leading-relaxed">
            Identifiez-vous avec votre email professionnel pour un accès immédiat en cas d'urgence. (Max 5 connexions)
          </p>

          {/* Info banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-8">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              L'accès d'urgence est enregistré et audité. Réservé aux situations cliniques critiques nécessitant un accès immédiat.
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {successMessage && (
                <div className="mb-4 bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl border border-emerald-100 flex items-start gap-3 animate-in fade-in">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                  <p className="font-medium">{successMessage}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email professionnel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className={`h-5 w-5 ${emailError ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError('') }}
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      emailError
                        ? 'border-red-300 focus:ring-red-500 bg-red-50/30'
                        : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172] bg-white'
                    } rounded-xl focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                    placeholder="nom@hopital.com"
                    autoFocus
                  />
                </div>
                {emailError && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {emailError}
                  </p>
                )}
                {remainingAttempts !== null && !emailError && (
                  <p className={`mt-1.5 text-xs font-medium flex items-center gap-1.5 ${remainingAttempts === 0 ? 'text-red-500' : 'text-blue-600'}`}>
                    <Info className="w-3 h-3" />
                    {remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''} sur 5
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLoading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                    <Zap className="w-4 h-4" />
                    Se connecter
                  </>
                }
              </button>
            </form>
          ) : (
            /* Success State */
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Authentification réussie</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Accès d'urgence accordé pour <br />
                    <span className="font-semibold text-[#0A1172]">{email}</span>
                  </p>
                  <p className="mt-4 text-xs text-emerald-600 font-medium flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Redirection vers l'espace de travail...
                  </p>
                </div>

                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    Lien valide 15 minutes
                  </div>
                  {secondsLeft && (
                    <button
                      onClick={() => { setSent(false); setSecondsLeft(null) }}
                      disabled={secondsLeft > 0}
                      className="text-xs text-[#0A1172] font-medium disabled:text-slate-400 disabled:cursor-not-allowed hover:underline transition-colors"
                    >
                      {secondsLeft > 0 ? `Renvoyer dans ${secondsLeft}s` : 'Renvoyer'}
                    </button>
                  )}
                </div>

                <button
                  onClick={onBack}
                  className="mt-2 text-sm text-gray-500 hover:text-[#0A1172] transition-colors hover:underline"
                >
                  Retour à la connexion standard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          © 2026 VisionMed · Accès audité · Conforme HIPAA & RGPD
        </p>
      </div>

      {/* Right - Visual Panel */}
      <div className="hidden lg:flex w-[420px] flex-none bg-[#0A1172] relative overflow-hidden flex-col justify-between p-14">

        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        {/* Top badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Accès Prioritaire</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-red-300" />
          </div>
          <h2 className="text-3xl font-extrabold text-white leading-snug tracking-tight">
            Protocole d'urgence<br />
            <span className="text-red-300">clinique activé</span>
          </h2>
          <p className="text-blue-200/70 text-sm font-light leading-relaxed">
            Ce mode est conçu pour les situations critiques nécessitant un accès immédiat aux données d'imagerie. Chaque connexion est tracée et soumise à audit de sécurité.
          </p>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { label: 'Délai de réception', value: '< 30s' },
              { label: 'Validité du lien', value: '15 min' },
              { label: 'Chiffrement', value: 'AES-256' },
              { label: 'Audit', value: 'Complet' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3">
                <p className="text-white font-bold text-base">{value}</p>
                <p className="text-blue-300/60 text-[11px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom labels */}
        <div className="relative z-10 flex gap-6 text-[10px] font-semibold text-blue-200/40 uppercase tracking-widest">
          <span>ISO 27001</span>
          <span>HIPAA</span>
          <span>CE IIb</span>
        </div>
      </div>

    </div>
  )
}
