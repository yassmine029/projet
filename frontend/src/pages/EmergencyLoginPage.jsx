import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, AlertTriangle, Brain, Zap, Briefcase, CheckCircle2 } from 'lucide-react'
import { emergencyLogin, checkSession, checkEmergencyLimit } from '../api'

const CSS = `
  @keyframes imgZoom { from{transform:scale(1);} to{transform:scale(1.04);} }
  @keyframes spin     { to{transform:rotate(360deg);} }
  @keyframes pulse    { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
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
        src="/images/urgence2.png"
        alt=""
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'cover', objectPosition:'center 80%',
          filter:'blur(2px)', transform:'scale(1.08)',
          animation:'imgZoom 12s ease-in-out infinite alternate',
        }}
      />
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to bottom, rgba(10,5,15,0.15) 0%, rgba(10,5,15,0.45) 40%, rgba(10,5,15,0.88) 70%, rgba(10,5,15,0.98) 100%)',
      }}/>
      <div style={{ position:'relative', zIndex:2, padding:'40px 48px' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:999, padding:'5px 14px', marginBottom:18 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 8px rgba(239,68,68,0.8)', animation:'pulse 1.5s ease infinite' }}/>
          <span style={{ fontSize:10, fontWeight:800, color:'#fca5a5', letterSpacing:'0.12em', textTransform:'uppercase' }}>Mode démo avancé activé</span>
        </div>
        <h3 style={{ fontSize:22, fontWeight:800, color:'#fff', lineHeight:1.25, marginBottom:10, letterSpacing:'-0.01em' }}>
          Découvrez BrainCore<br/>
          <span style={{ color:'#fb923c' }}>avant activation.</span>
        </h3>
        <p style={{ fontSize:13, color:'rgba(203,213,225,0.80)', lineHeight:1.65, marginBottom:22, maxWidth:300 }}>
          Explorez la segmentation et le recalage multimodal. Accès complet disponible sous 24h.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { label:'Sessions', val:'2 disponibles' },
            { label:'Durée',    val:'Illimitée'      },
            { label:'Données',  val:'Démonstration'  },
            { label:'Accès',    val:'Sécurisé'       },
          ].map((s, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:10, padding:'10px 13px', backdropFilter:'blur(10px)' }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#f87171', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EmergencyLoginPage({ onBack, onLogin }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState(2)

  const refreshAttempts = async () => {
    if (!email || !orderNumber) return
    try {
      const res = await checkEmergencyLimit(email, orderNumber)
      if (res.data?.ok) setRemainingAttempts(res.data.remaining ?? null)
    } catch { /* silencieux */ }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setEmailError('Email professionnel requis') }
    if (!orderNumber) { setOrderError("Numéro d'ordre requis") }
    if (!email || !orderNumber) return
    setIsLoading(true); setEmailError(''); setOrderError('')
    try {
      const response = await emergencyLogin(email, orderNumber)
      if (response.data?.ok) {
        if (response.data.remaining !== undefined) setRemainingAttempts(response.data.remaining)
        let merged = null
        try {
          const sess = await checkSession()
          if (sess.data?.logged_in) {
            const raw = sess.data.user
            const u = raw && typeof raw === 'object' ? raw : { username: raw, fullName: raw, is_staff: sess.data.is_staff }
            merged = { ...u, is_emergency_session: Boolean(sess.data.is_emergency_session) }
          }
        } catch (sessErr) { console.error(sessErr) }
        if (!merged) {
          const uname = (response.data.user || email || '').trim()
          merged = { username: uname, fullName: uname.includes('@') ? uname.split('@')[0].replace(/[._]/g, ' ') : uname, is_emergency_session: true }
        }
        localStorage.setItem('user', JSON.stringify(merged))
        const countUsed = (response.data.count ?? 0)
        sessionStorage.setItem('emergency_count', String(countUsed))
        sessionStorage.setItem('emergency_max', '10')
        onLogin?.(merged)
        navigate('/urgence', { replace: true })
      } else {
        setEmailError(response.data?.error || 'Validation d\'urgence échouée.')
        await refreshAttempts()
      }
    } catch (err) {
      const serverError = err?.response?.data?.error
      if (serverError?.toLowerCase().includes('numéro')) setOrderError(serverError)
      else setEmailError(serverError || 'Erreur de communication avec le serveur.')
    } finally { setIsLoading(false) }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"system-ui, -apple-system, sans-serif", background:'#f8fafc' }}>
      <style>{CSS}</style>

      {/* Top urgence bar */}
      <div style={{ position:'fixed', top:0, left:0, width:'100%', height:3, background:'linear-gradient(to right,#dc2626,#b91c1c,#ef4444)', zIndex:50 }}/>

      {/* Left panel */}
      <div style={{ flex:'1', display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 64px', maxWidth:560, margin:'0 auto' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#dc2626,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(220,38,38,0.3)' }}>
            <Brain size={20} color="#fff"/>
          </div>
          <span style={{ fontSize:18, fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>BrainCore</span>
        </div>

        {/* Back */}
        <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:32, transition:'color 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.color='#dc2626'} onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
          <ArrowLeft size={14}/> Retour à la connexion standard
        </button>

        {!sent ? (
          <>
            {/* Badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:999, padding:'5px 12px', marginBottom:18, width:'fit-content' }}>
              <Zap size={11} style={{ fill:'#dc2626', color:'#dc2626' }}/>
              <span style={{ fontSize:10, fontWeight:800, color:'#dc2626', letterSpacing:'0.12em', textTransform:'uppercase' }}>Protocole d'Urgence</span>
            </div>

            <h2 style={{ fontSize:28, fontWeight:800, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.15, marginBottom:10 }}>
              Accès immédiat,<br/>
              <span style={{ color:'#dc2626' }}>Docteur.</span>
            </h2>
            <p style={{ fontSize:13.5, color:'#64748b', lineHeight:1.65, marginBottom:28 }}>
              Accédez à BrainCore immédiatement avec votre email professionnel et votre numéro d'ordre.
              Votre accès complet sera activé après validation par l'administrateur.
            </p>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Email */}
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
                  Email professionnel <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color: emailError ? '#f87171' : '#94a3b8' }}><Mail size={14}/></div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError('') }}
                    style={fld(!!emailError, { paddingLeft:38 })}
                    placeholder="votre.email@hopital.com"
                    autoFocus
                  />
                </div>
                {emailError && (
                  <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    <AlertTriangle size={11}/> {emailError}
                  </p>
                )}
                {remainingAttempts !== null && !emailError && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {[1,2].map(i => (
                        <div key={i} style={{ width:12, height:3, borderRadius:2, background: i <= remainingAttempts ? '#f87171' : '#e2e8f0', transition:'background 0.3s' }}/>
                      ))}
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                      {remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Order number */}
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
                  Numéro d'ordre tunisien <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color: orderError ? '#f87171' : '#94a3b8' }}><Briefcase size={14}/></div>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={e => { setOrderNumber(e.target.value.toUpperCase()); setOrderError('') }}
                    style={fld(!!orderError, { paddingLeft:38 })}
                    placeholder="12345 ou T-12345"
                  />
                </div>
                {orderError && (
                  <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    <AlertTriangle size={11}/> {orderError}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button type="submit" disabled={isLoading || !email || !orderNumber} style={{
                width:'100%', height:48, borderRadius:12, border:'none',
                cursor: (isLoading || !email || !orderNumber) ? 'not-allowed' : 'pointer',
                background: (isLoading || !email || !orderNumber) ? '#94a3b8' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                color:'#fff', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: (isLoading || !email || !orderNumber) ? 'none' : '0 4px 20px rgba(220,38,38,0.32)',
                opacity: (isLoading || !email || !orderNumber) ? 0.65 : 1,
                transition:'all 0.22s ease',
              }}>
                {isLoading
                  ? <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                  : <><Zap size={14} style={{ fill:'#fff' }}/><span>Accéder à la plateforme</span></>
                }
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:'#f0fdf4', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
              <CheckCircle2 size={36} color="#16a34a"/>
            </div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0f172a', marginBottom:10 }}>Accès accordé</h2>
            <p style={{ fontSize:14, color:'#64748b', marginBottom:8 }}>
              Session d'urgence active pour<br/>
              <span style={{ color:'#dc2626', fontWeight:700 }}>{email}</span>
            </p>
            <p style={{ fontSize:12, color:'#94a3b8' }}>Redirection en cours...</p>
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
