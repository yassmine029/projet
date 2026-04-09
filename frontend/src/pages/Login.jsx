import React, { useState, useEffect } from 'react'
import { Brain, ShieldCheck, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle, ArrowRight, Building2, Phone, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react'
import { login, register } from '../api'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import EmergencyLoginPage from './EmergencyLoginPage'

export default function Login({ onLogin }) {
  const [currentPage, setCurrentPage] = useState('login')
  const [isSignUp, setIsSignUp] = useState(false)
  const [resetToken, setResetToken] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hospital, setHospital] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [grade, setGrade] = useState('')
  const [telephone, setTelephone] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordGeneratedNotification, setPasswordGeneratedNotification] = useState(false)

  // Sign In password visibility
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  // Login blocking states
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimer, setBlockTimer] = useState(0)

  // Error type tracking
  const [errorType, setErrorType] = useState(null) // 'user_not_found' or 'invalid_password' or null

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const pathname = window.location.pathname

    if (token || pathname.includes('/reset-password')) {
      if (token) setResetToken(token)
      setCurrentPage('reset-password')
    } else if (pathname.includes('/forgot-password')) {
      setCurrentPage('forgot-password')
    }
  }, [])

  const onEmailChange = (v) => { setUsername(v); setEmailError(''); setEmailSuccess('') }
  const onPasswordChange = (v) => { setPassword(v); setPasswordError(''); setPasswordSuccess('') }

  // Block timer effect
  useEffect(() => {
    const blockedUntil = localStorage.getItem('login_blocked_until')
    if (blockedUntil) {
      const now = Date.now()
      const timeLeft = Math.ceil((parseInt(blockedUntil) - now) / 1000)

      if (timeLeft > 0) {
        setIsBlocked(true)
        setBlockTimer(timeLeft)
        setLoginAttempts(JSON.parse(localStorage.getItem('login_attempts') || '0'))
      } else {
        localStorage.removeItem('login_blocked_until')
        localStorage.removeItem('login_attempts')
        setIsBlocked(false)
        setLoginAttempts(0)
      }
    } else {
      const storedAttempts = localStorage.getItem('login_attempts')
      if (storedAttempts) {
        setLoginAttempts(JSON.parse(storedAttempts))
      }
    }
  }, [])

  useEffect(() => {
    if (!isBlocked || blockTimer <= 0) return
    const interval = setInterval(() => {
      setBlockTimer(prev => {
        if (prev <= 1) {
          setIsBlocked(false)
          setLoginAttempts(0)
          localStorage.removeItem('login_blocked_until')
          localStorage.removeItem('login_attempts')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isBlocked, blockTimer])

  const validateEmail = (e) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(e)
  }

  const generateSecurePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    const all = uppercase + lowercase + numbers + special

    let password = ''
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    for (let i = password.length; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)]
    }

    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword()
    setPassword(newPassword)
    setPasswordError('')
    setPasswordGeneratedNotification(true)
    setTimeout(() => setPasswordGeneratedNotification(false), 3000)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setPasswordError('')

    let hasError = false
    if (!nom.trim()) { hasError = true }
    if (!prenom.trim()) { hasError = true }
    if (!affiliation.trim()) { hasError = true }
    if (!validateEmail(username)) { setEmailError('Email invalide'); hasError = true }
    if (password.length < 8) { setPasswordError('Minimum 8 caractères'); hasError = true }
    if (!acceptTerms) { setError('Veuillez accepter les conditions'); hasError = true }
    if (!acceptPrivacy) { setError('Veuillez accepter la politique de confidentialité'); hasError = true }
    if (hasError) return

    setIsLoading(true)
    try {
      const r = await register({ username, password, nom, prenom, affiliation, specialty, grade, telephone })
      if (r.data && r.data.ok) {
        setIsSignUp(false)
        setSuccessMessage('Compte créé avec succès ! Connectez-vous.')
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        const errMsg = (r.data && r.data.error) ? r.data.error : 'Erreur lors de la création du compte'
        const low = String(errMsg).toLowerCase()
        if (low.includes('username') || low.includes('email') || low.includes('exist')) {
          setEmailError('Email déjà utilisé')
        } else {
          setError(errMsg)
        }
      }
    } catch (err) {
      console.error(err)
      const srvMsg = err && err.response && err.response.data && err.response.data.error
      if (srvMsg) {
        const low = String(srvMsg).toLowerCase()
        if (low.includes('username') || low.includes('email') || low.includes('exist')) {
          setEmailError('Email déjà utilisé')
        } else {
          setError(srvMsg)
        }
      } else {
        setError('Serveur indisponible. Verifiez que le backend Django est demarre sur le port 8000.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (isBlocked) return
    setError('')
    setEmailError('')
    setPasswordError('')
    setErrorType(null)

    let hasError = false
    if (!validateEmail(username)) { setEmailError('Email invalide'); hasError = true }
    if (!password) { setPasswordError('Requis'); hasError = true }
    if (hasError) return

    setIsLoading(true)
    try {
      const r = await login(username, password)
      if (r.data && r.data.ok) {
        setLoginAttempts(0)
        localStorage.removeItem('login_attempts')
        localStorage.removeItem('login_blocked_until')
        setSuccessMessage('Connexion réussie ! Redirection...')
        onLogin(r.data.user)
        setTimeout(() => { window.location.href = '/' }, 500)
      } else {
        const errorType = r.data?.error_type
        const errMsg = r.data?.error || 'Identifiants invalides'

        if (errorType === 'user_not_found') {
          setErrorType('user_not_found')
          setEmailError(errMsg)
        } else if (errorType === 'invalid_password') {
          setErrorType('invalid_password')
          setPasswordError(errMsg)
          setLoginAttempts(prev => {
            const newCount = prev + 1
            localStorage.setItem('login_attempts', newCount.toString())
            if (newCount >= 3) {
              setIsBlocked(true)
              setBlockTimer(30)
              const blockedUntil = Date.now() + (30 * 60 * 1000)
              localStorage.setItem('login_blocked_until', blockedUntil.toString())
            }
            return newCount
          })
        } else {
          setError(errMsg)
        }
      }
    } catch (err) {
      console.error(err)
      const errorType = err.response?.data?.error_type
      const srvMsg = err.response?.data?.error || ''

      if (errorType === 'user_not_found') {
        setErrorType('user_not_found')
        setEmailError(srvMsg)
      } else if (errorType === 'invalid_password') {
        setErrorType('invalid_password')
        setPasswordError(srvMsg)
        setLoginAttempts(prev => {
          const newCount = prev + 1
          localStorage.setItem('login_attempts', newCount.toString())
          if (newCount >= 3) {
            setIsBlocked(true)
            setBlockTimer(30)
            const blockedUntil = Date.now() + (30 * 60 * 1000)
            localStorage.setItem('login_blocked_until', blockedUntil.toString())
          }
          return newCount
        })
      } else {
        if (srvMsg) {
          setError(srvMsg)
        } else {
          setError('Serveur indisponible. Verifiez que le backend Django est demarre sur le port 8000.')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (currentPage === 'terms') return <TermsPage onBack={() => { setCurrentPage('login'); setIsSignUp(true) }} />
  if (currentPage === 'privacy') return <PrivacyPage onBack={() => { setCurrentPage('login'); setIsSignUp(true) }} />
  if (currentPage === 'forgot-password') return <ForgotPasswordPage onNavigate={setCurrentPage} />
  if (currentPage === 'reset-password') return <ResetPasswordPage onNavigate={setCurrentPage} token={resetToken} />
  if (currentPage === 'emergency') return <EmergencyLoginPage onBack={() => setCurrentPage('login')} />

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">

      {/* Left Column - Form */}
      <div className={`flex-1 flex flex-col px-4 sm:px-6 lg:px-20 xl:px-24 relative bg-white overflow-y-auto ${isSignUp ? 'justify-start pt-8 pb-8' : 'justify-center py-12'}`}>
        {/* Subtle decorative accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-50/20 rounded-full blur-3xl opacity-60"></div>
        <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10 animate-in slide-in-from-bottom-4 duration-700 fade-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">NeuroScan</span>
            </div>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setCurrentPage('emergency')}
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5 uppercase tracking-widest"
              >
                <Zap className="w-3 h-3 fill-red-500" />
                Mode urgence
              </button>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2 uppercase">
              {isSignUp ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              {isSignUp ? 'Rejoignez la nouvelle génération de praticiens connectés.' : 'Accédez à votre poste de travail clinique sécurisé.'}
            </p>
          </div>

          <div className="bg-slate-50 p-1.5 rounded-2xl flex mb-10 border border-slate-100">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${!isSignUp ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${isSignUp ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest'}`}
            >
              Inscription
            </button>
          </div>

          {successMessage && (
            <div className="mb-6 bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl border border-emerald-100 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
              <p className="font-bold">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}

          {isBlocked && !isSignUp && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-700 font-bold uppercase tracking-widest">
                Compte temporairement bloqué. Réessayez dans {blockTimer}s.
              </p>
            </div>
          )}

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
            {isSignUp && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Nom</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          value={nom}
                          onChange={e => setNom(e.target.value)}
                          className="block w-full pl-10 pr-3 py-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium"
                          placeholder="Nom"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Prénom</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          value={prenom}
                          onChange={e => setPrenom(e.target.value)}
                          className="block w-full pl-10 pr-3 py-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium"
                          placeholder="Prénom"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Affiliation</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      value={affiliation}
                      onChange={e => setAffiliation(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium"
                      placeholder="Identifiant Hospitalier / Institution"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Email professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3.5 border ${emailError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium`}
                      placeholder="medecin@hopital.med"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`block w-full pl-10 pr-20 py-3.5 border ${passwordError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium`}
                      placeholder="Tapez ou générez"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      <button type="button" onClick={handleGeneratePassword} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"><RefreshCw className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-blue-600 transition-colors">J'accepte les conditions d'utilisation</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={acceptPrivacy} onChange={e => setAcceptPrivacy(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-blue-600 transition-colors">J'accepte la politique de confidentialité</span>
                  </label>
                </div>
              </>
            )}

            {!isSignUp && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Email professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={username}
                      onChange={e => onEmailChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-4 border ${emailError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium`}
                      placeholder="nom@hopital.com"
                    />
                  </div>
                  {emailError && <p className="mt-1 text-xs text-red-600 font-bold">{emailError}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showSignInPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => onPasswordChange(e.target.value)}
                      className={`block w-full pl-10 pr-12 py-4 border ${passwordError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium`}
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowSignInPassword(!showSignInPassword)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-blue-600 transition-colors">{showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <button type="button" onClick={() => setCurrentPage('forgot-password')} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Mot de passe oublié ?</button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading || (isSignUp && (!nom.trim() || !prenom.trim() || !affiliation.trim() || !username.trim() || password.length < 8 || !acceptTerms || !acceptPrivacy)) || (isBlocked && !isSignUp)}
              className="group w-full h-14 flex justify-center items-center gap-3 px-8 rounded-2xl shadow-xl shadow-blue-600/20 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] relative overflow-hidden"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span className="text-sm font-bold uppercase tracking-widest">{isSignUp ? 'Créer mon compte' : 'Se connecter'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pt-8 border-t border-slate-50">
            © 2026 NeuroScan · HDS Certified System
          </div>
        </div>
      </div>

      {/* Right Column - Visual */}
      <div className="hidden lg:flex w-[450px] xl:w-[550px] relative overflow-hidden bg-[#0a0f2c] flex-col justify-between p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_100%,_rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 -left-20 w-80 h-80 bg-blue-400/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-full px-4 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></div>
            <span className="text-[8px] font-black text-white uppercase tracking-widest">Sécurité des données</span>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-0.5 shadow-2xl rotate-3">
             <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Brain className="w-7 h-7 text-blue-400" />
             </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight uppercase">
              Une sécurité <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
                clinique de haut niveau 
              </span>
            </h2>
            <p className="text-base text-blue-200/60 font-light leading-relaxed max-w-sm">
               Accédez à vos outils de neuro-imagerie
                en toute confiance — vos données patients
                sont protégées à chaque étape.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
             {[
               { label: 'CONFIDENTIALITÉ', val: 'Données patients protégées' },
               { label: ' ACCÈS', val: 'Réservé aux professionnels autorisés' },
               { label: 'PROTECTION', val: 'Vos données ne quittent pas le serveur' },
               { label: 'TRAÇABILITÉ', val: 'Chaque accès est enregistré' }
             ].map((stat, i) => (
               <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/10 transition-colors">
                  <p className="text-blue-400 font-extrabold text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-white font-bold text-base tracking-tight">{stat.val}</p>
               </div>
             ))}
          </div>
        </div>

      
      </div>

    </div>
  )
}