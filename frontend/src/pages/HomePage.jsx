import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { getApprovedTestimonials, submitTestimonial } from '../api'

// ─────────────────────────────────────────────
// DESIGN TOKENS — Thème bleu médical clair
// ─────────────────────────────────────────────
const C = {
  bg:          '#f8fafc',
  bgAlt:       '#f1f5f9',
  bgCard:      '#ffffff',
  bgHero:      '#ffffff',
  border:      '#e2e8f0',
  borderBlue:  '#bfdbfe',
  text:        '#0f172a',
  textMuted:   '#64748b',
  textDim:     '#94a3b8',
  primary:     '#2563EB',
  primaryDark: '#1d4ed8',
  primaryDim:  'rgba(37,99,235,0.08)',
  primaryGlow: 'rgba(37,99,235,0.15)',
  seg:         '#059669',
  segLight:    '#d1fae5',
  segDim:      'rgba(5,150,105,0.08)',
  rec:         '#7c3aed',
  recLight:    '#ede9fe',
  recDim:      'rgba(124,58,237,0.08)',
}

// ─────────────────────────────────────────────
// VARIANTS
// ─────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const stagger = (d = 0.11) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: d, delayChildren: 0.05 } },
})
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
}
const slideLeft = {
  hidden:  { opacity: 0, x: -36 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65 } },
}
const slideRight = {
  hidden:  { opacity: 0, x: 36 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65 } },
}

// ─────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────
function useTypewriter(text, speed = 52, startDelay = 500) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    let i = 0
    setDisplayed('')
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i += 1
        setDisplayed(text.slice(0, i))
        if (i >= text.length) clearInterval(iv)
      }, speed)
      return () => clearInterval(iv)
    }, startDelay)
    return () => clearTimeout(t)
  }, [text])
  return displayed
}

function useCountUp(target, inView, duration = 1700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    const numeric  = parseFloat(String(target).replace(/[^0-9.]/g, ''))
    const decimals = String(target).includes('.') ? 1 : 0
    const start    = Date.now()
    const tick = () => {
      const p     = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(parseFloat((numeric * eased).toFixed(decimals)))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView])
  return val
}

// ─────────────────────────────────────────────
// NEURAL CANVAS — réseau neuronal actif
// Hub neurons + impulsions + glow + souris
// ─────────────────────────────────────────────
function NeuralCanvas() {
  const ref    = useRef(null)
  const mouse  = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')
    let raf

    // ── structures ───────────────────────────
    const nodes   = []   // neurones
    const pulses  = []   // impulsions en transit
    const MAX_D   = 160  // distance max de connexion
    const N_NODES = 72
    const N_HUBS  = 9    // neurones hub (plus gros)

    // ── redimensionnement ─────────────────────
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    // ── initialisation des neurones ───────────
    const init = () => {
      nodes.length  = 0
      pulses.length = 0
      for (let i = 0; i < N_NODES; i++) {
        const isHub = i < N_HUBS
        const depth = Math.random()            // 0 = loin, 1 = proche
        nodes.push({
          x:      Math.random() * canvas.width,
          y:      Math.random() * canvas.height,
          vx:     (Math.random() - 0.5) * (isHub ? 0.18 : 0.38),
          vy:     (Math.random() - 0.5) * (isHub ? 0.18 : 0.38),
          r:      isHub ? 4 + Math.random() * 2.5 : 1.2 + Math.random() * 1.6,
          depth,
          isHub,
          // firing state
          fireAt:   Math.random() * 3000,      // timestamp prochain firing
          fireGlow: 0,                          // intensité glow (0-1, décroît)
        })
      }
    }

    // ── déclencher une impulsion d'un nœud ───
    const firePulse = (fromIdx) => {
      const src = nodes[fromIdx]
      // cherche 1-3 voisins proches
      const neighbors = []
      for (let j = 0; j < nodes.length; j++) {
        if (j === fromIdx) continue
        const dx = src.x - nodes[j].x
        const dy = src.y - nodes[j].y
        if (Math.sqrt(dx * dx + dy * dy) < MAX_D) neighbors.push(j)
      }
      const targets = neighbors
        .sort(() => Math.random() - 0.5)
        .slice(0, src.isHub ? 3 : 2)
      targets.forEach(toIdx => {
        pulses.push({ fromIdx, toIdx, t: 0, speed: 0.012 + Math.random() * 0.008 })
      })
    }

    // ── boucle principale ─────────────────────
    const draw = (now) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const mx = mouse.current.x
      const my = mouse.current.y

      // ── mise à jour des neurones ────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]

        // attraction souris (faible)
        const mdx = mx - n.x, mdy = my - n.y
        const md  = Math.sqrt(mdx * mdx + mdy * mdy)
        if (md < 200 && md > 0) {
          n.vx += (mdx / md) * 0.012
          n.vy += (mdy / md) * 0.012
        }
        // amortissement + vitesse max
        n.vx *= 0.995
        n.vy *= 0.995
        const maxV = n.isHub ? 0.25 : 0.5
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (speed > maxV) { n.vx = (n.vx / speed) * maxV; n.vy = (n.vy / speed) * maxV }

        n.x += n.vx; n.y += n.vy
        // rebond
        if (n.x < 0)              { n.x = 0;              n.vx *= -1 }
        if (n.x > canvas.width)   { n.x = canvas.width;   n.vx *= -1 }
        if (n.y < 0)              { n.y = 0;               n.vy *= -1 }
        if (n.y > canvas.height)  { n.y = canvas.height;  n.vy *= -1 }

        // firing aléatoire
        n.fireGlow = Math.max(0, n.fireGlow - 0.022)
        if (now >= n.fireAt) {
          n.fireGlow = 1
          firePulse(i)
          // prochain firing dans 1.5–5 s
          n.fireAt = now + 1500 + Math.random() * 3500
        }
      }

      // ── dessin des connexions ───────────────
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b  = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d >= MAX_D) continue

          const fade    = 1 - d / MAX_D
          const hubBoost = (a.isHub || b.isHub) ? 1.8 : 1
          const alpha   = 0.13 * fade * hubBoost * Math.max(a.depth, b.depth)

          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(37,99,235,${alpha})`
          ctx.lineWidth   = (a.isHub || b.isHub) ? 1 : 0.6
          ctx.stroke()
        }
      }

      // ── dessin des impulsions (action potentials) ──
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k]
        p.t += p.speed
        if (p.t >= 1) { pulses.splice(k, 1); continue }

        const src = nodes[p.fromIdx]
        const dst = nodes[p.toIdx]
        const dx  = dst.x - src.x, dy = dst.y - src.y
        const d   = Math.sqrt(dx * dx + dy * dy)
        if (d >= MAX_D) { pulses.splice(k, 1); continue }

        const px = src.x + dx * p.t
        const py = src.y + dy * p.t

        // halo de l'impulsion
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 6)
        grd.addColorStop(0, 'rgba(37,99,235,0.85)')
        grd.addColorStop(0.4, 'rgba(99,140,255,0.4)')
        grd.addColorStop(1, 'rgba(37,99,235,0)')
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // point central de l'impulsion
        ctx.beginPath()
        ctx.arc(px, py, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fill()

        // traînée lumineuse
        const trailLen = 0.12
        const t0 = Math.max(0, p.t - trailLen)
        const tx  = src.x + dx * t0, ty = src.y + dy * t0
        const lg  = ctx.createLinearGradient(tx, ty, px, py)
        lg.addColorStop(0, 'rgba(37,99,235,0)')
        lg.addColorStop(1, 'rgba(37,99,235,0.45)')
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(px, py)
        ctx.strokeStyle = lg
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      // ── dessin des neurones ─────────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const baseAlpha = 0.35 + n.depth * 0.45

        if (n.isHub || n.fireGlow > 0.05) {
          // glow
          const glowR  = n.r + 4 + n.fireGlow * 10
          const glowA  = (n.isHub ? 0.06 : 0) + n.fireGlow * 0.25
          const grd    = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR)
          grd.addColorStop(0, `rgba(37,99,235,${glowA + 0.1})`)
          grd.addColorStop(1, 'rgba(37,99,235,0)')
          ctx.beginPath()
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }

        // nœud principal
        const nodeAlpha = baseAlpha + n.fireGlow * 0.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.isHub
          ? `rgba(37,99,235,${nodeAlpha})`
          : `rgba(59,130,246,${nodeAlpha})`
        ctx.fill()

        // anneau pour les hubs
        if (n.isHub) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(37,99,235,${0.25 + n.fireGlow * 0.5})`
          ctx.lineWidth   = 0.8
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    // ── suivi souris ──────────────────────────
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - rect.left
      mouse.current.y = e.clientY - rect.top
    }
    const onMouseLeave = () => { mouse.current.x = -9999; mouse.current.y = -9999 }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)

    resize(); init()
    raf = requestAnimationFrame(draw)

    const ro = new ResizeObserver(() => { resize(); init() })
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])
  return (
    <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.45 }} />
  )
}

// ─────────────────────────────────────────────
// IRM MOCKUP (viewer médical — fond sombre intentionnel)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// BRAIN SLICE VIEWER — 3 vues + slider
// ─────────────────────────────────────────────

// Visibilité hippocampe : courbe gaussienne centrée sur la coupe optimale
function hippoVis(current, optimal, sigma = 11) {
  return Math.max(0.07, Math.exp(-Math.pow((current - optimal) / sigma, 2)))
}

// Ventricule scale : plus large autour de la coupe médiane
function ventScale(current, max) {
  const t = current / max
  return 0.7 + 0.6 * Math.exp(-Math.pow((t - 0.5) * 3.2, 2))
}

const VIEW_CONFIG = {
  axial:    { label:'Axial',    axis:'z', max:90, hippoOptimal:42, plane:'Plan transverse' },
  coronal:  { label:'Coronal',  axis:'y', max:70, hippoOptimal:35, plane:'Plan frontal'    },
  sagittal: { label:'Sagittal', axis:'x', max:80, hippoOptimal:40, plane:'Plan sagittal'   },
}

