import React, { useState, useEffect } from 'react'
import { Activity, Mail, Lock, ArrowLeft, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState('email')
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

  const handleSendResetLink = async () => {
    if (attempts > 5) { setStep('blocked'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(resetEmail)) { setEmailError('Email invalide'); return }
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: resetEmail.toLowerCase() }),
      })
      const data = await response.json()
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      localStorage.setItem('forgot_password_attempts', newAttempts.toString())
      if (newAttempts > 5) {
        const blockedUntil = Date.now() + (5 * 60 * 1000)
        localStorage.setItem('forgot_password_blocked_until', blockedUntil.toString())
        setBlockTimeRemaining(5 * 60)
        setStep('blocked')
      } else {
        setStep('sent')
      }
    } catch (error) {
      setEmailError('Erreur lors de la demande. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  const isStepCompleted = (stepName) => {
    const steps = { 'email': 1, 'sent': 2, 'blocked': 3 }
    return steps[stepName] < steps[step]
  }
  const isStepActive = (stepName) => step === stepName
  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`

  // Full-page blocked state
  if (step === 'blocked') {
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
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 700px 500px at 50% 50%, rgba(220,230,255,0.55), transparent)' }} />

        <div style={{ position: 'absolute', top: '28px', left: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: '#0A1172', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} color="white" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>VisionMed</span>
        </div>

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px auto', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <Clock size={32} color="#94a3b8" strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: '800', color: '#0f172a', margin: '0 0 14px 0', letterSpacing: '-1.5px', lineHeight: '1.1' }}>
            Accès temporaire restreint
          </h1>
          <p style={{ fontSize: '16px', color: '#64748b', fontWeight: '400', lineHeight: '1.65', margin: '0 0 16px 0' }}>
            Trop de tentatives détectées. Votre accès est bloqué pour 5 minutes.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 20px', marginBottom: '36px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <Clock size={16} color="#0A1172" />
            <span style={{ fontSize: '15px', color: '#64748b', fontWeight: '500' }}>
              Réessayez dans{' '}
              <span style={{ color: '#0A1172', fontWeight: '700' }}>
                {blockTimeRemaining ? formatTime(blockTimeRemaining) : 'Déblocage...'}
              </span>
            </span>
          </div>
          <div>
            <button onClick={() => onNavigate('login')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px 28px', borderRadius: '999px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          </div>
          <p style={{ marginTop: '44px', fontSize: '13px', color: '#94a3b8' }}>
            Besoin d'aide ?{' '}
            <a href="mailto:admin@visionmed.com" style={{ color: '#0A1172', fontWeight: '600', textDecoration: 'none' }}>admin@visionmed.com</a>
          </p>
        </div>

        <div style={{ position: 'absolute', bottom: '24px', display: 'flex', gap: '28px', fontSize: '11px', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          <span>ISO 27001</span><span>HIPAA Compliant</span><span>CE Class IIb</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-blue-50/50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Left Column */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-3xl opacity-60"></div>
        </div>

        <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10 animate-in slide-in-from-bottom-4 duration-700 fade-in">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#0A1172' }}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight" style={{ color: '#0A1172' }}>VisionMed</span>
            </div>
          </div>

          {/* Back button */}
          <button onClick={() => onNavigate('login')} className="flex items-center gap-2 text-sm mt-2 transition-colors mb-6" style={{ color: '#4a5ca8' }}>
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8 mt-6">
            <div className="w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center text-white"
              style={{ background: isStepCompleted('email') ? '#10b981' : '#0A1172' }}>
              {isStepCompleted('email') ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className="flex-1 h-0.5" style={{ background: isStepCompleted('email') ? '#10b981' : '#e2e8f0' }}></div>
            <div className="w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center"
              style={{ background: isStepCompleted('sent') ? '#10b981' : isStepActive('sent') ? '#0A1172' : '#e2e8f0', color: isStepActive('sent') || isStepCompleted('sent') ? 'white' : '#94a3b8' }}>
              {isStepCompleted('sent') ? <CheckCircle className="w-4 h-4" /> : '2'}
            </div>
            <div className="flex-1 h-0.5" style={{ background: isStepCompleted('sent') ? '#10b981' : '#e2e8f0' }}></div>
            <div className="w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center bg-slate-200 text-slate-400">3</div>
          </div>

          {/* STEP 1: Email */}
          {step === 'email' && (
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0A1172' }}>Réinitialisation sécurisée</h2>
              <p className="mb-8 font-light" style={{ color: '#4a5ca8' }}>Saisissez votre email professionnel pour recevoir un lien de réinitialisation.</p>

              {/* Distinguished info card — left border accent + shadow */}
              <div className="flex items-start gap-3 mb-6" style={{
                background: 'white',
                border: '1px solid #e0e7ff',
                borderLeft: '4px solid #0A1172',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 4px 16px rgba(10,17,114,0.08)',
              }}>
                <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#0A1172' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0A1172' }}>Processus sécurisé en 3 étapes</p>
                  <p className="text-xs mt-1" style={{ color: '#4a5ca8' }}>Le lien envoyé sera valide 15 minutes et à usage unique.</p>
                </div>
              </div>

              <label className="block text-sm font-medium mb-1.5" style={{ color: '#0A1172' }}>Email professionnel</label>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5" style={{ color: '#4a5ca8' }} />
                </div>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => { setResetEmail(e.target.value); setEmailError('') }}
                  className="block w-full pl-10 pr-3 py-3 rounded-xl bg-white focus:outline-none focus:ring-2 sm:text-sm transition-colors duration-200"
                  style={{ border: emailError ? '1px solid #f87171' : '1px solid #e0e7ff', color: '#0A1172' }}
                  placeholder="nom@hopital.com"
                />
              </div>
              {emailError && <p className="text-xs text-red-600 font-medium mb-4">{emailError}</p>}

              {attempts > 0 && attempts < 6 && (
                <div className="text-xs text-amber-600 text-center mb-4">
                  Attention : {6 - attempts} tentative(s) restante(s) avant blocage.
                </div>
              )}

              <button
                onClick={handleSendResetLink}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{ background: '#0A1172', boxShadow: '0 4px 16px rgba(10,17,114,0.25)' }}
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <><Lock className="w-4 h-4" /> Envoyer le lien sécurisé</>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-400">
                <Shield className="w-3 h-3" />
                <span>Lien chiffré · Validité 15 min · Usage unique</span>
              </div>
            </div>
          )}

          {/* STEP 2: Sent */}
          {step === 'sent' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#0A1172' }}>Email envoyé !</h2>
              <p className="mb-8 font-light" style={{ color: '#4a5ca8' }}>
                Un lien de réinitialisation sécurisé a été envoyé à{' '}
                <span className="font-semibold" style={{ color: '#0A1172' }}>{resetEmail}</span>
              </p>
              <div className="rounded-2xl p-6 text-left mb-6 space-y-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {[
                  { icon: Clock, title: 'Validité 15 minutes', sub: 'Le lien expire automatiquement' },
                  { icon: Shield, title: 'Usage unique', sub: 'Le lien devient invalide après utilisation' },
                  { icon: Mail, title: 'Vérifiez vos spams', sub: 'Si non reçu dans 2 min, vérifiez spam' },
                ].map(({ icon: Icon, title, sub }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e0e7ff' }}>
                      <Icon className="w-4 h-4" style={{ color: '#0A1172' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#0A1172' }}>{title}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-slate-500 mb-6">
                Vous n'avez pas reçu l'email ?{' '}
                <button onClick={() => { if (attempts > 5) { setStep('blocked'); return } setStep('email') }} className="font-medium hover:underline" style={{ color: '#0A1172' }}>
                  Renvoyer le lien
                </button>
              </p>
              <button onClick={() => onNavigate('login')} className="w-full py-3 font-semibold rounded-xl transition-colors" style={{ border: '2px solid #e0e7ff', color: '#0A1172', background: 'white' }}>
                Retour à la connexion
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Right Column */}
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
                {[
                  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop',
                  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop',
                  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100&h=100&fit=crop',
                ].map((src, i) => (
                  <img key={i} src={src} alt={`Médecin ${i+1}`}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(96,165,250,0.6)', objectFit: 'cover', marginLeft: i > 0 ? '-10px' : 0 }} />
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