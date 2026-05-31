import React, { useState, useEffect } from 'react'
import { Mail, ArrowLeft, Shield, Clock, Brain, CheckCircle2, ArrowRight, Lock } from 'lucide-react'
import { forgotPassword } from '../api'

const CSS = `
  @keyframes imgZoom { from{transform:scale(1);} to{transform:scale(1.04);} }
  @keyframes shimmer { from{left:-100%;} to{left:220%;} }
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
              Accès sécurisé<br/>
              <span style={{ color:'#93c5fd' }}>à votre espace clinique.</span>
            </p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.65, maxWidth:320 }}>
              Réinitialisez votre mot de passe en toute sécurité. Un lien unique vous sera envoyé par email.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

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
      if (timeLeft > 0) { setStep('blocked'); setBlockTimeRemaining(timeLeft); setAttempts(6) }
      else { localStorage.removeItem('forgot_password_blocked_until'); localStorage.removeItem('forgot_password_attempts'); setAttempts(0) }
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
        setAttempts(0); setStep('email'); setBlockTimeRemaining(0)
      } else { setBlockTimeRemaining(timeRemaining) }
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
    setIsLoading(true); setEmailError('')
    try {
      const response = await forgotPassword(resetEmail.toLowerCase())
      if (response.data?.ok) { setStep('sent') }
      else { setEmailError(response.data?.error || 'Erreur lors de l\'envoi.'); handleFailure() }
    } catch (error) {
      setEmailError(error.response?.data?.error || 'Erreur. Veuillez réessayer.')
      handleFailure()
    } finally { setIsLoading(false) }
  }

  const handleFailure = () => {
    const n = attempts + 1; setAttempts(n)
    localStorage.setItem('forgot_password_attempts', n.toString())
    if (n > 5) {
      const bu = Date.now() + 5 * 60 * 1000
      localStorage.setItem('forgot_password_blocked_until', bu.toString())
      setBlockTimeRemaining(5 * 60); setStep('blocked')
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const wrapperStyle = {
    display:'flex', minHeight:'100vh', fontFamily:"system-ui, -apple-system, sans-serif",
    background:'#f8fafc',
  }

  const leftStyle = {
    flex:'1', display:'flex', flexDirection:'column', justifyContent:'center',
    padding:'48px 64px', maxWidth:560, margin:'0 auto',
  }

  // ── BLOCKED ──
  if (step === 'blocked') {
    return (
      <div style={wrapperStyle}>
        <style>{CSS}</style>
        <div style={leftStyle}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:48 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Brain size={20} color="#fff"/>
            </div>
            <span style={{ fontSize:18, fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>BrainCore</span>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:'#fef2f2', border:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
              <Clock size={36} color="#dc2626"/>
            </div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0f172a', marginBottom:12 }}>Accès temporairement restreint</h2>
            <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
              Trop de tentatives. Réessayez dans{' '}
              <span style={{ color:'#2563eb', fontWeight:700 }}>{blockTimeRemaining ? formatTime(blockTimeRemaining) : '00:00'}</span>.
            </p>
            <button onClick={() => onNavigate('login')} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', color:'#475569', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              <ArrowLeft size={16}/> Retour à la connexion
            </button>
          </div>
        </div>
        <div style={{ width:480, position:'relative', overflow:'hidden', flexShrink:0 }}>
          <RightPanel/>
        </div>
      </div>
    )
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
          {[1,2].map((num) => {
            const isDone = (num === 1 && step === 'sent')
            const isActive = (num === 1 && step === 'email') || (num === 2 && step === 'sent')
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
                {num < 2 && <div style={{ flex:1, height:3, borderRadius:4, background: isDone ? '#10b981' : '#f1f5f9' }}/>}
              </React.Fragment>
            )
          })}
        </div>

        {step === 'email' && (
          <div>
            <h2 style={{ fontSize:28, fontWeight:800, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.15, marginBottom:10 }}>
              Mot de passe oublié,<br/>
              <span style={{ color:'#2563eb' }}>Docteur.</span>
            </h2>
            <p style={{ fontSize:13.5, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
              Entrez votre email professionnel pour recevoir un lien de réinitialisation unique.
            </p>

            {/* Security notice */}
            <div style={{ display:'flex', alignItems:'center', gap:12, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'12px 16px', marginBottom:28 }}>
              <Shield size={16} color="#0284c7" style={{ flexShrink:0 }}/>
              <span style={{ fontSize:12, color:'#0369a1', fontWeight:600 }}>
                Le lien expire après <strong>15 minutes</strong> — usage unique.
              </span>
            </div>

            <form onSubmit={handleSendResetLink} style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
                  Email professionnel <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}>
                    <Mail size={14}/>
                  </div>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setEmailError('') }}
                    style={fld(!!emailError, { paddingLeft:38 })}
                    placeholder="votre.email@hopital.com"
                    autoComplete="email"
                  />
                </div>
                {emailError && <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600 }}>{emailError}</p>}
              </div>

              <button type="submit" disabled={isLoading} style={{
                position:'relative', overflow:'hidden', width:'100%', height:48,
                borderRadius:12, border:'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color:'#fff', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: isLoading ? 'none' : '0 4px 20px rgba(37,99,235,0.32)',
                transition:'all 0.22s ease', opacity: isLoading ? 0.65 : 1,
              }}>
                {isLoading
                  ? <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                  : <><span>Envoyer le lien</span><ArrowRight size={16}/></>
                }
              </button>
            </form>
          </div>
        )}

        {step === 'sent' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:'#f0fdf4', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
              <CheckCircle2 size={36} color="#16a34a"/>
            </div>
            <h2 style={{ fontSize:26, fontWeight:800, color:'#0f172a', marginBottom:10 }}>Email envoyé !</h2>
            <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
              Un lien sécurisé a été envoyé à<br/>
              <span style={{ color:'#2563eb', fontWeight:700 }}>{resetEmail}</span>
            </p>
            <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:14, padding:20, marginBottom:28, display:'flex', flexDirection:'column', gap:14, textAlign:'left' }}>
              {[
                { icon: Clock, title:'Validité 15 minutes', desc:'Le lien expire pour votre sécurité.' },
                { icon: Shield, title:'Usage unique', desc:'Non réutilisable après validation.' },
                { icon: Mail, title:'Dossier spam', desc:'Vérifiez vos courriers indésirables.' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'#fff', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <item.icon size={14} color="#2563eb"/>
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', marginBottom:2 }}>{item.title}</p>
                    <p style={{ fontSize:12, color:'#94a3b8' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => onNavigate('login')} style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontSize:14, fontWeight:700, marginBottom:12 }}>
              Retour à la connexion
            </button>
            <button onClick={() => setStep('email')} style={{ width:'100%', padding:'10px 0', background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#94a3b8', fontWeight:600 }}>
              Renvoyer l'email
            </button>
          </div>
        )}
      </div>

      {/* Right panel — same image as Login */}
      <div style={{ width:480, position:'relative', overflow:'hidden', flexShrink:0 }}>
        <RightPanel/>
      </div>
    </div>
  )
}