// ── Vue axiale (coupe horizontale, vue du dessus) ──
function AxialSlice({ hv, vs }) {
  const vS = vs * 18 // demi-largeur ventricule
  const fa = hv      // alpha hippocampe
  return (
    <svg viewBox="0 0 220 215" style={{ width:'100%', display:'block' }}>
      <defs>
        <radialGradient id="axBg" cx="50%" cy="44%">
          <stop offset="0%" stopColor="#2a2a52"/><stop offset="100%" stopColor="#0d0d24"/>
        </radialGradient>
        <radialGradient id="hcGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(5,150,105,0.6)"/><stop offset="100%" stopColor="rgba(5,150,105,0)"/>
        </radialGradient>
      </defs>
      {/* Crâne */}
      <ellipse cx="110" cy="107" rx="91" ry="95" fill="#070814" stroke="#1c2840" strokeWidth="2"/>
      {/* Parenchyme cérébral */}
      <ellipse cx="110" cy="107" rx="78" ry="80" fill="url(#axBg)"/>
      {/* Scissure interhémisphérique */}
      <line x1="110" y1="28" x2="110" y2="188" stroke="#04040d" strokeWidth="4"/>
      {/* Sulci hémisphère gauche */}
      <path d="M60 76 Q48 62 67 54 Q86 46 95 60"   stroke="#363660" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
      <path d="M44 98 Q34 83 53 73 Q70 63 79 78"   stroke="#363660" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M42 122 Q32 108 51 100 Q69 92 76 107" stroke="#363660" strokeWidth="2"   fill="none" strokeLinecap="round"/>
      <path d="M54 147 Q44 133 63 125 Q81 117 87 131" stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Sulci hémisphère droit */}
      <path d="M160 76 Q172 62 153 54 Q134 46 125 60" stroke="#363660" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
      <path d="M176 98 Q186 83 167 73 Q150 63 141 78" stroke="#363660" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M178 122 Q188 108 169 100 Q151 92 144 107" stroke="#363660" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M166 147 Q176 133 157 125 Q139 117 133 131" stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Ventricules latéraux (taille variable selon coupe) */}
      <path d={`M${110-vS*0.55} 94 Q${110-vS*0.3} 83 110 94 L110 ${94+vS} Q${110-vS*0.3} ${94+vS+11} ${110-vS*0.55} ${94+vS} Z`}
        fill="#040410" stroke="#141428" strokeWidth="0.8"/>
      <path d={`M${110+vS*0.55} 94 Q${110+vS*0.3} 83 110 94 L110 ${94+vS} Q${110+vS*0.3} ${94+vS+11} ${110+vS*0.55} ${94+vS} Z`}
        fill="#040410" stroke="#141428" strokeWidth="0.8"/>
      {/* Hippocampe gauche — glow + contour + pulse */}
      <ellipse cx="76" cy="142" rx="19" ry="9" fill={`rgba(5,150,105,${fa * 0.18})`}/>
      <motion.ellipse cx="76" cy="142" rx="19" ry="9"
        fill={`rgba(5,150,105,${fa * 0.38})`} stroke="#059669" strokeWidth="1.5"
        animate={{ opacity:[fa*0.45, fa*0.95, fa*0.45] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }}
      />
      {/* anneau glow pulsant HC-G */}
      <motion.ellipse cx="76" cy="142" rx="24" ry="13"
        fill="none" stroke="#059669" strokeWidth="0.8"
        animate={{ opacity:[0, fa*0.5, 0] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }}
      />
      {/* Hippocampe droit */}
      <ellipse cx="144" cy="142" rx="19" ry="9" fill={`rgba(5,150,105,${fa * 0.18})`}/>
      <motion.ellipse cx="144" cy="142" rx="19" ry="9"
        fill={`rgba(5,150,105,${fa * 0.38})`} stroke="#059669" strokeWidth="1.5"
        animate={{ opacity:[fa*0.45, fa*0.95, fa*0.45] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut', delay:0.4 }}
      />
      {/* anneau glow pulsant HC-D */}
      <motion.ellipse cx="144" cy="142" rx="24" ry="13"
        fill="none" stroke="#059669" strokeWidth="0.8"
        animate={{ opacity:[0, fa*0.5, 0] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut', delay:0.4 }}
      />
      {/* Labels hippocampe */}
      {fa > 0.3 && <>
        <text x="76"  y="160" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="800" opacity={fa}>HC-G</text>
        <text x="144" y="160" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="800" opacity={fa}>HC-D</text>
      </>}
      {/* Barre d'échelle */}
      <line x1="162" y1="196" x2="202" y2="196" stroke="#2d3f5a" strokeWidth="1.2"/>
      <text x="182" y="207" textAnchor="middle" fontSize="6.5" fill="#2d3f5a">10 mm</text>
    </svg>
  )
}

// ── Vue coronale (coupe frontale) ──
function CoronalSlice({ hv, vs }) {
  const fa  = hv
  const vH  = vs * 22  // hauteur ventricule
  return (
    <svg viewBox="0 0 220 215" style={{ width:'100%', display:'block' }}>
      <defs>
        <radialGradient id="corBg" cx="50%" cy="42%">
          <stop offset="0%" stopColor="#252550"/><stop offset="100%" stopColor="#0c0c22"/>
        </radialGradient>
      </defs>
      {/* Crâne plus arrondi */}
      <ellipse cx="110" cy="102" rx="86" ry="96" fill="#070814" stroke="#1c2840" strokeWidth="2"/>
      {/* Cerveau */}
      <ellipse cx="110" cy="105" rx="74" ry="82" fill="url(#corBg)"/>
      {/* Scissure interhémisphérique */}
      <line x1="110" y1="26" x2="110" y2="100" stroke="#04040d" strokeWidth="3.5"/>
      {/* Scissure de Sylvius (latérale) */}
      <path d="M36 115 Q60 125 75 118 Q88 112 92 125" stroke="#282848" strokeWidth="1.8" fill="none"/>
      <path d="M184 115 Q160 125 145 118 Q132 112 128 125" stroke="#282848" strokeWidth="1.8" fill="none"/>
      {/* Corps calleux (arche) */}
      <path d="M68 68 Q85 52 110 50 Q135 52 152 68" stroke="#4a4a80" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M72 74 Q88 60 110 58 Q132 60 148 74" stroke="#1e1e40" strokeWidth="5" fill="none" strokeLinecap="round"/>
      {/* Gyri frontaux */}
      <path d="M42 78 Q50 66 62 72 Q70 78 65 88"  stroke="#363660" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M178 78 Q170 66 158 72 Q150 78 155 88" stroke="#363660" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M38 98 Q46 86 58 92 Q66 98 60 110"  stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M182 98 Q174 86 162 92 Q154 98 160 110" stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Ventricules latéraux */}
      <path d={`M88 68 Q98 60 110 68 L110 ${68+vH} Q98 ${68+vH+8} 88 ${68+vH} Z`}
        fill="#030310" stroke="#141428" strokeWidth="0.8"/>
      <path d={`M132 68 Q122 60 110 68 L110 ${68+vH} Q122 ${68+vH+8} 132 ${68+vH} Z`}
        fill="#030310" stroke="#141428" strokeWidth="0.8"/>
      {/* Lobe temporal */}
      <path d="M36 128 Q28 142 34 162 Q44 180 66 186 Q88 190 92 175 Q96 160 85 148 Q70 136 36 128Z"
        fill="#1e1e3a" stroke="#2a2a50" strokeWidth="1"/>
      <path d="M184 128 Q192 142 186 162 Q176 180 154 186 Q132 190 128 175 Q124 160 135 148 Q150 136 184 128Z"
        fill="#1e1e3a" stroke="#2a2a50" strokeWidth="1"/>
      {/* Hippocampe gauche (dans le lobe temporal) */}
      <ellipse cx="70" cy="155" rx="20" ry="10" fill={`rgba(5,150,105,${fa*0.16})`}/>
      <motion.ellipse cx="70" cy="155" rx="20" ry="10"
        fill={`rgba(5,150,105,${fa*0.4})`} stroke="#059669" strokeWidth="1.5"
        animate={{ opacity:[fa*0.45,fa*0.95,fa*0.45] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }}
      />
      <motion.ellipse cx="70" cy="155" rx="25" ry="14"
        fill="none" stroke="#059669" strokeWidth="0.8"
        animate={{ opacity:[0, fa*0.45, 0] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }}
      />
      {/* Hippocampe droit */}
      <ellipse cx="150" cy="155" rx="20" ry="10" fill={`rgba(5,150,105,${fa*0.16})`}/>
      <motion.ellipse cx="150" cy="155" rx="20" ry="10"
        fill={`rgba(5,150,105,${fa*0.4})`} stroke="#059669" strokeWidth="1.5"
        animate={{ opacity:[fa*0.45,fa*0.95,fa*0.45] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut', delay:0.35 }}
      />
      <motion.ellipse cx="150" cy="155" rx="25" ry="14"
        fill="none" stroke="#059669" strokeWidth="0.8"
        animate={{ opacity:[0, fa*0.45, 0] }}
        transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut', delay:0.35 }}
      />
      {fa > 0.3 && <>
        <text x="70"  y="173" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="800" opacity={fa}>HC-G</text>
        <text x="150" y="173" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="800" opacity={fa}>HC-D</text>
      </>}
      <line x1="162" y1="200" x2="202" y2="200" stroke="#2d3f5a" strokeWidth="1.2"/>
      <text x="182" y="210" textAnchor="middle" fontSize="6.5" fill="#2d3f5a">10 mm</text>
    </svg>
  )
}

// ── Vue sagittale (coupe latérale) ──
function SagittalSlice({ hv }) {
  const fa = hv
  return (
    <svg viewBox="0 0 220 215" style={{ width:'100%', display:'block' }}>
      <defs>
        <radialGradient id="sagBg" cx="46%" cy="42%">
          <stop offset="0%" stopColor="#242448"/><stop offset="100%" stopColor="#0c0c20"/>
        </radialGradient>
      </defs>
      {/* Crâne ovale allongé */}
      <ellipse cx="108" cy="100" rx="94" ry="90" fill="#070814" stroke="#1c2840" strokeWidth="2"/>
      {/* Parenchyme */}
      <ellipse cx="108" cy="100" rx="82" ry="78" fill="url(#sagBg)"/>
      {/* Corps calleux (forme C) */}
      <path d="M78 88 Q72 68 85 52 Q100 36 118 38 Q138 40 148 56 Q158 72 152 90"
        stroke="#4848a0" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M82 90 Q76 72 88 58 Q102 44 118 46 Q136 48 144 62 Q152 76 148 90"
        stroke="#0c0c1e" strokeWidth="6" fill="none" strokeLinecap="round"/>
      {/* Sillon central */}
      <path d="M96 34 Q88 52 90 72 Q93 88 100 98" stroke="#282848" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* Sillon pariéto-occipital */}
      <path d="M148 50 Q158 70 155 90 Q152 108 142 120" stroke="#282848" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Gyri */}
      <path d="M52 80 Q60 66 74 72 Q80 78 76 90"  stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M46 104 Q55 90 68 96 Q75 103 70 116" stroke="#363660" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <path d="M50 130 Q60 118 73 124 Q80 130 74 143" stroke="#363660" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M104 38 Q116 30 130 36 Q138 42 134 54" stroke="#363660" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M158 96 Q168 84 176 92 Q180 100 172 112" stroke="#363660" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      {/* Cervelet */}
      <path d="M116 158 Q140 178 166 162 Q175 148 162 138 Q148 128 128 133 Z"
        fill="#181832" stroke="#2a2a50" strokeWidth="1.2"/>
      <path d="M124 145 Q140 140 155 148" stroke="#2a2a50" strokeWidth="1.5" fill="none"/>
      <path d="M126 152 Q142 147 157 154" stroke="#2a2a50" strokeWidth="1.2" fill="none"/>
      {/* Tronc cérébral */}
      <path d="M108 158 Q112 175 110 190 Q108 200 106 192 Q104 180 108 158Z"
        fill="#141430" stroke="#242448" strokeWidth="1"/>
      {/* Hippocampe (structure arquée dans le lobe temporal médial) */}
      <path d="M84 128 Q76 112 80 97 Q88 83 100 88 Q110 94 108 108 Q106 120 96 128 Q90 134 84 128 Z"
        fill={`rgba(5,150,105,${fa*0.18})`}/>
      <motion.path
        d="M84 128 Q76 112 80 97 Q88 83 100 88 Q110 94 108 108 Q106 120 96 128 Q90 134 84 128 Z"
        fill={`rgba(5,150,105,${fa*0.38})`} stroke="#059669" strokeWidth="1.4"
        animate={{ opacity:[fa*0.45, fa*0.95, fa*0.45] }}
        transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut' }}
      />
      {/* Amygdale (adjacente à l'hippocampe) */}
      <motion.ellipse cx="98" cy="120" rx="6" ry="5"
        fill={`rgba(5,150,105,${fa*0.3})`} stroke="#059669" strokeWidth="1"
        animate={{ opacity:[fa*0.4, fa*0.85, fa*0.4] }}
        transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut', delay:0.6 }}
      />
      {fa > 0.25 && (
        <text x="80" y="148" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="800" opacity={fa}>
          Hippocampe
        </text>
      )}
      <line x1="162" y1="196" x2="202" y2="196" stroke="#2d3f5a" strokeWidth="1.2"/>
      <text x="182" y="207" textAnchor="middle" fontSize="6.5" fill="#2d3f5a">10 mm</text>
    </svg>
  )
}

// ── Composant principal ──
function BrainSliceViewer() {
  const [view,   setView]   = useState('axial')
  const [slices, setSlices] = useState({ axial:42, coronal:35, sagittal:40 })

  const cfg     = VIEW_CONFIG[view]
  const current = slices[view]
  const hv      = hippoVis(current, cfg.hippoOptimal)
  const vs      = ventScale(current, cfg.max)

  const updateSlice = (v) => setSlices(s => ({ ...s, [view]: v }))

  // métriques dynamiques (varient légèrement selon la coupe)
  const offset = (current - cfg.hippoOptimal) / cfg.max
  const volG   = Math.round(2847 + offset * 40)
  const volD   = Math.round(2891 - offset * 35)
  const asym   = Math.abs(((volG - volD) / ((volG + volD) / 2)) * 100).toFixed(2)
  const conf   = (hv * 30 + 68).toFixed(1)

  return (
    <div style={{
      background:'#060d1a', borderRadius:20, padding:20,
      border:'1px solid #1e3a5f',
      boxShadow:'0 20px 60px rgba(5,150,105,0.1), 0 4px 20px rgba(0,0,0,0.2)',
    }}>
      {/* ── Header : onglets de vue + info coupe ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ display:'flex', gap:5 }}>
          {Object.entries(VIEW_CONFIG).map(([key, v]) => (
            <button key={key} onClick={() => setView(key)}
              style={{
                fontSize:10, fontWeight:700, padding:'4px 11px', borderRadius:6, cursor:'pointer',
                background: view===key ? C.seg : 'transparent',
                color:      view===key ? '#fff'  : '#94a3b8',
                border:     `1px solid ${view===key ? C.seg : '#1e3a5f'}`,
                transition: 'all 0.18s ease',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ textAlign:'right' }}>
          <span style={{ fontSize:9, color:'#059669', fontFamily:'monospace', display:'block', lineHeight:1.3 }}>
            ● SEG ACTIVE
          </span>
          <span style={{ fontSize:8, color:'#4b6080', fontFamily:'monospace' }}>
            {cfg.axis.toUpperCase()} = {String(current).padStart(2,'0')} / {cfg.max}
          </span>
        </div>
      </div>

      {/* ── Visualisation SVG ── */}
      <div style={{ position:'relative', background:'#040810', borderRadius:12, overflow:'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity:0, scale:0.97 }}
            animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:1.02 }}
            transition={{ duration:0.22 }}
          >
            {view === 'axial'    && <AxialSlice    hv={hv} vs={vs}/>}
            {view === 'coronal'  && <CoronalSlice  hv={hv} vs={vs}/>}
            {view === 'sagittal' && <SagittalSlice hv={hv}/>}
          </motion.div>
        </AnimatePresence>

        {/* label plan anatomique */}
        <div style={{
          position:'absolute', bottom:8, left:10,
          background:'rgba(0,0,0,0.6)', padding:'2px 8px',
          borderRadius:5, fontSize:9, color:'#4b6080', fontFamily:'monospace',
        }}>
          {cfg.plane}
        </div>

        {/* indicateur hippocampe visible */}
        {hv > 0.35 && (
          <motion.div
            initial={{ opacity:0, y:-4 }}
            animate={{ opacity:1, y:0 }}
            style={{
              position:'absolute', top:8, left:10,
              background:'rgba(5,150,105,0.15)', padding:'3px 8px',
              borderRadius:5, fontSize:9, color:'#059669', fontFamily:'monospace',
              border:'1px solid rgba(5,150,105,0.3)',
              display:'flex', alignItems:'center', gap:5,
            }}
          >
            <motion.span
              animate={{ opacity:[1,0.3,1] }}
              transition={{ duration:1.4, repeat:Infinity }}
              style={{ width:6, height:6, borderRadius:'50%', background:'#059669', display:'inline-block' }}
            />
            Hippocampe détecté
          </motion.div>
        )}
      </div>

      {/* ── Slider de coupe ── */}
      <div style={{ marginTop:14, padding:'0 2px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:9, color:'#4b6080', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            Navigation coupe
          </span>
          <span style={{ fontSize:9, color:'#94a3b8', fontFamily:'monospace' }}>
            {current} / {cfg.max}
          </span>
        </div>
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:8 }}>
          {/* bouton précédent */}
          <button
            onClick={() => updateSlice(Math.max(1, current - 1))}
            style={{ width:22, height:22, borderRadius:6, border:'1px solid #1e3a5f', background:'#0d1424', color:'#94a3b8', cursor:'pointer', fontSize:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}
          >‹</button>

          {/* slider */}
          <div style={{ flex:1, position:'relative' }}>
            {/* piste colorée */}
            <div style={{
              position:'absolute', top:'50%', left:0, transform:'translateY(-50%)',
              height:3, width:`${((current-1)/(cfg.max-1))*100}%`,
              background:`linear-gradient(to right, #059669, ${C.seg})`,
              borderRadius:2, pointerEvents:'none', zIndex:1,
            }}/>
            <input type="range"
              min={1} max={cfg.max} value={current} step={1}
              onChange={e => updateSlice(+e.target.value)}
              className="brain-slider"
              style={{ width:'100%', position:'relative', zIndex:2 }}
            />
          </div>

          {/* bouton suivant */}
          <button
            onClick={() => updateSlice(Math.min(cfg.max, current + 1))}
            style={{ width:22, height:22, borderRadius:6, border:'1px solid #1e3a5f', background:'#0d1424', color:'#94a3b8', cursor:'pointer', fontSize:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}
          >›</button>
        </div>

        {/* indicateur zone hippocampique */}
        <div style={{ marginTop:7, display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ flex:1, height:2, background:'#0d1424', borderRadius:2, overflow:'hidden' }}>
            <div style={{
              height:'100%',
              marginLeft:`${((cfg.hippoOptimal - 12)/cfg.max)*100}%`,
              width:`${(24/cfg.max)*100}%`,
              background:'rgba(5,150,105,0.5)',
              borderRadius:2,
            }}/>
          </div>
          <span style={{ fontSize:8, color:'rgba(5,150,105,0.7)', whiteSpace:'nowrap', fontFamily:'monospace' }}>
            Zone HC
          </span>
        </div>
      </div>

      {/* ── Métriques ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginTop:14 }}>
        {[
          ['Vol. HC-G', `${volG.toLocaleString()} mm³`],
          ['Vol. HC-D', `${volD.toLocaleString()} mm³`],
          ['Asymétrie', `${asym} %`],
          ['Confiance', `${conf} %`],
        ].map(([l,v],i) => (
          <div key={i} style={{ background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.18)', borderRadius:8, padding:'6px 10px' }}>
            <div style={{ fontSize:9, color:'#94a3b8' }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#059669', fontFamily:'monospace' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// REGISTRATION MOCKUP (viewer médical — fond sombre intentionnel)
// ─────────────────────────────────────────────
function RegistrationMockup() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <div ref={ref} style={{
      background: '#060d1a', borderRadius: 20, padding: 20,
      border: `1px solid #1e3a5f`,
      boxShadow: `0 20px 60px rgba(124,58,237,0.12), 0 4px 20px rgba(0,0,0,0.15)`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: C.rec, fontWeight: 700 }}>IRM T1</span>
        <span style={{ fontSize: 10, color: '#4b6080' }}>Recalage déformable</span>
        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>TEP-FDG</span>
      </div>
      <svg viewBox="0 0 220 200" style={{ width: '100%', display: 'block' }}>
        <defs>
          <radialGradient id="petG" cx="50%" cy="48%">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.7"/>
            <stop offset="40%"  stopColor="#f59e0b" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#92400e" stopOpacity="0.05"/>
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="100" rx="89" ry="86" fill="#080818" stroke="#1e2a44" strokeWidth="1.5"/>
        <ellipse cx="110" cy="95"  rx="48" ry="40" fill="url(#petG)" opacity="0.75"/>
        <ellipse cx="78"  cy="112" rx="24" ry="18" fill="rgba(245,158,11,0.35)" opacity="0.8"/>
        <ellipse cx="142" cy="112" rx="24" ry="18" fill="rgba(245,158,11,0.35)" opacity="0.8"/>
        <ellipse cx="110" cy="135" rx="18" ry="14" fill="rgba(239,68,68,0.28)"  opacity="0.8"/>
        {[0,1,2,3,4,5,6,7].map(i => {
          const y = 20 + i * 24, d = Math.sin(i * 0.75) * 9
          return (
            <motion.path key={`h${i}`}
              d={`M22 ${y} Q66 ${y+d} 110 ${y+d*0.5} Q154 ${y-d} 198 ${y}`}
              stroke="rgba(124,58,237,0.4)" strokeWidth="0.75" fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 1.4, delay: i * 0.09 }}
            />
          )
        })}
        {[0,1,2,3,4,5,6,7].map(i => {
          const x = 22 + i * 25, d = Math.cos(i * 0.65) * 7
          return (
            <motion.path key={`v${i}`}
              d={`M${x} 20 Q${x+d} 70 ${x+d*0.5} 100 Q${x-d} 150 ${x} 196`}
              stroke="rgba(124,58,237,0.4)" strokeWidth="0.75" fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 1.4, delay: 0.75 + i * 0.07 }}
            />
          )
        })}
        {[[55,60],[110,50],[165,60],[40,100],[110,100],[180,100],[55,140],[110,145],[165,140]].map(([x,y],i) => (
          <motion.circle key={i} cx={x} cy={y} r={3.2} fill={C.rec}
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: [0, 1.6, 1], opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 1.6 + i * 0.07 }}
          />
        ))}
        <text x="110" y="194" textAnchor="middle" fontSize="7.5" fill="#4b6080">NMI: 0.847 · SSIM: 0.923 · TRE: 1.8mm</text>
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 14 }}>
        {[['Erreur TRE','1.8 mm'],['Itérations','847'],['Score MI','94.7 %']].map(([l,v],i) => (
          <div key={i} style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.rec, fontFamily: 'monospace' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────
function Section({ id, children, bg, style }) {
  return (
    <section id={id} style={{ background: bg ?? C.bg, padding: '96px 0', ...style }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {children}
      </div>
    </section>
  )
}

function Badge({ color, bg, children }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 800,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '5px 14px', borderRadius: 999,
      background: bg ?? `${color}14`,
      color, border: `1px solid ${color}35`,
      marginBottom: 18,
    }}>{children}</span>
  )
}

function IconBox({ color, bg, children, size = 44, radius = 10 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg ?? `${color}14`, border: `1px solid ${color}30`,
      color, fontSize: size * 0.44,
    }}>{children}</div>
  )
}

// ─────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────
function Navbar({ user, onNavigate, onLogout }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [scrolled,    setScrolled]    = useState(false)

  // Nom affiché du médecin
  const doctorName = React.useMemo(() => {
    if (!user) return ''
    const full = String(user.fullName || user.full_name || '').trim()
    if (full && !full.includes('@')) return full
    const first = String(user.first_name || user.prenom || '').trim()
    const last  = String(user.last_name  || user.nom   || '').trim()
    const merged = `${first} ${last}`.trim()
    if (merged) return merged
    const u = String(user.username || '').trim()
    return u.includes('@') ? '' : u
  }, [user])

  // Ombre au scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navLinks = [
    { label: 'Segmentation',    id: 'segmentation' },
    { label: 'Recalage',        id: 'recalage'     },
    { label: 'Pipeline',        id: 'pipeline'     },
    { label: 'Fonctionnalités', id: 'features'     },
    { label: 'Qui sommes-nous', id: 'about'        },
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 3px 10px rgba(37,99,235,0.22)`,
            }}>
              <SVGBrain size={15} color="#fff"/>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
              BrainCore
            </span>
          </div>

          {/* Liens desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="hidden lg:flex">
            {navLinks.map((l) => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: C.textMuted, padding: '5px 10px',
                  borderRadius: 7, transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.background = C.primaryDim }}
                onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'none' }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Zone droite : user ou login */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                {/* Info médecin */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 10, borderRight: `1px solid ${C.border}` }} className="hidden xl:flex">
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                    Dr. {doctorName || user.username}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85 }}>
                    {user.is_emergency_session ? 'Session urgence' : (user.speciality || user.specialty || 'Neurologie')}
                  </span>
                </div>

                {/* Bouton dashboard ou urgence */}
                {user.is_emergency_session ? (
                  <button
                    onClick={() => scrollTo('segmentation')}
                    style={{
                      padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#d97706', color: '#fff', fontWeight: 700, fontSize: 11,
                      boxShadow: '0 2px 8px rgba(217,119,6,0.22)',
                    }}
                  >
                    Outils démo
                  </button>
                ) : (
                  <motion.button
                    onClick={() => onNavigate('dashboard')}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                      color: '#fff', fontWeight: 700, fontSize: 11,
                      boxShadow: `0 2px 10px rgba(37,99,235,0.25)`,
                    }}
                  >
                    Votre Dashboard
                  </motion.button>
                )}

                {/* Bouton déconnexion */}
                <button
                  onClick={onLogout}
                  title="Déconnexion"
                  style={{
                    width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
                    background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.textMuted, transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.background = '#fef2f2' }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'none' }}
                >
                  <SVGLogout size={12}/>
                </button>
              </>
            ) : (
              <motion.button
                onClick={() => onNavigate('login')}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  color: '#fff', fontWeight: 700, fontSize: 12,
                  boxShadow: `0 3px 12px rgba(37,99,235,0.22)`,
                }}
              >
                Connexion
              </motion.button>
            )}

            {/* Burger mobile */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="lg:hidden"
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}
            >
              {menuOpen ? <SVGX size={18}/> : <SVGMenu size={18}/>}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ borderTop: `1px solid ${C.border}`, background: '#fff', padding: '12px 24px 16px' }}
          >
            {navLinks.map((l) => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, color: C.text,
                  padding: '10px 0', borderBottom: `1px solid ${C.border}`,
                }}
              >
                {l.label}
              </button>
            ))}
          </motion.div>
        )}
      </nav>
    </>
  )
}

