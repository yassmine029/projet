import React, { useState, useEffect } from 'react'
import { Mail, ArrowLeft, Shield, Clock, Brain, CheckCircle2, ArrowRight } from 'lucide-react'
import { forgotPassword } from '../api'

export default function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState('email') // email, sent, blocked
  const [resetEmail, setResetEmail] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0)

  useEffect(() => {
    const blockedUntil = localStorage.getItem('forgot_password_blocked_until')
    const storedAttempts = localStorage.getItem('forgot_password_attempts')
    if (blockedUntil) {
      const now = Date.now()
      const timeLeft = Math.ceil((parseInt(blockedUntil) - now) / 1000)
      if (timeLeft > 0) {
        setStep('blocked')
        setBlockTimeRemaining(timeLeft)
        setAttempts(6)
      } else {
        localStorage.removeItem('forgot_password_blocked_until')
        localStorage.removeItem('forgot_password_attempts')
        setAttempts(0)
      }
    } else if (storedAttempts) {
      setAttempts(parseInt(storedAttempts))
    }
  }, [])

  useEffect(() => {
    if (step !== 'blocked') return
    const blockedUntil = localStorage.getItem('forgot_password_blocked_until')
    if (!blockedUntil) return
    const updateTimer = () => {
      const now = Date.now()
      const timeRemaining = Math.ceil((parseInt(blockedUntil) - now) / 1000)
      if (timeRemaining <= 0) {
        localStorage.removeItem('forgot_password_blocked_until')
        localStorage.removeItem('forgot_password_attempts')
        setAttempts(0)
        setStep('email')
        setBlockTimeRemaining(0)
      } else {
        setBlockTimeRemaining(timeRemaining)
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [step])

  const handleSendResetLink = async (e) => {
    if (e) e.preventDefault()
    if (attempts > 5) { setStep('blocked'); return }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(resetEmail)) { setEmailError('Email invalide'); return }

    setIsLoading(true)
    setEmailError('')

    try {
      const response = await forgotPassword(resetEmail.toLowerCase())
      if (response.data && response.data.ok) {
        setStep('sent')
      } else {
        const errMsg = response.data?.error || 'Erreur lors de l\'envoi du lien sécurisé.'
        setEmailError(errMsg)
        handleFailure()
      }
    } catch (error) {
      console.error(error)
      const srvMsg = error.response?.data?.error || 'Erreur lors de la demande. Veuillez réessayer.'
      setEmailError(srvMsg)
      handleFailure()
    } finally {
      setIsLoading(false)
    }
  }

  const handleFailure = () => {
    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    localStorage.setItem('forgot_password_attempts', newAttempts.toString())
    if (newAttempts > 5) {
      const blockedUntil = Date.now() + (5 * 60 * 1000)
      localStorage.setItem('forgot_password_blocked_until', blockedUntil.toString())
      setBlockTimeRemaining(5 * 60)
      setStep('blocked')
    }
  }

  const isStepCompleted = (stepName) => {
    const stepsLookup = { 'email': 1, 'sent': 2, 'blocked': 3 }
    return stepsLookup[stepName] < stepsLookup[step]
  }
  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`

  // Full-page blocked state
  if (step === 'blocked') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-100/40 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">NeuroScan</span>
        </div>

        <div className="max-w-md w-full text-center space-y-8 relative z-10">
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-3xl shadow-xl flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-slate-400 animate-pulse" strokeWidth={1.5} />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Accès temporairement restreint
            </h1>
            <p className="text-slate-500 leading-relaxed font-medium">
              Par mesure de sécurité suite à trop de tentatives, votre accès est suspendu pour quelques minutes.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm group hover:border-blue-200 transition-all">
            <Clock className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-slate-600 font-bold">
              Réessayez dans{' '}
              <span className="text-blue-600">
                {blockTimeRemaining ? formatTime(blockTimeRemaining) : '00:00'}
              </span>
            </span>
          </div>

          <div>
            <button 
              onClick={() => onNavigate('login')}
              className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm active:scale-95 flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          </div>

          <p className="text-xs text-slate-400 pt-8 uppercase tracking-widest font-bold">
            Besoin d'aide ? <a href="mailto:admin@neuroscan.med" className="text-blue-600 hover:underline">Support Technique</a>
          </p>
        </div>

        <div className="absolute bottom-8 flex gap-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">
          <span>HIPAA Compliant</span>
          <span>ISO 27001</span>
          <span>CE Class IIb</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800 z-50"></div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative">
        <div className="absolute top-0 left-0 w-full h-full bg-blue-50/20 -z-10"></div>
        
        <div className="max-w-md w-full mx-auto space-y-10 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">NeuroScan</span>
            </div>
            
            <button 
              onClick={() => onNavigate('login')}
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Retour à la connexion
            </button>
          </div>

          <div className="flex items-center gap-4 py-2">
            {[1, 2, 3].map((num) => {
              const currentStepName = num === 1 ? 'email' : num === 2 ? 'sent' : 'blocked'
              const isDone = isStepCompleted(currentStepName)
              const isActive = step === currentStepName
              
              return (
                <React.Fragment key={num}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 shadow-sm
                    ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-600 text-white scale-110 shadow-blue-200 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : num}
                  </div>
                  {num < 3 && (
                    <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                  )}
                </React.Fragment>
              )
            })}
          </div>

          {step === 'email' ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
                  Réinitialisation <br/><span className="text-blue-600">sécurisée</span>
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Entrez votre adresse email professionnelle pour recevoir un lien de réinitialisation unique et sécurisé.
                </p>
              </div>

              <div className="bg-white border border-blue-50 p-6 rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 leading-tight">Protocole de sécurité activé</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Le lien de réinitialisation expire après <span className="text-blue-600 font-extrabold">15 minutes</span>.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSendResetLink} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className={`h-5 w-5 ${emailError ? 'text-red-400' : 'text-slate-400'}`} />
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => { setResetEmail(e.target.value); setEmailError('') }}
                      className={`block w-full pl-12 pr-4 py-4 border ${emailError ? 'border-red-300 focus:ring-red-500' : 'border-slate-100 focus:ring-blue-500/20'} rounded-2xl bg-slate-50/50 focus:bg-white transition-all duration-300 placeholder-slate-300 focus:outline-none focus:ring-4 sm:text-sm text-slate-900 font-medium`}
                      placeholder="v.nom@clinique.org"
                    />
                  </div>
                  {emailError && <p className="text-xs text-red-600 font-bold pl-1">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 flex justify-center items-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-blue-600/20 active:scale-[0.98] transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="text-sm">Envoyer le lien sécurisé</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-center gap-3 py-4">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infrastucture Sécurisée AES-256</p>
              </div>
            </div>
          ) : step === 'sent' ? (
            <div className="space-y-10 animate-in fade-in zoom-in duration-500">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-1 ring-emerald-100">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Email envoyé !</h2>
                <p className="text-slate-500 font-medium">
                  Un lien sécurisé a été envoyé à :<br/>
                  <span className="text-blue-600 font-bold">{resetEmail}</span>
                </p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 space-y-6 border border-slate-100">
                {[
                  { icon: Clock, title: 'Validité 15 minutes', desc: 'Le lien expire pour votre sécurité.' },
                  { icon: Shield, title: 'Usage unique', desc: 'Lien réutilisable non autorisé.' },
                  { icon: Mail, title: 'Dossier spam', desc: 'Vérifiez vos courriers indésirables.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm self-start">
                      <item.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => onNavigate('login')} 
                  className="w-full py-4 text-blue-600 font-bold hover:bg-blue-50 rounded-2xl transition-all"
                >
                  Retour à la connexion
                </button>
                <button 
                  onClick={() => setStep('email')} 
                  className="w-full py-4 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Renvoyer l'email
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden lg:flex w-[450px] xl:w-[550px] relative overflow-hidden bg-[#0a0f2c] flex-col justify-between p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_100%,_rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 -left-20 w-80 h-80 bg-blue-400/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-full px-4 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></div>
            <span className="text-[8px] font-black text-white uppercase tracking-widest">Medical Cloud Security</span>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-0.5 shadow-2xl rotate-3">
             <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Brain className="w-7 h-7 text-blue-400" />
             </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              Une sécurité <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
                clinique sans faille.
              </span>
            </h2>
            <p className="text-base text-blue-200/60 font-light leading-relaxed max-w-sm">
              Accédez à vos outils de neuro-imagerie préférés en toute confiance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
             {[
               { label: 'Chiffrement', val: 'AES-256' },
               { label: 'Standard', val: 'HIPAA' },
               { label: 'Infrastructure', val: 'HDS' },
               { label: 'Audit Log', val: 'Tier-III' }
             ].map((stat, i) => (
               <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/10 transition-colors">
                  <p className="text-blue-400 font-extrabold text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-white font-bold text-base tracking-tight">{stat.val}</p>
               </div>
             ))}
          </div>
        </div>

        <div className="relative z-10 flex gap-6 text-[10px] font-black text-white/30 uppercase tracking-widest">
          <span>ISO 27001 Certified</span>
          <span>NeuroScan Network</span>
        </div>
      </div>
    </div>
  )
}