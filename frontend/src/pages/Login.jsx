import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle, ArrowRight, Building2, Phone, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react'
import { login, register, adminPortalLogin } from '../api'
import { clearAdminDashboardSession } from '../adminSession'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import EmergencyLoginPage from './EmergencyLoginPage'

const AFFILIATION_OPTIONS = [
  'CHU de Monastir','CHU de Sfax','CHU de Tunis','CHU de Sousse',
  'Hôpital régional','Clinique privée','Université / Faculté de médecine','Autre',
]
const SPECIALTY_OPTIONS = [
  { value: 'neuroradiologie', label: 'Neuroradiologie' },
  { value: 'neurologie', label: 'Neurologie' },
  { value: 'medecine_nucleaire', label: 'Médecine nucléaire' },
  { value: 'autre', label: 'Autre' },
]
const GRADE_OPTIONS = [
  { value: 'interne', label: 'Interne' },
  { value: 'resident', label: 'Résident' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'praticien', label: 'Praticien' },
  { value: 'professeur', label: 'Professeur' },
]
const ORDER_NUMBER_REGEX = /^(?:\d{4,6}|T-\d{4,6})$/
const PHONE_REGEX = /^[24579]\d{7}$/

// ── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes slideInLeft {
    from { opacity:0; transform:translateX(-40px); }
    to   { opacity:1; transform:translateX(0);     }
  }
  @keyframes imgZoom { from{transform:scale(1);} to{transform:scale(1.04);} }
  @keyframes blobA { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-18px,14px) scale(1.06);} }
  @keyframes blobB { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(14px,-18px) scale(1.08);} }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
  @keyframes pulseDot  { 0%,100%{opacity:0.5;transform:scale(1);} 50%{opacity:1;transform:scale(1.3);} }
  @keyframes dotBounce { 0%,70%,100%{opacity:0.25;transform:translateY(0);} 35%{opacity:1;transform:translateY(-4px);} }
  @keyframes progressLoop {
    0%   { transform:scaleX(0);   opacity:1; }
    65%  { transform:scaleX(1);   opacity:1; }
    85%  { transform:scaleX(1);   opacity:0; }
    100% { transform:scaleX(0);   opacity:0; }
  }
  @keyframes shimmer { from{left:-100%;} to{left:220%;} }
  @keyframes spin     { to{transform:rotate(360deg);} }