// ─────────────────────────────────────────────
// ICÔNES NAVBAR
// ─────────────────────────────────────────────
function SVGLogout({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function SVGMenu({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
function SVGX({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>
  )
}

// données des slides
const SLIDES = [
  {
    img:      '/images/hero1.png.jpeg',
    tag:      'Analyse automatisée par IA',
    subtitle: 'Segmentation automatique de l\'hippocampe par Deep Learning',
  },
  {
    img:      '/images/hero2.png.jpeg',
    tag:      'Quantification anatomique',
    subtitle: 'Extraction automatique et visualisation des régions hippocampiques segmentées',
  },
  {
    img:      '/images/hero3.png.jpeg',
    tag:      'Recalage multimodal',
    subtitle: 'Recalage multimodal pour une correspondance anatomique précise',
  },
  {
    img:      '/images/hero4.png.jpeg',
    tag:      'Workflow clinique intelligent',
    subtitle: 'De l\'acquisition des images à l\'analyse assistée par IA',
  },
]

function HeroSection({ onNavigate }) {
  const [current,  setCurrent]  = useState(0)
  const [progress, setProgress] = useState(0)
  const DURATION = 5000 // ms par slide

  // auto-avance + barre de progression
  useEffect(() => {
    setProgress(0)
    const startTime = Date.now()
    let raf

    const tick = () => {
      const elapsed = Date.now() - startTime
      const pct     = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(pct)
      if (pct < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        setCurrent(c => (c + 1) % SLIDES.length)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current])

  const goTo = (i) => { setCurrent(i) }

  const slide = SLIDES[current]

  // cartes feature fixes
  const featureCards = [
    { icon: <SVGBrain size={22} color="#fff"/>, title: 'Segmentation Hippocampe 2D', desc: 'Détection et délimitation automatiques de l\'hippocampe avec précision.', color: C.seg },
    { icon: <SVGMerge size={22}/>,              title: 'Recalage Multimodal',         desc: 'Alignement précis des modalités d\'imagerie pour une meilleure interprétation clinique.', color: C.rec },
  ]

  return (
    <section style={{ position:'relative', height:'100vh', minHeight:600, overflow:'hidden' }}>

      {/* ── Slides en arrière-plan ── */}
      {SLIDES.map((s, i) => (
        <div key={i} style={{
          position:'absolute', inset:0,
          opacity: i === current ? 1 : 0,
          transition: 'opacity 1s ease',
          zIndex: i === current ? 1 : 0,
        }}>
          {/* image avec Ken Burns */}
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:    `url(${s.img})`,
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            animation: i === current ? 'kenBurns 8s ease-out forwards' : 'none',
          }}/>
          {/* double overlay : sombre en bas + bleu en haut */}
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(160deg, rgba(5,15,50,0.45) 0%, rgba(5,20,60,0.32) 40%, rgba(0,5,25,0.55) 100%)',
          }}/>
        </div>
      ))}

      {/* ── Particules neurologiques (subtiles) ── */}
      <div style={{ position:'absolute', inset:0, zIndex:2, pointerEvents:'none' }}>
        <NeuralCanvas />
      </div>

      {/* ── Contenu centré ── */}
      <div style={{
        position:'relative', zIndex:10,
        height:'100%', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'100px 24px 80px', textAlign:'center',
      }}>

        {/* tag slide */}
        <AnimatePresence mode="wait">
          <motion.span key={`tag-${current}`}
            initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:12 }}
            transition={{ duration:0.4 }}
            style={{
              display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.14em',
              textTransform:'uppercase', padding:'5px 18px', borderRadius:999,
              background:'rgba(255,255,255,0.14)', color:'rgba(255,255,255,0.9)',
              border:'1px solid rgba(255,255,255,0.25)', marginBottom:24,
              backdropFilter:'blur(8px)',
            }}
          >
            {slide.tag}
          </motion.span>
        </AnimatePresence>

        {/* titre principal (fixe) */}
        <h1 style={{
          fontFamily:"'Playfair Display', Georgia, serif",
          fontSize:'clamp(1.6rem, 3.5vw, 2.8rem)',
          fontWeight:800, lineHeight:1.2,
          color:'#fff', marginBottom:10, maxWidth:780,
          textShadow:'0 2px 20px rgba(0,0,0,0.4)',
        }}>
          Neuro-imagerie par Intelligence Artificielle
        </h1>

        {/* description fixe — blanc pur, légèrement plus lumineux */}
        <p style={{
          fontSize:'clamp(0.85rem, 1.4vw, 0.98rem)',
          color:'rgba(255,255,255,0.92)', lineHeight:1.65,
          maxWidth:560, marginBottom:10,
          fontWeight: 500,
        }}>
          Segmentation de l'hippocampe et fusion multimodale des images médicales
          au sein d'une plateforme unique d'aide au diagnostic.
        </p>

        {/* sous-titre animé */}
        <AnimatePresence mode="wait">
          <motion.p key={`sub-${current}`}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
            transition={{ duration:0.45 }}
            style={{
              fontSize:'clamp(0.95rem, 1.8vw, 1.15rem)',
              color:'rgba(180,210,255,0.75)', lineHeight:1.7,
              maxWidth:580, marginBottom:48,
              fontStyle:'italic',
            }}
          >
            {slide.subtitle}
          </motion.p>
        </AnimatePresence>

        {/* cartes feature glassmorphism */}
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', justifyContent:'center', marginBottom:44 }}>
          {featureCards.map((fc, i) => (
            <motion.div key={i}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.3 + i*0.15, duration:0.5 }}
              whileHover={{ y:-4, boxShadow:`0 16px 40px rgba(0,0,0,0.3)` }}
              style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'16px 22px', borderRadius:16,
                background:'rgba(255,255,255,0.11)',
                border:'1px solid rgba(255,255,255,0.2)',
                backdropFilter:'blur(14px)',
                WebkitBackdropFilter:'blur(14px)',
                cursor:'default', minWidth:260, textAlign:'left',
                boxShadow:'0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background:`${fc.color}30`, border:`1px solid ${fc.color}50`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: fc.color,
              }}>
                {fc.icon}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:3 }}>{fc.title}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', lineHeight:1.5 }}>{fc.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* boutons CTA */}
        <div style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
          <motion.button
            onClick={() => onNavigate?.('/segmentation/nouvelle')}
            whileHover={{ scale:1.04, boxShadow:'0 8px 32px rgba(37,99,235,0.45)' }}
            whileTap={{ scale:0.97 }}
            style={{
              padding:'14px 32px', borderRadius:12, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              color:'#fff', fontWeight:800, fontSize:15,
              display:'flex', alignItems:'center', gap:8,
              boxShadow:'0 4px 20px rgba(37,99,235,0.4)',
            }}
          >
            <SVGBrain size={18} color="#fff"/> Explorer la Segmentation
          </motion.button>

          <motion.button
            onClick={() => onNavigate?.('/registration')}
            whileHover={{ scale:1.04, boxShadow:'0 8px 28px rgba(255,255,255,0.15)' }}
            whileTap={{ scale:0.97 }}
            style={{
              padding:'14px 32px', borderRadius:12, cursor:'pointer',
              background:'rgba(255,255,255,0.12)',
              color:'#fff', fontWeight:700, fontSize:15,
              border:'1.5px solid rgba(255,255,255,0.35)',
              display:'flex', alignItems:'center', gap:8,
              backdropFilter:'blur(8px)',
            }}
          >
            <SVGMerge size={18}/> Voir le Recalage
          </motion.button>

          <motion.button
            onClick={() => onNavigate?.('/segmentation/nouvelle')}
            whileHover={{ scale:1.04, boxShadow:'0 8px 28px rgba(255,255,255,0.1)' }}
            whileTap={{ scale:0.97 }}
            style={{
              padding:'14px 32px', borderRadius:12, cursor:'pointer',
              background:'rgba(255,255,255,0.08)',
              color:'rgba(255,255,255,0.85)', fontWeight:700, fontSize:15,
              border:'1.5px solid rgba(255,255,255,0.22)',
              display:'flex', alignItems:'center', gap:8,
              backdropFilter:'blur(8px)',
            }}
          >
            ▶ Lancer la démo 3D
          </motion.button>
        </div>
      </div>

      {/* ── Indicateurs + barre de progression ── */}
      <div style={{
        position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)',
        zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:14,
      }}>
        {/* dots */}
        <div style={{ display:'flex', gap:8 }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              style={{
                width: i === current ? 28 : 8,
                height:8, borderRadius:4, border:'none', cursor:'pointer',
                background: i === current ? '#fff' : 'rgba(255,255,255,0.35)',
                transition:'all 0.35s ease', padding:0,
              }}
            />
          ))}
        </div>

        {/* barre de progression */}
        <div style={{ width:200, height:2, background:'rgba(255,255,255,0.2)', borderRadius:2, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:2,
            width:`${progress}%`,
            background:`linear-gradient(to right, ${C.primary}, ${C.seg})`,
            transition:'width 0.1s linear',
          }}/>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// HIPPOCAMPUS VISUAL — image + bleu médical + animations
