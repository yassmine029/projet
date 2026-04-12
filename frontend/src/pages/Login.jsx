import React, { useState, useEffect } from 'react'
import { Brain, ShieldCheck, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle, ArrowRight, Building2, Phone, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react'
import { login, register } from '../api'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import EmergencyLoginPage from './EmergencyLoginPage'

const AFFILIATION_OPTIONS = [
  'CHU de Monastir',
  'CHU de Sfax',
  'CHU de Tunis',
  'CHU de Sousse',
  'Hôpital régional',
  'Clinique privée',
  'Université / Faculté de médecine',
  'Autre',
]

const SPECIALTY_OPTIONS = [
  { value: 'neuroradiologie', label: 'Neuroradiologie' },
  { value: 'neurologie', label: 'Neurologie' },
  { value: 'medecine_nucleaire', label: 'Médecine nucléaire' },
  { value: 'autre', label: 'Autre' },
]

const GRADE_OPTIONS = [
  { value: 'interne', label: 'Interne' },
  { value: 'resident', label: 'Résident' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'praticien', label: 'Praticien' },
  { value: 'professeur', label: 'Professeur' },
]

const ORDER_NUMBER_REGEX = /^(?:\d{4,6}|T-\d{4,6})$/
const PHONE_REGEX = /^[24579]\d{7}$/

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
  const [orderNumber, setOrderNumber] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [customAffiliation, setCustomAffiliation] = useState('')
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
  const [signUpFieldErrors, setSignUpFieldErrors] = useState({})
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordGeneratedNotification, setPasswordGeneratedNotification] = useState(false)
  const [allowSignUpEmailInput, setAllowSignUpEmailInput] = useState(false)
  const [allowSignUpPasswordInput, setAllowSignUpPasswordInput] = useState(false)
  const [allowSignInEmailInput, setAllowSignInEmailInput] = useState(false)
  const [allowSignInPasswordInput, setAllowSignInPasswordInput] = useState(false)

  // Sign In password visibility
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  // Login blocking states
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimer, setBlockTimer] = useState(0)

  // Error type tracking
  const [errorType, setErrorType] = useState(null) // 'user_not_found' or 'invalid_password' or null

  const focusSignUpField = (field) => {
    const fieldIdMap = {
      nom: 'signup-nom',
      prenom: 'signup-prenom',
      affiliation: 'signup-affiliation',
      customAffiliation: 'signup-custom-affiliation',
      orderNumber: 'signup-order-number',
      telephone: 'signup-telephone',
      email: 'signup-email',
      password: 'signup-password',
    }
    const target = document.getElementById(fieldIdMap[field])
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.focus()
    if (typeof target.animate === 'function') {
      target.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 280, easing: 'ease-out' }
      )
    }
  }

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const mode = params.get('mode')
    const pathname = window.location.pathname

    if (token || pathname.includes('/reset-password')) {
      if (token) setResetToken(token)
      setCurrentPage('reset-password')
    } else if (pathname.includes('/forgot-password')) {
      setCurrentPage('forgot-password')
    } else if (pathname.includes('/login') && mode === 'signup') {
      setIsSignUp(true)
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

  useEffect(() => {
    setAllowSignUpEmailInput(false)
    setAllowSignUpPasswordInput(false)
    setAllowSignInEmailInput(false)
    setAllowSignInPasswordInput(false)
    setSignUpFieldErrors({})
  }, [isSignUp])

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
    setSignUpFieldErrors(prev => ({ ...prev, password: '' }))
    setPasswordGeneratedNotification(true)
    setTimeout(() => setPasswordGeneratedNotification(false), 3000)
  }

  const applySignUpServerError = (rawMessage) => {
    const errMsg = String(rawMessage || 'Erreur lors de la création du compte')
    const low = errMsg.toLowerCase()

    if (low.includes('username') || low.includes('email') || low.includes('exist')) {
      setEmailError('Email déjà utilisé')
      setSignUpFieldErrors(prev => ({ ...prev, email: 'Email déjà utilisé' }))
      focusSignUpField('email')
      return
    }

    if (low.includes("numéro d'ordre") || low.includes('ordre') || low.includes('t-12345') || low.includes('format invalide')) {
      setSignUpFieldErrors(prev => ({ ...prev, orderNumber: errMsg }))
      focusSignUpField('orderNumber')
      return
    }

    if (low.includes('password')) {
      setPasswordError(errMsg)
      setSignUpFieldErrors(prev => ({ ...prev, password: errMsg }))
      focusSignUpField('password')
      return
    }

    if (low.includes('téléphone') || low.includes('telephone')) {
      setSignUpFieldErrors(prev => ({ ...prev, telephone: errMsg }))
      focusSignUpField('telephone')
      return
    }

    setError(errMsg)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setPasswordError('')
    setSignUpFieldErrors({})

    const normalizedAffiliation = affiliation === 'Autre' ? customAffiliation.trim() : affiliation.trim()
    const normalizedOrderNumber = (orderNumber || '').trim().toUpperCase()
    const normalizedTelephone = (telephone || '').trim().replace(/\s+/g, '')

    const nextErrors = {}
    let hasError = false
    if (!nom.trim()) { nextErrors.nom = 'Ce champ est obligatoire'; hasError = true }
    if (!prenom.trim()) { nextErrors.prenom = 'Ce champ est obligatoire'; hasError = true }
    if (!normalizedOrderNumber) {
      nextErrors.orderNumber = 'Ce champ est obligatoire'
      hasError = true
    } else if (!ORDER_NUMBER_REGEX.test(normalizedOrderNumber)) {
      nextErrors.orderNumber = "Format invalide"
      hasError = true
    }
    if (!affiliation.trim()) {
      nextErrors.affiliation = 'Ce champ est obligatoire'
      hasError = true
    } else if (affiliation === 'Autre' && !customAffiliation.trim()) {
      nextErrors.customAffiliation = 'Ce champ est obligatoire'
      hasError = true
    }
    if (normalizedTelephone && !PHONE_REGEX.test(normalizedTelephone)) {
      nextErrors.telephone = 'Numéro tunisien invalide.'
      hasError = true
    }
    if (!username.trim()) {
      nextErrors.email = 'Ce champ est obligatoire'
      hasError = true
    } else if (!validateEmail(username)) {
      nextErrors.email = 'Email invalide'
      setEmailError('Email invalide')
      hasError = true
    }

    if (!password.trim()) {
      nextErrors.password = 'Ce champ est obligatoire'
      hasError = true
    } else if (password.length < 8) {
      nextErrors.password = 'Minimum 8 caractères'
      setPasswordError('Minimum 8 caractères')
      hasError = true
    }

    if (!acceptTerms) {
      nextErrors.terms = 'Veuillez accepter les conditions d\'utilisation.'
      hasError = true
    }

    if (!acceptPrivacy) {
      nextErrors.privacy = 'Veuillez accepter la politique de confidentialité.'
      hasError = true
    }

    if (!username.trim()) nextErrors.email = 'Ce champ est obligatoire'
    if (!password.trim()) nextErrors.password = 'Ce champ est obligatoire'
    setSignUpFieldErrors(nextErrors)

    if (hasError) {
      const order = ['nom', 'prenom', 'orderNumber', 'telephone', 'affiliation', 'customAffiliation', 'email', 'password', 'terms', 'privacy']
      const firstInvalid = order.find((key) => nextErrors[key])
      if (firstInvalid) focusSignUpField(firstInvalid)
    }
    if (hasError) return

    setIsLoading(true)
    try {
      const r = await register({ username, password, nom, prenom, order_number: normalizedOrderNumber, affiliation: normalizedAffiliation, specialty, grade, telephone: normalizedTelephone })
      if (r.data && r.data.ok) {
        setSuccessMessage('')
        setIsSignUp(false)
      } else {
        const errMsg = (r.data && r.data.error) ? r.data.error : 'Erreur lors de la création du compte'
        applySignUpServerError(errMsg)
      }
    } catch (err) {
      console.error(err)
      const srvMsg = err && err.response && err.response.data && err.response.data.error
      if (srvMsg) {
        applySignUpServerError(srvMsg)
      } else {
        setError('Serveur indisponible. Verifiez que le backend Django est démarre sur le port 8000.')
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
    <div className="min-h-screen flex bg-[#e9eef8] font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">

      {/* Left Column - Form */}
      <div className={`flex-1 flex flex-col px-4 sm:px-6 lg:px-20 xl:px-24 relative bg-[#e9eef8] overflow-y-auto ${isSignUp ? 'justify-start pt-8 pb-8' : 'justify-center py-12'}`}>
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

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2 uppercase">
              {isSignUp ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              {isSignUp ? 'Rejoignez la nouvelle génération de praticiens connectés.' : 'Accédez à votre poste de travail clinique sécurisé.'}
            </p>
            <p className="mt-2 text-xs font-semibold text-rose-600">* Champs obligatoires</p>
          </div>

          <div className="bg-[#dfe5f2] p-1 rounded-xl flex mb-6 border border-[#d4dced]">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-300 ${!isSignUp ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-300 ${isSignUp ? 'bg-white text-[#2457d6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} autoComplete="off" className="space-y-4">
            <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
            <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} aria-hidden="true" />
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Nom <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-nom"
                      value={nom}
                      onChange={e => {
                        setNom(e.target.value)
                        setSignUpFieldErrors(prev => ({ ...prev, nom: '' }))
                      }}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm ${signUpFieldErrors.nom ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                      placeholder="Votre nom"
                    />
                  </div>
                  {signUpFieldErrors.nom && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.nom}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Prénom <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-prenom"
                      value={prenom}
                      onChange={e => {
                        setPrenom(e.target.value)
                        setSignUpFieldErrors(prev => ({ ...prev, prenom: '' }))
                      }}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm ${signUpFieldErrors.prenom ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                      placeholder="Votre prénom"
                    />
                  </div>
                  {signUpFieldErrors.prenom && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.prenom}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Affiliation <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                      id="signup-affiliation"
                      value={affiliation}
                      onChange={e => {
                        const value = e.target.value
                        setAffiliation(value)
                        setSignUpFieldErrors(prev => ({ ...prev, affiliation: '', customAffiliation: '' }))
                        if (value !== 'Autre') setCustomAffiliation('')
                      }}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm text-slate-700 ${signUpFieldErrors.affiliation ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                    >
                      <option value="">Sélectionner</option>
                      {AFFILIATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  {signUpFieldErrors.affiliation && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.affiliation}</p>}
                </div>

                {affiliation === 'Autre' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Préciser l'affiliation <span className="text-rose-600">*</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="signup-custom-affiliation"
                        value={customAffiliation}
                        onChange={e => {
                          setCustomAffiliation(e.target.value)
                          setSignUpFieldErrors(prev => ({ ...prev, customAffiliation: '' }))
                        }}
                        className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm ${signUpFieldErrors.customAffiliation ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                        placeholder="Nom de l'établissement"
                      />
                    </div>
                    {signUpFieldErrors.customAffiliation && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.customAffiliation}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Spécialité (optionnel)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                      </div>
                      <select
                        value={specialty}
                        onChange={e => setSpecialty(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm text-slate-700"
                      >
                        <option value="">Sélectionner</option>
                        {SPECIALTY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Grade (optionnel)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                      </div>
                      <select
                        value={grade}
                        onChange={e => setGrade(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm text-slate-700"
                      >
                        <option value="">Sélectionner</option>
                        {GRADE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Numéro d'ordre tunisien <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-order-number"
                      value={orderNumber}
                      onChange={e => {
                        setOrderNumber(e.target.value.toUpperCase())
                        setSignUpFieldErrors(prev => ({ ...prev, orderNumber: '' }))
                      }}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm ${signUpFieldErrors.orderNumber ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                      placeholder="12345 ou T-12345"
                    />
                  </div>
                  {signUpFieldErrors.orderNumber && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.orderNumber}</p>}
                  <p className="mt-1 text-xs text-slate-400">Format: 4 à 6 chiffres, avec ou sans préfixe T-.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Téléphone (optionnel)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-telephone"
                      value={telephone}
                      onChange={e => {
                        setTelephone(e.target.value)
                        setSignUpFieldErrors(prev => ({ ...prev, telephone: '' }))
                      }}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm ${signUpFieldErrors.telephone ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                      placeholder="22345678"
                    />
                  </div>
                  {signUpFieldErrors.telephone && <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.telephone}</p>}
                  <p className="mt-1 text-xs text-slate-400">Format tunisien: 8 chiffres, commence par 2, 4, 5, 7 ou 9.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Email professionnel <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-email"
                      type="email"
                      name="signup_email"
                      readOnly={!allowSignUpEmailInput}
                      onFocus={() => setAllowSignUpEmailInput(true)}
                      autoComplete="off"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${emailError ? 'border-red-300' : 'border-slate-300'} rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm`}
                      placeholder="votre.email@hopital.com"
                    />
                  </div>
                  {(signUpFieldErrors.email || emailError) && (
                    <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.email || emailError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Mot de passe <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      name="signup_password"
                      readOnly={!allowSignUpPasswordInput}
                      onFocus={() => setAllowSignUpPasswordInput(true)}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`block w-full pl-10 pr-20 py-3 border ${passwordError ? 'border-red-300' : 'border-slate-300'} rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all outline-none text-sm`}
                      placeholder="••••••••••"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      <button type="button" onClick={handleGeneratePassword} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"><RefreshCw className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Min. 8 caractères • Maj • Chiffres • Symboles</p>
                  {(signUpFieldErrors.password || passwordError) && (
                    <p className="mt-1 text-xs font-semibold text-rose-700">{signUpFieldErrors.password || passwordError}</p>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={e => {
                        setAcceptTerms(e.target.checked)
                        setSignUpFieldErrors(prev => ({ ...prev, terms: '' }))
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors">J'accepte les <button type="button" onClick={() => setCurrentPage('terms')} className="underline text-blue-700">conditions d'utilisation</button></span>
                  </label>
                  {signUpFieldErrors.terms && <p className="text-xs font-semibold text-rose-700">{signUpFieldErrors.terms}</p>}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={e => {
                        setAcceptPrivacy(e.target.checked)
                        setSignUpFieldErrors(prev => ({ ...prev, privacy: '' }))
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors">J'accepte la <button type="button" onClick={() => setCurrentPage('privacy')} className="underline text-blue-700">politique de confidentialité</button></span>
                  </label>
                  {signUpFieldErrors.privacy && <p className="text-xs font-semibold text-rose-700">{signUpFieldErrors.privacy}</p>}
                </div>
              </>
            )}

            {!isSignUp && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Email professionnel <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      name="signin_email"
                      readOnly={!allowSignInEmailInput}
                      onFocus={() => setAllowSignInEmailInput(true)}
                      autoComplete="off"
                      value={username}
                      onChange={e => onEmailChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-4 border ${emailError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none text-sm font-medium`}
                      placeholder="nom@hopital.com"
                    />
                  </div>
                  {emailError && <p className="mt-1 text-xs text-red-600 font-bold">{emailError}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Mot de passe <span className="text-rose-600">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showSignInPassword ? 'text' : 'password'}
                      name="signin_password"
                      readOnly={!allowSignInPasswordInput}
                      onFocus={() => setAllowSignInPasswordInput(true)}
                      autoComplete="new-password"
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
              disabled={isLoading || (isBlocked && !isSignUp)}
              className="group w-full h-12 flex justify-center items-center gap-3 px-8 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-[#2563eb] to-[#1e40af] hover:from-[#1d4ed8] hover:to-[#1e3a8a] focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98] relative overflow-hidden"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span className="text-sm font-semibold">{isSignUp ? 'Créer mon compte' : 'Se connecter'}</span>
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