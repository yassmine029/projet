import React, { useState, useEffect } from 'react'
import { Lock, ArrowLeft, Shield, Eye, EyeOff, Clock, ArrowRight, Brain, CheckCircle2 } from 'lucide-react'
import { validateResetToken, resetPassword } from '../api'

// Full-page minimal state — modern clinical style
const MinimalStatePage = ({ type, errorMessage, onNavigate }) => {
  const isExpired = type === 'expired'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-slate-100/40 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

      {/* Topbranding */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-extrabold text-slate-900 tracking-tight">NeuroScan</span>
      </div>

      {/* Main content */}
      <div className="max-w-md w-full text-center space-y-8 relative z-10">
        <div className="w-20 h-20 bg-white border border-slate-200 rounded-3xl shadow-xl flex items-center justify-center mx-auto">
          <Clock size={32} className="text-slate-400" strokeWidth={1.5} />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
            {isExpired ? 'Lien expiré' : 'Lien invalide'}
          </h1>
          <p className="text-slate-500 leading-relaxed font-medium">
            {isExpired
              ? 'Ce lien de réinitialisation a expiré. Pour votre sécurité, les liens sont valides pendant 15 minutes.'
              : (errorMessage || 'Ce lien de réinitialisation est invalide ou a déjà été utilisé.')
            }
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => onNavigate('forgot-password')}
            className="w-full flex justify-center items-center gap-2 py-4 px-8 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 transition-all active:scale-[0.98]"
          >
            <span className="text-sm">Demander un nouveau lien</span> <ArrowRight size={18} />
          </button>

          <button
            onClick={() => onNavigate('login')}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-8 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
          >
            <ArrowLeft size={16} /> <span className="text-xs uppercase tracking-widest font-black">Retour à la connexion</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 pt-8 uppercase tracking-widest font-bold">
          Besoin d'aide ? <a href="mailto:admin@neuroscan.med" className="text-blue-600 hover:underline font-bold">admin@neuroscan.med</a>
        </p>
      </div>

      {/* Bottom badges */}
      <div className="absolute bottom-8 flex gap-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">
        <span>ISO 27001</span><span>HIPAA Compliant</span><span>CE Class IIb</span>
      </div>
    </div>
  )
}

export default function ResetPasswordPage({ onNavigate, token }) {
  const [step, setStep] = useState('form')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isValidatingToken, setIsValidatingToken] = useState(true)

  useEffect(() => {
    if (!token) {
      setStep('error')
      setErrorMessage('Lien de réinitialisation invalide')
      setIsValidatingToken(false)
      return
    }
    const validate = async () => {
      try {
        const response = await validateResetToken(token)
        if (response.data && response.data.ok) {
          setStep('form')
        } else {
          const data = response.data
          if (data?.error_type === 'token_expired') setStep('expired')
          else { setStep('error'); setErrorMessage(data?.error || 'Lien invalide') }
        }
      } catch (err) {
        console.error(err)
        setStep('error')
        setErrorMessage('Erreur lors de la validation du lien')
      } finally {
        setIsValidatingToken(false)
      }
    }
    validate()
  }, [token])

  const validatePassword = (pwd) => {
    if (!pwd) return 'Le mot de passe est requis'
    if (pwd.length < 8) return 'Minimum 8 caractères requis'
    if (!/[A-Z]/.test(pwd)) return 'Une majuscule requise'
    if (!/[a-z]/.test(pwd)) return 'Une minuscule requise'
    if (!/[0-9]/.test(pwd)) return 'Un chiffre requis'
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Un caractère spécial requis'
    return ''
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    const v = validatePassword(newPassword)
    if (v) { setPasswordError(v); return }
    if (newPassword !== confirmPassword) { setConfirmError('Les mots de passe ne correspondent pas'); setPasswordError(''); return }
    setIsLoading(true); setPasswordError(''); setConfirmError(''); setErrorMessage('')
    try {
      const response = await resetPassword(token, newPassword)
      if (response.data && response.data.ok) {
        setStep('success')
      } else {
        const data = response.data
        if (data?.error_type === 'token_expired') setStep('expired')
        else if (data?.error_type === 'token_invalid') { setStep('error'); setErrorMessage('Lien invalide ou expiré') }
        else { setStep('error'); setErrorMessage(data?.error || 'Erreur inconnue') }
      }
    } catch (err) {
      console.error(err)
      setStep('error'); setErrorMessage('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isValidatingToken && (step === 'error' || step === 'expired')) {
    return <MinimalStatePage type={step} errorMessage={errorMessage} onNavigate={onNavigate} />
  }

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800 z-50"></div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative py-12">
        <div className="absolute top-0 left-0 w-full h-full bg-blue-50/20 -z-10"></div>
        
        <div className="max-w-md w-full mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
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
              const isDone = num < 3 || step === 'success';
              const isActive = num === 3 && step === 'form';
              
              return (
                <React.Fragment key={num}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 shadow-sm
                    ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-600 text-white scale-110 shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : num}
                  </div>
                  {num < 3 && (
                    <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {isValidatingToken ? (
            <div className="text-center py-20 space-y-6">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-500 font-bold tracking-tight uppercase text-[10px]">Validation de sécurité...</p>
            </div>
          ) : step === 'form' ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
                  Nouveau <br/><span className="text-blue-600">mot de passe</span>
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Identité vérifiée. Veuillez choisir un nouveau mot de passe robuste.
                </p>
              </div>

              <div className="bg-white border border-blue-50 p-6 rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900 leading-tight">Exigences de sécurité</p>
                    <ul className="text-[10px] text-slate-400 grid grid-cols-2 gap-x-4 gap-y-1 font-bold">
                      <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-blue-400 rounded-full"></div> 8+ caractères</li>
                      <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-blue-400 rounded-full"></div> Majuscules</li>
                      <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-blue-400 rounded-full"></div> Minuscules</li>
                      <li className="flex items-center gap-1.5 col-span-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div> Caractères spéciaux</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                      className={`block w-full pl-12 pr-12 py-4 border ${passwordError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white transition-all duration-300 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm text-slate-900 font-medium`}
                      placeholder="••••••••" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors">
                      {showPassword ? <EyeOff strokeWidth={2.5} className="w-4 h-4" /> : <Eye strokeWidth={2.5} className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && <p className="text-xs text-red-600 font-bold pl-1">{passwordError}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Confirmer le mot de passe</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError('') }}
                      className={`block w-full pl-12 pr-12 py-4 border ${confirmError ? 'border-red-300' : 'border-slate-100'} rounded-2xl bg-slate-50/50 focus:bg-white transition-all duration-300 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm text-slate-900 font-medium`}
                      placeholder="••••••••" 
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors">
                      {showConfirmPassword ? <EyeOff strokeWidth={2.5} className="w-4 h-4" /> : <Eye strokeWidth={2.5} className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmError && <p className="text-xs text-red-600 font-bold pl-1">{confirmError}</p>}
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-14 flex justify-center items-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-blue-600/20 active:scale-[0.98] transition-all duration-300 group disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="text-sm">Mettre à jour</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : step === 'success' ? (
            <div className="text-center space-y-10 animate-in fade-in zoom-in duration-500">
              <div className="space-y-4">
                <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mot de passe mis à jour !</h2>
                <p className="text-slate-500 font-medium">Votre nouveau mot de passe a été enregistré avec succès.</p>
              </div>
              
              <button 
                onClick={() => onNavigate('login')}
                className="w-full flex justify-center items-center gap-3 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-300 group"
              >
                <span className="text-sm">Accéder à la connexion</span> <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
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