// ─────────────────────────────────────────────
function HippocampusVisual() {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(145deg, #0a1628, #0d1f3c)',
      borderRadius: 20,
      padding: 16,
      border: `1px solid ${C.borderBlue}`,
      boxShadow: `0 24px 60px ${C.primaryGlow}, 0 4px 20px rgba(0,0,0,0.15)`,
      overflow: 'hidden',
      maxWidth: 500,
      margin: '0 auto',
    }}>

      {/* halo bleu médical en fond */}
      <div style={{
        position: 'absolute', top: '30%', left: '20%',
        width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${C.primaryGlow} 0%, transparent 70%)`,
        filter: 'blur(30px)', pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative' }}>
        <img
          src="/images/hero_brain.png"
          alt="Segmentation hippocampe"
          style={{
            width: '100%',
            display: 'block',
            margin: '0 auto',
            filter: 'saturate(1.15) brightness(0.97)',
            borderRadius: 10,
          }}
        />

        {/* badge flottant "Hippocampe détecté" */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: `${C.primaryDim}`,
            border: `1px solid ${C.borderBlue}`,
            backdropFilter: 'blur(10px)',
            borderRadius: 10, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary, display: 'inline-block', boxShadow: `0 0 6px ${C.primary}` }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>Hippocampe détecté</span>
        </motion.div>

        {/* ligne de scan animée */}
        <motion.div
          animate={{ top: ['15%', '78%', '15%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: `linear-gradient(to right, transparent, ${C.primary}90, transparent)`,
            pointerEvents: 'none',
          }}
        />
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────
// AXE 1 — SEGMENTATION
// ─────────────────────────────────────────────
function SegmentationSection({ onNavigate, user }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-80px' })

  return (
    <Section id="segmentation" bg={C.bgAlt}>
      <div ref={ref} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
        <motion.div variants={stagger(0.12)} initial="hidden" animate={inView?'visible':'hidden'}>
          <motion.div variants={fadeUp}><Badge color={C.primary}>Axe Clinique 01</Badge></motion.div>
          <motion.h2 variants={fadeUp} style={{
            fontFamily:"'Playfair Display', Georgia, serif",
            fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:700,
            color:C.text, lineHeight:1.2, marginBottom:20,
          }}>
            Segmentation Automatique<br/>
            <span style={{ color:C.primary }}>de l'Hippocampe</span>
          </motion.h2>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.75, marginBottom:8, fontSize:15 }}>
            Une solution intelligente pour l'analyse automatisée de l'hippocampe sur IRM.
          </motion.p>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.75, marginBottom:32, fontSize:15 }}>
            Bénéficiez de la puissance de plusieurs modèles de Deep Learning pour obtenir des segmentations précises, des mesures volumétriques instantanées et des rapports cliniques personnalisés.
          </motion.p>
          <motion.ul variants={stagger(0.09)} initial="hidden" animate={inView?'visible':'hidden'}
            style={{ listStyle:'none', padding:0, margin:'0 0 36px', display:'flex', flexDirection:'column', gap:12 }}
          >
            {[
              'Trois modèles de Deep Learning adaptés à différents besoins',
              'Segmentation fiable et mesures volumétriques précises',
              'Reconstruction et visualisation 3D de l\'hippocampe',
              'Rapports patients personnalisables et exportables',
            ].map((f,i) => (
              <motion.li key={i} variants={fadeUp}
                style={{ display:'flex', alignItems:'center', gap:12, fontSize:14, color:C.text, fontWeight:500 }}
              >
                <span style={{
                  width:28, height:28, borderRadius:8, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:C.primaryDim, color:C.primary, fontWeight:900, fontSize:14,
                }}>✓</span>
                {f}
              </motion.li>
            ))}
          </motion.ul>
          <div>
            <motion.button variants={fadeUp}
              onClick={() => user ? onNavigate?.('/segmentation/nouvelle') : null}
              whileHover={user ? { scale:1.03, boxShadow:`0 8px 28px rgba(37,99,235,0.3)` } : {}}
              whileTap={user ? { scale:0.97 } : {}}
              style={{
                padding:'13px 26px', borderRadius:11, border:'none',
                cursor: user ? 'pointer' : 'not-allowed',
                background: user ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : '#cbd5e1',
                color:'#fff', fontWeight:800, fontSize:14,
                display:'inline-flex', alignItems:'center', gap:8,
                boxShadow: user ? `0 4px 14px rgba(37,99,235,0.25)` : 'none',
                opacity: user ? 1 : 0.7,
              }}
            >
              <SVGBrain size={17}/> Lancer une analyse
            </motion.button>
            {!user && (
              <p style={{ marginTop:8, fontSize:12, color:C.textMuted, display:'flex', alignItems:'center', gap:5 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Un compte médecin est requis pour accéder à cette fonctionnalité.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div variants={slideRight} initial="hidden" animate={inView?'visible':'hidden'}>
          <HippocampusVisual/>
        </motion.div>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────
// RECALAGE VISUAL — axe2_brain.png + violet + animations
// ─────────────────────────────────────────────
function RecalageVisual() {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(145deg, #0f0a1e, #1a0d35)',
      borderRadius: 20,
      padding: 16,
      border: `1px solid rgba(124,58,237,0.35)`,
      boxShadow: `0 24px 60px rgba(124,58,237,0.15), 0 4px 20px rgba(0,0,0,0.2)`,
      overflow: 'hidden',
      maxWidth: 500,
      margin: '0 auto',
    }}>

      {/* halo violet en fond */}
      <div style={{
        position: 'absolute', top: '20%', left: '15%',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)',
        filter: 'blur(35px)', pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative' }}>
        {/* image multimodale */}
        <img
          src="/images/axe2_brain.png"
          alt="Recalage multimodal"
          style={{
            width: '100%',
            display: 'block',
            borderRadius: 10,
            mixBlendMode: 'luminosity',
            filter: 'saturate(1.6) brightness(0.85) contrast(1.1)',
          }}
        />

        {/* badge flottant "Fusion multimodale" */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(124,58,237,0.18)',
            border: '1px solid rgba(124,58,237,0.45)',
            backdropFilter: 'blur(10px)',
            borderRadius: 10, padding: '5px 11px',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: C.rec, display: 'inline-block', boxShadow: `0 0 7px ${C.rec}` }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.rec }}>Fusion multimodale</span>
        </motion.div>


        {/* ligne de scan violette */}
        <motion.div
          animate={{ top: ['10%', '85%', '10%'] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: `linear-gradient(to right, transparent, ${C.rec}90, transparent)`,
            pointerEvents: 'none',
          }}
        />
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────
// AXE 2 — RECALAGE
// ─────────────────────────────────────────────
function RecalageSection({ onNavigate, user }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-80px' })
  const pipeline = ['IRM T1', 'Normalisation', 'Recalage rigide', 'Recalage déformable', 'Image fusionnée']

  return (
    <Section id="recalage" bg={C.bgAlt} style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
      <div ref={ref} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
        <motion.div variants={slideLeft} initial="hidden" animate={inView?'visible':'hidden'}>
          <RecalageVisual/>
        </motion.div>

        <motion.div variants={stagger(0.12)} initial="hidden" animate={inView?'visible':'hidden'}>
          <motion.div variants={fadeUp}><Badge color={C.rec}>Axe Clinique 02</Badge></motion.div>
          <motion.h2 variants={fadeUp} style={{
            fontFamily:"'Playfair Display', Georgia, serif",
            fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:700,
            color:C.text, lineHeight:1.2, marginBottom:20,
          }}>
            Recalage Multimodal<br/>
            <span style={{ color:C.rec }}>2D et 3D</span>
          </motion.h2>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.75, marginBottom:8, fontSize:15 }}>
            Fusion intelligente des modalités d'imagerie cérébrale pour une analyse plus complète et plus fiable.
          </motion.p>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.75, marginBottom:28, fontSize:15 }}>
            Notre plateforme propose plusieurs modes de recalage adaptés aux besoins cliniques, permettant d'aligner précisément les examens multimodaux et de faciliter l'interprétation des données anatomiques et fonctionnelles.
          </motion.p>

          <motion.ul variants={stagger(0.09)} initial="hidden" animate={inView?'visible':'hidden'}
            style={{ listStyle:'none', padding:0, margin:'0 0 36px', display:'flex', flexDirection:'column', gap:12 }}
          >
            {[
              'Trois modes de recalage pour une flexibilité maximale',
              'Recalage 2D et 3D avec fusion précise des images médicales',
              'Identification automatique des régions corticales d\'intérêt',
              'Analyse de l\'activité cérébrale et comparaison à des références standards',
            ].map((f, i) => (
              <motion.li key={i} variants={fadeUp}
                style={{ display:'flex', alignItems:'center', gap:12, fontSize:14, color:C.text, fontWeight:500 }}
              >
                <span style={{
                  width:28, height:28, borderRadius:8, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:`rgba(124,58,237,0.12)`, color:C.rec, fontWeight:900, fontSize:14,
                }}>✓</span>
                {f}
              </motion.li>
            ))}
          </motion.ul>

          <div>
          <motion.button variants={fadeUp}
            onClick={() => user ? onNavigate?.('/registration') : null}
            whileHover={user ? { scale:1.03, boxShadow:`0 8px 28px rgba(124,58,237,0.22)` } : {}}
            whileTap={user ? { scale:0.97 } : {}}
            style={{
              padding:'13px 26px', borderRadius:11,
              cursor: user ? 'pointer' : 'not-allowed',
              background:'#fff', fontWeight:800, fontSize:14,
              border: user ? `1.5px solid ${C.rec}` : '1.5px solid #cbd5e1',
              color: user ? C.rec : '#94a3b8',
              display:'inline-flex', alignItems:'center', gap:8,
              boxShadow: user ? `0 2px 10px rgba(124,58,237,0.1)` : 'none',
              opacity: user ? 1 : 0.7,
            }}
          >
            <SVGMerge size={17}/> Lancer un recalage
          </motion.button>
          {!user && (
            <p style={{ marginTop:8, fontSize:12, color:C.textMuted, display:'flex', alignItems:'center', gap:5 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Un compte médecin est requis pour accéder à cette fonctionnalité.
            </p>
          )}
          </div>
        </motion.div>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────
// PIPELINE TECHNIQUE
// ─────────────────────────────────────────────
function PipelineSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const steps = [
    {
      num: '01', label: 'Médecin', sub: 'Clinicien · Neurologue',
      featured: false, iconColor: '#64748b', circleBg: '#f8fafc',
      circleBorder: C.border, glow: 'none',
      shadow: '0 4px 16px rgba(0,0,0,0.08)',
      icon: (
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      num: '02', label: 'Import IRM', sub: 'NIfTI · JPG · TIF',
      featured: false, iconColor: C.primary, circleBg: C.primaryDim,
      circleBorder: C.borderBlue, glow: 'none',
      shadow: '0 4px 18px rgba(37,99,235,0.12)',
      icon: (
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <polyline points="9 14 12 11 15 14"/>
        </svg>
      ),
    },
    {
      num: '03', label: 'Traitement IA', sub: '',
      featured: true, iconColor: '#fff', circleBg: C.primary,
      circleBorder: C.primaryDark,
      shadow: `0 8px 36px rgba(37,99,235,0.38), 0 0 0 8px ${C.primaryDim}`,
      icon: (
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1 0-4.95 2.5 2.5 0 0 1 3.46-3.05A2.5 2.5 0 0 1 9.5 2"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 0-4.95 2.5 2.5 0 0 0-3.46-3.05A2.5 2.5 0 0 0 14.5 2"/>
        </svg>
      ),
    },
    {
      num: '04', label: 'Validation', sub: 'Export · Rapport PDF',
      featured: false, iconColor: '#059669', circleBg: '#f0fdf4',
      circleBorder: '#a7f3d0', glow: 'none',
      shadow: '0 4px 16px rgba(5,150,105,0.13)',
      icon: (
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      ),
    },
  ]

  return (
    <section id="pipeline" style={{ background: C.bgAlt, padding: '96px 0', position: 'relative', overflow: 'hidden' }}>

      {/* ── Arrière-plan médical flou ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/images/association.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        filter: 'blur(3px)',
        transform: 'scale(1.05)',
        opacity: 0.55,
        zIndex: 0,
      }}/>
      {/* overlay léger pour garder le texte lisible */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(241,245,249,0.50)',
        zIndex: 1,
      }}/>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
      <div ref={ref}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <Badge color={C.primary}>Pipeline Technique</Badge>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.7rem, 3vw, 2.4rem)', fontWeight: 700,
            color: C.text, marginTop: 12, marginBottom: 10,
          }}>
            De l'image au diagnostic
          </h2>
          <p style={{ color: C.textMuted, fontSize: 15, maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            Un outil d'aide au diagnostic rapide, où le médecin reste au cœur du processus et conserve la décision finale.
          </p>
        </motion.div>

        {/* ── Steps row ── */}
        <div style={{ position: 'relative' }}>

          {/* Animated dashed connector: step-1-center → step-4-center */}
          <div style={{
            position: 'absolute',
            top: 69,              /* num (15px) + gap (12px) + half-circle (42px) */
            left: '12.5%', right: '12.5%',
            height: 3, overflow: 'visible',
            pointerEvents: 'none',
          }}>
            {/* dashes draw left→right */}
            <motion.div
              initial={{ width: '0%' }}
              animate={inView ? { width: '100%' } : {}}
              transition={{ duration: 1.7, delay: 0.4, ease: 'easeOut' }}
              style={{
                height: '100%', borderRadius: 2,
                backgroundImage: `repeating-linear-gradient(to right, ${C.primary} 0, ${C.primary} 10px, transparent 10px, transparent 24px)`,
                opacity: 0.55,
              }}
            />
            {/* travelling glow dot */}
            <motion.div
              initial={{ left: '-1%', opacity: 0 }}
              animate={inView
                ? { left: ['-1%', '101%'], opacity: [0, 1, 1, 0] }
                : {}}
              transition={{
                duration: 2.2, delay: 2.3, ease: 'easeInOut',
                repeat: Infinity, repeatDelay: 2.5,
              }}
              style={{
                position: 'absolute', top: '50%',
                transform: 'translateY(-50%)',
                width: 12, height: 12, borderRadius: '50%',
                background: C.primary,
                boxShadow: `0 0 18px 4px ${C.primary}80`,
              }}
            />
          </div>

          {/* Step cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', textAlign: 'center', padding: '0 6px',
                }}
              >
                {/* step number */}
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
                  fontFamily: 'monospace', marginBottom: 12,
                  color: step.featured ? C.primary : C.textDim,
                }}>
                  {step.num}
                </span>

                {/* icon circle */}
                <div style={{ position: 'relative', marginBottom: 22 }}>
                  {/* double pulsing rings for featured */}
                  {step.featured && (<>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.05, 0.6] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', inset: -12, borderRadius: '50%',
                        border: `2px solid ${C.primary}70`, pointerEvents: 'none',
                      }}
                    />
                    <motion.div
                      animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      style={{
                        position: 'absolute', inset: -24, borderRadius: '50%',
                        border: `1.5px solid ${C.primary}35`, pointerEvents: 'none',
                      }}
                    />
                  </>)}

                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      width: step.featured ? 90 : 76,
                      height: step.featured ? 90 : 76,
                      borderRadius: '50%',
                      background: step.circleBg,
                      border: `2.5px solid ${step.circleBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: step.iconColor,
                      boxShadow: step.shadow,
                      cursor: 'default',
                    }}
                  >
                    {step.icon}
                  </motion.div>
                </div>

                {/* label */}
                <h3 style={{
                  fontSize: step.featured ? 16 : 14,
                  fontWeight: step.featured ? 800 : 700,
                  color: step.featured ? C.primary : C.text,
                  margin: '0 0 7px',
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  {step.label}
                </h3>

                {/* sublabel */}
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
                  {step.sub}
                </p>

                {/* IA badge on featured */}
                {step.featured && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.35, delay: 1.1 }}
                    style={{
                      marginTop: 10, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: 999,
                      background: C.primaryDim, color: C.primary,
                      border: `1px solid ${C.borderBlue}`,
                    }}
                  >
                    IA · Core
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Bottom stats ── */}

      </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// CLINIC SECTION — Exigences non fonctionnelles
