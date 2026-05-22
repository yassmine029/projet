import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, ShieldAlert, CheckCircle2, AlertTriangle, Brain, Zap, ArrowRight, Briefcase } from 'lucide-react'
import { emergencyLogin, checkSession, checkEmergencyLimit } from '../api'

export default function EmergencyLoginPage({ onBack, onLogin }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState(null)

  const refreshAttempts = async () => {
    if (!email || !orderNumber) return
    try {
      const res = await checkEmergencyLimit(email, orderNumber)
      if (res.data?.ok) setRemainingAttempts(res.data.remaining ?? null)
    } catch {
      /* silencieux */
    }
  }

  useEffect(() => {
    setRemainingAttempts(2)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !orderNumber) {
      if (!email) setEmailError('Email professionnel requis')
      if (!orderNumber) setOrderError("Numéro d'ordre requis")
      return
    }
    setIsLoading(true)
    setEmailError('')
    setOrderError('')
    
    try {
      const response = await emergencyLogin(email, orderNumber)
      if (response.data && response.data.ok) {
        if (response.data.remaining !== undefined) setRemainingAttempts(response.data.remaining)
        // La session Django est déjà créée par emergency_login (Set-Cookie).
        // checkSession peut parfois ne pas voir le cookie tout de suite (timing / onglet) :
        // on enrichit via l’API si possible, sinon on dérive l’utilisateur depuis la réponse.
        let merged = null
        try {
          const sess = await checkSession()
          if (sess.data?.logged_in) {
            const raw = sess.data.user
            const u =
              raw && typeof raw === 'object'
                ? raw
                : { username: raw, fullName: raw, is_staff: sess.data.is_staff }
            merged = {
              ...u,
              is_emergency_session: Boolean(sess.data.is_emergency_session),
            }
          }
        } catch (sessErr) {
          console.error(sessErr)
        }

        if (!merged) {
          const uname = (response.data.user || email || '').trim()
          merged = {
            username: uname,
            fullName: uname.includes('@') ? uname.split('@')[0].replace(/[._]/g, ' ') : uname,
            is_emergency_session: true,
          }
        }

        localStorage.setItem('user', JSON.stringify(merged))
        // Stocker les infos de session pour l'affichage dans EmergencyDashboard
        const countUsed = (response.data.count ?? 0);
        sessionStorage.setItem('emergency_count', String(countUsed));
        sessionStorage.setItem('emergency_max', '10');
        onLogin?.(merged)
        navigate('/urgence', { replace: true })
        return
      } else {
        setEmailError(response.data?.error || 'Validation d\'urgence échouée.')
        await refreshAttempts()
      }
    } catch (err) {
      console.error(err)
      const serverError = err?.response?.data?.error
      if (serverError && serverError.toLowerCase().includes('numéro')) {
        setOrderError(serverError)
      } else {
        setEmailError(serverError || 'Erreur de communication avec le serveur HDS.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-red-100 selection:text-red-900 overflow-hidden">
      {/* Structural integrity bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-600 to-orange-600 z-50"></div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative py-12">
        <div className="absolute top-0 left-0 w-full h-full bg-red-50/10 -z-10"></div>
        
        <div className="max-w-md w-full mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">NeuroScan</span>
            </div>
            
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-600 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Retour à la connexion standard
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                <Zap className="w-3 h-3 fill-red-600 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Protocole d'Urgence</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
                Accédez à la plateforme <span className="text-red-600">sans attendre </span>
              </h2>
              <p className="text-slate-500 font-medium leading-relaxed text-sm">
                Testez NeuroScan immédiatement avec votre adresse professionnelle.
                Votre accès complet sera activé après validation par l'administrateur.
              </p>
            </div>

            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Professionnel</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className={`h-4 w-4 ${emailError ? 'text-red-400' : 'text-slate-400'}`} />
                    </div>
                    <input 
                      type="email" 
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError('') }}
                      className={`block w-full pl-10 pr-4 py-3.5 border ${emailError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white transition-all duration-300 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-red-600/5 sm:text-sm text-slate-900 font-medium`}
                      placeholder="nom@neuroscan.med" 
                      autoFocus
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-600 font-black pl-1 flex items-center gap-1.5 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {emailError}
                    </p>
                  )}
                  {remainingAttempts !== null && !emailError && (
                    <div className="flex items-center gap-2 pl-1 mt-3">
                       <div className="flex gap-1">
                          {[1,2].map(i => (
                            <div key={i} className={`w-3 h-1 rounded-full transition-colors duration-500 ${i <= remainingAttempts ? 'bg-red-400' : 'bg-slate-100'}`}></div>
                          ))}
                       </div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {remainingAttempts} tentatives restantes
                       </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Numéro d'ordre tunisien</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Briefcase className={`h-4 w-4 ${orderError ? 'text-red-400' : 'text-slate-400'}`} />
                    </div>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={e => { setOrderNumber(e.target.value.toUpperCase()); setOrderError('') }}
                      className={`block w-full pl-10 pr-4 py-3.5 border ${orderError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white transition-all duration-300 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-red-600/5 sm:text-sm text-slate-900 font-medium`}
                      placeholder="12345 ou T-12345"
                    />
                  </div>
                  {orderError && (
                    <p className="text-xs text-red-600 font-black pl-1 flex items-center gap-1.5 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {orderError}
                    </p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || !email || !orderNumber}
                  className="w-full h-14 flex justify-center items-center gap-3 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-red-600/20 active:scale-[0.98] transition-all duration-300 group disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 fill-white" />
                      <span className="text-sm font-bold uppercase tracking-widest">Accéder à la plateforme</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="space-y-4 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-100">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">Accès Accordé</h2>
                  <p className="text-slate-500 font-medium text-sm">Session d'urgence active pour <span className="text-red-600 font-bold">{email}</span></p>
                </div>
                
                <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                   <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Statut HDS</span>
                      <span className="text-emerald-600">Connecté</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                      <p className="text-sm text-slate-600 font-bold">Redirection prioritaire...</p>
                   </div>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pt-8 border-t border-slate-50">
            © 2026 NeuroScan · HDS Certified System
          </p>
        </div>
      </div>

      {/* Right Column - Visual */}
      <div className="hidden lg:flex w-[450px] xl:w-[550px] relative overflow-hidden bg-[#0d0d1a] flex-col justify-between p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-red-950/20 to-slate-950"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(239,68,68,0.1),transparent_50%)]"></div>
        
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-red-600/5 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '3s' }}></div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 backdrop-blur-md rounded-full px-4 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-[8px] font-black text-red-100 uppercase tracking-widest">Emergency Override Active</span>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl p-0.5 shadow-2xl rotate-3">
             <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-red-500" />
             </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight uppercase">
              Découvrez NeuroScan <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                avant votre activation.
              </span>
            </h2>
            <p className="text-base text-slate-400 font-light leading-relaxed max-w-sm">
              Explorez les fonctionnalités
             de segmentation et de recalage
             dès maintenant — votre compte
             sera activé sous 24h.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
             {[
               { label: 'SESSIONS', val: '2 disponibles' },
               { label: 'DURÉE', val: 'illimitée' },
               { label: 'DONNÉES ', val: 'Démo uniquement' },
               { label: 'ACCÈS', val: 'sécurisé' },
             ].map((stat, i) => (
               <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/10 transition-colors">
                  <p className="text-red-400 font-extrabold text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-white font-bold text-base tracking-tight">{stat.val}</p>
               </div>
             ))}
          </div>
        </div>

        
      </div>
    </div>
  )
}
