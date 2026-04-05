import React, { useState, useEffect } from 'react'
import { Activity, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle, ArrowRight, Building2, Phone, Copy, RefreshCw, X, FileText, Eye, EyeOff, Zap } from 'lucide-react'
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
  const [fullNameError, setFullNameError] = useState('')
  const [specialtyError, setSpecialtyError] = useState('')
  const [hospitalError, setHospitalError] = useState('')
  const [nomError, setNomError] = useState('')
  const [prenomError, setPrenomError] = useState('')
  const [affiliationError, setAffiliationError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [fullNameSuccess, setFullNameSuccess] = useState('')
  const [copyNotification, setCopyNotification] = useState('')
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
    if (token) {
      setResetToken(token)
      setCurrentPage('reset-password')
    }
  }, [])

  const onEmailChange = (v) => { setUsername(v); setEmailError(''); setEmailSuccess('') }
  const onPasswordChange = (v) => { setPassword(v); setPasswordError(''); setPasswordSuccess('') }
  const onFullNameChange = (v) => { setFullName(v); setFullNameError(''); setFullNameSuccess('') }
  const onSpecialtyChange = (v) => { setSpecialty(v); setSpecialtyError('') }
  const onHospitalChange = (v) => { setHospital(v); setHospitalError('') }
  const onNomChange = (v) => { setNom(v); setNomError('') }
  const onPrenomChange = (v) => { setPrenom(v); setPrenomError('') }
  const onAffiliationChange = (v) => { setAffiliation(v); setAffiliationError('') }

  // Block timer effect
  useEffect(() => {
    // Check localStorage for persistent blocking
    const blockedUntil = localStorage.getItem('login_blocked_until')
    if (blockedUntil) {
      const now = Date.now()
      const timeLeft = Math.ceil((parseInt(blockedUntil) - now) / 1000)

      if (timeLeft > 0) {
        setIsBlocked(true)
        setBlockTimer(timeLeft)
        setLoginAttempts(JSON.parse(localStorage.getItem('login_attempts') || '0'))
      } else {
        // Unblock
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

  const isPersonalEmailDomain = (email) => {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
    const domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase()
    return personalDomains.includes(domain)
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

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopyNotification('Copié!')
    setTimeout(() => setCopyNotification(''), 2000)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setNomError('')
    setPrenomError('')
    setAffiliationError('')
    setPasswordError('')

    let hasError = false
    if (!nom.trim()) { setNomError('Requis'); hasError = true }
    if (!prenom.trim()) { setPrenomError('Requis'); hasError = true }
    if (!affiliation.trim()) { setAffiliationError('Requis'); hasError = true }
    if (!validateEmail(username)) { setEmailError('Email invalide'); hasError = true }
    // TODO: Réactiver la vérification du domaine professionnel après tests
    // else if (isPersonalEmailDomain(username)) { setEmailError('Veuillez utiliser votre email professionnel'); hasError = true }
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
        setError('Erreur serveur')
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
        setEmailError('')
        setPasswordError('')
        setErrorType(null)
        setLoginAttempts(0)
        localStorage.removeItem('login_attempts')
        localStorage.removeItem('login_blocked_until')
        setSuccessMessage('Connexion réussie ! Redirection...')
        setPasswordSuccess('Connecté')
        onLogin(r.data.user)
        setTimeout(() => { window.location.href = '/' }, 500)
      } else {
        // Handle different error types from backend
        const errorType = r.data?.error_type
        const errMsg = r.data?.error || 'Identifiants invalides'

        if (errorType === 'user_not_found') {
          // Email doesn't exist - don't increment blocking counter
          setErrorType('user_not_found')
          setEmailError(errMsg)
        } else if (errorType === 'invalid_password') {
          // Password is wrong - increment blocking counter
          setErrorType('invalid_password')
          setPasswordError(errMsg)

          // Count failed password attempts
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
          // Generic error
          setError(errMsg)
        }
      }
    } catch (err) {
      console.error(err)
      const errorType = err.response?.data?.error_type
      const srvMsg = err.response?.data?.error || 'Erreur serveur'

      if (errorType === 'user_not_found') {
        setErrorType('user_not_found')
        setEmailError(srvMsg)
      } else if (errorType === 'invalid_password') {
        setErrorType('invalid_password')
        setPasswordError(srvMsg)

        // Count failed password attempts
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
        setError(srvMsg)
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
    <div className="min-h-screen flex bg-[#f0f4ff] font-sans selection:bg-[#0A1172]/10 selection:text-[#0A1172]">

      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 relative py-12">
        <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10 animate-in slide-in-from-bottom-4 duration-700 fade-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0A1172] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-800 tracking-tight">VisionMed</span>
            </div>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setCurrentPage('emergency')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              >
                <Zap className="w-3 h-3 fill-red-500" />
                Mode urgence
              </button>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-[#0A1172] tracking-tight mb-2">
              {isSignUp ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="text-gray-500 font-light">
              {isSignUp ? 'Rejoignez la nouvelle génération de praticiens.' : 'Accédez à votre espace de travail sécurisé.'}
            </p>
          </div>

          {/* Type Toggle */}
          <div className="bg-gray-200/50 p-1 rounded-xl flex mb-8">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${!isSignUp ? 'bg-white text-[#0A1172] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isSignUp ? 'bg-white text-[#0A1172] shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Inscription
            </button>
          </div>



          {successMessage && (
            <div className="mb-6 bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl border border-emerald-100 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
              <p className="font-medium">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {isBlocked && !isSignUp && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-sm text-amber-700 font-medium">
                Compte temporairement bloqué. Réessayez dans {blockTimer} secondes.
              </p>
            </div>
          )}

          {loginAttempts > 0 && loginAttempts < 6 && !isSignUp && (
            <div className="text-xs text-amber-600 text-center mb-4">
              Attention : {3 - loginAttempts} tentative(s) restante(s) avant blocage temporaire.
            </div>
          )}

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
            {isSignUp && (
              <>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        value={nom}
                        onChange={e => onNomChange(e.target.value)}
                        className={`block w-full pl-10 pr-3 py-3 border ${nomError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                        placeholder="Votre nom"
                      />
                    </div>
                    {nomError && <p className="mt-1 text-xs text-red-600 font-medium">{nomError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        value={prenom}
                        onChange={e => onPrenomChange(e.target.value)}
                        className={`block w-full pl-10 pr-3 py-3 border ${prenomError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                        placeholder="Votre prénom"
                      />
                    </div>
                    {prenomError && <p className="mt-1 text-xs text-red-600 font-medium">{prenomError}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Affiliation</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      value={affiliation}
                      onChange={e => onAffiliationChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${affiliationError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                      placeholder="CHU de Sfax, Université de Tunis..."
                    />
                  </div>
                  {affiliationError && <p className="mt-1 text-xs text-red-600 font-medium">{affiliationError}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Spécialité (optionnel)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-5 w-5 text-gray-400" />
                      </div>
                      <select
                        value={specialty}
                        onChange={e => setSpecialty(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-white focus:bg-white focus:border-[#0A1172] focus:ring-[#0A1172] transition-colors duration-200 focus:outline-none focus:ring-2 sm:text-sm text-gray-900 appearance-none"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Neurologie">Neurologie</option>
                        <option value="Cardiologie">Cardiologie</option>
                        <option value="Radiologie">Radiologie</option>
                        <option value="Chirurgie">Chirurgie</option>
                        <option value="Médecine générale">Médecine générale</option>
                        <option value="Pédiatrie">Pédiatrie</option>
                        <option value="Psychiatrie">Psychiatrie</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade (optionnel)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-5 w-5 text-gray-400" />
                      </div>
                      <select
                        value={grade}
                        onChange={e => setGrade(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-white focus:bg-white focus:border-[#0A1172] focus:ring-[#0A1172] transition-colors duration-200 focus:outline-none focus:ring-2 sm:text-sm text-gray-900 appearance-none"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Professeur">Professeur</option>
                        <option value="Docteur">Docteur</option>
                        <option value="Résident">Résident</option>
                        <option value="Interne">Interne</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone (optionnel)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={telephone}
                      onChange={e => setTelephone(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-white focus:bg-white focus:border-[#0A1172] focus:ring-[#0A1172] transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900"
                      placeholder="+216 XX XXX XXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={username}
                      onChange={e => onEmailChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${emailError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                      placeholder="nom@hopital.com"
                    />
                  </div>
                  {emailError && <p className="mt-1 text-xs text-red-600 font-medium">{emailError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => onPasswordChange(e.target.value)}
                      className={`block w-full pl-10 pr-20 py-3 border ${passwordError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                      placeholder="Tapez ou générez un mot de passe"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="p-1.5 text-gray-400 hover:text-[#0A1172] transition-colors rounded-md hover:bg-gray-100"
                        title="Générer un mot de passe sécurisé"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-gray-400 hover:text-[#0A1172] transition-colors rounded-md hover:bg-gray-100"
                        title={showPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-red-600 font-medium">{passwordError}</p>}
                  <p className="text-xs text-slate-400 mt-1">Min. 8 caractères • Maj • Chiffres • Symboles</p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={e => setAcceptTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-[#0A1172] focus:ring-[#0A1172]"
                    />
                    <span className="text-sm text-gray-800">
                      J'accepte les <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('terms') }} className="text-[#0A1172] underline hover:text-opacity-80">conditions d'utilisation</a>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={e => setAcceptPrivacy(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-[#0A1172] focus:ring-[#0A1172]"
                    />
                    <span className="text-sm text-gray-800">
                      J'accepte la <a href="#" onClick={(e) => { e.preventDefault(); setCurrentPage('privacy') }} className="text-[#0A1172] underline hover:text-opacity-80">politique de confidentialité</a>
                    </span>
                  </label>
                </div>
              </>
            )}

            {!isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={username}
                      onChange={e => onEmailChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${emailError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                      placeholder="nom@hopital.com"
                    />
                  </div>
                  {emailError && (
                    <div>
                      <p className="mt-1 text-xs text-red-600 font-medium">{emailError}</p>
                      {errorType === 'user_not_found' && (
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          className="mt-2 px-3 py-2 bg-[#0A1172]/10 text-[#0A1172] text-xs font-medium rounded-lg hover:bg-[#0A1172]/20 transition-colors"
                        >
                          → Créer un compte
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showSignInPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => onPasswordChange(e.target.value)}
                      className={`block w-full pl-10 pr-12 py-3 border ${passwordError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:border-[#0A1172] focus:ring-[#0A1172]'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-gray-400 focus:outline-none focus:ring-2 sm:text-sm text-gray-900`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      title={showSignInPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showSignInPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordError && <p className="mt-1 text-xs text-red-600 font-medium">{passwordError}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage('forgot-password')}
                      className="text-xs text-gray-500 hover:text-[#0A1172] hover:underline transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading || (isSignUp && (!nom.trim() || !prenom.trim() || !affiliation.trim() || !username.trim() || password.length < 8 || !acceptTerms || !acceptPrivacy)) || (isBlocked && !isSignUp)}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/20 text-sm font-semibold text-white bg-[#0A1172] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  {isSignUp ? 'Créer mon compte' : 'Se connecter'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-gray-400">
            © 2026 VisionMed. Sécurisé et conforme HIPAA.
          </div>
        </div>
      </div>

      {/* Password Generated Toast Notification */}
      {passwordGeneratedNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          Mot de passe généré ! Pensez à le copier.
        </div>
      )}

      <div className="hidden lg:flex flex-1 relative bg-[#0A1172]">
        <div className="absolute inset-0 bg-[url('/assets/images/doctor2.jpg')] bg-cover bg-center opacity-5 mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-[#0A1172] mix-blend-multiply"></div>

        <div className="relative z-10 w-full h-full flex flex-col justify-between p-20 text-white">
          <div className="flex justify-end">

          </div>

          <div className="space-y-8 max-w-lg">
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
              La référence en imagerie de précision.
            </h1>
            <p className="text-lg text-blue-100/80 font-light leading-relaxed">
              "VisionMed a transformé notre flux de travail. Automatisez les étapes clés de l’imagerie médicale sans compromettre la précision."
            </p>
            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                <img
                  src="/assets/images/doctor1.jpg"
                  alt="Médecin 1"
                  className="w-12 h-12 rounded-full border-2 border-blue-500 object-cover"
                />
                <img
                  src="/assets/images/doctor2.jpg"
                  alt="Médecin 2"
                  className="w-12 h-12 rounded-full border-2 border-blue-500 object-cover"
                />
                <img
                  src="/assets/images/doctor3.jpg"
                  alt="Médecin 3"
                  className="w-12 h-12 rounded-full border-2 border-blue-500 object-cover"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold block">Rejoignez 500+ experts</span>
                <span className="text-blue-200">Radiologues & Neurologues</span>
              </div>
            </div>
          </div>

          <div className="flex gap-8 text-xs font-medium text-blue-200/60 uppercase tracking-widest">
            <span>ISO 27001</span>
            <span>HIPAA Compliant</span>
            <span>CE Class IIb</span>
          </div>
        </div>
      </div>

    </div>
  )
}