// ─────────────────────────────────────────────
function ClinicCard({ card, index, inView }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 48 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        height: 420,
        cursor: 'default',
        boxShadow: hovered
          ? '0 32px 72px rgba(0,0,0,0.28)'
          : '0 8px 32px rgba(0,0,0,0.13)',
        transform: hovered ? 'translateY(-8px) scale(1.01)' : 'translateY(0) scale(1)',
        transition: 'box-shadow 0.35s ease, transform 0.35s ease',
      }}
    >
      {/* ── Image de fond floue — zoom au hover ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${card.img})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(3px)',
        transform: hovered ? 'scale(1.09)' : 'scale(1.04)',
        transition: 'transform 0.6s ease',
      }}/>

      {/* ── Léger voile blanc sur l'image (haut de la carte) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(255,255,255,0.18)',
      }}/>

      {/* ── Barre accent top qui se dessine ── */}
      <motion.div
        initial={{ width: '0%' }}
        animate={inView ? { width: '100%' } : {}}
        transition={{ duration: 0.9, delay: 0.35 + index * 0.16, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: 0, left: 0,
          height: 4, background: card.accentColor, zIndex: 3,
        }}
      />

      {/* ── Panneau givré blanc en bas : contient tout le texte ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid rgba(255,255,255,0.6)`,
        padding: '24px 28px 26px',
      }}>
        {/* Icône + titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <motion.div
            animate={hovered ? { scale: 1.14, rotate: -5 } : { scale: 1, rotate: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              width: 42, height: 42, borderRadius: 11, flexShrink: 0,
              background: `${card.accentColor}14`,
              border: `1.5px solid ${card.accentColor}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.accentColor,
            }}
          >
            {card.icon}
          </motion.div>

          <h3 style={{
            fontSize: 18, fontWeight: 800, color: C.text, margin: 0,
            fontFamily: "'Playfair Display', Georgia, serif",
            lineHeight: 1.2, letterSpacing: '-0.01em',
          }}>
            {card.title}
          </h3>
        </div>

        {/* Sous-titre */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: card.accentColor,
          margin: '0 0 10px',
        }}>
          {card.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize: 13, color: C.textMuted,
          lineHeight: 1.68, margin: '0 0 16px',
        }}>
          {card.desc}
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {card.tags.map((tag, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: 0.65 + index * 0.16 + i * 0.09 }}
              style={{
                fontSize: 11, fontWeight: 700,
                padding: '4px 12px', borderRadius: 999,
                background: `${card.accentColor}12`,
                color: card.accentColor,
                border: `1px solid ${card.accentColor}35`,
                letterSpacing: '0.05em',
              }}
            >
              {tag}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ClinicSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const cards = [
    {
      icon: <SVGZap/>,
      accentColor: '#3b82f6',
      accentLight: '#93c5fd',
      title: 'Performance · Précision',
      subtitle: 'Résultats rapides et fiables',
      desc: "Traitement optimisé pour fournir des segmentations hippocampiques et des recalages multimodaux précis tout en réduisant le temps d'attente.",
      tags: ['< 5 min', 'Haute précision'],
      img: '/images/precision.jpeg',
    },
    {
      icon: <SVGShield/>,
      accentColor: '#7c3aed',
      accentLight: '#c4b5fd',
      title: 'Sécurité · Confidentialité',
      subtitle: 'Protection des données médicales',
      desc: "Authentification sécurisée, gestion des rôles et protection des données patients conformément aux bonnes pratiques de sécurité.",
      tags: ["Contrôle d'accès"],
      img: '/images/securit%C3%A9.jpeg',
    },
    {
      icon: <SVGLayout/>,
      accentColor: '#059669',
      accentLight: '#6ee7b7',
      title: 'Expérience Clinique',
      subtitle: 'Conçue pour les professionnels de santé',
      desc: "Interface intuitive facilitant l'analyse, la visualisation et l'interprétation des résultats sans expertise technique particulière.",
      tags: ['Interface ergonomique', 'Disponibilité continue'],
      img: '/images/experience.jpeg',
    },
  ]

  return (
    <Section id="features" bg={C.bgAlt} style={{ borderTop: `1px solid ${C.border}` }}>
      <div ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <Badge color={C.primary}>Nos engagements</Badge>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.7rem, 3vw, 2.3rem)', fontWeight: 700,
            color: C.text, marginTop: 12,
          }}>
            Conçu pour la clinique
          </h2>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {cards.map((card, i) => (
            <ClinicCard key={i} card={card} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────
// QUI SOMMES-NOUS
// ─────────────────────────────────────────────
function Brain3DTeaser({ onNavigate }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-80px' })

  return (
    <Section id="about" bg="#fff">
      <div ref={ref} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:36, alignItems:'center' }}>
        <motion.div variants={stagger(0.12)} initial="hidden" animate={inView?'visible':'hidden'}
          style={{ maxWidth:440 }}
        >
          <motion.div variants={fadeUp}><Badge color={C.primary}>Qui sommes-nous</Badge></motion.div>
          <motion.h2 variants={fadeUp} style={{
            fontFamily:"'Playfair Display', Georgia, serif",
            fontSize:'clamp(1.5rem,2.5vw,2.1rem)', fontWeight:700,
            color:C.text, lineHeight:1.2, marginBottom:16,
          }}>
            BrainCore,<br/>
            <span style={{ color:C.primary }}>votre allié clinique</span>
          </motion.h2>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.8, fontSize:14.5, marginBottom:0 }}>
            BrainCore est une plateforme intelligente dédiée à l'analyse avancée des images cérébrales médicales.
            Elle intègre des techniques de Deep Learning pour automatiser la segmentation de l'hippocampe et le recalage multimodal,
            afin de fournir des résultats rapides, précis et exploitables en contexte clinique.
          </motion.p>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.8, fontSize:14.5, marginTop:12, marginBottom:0 }}>
            Conçue pour accompagner les professionnels de santé, BrainCore facilite l'interprétation des données IRM,
            la visualisation 3D et la génération de rapports personnalisés, tout en simplifiant des processus complexes et chronophages.
          </motion.p>
          <motion.p variants={fadeUp} style={{ color:C.textMuted, lineHeight:1.8, fontSize:14.5, marginTop:12 }}>
            Notre objectif est de transformer l'imagerie cérébrale en un outil d'aide à la décision fiable, intuitif et accessible.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity:0, x:40 }}
          animate={inView ? { opacity:1, x:0 } : {}}
          transition={{ duration:0.7, ease:'easeOut', delay:0.2 }}
          style={{ display:'flex', justifyContent:'center', alignItems:'center' }}
        >
          <motion.div
            animate={{ y:[0, -8, 0] }}
            transition={{ duration:5, repeat:Infinity, ease:'easeInOut' }}
            style={{
              position:'relative', borderRadius:20, overflow:'hidden',
              boxShadow:`0 24px 60px ${C.primaryGlow}, 0 4px 20px rgba(0,0,0,0.08)`,
              border:`1px solid ${C.borderBlue}`,
              maxWidth:480, width:'100%',
            }}
          >
            <img
              src="/images/qui sommes nous.jpeg"
              alt="Professionnel de santé utilisant BrainCore"
              style={{ width:'100%', display:'block', objectFit:'cover', borderRadius:20 }}
            />
          </motion.div>
        </motion.div>
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────
function FooterSection({ onNavigate }) {
  return (
    <footer style={{ background:'#0f172a', borderTop:`1px solid #1e293b`, padding:'48px 0 32px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:24, marginBottom:36 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:38, height:38, borderRadius:10,
              background:`linear-gradient(135deg, ${C.primary}, #1d4ed8)`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <SVGBrain size={20} color="#fff"/>
            </div>
            <div>
              <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:18, color:'#f1f5f9' }}>BrainCore</div>
              <div style={{ fontSize:10, color:'#475569' }}>Imagerie cérébrale médicale</div>
            </div>
          </div>

          <nav style={{ display:'flex', gap:28, flexWrap:'wrap' }}>
            {[
              { label:'Segmentation', target:'/segmentation/nouvelle' },
              { label:'Recalage',     target:'/registration'          },
              { label:'Connexion',    target:'login'                  },
            ].map((l,i) => (
              <button key={i} onClick={() => onNavigate?.(l.target)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#94a3b8', fontWeight:500, padding:0 }}
                onMouseEnter={e => e.target.style.color='#bfdbfe'}
                onMouseLeave={e => e.target.style.color='#94a3b8'}
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ borderTop:'1px solid #1e293b', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>

          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <span style={{ fontSize:12, color:'#475569' }}>Plateforme médicale d'aide au diagnostic</span>
            <a href="mailto:yassmineayed421@gmail.com" style={{
              fontSize:12, color:'#3b82f6', textDecoration:'none', fontWeight:600,
              display:'flex', alignItems:'center', gap:5,
            }}>
              ✉ Nous contacter
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────
// ICÔNES SVG (aucun emoji)
// ─────────────────────────────────────────────
function SVGBrain({ size=20, color='currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1 0-4.95 2.5 2.5 0 0 1 3.46-3.05A2.5 2.5 0 0 1 9.5 2"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 0-4.95 2.5 2.5 0 0 0-3.46-3.05A2.5 2.5 0 0 0 14.5 2"/>
    </svg>
  )
}
function SVGMerge({ size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
      <path d="M6 21V9a9 9 0 0 0 9 9"/>
    </svg>
  )
}
function SVGMicroscope() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18h8"/><path d="M3 21h18"/><path d="M14 21v-4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4"/>
      <path d="M14 7v2"/><path d="M10 7V5l-2-2V2h6v1l-2 2v2"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  )
}
function SVGZap() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}
function SVGCheck() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function SVGExport() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}
function SVGShield() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function SVGLayout() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  )
}
function SVGServer() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  )
}

