import React, { useState, useEffect } from 'react'
import { Lock, ArrowLeft, Shield, Eye, EyeOff, Clock, ArrowRight, Brain, CheckCircle2 } from 'lucide-react'
import { validateResetToken, resetPassword, validateActivationToken, activateAccount } from '../api'

const CSS = `
  @keyframes imgZoom { from{transform:scale(1);} to{transform:scale(1.04);} }
  @keyframes spin     { to{transform:rotate(360deg);} }
`

const fld = (err = false, extra = {}) => ({
  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
  border: `1.5px solid ${err ? '#fca5a5' : '#e2e8f0'}`,
  borderRadius: 10, fontSize: 13.5, color: '#0f172a',
  background: err ? '#fff7f7' : '#f8fafc',
  outline: 'none', transition: 'border-color 0.18s, box-shadow 0.18s',
  ...extra,
})

function RightPanel() {
  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <img
        src="/images/connexion.jpeg"
        alt=""
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'cover', objectPosition:'center center',
          animation:'imgZoom 12s ease-in-out infinite alternate',
        }}
      />
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to bottom, rgba(6,13,31,0.10) 0%, rgba(6,13,31,0.30) 35%, rgba(6,13,31,0.72) 62%, rgba(6,13,31,0.97) 100%)',
      }}/>
      <div style={{ position:'relative', zIndex:2, padding:'40px 48px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Brain size={22} color="#fff"/>
            </div>
            <span style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>BrainCore</span>
          </div>
          <div>
            <p style={{ fontSize:26, fontWeight:800, color:'#fff', lineHeight:1.25, marginBottom:10 }}>
              Sécurité renforcée<br/>
              <span style={{ color:'#93c5fd' }}>pour vos données cliniques.</span>
            </p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.65, maxWidth:320 }}>
              Choisissez un nouveau mot de passe robuste pour protéger votre espace médical.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const wrapperStyle = {
  display:'flex', minHeight:'100vh', fontFamily:"system-ui, -apple-system, sans-serif",
  background:'#f8fafc',
}
const leftStyle = {
  flex:'1', display:'flex', flexDirection:'column', justifyContent:'center',
  padding:'48px 64px', maxWidth:560, margin:'0 auto',
}

