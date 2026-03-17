import React, { useState } from 'react'
import { Activity, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle, ArrowRight, Building2 } from 'lucide-react'
import { login, register } from '../api'

export default function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hospital, setHospital] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [fullNameError, setFullNameError] = useState('')
  const [specialtyError, setSpecialtyError] = useState('')
  const [hospitalError, setHospitalError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [fullNameSuccess, setFullNameSuccess] = useState('')

  const onEmailChange = (v) => { setUsername(v); setEmailError(''); setEmailSuccess('') }
  const onPasswordChange = (v) => { setPassword(v); setPasswordError(''); setPasswordSuccess('') }
  const onFullNameChange = (v) => { setFullName(v); setFullNameError(''); setFullNameSuccess('') }
  const onSpecialtyChange = (v) => { setSpecialty(v); setSpecialtyError('') }
  const onHospitalChange = (v) => { setHospital(v); setHospitalError('') }

  const validateEmail = (e) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(e)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setEmailError('')
    setPasswordError('')
    setFullNameError('')
    setSpecialtyError('')
    setHospitalError('')

    let hasError = false
    if (!validateEmail(username)) { setEmailError('Email invalide'); hasError = true }
    if (password.length < 8) { setPasswordError('Min. 8 caractères'); hasError = true }
    if (!fullName.trim()) { setFullNameError('Requis'); hasError = true }
    if (specialty && specialty.length > 100) { setSpecialtyError('Trop long'); hasError = true }
    if (!hospital.trim()) { setHospitalError('Requis'); hasError = true }
    if (hospital && hospital.length > 150) { setHospitalError('Trop long'); hasError = true }
    if (hasError) return

    setIsLoading(true)
    try {
      const r = await register({ username, password, fullName, specialty, hospital })
      if (r.data && r.data.ok) {
        setIsSignUp(false)
        setSuccessMessage('Compte créé avec succès ! Connectez-vous.')
        setEmailSuccess('')
        setFullNameSuccess('')
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
    setError('')
    setEmailError('')
    setPasswordError('')

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
        setPasswordSuccess('Connecté')
        onLogin(r.data.user)
        setTimeout(() => { window.location.href = '/' }, 500)
      } else {
        const errMsg = (r.data && r.data.error) ? r.data.error : 'Identifiants invalides'
        const low = String(errMsg).toLowerCase()
        if (low.includes('invalid') || low.includes('credentials')) {
          setPasswordError('Identifiants invalides')
        } else if (low.includes('username') || low.includes('email')) {
          setEmailError(errMsg)
        } else {
          setError(errMsg)
        }
      }
    } catch (err) {
      console.error(err)
      const srvMsg = err && err.response && err.response.data && err.response.data.error
      if (srvMsg) {
        const low = String(srvMsg).toLowerCase()
        if (low.includes('invalid') || low.includes('credentials')) {
          setPasswordError('Identifiants invalides')
        } else if (low.includes('username') || low.includes('email')) {
          setEmailError(srvMsg)
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

  return (
    <div className="min-h-screen flex bg-blue-50/50 font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 relative overflow-hidden">
        {/* Background blobs for subtle effect */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-3xl opacity-60"></div>
        </div>

        <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10 animate-in slide-in-from-bottom-4 duration-700 fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-blue-900 tracking-tight">VisionMed</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-blue-900 tracking-tight mb-2">
              {isSignUp ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="text-blue-600/80">
              {isSignUp ? 'Rejoignez la nouvelle génération de praticiens.' : 'Accédez à votre espace de travail sécurisé.'}
            </p>
          </div>

          {/* Type Toggle */}
          <div className="bg-blue-50 p-1 rounded-xl flex mb-8">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${!isSignUp ? 'bg-white text-blue-900 shadow-sm ring-1 ring-blue-100' : 'text-blue-500 hover:text-blue-700'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isSignUp ? 'bg-white text-blue-900 shadow-sm ring-1 ring-blue-100' : 'text-blue-500 hover:text-blue-700'}`}
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

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-1.5">Nom complet</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      value={fullName}
                      onChange={e => onFullNameChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${fullNameError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-blue-100 focus:border-blue-500 focus:ring-blue-500'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-blue-300/50 focus:outline-none focus:ring-2 sm:text-sm text-blue-900`}
                      placeholder="Dr. Prenom Nom"
                    />
                  </div>
                  {fullNameError && <p className="mt-1 text-xs text-red-600 font-medium">{fullNameError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-1.5">Hôpital</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      value={hospital}
                      onChange={e => onHospitalChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border ${hospitalError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-blue-100 focus:border-blue-500 focus:ring-blue-500'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-blue-300/50 focus:outline-none focus:ring-2 sm:text-sm text-blue-900`}
                      placeholder="CHU de Sfax"
                    />
                  </div>
                  {hospitalError && <p className="mt-1 text-xs text-red-600 font-medium">{hospitalError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-1.5">Spécialité</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      value={specialty}
                      onChange={e => onSpecialtyChange(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-3 border border-blue-100 rounded-xl bg-white focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200 placeholder-blue-300/50 focus:outline-none focus:ring-2 sm:text-sm text-blue-900`}
                      placeholder="Ex: Neurologie"
                    />
                  </div>
                  {specialtyError && <p className="mt-1 text-xs text-red-600 font-medium">{specialtyError}</p>}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1.5">Email professionnel</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  type="email"
                  value={username}
                  onChange={e => onEmailChange(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border ${emailError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-blue-100 focus:border-blue-500 focus:ring-blue-500'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-blue-300/50 focus:outline-none focus:ring-2 sm:text-sm text-blue-900`}
                  placeholder="nom@hopital.com"
                />
              </div>
              {emailError && <p className="mt-1 text-xs text-red-600 font-medium">{emailError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1.5">Mot de passe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => onPasswordChange(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border ${passwordError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-blue-100 focus:border-blue-500 focus:ring-blue-500'} rounded-xl bg-white focus:bg-white transition-colors duration-200 placeholder-blue-300/50 focus:outline-none focus:ring-2 sm:text-sm text-blue-900`}
                  placeholder="••••••••"
                />
              </div>
              {passwordError && <p className="mt-1 text-xs text-red-600 font-medium">{passwordError}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/20 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5"
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

          <div className="mt-8 text-center text-xs text-blue-400">
            © 2026 VisionMed. Sécurisé et conforme HIPAA.
          </div>
        </div>
      </div>

      {/* Right Column - Visual */}
      <div className="hidden lg:flex flex-1 relative bg-blue-900">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 mix-blend-multiply"></div>

        <div className="relative z-10 w-full h-full flex flex-col justify-between p-20 text-white">
          <div className="flex justify-end">
            
          </div>

          <div className="space-y-8 max-w-lg">
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              La référence en imagerie de précision.
            </h1>
            <p className="text-lg text-blue-100 font-light leading-relaxed">
              "VisionMed a transformé notre flux de travail. Automatisez les étapes clés de l’imagerie médicale sans compromettre la précision."
            </p>
            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                <img
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop"
                  alt="Médecin 1"
                  className="w-10 h-10 rounded-full border-2 border-indigo-500 object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop"
                  alt="Médecin 2"
                  className="w-10 h-10 rounded-full border-2 border-indigo-500 object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100&h=100&fit=crop"
                  alt="Médecin 3"
                  className="w-10 h-10 rounded-full border-2 border-indigo-500 object-cover"
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