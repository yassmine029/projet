import React, { useState, useEffect } from 'react'
import { Activity, Lock, ArrowLeft, Shield, CheckCircle, Eye, EyeOff, Clock, ArrowRight } from 'lucide-react'

// Full-page minimal state — matches dub.co expired link style
const MinimalStatePage = ({ type, errorMessage, onNavigate }) => {
  const isExpired = type === 'expired'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      background: '#f8fafc',
      backgroundImage: 'linear-gradient(rgba(10,17,114,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(10,17,114,0.045) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}>

      {/* Radial gradient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 700px 500px at 50% 50%, rgba(220,230,255,0.55), transparent)',
      }} />

      {/* Top-left branding */}
      <div style={{ position: 'absolute', top: '28px', left: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', background: '#0A1172', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={20} color="white" />
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>VisionMed</span>
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: '500px', width: '100%' }}>

        {/* Icon circle — Clock for both error and expired (time-based security) */}
        <div style={{
          width: '80px', height: '80px',
          borderRadius: '50%',
          background: 'white',
          border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 32px auto',
          boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        }}>
          <Clock size={32} color="#94a3b8" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '44px', fontWeight: '800',
          color: '#0f172a', margin: '0 0 14px 0',
          letterSpacing: '-1.5px', lineHeight: '1.1',
        }}>
          {isExpired ? 'Lien expiré' : 'Lien invalide'}
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '16px', color: '#64748b',
          fontWeight: '400', lineHeight: '1.65',
          margin: '0 0 40px 0',
        }}>
          {isExpired
            ? 'Ce lien de réinitialisation a expiré. Les liens sont valides pendant 15 minutes seulement.'
            : (errorMessage || 'Ce lien de réinitialisation est invalide ou a déjà été utilisé.')
          }
        </p>

        {/* Primary pill button — navy blue */}
        <button
          onClick={() => onNavigate('forgot-password')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '13px 36px',
            borderRadius: '999px',
            border: 'none',
            background: '#0A1172',
            color: 'white',
            fontSize: '15px', fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(10,17,114,0.28)',
            marginBottom: '14px',
          }}
        >
          Demander un nouveau lien <ArrowRight size={16} />
        </button>

        <br />

        {/* Secondary button */}
        <button
          onClick={() => onNavigate('login')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 24px',
            borderRadius: '999px',
            border: '1.5px solid #e2e8f0',
            background: 'white',
            color: '#64748b',
            fontSize: '14px', fontWeight: '500',
            cursor: 'pointer',
            marginTop: '4px',
          }}
        >
          <ArrowLeft size={14} /> Retour à la connexion
        </button>

        {/* Support */}
        <p style={{ marginTop: '44px', fontSize: '13px', color: '#94a3b8' }}>
          Besoin d'aide ?{' '}
          <a href="mailto:admin@visionmed.com" style={{ color: '#0A1172', fontWeight: '600', textDecoration: 'none' }}>
            admin@visionmed.com
          </a>
        </p>
      </div>

      {/* Bottom badges */}
      <div style={{
        position: 'absolute', bottom: '24px',
        display: 'flex', gap: '28px',
        fontSize: '11px', fontWeight: '600',
        color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1.5px',
      }}>
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
    const validateToken = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/validate_reset_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await response.json()
        if (!response.ok) {
          if (data.error_type === 'token_expired') setStep('expired')
          else { setStep('error'); setErrorMessage(data.error || 'Lien invalide') }
        } else { setStep('form') }
      } catch { setStep('error'); setErrorMessage('Erreur lors de la validation du lien') }
      finally { setIsValidatingToken(false) }
    }
    validateToken()
  }, [token])

  const validatePassword = (pwd) => {
    if (!pwd) return 'Le mot de passe est requis'
    if (pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères'
    if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une majuscule'
    if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une minuscule'
    if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre'
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)'
    return ''
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    const v = validatePassword(newPassword)
    if (v) { setPasswordError(v); return }
    if (newPassword !== confirmPassword) { setConfirmError('Les mots de passe ne correspondent pas'); setPasswordError(''); return }
    setIsLoading(true); setPasswordError(''); setConfirmError(''); setErrorMessage('')
    try {
      const response = await fetch('http://localhost:8000/api/reset_password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (data.error_type === 'token_expired') setStep('expired')
        else if (data.error_type === 'token_invalid') { setStep('error'); setErrorMessage('Lien invalide ou expiré') }
        else { setStep('error'); setErrorMessage(data.error || 'Erreur inconnue') }
      } else { setStep('success') }
    } catch { setStep('error'); setErrorMessage('Erreur de connexion. Veuillez réessayer.') }
    finally { setIsLoading(false) }
  }

  if (!isValidatingToken && (step === 'error' || step === 'expired')) {
    return <MinimalStatePage type={step} errorMessage={errorMessage} onNavigate={onNavigate} />
  }

  return (
    <div className="min-h-screen flex bg-blue-50 font-sans">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 py-12">
        <div className="mx-auto w-full max-w-sm lg:w-96 py-8">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-800 tracking-tight">VisionMed</span>
          </div>

          <div className="flex items-center gap-2 mb-8 mt-6">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500 text-white"><CheckCircle className="w-4 h-4" /></div>
            <div className="flex-1 h-0.5 bg-emerald-400"></div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500 text-white"><CheckCircle className="w-4 h-4" /></div>
            <div className={`flex-1 h-0.5 ${step === 'form' || step === 'success' ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${step === 'form' || step === 'success' ? 'bg-emerald-500' : 'bg-red-600'}`}>
              {step === 'form' || step === 'success' ? <CheckCircle className="w-4 h-4" /> : '3'}
            </div>
          </div>

          <button onClick={() => onNavigate('login')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>

          {isValidatingToken && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-semibold text-gray-600">Validation du lien en cours...</p>
            </div>
          )}

          {!isValidatingToken && step === 'form' && (
            <div>
              <h2 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-2">Réinitialiser votre mot de passe</h2>
              <p className="text-gray-500 font-light mb-8">Entrez votre nouveau mot de passe en respectant les critères de sécurité.</p>
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Critères de sécurité requis</p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1 font-light">
                      <li>✓ Au minimum 8 caractères</li>
                      <li>✓ Au moins une majuscule (A-Z)</li>
                      <li>✓ Au moins une minuscule (a-z)</li>
                      <li>✓ Au moins un chiffre (0-9)</li>
                      <li>✓ Au moins un caractère spécial (!@#$%^&*...)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <form onSubmit={handleResetPassword}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                  <input type={showPassword ? 'text' : 'password'} value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                    className={`block w-full pl-10 pr-10 py-3 border ${passwordError ? 'border-red-300' : 'border-gray-200'} rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 sm:text-sm text-gray-900`}
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-red-600 font-medium mb-4">{passwordError}</p>}
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
                <div className="relative mb-6">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError('') }}
                    className={`block w-full pl-10 pr-10 py-3 border ${confirmError ? 'border-red-300' : 'border-gray-200'} rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 sm:text-sm text-gray-900`}
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmError && <p className="text-xs text-red-600 font-medium mb-4">{confirmError}</p>}
                <button type="submit" disabled={isLoading}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '12px', border: 'none', background: '#0A1172', color: 'white', fontSize: '14px', fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, boxShadow: '0 4px 16px rgba(10,17,114,0.25)' }}>
                  {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <><span>Réinitialiser le mot de passe</span><ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-blue-900 mb-2">Mot de passe réinitialisé !</h2>
              <p className="text-gray-500 font-light mb-8">Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.</p>
              <button onClick={() => onNavigate('login')}
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '12px', border: 'none', background: '#0A1172', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 16px rgba(10,17,114,0.25)' }}>
                Se connecter <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>

      <div className="hidden lg:flex flex-1 relative" style={{ background: '#0A1172' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0A1172 100%)' }}></div>
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-20 text-white">
          <div></div>
          <div style={{ maxWidth: '420px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: '800', lineHeight: '1.15', letterSpacing: '-1px', marginBottom: '24px' }}>
              La référence en imagerie de précision.
            </h1>
            <p style={{ fontSize: '16px', color: 'rgba(191,219,254,0.8)', fontWeight: '300', lineHeight: '1.7', marginBottom: '40px' }}>
              "VisionMed a transformé notre flux de travail. Automatisez les étapes clés de l'imagerie médicale sans compromettre la précision."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex' }}>
                {[1,2,3].map(i => (
                  <img key={i} src={`/assets/images/doctor${i}.jpg`} alt={`Médecin ${i}`}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(96,165,250,0.6)', objectFit: 'cover', marginLeft: i > 1 ? '-10px' : 0 }} />
                ))}
              </div>
              <div>
                <p style={{ fontWeight: '700', fontSize: '14px', margin: 0 }}>Rejoignez 500+ experts</p>
                <p style={{ color: 'rgba(191,219,254,0.7)', fontSize: '13px', margin: 0 }}>Radiologues & Neurologues</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '32px', fontSize: '11px', fontWeight: '600', color: 'rgba(147,197,253,0.5)', textTransform: 'uppercase', letterSpacing: '2px' }}>
            <span>ISO 27001</span><span>HIPAA Compliant</span><span>CE Class IIb</span>
          </div>
        </div>
      </div>
    </div>
  )
}