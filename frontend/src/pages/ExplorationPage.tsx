import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import BrodmannIdentificationView from '../components/BrodmannIdentificationView';
import BrodmannZone3D from '../components/BrodmannZone3D';

interface ImageTransform {
  offsetX: number; offsetY: number; scale: number;
  baseScale: number; imageWidth: number; imageHeight: number;
}
interface ViewTransform { scale: number; panX: number; panY: number; }
interface SliceShape { x: number; y: number; z: number; }

const DEFAULT_VIEW: ViewTransform = { scale: 1, panX: 0, panY: 0 };

// ── Brodmann areas catalogue ───────────────────────────────────────────────────
const BRODMANN_AREAS = [
  { id: 1,  name: 'Somatosensoriel I',        group: 'Pariétal' },
  { id: 2,  name: 'Somatosensoriel II',       group: 'Pariétal' },
  { id: 3,  name: 'Somatosensoriel III',      group: 'Pariétal' },
  { id: 4,  name: 'Moteur Primaire',          group: 'Frontal' },
  { id: 5,  name: 'Somatosensoriel Assoc.',   group: 'Pariétal' },
  { id: 6,  name: 'Prémoteur / AMS',          group: 'Frontal' },
  { id: 7,  name: 'Pariétal Supérieur',       group: 'Pariétal' },
  { id: 8,  name: 'Champs Oculomoteurs',      group: 'Frontal' },
  { id: 9,  name: 'Préfrontal DL',            group: 'Frontal' },
  { id: 10, name: 'Préfrontal Antérieur',     group: 'Frontal' },
  { id: 11, name: 'Orbitofrontal',            group: 'Frontal' },
  { id: 12, name: 'Orbitofrontal Médian',     group: 'Frontal' },
  { id: 13, name: 'Insula',                   group: 'Insulaire' },
  { id: 14, name: 'Insula Ventrale',          group: 'Insulaire' },
  { id: 15, name: 'Temporal Antérieur',       group: 'Temporal' },
  { id: 16, name: 'Insula Post.',             group: 'Insulaire' },
  { id: 17, name: 'Visuel Primaire (V1)',     group: 'Occipital' },
  { id: 18, name: 'Visuel Secondaire (V2)',   group: 'Occipital' },
  { id: 19, name: 'Visuel Associatif',        group: 'Occipital' },
  { id: 20, name: 'Temporal Inférieur',       group: 'Temporal' },
  { id: 21, name: 'Temporal Moyen',           group: 'Temporal' },
  { id: 22, name: 'Wernicke',                 group: 'Temporal' },
  { id: 23, name: 'Cingulaire Post. Ventral', group: 'Cingulaire' },
  { id: 24, name: 'Cingulaire Ant. Ventral',  group: 'Cingulaire' },
  { id: 25, name: 'Subgénual',               group: 'Cingulaire' },
  { id: 26, name: 'Ectosplénal',             group: 'Cingulaire' },
  { id: 27, name: 'Piriforme',               group: 'Temporal' },
  { id: 28, name: 'Entorhinal',              group: 'Temporal' },
  { id: 29, name: 'Cingulaire Rétrosplénial',group: 'Cingulaire' },
  { id: 30, name: 'Cingulaire Partie',        group: 'Cingulaire' },
  { id: 31, name: 'Cingulaire Post. Dorsal',  group: 'Cingulaire' },
  { id: 32, name: 'Cingulaire Ant. Dorsal',   group: 'Cingulaire' },
  { id: 33, name: 'Cingulaire Ant. Part.',    group: 'Cingulaire' },
  { id: 34, name: 'Entorhinal Dorsal',        group: 'Temporal' },
  { id: 35, name: 'Périrhinal',               group: 'Temporal' },
  { id: 36, name: 'Ectorhinal',               group: 'Temporal' },
  { id: 37, name: 'Fusiforme',                group: 'Temporal' },
  { id: 38, name: 'Temporal Polaire',         group: 'Temporal' },
  { id: 39, name: 'Gyrus Angulaire',          group: 'Pariétal' },
  { id: 40, name: 'Supramarginal',            group: 'Pariétal' },
  { id: 41, name: 'Auditif Primaire',         group: 'Temporal' },
  { id: 42, name: 'Auditif Secondaire',       group: 'Temporal' },
  { id: 43, name: 'Gustatif Primaire',        group: 'Pariétal' },
  { id: 44, name: 'Broca (pars opercularis)', group: 'Frontal' },
  { id: 45, name: 'Broca (pars triangularis)',group: 'Frontal' },
  { id: 46, name: 'Préfrontal Dorsolatéral',  group: 'Frontal' },
  { id: 47, name: 'Frontal Inférieur Orb.',   group: 'Frontal' },
];