`

// ── helpers ───────────────────────────────────────────────────────────────
const fld = (err, extra = {}) => ({
  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
  border: `1.5px solid ${err ? '#fca5a5' : '#e2e8f0'}`,
  borderRadius: 10, fontSize: 13.5, color: '#0f172a',
  background: err ? '#fff7f7' : '#f8fafc',
  outline: 'none', transition: 'border-color 0.18s, box-shadow 0.18s',
  ...extra,
})

function FG({ label, required, error, hint, children }) {
  return (
    <div>
      {label && (
        <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:6, letterSpacing:'0.04em' }}>
          {label}{required && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
        </label>
      )}
      {children}
      {error && <p style={{ marginTop:5, fontSize:11, color:'#ef4444', fontWeight:600 }}>{error}</p>}
      {hint && !error && <p style={{ marginTop:5, fontSize:11, color:'#94a3b8' }}>{hint}</p>}
    </div>
  )
}

function FI({ id, icon, type='text', name, value, placeholder, onChange, hasError, readOnly, onFocus, autoComplete }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color: focused ? '#3b82f6' : '#94a3b8', transition:'color 0.18s' }}>
        {icon}
      </div>
      <input
        id={id} type={type} name={name} value={value} placeholder={placeholder}
        onChange={onChange} readOnly={readOnly} autoComplete={autoComplete}
        onFocus={() => { setFocused(true); onFocus?.() }}
        onBlur={() => setFocused(false)}
        style={{ ...fld(hasError, { paddingLeft:38 }), boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.13)' : 'none', borderColor: focused ? '#3b82f6' : hasError ? '#fca5a5' : '#e2e8f0' }}
      />
    </div>
  )
}

function IBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding:5, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', transition:'color 0.15s,background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.color='#3b82f6'; e.currentTarget.style.background='#eff6ff' }}
      onMouseLeave={e => { e.currentTarget.style.color='#94a3b8'; e.currentTarget.style.background='none' }}
    >
      {children}
    </button>
  )
}

function SubmitBtn({ isLoading, disabled, isSignUp }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="submit" disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position:'relative', overflow:'hidden', width:'100%', height:48,
        borderRadius:12, border:'none',
        background: disabled ? '#94a3b8' : hov ? 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
        color:'#fff', fontSize:14, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        boxShadow: disabled ? 'none' : '0 4px 20px rgba(37,99,235,0.32)',
        transition:'all 0.22s ease', opacity: disabled ? 0.65 : 1,
      }}
    >
      {hov && !disabled && (
        <div style={{ position:'absolute', top:0, bottom:0, left:0, width:'40%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)', animation:'shimmer 0.65s ease', pointerEvents:'none' }}/>
      )}
      {isLoading ? (
        <div style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      ) : (
        <>
          <span>{isSignUp ? 'Créer mon compte' : 'Se connecter'}</span>
          <ArrowRight size={16} style={{ transform: hov ? 'translateX(4px)' : 'translateX(0)', transition:'transform 0.2s ease' }}/>
        </>
      )}
    </button>
  )
}

function RightPanel() {

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>

      {/* ── Image de fond ── */}
      <img src="/images/connexion.jpeg"
        alt=""
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'cover', objectPosition:'center center',
          animation:'imgZoom 12s ease-in-out infinite alternate',
        }}
      />

      {/* ── Gradient sombre progressif ── */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to bottom, rgba(6,13,31,0.10) 0%, rgba(6,13,31,0.30) 35%, rgba(6,13,31,0.72) 62%, rgba(6,13,31,0.97) 100%)',
      }}/>

      {/* ── Filet de grille discret ── */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)',
        backgroundSize:'32px 32px',
      }}/>

      {/* ── Blob bleu droit (subtil) ── */}
      <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', filter:'blur(60px)', pointerEvents:'none', background:'radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%)', animation:'blobA 10s ease-in-out infinite' }}/>

      {/* ── Contenu bas ── */}
      <div style={{ position:'relative', zIndex:1, padding:'0 32px 36px' }}>

        {/* Titre */}
        <div style={{ marginBottom:22, animation:'fadeInUp 0.6s ease 0.3s both' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:999, padding:'4px 12px', marginBottom:12 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:'pulseDot 1.6s ease infinite' }}/>
            <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.55)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Espace médical sécurisé</span>
          </div>
          <h3 style={{ fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.2, margin:'0 0 7px' }}>
            Votre tableau de bord<br/>
            <span style={{ color:'#60a5fa' }}>neurologique.</span>
          </h3>
          <p style={{ fontSize:13, color:'rgba(148,163,184,0.80)', lineHeight:1.6, margin:0 }}>
            Connectez-vous pour accéder à vos analyses IRM, recalages multimodaux et rapports patients.
          </p>
        </div>

        {/* Pill statut */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(6,13,31,0.55)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:999, padding:'8px 16px', backdropFilter:'blur(10px)', animation:'fadeInUp 0.5s ease 0.6s both' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px rgba(16,185,129,0.8)', animation:'pulseDot 1.4s ease infinite' }}/>
          <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Serveur opérationnel</span>
        </div>

      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState('login')
  const [isSignUp, setIsSignUp] = useState(false)
  const [resetToken, setResetToken] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [customAffiliation, setCustomAffiliation] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [grade, setGrade] = useState('')
  const [telephone, setTelephone] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [signUpFieldErrors, setSignUpFieldErrors] = useState({})
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [passwordGeneratedNotification, setPasswordGeneratedNotification] = useState(false)
  const [allowSignUpEmailInput, setAllowSignUpEmailInput] = useState(false)
  const [allowSignUpPasswordInput, setAllowSignUpPasswordInput] = useState(false)
  const [allowSignInEmailInput, setAllowSignInEmailInput] = useState(false)
  const [allowSignInPasswordInput, setAllowSignInPasswordInput] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockTimer, setBlockTimer] = useState(0)
  const [errorType, setErrorType] = useState(null)
  const leftColRef = React.useRef(null)

  const focusSignUpField = (field) => {
    const map = { nom:'signup-nom', prenom:'signup-prenom', affiliation:'signup-affiliation', customAffiliation:'signup-custom-affiliation', orderNumber:'signup-order-number', telephone:'signup-telephone', email:'signup-email', password:'signup-password' }
    const el = document.getElementById(map[field])
    if (!el) return
    el.scrollIntoView({ behavior:'smooth', block:'center' })
    el.focus()
    if (typeof el.animate === 'function') el.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{ duration:280, easing:'ease-out' })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token'), mode = params.get('mode'), pathname = window.location.pathname
    if (token || pathname.includes('/reset-password')) { if (token) setResetToken(token); setCurrentPage('reset-password') }
    else if (pathname.includes('/forgot-password')) setCurrentPage('forgot-password')
    else if (pathname.includes('/login') && mode === 'signup') setIsSignUp(true)
  }, [])

  const onEmailChange = (v) => { setUsername(v); setEmailError('') }
  const onPasswordChange = (v) => { setPassword(v); setPasswordError('') }

  useEffect(() => {
    const blockedUntil = localStorage.getItem('login_blocked_until')
    if (blockedUntil) {
      const timeLeft = Math.ceil((parseInt(blockedUntil) - Date.now()) / 1000)
      if (timeLeft > 0) { setIsBlocked(true); setBlockTimer(timeLeft); setLoginAttempts(JSON.parse(localStorage.getItem('login_attempts') || '0')) }
      else { localStorage.removeItem('login_blocked_until'); localStorage.removeItem('login_attempts') }
    } else { const s = localStorage.getItem('login_attempts'); if (s) setLoginAttempts(JSON.parse(s)) }
  }, [])

  useEffect(() => {
    if (!isBlocked || blockTimer <= 0) return
    const iv = setInterval(() => {
      setBlockTimer(prev => {
        if (prev <= 1) { setIsBlocked(false); setLoginAttempts(0); localStorage.removeItem('login_blocked_until'); localStorage.removeItem('login_attempts'); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [isBlocked, blockTimer])

  useEffect(() => {
    setAllowSignUpEmailInput(false); setAllowSignUpPasswordInput(false)
    setAllowSignInEmailInput(false); setAllowSignInPasswordInput(false)
    setSignUpFieldErrors({})
    if (leftColRef.current) leftColRef.current.scrollTop = 0
  }, [isSignUp])

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const generateSecurePassword = () => {
    const u='ABCDEFGHIJKLMNOPQRSTUVWXYZ', l='abcdefghijklmnopqrstuvwxyz', n='0123456789', s='!@#$%^&*', a=u+l+n+s
    let p = u[Math.floor(Math.random()*u.length)] + l[Math.floor(Math.random()*l.length)] + n[Math.floor(Math.random()*n.length)] + s[Math.floor(Math.random()*s.length)]
    for (let i=p.length;i<12;i++) p+=a[Math.floor(Math.random()*a.length)]
    return p.split('').sort(()=>Math.random()-0.5).join('')
  }

  const handleGeneratePassword = () => {
    const p = generateSecurePassword(); setPassword(p); setPasswordError(''); setSignUpFieldErrors(prev=>({...prev,password:''}))
    setPasswordGeneratedNotification(true); setTimeout(()=>setPasswordGeneratedNotification(false),3000)
  }

  const applySignUpServerError = (rawMessage) => {
    const errMsg = String(rawMessage || 'Erreur lors de la création du compte'), low = errMsg.toLowerCase()
    if (low.includes("numéro d'ordre") || low.includes('t-12345') || low.includes('format invalide')) { setSignUpFieldErrors(p=>({...p,orderNumber:errMsg})); focusSignUpField('orderNumber'); return }
    const emailUsed = (low.includes('username') && (low.includes('exist')||low.includes('already'))) || low.includes('un compte avec cet email')
    if (emailUsed) { setEmailError('Email déjà utilisé'); setSignUpFieldErrors(p=>({...p,email:'Email déjà utilisé'})); focusSignUpField('email'); return }
    if (low.includes('password')) { setPasswordError(errMsg); setSignUpFieldErrors(p=>({...p,password:errMsg})); focusSignUpField('password'); return }
    if (low.includes('téléphone')||low.includes('telephone')) { setSignUpFieldErrors(p=>({...p,telephone:errMsg})); focusSignUpField('telephone'); return }
    setError(errMsg)
  }

  const handleSignUp = async (e) => {
    e.preventDefault(); setError(''); setEmailError(''); setPasswordError(''); setSignUpFieldErrors({})
    const normAff = affiliation==='Autre' ? customAffiliation.trim() : affiliation.trim()
    const normOrd = (orderNumber||'').trim().toUpperCase()
    const normTel = (telephone||'').trim().replace(/\s+/g,'')
    const errs = {}; let hasErr = false
    if (!nom.trim()) { errs.nom='Ce champ est obligatoire'; hasErr=true }
    if (!prenom.trim()) { errs.prenom='Ce champ est obligatoire'; hasErr=true }
    if (!normOrd) { errs.orderNumber='Ce champ est obligatoire'; hasErr=true } else if (!ORDER_NUMBER_REGEX.test(normOrd)) { errs.orderNumber='Format invalide'; hasErr=true }
    if (!affiliation.trim()) { errs.affiliation='Ce champ est obligatoire'; hasErr=true } else if (affiliation==='Autre'&&!customAffiliation.trim()) { errs.customAffiliation='Ce champ est obligatoire'; hasErr=true }
    if (normTel&&!PHONE_REGEX.test(normTel)) { errs.telephone='Numéro tunisien invalide.'; hasErr=true }
    if (!username.trim()) { errs.email='Ce champ est obligatoire'; hasErr=true } else if (!validateEmail(username)) { errs.email='Email invalide'; setEmailError('Email invalide'); hasErr=true }
    if (!password.trim()) { errs.password='Ce champ est obligatoire'; hasErr=true } else if (password.length<8) { errs.password='Minimum 8 caractères'; setPasswordError('Minimum 8 caractères'); hasErr=true }
    if (!confirmPassword.trim()) { errs.confirmPassword='Ce champ est obligatoire'; hasErr=true } else if (confirmPassword !== password) { errs.confirmPassword='Les mots de passe ne correspondent pas'; hasErr=true }
    if (!acceptTerms) { errs.terms="Veuillez accepter les conditions d'utilisation."; hasErr=true }
    if (!acceptPrivacy) { errs.privacy='Veuillez accepter la politique de confidentialité.'; hasErr=true }
    setSignUpFieldErrors(errs)
    if (hasErr) { const order=['nom','prenom','orderNumber','telephone','affiliation','customAffiliation','email','password','terms','privacy']; const first=order.find(k=>errs[k]); if(first) focusSignUpField(first); return }
    setIsLoading(true)
    try {
      const r = await register({ username, password, nom, prenom, order_number:normOrd, affiliation:normAff, specialty, grade, telephone:normTel })
      if (r.data?.ok) { setSuccessMessage(r.data.message||'Compte en attente de validation admin'); setIsSignUp(false) }
      else applySignUpServerError((r.data&&r.data.error)?r.data.error:'Erreur lors de la création du compte')
    } catch (err) {
      const msg = err?.response?.data?.error; if(msg) applySignUpServerError(msg); else setError('Serveur indisponible. Vérifiez que le backend Django est démarré sur le port 8000.')
    } finally { setIsLoading(false) }
  }

  const handleSignIn = async (e) => {
    e.preventDefault(); if(isBlocked) return
    setError(''); setEmailError(''); setPasswordError(''); setErrorType(null)
    let hasErr=false
    if (!validateEmail(username)) { setEmailError('Email invalide'); hasErr=true }
    if (!password) { setPasswordError('Requis'); hasErr=true }
    if (hasErr) return
    setIsLoading(true)
    try {
      const r = await login(username, password)
      if (r.data?.ok) {
        clearAdminDashboardSession(); setLoginAttempts(0)
        localStorage.removeItem('login_attempts'); localStorage.removeItem('login_blocked_until')
        setSuccessMessage('Connexion réussie ! Redirection...')
        onLogin(r.data.user)
        navigate('/dashboard', { replace:true })
      } else {
        const et=r.data?.error_type, msg=r.data?.error||'Identifiants invalides'
        if (et==='user_not_found') {
          try { const pr=await adminPortalLogin(username.trim(),password); if(pr.data?.ok){clearAdminDashboardSession();setLoginAttempts(0);localStorage.removeItem('login_attempts');localStorage.removeItem('login_blocked_until');setSuccessMessage('Connexion administrateur…');onLogin(pr.data.user);navigate('/admin',{replace:true});return} } catch {}
          setError('Identifiants invalides')
        } else if (et==='invalid_password') {
          setPasswordError('Identifiants invalides')
          setLoginAttempts(prev=>{ const n=prev+1; localStorage.setItem('login_attempts',n.toString()); if(n>=3){setIsBlocked(true);setBlockTimer(1800);localStorage.setItem('login_blocked_until',(Date.now()+1800000).toString())} return n })
        } else setError(msg)
      }
    } catch (err) {
      const et=err.response?.data?.error_type, msg=err.response?.data?.error||''
      if (et==='user_not_found') {
        try { const pr=await adminPortalLogin(username.trim(),password); if(pr.data?.ok){clearAdminDashboardSession();setLoginAttempts(0);localStorage.removeItem('login_attempts');localStorage.removeItem('login_blocked_until');setSuccessMessage('Connexion administrateur…');onLogin(pr.data.user);navigate('/admin',{replace:true});return} } catch {}
        setError('Identifiants invalides')
      } else if (et==='invalid_password') {
        setPasswordError('Identifiants invalides')
        setLoginAttempts(prev=>{ const n=prev+1; localStorage.setItem('login_attempts',n.toString()); if(n>=3){setIsBlocked(true);setBlockTimer(1800);localStorage.setItem('login_blocked_until',(Date.now()+1800000).toString())} return n })
      } else if (msg) setError(msg)
      else setError('Serveur indisponible. Vérifiez que le backend Django est démarré sur le port 8000.')
    } finally { setIsLoading(false) }
  }

  if (currentPage==='terms')          return <TermsPage onBack={()=>{setCurrentPage('login');setIsSignUp(true)}}/>
  if (currentPage==='privacy')        return <PrivacyPage onBack={()=>{setCurrentPage('login');setIsSignUp(true)}}/>
  if (currentPage==='forgot-password') return <ForgotPasswordPage onNavigate={setCurrentPage}/>
  if (currentPage==='reset-password') return <ResetPasswordPage onNavigate={setCurrentPage} token={resetToken}/>
  if (currentPage==='emergency') return <EmergencyLoginPage onBack={()=>setCurrentPage('login')} onLogin={onLogin}/>

  return (
    <div style={{ height:'100vh', display:'flex', fontFamily:"'Inter',system-ui,sans-serif", background:'#fff', overflow:'hidden' }}>
      <style>{CSS}</style>

      {/* ─── LEFT SIDE ─── */}
      <div ref={leftColRef} style={{
        flex:'0 0 65%', display:'flex', flexDirection:'column',
        justifyContent: isSignUp ? 'flex-start' : 'center',
        padding: isSignUp ? '36px 80px 48px' : '0 80px',
        background:'#fff', overflowY:'auto',
        animation:'slideInLeft 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.45s both',
      }}>
        <div style={{ maxWidth:440, width:'100%', margin:'0 auto' }}>

          {/* Logo + emergency */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isSignUp ? 28 : 44 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                <Brain size={17} color="#fff"/>
              </div>
              <span style={{ fontSize:15, fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' }}>BrainCore</span>
            </div>
            {!isSignUp && (
              <button type="button" onClick={()=>setCurrentPage('emergency')}
                style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', padding:'6px 13px', borderRadius:999, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase', boxShadow:'0 3px 10px rgba(220,38,38,0.3)', transition:'all 0.18s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(220,38,38,0.45)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(220,38,38,0.35)'; }}
              >
                <Zap size={13} style={{ fill:'#fff' }}/> Mode urgence
              </button>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom:26 }}>
            <h2 style={{ fontSize:30, fontWeight:800, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.15, margin:'0 0 10px' }}>
              {isSignUp ? 'Créer un compte,' : 'Bon retour,'}
              <br/><span style={{ color:'#2563eb' }}>Docteur.</span>
            </h2>
            <p style={{ fontSize:13.5, color:'#64748b', lineHeight:1.6, margin:0 }}>
              {isSignUp ? 'Rejoignez la nouvelle génération de praticiens connectés.' : 'Accédez à votre poste de travail clinique sécurisé.'}
            </p>
            {isSignUp && <p style={{ fontSize:11, color:'#ef4444', fontWeight:700, marginTop:7 }}>* Champs obligatoires</p>}
          </div>

          {/* Toggle pill */}
          <div style={{ position:'relative', background:'#f1f5f9', borderRadius:12, padding:4, display:'flex', marginBottom:22 }}>
            <div style={{ position:'absolute', top:4, bottom:4, left:4, width:'calc(50% - 4px)', background:'#fff', borderRadius:9, boxShadow:'0 1px 6px rgba(0,0,0,0.10)', transform: isSignUp ? 'translateX(calc(100% + 0px))' : 'translateX(0)', transition:'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}/>
            {['Connexion','Inscription'].map((lbl,i) => (
              <button key={lbl} onClick={()=>setIsSignUp(i===1)} style={{ flex:1, padding:'10px 0', fontSize:12.5, fontWeight:700, color:(isSignUp?i===1:i===0)?'#0f172a':'#94a3b8', background:'none', border:'none', cursor:'pointer', position:'relative', zIndex:1, transition:'color 0.2s ease', borderRadius:9 }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Messages */}
          {successMessage && (
            <div style={{ marginBottom:18, background:'#ecfdf5', color:'#059669', fontSize:13, padding:'12px 14px', borderRadius:12, border:'1px solid #a7f3d0', display:'flex', alignItems:'flex-start', gap:10 }}>
              <CheckCircle size={16} style={{ flexShrink:0, marginTop:1 }}/><span style={{ fontWeight:600 }}>{successMessage}</span>
            </div>
          )}
          {error && (
            <div style={{ marginBottom:18, background:'#fef2f2', color:'#dc2626', fontSize:13, padding:'12px 14px', borderRadius:12, border:'1px solid #fecaca', display:'flex', alignItems:'flex-start', gap:10 }}>
              <AlertCircle size={16} style={{ flexShrink:0, marginTop:1 }}/><span style={{ fontWeight:600 }}>{error}</span>
            </div>
          )}
          {isBlocked && !isSignUp && (
            <div style={{ marginBottom:18, background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:12, padding:'10px 14px', textAlign:'center' }}>
              <p style={{ fontSize:11, color:'#92400e', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', margin:0 }}>
                Bloqué · Réessayez dans {Math.floor(blockTimer/60)}:{String(blockTimer%60).padStart(2,'0')}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isSignUp?handleSignUp:handleSignIn} autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <input type="text" name="fake_username" autoComplete="username" style={{ display:'none' }} tabIndex={-1} aria-hidden="true"/>
            <input type="password" name="fake_password" autoComplete="new-password" style={{ display:'none' }} tabIndex={-1} aria-hidden="true"/>

            {isSignUp && (<>
              <FG label="Nom" required error={signUpFieldErrors.nom}>
                <FI id="signup-nom" icon={<User size={14}/>} value={nom} placeholder="Votre nom" onChange={e=>{setNom(e.target.value);setSignUpFieldErrors(p=>({...p,nom:''}))}} hasError={!!signUpFieldErrors.nom}/>
              </FG>
              <FG label="Prénom" required error={signUpFieldErrors.prenom}>
                <FI id="signup-prenom" icon={<User size={14}/>} value={prenom} placeholder="Votre prénom" onChange={e=>{setPrenom(e.target.value);setSignUpFieldErrors(p=>({...p,prenom:''}))}} hasError={!!signUpFieldErrors.prenom}/>
              </FG>
              <FG label="Affiliation" required error={signUpFieldErrors.affiliation}>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Building2 size={14}/></div>
                  <select id="signup-affiliation" value={affiliation} onChange={e=>{const v=e.target.value;setAffiliation(v);setSignUpFieldErrors(p=>({...p,affiliation:'',customAffiliation:''}));if(v!=='Autre')setCustomAffiliation('')}} style={fld(!!signUpFieldErrors.affiliation,{paddingLeft:38})}>
                    <option value="">Sélectionner</option>
                    {AFFILIATION_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </FG>
              {affiliation==='Autre' && (
                <FG label="Préciser l'affiliation" required error={signUpFieldErrors.customAffiliation}>
                  <FI id="signup-custom-affiliation" icon={<Building2 size={14}/>} value={customAffiliation} placeholder="Nom de l'établissement" onChange={e=>{setCustomAffiliation(e.target.value);setSignUpFieldErrors(p=>({...p,customAffiliation:''}))}} hasError={!!signUpFieldErrors.customAffiliation}/>
                </FG>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FG label="Spécialité (opt.)">
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Briefcase size={14}/></div>
                    <select value={specialty} onChange={e=>setSpecialty(e.target.value)} style={fld(false,{paddingLeft:38})}>
                      <option value="">Sélectionner</option>
                      {SPECIALTY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </FG>
                <FG label="Grade (opt.)">
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Briefcase size={14}/></div>
                    <select value={grade} onChange={e=>setGrade(e.target.value)} style={fld(false,{paddingLeft:38})}>
                      <option value="">Sélectionner</option>
                      {GRADE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </FG>
              </div>
              <FG label="Numéro d'ordre tunisien" required error={signUpFieldErrors.orderNumber} hint="Format : 4 à 6 chiffres, avec ou sans préfixe T-.">
                <FI id="signup-order-number" icon={<Briefcase size={14}/>} value={orderNumber} placeholder="12345 ou T-12345" onChange={e=>{setOrderNumber(e.target.value.toUpperCase());setSignUpFieldErrors(p=>({...p,orderNumber:''}))}} hasError={!!signUpFieldErrors.orderNumber}/>
              </FG>
              <FG label="Téléphone (optionnel)" error={signUpFieldErrors.telephone} hint="Format tunisien: 8 chiffres.">
                <FI id="signup-telephone" icon={<Phone size={14}/>} value={telephone} placeholder="22345678" onChange={e=>{setTelephone(e.target.value);setSignUpFieldErrors(p=>({...p,telephone:''}))}} hasError={!!signUpFieldErrors.telephone}/>
              </FG>
              <FG label="Email professionnel" required error={signUpFieldErrors.email||emailError}>
                <FI id="signup-email" icon={<Mail size={14}/>} type="email" name="signup_email" value={username} placeholder="votre.email@hopital.com" readOnly={!allowSignUpEmailInput} onFocus={()=>setAllowSignUpEmailInput(true)} autoComplete="off" onChange={e=>setUsername(e.target.value)} hasError={!!(signUpFieldErrors.email||emailError)}/>
              </FG>
              <FG label="Mot de passe" required error={signUpFieldErrors.password||passwordError} hint="Min. 8 caractères · Maj · Chiffres · Symboles">
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Lock size={14}/></div>
                  <input id="signup-password" type={showPassword?'text':'password'} name="signup_password" autoComplete="new-password" value={password}
                    onChange={e=>{ setPassword(e.target.value); setSignUpFieldErrors(p=>({...p,password:''})); setPasswordError(''); if(confirmPassword&&e.target.value!==confirmPassword) setConfirmPasswordError('Les mots de passe ne correspondent pas'); else setConfirmPasswordError(''); }}
                    style={fld(!!(signUpFieldErrors.password||passwordError),{paddingLeft:38,paddingRight:76})} placeholder="••••••••••"/>
                  <div style={{ position:'absolute', right:8, top:0, bottom:0, display:'flex', alignItems:'center', gap:2 }}>
                    <IBtn onClick={handleGeneratePassword}><RefreshCw size={14}/></IBtn>
                    <IBtn onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={14}/>:<Eye size={14}/>}</IBtn>
                  </div>
                </div>
              </FG>
              <FG label="Confirmer le mot de passe" required error={signUpFieldErrors.confirmPassword||confirmPasswordError}>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Lock size={14}/></div>
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword?'text':'password'}
                    name="signup_confirm_password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e=>{ setConfirmPassword(e.target.value); if(e.target.value&&e.target.value!==password) setConfirmPasswordError('Les mots de passe ne correspondent pas'); else setConfirmPasswordError(''); setSignUpFieldErrors(p=>({...p,confirmPassword:''})); }}
                    style={fld(!!(signUpFieldErrors.confirmPassword||confirmPasswordError),{paddingLeft:38,paddingRight:44})}
                    placeholder="••••••••••"
                  />
                  <div style={{ position:'absolute', right:8, top:0, bottom:0, display:'flex', alignItems:'center' }}>
                    <IBtn onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword?<EyeOff size={14}/>:<Eye size={14}/>}</IBtn>
                  </div>
                </div>
              </FG>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[{key:'terms',checked:acceptTerms,set:setAcceptTerms,label:"J'accepte les",link:"conditions d'utilisation",page:'terms'},{key:'privacy',checked:acceptPrivacy,set:setAcceptPrivacy,label:"J'accepte la",link:'politique de confidentialité',page:'privacy'}].map(({key,checked,set,label,link,page})=>(
                  <div key={key}>
                    <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={e=>{set(e.target.checked);setSignUpFieldErrors(p=>({...p,[key]:''}))} } style={{ marginTop:2, accentColor:'#2563eb' }}/>
                      <span style={{ fontSize:12.5, color:'#475569', lineHeight:1.4 }}>
                        {label}{' '}<button type="button" onClick={()=>setCurrentPage(page)} style={{ color:'#2563eb', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, textDecoration:'underline' }}>{link}</button>
                      </span>
                    </label>
                    {signUpFieldErrors[key] && <p style={{ marginTop:4, fontSize:11, color:'#ef4444', fontWeight:600 }}>{signUpFieldErrors[key]}</p>}
                  </div>
                ))}
              </div>
            </>)}

            {!isSignUp && (<>
              <FG label="Email professionnel" required error={emailError}>
                <FI icon={<Mail size={14}/>} type="email" name="signin_email" value={username} placeholder="nom@hopital.com" readOnly={!allowSignInEmailInput} onFocus={()=>setAllowSignInEmailInput(true)} autoComplete="off" onChange={e=>onEmailChange(e.target.value)} hasError={!!emailError}/>
              </FG>
              <FG label="Mot de passe" required error={passwordError}>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:0, bottom:0, display:'flex', alignItems:'center', pointerEvents:'none', color:'#94a3b8' }}><Lock size={14}/></div>
                  <input type={showSignInPassword?'text':'password'} name="signin_password" autoComplete="off" data-lpignore="true" data-form-type="other" readOnly={!allowSignInPasswordInput} onFocus={()=>setAllowSignInPasswordInput(true)} value={password} onChange={e=>onPasswordChange(e.target.value)} style={fld(!!passwordError,{paddingLeft:38,paddingRight:44})} placeholder="••••••••"/>
                  <div style={{ position:'absolute', right:8, top:0, bottom:0, display:'flex', alignItems:'center' }}>
                    <IBtn onClick={()=>setShowSignInPassword(!showSignInPassword)}>{showSignInPassword?<EyeOff size={14}/>:<Eye size={14}/>}</IBtn>
                  </div>
                </div>
              </FG>
              <button type="button" onClick={()=>setCurrentPage('forgot-password')} style={{ alignSelf:'flex-start', fontSize:12, color:'#94a3b8', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, marginTop:-4, transition:'color 0.15s ease' }} onMouseEnter={e=>e.currentTarget.style.color='#2563eb'} onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
                Mot de passe oublié ?
              </button>
            </>)}

            <SubmitBtn isLoading={isLoading} disabled={isLoading||(isBlocked&&!isSignUp)} isSignUp={isSignUp}/>

          </form>

          <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid #f1f5f9', textAlign:'center', fontSize:10, color:'#cbd5e1', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>
            © 2026 BrainCore
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE ─── */}
      <div className="hidden lg:flex" style={{ flex:'0 0 35%', minWidth:0 }}>
        <RightPanel/>
      </div>
    </div>
  )
}
