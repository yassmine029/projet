// frontend/src/components/ImagePointSelector.jsx
import { useEffect, useRef, useState } from 'react'

/**
 * ImagePointSelector :
 * - sliders séparés pour chaque méthode (debounced -> appelle /api/preprocess)
 * - zoom (molette) + pan (cliquer-glisser) pour chaque canevas
 * - conserve la sélection alternée CT -> Patient
 * - utilise sessionStorage.jobId (défini par Upload.jsx)
 */

export default function ImagePointSelector({ ctSrc, patSrc, onPointsChange }) {
  const ctCanvas = useRef(null)
  const patCanvas = useRef(null)

  // points (coord image 0..512)
  const [ctPts, setCtPts] = useState([])
  const [patPts, setPatPts] = useState([])
  const [nextIsCt, setNextIsCt] = useState(true)

  // previews : base64 data URLs
  const [ctPreview, setCtPreview] = useState(ctSrc)
  const [patPreview, setPatPreview] = useState(patSrc)
  const originalCtRef = useRef(ctSrc)
  const originalPatRef = useRef(patSrc)

  // sliders (0.5..3)
  const [equalizeValCt, setEqualizeValCt] = useState(1.0)
  const [normalizeValCt, setNormalizeValCt] = useState(1.0)
  const [blurValCt, setBlurValCt] = useState(1.0)
  const [brightnessValCt, setBrightnessValCt] = useState(1.0)
  const [contrastValCt, setContrastValCt] = useState(1.0)

  const [equalizeValPat, setEqualizeValPat] = useState(1.0)
  const [normalizeValPat, setNormalizeValPat] = useState(1.0)
  const [blurValPat, setBlurValPat] = useState(1.0)
  const [brightnessValPat, setBrightnessValPat] = useState(1.0)
  const [contrastValPat, setContrastValPat] = useState(1.0)

  // debounce timers
  const debounceRef = useRef({})

  // zoom/pan state per canvas
  const [ctState, setCtState] = useState({ scale: 1.0, offsetX: 0, offsetY: 0 })
  const [patState, setPatState] = useState({ scale: 1.0, offsetX: 0, offsetY: 0 })

  // drag helper
  const dragRef = useRef({ isDown: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, which: null })

  // notify parent
  useEffect(() => { onPointsChange?.(ctPts, patPts) }, [ctPts, patPts])

  // update previews when props change (upload new images)
  useEffect(() => {
    if (ctSrc) { setCtPreview(ctSrc); originalCtRef.current = ctSrc }
  }, [ctSrc])
  useEffect(() => {
    if (patSrc) { setPatPreview(patSrc); originalPatRef.current = patSrc }
  }, [patSrc])

  // draw function that respects scale/offset and draws markers fixed-size on screen
  const drawCanvas = (canvas, src, points, state, color) => {
    if (!canvas || !src) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // internal image size is 512x512
      const IMG_SIZE = 512
      canvas.width = IMG_SIZE
      canvas.height = IMG_SIZE

      // clear and draw transformed image
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE)

      // apply transform for image draw
      const { scale, offsetX, offsetY } = state
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)
      ctx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE)

      // draw points in screen space so marker size stays stable
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      points.forEach((p, i) => {
        const sx = p[0] * scale + offsetX
        const sy = p[1] * scale + offsetY
        // shadow
        ctx.beginPath()
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.arc(sx + 1, sy + 1, 7, 0, Math.PI * 2)
        ctx.fill()
        // marker
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.arc(sx, sy, 6, 0, Math.PI * 2)
        ctx.fill()
        // label
        ctx.fillStyle = 'white'
        ctx.font = '12px sans-serif'
        ctx.fillText(String(i + 1), sx + 8, sy - 8)
      })
    }
    img.src = src
  }

  // redraw hooks
  useEffect(() => { drawCanvas(ctCanvas.current, ctPreview, ctPts, ctState, '#1d4ed8') }, [ctPreview, ctPts, ctState])
  useEffect(() => { drawCanvas(patCanvas.current, patPreview, patPts, patState, '#16a34a') }, [patPreview, patPts, patState])

  // convert screen coords -> image coords (0..512) taking into account scale/offset
  const screenToImageCoords = (canvas, e, state) => {
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const ix = (cx - state.offsetX) / state.scale
    const iy = (cy - state.offsetY) / state.scale
    const clamp = v => Math.max(0, Math.min(512, Math.round(v)))
    return [clamp(ix), clamp(iy)]
  }

  // click handlers for points (respect alternating CT->Patient)
  const clickCt = (e) => {
    if (!nextIsCt) return
    const r = ctCanvas.current.getBoundingClientRect()
    // if clicked outside canvas area ignore
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
    const [x, y] = screenToImageCoords(ctCanvas.current, e, ctState)
    setCtPts(prev => [...prev, [x, y]])
    setNextIsCt(false)
  }

  const clickPat = (e) => {
    if (nextIsCt) return
    const r = patCanvas.current.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
    const [x, y] = screenToImageCoords(patCanvas.current, e, patState)
    setPatPts(prev => [...prev, [x, y]])
    setNextIsCt(true)
  }

  const resetPoints = () => { setCtPts([]); setPatPts([]); setNextIsCt(true) }

  // ------------------ Preprocess fetch ------------------
  const applyPreprocess = async (target, method, intensity) => {
    const jobId = sessionStorage.getItem('jobId')
    if (!jobId) { alert('Aucun job actif — fais l\'upload d\'abord'); return }

    try {
      const res = await fetch('/api/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, target, method, intensity })
      })
      const txt = await res.text()
      // backend can return JSON or sometimes HTML (redirect to login) -> gère les deux
      try {
        const data = JSON.parse(txt)
        if (!res.ok) {
          console.error('Erreur backend preprocess', res.status, data)
          if (data?.error) console.warn(data.error)
          return
        }
        if (data.preview) {
          const uri = 'data:image/png;base64,' + data.preview
          if (target === 'ref') setCtPreview(uri)
          else setPatPreview(uri)
        } else {
          console.error('Réponse vide du backend:', data)
        }
      } catch (e) {
        // non-JSON (ex: HTML)
        console.error('Réponse inattendue du backend (non-JSON):', txt)
      }
    } catch (err) {
      console.error('Erreur fetch preprocess:', err)
    }
  }

  // debounce helper
  const debouncedApply = (key, target, method, intensity, ms = 200) => {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(() => {
      applyPreprocess(target, method, intensity)
      debounceRef.current[key] = null
    }, ms)
  }

  // connect slider state -> debounced preprocess (CT)
  useEffect(() => { if (equalizeValCt !== 1.0) debouncedApply('eqCt', 'ref', 'equalize', equalizeValCt) }, [equalizeValCt])
  useEffect(() => { if (normalizeValCt !== 1.0) debouncedApply('normCt', 'ref', 'normalize', normalizeValCt) }, [normalizeValCt])
  useEffect(() => { if (blurValCt !== 1.0) debouncedApply('blurCt', 'ref', 'blur', blurValCt) }, [blurValCt])
  useEffect(() => { if (brightnessValCt !== 1.0) debouncedApply('brightCt', 'ref', 'brightness', brightnessValCt) }, [brightnessValCt])
  useEffect(() => { if (contrastValCt !== 1.0) debouncedApply('contCt', 'ref', 'contrast', contrastValCt) }, [contrastValCt])

  // PAT
  useEffect(() => { if (equalizeValPat !== 1.0) debouncedApply('eqPat', 'patient', 'equalize', equalizeValPat) }, [equalizeValPat])
  useEffect(() => { if (normalizeValPat !== 1.0) debouncedApply('normPat', 'patient', 'normalize', normalizeValPat) }, [normalizeValPat])
  useEffect(() => { if (blurValPat !== 1.0) debouncedApply('blurPat', 'patient', 'blur', blurValPat) }, [blurValPat])
  useEffect(() => { if (brightnessValPat !== 1.0) debouncedApply('brightPat', 'patient', 'brightness', brightnessValPat) }, [brightnessValPat])
  useEffect(() => { if (contrastValPat !== 1.0) debouncedApply('contPat', 'patient', 'contrast', contrastValPat) }, [contrastValPat])

  // reset preview locally (doesn't call backend)
  const resetPreview = (target) => {
    if (target === 'ref') {
      setCtPreview(originalCtRef.current)
      setEqualizeValCt(1.0); setNormalizeValCt(1.0); setBlurValCt(1.0); setBrightnessValCt(1.0); setContrastValCt(1.0)
    } else {
      setPatPreview(originalPatRef.current)
      setEqualizeValPat(1.0); setNormalizeValPat(1.0); setBlurValPat(1.0); setBrightnessValPat(1.0); setContrastValPat(1.0)
    }
    // reset view also
    if (target === 'ref') setCtState({ scale: 1.0, offsetX: 0, offsetY: 0 })
    else setPatState({ scale: 1.0, offsetX: 0, offsetY: 0 })
  }

  // ------------------ Zoom & Pan handlers ------------------
  const handleWheel = (e, which) => {
    e.preventDefault()
    const canvas = which === 'ct' ? ctCanvas.current : patCanvas.current
    const state = which === 'ct' ? ctState : patState
    const setStateFn = which === 'ct' ? setCtState : setPatState
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    let newScale = state.scale * zoomFactor
    newScale = Math.max(0.5, Math.min(4.0, newScale))
    // keep cursor point stable
    const ix = (cx - state.offsetX) / state.scale
    const iy = (cy - state.offsetY) / state.scale
    const newOffsetX = cx - ix * newScale
    const newOffsetY = cy - iy * newScale
    setStateFn({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY })
  }

  const handleMouseDown = (e, which) => {
    e.preventDefault()
    const state = which === 'ct' ? ctState : patState
    dragRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: state.offsetX,
      startOffsetY: state.offsetY,
      which
    }
    const canvas = which === 'ct' ? ctCanvas.current : patCanvas.current
    if (canvas) canvas.style.cursor = 'grabbing'
  }

  const handleMouseMove = (e) => {
    if (!dragRef.current.isDown) return
    const { startX, startY, startOffsetX, startOffsetY, which } = dragRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const setStateFn = which === 'ct' ? setCtState : setPatState
    const state = which === 'ct' ? ctState : patState
    setStateFn({ ...state, offsetX: startOffsetX + dx, offsetY: startOffsetY + dy })
  }

  const handleMouseUp = () => {
    if (!dragRef.current.isDown) return
    const canvas = dragRef.current.which === 'ct' ? ctCanvas.current : patCanvas.current
    dragRef.current.isDown = false
    if (canvas) canvas.style.cursor = nextIsCt ? 'crosshair' : 'not-allowed'
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [ctState, patState, nextIsCt])

  // reset view helpers
  const resetView = (which) => {
    if (which === 'ct') setCtState({ scale: 1.0, offsetX: 0, offsetY: 0 })
    else setPatState({ scale: 1.0, offsetX: 0, offsetY: 0 })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* CT column */}
      <div className='card'>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>CT (cliquez 1,3,5...)</div>
        <canvas
          ref={ctCanvas}
          onClick={clickCt}
          onWheel={(e) => handleWheel(e, 'ct')}
          onMouseDown={(e) => handleMouseDown(e, 'ct')}
          style={{ border: '1px solid #ddd', cursor: nextIsCt ? 'crosshair' : 'not-allowed', width: 512, height: 512 }}
        />
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {/* sliders CT */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Equalize</span><span>{equalizeValCt.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={equalizeValCt}
              onChange={e => setEqualizeValCt(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Normalize</span><span>{normalizeValCt.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={normalizeValCt}
              onChange={e => setNormalizeValCt(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Blur</span><span>{blurValCt.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={blurValCt}
              onChange={e => setBlurValCt(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Brightness</span><span>{brightnessValCt.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={brightnessValCt}
              onChange={e => setBrightnessValCt(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Contrast</span><span>{contrastValCt.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={contrastValCt}
              onChange={e => setContrastValCt(parseFloat(e.target.value))} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className='btn' onClick={() => resetPreview('ref')}>Reset preview</button>
            <button className='btn' onClick={() => resetView('ct')}>Reset view</button>
          </div>
        </div>
      </div>

      {/* PAT column */}
      <div className='card'>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Patient (cliquez 2,4,6...)</div>
        <canvas
          ref={patCanvas}
          onClick={clickPat}
          onWheel={(e) => handleWheel(e, 'pat')}
          onMouseDown={(e) => handleMouseDown(e, 'pat')}
          style={{ border: '1px solid #ddd', cursor: !nextIsCt ? 'crosshair' : 'not-allowed', width: 512, height: 512 }}
        />
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {/* sliders PAT */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Equalize</span><span>{equalizeValPat.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={equalizeValPat}
              onChange={e => setEqualizeValPat(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Normalize</span><span>{normalizeValPat.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={normalizeValPat}
              onChange={e => setNormalizeValPat(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Blur</span><span>{blurValPat.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={blurValPat}
              onChange={e => setBlurValPat(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Brightness</span><span>{brightnessValPat.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={brightnessValPat}
              onChange={e => setBrightnessValPat(parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}><span>Contrast</span><span>{contrastValPat.toFixed(1)}</span></label>
            <input type="range" min="0.5" max="3" step="0.1" value={contrastValPat}
              onChange={e => setContrastValPat(parseFloat(e.target.value))} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className='btn' onClick={() => resetPreview('patient')}>Reset preview</button>
            <button className='btn' onClick={() => resetView('pat')}>Reset view</button>
          </div>
        </div>
      </div>

      {/* footer controls */}
      <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={resetPoints} className='btn'>Reset Points</button>
        <div style={{ opacity: .7 }}>Paires: {Math.min(ctPts.length, patPts.length)}</div>
        <div style={{ marginLeft: 'auto', color: '#666', fontSize: 13 }}>
          Astuce: molette = zoom (centré), cliquer-glisser = déplacer l'image.
        </div>
      </div>
    </div>
  )
}