const GROUP_COLORS: Record<string, string> = {
  Frontal:    'text-blue-500',
  Pariétal:   'text-emerald-500',
  Temporal:   'text-amber-500',
  Occipital:  'text-violet-500',
  Cingulaire: 'text-rose-500',
  Insulaire:  'text-cyan-500',
};

// ── Right panel tab type ───────────────────────────────────────────────────────
type RightTab = 'zones' | '3d';

export default function ExplorationPage() {
  const [jobId, setJobId]           = useState('');
  const [axis, setAxis]             = useState('axial');
  const [index, setIndex]           = useState(0);
  const [maxIndex, setMaxIndex]     = useState(0);
  const [sliceShape, setSliceShape] = useState<SliceShape | null>(null);

  const [refSrc, setRefSrc]         = useState('');
  const [patSrc, setPatSrc]         = useState('');
  const [refView, setRefView]       = useState<ViewTransform>(DEFAULT_VIEW);
  const [patView, setPatView]       = useState<ViewTransform>(DEFAULT_VIEW);

  const [zone, setZone]                             = useState<any>(null);
  const [insideBrain, setInsideBrain]               = useState(false);
  const [hasBrodmannAttempt, setHasBrodmannAttempt] = useState(false);
  const [mniCoords, setMniCoords]                   = useState<any>(null);
  const [brodmannTooltip, setBrodmannTooltip]       = useState<{
    panel: 'reference' | 'patient'; x: number; y: number;
    insideBrain: boolean; zoneId?: number; zoneName?: string;
  } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [isPanning, setIsPanning]   = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [rightTab, setRightTab]     = useState<RightTab>('zones');

  const refCanvasRef = useRef<HTMLCanvasElement>(null);
  const patCanvasRef = useRef<HTMLCanvasElement>(null);
  const refTransformRef = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const patTransformRef = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const brodmannTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Noms réels des zones depuis l'atlas backend (Harvard-Oxford)
  const [atlasZoneNames, setAtlasZoneNames] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch('/api/volume/cortical-zones', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.zones) return;
        const map: Record<number, string> = {};
        (data.zones as { id: number; name: string }[]).forEach(z => { map[z.id] = z.name; });
        setAtlasZoneNames(map);
      })
      .catch(() => {});
  }, []);

  // Auto-switch right panel to 3D when a zone is detected
  useEffect(() => {
    if (zone?.id) setRightTab('3d');
  }, [zone?.id]);

  // ── Drawing ─────────────────────────────────────────────────────────────────
  const drawCanvas = useCallback((type: 'reference' | 'patient') => {
    const canvas = type === 'reference' ? refCanvasRef.current : patCanvasRef.current;
    const src    = type === 'reference' ? refSrc : patSrc;
    const tRef   = type === 'reference' ? refTransformRef : patTransformRef;
    const view   = type === 'reference' ? refView : patView;
    if (!canvas || !src) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const container = canvas.parentElement;
      if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const baseScale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.92;
      const baseOffX  = (canvas.width  - img.width  * baseScale) / 2;
      const baseOffY  = (canvas.height - img.height * baseScale) / 2;
      const finalScale = baseScale * view.scale;
      const finalOffX  = baseOffX + view.panX;
      const finalOffY  = baseOffY + view.panY;
      tRef.current = { offsetX: finalOffX, offsetY: finalOffY, scale: finalScale, baseScale, imageWidth: img.width, imageHeight: img.height };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 24;
      ctx.drawImage(img, finalOffX, finalOffY, img.width * finalScale, img.height * finalScale);
      ctx.restore();
    };
    img.src = src;
  }, [refSrc, patSrc, refView, patView]);

  useEffect(() => { drawCanvas('reference'); }, [drawCanvas]);
  useEffect(() => { drawCanvas('patient');   }, [drawCanvas]);

  // ── Slice fetching ───────────────────────────────────────────────────────────
  const getAxisMax = (axisKey: string) => {
    if (sliceShape) {
      if (axisKey === 'axial')    return Math.max(0, sliceShape.z - 1);
      if (axisKey === 'coronal')  return Math.max(0, sliceShape.y - 1);
      if (axisKey === 'sagittal') return Math.max(0, sliceShape.x - 1);
    }
    return maxIndex;
  };

  const syncViews = async (nextAxis: string, nextIndex: number, jId: string) => {
    if (!jId) return;
    try {
      const axisMax = getAxisMax(nextAxis);
      const clamped = Math.max(0, Math.min(nextIndex, axisMax || 999));
      const atlasUrl = `/api/volume/atlas_slice?axis=${nextAxis}&index=${clamped}&showLabels=1&jobId=${jId}`;
      const patUrl   = `/api/volume/patient_slice?jobId=${jId}&axis=${nextAxis}&index=${clamped}`;
      const [r1, r2] = await Promise.all([
        fetch(atlasUrl, { credentials: 'include' }).then(r => r.json()),
        fetch(patUrl,   { credentials: 'include' }).then(r => r.json()),
      ]);
      if (r1.image || r1.slice) setRefSrc(r1.image || r1.slice);
      if (r2.image) setPatSrc(r2.image);
      const rm = typeof r1.max_index === 'number' ? r1.max_index : null;
      const pm = typeof r2.max_index === 'number' ? r2.max_index : null;
      let resolvedMax = axisMax;
      if (rm !== null && pm !== null) resolvedMax = Math.min(rm, pm);
      else if (pm !== null) resolvedMax = pm;
      else if (rm !== null) resolvedMax = rm;
      setMaxIndex(resolvedMax);
      setIndex(Math.max(0, Math.min(clamped, resolvedMax)));
      setAxis(nextAxis);
      if (r2.shape) setSliceShape(r2.shape);
      else if (r1.shape) setSliceShape(r1.shape);
    } catch (err) {
      console.error('syncViews error:', err);
    }
  };

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const jId = sessionStorage.getItem('volumeJobId') || '';
    setJobId(jId);
    setLoading(true);
    syncViews('axial', 0, jId).finally(() => setLoading(false));
    return () => {
      if (brodmannTimerRef.current) clearTimeout(brodmannTimerRef.current);
    };
  }, []);

  // ── Click identification ─────────────────────────────────────────────────────
  const getImageRatioFromClick = (e: React.MouseEvent<HTMLCanvasElement>, type: 'reference' | 'patient') => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (type === 'reference' ? refTransformRef : patTransformRef).current;
    if (!t.imageWidth || !t.imageHeight || t.scale <= 0) return null;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const imgX = (localX - t.offsetX) / t.scale;
    const imgY = (localY - t.offsetY) / t.scale;
    if (imgX < 0 || imgY < 0 || imgX > t.imageWidth || imgY > t.imageHeight) return null;
    return {
      xRatio: imgX / Math.max(1, t.imageWidth - 1),
      yRatio: imgY / Math.max(1, t.imageHeight - 1),
    };
  };

  const handleBrodmannClick = async (e: React.MouseEvent<HTMLCanvasElement>, type: 'reference' | 'patient') => {
    if (!jobId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const showTooltip = (payload: { insideBrain: boolean; zoneId?: number; zoneName?: string }) => {
      const tooltipW = 230, tooltipH = 72, edge = 12;
      let tooltipX = clickX + 14;
      if (tooltipX + tooltipW > rect.width - edge) tooltipX = clickX - tooltipW - 14;
      tooltipX = Math.max(edge, Math.min(tooltipX, rect.width - tooltipW - edge));
      let tooltipY = clickY - tooltipH - 10;
      if (tooltipY < edge) tooltipY = clickY + 12;
      tooltipY = Math.max(edge, Math.min(tooltipY, rect.height - tooltipH - edge));
      if (brodmannTimerRef.current) clearTimeout(brodmannTimerRef.current);
      setBrodmannTooltip({ panel: type, x: tooltipX, y: tooltipY, ...payload });
      brodmannTimerRef.current = setTimeout(() => setBrodmannTooltip(null), 3000);
    };

    const ratios = getImageRatioFromClick(e, type);
    if (!ratios) {
      setHasBrodmannAttempt(true);
      setZone(null); setInsideBrain(false); setMniCoords(null);
      showTooltip({ insideBrain: false });
      return;
    }
    setHasBrodmannAttempt(true);
    try {
      const res = await fetch(
        `/api/volume/brodmann?jobId=${jobId}&axis=${axis}&index=${index}&xRatio=${ratios.xRatio}&yRatio=${ratios.yRatio}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setZone(data.zone || null);
      setInsideBrain(!!data.insideBrain);
      setMniCoords(data.mni_coords ?? null);
      showTooltip({ insideBrain: Boolean(data.insideBrain && data.zone), zoneId: data.zone?.id, zoneName: data.zone?.name });
      if (data.images?.atlas) setRefSrc(data.images.atlas);
      if (data.images?.patient) setPatSrc(data.images.patient);
    } catch {
      // silent
    }
  };

  // ── Pan/Zoom ─────────────────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>, type: 'reference' | 'patient') => {
    e.preventDefault();
    const sv = type === 'reference' ? setRefView : setPatView;
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    sv(p => ({ ...p, scale: Math.min(Math.max(p.scale * f, 0.3), 10) }));
  };
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, type: 'reference' | 'patient') => {
    if (!isPanning) return;
    const sv = type === 'reference' ? setRefView : setPatView;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    sv(p => ({ ...p, panX: p.panX + dx, panY: p.panY + dy }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsPanning(false);

  const axisOptions = [
    { key: 'axial',    label: 'Axial' },
    { key: 'coronal',  label: 'Coronal' },
    { key: 'sagittal', label: 'Sagittal' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#f0f4f8] text-slate-800 overflow-hidden select-none" onMouseUp={handleMouseUp}>

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-3 shadow-sm z-20">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-500">Exploration Corticale</p>
          <h1 className="text-sm font-black tracking-tight text-slate-900 leading-tight">
            Identification des Aires de Brodmann
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Atlas Référence</p>
            <p className="text-[11px] font-black text-blue-900">MNI152 — Harvard-Oxford</p>
          </div>
        </div>
      </header>

      {/* ── 3-column body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT STRIP — Zone description */}
        <aside className="w-48 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
              Description de zone
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <BrodmannIdentificationView
              zone={zone}
              insideBrain={insideBrain}
              hasAttempt={hasBrodmannAttempt}
              mniCoords={mniCoords}
              className="h-full"
            />
          </div>
        </aside>

        {/* CENTER — Canvases + navigation */}
        <main className="flex-1 flex flex-col gap-3 p-3 min-w-0 overflow-hidden">

          {/* Canvases */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">

            {/* Atlas */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0f1d] border border-slate-200 shadow-md">
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-600/20 px-3 py-1 backdrop-blur-md">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Atlas de référence</span>
              </div>
              <canvas
                ref={refCanvasRef}
                onClick={e => handleBrodmannClick(e, 'reference')}
                onWheel={e => handleWheel(e, 'reference')}
                onMouseDown={handleMouseDown}
                onMouseMove={e => handleMouseMove(e, 'reference')}
                className="w-full h-full cursor-crosshair"
              />
              {brodmannTooltip?.panel === 'reference' && (
                <div className="pointer-events-none absolute z-20 w-[220px]" style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}>
                  <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md">
                    {brodmannTooltip.insideBrain ? (
                      <>
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Zone détectée</p>
                        <p className="mt-0.5 text-[11px] font-black text-slate-900">
                          BA {brodmannTooltip.zoneId ?? '--'} — {brodmannTooltip.zoneName || 'Zone corticale'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Hors cerveau</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">Aucune aire Brodmann ici</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Patient */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0f1d] border border-slate-200 shadow-md">
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-600/20 px-3 py-1 backdrop-blur-md">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Patient recalé</span>
              </div>
              <canvas
                ref={patCanvasRef}
                onClick={e => handleBrodmannClick(e, 'patient')}
                onWheel={e => handleWheel(e, 'patient')}
                onMouseDown={handleMouseDown}
                onMouseMove={e => handleMouseMove(e, 'patient')}
                className="w-full h-full cursor-crosshair"
              />
              {brodmannTooltip?.panel === 'patient' && (
                <div className="pointer-events-none absolute z-20 w-[220px]" style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}>
                  <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md">
                    {brodmannTooltip.insideBrain ? (
                      <>
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Zone détectée</p>
                        <p className="mt-0.5 text-[11px] font-black text-slate-900">
                          BA {brodmannTooltip.zoneId ?? '--'} — {brodmannTooltip.zoneName || 'Zone corticale'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Hors cerveau</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">Aucune aire Brodmann ici</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation bar */}
          <div className="shrink-0 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 shadow-sm">
            {/* Axis buttons */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {axisOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { const mid = Math.floor(getAxisMax(key) / 2); void syncViews(key, mid, jobId); }}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    axis === key
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Navigation coupe</span>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                  {index + 1} / {maxIndex + 1}
                </span>
              </div>
              <input
                type="range" min={0} max={maxIndex} value={index}
                onChange={e => { void syncViews(axis, Number(e.target.value), jobId); }}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Prev/Next */}
            <div className="flex gap-1.5">
              <button
                onClick={() => { void syncViews(axis, Math.max(0, index - 1), jobId); }}
                disabled={index <= 0}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button
                onClick={() => { void syncViews(axis, Math.min(maxIndex, index + 1), jobId); }}
                disabled={index >= maxIndex}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT STRIP — Zones list + 3D */}
        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">

          {/* Tab selector */}
          <div className="flex shrink-0 border-b border-slate-100">
            <button
              onClick={() => setRightTab('zones')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition ${
                rightTab === 'zones'
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Zones BA
            </button>
            <button
              onClick={() => setRightTab('3d')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1 ${
                rightTab === '3d'
                  ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              3D
              {zone?.id && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />}
            </button>
          </div>

          {/* Zones list */}
          {rightTab === 'zones' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">

              {/* Header stats */}
              <div className="px-3 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aires de Brodmann</span>
                  <span className="bg-slate-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{BRODMANN_AREAS.length}</span>
                </div>
                {/* Légende groupes */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(GROUP_COLORS).map(([grp, cls]) => (
                    <span key={grp} className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full border ${cls} border-current opacity-70`}>
                      {grp}
                    </span>
                  ))}
                </div>
              </div>

              {/* Liste */}
              <div className="py-1">
                {BRODMANN_AREAS.map((area) => {
                  const isActive = zone?.id === area.id;
                  // Nom réel depuis l'atlas backend, fallback sur nom hardcodé
                  const displayName = atlasZoneNames[area.id] || area.name;
                  const groupColor = GROUP_COLORS[area.group] || 'text-slate-400';
                  const groupBg: Record<string, string> = {
                    Frontal:    'bg-blue-50',
                    Pariétal:   'bg-emerald-50',
                    Temporal:   'bg-amber-50',
                    Occipital:  'bg-violet-50',
                    Cingulaire: 'bg-rose-50',
                    Insulaire:  'bg-cyan-50',
                  };
                  const groupDot: Record<string, string> = {
                    Frontal:    'bg-blue-400',
                    Pariétal:   'bg-emerald-400',
                    Temporal:   'bg-amber-400',
                    Occipital:  'bg-violet-400',
                    Cingulaire: 'bg-rose-400',
                    Insulaire:  'bg-cyan-400',
                  };
                  return (
                    <div
                      key={area.id}
                      className={`relative mx-2 my-0.5 rounded-lg px-2.5 py-2 transition-all cursor-default ${
                        isActive
                          ? 'bg-blue-600 shadow-md shadow-blue-200'
                          : `hover:${groupBg[area.group] || 'bg-slate-50'} hover:shadow-sm`
                      }`}
                    >
                      {/* Trait coloré gauche */}
                      {!isActive && (
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full ${groupDot[area.group] || 'bg-slate-300'}`} />
                      )}

                      <div className="flex items-center gap-2">
                        {/* Numéro BA */}
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black
                          ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {area.id}
                        </span>

                        {/* Nom + groupe */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] font-bold leading-tight truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>
                            {displayName}
                          </p>
                          <p className={`text-[8px] font-medium mt-0.5 ${isActive ? 'text-blue-200' : groupColor}`}>
                            {area.group}
                          </p>
                        </div>

                        {/* Indicateur actif */}
                        {isActive && (
                          <span className="shrink-0 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3D visualization */}
          {rightTab === '3d' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {zone && (
                <div className="px-3 py-2 border-b border-slate-100 shrink-0">
                  <p className="text-[9px] font-black text-slate-700 truncate">BA {zone.id} — {zone.name}</p>
                </div>
              )}
              <div className="flex-1 min-h-0 bg-[#0a0f1d]">
                <BrodmannZone3D
                  labelId={zone?.id ?? null}
                  zoneName={zone?.name}
                  className="h-full"
                />
              </div>
            </div>
          )}

          {/* Validate button */}
          <div className="shrink-0 p-3 border-t border-slate-100 bg-white">
            <button className="w-full py-2.5 rounded-xl bg-blue-600 text-[11px] font-black uppercase tracking-widest text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-all">
              Valider Aire
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}