// ─────────────────────────────────────────────
// CSS GLOBAL
// ─────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes kenBurns { from { transform: scale(1) translateY(0); } to { transform: scale(1.08) translateY(-10px); } }

  /* Slider IRM custom */
  .brain-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 3px;
    background: #1e3a5f;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .brain-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #059669;
    border: 2px solid #060d1a;
    box-shadow: 0 0 8px rgba(5,150,105,0.6);
    cursor: grab;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .brain-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.25);
    box-shadow: 0 0 14px rgba(5,150,105,0.8);
  }
  .brain-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #059669;
    border: 2px solid #060d1a;
    box-shadow: 0 0 8px rgba(5,150,105,0.6);
    cursor: grab;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; }
  }
`

// ─────────────────────────────────────────────
// TÉMOIGNAGES
// ─────────────────────────────────────────────
function TestimonialsSection({ user }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const [testimonials, setTestimonials]   = useState([])
  const [formOpen,     setFormOpen]       = useState(false)
  const [formData,     setFormData]       = useState({ author: '', specialty: '', content: '', rating: 5 })
  const [submitting,   setSubmitting]     = useState(false)
  const [submitStatus, setSubmitStatus]   = useState(null) // 'ok' | 'error'

  useEffect(() => {
    getApprovedTestimonials()
      .then(r => setTestimonials(r.data?.results || r.data || []))
      .catch(() => setTestimonials([]))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.content.trim() || !formData.author.trim() || !formData.specialty.trim()) return
    setSubmitting(true)
    try {
      // Le backend attend : name, role, text
      await submitTestimonial({
        name:    formData.author,
        role:    formData.specialty,
        text:    formData.content,
        rating:  formData.rating,
      })
      setSubmitStatus('ok')
      setFormData({ author: '', specialty: '', content: '', rating: 5 })
      setFormOpen(false)
    } catch {
      setSubmitStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  const inp = (err = false) => ({
    width: '100%', padding: '10px 13px', boxSizing: 'border-box',
    border: `1.5px solid ${err ? '#fca5a5' : C.border}`,
    borderRadius: 9, fontSize: 13, color: C.text,
    background: '#f8fafc', outline: 'none',
    transition: 'border-color 0.18s',
    fontFamily: 'inherit',
  })

  return (
    <Section id="testimonials" bg="#fff" style={{ borderTop: `1px solid ${C.border}` }}>
      <div ref={ref}>

        {/* ── Header avec image ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center', marginBottom: 56 }}
        >
          {/* Texte gauche */}
          <div>
            <Badge color={C.primary}>Témoignages</Badge>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.6rem,2.8vw,2.2rem)', fontWeight: 700, color: C.text, lineHeight: 1.2, marginTop: 12, marginBottom: 16 }}>
              Ce que disent<br/>
              <span style={{ color: C.primary }}>nos médecins</span>
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14.5, lineHeight: 1.8, maxWidth: 380 }}>
              Des professionnels de santé partagent leur expérience avec BrainCore au quotidien dans leur pratique clinique.
            </p>

            {/* Bouton donner avis */}
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setFormOpen(o => !o); setSubmitStatus(null) }}
              style={{
                marginTop: 24, padding: '11px 22px', borderRadius: 11, cursor: 'pointer',
                background: formOpen ? C.bgAlt : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: formOpen ? C.text : '#fff', fontWeight: 700, fontSize: 13,
                border: formOpen ? `1.5px solid ${C.border}` : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: formOpen ? 'none' : `0 4px 14px rgba(37,99,235,0.25)`,
                transition: 'all 0.2s',
              }}
            >
              {formOpen ? '✕ Annuler' : '✦ Donner mon avis'}
            </motion.button>
          </div>

          {/* Image droite */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: `0 20px 50px ${C.primaryGlow}`, border: `1px solid ${C.borderBlue}` }}
          >
            <img src="/images/temoignage.jpeg" alt="Témoignages médecins"
              style={{ width: '100%', display: 'block', objectFit: 'cover', borderRadius: 18 }}/>
            {/* Badge flottant */}
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.92)', border: `1px solid ${C.borderBlue}`, backdropFilter: 'blur(10px)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary, display: 'inline-block' }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>Avis vérifiés</span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ── Formulaire soumission ── */}
        <AnimatePresence>
          {formOpen && (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              style={{ overflow: 'hidden', marginBottom: 48 }}
            >
              <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 32px', maxWidth: 640 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>Partagez votre expérience</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Nom complet *</label>
                      <input style={inp()} placeholder="Dr. Prénom Nom" value={formData.author}
                        onChange={e => setFormData(p => ({ ...p, author: e.target.value }))} required/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Spécialité *</label>
                      <input style={inp()} placeholder="Neurologie, Neuroradiologie…" value={formData.specialty} required
                        onChange={e => setFormData(p => ({ ...p, specialty: e.target.value }))}/>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Note *</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} type="button" onClick={() => setFormData(p => ({ ...p, rating: s }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: s <= formData.rating ? '#f59e0b' : '#e2e8f0', transition: 'color 0.15s', padding: '2px 3px' }}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Votre témoignage *</label>
                    <textarea style={{ ...inp(), minHeight: 100, resize: 'vertical' }}
                      placeholder="Partagez votre expérience avec BrainCore dans votre pratique clinique…"
                      value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))} required/>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button type="submit" disabled={submitting}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', fontWeight: 700, fontSize: 13, opacity: submitting ? 0.6 : 1 }}>
                      {submitting ? 'Envoi…' : 'Soumettre mon avis'}
                    </button>
                    <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                      Votre témoignage sera visible après validation par notre équipe.
                    </p>
                  </div>
                  {submitStatus === 'error' && <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Une erreur est survenue. Veuillez réessayer.</p>}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message succès */}
        <AnimatePresence>
          {submitStatus === 'ok' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 500 }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>Témoignage soumis avec succès</p>
                <p style={{ fontSize: 12, color: '#4ade80' }}>Il sera visible après validation par notre équipe. Merci !</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grille témoignages ── */}
        {testimonials.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {testimonials.map((t, i) => (
              <motion.div key={t.id || i}
                initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {/* Étoiles */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: 14, color: s <= (t.rating || 5) ? '#f59e0b' : '#e2e8f0' }}>★</span>
                  ))}
                </div>
                {/* Contenu */}
                <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.75, flex: 1, fontStyle: 'italic' }}>
                  "{t.content || t.message}"
                </p>
                {/* Auteur */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.primaryDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.primary, flexShrink: 0 }}>
                    {(t.author || t.nom || 'D').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 1 }}>{t.author || t.nom || 'Dr.'}</p>
                    {(t.specialty || t.specialite) && <p style={{ fontSize: 11, color: C.textDim }}>{t.specialty || t.specialite}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Placeholder si pas encore de témoignages */
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim }}>
            <p style={{ fontSize: 14 }}>Soyez le premier à partager votre expérience avec BrainCore.</p>
          </div>
        )}
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────
// Routes protégées — accessibles uniquement aux utilisateurs connectés
const PROTECTED_ROUTES = ['/segmentation/nouvelle', '/registration', '/segmentation']

export default function HomePage({ user, onNavigate, onLogout }) {
  return (
    <div style={{ background:C.bg, color:C.text, fontFamily:"'Noto Sans', system-ui, sans-serif", overflowX:'hidden' }}>
      <style>{GLOBAL_CSS}</style>
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <HeroSection  onNavigate={onNavigate} user={user} />
      <SegmentationSection onNavigate={onNavigate} user={user} />
      <RecalageSection     onNavigate={onNavigate} user={user} />
      <PipelineSection />
      <ClinicSection />
      <Brain3DTeaser       onNavigate={onNavigate} />
      <TestimonialsSection user={user} />
      <FooterSection       onNavigate={onNavigate} />
    </div>
  )
}