// ── Error / Expired state ──────────────────────────────────────
function ErrorState({ type, errorMessage, onNavigate }) {
  return (
    <div style={wrapperStyle}>
      <style>{CSS}</style>
      <div style={leftStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:48 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Brain size={20} color="#fff"/>
          </div>
          <span style={{ fontSize:18, fontWeight:800, color:'#0f172a' }}>BrainCore</span>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'#fef2f2', border:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <Clock size={36} color="#dc2626"/>
          </div>
          <h2 style={{ fontSize:24, fontWeight:800, color:'#0f172a', marginBottom:12 }}>
            {type === 'expired' ? 'Lien expiré' : 'Lien invalide'}
          </h2>
          <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
            {type === 'expired'
              ? 'Ce lien a expiré. Les liens sont valides pendant 15 minutes.'
              : (errorMessage || 'Ce lien est invalide ou a déjà été utilisé.')}
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <button onClick={() => onNavigate('forgot-password')} style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              Demander un nouveau lien <ArrowRight size={16}/>
            </button>
            <button onClick={() => onNavigate('login')} style={{ width:'100%', height:44, borderRadius:12, border:'1.5px solid #e2e8f0', cursor:'pointer', background:'#fff', color:'#475569', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <ArrowLeft size={14}/> Retour à la connexion
            </button>
          </div>
        </div>
      </div>
      <div style={{ width:480, position:'relative', overflow:'hidden', flexShrink:0 }}>
        <RightPanel/>
      </div>
    </div>
  )
}

export default function ResetPasswordPage({ onNavigate, token, mode = 'reset' }) {
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
  const [effectiveMode, setEffectiveMode] = useState(() => (mode === 'activation' ? 'activation' : 'reset'))
  const isActivationMode = effectiveMode === 'activation'

  useEffect(() => { setEffectiveMode(mode === 'activation' ? 'activation' : 'reset') }, [mode])

  useEffect(() => {
    const normalized = (token || '').trim()
    if (!normalized) { setStep('error'); setErrorMessage('Lien de réinitialisation invalide'); setIsValidatingToken(false); return }
    const validate = async () => {
      setEffectiveMode(mode === 'activation' ? 'activation' : 'reset')
      try {
        const primaryIsActivation = mode === 'activation'
        const tryActivation = () => validateActivationToken(normalized)
        const tryReset = () => validateResetToken(normalized)
        const first = primaryIsActivation ? await tryActivation() : await tryReset()
        if (first.data?.ok) { setEffectiveMode(primaryIsActivation ? 'activation' : 'reset'); setStep('form'); return }
        if (first.data?.error_type === 'token_expired') { setStep('expired'); return }
        if (first.data?.error_type === 'token_invalid') {
          const second = primaryIsActivation ? await tryReset() : await tryActivation()
          if (second.data?.ok) { setEffectiveMode(primaryIsActivation ? 'reset' : 'activation'); setStep('form'); return }
          if (second.data?.error_type === 'token_expired') { setStep('expired'); return }
          setStep('error'); setErrorMessage(second.data?.error || first.data?.error || 'Lien invalide'); return
        }
        setStep('error'); setErrorMessage(first.data?.error || 'Lien invalide')
      } catch (err) {
        const data = err?.response?.data
        if (data?.error_type === 'token_expired') setStep('expired')
        else { setStep('error'); setErrorMessage(data?.error || 'Erreur lors de la validation du lien') }
      } finally { setIsValidatingToken(false) }
    }
    validate()
  }, [token, mode])

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
    if (newPassword !== confirmPassword) { setConfirmError('Les mots de passe ne correspondent pas'); return }
    setIsLoading(true); setPasswordError(''); setConfirmError(''); setErrorMessage('')
    const normalized = (token || '').trim()
    try {
      const response = isActivationMode ? await activateAccount(normalized, newPassword) : await resetPassword(normalized, newPassword)
      if (response.data?.ok) { setStep('success') }
      else {
        const data = response.data
        if (data?.error_type === 'token_expired') setStep('expired')
        else if (data?.error_type === 'token_invalid') { setStep('error'); setErrorMessage('Lien invalide ou expiré') }
        else { setStep('error'); setErrorMessage(data?.error || 'Erreur inconnue') }
      }
    } catch (err) {
      const data = err?.response?.data
      if (data?.error_type === 'token_expired') setStep('expired')
      else { setStep('error'); setErrorMessage(data?.error || 'Erreur de connexion. Veuillez réessayer.') }
    } finally { setIsLoading(false) }
  }

  if (!isValidatingToken && (step === 'error' || step === 'expired')) {
    return <ErrorState type={step} errorMessage={errorMessage} onNavigate={onNavigate}/>
  }

  return (
    <div style={wrapperStyle}>
      <style>{CSS}</style>
      <div style={leftStyle}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Brain size={20} color="#fff"/>
          </div>
          <span style={{ fontSize:18, fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>BrainCore</span>
        </div>

        {/* Back */}
        <button onClick={() => onNavigate('login')} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:32, transition:'color 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.color='#2563eb'} onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
          <ArrowLeft size={14}/> Retour à la connexion
        </button>

        {/* Steps */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
          {[1,2,3].map((num) => {
            const isDone = num < 3 || step === 'success'
            const isActive = num === 3 && step === 'form'
            return (
              <React.Fragment key={num}>
                <div style={{
                  width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:700, fontSize:13, transition:'all 0.3s',
                  background: isDone ? '#10b981' : isActive ? '#2563eb' : '#f1f5f9',
                  color: (isDone || isActive) ? '#fff' : '#94a3b8',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: isActive ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                }}>
                  {isDone ? <CheckCircle2 size={16}/> : num}
                </div>
                {num < 3 && <div style={{ flex:1, height:3, borderRadius:4, background: isDone ? '#10b981' : '#f1f5f9' }}/>}
              </React.Fragment>
            )
          })}
        </div>

        {/* Loading */}
        {isValidatingToken && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }}/>
            <p style={{ fontSize:12, color:'#94a3b8', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>Validation de sécurité...</p>
          </div>
        )}

        {/* Form */}
        {!isValidatingToken && step === 'form' && (
          <div>
            <h2 style={{ fontSize:28, fontWeight:800, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.15, marginBottom:10 }}>
              {isActivationMode ? 'Activation,' : 'Nouveau mot'}<br/>
              <span style={{ color:'#2563eb' }}>{isActivationMode ? 'Docteur.' : 'de passe.'}</span>
            </h2>
            <p style={{ fontSize:13.5, color:'#64748b', lineHeight:1.65, marginBottom:24 }}>
              {isActivationMode
                ? 'Bienvenue sur BrainCore. Choisissez votre mot de passe pour activer votre compte.'
                : 'Identité vérifiée. Choisissez un nouveau mot de passe robuste.'}
            </p>

            {/* Security notice */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'12px 16px', marginBottom:24 }}>
              <Shield size={15} color="#0284c7" style={{ flexShrink:0, marginTop:1 }}/>
              <div style={{ fontSize:12, color:'#0369a1', fontWeight:600, lineHeight:1.6 }}>
                <strong>Exigences :</strong> 8+ caractères · Majuscule · Minuscule · Chiffre · Caractère spécial
              </div>
            </div>

            <form onSubmit={handleResetPassword} style={{ display:'flex', flexDirection:'column', gap:18 }}>
              {/* New password */}
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
                  Nouveau mot de passe <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Lock size={14}/></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPasswordError('') }}
                    style={fld(!!passwordError, { paddingLeft:38, paddingRight:44 })}
                    placeholder="••••••••"
                  />
                  <div style={{ position:'absolute', right:8, top:0, bottom:0, display:'flex', alignItems:'center' }}>
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ padding:5, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', borderRadius:6 }}>
                      {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>
                {passwordError && <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600 }}>{passwordError}</p>}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
                  Confirmer le mot de passe <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Lock size={14}/></div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setConfirmError('') }}
                    style={fld(!!confirmError, { paddingLeft:38, paddingRight:44 })}
                    placeholder="••••••••"
                  />
                  <div style={{ position:'absolute', right:8, top:0, bottom:0, display:'flex', alignItems:'center' }}>
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding:5, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', borderRadius:6 }}>
                      {showConfirmPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>
                {confirmError && <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600 }}>{confirmError}</p>}
              </div>

              <button type="submit" disabled={isLoading} style={{
                width:'100%', height:48, borderRadius:12, border:'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color:'#fff', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: isLoading ? 'none' : '0 4px 20px rgba(37,99,235,0.32)',
                opacity: isLoading ? 0.65 : 1, transition:'all 0.22s ease',
              }}>
                {isLoading
                  ? <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                  : <><span>{isActivationMode ? 'Activer mon compte' : 'Mettre à jour'}</span><ArrowRight size={16}/></>
                }
              </button>
            </form>
          </div>
        )}

        {/* Success */}
        {!isValidatingToken && step === 'success' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:'#f0fdf4', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
              <CheckCircle2 size={36} color="#16a34a"/>
            </div>
            <h2 style={{ fontSize:26, fontWeight:800, color:'#0f172a', marginBottom:10 }}>
              {isActivationMode ? 'Compte activé !' : 'Mot de passe mis à jour !'}
            </h2>
            <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
              {isActivationMode
                ? 'Votre compte est maintenant actif. Vous pouvez vous connecter.'
                : 'Votre nouveau mot de passe a été enregistré avec succès.'}
            </p>
            <button onClick={() => onNavigate('login')} style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              Accéder à la connexion <ArrowRight size={16}/>
            </button>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ width:480, position:'relative', overflow:'hidden', flexShrink:0 }}>
        <RightPanel/>
      </div>
    </div>
  )
}
