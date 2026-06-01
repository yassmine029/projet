import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Calendar, FileText, Phone, Mail, Stethoscope, Clock, ShieldCheck,
  MapPin, Activity, Star, Plus, Boxes, Layers, ChevronRight, ChevronDown,
  Lock, Eye, Download, Edit3, ArrowLeftRight, Trash2, Hash, User, Search, Filter, ArrowUpDown,
  HardDrive, FolderOpen, FolderTree, Settings, CheckCircle2, LineChart, AlertCircle,
  Brain, Box, X, ChevronLeft, ChevronRight as ChevronR, Maximize2, Zap
} from 'lucide-react';
import api from '../../api';
import LongitudinalDashboard from '../../components/LongitudinalDashboard';

// ── NIfTI 3-axis viewer modal ──────────────────────────────────────────────────
function NiftiViewerModal({ fileId, filename, onClose }) {
  const AXES = ['axial', 'coronal', 'sagittal'];
  const LABELS = { axial: 'Axial (Z)', coronal: 'Coronal (Y)', sagittal: 'Sagittal (X)' };

  const [activeAxis, setActiveAxis] = useState('axial');
  const [shape, setShape] = useState(null);
  const [indices, setIndices] = useState({ axial: 0, coronal: 0, sagittal: 0 });
  const [images, setImages] = useState({ axial: null, coronal: null, sagittal: null });
  const [loading, setLoading] = useState({ axial: true, coronal: true, sagittal: true });
  const [isEmpty, setIsEmpty] = useState({ axial: false, coronal: false, sagittal: false });
  const [allEmpty, setAllEmpty] = useState(false);
  const [error, setError] = useState(null);
  const fetchControllers = useRef({});
  const shapeRef = useRef(null);

  const maxIndex = (axis) => {
    const s = shapeRef.current;
    return s ? (axis === 'axial' ? s[2] : axis === 'coronal' ? s[1] : s[0]) - 1 : 0;
  };

  const fetchSlice = useCallback(async (axis, index) => {
    if (fetchControllers.current[axis]) fetchControllers.current[axis].abort();
    const ctrl = new AbortController();
    fetchControllers.current[axis] = ctrl;
    setLoading(prev => ({ ...prev, [axis]: true }));
    try {
      const params = { axis };
      if (index !== undefined && index >= 0) params.index = index;
      // omit index to let backend auto-detect best slice
      const res = await api.get(`/mri-files/${fileId}/nifti-slice/`, {
        params,
        signal: ctrl.signal,
        timeout: 60000, // 60s for heavy NIfTI processing
      });
      if (res.data.ok) {
        shapeRef.current = res.data.shape;
        setShape(res.data.shape);
        setImages(prev => ({ ...prev, [axis]: res.data.image }));
        setIndices(prev => ({ ...prev, [axis]: res.data.index }));
        setIsEmpty(prev => {
          const next = { ...prev, [axis]: res.data.is_empty };
          if (Object.values(next).every(Boolean)) setAllEmpty(true);
          return next;
        });
      } else {
        setError(res.data.error || 'Erreur inconnue lors de la lecture du fichier.');
      }
    } catch (e) {
      if (e.name !== 'CanceledError' && e.name !== 'AbortError') {
        console.error("NIfTI View Error:", e);
        if (e.code === 'ECONNABORTED') {
          setError('Délai d\'attente dépassé. Le fichier est peut-être trop volumineux.');
        } else {
          setError('Erreur de chargement de la coupe.');
        }
      }
    } finally {
      setLoading(prev => ({ ...prev, [axis]: false }));
    }
  }, [fileId]);

  // Initial load: backend auto-detects the best (most content-rich) slice
  useEffect(() => {
    AXES.forEach(ax => fetchSlice(ax, undefined));
    return () => Object.values(fetchControllers.current).forEach(c => { try { c.abort(); } catch {} });
  }, [fileId]);

  const handleSlider = (axis, val) => {
    const clamped = Math.max(0, Math.min(val, maxIndex(axis)));
    setIndices(prev => ({ ...prev, [axis]: clamped }));
    fetchSlice(axis, clamped);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        handleSlider(activeAxis, indices[activeAxis] + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        handleSlider(activeAxis, indices[activeAxis] - 1);
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeAxis, indices]);

  const isLoadingAny = Object.values(loading).some(Boolean);
  const isCorrupt = allEmpty && !isLoadingAny;
  const pct = maxIndex(activeAxis) > 0 ? (indices[activeAxis] / maxIndex(activeAxis)) * 100 : 0;
  const AXIS_ICONS = { axial: 'Z', coronal: 'Y', sagittal: 'X' };

  // Detect registration type from filename
  const regType = filename.includes('_advanced_') ? 'atlas'
    : filename.includes('_3d_') ? 'p2p'
    : null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         style={{ background: 'rgba(15,23,60,0.75)', backdropFilter: 'blur(12px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>

      {/* Card */}
      <div className="relative flex flex-col rounded-3xl overflow-hidden w-full bg-white"
           style={{ maxWidth: 880, maxHeight: '90vh', minHeight: 540,
                    boxShadow: '0 24px 80px rgba(30,58,138,0.25), 0 4px 20px rgba(30,58,138,0.15)',
                    border: '1px solid #bfdbfe' }}>

        {/* Top accent bar */}
        <div className="h-1 w-full shrink-0"
             style={{ background: 'linear-gradient(90deg,#1e3a8a,#2563eb,#60a5fa,#2563eb,#1e3a8a)' }} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-white border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                 style={{ background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
                          boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-blue-900 font-black text-base leading-tight">Visualiseur NIfTI</h2>
              <p className="text-blue-400 text-[11px] font-mono mt-0.5 truncate" style={{ maxWidth: 340 }}>{filename}</p>
              {regType === 'atlas' && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'linear-gradient(90deg,#1e3a8a,#4f46e5)' }}>
                    <Brain style={{ width: 9, height: 9 }} />
                    MNI152
                  </span>
                  <span className="text-[10px] text-blue-400 font-semibold">Recalé sur atlas · identification des zones de Brodmann</span>
                </div>
              )}
              {regType === 'p2p' && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200">
                    <ArrowLeftRight style={{ width: 9, height: 9 }} />
                    Vol→Vol
                  </span>
                  <span className="text-[10px] text-blue-400 font-semibold">Recalé sur volume de référence · MI</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {shape && (
              <span className="px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200">
                {shape[0]} × {shape[1]} × {shape[2]}
              </span>
            )}
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-blue-300 hover:text-red-500 hover:bg-red-50 border border-blue-100 hover:border-red-200 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Axis tabs ── */}
        <div className="flex items-center gap-2 px-6 py-3 shrink-0 bg-blue-50/60 border-b border-blue-100">
          <span className="text-blue-300 text-[9px] font-black uppercase tracking-widest mr-1">Vue</span>
          {AXES.map(ax => (
            <button key={ax} onClick={() => setActiveAxis(ax)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={activeAxis === ax
                ? { background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
                    color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                    border: '1px solid #3b82f6' }
                : { background: '#fff', color: '#3b82f6',
                    border: '1px solid #bfdbfe' }}>
              <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black"
                    style={{ background: activeAxis === ax ? 'rgba(255,255,255,0.22)' : '#eff6ff', color: activeAxis === ax ? '#fff' : '#2563eb' }}>
                {AXIS_ICONS[ax]}
              </span>
              {LABELS[ax]}
            </button>
          ))}

          {/* Status dots */}
          <div className="ml-auto flex items-center gap-2">
            {AXES.map(ax => (
              <div key={ax} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                     style={{ background: loading[ax] ? '#2563eb' : images[ax] ? '#22c55e' : '#bfdbfe',
                              boxShadow: loading[ax] ? '0 0 6px #2563eb' : images[ax] ? '0 0 5px rgba(34,197,94,0.6)' : 'none' }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Image area — dark canvas for medical imaging ── */}
        <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden"
             style={{ background: 'linear-gradient(160deg,#0c1845 0%,#071033 100%)' }}>

          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
               style={{ backgroundImage: 'radial-gradient(circle,#60a5fa 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

          {/* Corner accents */}
          {[['top-3','left-3','borderTop','borderLeft'],['top-3','right-3','borderTop','borderRight'],
            ['bottom-3','left-3','borderBottom','borderLeft'],['bottom-3','right-3','borderBottom','borderRight']
          ].map(([y,x,b1,b2],i) => (
            <div key={i} className={`absolute ${y} ${x} w-5 h-5`}
                 style={{ [b1]: '1.5px solid rgba(96,165,250,0.35)', [b2]: '1.5px solid rgba(96,165,250,0.35)' }} />
          ))}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold"
                 style={{ background: 'rgba(239,68,68,0.9)', border: '1px solid rgba(239,68,68,0.5)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {isCorrupt ? (
            <div className="flex flex-col items-center gap-5 text-center px-12">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-400/20">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm mb-2">Volume vide ou corrompu</p>
                <p className="text-blue-200/50 text-xs leading-relaxed max-w-xs">
                  Ce volume ne contient pas de données valides. Il a probablement été sauvegardé avant la correction du format NIfTI.
                </p>
                <p className="text-blue-400 text-xs font-semibold mt-3">Veuillez relancer un nouveau recalage.</p>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full h-full p-5">
              {loading[activeAxis] && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                     style={{ background: 'rgba(7,16,51,0.75)' }}>
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-2 rounded-full border border-t-blue-300/40 animate-spin"
                         style={{ animationDuration: '1.8s', animationDirection: 'reverse' }} />
                  </div>
                  <span className="text-blue-300/60 text-[11px] font-medium tracking-wide">Chargement…</span>
                </div>
              )}

              {images[activeAxis] ? (
                <img src={images[activeAxis]} alt={`Coupe ${activeAxis}`}
                  className="object-contain rounded-xl"
                  style={{ imageRendering: 'pixelated',
                           maxHeight: 'calc(90vh - 230px)', maxWidth: '100%',
                           boxShadow: '0 0 0 1px rgba(96,165,250,0.2), 0 16px 48px rgba(0,0,0,0.6)' }} />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-t-blue-400 border-blue-500/10 animate-spin" />
                  <span className="text-blue-300/40 text-xs">Analyse du volume…</span>
                </div>
              )}

              {/* HUD bottom-left */}
              {images[activeAxis] && !loading[activeAxis] && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                     style={{ background: 'rgba(7,16,51,0.7)', border: '1px solid rgba(96,165,250,0.15)', backdropFilter: 'blur(8px)' }}>
                  <span className="text-blue-400 text-[9px] font-black uppercase tracking-widest">{activeAxis}</span>
                  <span className="w-px h-3 bg-blue-400/20" />
                  <span className="text-white font-bold text-xs font-mono">{indices[activeAxis]}</span>
                  <span className="text-blue-300/40 text-xs font-mono">/ {maxIndex(activeAxis)}</span>
                  {regType && (
                    <>
                      <span className="w-px h-3 bg-blue-400/20" />
                      <span className="text-[9px] font-bold tracking-wide"
                            style={{ color: regType === 'atlas' ? '#818cf8' : '#60a5fa' }}>
                        {regType === 'atlas' ? 'MNI152' : 'Vol→Vol'}
                      </span>
                    </>
                  )}
                </div>
              )}

              {isEmpty[activeAxis] && !loading[activeAxis] && images[activeAxis] && (
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl text-[10px] font-semibold text-yellow-300"
                     style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', backdropFilter: 'blur(8px)' }}>
                  Coupe vide
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Slider footer ── */}
        <div className={`px-6 py-4 shrink-0 bg-white border-t border-blue-100 ${isCorrupt ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => handleSlider(activeAxis, indices[activeAxis] - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-blue-200 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Custom slider */}
            <div className="flex-1 relative h-6 flex items-center">
              <div className="absolute w-full h-1.5 rounded-full bg-blue-100" />
              <div className="absolute h-1.5 rounded-full transition-all"
                   style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1e3a8a,#2563eb,#60a5fa)' }} />
              <input type="range" min={0} max={maxIndex(activeAxis)} value={indices[activeAxis]}
                onChange={e => handleSlider(activeAxis, Number(e.target.value))}
                className="absolute w-full opacity-0 cursor-pointer h-6" />
              <div className="absolute w-4 h-4 rounded-full pointer-events-none border-2 border-white"
                   style={{ left: `calc(${pct}% - 8px)`,
                            background: '#2563eb',
                            boxShadow: '0 0 0 3px rgba(37,99,235,0.25), 0 2px 8px rgba(30,58,138,0.4)' }} />
            </div>

            <button onClick={() => handleSlider(activeAxis, indices[activeAxis] + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-blue-200 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shrink-0">
              <ChevronR className="w-4 h-4" />
            </button>

            <span className="text-blue-700 text-xs font-mono font-bold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg min-w-[72px] text-center">
              {indices[activeAxis]} / {maxIndex(activeAxis)}
            </span>
          </div>
          <p className="text-blue-200 text-[10px] text-center mt-2">← → ou les flèches pour naviguer · Échap pour fermer</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- UI Sub-components ---

function Badge({ children, type = 'blue', pulse = false }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-slate-100 text-slate-600',
    darkBlue: 'bg-[#1e3a8a] text-white',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[type] || colors.blue} ${pulse ? 'pulse-green' : ''}`}>
      {children}
    </span>
  );
}

const ANALYSIS_COLORS = {
  registration: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Boxes },
  segmentation: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Layers },
  reconstruction: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: Activity },
};

function FileActionRow({ file, sessionColor, onOpen }) {
  return (
    <div className="group flex items-center justify-between p-3 mr-2 bg-white border border-slate-100/60 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${sessionColor ? `bg-${sessionColor}-50` : 'bg-slate-50'}`}>
          <FileText className={`w-4 h-4 ${sessionColor ? `text-${sessionColor}-600` : 'text-slate-400'}`} />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800 truncate max-w-[200px] md:max-w-md">{file.name || file.original_filename || 'Fichier'}</div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
            <span className="uppercase">{file.type || file.format || 'Fichier'}</span> • {file.size || 'N/A'}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onOpen} title="Voir" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
        <button title="Télécharger" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
        <button title="Annoter" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
        <button title="Comparer" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><ArrowLeftRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function ZipSeriesViewer({ fileId, onClose }) {
  const [idx, setIdx]         = React.useState(0);
  const [total, setTotal]     = React.useState(0);
  const [image, setImage]     = React.useState(null);
  const [fname, setFname]     = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState('');
  const idxRef                = React.useRef(0);
  const totalRef              = React.useRef(0);

  const load = React.useCallback(async (i) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/mri-files/${fileId}/zip-image/?index=${i}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Erreur'); return; }
      setImage(data.image);
      setTotal(data.total);  totalRef.current = data.total;
      setIdx(data.index);    idxRef.current   = data.index;
      setFname(data.filename);
    } catch { setError('Erreur de chargement'); }
    finally { setLoading(false); }
  }, [fileId]);

  React.useEffect(() => { load(0); }, [load]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft'  && idxRef.current > 0)                      load(idxRef.current - 1);
      if (e.key === 'ArrowRight' && idxRef.current < totalRef.current - 1)   load(idxRef.current + 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [load, onClose]);

  /* Render via Portal so it sits above AppLayout's stacking context */
  return ReactDOM.createPortal(
    <>
      <style>{`@keyframes zspin{to{transform:rotate(360deg)}}`}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(3px)' }}
      />

      {/* Modal card — centré avec taille fixe */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:'fixed', zIndex:9001,
          top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width: Math.min(window.innerWidth * 0.88, 680),
          maxHeight: '90vh',
          background:'#0f172a',
          borderRadius:18,
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          boxShadow:'0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #1e293b', flexShrink:0 }}>
          <div>
            <span style={{ fontSize:11, fontWeight:800, color:'#7c3aed', letterSpacing:'0.1em', textTransform:'uppercase' }}>Série IRM recalée</span>
            <p style={{ fontSize:11, color:'#475569', marginTop:2, maxWidth:380, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fname}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>{total > 0 ? `${idx + 1} / ${total}` : '—'}</span>
            <button onClick={onClose}
              style={{ width:28, height:28, borderRadius:8, border:'1px solid #334155', background:'#1e293b', color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, lineHeight:1 }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Image area ── */}
        <div style={{ flex:1, background:'#000', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>
          {loading ? (
            <div style={{ width:32, height:32, border:'3px solid #1e293b', borderTopColor:'#7c3aed', borderRadius:'50%', animation:'zspin 0.7s linear infinite' }} />
          ) : error ? (
            <p style={{ color:'#ef4444', fontSize:13, padding:24 }}>{error}</p>
          ) : image ? (
            <img src={image} alt={fname}
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block' }} />
          ) : null}
        </div>

        {/* ── Controls ── */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid #1e293b', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button
              onClick={() => load(idx - 1)} disabled={idx === 0 || loading}
              style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #334155', background:'#1e293b', color: idx === 0 ? '#334155' : '#e2e8f0', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize:12, fontWeight:600, flexShrink:0 }}>
              ← Préc.
            </button>

            <input
              type="range" min={0} max={Math.max(0, total - 1)} value={idx}
              onChange={e => { const v = Number(e.target.value); setIdx(v); idxRef.current = v; }}
              onMouseUp={e  => load(Number(e.currentTarget.value))}
              onTouchEnd={e => load(Number(e.currentTarget.value))}
              style={{ flex:1, accentColor:'#7c3aed', cursor:'pointer' }}
            />

            <button
              onClick={() => load(idx + 1)} disabled={idx >= total - 1 || loading}
              style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #334155', background:'#1e293b', color: idx >= total - 1 ? '#334155' : '#e2e8f0', cursor: idx >= total - 1 ? 'not-allowed' : 'pointer', fontSize:12, fontWeight:600, flexShrink:0 }}>
              Suiv. →
            </button>
          </div>
          <p style={{ textAlign:'center', fontSize:10, color:'#334155', marginTop:6 }}>Touches ← → · Échap pour fermer</p>
        </div>
      </div>
    </>,
    document.body
  );
}

function ResultsSection({ sessions, analysisFiles, resolveFileUrl, formatDate, formatSize }) {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState('all');
  const [niftiViewer, setNiftiViewer] = React.useState(null);
  const [zipViewer, setZipViewer]     = React.useState(null);
  const [directLoadingId, setDirectLoadingId] = React.useState(null);
  const [directLoadError, setDirectLoadError] = React.useState('');

  const handleIdentifierZones = async (fileId) => {
    setDirectLoadingId(fileId);
    setDirectLoadError('');
    try {
      const res = await fetch('/api/volume/load-from-mrifile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (!res.ok || !data.jobId) throw new Error(data.error || 'Chargement échoué');
      // Stocker le jobId puis naviguer directement vers ExplorationPage
      sessionStorage.setItem('volumeJobId', data.jobId);
      navigate('/exploration');
    } catch (err) {
      setDirectLoadError(err.message || 'Erreur lors du chargement du volume');
      setTimeout(() => setDirectLoadError(''), 4000);
    } finally {
      setDirectLoadingId(null);
    }
  };

  const serieFiles = analysisFiles.filter(f =>
    /^reg_serie_/i.test(String(f.original_filename || '')) && String(f.original_filename || '').endsWith('.zip')
  );
  const otherAnalysis = analysisFiles.filter(f =>
    !(/^reg_serie_/i.test(String(f.original_filename || '')) && String(f.original_filename || '').endsWith('.zip'))
  );
  const recalageAll = [...serieFiles, ...otherAnalysis];
  const totalCount  = sessions.length + recalageAll.length;
  const showSeg = filter === 'all' || filter === 'segmentation';
  const showRec = filter === 'all' || filter === 'recalage';

  return (
    <>
    <div id="analyses-start" className="relative pl-12 pb-4">
      {/* Timeline dot */}
      <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
        <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-lg border-4 border-white">
          <Activity className="w-4 h-4" />
        </div>
      </div>

      {/* Container — même style que baseline */}
      <div className="bg-[#f0fdf4]/60 rounded-3xl border border-emerald-200/60 shadow-sm overflow-hidden">
        <div className="p-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-xl shrink-0">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-black text-emerald-900">Résultats cliniques</h3>
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                    {totalCount} résultat{totalCount > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-emerald-700/60 font-semibold uppercase tracking-wider">
                  Segmentation volumétrique · Recalage IRM
                </p>
              </div>
            </div>

            {/* Filtres */}
            {totalCount > 0 && sessions.length > 0 && recalageAll.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-white/70 rounded-2xl border border-emerald-100 shadow-sm">
                {[
                  { key: 'all',          label: 'Tous',          count: totalCount },
                  { key: 'segmentation', label: 'Segmentation',  count: sessions.length },
                  { key: 'recalage',     label: 'Recalage',      count: recalageAll.length },
                ].map(({ key, label, count }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      filter === key
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}>
                    {label}
                    <span className={`rounded-full px-1.5 text-[9px] font-black ${filter === key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Résumé segmentations ── */}
          {sessions.length > 0 && (filter === 'all' || filter === 'segmentation') && (() => {
            const sorted = [...sessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const lastDate = sorted[0]?.created_at ? formatDate(sorted[0].created_at) : null;
            const models = [...new Set(sorted.map(s => s.model_version).filter(Boolean))];
            return (
              <div className="mb-5 flex items-stretch gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white overflow-hidden">
                <div className="w-1 bg-violet-400 shrink-0" />
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-3 pr-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Segmentations effectuées</p>
                    <p className="text-xl font-black text-violet-800 leading-none">{sessions.length}</p>
                  </div>
                  {lastDate && (
                    <div className="border-l border-violet-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Dernière analyse</p>
                      <p className="text-sm font-bold text-slate-700">{lastDate}</p>
                    </div>
                  )}
                  {models.length > 0 && (
                    <div className="border-l border-violet-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Modèles utilisés</p>
                      <p className="text-sm font-bold text-slate-700">{models.join(' · ')}</p>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 self-center">
                    {sorted.slice(0, 5).map((s, i) => (
                      <div key={s.id} title={s.created_at ? formatDate(s.created_at) : ''}
                        className={`rounded-full border-2 border-white shadow-sm ${i === 0 ? 'w-3 h-3 bg-violet-500' : 'w-2.5 h-2.5 bg-violet-200'}`} />
                    ))}
                    {sessions.length > 5 && <span className="text-[9px] font-bold text-violet-400">+{sessions.length - 5}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Résumé recalages ── */}
          {recalageAll.length > 0 && (filter === 'all' || filter === 'recalage') && (() => {
            const dated = recalageAll.filter(f => f.uploaded_at).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
            const lastDate = dated[0] ? formatDate(dated[0].uploaded_at) : null;
            const miValues = recalageAll.map(f => {
              const m = (f.original_filename || '').match(/MI([\d.]+)/);
              return m ? parseFloat(m[1]) : null;
            }).filter(v => v !== null);
            const bestMI = miValues.length ? Math.max(...miValues) : null;
            return (
              <div className="mb-5 flex items-stretch gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white overflow-hidden">
                <div className="w-1 bg-teal-400 shrink-0" />
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-3 pr-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Recalages effectués</p>
                    <p className="text-xl font-black text-teal-800 leading-none">{recalageAll.length}</p>
                  </div>
                  {lastDate && (
                    <div className="border-l border-teal-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Dernier recalage</p>
                      <p className="text-sm font-bold text-slate-700">{lastDate}</p>
                    </div>
                  )}
                  {bestMI !== null && (
                    <div className="border-l border-teal-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Meilleure qualité (MI)</p>
                      <p className={`text-sm font-black ${bestMI >= 0.5 ? 'text-emerald-600' : bestMI >= 0.3 ? 'text-amber-600' : 'text-red-500'}`}>
                        {bestMI.toFixed(3)}
                      </p>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 self-center">
                    {dated.slice(0, 5).map((f, i) => (
                      <div key={f.id} title={formatDate(f.uploaded_at)}
                        className={`rounded-full border-2 border-white shadow-sm ${i === 0 ? 'w-3 h-3 bg-teal-500' : 'w-2.5 h-2.5 bg-teal-200'}`} />
                    ))}
                    {recalageAll.length > 5 && <span className="text-[9px] font-bold text-teal-400">+{recalageAll.length - 5}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {totalCount === 0 ? (
            <div className="py-10 text-center bg-white/50 rounded-2xl border border-dashed border-emerald-200">
              <Activity className="w-8 h-8 text-emerald-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-emerald-800/50">Aucune analyse disponible.</p>
              <p className="text-xs text-emerald-700/40 mt-1">Lancez une segmentation ou un recalage pour commencer.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">

              {/* Segmentation */}
              {showSeg && sessions.map((session, idx) => (
                <SessionCard key={`seg-${idx}`} session={session} />
              ))}

              {/* Recalage : séries ZIP */}
              {zipViewer && <ZipSeriesViewer fileId={zipViewer.fileId} onClose={() => setZipViewer(null)} />}

              {showRec && serieFiles.map(file => {
                const fileUrl = resolveFileUrl(file.file_url || file.file);
                return (
                  <div key={file.id} className="group flex items-center gap-4 bg-white/80 px-5 py-4 rounded-2xl border border-white hover:border-violet-300 hover:shadow-sm transition-all">
                    <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                      <ArrowLeftRight className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-100 text-violet-700">Recalage</span>
                        <span className="text-sm font-bold text-slate-800">Série IRM recalée</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(file.uploaded_at)}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span className="font-mono font-semibold">{formatSize(file.file_size)} · ZIP</span>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity shrink-0">
                      <button
                        onClick={() => setZipViewer({ fileId: file.id })}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-bold hover:bg-violet-100 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" /> Voir
                      </button>
                      <a href={fileUrl} download
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-all shadow-sm">
                        <Download className="w-3.5 h-3.5" /> Télécharger
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Recalage : fichiers individuels */}
              {showRec && directLoadError && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium mb-2">
                  <X className="w-3.5 h-3.5 shrink-0" /> {directLoadError}
                </div>
              )}
              {showRec && otherAnalysis.map(file => {
                const fname      = file.original_filename || '';
                const miMatch    = fname.match(/MI([\d.]+)/);
                const miVal      = miMatch ? parseFloat(miMatch[1]) : null;
                const modeM      = fname.match(/_(2d|3d|advanced)_/i);
                const modeKey    = modeM ? modeM[1].toLowerCase() : '2d';
                const fileUrl    = resolveFileUrl(file.file_url || file.file);
                const isNifti    = fname.endsWith('.nii.gz') || fname.endsWith('.nii');
                const isAdvanced = modeKey === 'advanced';
                const is3D       = modeKey === '3d';

                const miColor = miVal === null ? '' : miVal >= 0.5 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : miVal >= 0.3 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-500 bg-red-50 border-red-200';

                return (
                  <div key={file.id} className={`group relative flex gap-4 bg-white px-5 py-4 rounded-2xl border transition-all duration-200 ${
                    isAdvanced
                      ? 'border-emerald-100 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-50'
                      : 'border-slate-100 hover:border-violet-200 hover:shadow-sm'
                  }`}>
                    {/* Barre latérale colorée */}
                    <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${isAdvanced ? 'bg-gradient-to-b from-emerald-400 to-teal-500' : 'bg-violet-400'}`} />

                    {/* Icône */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      isAdvanced ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-violet-600'
                    }`}>
                      {isAdvanced ? <Brain className="w-5 h-5 text-white" /> : <Boxes className="w-5 h-5 text-white" />}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      {/* Titre + badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isAdvanced ? (
                          <>
                            <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wide">Recalage 3D</span>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              <Brain className="w-2.5 h-2.5" /> Zones Brodmann
                            </span>
                          </>
                        ) : (
                          <span className={`text-[11px] font-black uppercase tracking-wide ${is3D ? 'text-violet-700' : 'text-slate-600'}`}>
                            Recalage {is3D ? '3D volumétrique' : '2D'}
                          </span>
                        )}
                        {miVal !== null && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${miColor}`}>
                            MI {miVal.toFixed(3)}
                          </span>
                        )}
                      </div>

                      {/* Méta */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{formatDate(file.uploaded_at)}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span>{formatSize(file.file_size)}</span>
                        {isNifti && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-bold">NIfTI</span>}
                      </div>

                      {/* Actions toujours visibles pour advanced, hover pour les autres */}
                      <div className={`flex items-center gap-2 mt-3 ${isAdvanced ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        {isAdvanced && isNifti && (
                          <button
                            onClick={() => handleIdentifierZones(file.id)}
                            disabled={directLoadingId === file.id}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-sm shadow-emerald-200/60 disabled:opacity-60 disabled:cursor-wait"
                          >
                            {directLoadingId === file.id
                              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Chargement…</>
                              : <><Zap className="w-3 h-3" /> Identifier les zones</>
                            }
                          </button>
                        )}
                        {isNifti && (
                          <button
                            onClick={() => setNiftiViewer({ fileId: file.id, filename: fname })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all"
                          >
                            <Eye className="w-3 h-3" /> Voir
                          </button>
                        )}
                        <a
                          href={isNifti ? niftiDownloadUrl(file.id) : fileUrl}
                          download={file.original_filename || undefined}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all"
                        >
                          <Download className="w-3 h-3" /> Télécharger
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>
    </div>

    {/* NIfTI viewer modal */}
    {niftiViewer && (
      <NiftiViewerModal
        fileId={niftiViewer.fileId}
        filename={niftiViewer.filename}
        onClose={() => setNiftiViewer(null)}
      />
    )}
    </>
  );
}

function SessionCard({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const totalFiles = (session.groups || []).reduce((acc, g) => acc + (g.files?.length || 0), 0);
  const groupCount = (session.groups || []).length;
  const has3D = Boolean(session.has_3d_reconstruction);

  return (
    <div className={`bg-white/80 rounded-2xl border hover:shadow-sm transition-all overflow-hidden ${has3D ? 'border-white hover:border-emerald-200' : 'border-amber-100 hover:border-amber-300'}`}>
      {/* Collapsed header — toujours visible */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Segmentation</span>
            <span className="text-sm font-bold text-slate-800">{session.session_num}</span>
            {/* Badge modèle IA */}
            {session.model_key && (() => {
              const cfg = { unetpp: { cls: 'bg-blue-100 text-blue-700', label: 'Modèle 1' }, nnunet: { cls: 'bg-violet-100 text-violet-700', label: 'Modèle 2' }, swinunetr: { cls: 'bg-emerald-100 text-emerald-700', label: 'Modèle 3' } }[session.model_key] || { cls: 'bg-slate-100 text-slate-600', label: session.model_label || session.model_key };
              return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${cfg.cls}`}>{cfg.label}</span>;
            })()}
            {session.is_new && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500 text-white animate-pulse">Nouveau</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.date}{session.time && ` · ${session.time}`}</span>
            <span className="w-px h-3 bg-slate-200" />
            <span>{groupCount} groupe{groupCount > 1 ? 's' : ''} · {totalFiles} fichier{totalFiles > 1 ? 's' : ''}</span>
          </div>
        </div>
        <button className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all shrink-0
          ${isOpen ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-100'}`}>
          {isOpen ? <><ChevronDown className="w-3.5 h-3.5" /> Masquer</> : <><ChevronRight className="w-3.5 h-3.5" /> Voir les masques de segmentation</>}
        </button>
      </div>

      {/* Indicateur reconstruction 3D */}
      <div className={`mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 ${
        has3D
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-amber-50 border border-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {has3D
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            : <Box className="w-4 h-4 text-amber-500 shrink-0" />
          }
          <div>
            <p className={`text-[11px] font-black ${has3D ? 'text-emerald-700' : 'text-amber-700'}`}>
              {has3D ? 'Reconstruction 3D effectuée' : 'Reconstruction 3D non effectuée'}
            </p>
            {has3D && session.total_volume_mm3 && (
              <p className="text-[10px] text-emerald-600">Volume total : {Math.round(session.total_volume_mm3)} mm³</p>
            )}
            {!has3D && (
              <p className="text-[10px] text-amber-600">Seuls les masques de segmentation sont disponibles</p>
            )}
          </div>
        </div>
        {!has3D && session.run_id && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/segmentation/modelisation?run=${session.run_id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-black hover:bg-amber-600 transition-all shadow-sm shrink-0"
          >
            <Brain className="w-3.5 h-3.5" /> Lancer la reconstruction 3D
          </button>
        )}
        {has3D && session.run_id && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/segmentation/modelisation?run=${session.run_id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition-all shrink-0"
          >
            <Brain className="w-3.5 h-3.5" /> Voir les résultats 3D
          </button>
        )}
      </div>

      {/* Détails dépliés */}
      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">
          {(session.groups || []).map((group, gIdx) => (
            <div key={gIdx}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center">
                  {ANALYSIS_COLORS[group.type]
                    ? React.createElement(ANALYSIS_COLORS[group.type].icon, { className: 'w-3.5 h-3.5 text-white' })
                    : <Layers className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-xs font-black text-emerald-700">{group.label}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{group.count}</span>
              </div>
              <div className="space-y-1.5">
                {(group.files || []).map((file, fIdx) => (
                  <div key={fIdx} className="group flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-700 truncate">{file.name || 'Fichier segmentation'}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-emerald-500 uppercase">{file.type || 'Mask'}</span>
                        {file.size && file.size !== 'N/A' && <span className="text-[10px] text-slate-400">{file.size}</span>}
                      </div>
                    </div>
                    {file.url && (
                      <a href={file.url} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200">
                        <Eye className="w-3 h-3" /> Voir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChronologyNav({ patient, totalBytes, fileCount, onJump, onDelete }) {
  return (
    <div className="sticky top-[68px] z-30 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-3xl p-3 px-5 mb-8 shadow-2xl shadow-blue-900/5 flex items-center justify-between animate-slide-down">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
           <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center text-white text-xs font-black shadow-lg">
              {patient.nom?.[0]}{patient.prenom?.[0]}
           </div>
           <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter leading-none mb-1">Dossier Clinique</p>
              <p className="text-sm font-black text-slate-900 leading-none">{patient.nom} {patient.prenom}</p>
           </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Baseline</span>
                <span className="text-[11px] font-black text-blue-900">{fileCount} fichiers</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Taille</span>
                <span className="text-[11px] font-black text-blue-900">{formatSize(totalBytes)}</span>
            </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button onClick={() => onJump('baseline-start')} className="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 group">
           <Lock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Baseline
        </button>
        <button onClick={() => onJump('analyses-start')} className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center gap-2 active:scale-95">
           <Activity className="w-3.5 h-3.5 animate-pulse" /> Voir les analyses du patient
        </button>
        <button 
          onClick={onDelete} 
          title="Supprimer ce dossier"
          className="p-3 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center active:scale-95 border border-red-100"
        >
           <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- Helpers ---

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '-';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const resolveFileUrl = (rawUrl) => {
  if (!rawUrl) return null;
  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const apiBase = api?.defaults?.baseURL || '';
    const apiOrigin = apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
    if (rawUrl.startsWith('/')) return `${apiOrigin}${rawUrl}`;
    return `${apiOrigin}/${rawUrl}`;
  } catch (e) {
    return rawUrl;
  }
};

// Returns true for NIfTI files (.nii / .nii.gz).
// These must be downloaded via the /api/mri-files/{id}/download/ endpoint to avoid the
// browser silently decompressing the gzip content (Django sets Content-Encoding: gzip
// when mimetypes detects the .gz encoding, which corrupts the downloaded file).
const isNiftiFilename = (name) => {
  const n = (name || '').toLowerCase();
  return n.endsWith('.nii.gz') || n.endsWith('.nii');
};

const niftiDownloadUrl = (fileId) => `/api/mri-files/${fileId}/download/`;

const formatDateTime = (dateValue) => {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// --- Main Component ---

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipNotice, setZipNotice] = useState(null);
  const [zipProgress, setZipProgress] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [isBaselineExpanded, setIsBaselineExpanded] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      if (!id) return;
      setReportsLoading(true);
      try {
        const token = localStorage.getItem('access');
        const res = await api.get(`/patients/${id}/reports/list/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data?.ok) setReports(res.data.reports || []);
      } catch { /* silencieux */ }
      finally { setReportsLoading(false); }
    };
    fetchReports();
  }, [id]);

  const fetchPatient = useCallback(async () => {
    try {
      const res = await api.get(`/patients/${id}/`);
      if (res.data && res.data.ok) {
        setPatient(res.data.patient);
      } else {
        setError(res.data.error || "Patient introuvable.");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Chargement initial
  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  // Rafraîchissement au retour sur la page (ex. après reconstruction 3D)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPatient(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchPatient]);

  // Rafraîchissement à chaque navigation vers cette page
  useEffect(() => { fetchPatient(); }, [location.key, fetchPatient]);

  useEffect(() => {
    if (!zipNotice) return undefined;
    const timer = window.setTimeout(() => setZipNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [zipNotice]);

  // Rough age calculation
  const calcAge = (dobString) => {
    if (!dobString) return '?';
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const allFiles = useMemo(() => (Array.isArray(patient?.mri_files) ? patient.mri_files : []).filter(Boolean), [patient]);
  const isAnalysisFile = (f) => f.file_type === 'analysis' || /^reg_/i.test(String(f.original_filename || ''));
  const files = useMemo(() => allFiles.filter(f => !isAnalysisFile(f)), [allFiles]);
  const analysisFiles = useMemo(() => allFiles.filter(f => isAnalysisFile(f)), [allFiles]);

  const fileTypes = useMemo(() => {
    const types = new Set();
    files.forEach((file) => {
      const name = String(file.original_filename || file.relative_path || '').toLowerCase();
      const dotIdx = name.lastIndexOf('.');
      if (dotIdx > -1 && dotIdx < name.length - 1) {
        types.add(name.slice(dotIdx + 1));
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [files]);

  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = files.filter((file) => {
      const originalName = String(file.original_filename || '').toLowerCase();
      const relativePath = String(file.relative_path || '').toLowerCase();
      const nameForType = originalName || relativePath;
      const dotIdx = nameForType.lastIndexOf('.');
      const ext = dotIdx > -1 && dotIdx < nameForType.length - 1 ? nameForType.slice(dotIdx + 1) : '';
      const matchesType = typeFilter === 'all' || ext === typeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        originalName.includes(normalizedSearch) ||
        relativePath.includes(normalizedSearch);
      return matchesType && matchesSearch;
    });

    next.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.original_filename || a.relative_path || '').localeCompare(
          String(b.original_filename || b.relative_path || ''),
          'fr',
          { sensitivity: 'base' }
        );
      }
      if (sortBy === 'size') {
        return Number(b.file_size || 0) - Number(a.file_size || 0);
      }
      const aDate = new Date(a.uploaded_at || 0).getTime();
      const bDate = new Date(b.uploaded_at || 0).getTime();
      return bDate - aDate;
    });

    return next;
  }, [files, search, typeFilter, sortBy]);

  const totalBytes = allFiles.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
  const folderCount = new Set(
    files.map((file) => {
      const rel = (file.relative_path || file.original_filename || '').replace(/\\/g, '/');
      const idx = rel.lastIndexOf('/');
      return idx > 0 ? rel.slice(0, idx) : 'Racine';
    })
  ).size;

  const downloadPatientZip = async () => {
    if (zipDownloading || !patient?.id) return;
    setZipDownloading(true);
    setZipProgress(0);
    setZipNotice(null);
    try {
      const response = await api.get(`/patients/${patient.id}/download-zip/`, {
        responseType: 'blob',
        onDownloadProgress: (evt) => {
          if (evt?.total) {
            const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
            setZipProgress(pct);
          } else {
            setZipProgress((prev) => (prev == null || prev >= 90 ? 10 : prev + 10));
          }
        },
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${patient.num_dossier || 'patient'}_dossier.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setZipProgress(100);
      setZipNotice({
        type: 'success',
        message: 'Le dossier ZIP a éte téléchargé avec succès.',
      });
    } catch (err) {
      console.error('Erreur lors du téléchargement ZIP du dossier patient:', err);
      setZipNotice({
        type: 'error',
        message: "Échec du téléchargement ZIP.",
      });
    } finally {
      setZipDownloading(false);
      setTimeout(() => setZipProgress(null), 800);
    }
  };

  const folderTree = useMemo(() => {
    const root = {};
    filteredFiles.forEach((file) => {
      const rel = String(file.relative_path || file.original_filename || `fichier-${file.id}`)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');
      const parts = rel.split('/').filter(Boolean);
      const fileName = parts.length > 0 ? parts[parts.length - 1] : String(file.original_filename || `fichier-${file.id}`);
      const folders = parts.length > 1 ? parts.slice(0, -1) : [];
      let node = root;
      folders.forEach((segment) => {
        if (!node[segment]) node[segment] = { __folders: {}, __files: [] };
        node = node[segment].__folders;
      });
      if (!node.__root) node.__root = { __folders: {}, __files: [] };
      node.__root.__files.push({ ...file, treeLabel: fileName });
    });
    const normalize = (inputNode) => {
      const folders = [];
      const ownFiles = [];
      Object.entries(inputNode).forEach(([name, value]) => {
        if (name === '__root') {
          ownFiles.push(...value.__files);
          return;
        }
        folders.push({ name, folders: normalize(value.__folders).folders, files: value.__files });
      });
      folders.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      ownFiles.sort((a, b) => String(a.treeLabel).localeCompare(String(b.treeLabel), 'fr', { sensitivity: 'base' }));
      return { folders, files: ownFiles };
    };
    return normalize(root);
  }, [filteredFiles]);

  const renderTreeNode = (node, depth = 0) => (
    <div className="space-y-2">
      {(node?.folders || []).map((folder) => (
        <div key={folder.name} className="rounded-lg border border-slate-200 bg-white/70">
          <div className="px-3 py-2 text-sm font-semibold text-slate-900 flex items-center gap-2" style={{ paddingLeft: `${12 + depth * 12}px` }}>
            <FolderOpen className="w-4 h-4 text-blue-600" />
            {folder.name}
          </div>
          <div className="px-2 pb-2">
            {folder.files.map((file) => {
              const fname = file.original_filename || file.treeLabel || '';
              const isNifti = isNiftiFilename(fname);
              const fileUrl = isNifti ? niftiDownloadUrl(file.id) : resolveFileUrl(file.file_url || file.file);
              return (
                <div key={file.id} className="mx-2 mb-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3">
                  <span className="truncate">{file.treeLabel}</span>
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      download={isNifti ? fname : undefined}
                      target={isNifti ? undefined : '_blank'}
                      rel={isNifti ? undefined : 'noreferrer'}
                      className="text-blue-600 font-semibold hover:underline shrink-0"
                    >
                      {isNifti ? 'Télécharger' : 'Ouvrir'}
                    </a>
                  )}
                </div>
              );
            })}
            {renderTreeNode({ folders: folder.folders, files: [] }, depth + 1)}
          </div>
        </div>
      ))}
      {(node?.files || []).map((file) => {
        const fname = file.original_filename || file.treeLabel || '';
        const isNifti = isNiftiFilename(fname);
        const fileUrl = isNifti ? niftiDownloadUrl(file.id) : resolveFileUrl(file.file_url || file.file);
        return (
          <div key={file.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3">
            <span className="truncate">{file.treeLabel}</span>
            {fileUrl && (
              <a
                href={fileUrl}
                download={isNifti ? fname : undefined}
                target={isNifti ? undefined : '_blank'}
                rel={isNifti ? undefined : 'noreferrer'}
                className="text-blue-600 font-semibold hover:underline shrink-0"
              >
                {isNifti ? 'Télécharger' : 'Ouvrir'}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );

  // Real sessions from backend
  const sessions = useMemo(() => {
    const list = patient?.segmentation_runs?.map(run => {
      const runner = run.doctor || patient.doctor || {};
      const fullName = runner.full_name || `${runner.prenom || ''} ${runner.nom || ''}`.trim() || runner.username || 'Médecin';
      
      return {
        id: run.id,
        run_id: run.id,
        session_num: `Rapport d'Analyse #${run.id}`,
        date: formatDate(run.created_at),
        time: new Date(run.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        author: fullName,
        role: runner.specialty || (runner.is_staff ? 'Administrateur' : 'Praticien'),
        is_new: run.status === 'running' || (new Date() - new Date(run.created_at)) < 86400000,
        has_3d_reconstruction: Boolean(run.has_3d_reconstruction),
        total_volume_mm3: run.total_volume_mm3 ?? null,
        model_key: run.model_key || 'unetpp',
        model_label: run.model_version || 'Modèle 1',
        groups: [
          {
            type: 'segmentation',
            label: 'Segmentation volumétrique',
            count: run.selected_count || 1,
            color: 'emerald',
            files: (run.results || []).map(res => ({
              name: res.mask_file,
              type: 'Mask',
              size: 'N/A',
              url: resolveFileUrl(res.mask_url)
            }))
          }
        ]
      };
    }) || [];
    return list;
  }, [patient]);

  const [activeTab, setActiveTab] = useState('dossier');

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-tight">Chargement du dossier clinique...</p>
      </div>
    </div>
  );

  if (error || !patient) return (
    <div className="p-10 max-w-2xl mx-auto">
      <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-slate-500 font-bold mb-6 hover:text-blue-600"><ArrowLeft className="w-4 h-4" /> Retour aux patients</button>
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-4">
        <AlertCircle className="w-6 h-6" /> {error || 'Patient introuvable.'}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1300px] mx-auto space-y-8 pb-12 font-['Inter']">
      {/* 1. Header */}
      <div className="relative group overflow-hidden">
        <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-slate-500 font-bold mb-6 hover:text-blue-600 transition-colors z-20 relative"><ArrowLeft className="w-4 h-4" /> Retour à la liste</button>
        
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl">
          <div className="h-48 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 absolute top-0 left-0 right-0 z-0"></div>
          
          <div className="relative z-10 p-8 pt-12">
            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border-[6px] border-white/20 flex items-center justify-center text-white text-4xl font-black shadow-2xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  {(patient.nom?.[0]||'').toUpperCase()}{(patient.prenom?.[0]||'').toUpperCase()}
                </div>
                <div className="mb-2">
                  <div className="flex items-center gap-3 mb-2.5">
                    <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{patient.nom} {patient.prenom}</h1>
                    <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider leading-none">ID: {patient.num_dossier}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-blue-100/70 text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      <Calendar className="w-3.5 h-3.5" /> Né le {formatDate(patient.date_naissance)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      <User className="w-3.5 h-3.5" /> {patient.sexe === 'M' ? 'Homme' : 'Femme'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[10px] uppercase font-bold tracking-wide">
                      <ShieldCheck className="w-3.5 h-3.5" /> Données Anonymisées
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mb-2">
                <button className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all"><Settings className="w-5 h-5" /></button>
                <button onClick={downloadPatientZip} disabled={zipDownloading} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50">
                  <Download className="w-4 h-4" /> {zipDownloading ? 'Preparation...' : 'Télécharger ZIP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Phone, label: 'Téléphone', value: patient.telephone || '-' },
          { icon: Mail, label: 'Email', value: patient.email || '-' },
          { icon: Stethoscope, label: 'Pathologie', value: patient.pathologie || '-' },
          { icon: FileText, label: 'Stade', value: patient.stade || '-' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <item.icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{item.label}</p>
            </div>
            <p className="text-sm text-slate-900 font-bold leading-none truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Onglets navigation ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'dossier',      label: 'Dossier clinique',    icon: FolderTree },
          { id: 'longitudinal', label: 'Suivi longitudinal',  icon: LineChart,  badge: patient?.segmentation_runs?.length > 1 ? '✦ Nouveau' : null },
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-200 ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. Chronology & Content Section */}
      {activeTab === 'longitudinal' ? (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 xl:col-span-8">
            <LongitudinalDashboard patientId={patient.id} patient={patient} />
          </div>
          <div className="col-span-12 xl:col-span-4 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Activity className="w-5 h-5"/></div>
                <h3 className="text-base font-black text-slate-900">À propos du suivi</h3>
              </div>
              <div className="space-y-3 text-[12px] text-slate-600 leading-relaxed">
                <p>Le suivi longitudinal analyse l'évolution du volume hippocampique à travers les examens successifs.</p>
                <p>Les volumes sont enregistrés automatiquement lors de la <strong>génération d'un rapport PDF</strong> de segmentation.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { color: 'bg-emerald-400', label: 'Zone verte — volume normal' },
                    { color: 'bg-amber-400',   label: 'Zone orange — atrophie légère' },
                    { color: 'bg-rose-400',    label: 'Zone rouge — atrophie sévère' },
                  ].map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${l.color}`}/>
                      <span className="text-[11px] font-semibold text-slate-600">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-12 gap-8 relative">
        {/* Timeline Side */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
            <ChronologyNav 
                patient={patient} 
                fileCount={files.length}
                totalBytes={totalBytes}
                onJump={(id) => {
                    const target = document.getElementById(id);
                    if (target) {
                        const offset = 140; // AppLayout (68) + ChronoNav (70)
                        const elementPosition = target.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - offset;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                }} 
                onDelete={async () => {
                   if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${patient.nom} ${patient.prenom} ? Cette action est irréversible.`)) {
                     try {
                        await api.delete(`/patients/${patient.id}/`);
                        navigate('/dashboard/patients');
                     } catch (err) {
                        console.error("Erreur lors de la suppression:", err);
                        alert("Une erreur est survenue lors de la suppression du dossier.");
                     }
                   }
                }}
            />

            <div id="baseline-start" className="flex items-center justify-between mb-2 scroll-mt-40">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Chronologie du dossier</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Du plus récent au plus ancien — le dossier initial sert de référence.</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Original</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nouveau</span></div>
                </div>
            </div>

            <div className="relative">
                <div className="timeline-line"></div>

                {/* Original Folder (Baseline) */}
                <div className="relative pl-12 pb-12">
                    <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
                        <div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg border-4 border-white"><Lock className="w-4 h-4" /></div>
                    </div>

                    <div className="bg-[#e9f0ff]/50 rounded-3xl border border-blue-200/60 shadow-sm overflow-hidden">
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-900 flex items-center justify-center text-white shadow-xl flex-shrink-0"><Lock className="w-8 h-8" /></div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-black text-blue-900">Dossier initial du patient</h3>
                                            <Badge type="darkBlue">Original</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-800/60 font-bold text-xs uppercase tracking-wider">
                                            Lecture seule • <HardDrive className="w-3 h-3" /> {formatSize(totalBytes)} • {files.length} fichiers
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-blue-100 shadow-sm">
                                        <Search className="w-3.5 h-3.5 text-blue-500" />
                                        <input type="text" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Chercher dans baseline..." className="bg-transparent border-none outline-none text-xs text-blue-900 placeholder-blue-300 w-32 md:w-48" />
                                    </div>
                                    <button onClick={() => setShowTree(!showTree)} className={`p-2 rounded-xl transition-all ${showTree ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'}`} title="Arborescence">
                                        <FolderTree className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Tree View Overlay */}
                            {showTree ? (
                                <div className="bg-white/80 p-6 rounded-2xl border border-white mb-6 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4"><FolderTree className="w-4 h-4 text-blue-600" /><h4 className="text-sm font-bold text-blue-900">Arborescence baseline</h4></div>
                                    <div className="max-h-96 overflow-auto pr-2">{renderTreeNode(folderTree)}</div>
                                </div>
                            ) : null}

                            {/* File Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(isBaselineExpanded ? filteredFiles : filteredFiles.slice(0, 4)).map((file, i) => (
                                    <div key={file.id} className="group relative flex items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white hover:border-blue-300 transition-all cursor-default overflow-hidden">
                                        <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors"><FileText className="w-5 h-5 text-blue-700" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-blue-950 text-sm leading-tight truncate">{file.original_filename || 'Fichier MRI'}</div>
                                            <div className="text-[10px] text-blue-600/60 font-bold uppercase mt-1 tracking-widest">{file.relative_path?.split('.').pop() || 'File'} • {formatSize(file.file_size)}</div>
                                        </div>
                                        <div className="absolute right-4 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                            {isNiftiFilename(file.original_filename) ? (
                                              <a href={niftiDownloadUrl(file.id)} download={file.original_filename || 'volume.nii.gz'} title="Télécharger (NIfTI)" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Download className="w-3.5 h-3.5" /></a>
                                            ) : (
                                              <>
                                                <a href={resolveFileUrl(file.file_url || file.file)} target="_blank" rel="noreferrer" title="Ouvrir" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></a>
                                                <a href={resolveFileUrl(file.file_url || file.file)} download={file.original_filename || undefined} title="Télécharger" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Download className="w-3.5 h-3.5" /></a>
                                              </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {filteredFiles.length === 0 && <div className="col-span-2 text-center py-10 bg-white/40 rounded-2xl border border-dashed border-blue-200 text-blue-400 italic text-sm">Aucun fichier ne correspond à votre recherche.</div>}
                            </div>

                            {filteredFiles.length > 4 && (
                                <button 
                                    onClick={() => setIsBaselineExpanded(!isBaselineExpanded)}
                                    className="w-full mt-6 py-3 rounded-2xl border-2 border-dashed border-blue-200/50 text-blue-600 font-bold text-xs uppercase tracking-widest hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isBaselineExpanded ? (
                                        <><ChevronDown className="w-4 h-4 rotate-180" /> Masquer les fichiers supplémentaires</>
                                    ) : (
                                        <><Plus className="w-4 h-4" /> Afficher les {filteredFiles.length - 4} fichiers restants</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Rapports archivés ── même structure timeline que baseline ── */}
                {(reports.length > 0 || reportsLoading) && (
                  <div className="relative pl-12 pb-6">
                    {/* Timeline dot */}
                    <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
                      <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-lg border-4 border-white">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Container — même style que baseline (teinte bleue) */}
                    <div className="bg-[#eff6ff]/60 rounded-3xl border border-blue-200/60 shadow-sm overflow-hidden">
                      <div className="p-6">

                        {/* Header */}
                        <div className="flex items-start gap-4 mb-5">
                          <div className="w-14 h-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white shadow-xl shrink-0">
                            <FileText className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-black text-blue-900">Rapports cliniques archivés</h3>
                              <span className="px-3 py-1 rounded-lg bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                                {reports.length} rapport{reports.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700/60 font-semibold uppercase tracking-wider">
                              Volumétrie · Recalage · PDF exportables
                            </p>
                          </div>
                        </div>

                        {reportsLoading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-blue-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                            Chargement des rapports…
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                            {reports.map((report) => {
                              let reportMeta = null;
                              try { reportMeta = JSON.parse(report.doctor_conclusion); } catch {}
                              const isRecalage = reportMeta?.type === 'recalage';
                              const iconBg  = isRecalage ? 'bg-emerald-600' : 'bg-blue-600';
                              const badgeCls = isRecalage
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-blue-50 border-blue-100 text-blue-600';

                              return (
                                <div key={report.id}
                                  className="group flex items-center gap-4 bg-white/80 px-5 py-4 rounded-2xl border border-white hover:border-blue-300 hover:shadow-sm transition-all">
                                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
                                    <FileText className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="text-sm font-bold text-slate-800">
                                        {isRecalage ? 'Rapport de recalage' : 'Rapport de volumétrie'}
                                      </p>
                                      {isRecalage && reportMeta?.mode && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                                          Recalage {reportMeta.mode}{reportMeta.mi_quality ? ` · ${reportMeta.mi_quality}` : ''}
                                        </span>
                                      )}
                                      {!isRecalage && report.run_id && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                                          Segmentation #{report.run_id}
                                        </span>
                                      )}
                                      {/* Badge modèle IA */}
                                      {!isRecalage && report.model_key && (() => {
                                        const mCfg = { unetpp: { cls: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Modèle 1' }, nnunet: { cls: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Modèle 2' }, swinunetr: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Modèle 3' } }[report.model_key] || { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: report.model_label || report.model_key };
                                        return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${mCfg.cls}`}>{mCfg.label}</span>;
                                      })()}
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                      <Calendar className="inline h-3 w-3 mr-1" />
                                      {report.created_at} · Dr. {report.doctor_name}
                                    </p>
                                  </div>
                                  {report.file_url && (
                                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <a href={report.file_url} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                        <Eye className="h-3.5 w-3.5" /> Voir
                                      </a>
                                      <a href={report.file_url} target="_blank" rel="noreferrer" download
                                        className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                        <Download className="h-3.5 w-3.5" /> PDF
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ RÉSULTATS CLINIQUES — section unifiée ══ */}
                <ResultsSection
                  sessions={sessions}
                  analysisFiles={analysisFiles}
                  resolveFileUrl={resolveFileUrl}
                  formatDate={formatDate}
                  formatSize={formatSize}
                />
            </div>
        </div>

        {/* Sidebar Side */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600"><Activity className="w-5 h-5" /></div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Statistiques rapides</h3>
                </div>
                
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Volume total</p>
                        <p className="text-xl font-black text-slate-900">{formatSize(totalBytes)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Baseline</p>
                            <p className="text-xl font-black text-blue-900">{files.length}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Analyses</p>
                            <p className="text-xl font-black text-emerald-900">{sessions.length}</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Légende des couleurs</p>
                        <div className="space-y-2">
                             {[
                                { color: '#1e3a8a', label: 'Baseline / Original' },
                                { color: '#c084fc', label: 'Recalage d\'images' },
                                { color: '#34d399', label: 'Segmentation volumétrique' },
                                { color: '#fb923c', label: 'Reconstruction 3D' }
                             ].map((l, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }}></div>
                                    <span className="text-[11px] font-bold text-slate-600 tracking-tight">{l.label}</span>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>
            </div>


        </div>
      </div>
      )}
    </div>
  );
}
