// ================================================================
// RegistrationPage.tsx — Version corrigée (3 bugs fixés)
// ================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowDown, Upload, X, Eye, Download, Trash2, Check,
  MousePointer2, ZoomIn, ZoomOut, RotateCcw, Layers, Keyboard, BrainCircuit, Undo2
} from 'lucide-react';
import RegistrationModeSelector from '../components/RegistrationModeSelector';
import AutoAlignOverlay from '../components/AutoAlignOverlay';
import BrodmannIdentificationView from '../components/BrodmannIdentificationView';
import OrientationPanel from '../components/viewer/OrientationPanel';

type Page = string;
interface User { username: string; fullName?: string; full_name?: string; specialty?: string; }
interface RegistrationPageProps { user: User; accessToken: string | null; onNavigate: (page: Page) => void; }
interface Point { x: number; y: number; id: number; }
interface ImageTransform { offsetX: number; offsetY: number; scale: number; baseScale: number; imageWidth: number; imageHeight: number; }
interface ViewTransform { scale: number; panX: number; panY: number; }
interface ImageState { src: string; points: Point[]; }
interface SliceShape { x: number; y: number; z: number; }
interface SuggestedSlice { axis: 'axial' | 'coronal' | 'sagittal'; index: number; }
interface CorticalZoneItem { id: number; name: string; }
type AtlasSourceOption = 'official' | 'custom';
type RegistrationDimension = '2d' | '3d';
interface OrientationState { rotation: number; flipH: boolean; flipV: boolean; }

const POINT_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];
const DEFAULT_VIEW: ViewTransform = { scale: 1, panX: 0, panY: 0 };

export function RegistrationPage({ user, accessToken, onNavigate }: RegistrationPageProps) {
  const [registrationDimension, setRegistrationDimension] = useState<RegistrationDimension | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageState>({ src: '', points: [] });
  const [patientImage, setPatientImage]     = useState<ImageState>({ src: '', points: [] });
  const [uploadedFiles, setUploadedFiles]   = useState<{ ref?: File; patient?: File }>({});
  const [activeImage, setActiveImage]       = useState<'reference' | 'patient'>('reference');
  const [showResult, setShowResult]         = useState(false);
  const [phase, setPhase]                   = useState<1 | 2 | 3>(1);
  const [nextPointId, setNextPointId]       = useState(1);
  const [alphaBlending, setAlphaBlending]   = useState(50);
  const [visMode, setVisMode]               = useState<'overlay' | 'split' | 'heatmap'>('split');
  const [splitPos, setSplitPos]             = useState(50);
  const [showMagnifier, setShowMagnifier]   = useState(false);
  const [magnifierPos, setMagnifierPos]     = useState({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts]   = useState(false);
  const [showGrid, setShowGrid]             = useState(true);
  const [gridSize, setGridSize]             = useState(32);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'manual' | 'mine'>('manual');
  const [cameFromMINE, setCameFromMINE]     = useState(false);
  const [autoAlignStatus, setAutoAlignStatus] = useState<'idle'|'processing'|'success'|'error'>('idle');
  const [autoAlignMetrics, setAutoAlignMetrics] = useState<any>(null);
  const [autoAlignError, setAutoAlignError] = useState('');
  const [jobId, setJobId]                   = useState('');
  const [refView, setRefView]               = useState<ViewTransform>(DEFAULT_VIEW);
  const [patView, setPatView]               = useState<ViewTransform>(DEFAULT_VIEW);
  
  // 3D Navigation
  const [axis, setAxis]                     = useState('axial');
  const [index, setIndex]                   = useState(0);
  const [maxIndex, setMaxIndex]             = useState(0);
  const [sliceShape, setSliceShape]         = useState<SliceShape | null>(null);
  const [suggestedSlice, setSuggestedSlice] = useState<SuggestedSlice | null>(null);
  const [sliceConfirmed, setSliceConfirmed] = useState(false);
  const [atlasSliceConfirmed, setAtlasSliceConfirmed] = useState(false);
  const [sliceLoading, setSliceLoading]     = useState(false);
  const [sliceError, setSliceError]         = useState('');
  const [atlasSliceError, setAtlasSliceError] = useState('');
  const [zone, setZone]                     = useState<any>(null);
  const [availableCorticalZones, setAvailableCorticalZones] = useState<CorticalZoneItem[]>([]);
  const [insideBrain, setInsideBrain]       = useState(false);
  const [hasBrodmannAttempt, setHasBrodmannAttempt] = useState(false);
  const [atlasSource, setAtlasSource]       = useState<AtlasSourceOption>('official');
  const [showPatientOrientation, setShowPatientOrientation] = useState(false);
  const [patientOrientation, setPatientOrientation] = useState<OrientationState>({ rotation: 0, flipH: false, flipV: false });

  const [isPanning, setIsPanning]           = useState(false);
  const [lastMousePos, setLastMousePos]     = useState({ x: 0, y: 0 });
  const [ripples, setRipples]               = useState<{ x: number; y: number; id: number }[]>([]);
  const [resultImages, setResultImages]     = useState<{ ref: string; pat: string } | null>(null);
  const [pendingShowResult, setPendingShowResult] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [loadingCorticalZones, setLoadingCorticalZones] = useState(false);
  const [brodmannTooltip, setBrodmannTooltip] = useState<{
    panel: 'reference' | 'patient';
    x: number;
    y: number;
    insideBrain: boolean;
    zoneId?: number;
    zoneName?: string;
  } | null>(null);

  const refCanvasRef       = useRef<HTMLCanvasElement>(null);
  const patCanvasRef       = useRef<HTMLCanvasElement>(null);
  const resultRefCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultPatCanvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultVisualRef    = useRef<HTMLDivElement>(null);
  const patientVolumeInputRef = useRef<HTMLInputElement>(null);
  const atlasVolumeInputRef = useRef<HTMLInputElement>(null);
  const brodmannTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const patTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const sliceFetchSeqRef   = useRef(0);
  const sliceDebounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPatientOrientationToScreen = useCallback((sx: number, sy: number, t: ImageTransform) => {
    const w = t.imageWidth * t.scale;
    const h = t.imageHeight * t.scale;
    const cx = t.offsetX + w / 2;
    const cy = t.offsetY + h / 2;

    const rad = (patientOrientation.rotation * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const signX = patientOrientation.flipH ? -1 : 1;
    const signY = patientOrientation.flipV ? -1 : 1;

    let dx = sx - cx;
    let dy = sy - cy;
    dx *= signX;
    dy *= signY;

    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    return { x: cx + rx, y: cy + ry };
  }, [patientOrientation]);

  const invertPatientOrientationFromScreen = useCallback((sx: number, sy: number, t: ImageTransform) => {
    const w = t.imageWidth * t.scale;
    const h = t.imageHeight * t.scale;
    const cx = t.offsetX + w / 2;
    const cy = t.offsetY + h / 2;

    const rad = (patientOrientation.rotation * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const signX = patientOrientation.flipH ? -1 : 1;
    const signY = patientOrientation.flipV ? -1 : 1;

    const dx = sx - cx;
    const dy = sy - cy;
    const ux = dx * c + dy * s;
    const uy = -dx * s + dy * c;
    return { x: cx + ux * signX, y: cy + uy * signY };
  }, [patientOrientation]);

  // ✅ Fonction manquante — handleImageUpload
  const handleImageUpload = (file: File, type: 'reference' | 'patient') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (type === 'reference') {
        setReferenceImage({ src, points: [] });
        setRefView(DEFAULT_VIEW);
        setUploadedFiles(p => ({ ...p, ref: file }));
      } else {
        setPatientImage({ src, points: [] });
        setPatView(DEFAULT_VIEW);
        setUploadedFiles(p => ({ ...p, patient: file }));
      }
      setPhase(2); // Auto-switch to phase 2 when images are coming
    };
    reader.readAsDataURL(file);
  };

  // Auto-load atlas + patient test when page opens
  useEffect(() => {
    if (registrationDimension !== '3d') return;
    let alive = true;
    const bootstrapDefaultVolumes = async () => {
      if (referenceImage.src || patientImage.src) return;
      try {
        const atlasRes = await fetch('/api/volume/atlas_slice?axis=axial');
        if (!atlasRes.ok) return;
        const atlasData = await atlasRes.json();

        let nextJobId = sessionStorage.getItem('volumeJobId') || '';
        let patientData: any = null;
        const nextIndex = typeof atlasData.index === 'number' ? atlasData.index : 0;

        if (nextJobId) {
          const patientRes = await fetch(`/api/volume/get-slice?jobId=${nextJobId}&axis=axial&index=${nextIndex}`);
          if (patientRes.ok) {
            patientData = await patientRes.json();
          } else {
            nextJobId = '';
            sessionStorage.removeItem('volumeJobId');
          }
        }

        if (!nextJobId) {
          const demoRes = await fetch('/api/volume/load-demo', { method: 'POST' });
          if (demoRes.ok) {
            const demoData = await demoRes.json();
            nextJobId = demoData.jobId || '';
            if (nextJobId) sessionStorage.setItem('volumeJobId', nextJobId);
            patientData = {
              image: demoData.median_slice,
              index: demoData.z,
              max_index: demoData.max_z,
            };
          }
        }

        if (!alive) return;

        if (atlasData.image) {
          setReferenceImage({ src: atlasData.image, points: [] });
          setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
        }
        if (patientData?.slice || patientData?.image) {
          setPatientImage({ src: patientData.slice || patientData.image, points: [] });
        }
        if (nextJobId) {
          setJobId(nextJobId);
        }

        setIndex(typeof patientData?.index === 'number' ? patientData.index : nextIndex);
        setMaxIndex(
          typeof atlasData.max_index === 'number'
            ? atlasData.max_index
            : (typeof patientData?.max_index === 'number' ? patientData.max_index : 0)
        );

        if (atlasData.image && (patientData?.slice || patientData?.image)) {
          setPhase(2);
        }
      } catch (err) {
        console.error('Auto volume bootstrap failed:', err);
      }
    };

    bootstrapDefaultVolumes();
    return () => { alive = false; };
  }, [registrationDimension]);

  // Upload
  useEffect(() => {
    const run = async () => {
      if (!uploadedFiles.ref || !uploadedFiles.patient || jobId) return;
      try {
        const fd = new FormData();
        fd.append('ref_image', uploadedFiles.ref);
        fd.append('patient_image', uploadedFiles.patient);
        fd.append('patient_id', 'patient_' + Date.now());
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) { const d = await res.json(); setJobId(d.jobId); }
      } catch (err: any) {
        console.error('❌ Upload failed:', err);
        setAutoAlignError("Échec de l'envoi des images au serveur. Vérifiez votre connexion.");
        setAutoAlignStatus('error');
      }
    };
    run();
  }, [uploadedFiles, jobId]);

  // Draw canvas
  const drawCanvas = useCallback((type: 'reference' | 'patient') => {
    const canvas   = type === 'reference' ? refCanvasRef.current : patCanvasRef.current;
    const imgState = type === 'reference' ? referenceImage : patientImage;
    const tRef     = type === 'reference' ? refTransformRef : patTransformRef;
    const view     = type === 'reference' ? refView : patView;
    if (!canvas || !imgState.src) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const container = canvas.parentElement;
      if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const baseScale  = Math.min(canvas.width/img.width, canvas.height/img.height) * 0.88;
      const baseOffX   = (canvas.width  - img.width  * baseScale) / 2;
      const baseOffY   = (canvas.height - img.height * baseScale) / 2;
      const finalScale = baseScale * view.scale;
      const finalOffX  = baseOffX + view.panX;
      const finalOffY  = baseOffY + view.panY;
      tRef.current = { offsetX: finalOffX, offsetY: finalOffY, scale: finalScale, baseScale, imageWidth: img.width, imageHeight: img.height };
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=24;
      if (type === 'patient' && (patientOrientation.rotation !== 0 || patientOrientation.flipH || patientOrientation.flipV)) {
        const w = img.width * finalScale;
        const h = img.height * finalScale;
        const cx = finalOffX + w / 2;
        const cy = finalOffY + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((patientOrientation.rotation * Math.PI) / 180);
        ctx.scale(patientOrientation.flipH ? -1 : 1, patientOrientation.flipV ? -1 : 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(img, finalOffX, finalOffY, img.width*finalScale, img.height*finalScale);
      }
      ctx.restore();

      const shouldDrawGrid = phase === 2 && registrationMode === 'manual' && showGrid;
      if (shouldDrawGrid) {
        const imageWidthPx = img.width * finalScale;
        const imageHeightPx = img.height * finalScale;
        const majorEvery = 4;
        const minorStepPx = Math.max(8, gridSize * finalScale);

        ctx.save();
        ctx.beginPath();
        ctx.rect(finalOffX, finalOffY, imageWidthPx, imageHeightPx);
        ctx.clip();

        let lineIndex = 0;
        for (let x = finalOffX; x <= finalOffX + imageWidthPx; x += minorStepPx) {
          const major = lineIndex % majorEvery === 0;
          ctx.beginPath();
          ctx.moveTo(x, finalOffY);
          ctx.lineTo(x, finalOffY + imageHeightPx);
          ctx.strokeStyle = major ? 'rgba(56, 189, 248, 0.55)' : 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = major ? 1.4 : 1;
          ctx.stroke();
          lineIndex += 1;
        }

        lineIndex = 0;
        for (let y = finalOffY; y <= finalOffY + imageHeightPx; y += minorStepPx) {
          const major = lineIndex % majorEvery === 0;
          ctx.beginPath();
          ctx.moveTo(finalOffX, y);
          ctx.lineTo(finalOffX + imageWidthPx, y);
          ctx.strokeStyle = major ? 'rgba(56, 189, 248, 0.55)' : 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = major ? 1.4 : 1;
          ctx.stroke();
          lineIndex += 1;
        }

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.70)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(finalOffX, finalOffY, imageWidthPx, imageHeightPx);
        ctx.restore();
      }

      imgState.points.forEach((pt, i) => {
        const color = POINT_COLORS[i % POINT_COLORS.length];
        let sx = pt.x * finalScale + finalOffX;
        let sy = pt.y * finalScale + finalOffY;
        if (type === 'patient' && (patientOrientation.rotation !== 0 || patientOrientation.flipH || patientOrientation.flipV)) {
          const oriented = applyPatientOrientationToScreen(sx, sy, tRef.current);
          sx = oriented.x;
          sy = oriented.y;
        }
        const grad = ctx.createRadialGradient(sx,sy,2,sx,sy,22);
        grad.addColorStop(0, color+'70'); grad.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(sx,sy,22,0,2*Math.PI); ctx.fillStyle=grad; ctx.fill();
        ctx.shadowColor=color; ctx.shadowBlur=14;
        ctx.beginPath(); ctx.arc(sx,sy,9,0,2*Math.PI); ctx.fillStyle=color; ctx.fill(); ctx.shadowBlur=0;
        ctx.strokeStyle='white'; ctx.lineWidth=2.5; ctx.stroke();
        ctx.fillStyle='white'; ctx.font='bold 11px "SF Mono", monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(pt.id),sx,sy);
      });
    };
    img.src = imgState.src;
  }, [referenceImage, patientImage, refView, patView, phase, registrationMode, showGrid, gridSize, patientOrientation, applyPatientOrientationToScreen]);

  useEffect(() => { drawCanvas('reference'); }, [drawCanvas]);
  useEffect(() => { drawCanvas('patient');   }, [drawCanvas]);

  const drawResultImages = useCallback(() => {
    const refCanvas = resultRefCanvasRef.current;
    const patCanvas = resultPatCanvasRef.current;
    const refSrc = resultImages?.ref || referenceImage.src;
    const patSrc = resultImages?.pat || patientImage.src;
    console.log('🖼️ drawResultImages called', {
      refCanvas: !!refCanvas,
      patCanvas: !!patCanvas,
      refSrc: refSrc?.slice(0, 40),
      patSrc: patSrc?.slice(0, 40),
    });
    if (!refCanvas || !patCanvas || !refSrc || !patSrc) {
      console.error('❌ drawResultImages: missing canvas or src');
      return;
    }
    const SIZE = 600;

    const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { console.log('✅ Image loaded:', img.width, img.height); resolve(img); };
      img.onerror = (e) => { console.error('❌ Image load error:', e); reject(e); };
      img.src = src;
    });

    const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const s = Math.min(SIZE / img.width, SIZE / img.height) * 0.95;
      ctx.drawImage(img, (SIZE - img.width * s) / 2, (SIZE - img.height * s) / 2, img.width * s, img.height * s);
      console.log('✅ drawCover done', img.width, img.height);
    };

    Promise.all([loadImg(refSrc), loadImg(patSrc)]).then(([refImg, patImg]) => {
      console.log('✅ Both images loaded, drawing canvases...');
      refCanvas.width = refCanvas.height = SIZE;
      const refCtx = refCanvas.getContext('2d')!;
      drawCover(refCtx, refImg);

      patCanvas.width = patCanvas.height = SIZE;
      const patCtx = patCanvas.getContext('2d')!;
      drawCover(patCtx, patImg);
      console.log('✅ Both canvases drawn successfully');

      if (visMode === 'heatmap') {
        const refD = refCtx.getImageData(0, 0, SIZE, SIZE);
        const patD = patCtx.getImageData(0, 0, SIZE, SIZE);
        const diffs: number[] = [];
        for (let i = 0; i < refD.data.length; i += 4) {
          const l1 = 0.299*refD.data[i] + 0.587*refD.data[i+1] + 0.114*refD.data[i+2];
          const l2 = 0.299*patD.data[i] + 0.587*patD.data[i+1] + 0.114*patD.data[i+2];
          const isBg = (l1 > 230 && l2 > 230) || (l1 < 8 && l2 < 8);
          diffs.push(isBg ? -1 : Math.abs(l1 - l2) / 255);
        }
        const valid = diffs.filter(d => d >= 0).sort((a, b) => a - b);
        const p95 = valid[Math.floor(valid.length * 0.95)] || 1;
        const alignPct = valid.length > 0 ? Math.round((valid.filter(d => d < 0.08).length / valid.length) * 100) : 0;
        (window as any).__heatmapAlignPct = alignPct;
        const jet = (t: number) => [
          Math.max(0,Math.min(255,Math.round(255*(1.5-Math.abs(4*t-3))))),
          Math.max(0,Math.min(255,Math.round(255*(1.5-Math.abs(4*t-2))))),
          Math.max(0,Math.min(255,Math.round(255*(1.5-Math.abs(4*t-1)))))
        ];
        patCtx.clearRect(0,0,SIZE,SIZE);
        patCtx.fillStyle='#f8fafc'; patCtx.fillRect(0,0,SIZE,SIZE);
        const anatData = patCtx.createImageData(SIZE,SIZE);
        for (let i=0;i<refD.data.length;i+=4){
          const l1=0.299*refD.data[i]+0.587*refD.data[i+1]+0.114*refD.data[i+2];
          const isBg=l1>230||l1<8;
          anatData.data[i]=isBg?0:Math.round(l1*0.45);
          anatData.data[i+1]=isBg?0:Math.round(l1*0.45);
          anatData.data[i+2]=isBg?0:Math.round(l1*0.45);
          anatData.data[i+3]=isBg?0:220;
        }
        patCtx.putImageData(anatData,0,0);
        const out=patCtx.createImageData(SIZE,SIZE);
        for(let i=0;i<diffs.length;i++){
          const d=diffs[i]; const pi=i*4;
          if(d<0){out.data[pi+3]=0;continue;}
          const t=Math.min(1,d/p95);
          const [r,g,b]=jet(t);
          out.data[pi]=r;out.data[pi+1]=g;out.data[pi+2]=b;
          out.data[pi+3]=d<0.05?30:d<0.12?100:210;
        }
        const tmp=document.createElement('canvas'); tmp.width=tmp.height=SIZE;
        const tCtx=tmp.getContext('2d')!; tCtx.putImageData(out,0,0);
        patCtx.drawImage(tmp,0,0);
      }
    }).catch(e => console.error('drawResultImages error:', e));
  }, [resultImages, referenceImage.src, patientImage.src, visMode]);

  // ✅ BUG 2 CORRIGÉ — attendre que les canvases soient vraiment montés
  useEffect(() => {
    if (showResult && resultImages) {
      console.log('🎨 showResult+resultImages effect triggered');
      // Retry toutes les 100ms jusqu'à ce que les canvases soient disponibles
      let attempts = 0;
      const tryDraw = () => {
        attempts++;
        const refCanvas = resultRefCanvasRef.current;
        const patCanvas = resultPatCanvasRef.current;
        console.log(`🎨 Attempt ${attempts}: refCanvas=${!!refCanvas}, patCanvas=${!!patCanvas}`);
        if (refCanvas && patCanvas) {
          drawResultImages();
          // Retry supplémentaire pour le heatmap
          setTimeout(() => drawResultImages(), 300);
        } else if (attempts < 20) {
          setTimeout(tryDraw, 100);
        } else {
          console.error('❌ Canvases not found after 20 attempts');
        }
      };
      setTimeout(tryDraw, 50);
    }
  }, [showResult, resultImages, visMode]);

  // ✅ BUG 3 CORRIGÉ — redraw dès que resultImages change ET showResult est true
  useEffect(() => {
    if (resultImages && showResult) {
      console.log('🎨 resultImages changed, redrawing...');
      setTimeout(() => drawResultImages(), 150);
    }
  }, [resultImages, showResult]);

  // Draggable split
  useEffect(()=>{
    const onMove=(e:MouseEvent)=>{
      if(!isDraggingSplit||!resultVisualRef.current)return;
      const rect=resultVisualRef.current.getBoundingClientRect();
      setSplitPos(Math.round(Math.min(100,Math.max(0,((e.clientX-rect.left)/rect.width)*100))));
    };
    const onUp=()=>setIsDraggingSplit(false);
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    return ()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
  },[isDraggingSplit]);

  // Canvas interactions
  const addRipple=(x:number,y:number)=>{const id=Date.now();setRipples(p=>[...p,{x,y,id}]);setTimeout(()=>setRipples(p=>p.filter(r=>r.id!==id)),600);};
  const handleWheel=(e:React.WheelEvent<HTMLCanvasElement>,type:'reference'|'patient')=>{e.preventDefault();const sv=type==='reference'?setRefView:setPatView;const f=e.deltaY<0?1.1:0.9;sv(p=>({...p,scale:Math.min(Math.max(p.scale*f,0.3),10)}));};
  const handleMouseDown=(e:React.MouseEvent<HTMLCanvasElement>,type:'reference'|'patient')=>{if(e.button===1||e.altKey){e.preventDefault();setIsPanning(true);setLastMousePos({x:e.clientX,y:e.clientY});setActiveImage(type);}};
  const handleMouseMove=(e:React.MouseEvent<HTMLCanvasElement>,type:'reference'|'patient')=>{
    if(isPanning){const sv=type==='reference'?setRefView:setPatView;const dx=e.clientX-lastMousePos.x;const dy=e.clientY-lastMousePos.y;sv(p=>({...p,panX:p.panX+dx,panY:p.panY+dy}));setLastMousePos({x:e.clientX,y:e.clientY});return;}
    if(showMagnifier){const canvas=e.currentTarget;const rect=canvas.getBoundingClientRect();setMagnifierPos({x:e.clientX,y:e.clientY});const mc=magnifierCanvasRef.current;if(mc){const ctx=mc.getContext('2d');if(ctx){ctx.clearRect(0,0,150,150);const mx=e.clientX-rect.left;const my=e.clientY-rect.top;try{ctx.drawImage(canvas,mx-37.5,my-37.5,75,75,0,0,150,150);}catch{}ctx.strokeStyle='rgba(255,0,0,0.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(75,0);ctx.lineTo(75,150);ctx.moveTo(0,75);ctx.lineTo(150,75);ctx.stroke();}}}
  };
  const handleMouseUp=()=>setIsPanning(false);
  const handleMouseLeave=()=>setIsPanning(false);
  const handleCanvasClick=(e:React.MouseEvent<HTMLCanvasElement>,type:'reference'|'patient')=>{
    if(e.button!==0||e.altKey||isPanning||registrationMode==='mine')return;
    addRipple(e.clientX,e.clientY);
    const canvas=e.currentTarget;const rect=canvas.getBoundingClientRect();
    const tRef=type==='reference'?refTransformRef:patTransformRef;
    let localX=e.clientX-rect.left;
    let localY=e.clientY-rect.top;
    if(type==='patient'&&(patientOrientation.rotation!==0||patientOrientation.flipH||patientOrientation.flipV)){
      const inv = invertPatientOrientationFromScreen(localX, localY, tRef.current);
      localX = inv.x;
      localY = inv.y;
    }
    const imgX=(localX-tRef.current.offsetX)/tRef.current.scale;
    const imgY=(localY-tRef.current.offsetY)/tRef.current.scale;
    const point:Point={x:imgX,y:imgY,id:nextPointId};
    if(type==='reference'){setReferenceImage(p=>({...p,points:[...p.points,point]}));setActiveImage('patient');}
    else{setPatientImage(p=>({...p,points:[...p.points,point]}));setActiveImage('reference');setNextPointId(p=>p+1);}
  };
  const handleContextMenu=(e:React.MouseEvent<HTMLCanvasElement>,type:'reference'|'patient')=>{
    e.preventDefault();
    const canvas=e.currentTarget;const rect=canvas.getBoundingClientRect();
    const clickX=e.clientX-rect.left;const clickY=e.clientY-rect.top;
    const tRef=type==='reference'?refTransformRef:patTransformRef;
    const imgData=type==='reference'?referenceImage:patientImage;
    const target=imgData.points.find(p=>{
      let sx=p.x*tRef.current.scale+tRef.current.offsetX;
      let sy=p.y*tRef.current.scale+tRef.current.offsetY;
      if(type==='patient'&&(patientOrientation.rotation!==0||patientOrientation.flipH||patientOrientation.flipV)){
        const oriented = applyPatientOrientationToScreen(sx, sy, tRef.current);
        sx = oriented.x;
        sy = oriented.y;
      }
      return Math.hypot(sx-clickX,sy-clickY)<22;
    });
    if(target){const{id}=target;if(type==='reference')setReferenceImage(p=>({...p,points:p.points.filter(q=>q.id!==id)}));else setPatientImage(p=>({...p,points:p.points.filter(q=>q.id!==id)}));}
  };
  const undoLastPoint=()=>{
    const rL=referenceImage.points.length, pL=patientImage.points.length;
    if(rL===0 && pL===0)return;
    if(rL > pL){setReferenceImage(p=>({...p,points:p.points.slice(0,-1)}));setActiveImage('reference');}
    else {setPatientImage(p=>({...p,points:p.points.slice(0,-1)}));setNextPointId(id=>id-1);setActiveImage('patient');}
  };
  const clearAllPoints=()=>{setReferenceImage(p=>({...p,points:[]}));setPatientImage(p=>({...p,points:[]}));setNextPointId(1);setActiveImage('reference');};

  const loadFreshAtlasAndDemo = async () => {
    try {
      const atlasRes = await fetch('/api/volume/atlas_slice?axis=axial');
      if (!atlasRes.ok) return;
      const atlasData = await atlasRes.json();

      const demoRes = await fetch('/api/volume/load-demo', { method: 'POST' });
      if (!demoRes.ok) {
        if (atlasData.image) {
          setReferenceImage({ src: atlasData.image, points: [] });
          setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
        }
        return;
      }

      const demoData = await demoRes.json();
      const nextJobId = demoData.jobId || '';

      if (atlasData.image) {
        setReferenceImage({ src: atlasData.image, points: [] });
        setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      }
      if (demoData.median_slice) {
        setPatientImage({ src: demoData.median_slice, points: [] });
      }

      if (nextJobId) {
        setJobId(nextJobId);
        sessionStorage.setItem('volumeJobId', nextJobId);
      }

      const nextIndex = typeof demoData.z === 'number'
        ? demoData.z
        : (typeof atlasData.index === 'number' ? atlasData.index : 0);

      if (nextJobId) {
        const atlasGrayRes = await fetch(`/api/volume/atlas_slice?jobId=${nextJobId}&axis=axial&index=${nextIndex}&showLabels=0`);
        if (atlasGrayRes.ok) {
          const atlasGray = await atlasGrayRes.json();
          if (atlasGray.image) {
            setReferenceImage({ src: atlasGray.image, points: [] });
            setAtlasSource((atlasGray.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
          }
        }
      }

      setIndex(nextIndex);
      setMaxIndex(
        typeof atlasData.max_index === 'number'
          ? atlasData.max_index
          : (typeof demoData.max_z === 'number' ? demoData.max_z : 0)
      );
      setSliceShape(null);
      setSuggestedSlice(null);
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
      setSliceError('');
      setAtlasSliceError('');

      if (atlasData.image && demoData.median_slice) {
        setPhase(2);
      }
    } catch (err) {
      console.error('Reload atlas/demo failed:', err);
    }
  };

  const importPatient3D = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);

      const uploadRes = await fetch('/api/volume/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!uploadRes.ok) throw new Error('Upload patient 3D echoue');

      const uploadData = await uploadRes.json();
      const nextJobId = uploadData.jobId || '';
      if (!nextJobId) throw new Error('Job ID manquant apres upload');

      const shape: SliceShape | null = uploadData.shape &&
        typeof uploadData.shape.x === 'number' &&
        typeof uploadData.shape.y === 'number' &&
        typeof uploadData.shape.z === 'number'
        ? uploadData.shape
        : null;

      const suggested: SuggestedSlice | null = uploadData.suggested &&
        ['axial', 'coronal', 'sagittal'].includes(uploadData.suggested.axis) &&
        typeof uploadData.suggested.index === 'number'
        ? uploadData.suggested
        : null;

      const nextAxis = suggested?.axis || 'axial';
      const nextIndex = suggested?.index ?? (typeof uploadData.z === 'number' ? uploadData.z : 0);

      const atlasRes = await fetch(`/api/volume/atlas_slice?jobId=${nextJobId}&axis=${nextAxis}&index=${nextIndex}&showLabels=0`);
      const patientRes = await fetch(`/api/volume/get-slice?jobId=${nextJobId}&axis=${nextAxis}&index=${nextIndex}`);
      if (!atlasRes.ok || !patientRes.ok) throw new Error('Chargement des coupes echoue');

      const atlasData = await atlasRes.json();
      const patientData = await patientRes.json();

      setUploadedFiles({});
      const nextAtlasSrc = atlasData.image || '';
      const nextPatientSrc = patientData.slice || patientData.image || uploadData.median_slice || '';
      setReferenceImage({ src: nextAtlasSrc, points: [] });
      setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      setPatientImage({ src: nextPatientSrc, points: [] });
      setActiveImage('reference');
      setNextPointId(1);
      setShowResult(false);
      setJobId(nextJobId);
      sessionStorage.setItem('volumeJobId', nextJobId);

      setSliceShape(shape);
      setSuggestedSlice(suggested);
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
      setSliceError('');
      setAtlasSliceError('');
      setAxis(nextAxis);
      setIndex(typeof patientData.index === 'number' ? patientData.index : nextIndex);
      setMaxIndex(
        typeof patientData.max_index === 'number'
          ? patientData.max_index
          : (typeof atlasData.max_index === 'number'
            ? atlasData.max_index
            : (typeof uploadData.max_z === 'number' ? uploadData.max_z : 0))
      );

      setZone(null);
      setInsideBrain(false);
      setHasBrodmannAttempt(false);
      setShowPatientOrientation(false);
      setPatientOrientation({ rotation: 0, flipH: false, flipV: false });
      setAutoAlignStatus('idle');
      setAutoAlignError('');
      setPhase(2);
    } catch (err) {
      console.error('Import patient 3D failed:', err);
      setAutoAlignError("Import patient 3D echoue. Verifiez le fichier et recommencez.");
      setAutoAlignStatus('error');
    }
  };

  const handlePatientVolumePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importPatient3D(file);
    e.target.value = '';
  };

  const importCustomAtlas = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);

      const uploadRes = await fetch('/api/volume/upload-atlas', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!uploadRes.ok) {
        const payload = await uploadRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Upload atlas personnalise echoue');
      }

      const uploadData = await uploadRes.json();
      const nextAxis = uploadData.axis || 'axial';
      const nextIndex = typeof uploadData.index === 'number' ? uploadData.index : 0;

      setReferenceImage({ src: uploadData.image || '', points: [] });
      setAtlasSource('custom');
      setAxis(nextAxis);
      setIndex(nextIndex);
      setMaxIndex(typeof uploadData.max_index === 'number' ? uploadData.max_index : maxIndex);
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
      setSliceError('');
      setAtlasSliceError('');
      setZone(null);
      setInsideBrain(false);
      setHasBrodmannAttempt(false);
      setShowResult(false);
      if (patientImage.src) {
        setPhase(2);
      }
    } catch (err: any) {
      console.error('Import atlas failed:', err);
      setAutoAlignError(err?.message || 'Import atlas echoue.');
      setAutoAlignStatus('error');
    }
  };

  const handleAtlasVolumePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCustomAtlas(file);
    e.target.value = '';
  };

  const switchToOfficialAtlas = async () => {
    try {
      const res = await fetch('/api/volume/use-official-atlas', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Chargement atlas officiel echoue');
      }
      const data = await res.json();
      setReferenceImage({ src: data.image || '', points: [] });
      setAtlasSource('official');
      setAxis(data.axis || 'axial');
      setIndex(typeof data.index === 'number' ? data.index : 0);
      setMaxIndex(typeof data.max_index === 'number' ? data.max_index : maxIndex);
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
      setSliceError('');
      setAtlasSliceError('');
      setZone(null);
      setInsideBrain(false);
      setHasBrodmannAttempt(false);
      setShowResult(false);
      if (patientImage.src) {
        setPhase(2);
      }
    } catch (err: any) {
      console.error('Switch atlas source failed:', err);
      setAutoAlignError(err?.message || 'Impossible de charger Harvard-Oxford.');
      setAutoAlignStatus('error');
    }
  };

  const startNewRegistration = () => {
    sessionStorage.removeItem('volumeJobId');
    setRegistrationDimension(null);
    setUploadedFiles({});
    setReferenceImage({ src: '', points: [] });
    setPatientImage({ src: '', points: [] });
    setActiveImage('reference');
    setShowResult(false);
    setShowValidationModal(false);
    setPhase(1);
    setNextPointId(1);
    setAlphaBlending(50);
    setShowGrid(true);
    setGridSize(32);
    setVisMode('split');
    setSplitPos(50);
    setRegistrationMode('manual');
    setCameFromMINE(false);
    setAutoAlignStatus('idle');
    setAutoAlignMetrics(null);
    setAutoAlignError('');
    setJobId('');
    setRefView(DEFAULT_VIEW);
    setPatView(DEFAULT_VIEW);
    setAxis('axial');
    setIndex(0);
    setMaxIndex(0);
    setSliceShape(null);
    setSuggestedSlice(null);
    setSliceConfirmed(false);
    setAtlasSliceConfirmed(false);
    setSliceLoading(false);
    setSliceError('');
    setAtlasSliceError('');
    setZone(null);
    setInsideBrain(false);
    setHasBrodmannAttempt(false);
    setAtlasSource('official');
    setShowPatientOrientation(false);
    setPatientOrientation({ rotation: 0, flipH: false, flipV: false });
    setResultImages(null);
    setPendingShowResult(false);
  };
  const canAlign=referenceImage.points.length>=4&&referenceImage.points.length===patientImage.points.length;


  // Keyboard shortcuts
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==='r'||e.key==='R'){setRefView(DEFAULT_VIEW);setPatView(DEFAULT_VIEW);}if((e.ctrlKey||e.metaKey)&&e.key==='z')undoLastPoint();if(e.key==='Escape')setShowShortcuts(false);if(e.key==='?')setShowShortcuts(s=>!s);if(e.key==='g'||e.key==='G'){setShowGrid(v=>!v);}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[referenceImage.points, patientImage.points]);

  // Auto align
  const readApiError = async (res: Response, fallbackMessage: string) => {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await res.json();
        return payload?.message || payload?.error || fallbackMessage;
      }
      const text = (await res.text()).trim();
      return text || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  };

  const postRegistrationWithFallback = async (
    endpoints: string[],
    payload: Record<string, unknown>,
    fallbackMessage: string
  ) => {
    let lastError = fallbackMessage;

    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json();
      }

      lastError = await readApiError(res, fallbackMessage);
    }

    throw new Error(lastError);
  };

  const handleAutoAlign = async () => {
    if (!jobId) { setAutoAlignError("Aucun job ID."); setAutoAlignStatus('error'); return; }
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      const autoAlignEndpoints = registrationDimension === '3d'
        ? ['/api/volume/auto-align']
        : ['/api/volume/auto-align', '/api/auto-align'];

      const data = await postRegistrationWithFallback(
        autoAlignEndpoints,
        { jobId, transform: 'MINE', axis, index },
        'Recalage automatique échoué'
      );
      if (data.metrics) setAutoAlignMetrics(data.metrics);
      const nextPatient = data.images?.patient || data.image;
      const nextAtlas = data.images?.atlas || referenceImage.src;

      if (nextPatient) {
        setPatientImage(p => ({ ...p, src: nextPatient }));
        setReferenceImage(p => ({ ...p, src: nextAtlas }));
        setResultImages({ ref: nextAtlas, pat: nextPatient });
      } else {
        // Fallback if backend returns metrics only
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      // In 3D, keep manual validation as a mandatory clinical step after auto result.
      if (registrationDimension === '3d') {
        setShowValidationModal(false);
        setPhase(2);
      }
      setAutoAlignStatus('success');
    } catch (err: any) {
      const msg = String(err?.message || 'Erreur inattendue');
      const lower = msg.toLowerCase();
      const staleJob = lower.includes('job not found') || lower.includes('jobid not found') || lower.includes('session expiree');

      if (registrationDimension === '3d' && staleJob) {
        // Backend cache can be cleared after a server restart; recover automatically.
        sessionStorage.removeItem('volumeJobId');
        setJobId('');
        setAutoAlignError('Session 3D expirée. Rechargement automatique d\'une nouvelle session...');
        try {
          await loadFreshAtlasAndDemo();
        } catch (reloadErr) {
          console.error('Auto-reload after stale job failed:', reloadErr);
        }
      } else {
        setAutoAlignError(msg);
      }
      setAutoAlignStatus('error');
    }
  };

  const handleRecommendedAutoAlign = async () => {
    setRegistrationMode('mine');
    await handleAutoAlign();
  };

  // ✅ BUG 1 CORRIGÉ — setAutoAlignStatus('success') ajouté dans le try
  const handleManualAlign = async () => {
    console.log('🔵 handleManualAlign START', { jobId, canAlign, refPts: referenceImage.points.length, patPts: patientImage.points.length });
    if (!jobId) {
      console.warn('❌ No jobId found');
      setAutoAlignError("L'ID de session (jobId) est manquant. Veuillez ré-importer les images.");
      setAutoAlignStatus('error');
      return;
    }
    if (!canAlign) { setAutoAlignError('Minimum 4 points requis.'); return; }
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      console.log('🔵 Calling manual alignment endpoint...');
      const data = await postRegistrationWithFallback(
        ['/api/volume/manual-align', '/api/align'],
        {
          jobId,
          axis,
          index,
          ct_points: referenceImage.points.map(p => [p.x, p.y]),
          pat_points: patientImage.points.map(p => [p.x, p.y]),
          use_warped: cameFromMINE,
        },
        'Recalage manuel échoué'
      );
      console.log('🔵 Manual align data:', data);
      if (data.metrics) setAutoAlignMetrics(data.metrics);
      if (data.image) {
        setPatientImage(p => ({ ...p, src: data.image }));
        setResultImages({ ref: referenceImage.src, pat: data.image });
      } else {
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      setCameFromMINE(false);
      setAutoAlignStatus('success');
    } catch (err: any) {
      console.error('❌ handleManualAlign error:', err);
      setResultImages(null);
      setAutoAlignMetrics(null);
      setCameFromMINE(false);
      setAutoAlignError(err?.message || 'Recalage manuel échoué');
      setAutoAlignStatus('error');
    }
  };

  const handleRejectRegistration = async () => {
    if (!jobId) return;
    try {
      setShowValidationModal(false);
      setAutoAlignStatus('processing');
      const res = await fetch('/api/volume/reject-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error('Rejet échoué');
      setShowResult(false);
      setAutoAlignStatus('idle');
      setPhase(2);
      // Optional: reset images to original
      const resetRes = await fetch(`/api/volume/get-slice?jobId=${jobId}&axis=${axis}&index=${index}`);
      if (resetRes.ok) {
        const data = await resetRes.json();
        setPatientImage(p => ({ ...p, src: data.slice || data.image }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setAutoAlignStatus('idle');
    }
  };

  const handleValidateRegistration = async () => {
    if (!jobId) return;
    setShowValidationModal(false);
    setAutoAlignStatus('processing');
    try {
      const res = await fetch('/api/volume/validate-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error('Validation échouée');
      const data = await res.json();
      if (data.images) {
        setReferenceImage({ src: data.images.atlas, points: [] });
        setPatientImage({ src: data.images.patient, points: [] });
      }
      setNextPointId(1);
      setActiveImage('reference');
      setIndex(data.z || 0);
      setMaxIndex(data.registered_shape?.[2] || 0);
      setHasBrodmannAttempt(false);
      setPhase(3); // -> PASSE EN PHASE 3 (Brodmann)
      setShowResult(false);
    } catch (err: any) {
      setAutoAlignError("Échec de la validation volumétrique.");
    } finally {
      setAutoAlignStatus('idle');
    }
  };

  const getImageRatioFromClick = (
    e: React.MouseEvent<HTMLCanvasElement>,
    type: 'reference' | 'patient'
  ) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const t = type === 'reference' ? refTransformRef.current : patTransformRef.current;

    if (!t.imageWidth || !t.imageHeight || t.scale <= 0) {
      return null;
    }

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const imgX = (localX - t.offsetX) / t.scale;
    const imgY = (localY - t.offsetY) / t.scale;

    if (imgX < 0 || imgY < 0 || imgX > t.imageWidth || imgY > t.imageHeight) {
      return null;
    }

    return {
      xRatio: imgX / Math.max(1, t.imageWidth - 1),
      yRatio: imgY / Math.max(1, t.imageHeight - 1),
    };
  };

  const handleBrodmannClick = async (e: React.MouseEvent<HTMLCanvasElement>, type: 'reference' | 'patient') => {
    if (phase !== 3 || !jobId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const showTooltip = (payload: {
      insideBrain: boolean;
      zoneId?: number;
      zoneName?: string;
    }) => {
      const tooltipW = 250;
      const tooltipH = 82;
      const edge = 14;

      let tooltipX = clickX + 16;
      if (tooltipX + tooltipW > rect.width - edge) {
        tooltipX = clickX - tooltipW - 16;
      }
      tooltipX = Math.max(edge, Math.min(tooltipX, rect.width - tooltipW - edge));

      let tooltipY = clickY - tooltipH - 12;
      if (tooltipY < edge) {
        tooltipY = clickY + 14;
      }
      tooltipY = Math.max(edge, Math.min(tooltipY, rect.height - tooltipH - edge));

      if (brodmannTooltipTimerRef.current) {
        clearTimeout(brodmannTooltipTimerRef.current);
      }
      setBrodmannTooltip({
        panel: type,
        x: tooltipX,
        y: tooltipY,
        insideBrain: payload.insideBrain,
        zoneId: payload.zoneId,
        zoneName: payload.zoneName,
      });
      brodmannTooltipTimerRef.current = setTimeout(() => {
        setBrodmannTooltip(null);
      }, 3200);
    };

    const ratios = getImageRatioFromClick(e, type);

    if (!ratios) {
      setHasBrodmannAttempt(true);
      setZone(null);
      setInsideBrain(false);
      showTooltip({ insideBrain: false });
      return;
    }

    const { xRatio, yRatio } = ratios;
    setHasBrodmannAttempt(true);

    try {
      const res = await fetch(`/api/volume/brodmann?jobId=${jobId}&axis=${axis}&index=${index}&xRatio=${xRatio}&yRatio=${yRatio}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Brodmann failed');
      const data = await res.json();
      setZone(data.zone);
      setInsideBrain(data.insideBrain);
      showTooltip({
        insideBrain: Boolean(data.insideBrain && data.zone),
        zoneId: data.zone?.id,
        zoneName: data.zone?.name,
      });
      if (data.images) {
        setReferenceImage(p => ({ ...p, src: data.images.atlas }));
        setPatientImage(p => ({ ...p, src: data.images.patient }));
      }
    } catch (err) {
      console.error('Brodmann lookup error:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (sliceDebounceRef.current) {
        clearTimeout(sliceDebounceRef.current);
      }
      if (brodmannTooltipTimerRef.current) {
        clearTimeout(brodmannTooltipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== 3) {
      setAvailableCorticalZones([]);
      setLoadingCorticalZones(false);
      return;
    }

    let alive = true;

    const loadCorticalZones = async () => {
      try {
        setLoadingCorticalZones(true);
        const candidates = ['/api/volume/cortical-zones', '/api/volume/cortical-zones/'];
        let data: any = null;

        for (const url of candidates) {
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) continue;
          data = await res.json();
          break;
        }

        if (!alive) return;

        if (!data) {
          setAvailableCorticalZones([]);
          return;
        }

        if (data?.source === 'custom' || data?.source === 'official') {
          setAtlasSource(data.source as AtlasSourceOption);
        }

        const zones = Array.isArray(data?.zones) ? data.zones : [];
        setAvailableCorticalZones(zones);
      } catch (err) {
        if (alive) setAvailableCorticalZones([]);
      } finally {
        if (alive) setLoadingCorticalZones(false);
      }
    };

    void loadCorticalZones();

    return () => {
      alive = false;
    };
  }, [phase]);

  const sync3DViews = async (nextAxis = axis, nextIndex = index) => {
    if (!jobId) return;
    try {
      const p1 = fetch(`/api/volume/atlas_slice?jobId=${jobId}&axis=${nextAxis}&index=${nextIndex}&showContour=1&showLabels=1`).then(r => r.json());
      const p2 = fetch(`/api/volume/patient_slice?jobId=${jobId}&axis=${nextAxis}&index=${nextIndex}&showContour=1`).then(r => r.json());
      const [atlas, patient] = await Promise.all([p1, p2]);
      if (atlas.image) setReferenceImage(p => ({ ...p, src: atlas.image }));
      setAtlasSource((atlas.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      if (patient.image) setPatientImage(p => ({ ...p, src: patient.image }));
      setIndex(nextIndex);
      if (atlas.max_index) setMaxIndex(atlas.max_index);
    } catch (err) {
      console.error('3D Sync failed:', err);
    }
  };

  const handleRefineManually = () => {
    setAutoAlignStatus('idle'); setShowResult(false); setRegistrationMode('manual'); setCameFromMINE(true);
    setReferenceImage(p => ({ ...p, points: [] })); setPatientImage(p => ({ ...p, points: [] }));
    setNextPointId(1); setActiveImage('reference'); setPhase(2);
  };

  const handleBackToRegistration = () => {
    setPhase(2);
    setShowValidationModal(false);
    if (resultImages) {
      setShowResult(true);
      setVisMode('split');
      setSplitPos(50);
      return;
    }
    setShowResult(false);
  };

  useEffect(() => {
    if (autoAlignStatus === 'success') {
      console.log('✅ autoAlignStatus success — setting pendingShowResult');
      setPendingShowResult(true);
    }
  }, [autoAlignStatus]);

  useEffect(() => {
    if (autoAlignStatus !== 'success') return;
    const timer = setTimeout(() => setAutoAlignStatus('idle'), 180);
    return () => clearTimeout(timer);
  }, [autoAlignStatus]);

  // ✅ Déclencher showResult quand l'overlay ferme (autoAlignStatus revient à idle)
  useEffect(() => {
    if (pendingShowResult && autoAlignStatus === 'idle') {
      console.log('✅ pendingShowResult + idle → showing result');
      setPendingShowResult(false);
      setShowResult(true);
      setShowValidationModal(false);
      setVisMode('split');
      setSplitPos(50);
      setTimeout(() => { console.log('🎨 Draw 1'); drawResultImages(); }, 100);
      setTimeout(() => { console.log('🎨 Draw 2'); drawResultImages(); }, 400);
      setTimeout(() => { console.log('🎨 Draw 3'); drawResultImages(); }, 800);
    }
  }, [pendingShowResult, autoAlignStatus, drawResultImages]);

  // Computed
  const refPts     = referenceImage.points.length;
  const patPts     = patientImage.points.length;
  const pointsOk   = refPts >= 4 && refPts === patPts;
  const slicesVerified = sliceConfirmed && atlasSliceConfirmed;
  const is2D = registrationDimension === '2d';
  const is3D = registrationDimension === '3d';
  const canRunManualAlign = canAlign && (is2D || slicesVerified);
  const showAutoButton       = referenceImage.src && patientImage.src && registrationMode === 'mine' && !showResult;
  const showManualButton     = registrationMode === 'manual';
  const showManualActions    = referenceImage.src && patientImage.src && registrationMode === 'manual';
  const mi         = autoAlignMetrics?.mutual_information;
  const miQuality  = autoAlignMetrics?.mi_quality || (mi === undefined ? 'N/A' : mi > 0.5 ? 'Excellent' : mi > 0.3 ? 'Bon' : 'Faible');
  const miColor    = mi === undefined ? '#94a3b8' : mi > 0.5 ? '#10b981' : mi > 0.3 ? '#3b82f6' : '#f97316';
  const miBadgeBg  = mi === undefined ? 'bg-slate-100 text-slate-500' : mi > 0.5 ? 'bg-emerald-100 text-emerald-700' : mi > 0.3 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700';
  const pointsStatus = refPts === 0 ? 'empty' : refPts < 4 ? 'partial' : refPts !== patPts ? 'unbalanced' : 'ready';
  const axisOptions = [
    { key: 'axial', label: 'Axial' },
    { key: 'coronal', label: 'Coronal' },
    { key: 'sagittal', label: 'Sagittal' },
  ];

  const getAxisMax = (axisKey: string) => {
    if (sliceShape) {
      if (axisKey === 'axial') return Math.max(0, sliceShape.z - 1);
      if (axisKey === 'coronal') return Math.max(0, sliceShape.y - 1);
      if (axisKey === 'sagittal') return Math.max(0, sliceShape.x - 1);
    }
    return Math.max(0, maxIndex);
  };

  const fetchPhase2Slices = async (nextAxis: string, nextIndex: number) => {
    if (!jobId) return;
    const reqId = ++sliceFetchSeqRef.current;
    setSliceLoading(true);
    setSliceError('');
    try {
      const qJob = encodeURIComponent(jobId);
      const qAxis = encodeURIComponent(nextAxis);
      const [atlasRes, patientRes] = await Promise.all([
        fetch(`/api/volume/atlas_slice?jobId=${qJob}&axis=${qAxis}&index=${nextIndex}&showLabels=0`, { credentials: 'include' }),
        fetch(`/api/volume/get-slice?jobId=${qJob}&axis=${qAxis}&index=${nextIndex}`, { credentials: 'include' }),
      ]);

      if (!atlasRes.ok || !patientRes.ok) {
        const atlasErr = !atlasRes.ok ? await readApiError(atlasRes, 'atlas indisponible') : '';
        const patientErr = !patientRes.ok ? await readApiError(patientRes, 'patient indisponible') : '';
        const status = `${atlasRes.status}/${patientRes.status}`;
        if (atlasRes.status === 404 || patientRes.status === 404) {
          sessionStorage.removeItem('volumeJobId');
          setJobId('');
          setSliceShape(null);
          setSuggestedSlice(null);
          throw new Error('Session expiree (job introuvable). Reimportez le patient 3D.');
        }
        if (atlasRes.status === 401 || patientRes.status === 401) {
          throw new Error('Session utilisateur expiree. Reconnectez-vous puis reessayez.');
        }
        throw new Error(`Chargement dynamique echoue (${status}) ${atlasErr || patientErr}`.trim());
      }

      const atlasData = await atlasRes.json();
      const patientData = await patientRes.json();

      if (reqId !== sliceFetchSeqRef.current) return;

      if (atlasData.image) setReferenceImage(p => ({ ...p, src: atlasData.image }));
      setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      if (patientData.slice || patientData.image) {
        setPatientImage(p => ({ ...p, src: patientData.slice || patientData.image }));
      }

      const nextMax = typeof patientData.max_index === 'number'
        ? patientData.max_index
        : (typeof atlasData.max_index === 'number' ? atlasData.max_index : maxIndex);

      setAxis(nextAxis);
      setMaxIndex(nextMax);
      setIndex(Math.min(Math.max(nextIndex, 0), Math.max(0, nextMax)));
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
    } catch (err: any) {
      if (reqId !== sliceFetchSeqRef.current) return;
      console.error('Phase 2 slice navigation failed:', err);
      setSliceError(err?.message || 'Navigation des coupes echouee');
      setAtlasSliceError(err?.message || 'Navigation des coupes echouee');
      if (String(err?.message || '').toLowerCase().includes('session expiree')) {
        void loadFreshAtlasAndDemo();
      }
    } finally {
      if (reqId !== sliceFetchSeqRef.current) return;
      setSliceLoading(false);
    }
  };

  const queuePhase2SliceFetch = (nextAxis: string, nextIndex: number) => {
    const axisMax = getAxisMax(nextAxis);
    const clamped = Math.max(0, Math.min(nextIndex, axisMax));
    setAxis(nextAxis);
    setIndex(clamped);
    if (sliceDebounceRef.current) clearTimeout(sliceDebounceRef.current);
    sliceDebounceRef.current = setTimeout(() => {
      void fetchPhase2Slices(nextAxis, clamped);
    }, 90);
  };

  const handleConfirmSlice = async () => {
    if (!jobId) return;
    setSliceError('');
    try {
      const res = await fetch('/api/volume/confirm-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, axis, index }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Confirmation de coupe echouee');
      }
      setSliceConfirmed(true);
    } catch (err: any) {
      console.error('Confirm slice failed:', err);
      setSliceError(err?.message || 'Confirmation de coupe echouee');
      setSliceConfirmed(false);
    }
  };

  const handleConfirmAtlasSlice = async () => {
    if (!jobId) return;
    setAtlasSliceError('');
    try {
      const res = await fetch('/api/volume/confirm-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, axis, index }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Verification atlas echouee');
      }
      setAtlasSliceConfirmed(true);
    } catch (err: any) {
      console.error('Confirm atlas slice failed:', err);
      setAtlasSliceError(err?.message || 'Verification atlas echouee');
      setAtlasSliceConfirmed(false);
    }
  };

  const handleChooseRegistrationDimension = async (mode: RegistrationDimension) => {
    sessionStorage.removeItem('volumeJobId');
    setRegistrationDimension(mode);
    setUploadedFiles({});
    setReferenceImage({ src: '', points: [] });
    setPatientImage({ src: '', points: [] });
    setActiveImage('reference');
    setShowResult(false);
    setShowValidationModal(false);
    setPhase(1);
    setNextPointId(1);
    setAutoAlignStatus('idle');
    setAutoAlignError('');
    setAutoAlignMetrics(null);
    setJobId('');
    setResultImages(null);
    setPendingShowResult(false);
    setSliceConfirmed(false);
    setAtlasSliceConfirmed(false);
    setSliceError('');
    setAtlasSliceError('');
    setZone(null);
    setInsideBrain(false);
    setHasBrodmannAttempt(false);
    setShowPatientOrientation(false);
    setPatientOrientation({ rotation: 0, flipH: false, flipV: false });

    if (mode === '3d') {
      await loadFreshAtlasAndDemo();
    }
  };

  const exportCanvasAsPng = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  };

  const exportResults = () => {
    if (!showResult || !resultRefCanvasRef.current || !resultPatCanvasRef.current) {
      setAutoAlignError('Export indisponible: faites un recalage puis ouvrez le panneau de resultat.');
      setAutoAlignStatus('error');
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportCanvasAsPng(resultRefCanvasRef.current, `fixed_${stamp}.png`);
    exportCanvasAsPng(resultPatCanvasRef.current, `registered_${stamp}.png`);

    const metricsBlob = new Blob(
      [JSON.stringify({ dimension: registrationDimension, mode: registrationMode, metrics: autoAlignMetrics || null }, null, 2)],
      { type: 'application/json' }
    );
    const metricsUrl = URL.createObjectURL(metricsBlob);
    const metricsLink = document.createElement('a');
    metricsLink.href = metricsUrl;
    metricsLink.download = `registration_metrics_${stamp}.json`;
    metricsLink.click();
    URL.revokeObjectURL(metricsUrl);
  };

  if (!registrationDimension) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#eef4ff] text-[#12223a]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(37,99,235,0.10),transparent_45%,rgba(99,102,241,0.10))]" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#2563eb]">VisionMed Registration Hub</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0f172a] sm:text-4xl">Choisissez le mode de recalage</h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#4b5563] sm:text-sm">Ce choix détermine le panneau clinique chargé en premier.</p>
          </div>

          <div className="mb-6 overflow-hidden rounded-2xl border border-[#bfdbfe] bg-white shadow-[0_12px_26px_rgba(37,99,235,0.12)]">
            <div className="relative h-44 sm:h-56">
              <img
                src="/assets/images/recalage.jpg"
                alt="Imagerie de recalage médical"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(4,25,46,0.90)_10%,rgba(6,78,123,0.78)_45%,rgba(251,146,60,0.45)_100%)]" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 sm:p-4">
                <span className="rounded-full border border-cyan-200/40 bg-cyan-300/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
                  Imagerie fonctionnelle
                </span>
                <span className="rounded-full border border-indigo-200/40 bg-indigo-300/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-100">
                  Cartographie cérébrale
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <p className="text-lg font-black text-white sm:text-xl">Recalage orienté médecine nucléaire</p>
                <p className="mt-1 max-w-2xl text-xs text-cyan-50/90 sm:text-sm">
                  Fusion atlas-patient pour l'analyse fonctionnelle et anatomique en contexte clinique neuro et oncologique.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.09em] text-[#dbeafe]">
                  <span className="rounded-md border border-cyan-200/35 bg-cyan-300/15 px-2 py-1">Quantification métabolique</span>
                  <span className="rounded-md border border-indigo-200/35 bg-indigo-300/15 px-2 py-1">Superposition multimodale</span>
                  <span className="rounded-md border border-amber-200/35 bg-amber-300/20 px-2 py-1">Planification thérapeutique</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <button
              onClick={() => void handleChooseRegistrationDimension('2d')}
              className="group relative rounded-[20px] border-2 border-[#2563eb] bg-[linear-gradient(150deg,#f8fcff_0%,#ecf7ff_58%,#e0f2ff_100%)] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(37,99,235,0.26)] sm:p-7"
            >
              <div className="mb-5">
                <div className="inline-flex rounded-2xl border border-[#93c5fd] bg-[#dbeafe] p-3 text-[#1d4ed8] shadow-sm shadow-blue-300/40">
                  <MousePointer2 className="h-6 w-6" />
                </div>
              </div>
              <h2 className="text-xl font-black text-[#0f172a] sm:text-[40px] sm:leading-none">Recalage 2D</h2>
              <p className="mt-2 text-lg font-black leading-tight text-[#0f6cc8] sm:text-[22px]">
                Précision chirurgicale, image par image
              </p>
              <p className="mt-3 max-w-[95%] text-xs leading-relaxed text-[#334155] sm:text-sm">
                Importez vos images fixed et moving, effectuez un recalage manuel ou automatique, puis exportez les résultats annotés.
              </p>

              <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#64748b]">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#0ea5e9]"/>Import</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#0ea5e9]"/>Recalage</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#0ea5e9]"/>Export</span>
              </div>

              <p className="mt-6 text-[12px] font-black uppercase tracking-[0.08em] text-[#0f6cc8]">Workflow image par image</p>
              <div className="mt-4 border-t border-[#cfe5ff] pt-3 text-xs text-[#64748b]">
                <span className="font-semibold">Complexité</span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#0ea5e9]"/>
                  <span className="h-3 w-3 rounded-full bg-[#0ea5e9]"/>
                  <span className="h-3 w-3 rounded-full bg-[#bfdbfe]"/>
                </span>
                <span className="ml-2 font-semibold">Intermédiaire</span>
              </div>
            </button>

            <button
              onClick={() => void handleChooseRegistrationDimension('3d')}
              className="group relative rounded-[20px] border-2 border-[#5b46d8] bg-[linear-gradient(150deg,#f8f7ff_0%,#f1efff_56%,#e9e5ff_100%)] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(91,70,216,0.26)] sm:p-7"
            >
              <div className="mb-5 inline-flex rounded-2xl border border-[#c4b5fd] bg-[#ede9fe] p-3 text-[#5b46d8] shadow-sm shadow-violet-300/40">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-black text-[#0f172a] sm:text-[40px] sm:leading-none">Recalage 3D</h2>
              <p className="mt-2 text-lg font-black leading-tight text-[#5b46d8] sm:text-[22px]">
                De l'atlas au patient, un alignement volumique complet
              </p>
              <p className="mt-3 max-w-[95%] text-xs leading-relaxed text-[#334155] sm:text-sm">
                Ouvrez le panneau atlas/patient, naviguez dans les coupes volumiques, confirmez le recalage et identifiez les régions corticales.
              </p>

              <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#64748b]">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]"/>Atlas</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]"/>Navigation</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]"/>Brodmann</span>
              </div>

              <p className="mt-6 text-[12px] font-black uppercase tracking-[0.08em] text-[#5b46d8]">Workflow volumique + Brodmann</p>
              <div className="mt-4 border-t border-[#ddd6fe] pt-3 text-xs text-[#64748b]">
                <span className="font-semibold">Complexité</span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#7c3aed]"/>
                  <span className="h-3 w-3 rounded-full bg-[#7c3aed]"/>
                  <span className="h-3 w-3 rounded-full bg-[#7c3aed]"/>
                </span>
                <span className="ml-2 font-semibold">Avancé</span>
              </div>
            </button>
          </div>

          <div className="relative mt-7 flex justify-center sm:mt-9">
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full border border-[#dbe7fb] bg-[#ffffff] p-2 shadow-lg">
              <ArrowDown className="h-6 w-6 text-[#2c3038]" />
            </div>
            <button
              onClick={() => onNavigate('')}
              className="rounded-xl border border-[#cddcf9] bg-[#ffffff] px-5 py-2.5 text-[11px] font-bold text-[#1e3a8a] transition-all hover:border-[#93c5fd] hover:bg-[#eff6ff]"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0c10] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl"/>
      </div>
      {ripples.map(r=>(
        <div key={r.id} className="fixed pointer-events-none rounded-full border-2 border-blue-400/70 z-[9999] animate-ping"
          style={{left:r.x-16,top:r.y-16,width:32,height:32,animationDuration:'0.5s'}}/>
      ))}

      {/* Shortcuts modal */}
      {showShortcuts&&(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={()=>setShowShortcuts(false)}/>
          <div className="relative bg-white border border-slate-200 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Keyboard className="w-4 h-4 text-blue-500"/>Raccourcis clavier</h3>
              <button onClick={()=>setShowShortcuts(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-2.5">
              {[{keys:['Alt','Clic'],desc:'Panoramique'},{keys:['Scroll'],desc:'Zoom in/out'},{keys:['Clic droit'],desc:'Supprimer un point'},{keys:['G'],desc:'Afficher/Masquer grille'},{keys:['R'],desc:'Réinitialiser la vue'},{keys:['Esc'],desc:'Fermer'},{keys:['?'],desc:'Afficher raccourcis'}].map(({keys,desc})=>(
                <div key={desc} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{desc}</span>
                  <div className="flex gap-1">{keys.map(k=><kbd key={k} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600">{k}</kbd>)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-72 flex-none bg-[#0d0f14] border-r border-white/[0.06] flex flex-col z-20 shadow-2xl">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BrainCircuit className="text-white w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">VisionMed</h1>
              <p className="text-[9px] font-bold text-white/30 tracking-[0.2em] uppercase">Registration Hub</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
              <span className="text-[10px] text-white/40 font-medium truncate max-w-[80px]">{user.username}</span>
            </div>
          </div>
        </div>

        {/* Progression */}
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-2">Progression</p>
          <div className="flex items-center gap-0">
            {[{label:'Import',done:phase>=1,active:phase===1,color:'bg-blue-600'},{label:'Recalage',done:phase>=2,active:phase===2,color:'bg-violet-600'},{label:'Brodmann',done:phase>=3,active:phase===3,color:'bg-emerald-600'}].map(({label,done,active,color},i,arr)=>(
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${done?`${color} shadow-lg ${active?'ring-4 ring-white/10':''}`:'bg-white/5 border border-white/10'}`}>
                    {done && phase > i+1 ? <Check className="w-3 h-3 text-white"/> : <span className={`text-[9px] font-bold ${done?'text-white':'text-white/20'}`}>{i+1}</span>}
                  </div>
                  <span className={`text-[8px] font-semibold whitespace-nowrap ${done?'text-white/80':'text-white/20'}`}>{label}</span>
                </div>
                {i<arr.length-1&&<div className={`flex-1 h-px mb-4 mx-1 transition-colors duration-500 ${done?'bg-white/10':'bg-white/5'}`}/>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Compteur de points (uniquement en manuel) */}
        {showManualActions&&(
          <div className="px-4 py-2 border-b border-white/[0.06]">
            <div className="flex gap-1.5 mb-1.5">
              <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="w-1 h-1 rounded-full bg-blue-500"/><span className="text-[10px] text-blue-400 font-bold">Référence</span>
                <span className="ml-auto text-xs font-black text-blue-400">{refPts}</span>
              </div>
              <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <span className="w-1 h-1 rounded-full bg-violet-500"/><span className="text-[10px] text-violet-400 font-bold">Patient</span>
                <span className="ml-auto text-xs font-black text-violet-400">{patPts}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold ${pointsStatus==='ready'?'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400':pointsStatus==='unbalanced'?'bg-orange-500/10 border border-orange-500/20 text-orange-400':pointsStatus==='partial'?'bg-blue-500/10 border border-blue-500/20 text-blue-400':'bg-white/5 border border-white/5 text-white/20'}`}>
              {pointsStatus==='ready'?'✅ Prêt':pointsStatus==='unbalanced'?`⚠️ ${refPts}/${patPts}`:pointsStatus==='partial'?`Encore ${4-Math.min(refPts,patPts)} pts`:'Clic pour ajouter des points'}
            </div>

            <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/8 px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-cyan-300">Grille de repère</span>
                <button
                  onClick={() => setShowGrid(v => !v)}
                  className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wide transition-colors ${showGrid ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40' : 'bg-white/5 text-white/40 border border-white/10'}`}
                  title="Afficher ou masquer la grille (G)"
                >
                  {showGrid ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">Pas</span>
                <input
                  type="range"
                  min="16"
                  max="80"
                  step="4"
                  value={gridSize}
                  onChange={e => setGridSize(Number(e.target.value))}
                  className="h-1 w-full rounded-full appearance-none cursor-pointer bg-white/10 accent-cyan-400"
                  disabled={!showGrid}
                />
                <span className="w-9 text-right text-[9px] font-bold text-cyan-200/90">{gridSize}</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode selector or Phase 3 Info */}
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
          {phase === 3 ? (
            <div className="space-y-3">
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Mode Brodmann</p>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <p className="text-[10px] font-bold text-emerald-300">Navigation centralisee</p>
                <p className="mt-1 text-[9px] text-white/50">
                  Utilisez le slider principal sous les images et les boutons A/C/S pour changer les coupes.
                </p>
              </div>
            </div>
          ) : referenceImage.src&&patientImage.src?(
            <RegistrationModeSelector selectedMode={registrationMode as any} onModeChange={setRegistrationMode as any} disabled={autoAlignStatus==='processing'}/>
          ):(
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Mode de Recalage</p>
              <div className="rounded-lg border border-white/[0.06] px-3 py-2 bg-white/[0.02] text-[10px] text-white/20 text-center italic">Importez les deux images pour choisir le mode</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 py-3 space-y-2 flex-1">
          {phase === 3 ? (
            <>
              <button onClick={handleBackToRegistration} className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold text-white/60 hover:bg-white/10 flex items-center justify-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5"/> Retour au Recalage
              </button>
              <button onClick={startNewRegistration} className="w-full py-2.5 px-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/15 flex items-center justify-center gap-2 transition-colors">
                <RotateCcw className="w-3.5 h-3.5"/> Nouveau recalage
              </button>

              <div className="mt-2 rounded-2xl border border-cyan-300/35 bg-[linear-gradient(160deg,rgba(8,47,73,0.55),rgba(8,47,73,0.20))] p-3 shadow-[0_12px_28px_rgba(14,116,144,0.22)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black text-cyan-100 uppercase tracking-[0.12em]">Zones corticales</p>
                  <span className="rounded-full border border-cyan-300/45 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-black text-cyan-100">
                    {availableCorticalZones.length}
                  </span>
                </div>

                {atlasSource !== 'official' ? (
                  <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold leading-relaxed text-amber-100/90">
                    Atlas personnalise: liste officielle indisponible.
                  </p>
                ) : loadingCorticalZones ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-white/65">
                    Chargement des zones...
                  </p>
                ) : availableCorticalZones.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-white/65">
                    Aucune zone disponible.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {availableCorticalZones.map((item) => {
                      const active = zone?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[10px] transition-colors ${active ? 'border-emerald-300/45 bg-emerald-500/18 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.16)]' : 'border-cyan-200/15 bg-white/[0.04] text-white/75 hover:bg-white/[0.07]'}`}
                        >
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-emerald-400/25 text-emerald-100' : 'bg-blue-500/20 text-blue-200'}`}>
                            {item.id}
                          </span>
                          <span className="truncate font-semibold">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={startNewRegistration} className="w-full py-2.5 px-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/15 flex items-center justify-center gap-2 transition-colors">
                <RotateCcw className="w-3.5 h-3.5"/> Nouveau recalage
              </button>

              {showManualButton && (
                <button
                  onClick={undoLastPoint}
                  disabled={refPts === 0 && patPts === 0}
                  title="Annuler le dernier point (Ctrl+Z)"
                  className={`w-full py-2 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border ${
                    refPts === 0 && patPts === 0
                      ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                      : 'border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <Undo2 className="w-3.5 h-3.5"/> Annuler
                </button>
              )}

              {showAutoButton&&(
                <button onClick={handleAutoAlign} disabled={autoAlignStatus==='processing'}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 group relative overflow-hidden ${autoAlignStatus==='processing'?'bg-white/5 text-white/20 cursor-not-allowed':'text-white hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-600/20'}`}
                  style={{background:autoAlignStatus==='processing'?undefined:'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)'}}>
                  {autoAlignStatus==='processing'? (
                    <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"/><span>Analyse GPU...</span></div>
                  ):(<><BrainCircuit className="w-4 h-4 group-hover:rotate-12 transition-transform"/>Lancer Automatique</>)}
                </button>
              )}

              {showManualActions&&(
                <button onClick={handleManualAlign} disabled={autoAlignStatus==='processing'||!canRunManualAlign}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${!canRunManualAlign?'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed':'bg-white text-[#0a0c10] hover:bg-white/90 shadow-xl shadow-white/5'}`}>
                  <MousePointer2 className="w-4 h-4"/>Recalage Manuel
                </button>
              )}

              {showManualActions&&!canAlign&&refPts<4&&<p className="text-[10px] text-white/20 text-center leading-relaxed">Marquez au moins 4 points sur chaque image.</p>}
              {showManualActions&&is3D&&canAlign&&!slicesVerified&&(
                <p className="text-[10px] text-amber-300/90 text-center leading-relaxed">
                  Verifiez et confirmez d'abord la coupe Atlas et la coupe Patient.
                </p>
              )}
            </>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            {[{icon:<Download className="w-4 h-4"/>,onClick:exportResults,title:'Exporter'},{icon:<Eye className="w-4 h-4"/>,onClick:()=>setShowMagnifier(s=>!s),title:'Loupe',active:showMagnifier},{icon:<Undo2 className="w-4 h-4"/>,onClick:undoLastPoint,title:'Annuler dernier point (Ctrl+Z)',disabled:refPts===0&&patPts===0},{icon:<Trash2 className="w-4 h-4"/>,onClick:clearAllPoints,title:'Effacer tous les points'},{icon:<Keyboard className="w-4 h-4"/>,onClick:()=>setShowShortcuts(s=>!s),title:'Raccourcis (?)',active:showShortcuts}].map(({icon,onClick,title,active,disabled}:any)=>(
              <button key={title} title={title} onClick={onClick} disabled={disabled} className={`p-2 rounded-lg transition-colors ${active?'bg-blue-600/20 text-blue-400':disabled?'opacity-20 cursor-not-allowed text-white/10':'hover:bg-white/5 text-white/30 hover:text-white/60'}`}>{icon}</button>
            ))}
            <div className="flex items-center gap-1">
              <button onClick={()=>setRefView(v=>({...v,scale:Math.min(v.scale*1.2,10)}))} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors" title="Zoom +"><ZoomIn className="w-3.5 h-3.5"/></button>
              <button onClick={()=>{setRefView(DEFAULT_VIEW);setPatView(DEFAULT_VIEW);}} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors" title="Reset (R)"><RotateCcw className="w-3.5 h-3.5"/></button>
              <button onClick={()=>setRefView(v=>({...v,scale:Math.max(v.scale*0.8,0.3)}))} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors" title="Zoom -"><ZoomOut className="w-3.5 h-3.5"/></button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        <input
          ref={patientVolumeInputRef}
          type="file"
          accept=".nii,.nii.gz,image/*"
          className="hidden"
          onChange={handlePatientVolumePick}
        />
        <input
          ref={atlasVolumeInputRef}
          type="file"
          accept=".nii,.nii.gz,image/*"
          className="hidden"
          onChange={handleAtlasVolumePick}
        />

        {/* Magnifier */}
        <div className="fixed pointer-events-none z-50 rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-[#0a0c10]"
          style={{display:showMagnifier?'block':'none',left:magnifierPos.x+24,top:magnifierPos.y+24,width:160,height:160}}>
          <canvas ref={magnifierCanvasRef} width={160} height={160} className="w-full h-full opacity-90"/>
        </div>

        <div className="flex-1 p-4 flex gap-4 overflow-hidden relative">
          {/* Editor panels (Phase 2) */}
          {phase !== 3 && (
            <div className={`flex-1 flex gap-4 transition-all duration-700 relative ${showResult?'opacity-0 pointer-events-none absolute inset-4':''}`}>
              {(['reference','patient'] as const).map((type)=>{
                const img=type==='reference'?referenceImage:patientImage;
                const active=activeImage===type;
                const canRef=type==='reference'?refCanvasRef:patCanvasRef;
                const label=type==='reference'?'Référence':'Patient';
                const color=type==='reference'?'#3b82f6':'#8b5cf6';
                const accent=type==='reference'?'border-blue-500/40 shadow-blue-500/10':'border-violet-500/40 shadow-violet-500/10';
                const ringOff=type==='reference'?'border-white/[0.06] hover:border-blue-500/20':'border-white/[0.06] hover:border-violet-500/20';
                const pts=type==='reference'?refPts:patPts;
                return(
                  <div key={type} className={`flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden relative transition-all duration-300 border ${active?`${accent} shadow-xl ring-1 ring-inset ring-white/10`:`border-white/[0.06] shadow-sm ${ringOff}`} bg-[#0d0f14]`}>
                    <div className="absolute top-3 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0f14]/80 backdrop-blur border border-white/10 shadow-2xl">
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:color,boxShadow:`0 0 10px ${color}`}}/>
                      <span className="text-[11px] font-bold text-white/80 tracking-wide uppercase">{label}</span>
                      {pts>0&&<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-slate-500" style={{background:color+'15'}}>{pts} pts</span>}
                    </div>
                    {img.src&&(
                      <button onClick={()=>type==='reference'?setRefView(DEFAULT_VIEW):setPatView(DEFAULT_VIEW)}
                        className="absolute top-3 right-14 z-10 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/10 transition-all flex items-center gap-1 shadow-2xl">
                        <RotateCcw className="w-3 h-3"/>Reset
                      </button>
                    )}
                    {active&&(
                      <div className="absolute top-3 right-3 z-10">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 shadow-xl">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>ACTIF
                        </span>
                      </div>
                    )}
                    {type === 'patient' && is3D && (
                      <div className="absolute top-14 right-3 z-20 flex flex-col gap-2">
                        <button
                          onClick={() => patientVolumeInputRef.current?.click()}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/12 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-blue-500/18 transition-colors flex items-center justify-center gap-1.5 min-w-[148px]"
                          title="Importer patient"
                        >
                          <Upload className="w-3.5 h-3.5"/> Importer patient
                        </button>
                        <button
                          onClick={loadFreshAtlasAndDemo}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/18 transition-colors flex items-center justify-center gap-1.5 min-w-[148px]"
                          title="Ajouter patient test 3D"
                        >
                          <BrainCircuit className="w-3.5 h-3.5"/> Patient test 3D
                        </button>
                        <button
                          onClick={() => setShowPatientOrientation(v => !v)}
                          className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/12 px-2.5 py-1.5 text-[10px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/18 transition-colors flex items-center justify-center gap-1.5 min-w-[148px]"
                          title="Orientation patient"
                        >
                          <RotateCcw className="w-3.5 h-3.5"/> Orientation
                        </button>
                      </div>
                    )}
                    {type === 'patient' && is3D && showPatientOrientation && (
                      <div className="absolute top-44 right-3 z-30">
                        <OrientationPanel
                          patientId={Number.parseInt(jobId.replace(/-/g, '').slice(0, 8), 16) || 0}
                          onChange={(state: OrientationState) => setPatientOrientation(state)}
                          onSave={async () => Promise.resolve()}
                        />
                      </div>
                    )}
                    {type === 'reference' && is3D && (
                      <div className="absolute top-14 right-3 z-20 flex flex-col gap-2">
                        <button
                          onClick={switchToOfficialAtlas}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/18 transition-colors flex items-center justify-center gap-1.5 min-w-[168px]"
                          title="Charger atlas Harvard-Oxford"
                        >
                          <BrainCircuit className="w-3.5 h-3.5"/> Atlas officiel
                        </button>
                        <button
                          onClick={() => atlasVolumeInputRef.current?.click()}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/12 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/18 transition-colors flex items-center justify-center gap-1.5 min-w-[168px]"
                          title="Uploader atlas personnalisé (.nii/.nii.gz ou image 2D)"
                        >
                          <Upload className="w-3.5 h-3.5"/> Uploader atlas perso
                        </button>
                        <p className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-semibold text-white/70 text-center">
                          Source atlas: {atlasSource === 'official' ? 'Harvard-Oxford' : 'Personnalisee'}
                        </p>
                      </div>
                    )}
                    {is2D && (
                      <label className="absolute top-3 right-3 z-20 rounded-lg border border-blue-500/30 bg-blue-500/12 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-blue-500/18 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-w-[128px]">
                        <Upload className="w-3.5 h-3.5" />
                        {type === 'reference' ? 'Importer fixed' : 'Importer moving'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f, type);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    )}
                    <div className="flex-1 min-h-0 relative flex items-center justify-center">
                      {img.src?(
                        <canvas ref={canRef} onClick={e=>handleCanvasClick(e,type)} onContextMenu={e=>handleContextMenu(e,type)} onWheel={e=>handleWheel(e,type)} onMouseDown={e=>handleMouseDown(e,type)} onMouseMove={e=>handleMouseMove(e,type)} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} className={`w-full h-full ${active?'cursor-crosshair':'cursor-grab'}`}/>
                      ):(
                        <label className="flex flex-col items-center justify-center w-full h-full rounded-xl cursor-pointer p-8 m-4 border-2 border-dashed border-white/5 hover:border-blue-500/30 hover:bg-white/[0.02] group transition-all">
                          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-2xl">
                            <Upload className="w-6 h-6 text-white/20 group-hover:text-blue-400 transition-colors"/>
                          </div>
                          <span className="text-sm font-bold text-white/30 group-hover:text-white/60 mb-1">Importer {label}</span>
                          <span className="text-[10px] text-white/10 font-bold tracking-widest uppercase">Select Image</span>
                          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)handleImageUpload(f,type);}} className="hidden"/>
                        </label>
                      )}
                    </div>

                    {type === 'reference' && is3D && jobId && referenceImage.src && patientImage.src && (
                      <div className="shrink-0 border-t border-white/[0.06] bg-[#111827]/65 px-3 py-3 space-y-2.5">
                        {atlasSource === 'custom' && (
                          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold text-amber-100">
                            Atlas personnalise actif: l'identification Brodmann est limitee. Utilisez l'atlas officiel pour les zones Harvard-Oxford.
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-blue-200/85 uppercase tracking-[0.14em]">Selection de coupe atlas</p>
                          <p className="text-[10px] font-black text-blue-100">{index + 1} / {maxIndex + 1}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {axisOptions.map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => {
                                const target = key === 'axial'
                                  ? Math.floor((sliceShape?.z ?? maxIndex + 1) / 2)
                                  : key === 'coronal'
                                    ? Math.floor((sliceShape?.y ?? maxIndex + 1) / 2)
                                    : Math.floor((sliceShape?.x ?? maxIndex + 1) / 2);
                                queuePhase2SliceFetch(key, target);
                              }}
                              className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${axis===key ? 'border-blue-300/60 bg-blue-500/20 text-blue-100' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/90'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="rounded-xl border border-blue-300/20 bg-slate-950/45 px-3 py-2.5">
                          <div className="mb-1.5 flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-white/55">Coupe {axis}</span>
                            <span className="font-black text-blue-200">{index + 1} / {maxIndex + 1}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, maxIndex)}
                            value={index}
                            onChange={e => queuePhase2SliceFetch(axis, Number(e.target.value))}
                            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-blue-400"
                          />
                          {suggestedSlice && suggestedSlice.axis === axis && suggestedSlice.index === index && (
                            <p className="mt-1.5 text-[9px] font-semibold text-blue-300">Suggestion de l'algorithme</p>
                          )}
                        </div>

                        <button
                          onClick={handleConfirmAtlasSlice}
                          disabled={sliceLoading}
                          className={`w-full rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${atlasSliceConfirmed ? 'border-emerald-400/35 bg-emerald-500/20 text-emerald-200' : 'border-blue-300/35 bg-blue-500/15 text-blue-100 hover:bg-blue-500/20'} ${sliceLoading ? 'opacity-60 cursor-wait' : ''}`}
                        >
                          {atlasSliceConfirmed ? 'Atlas verifie' : 'Verifier cette coupe atlas'}
                        </button>

                        {atlasSliceConfirmed && (
                          <div className="flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200">
                            <Check className="h-3.5 w-3.5" />
                            <span>Atlas {axis} n°{index + 1} verifie</span>
                          </div>
                        )}

                        {atlasSliceError && <p className="text-[10px] text-rose-300">{atlasSliceError}</p>}
                      </div>
                    )}

                    {type === 'patient' && is3D && jobId && referenceImage.src && patientImage.src && (
                      <div className="shrink-0 border-t border-white/[0.06] bg-[#0b1220]/65 px-3 py-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-cyan-200/80 uppercase tracking-[0.14em]">Selection de coupe patient</p>
                          <p className="text-[10px] font-black text-cyan-100">{index + 1} / {maxIndex + 1}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {axisOptions.map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => {
                                const target = key === 'axial'
                                  ? Math.floor((sliceShape?.z ?? maxIndex + 1) / 2)
                                  : key === 'coronal'
                                    ? Math.floor((sliceShape?.y ?? maxIndex + 1) / 2)
                                    : Math.floor((sliceShape?.x ?? maxIndex + 1) / 2);
                                queuePhase2SliceFetch(key, target);
                              }}
                              className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${axis===key ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/90'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="rounded-xl border border-cyan-300/20 bg-slate-950/45 px-3 py-2.5">
                          <div className="mb-1.5 flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-white/55">Coupe {axis}</span>
                            <span className="font-black text-cyan-200">{index + 1} / {maxIndex + 1}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, maxIndex)}
                            value={index}
                            onChange={e => queuePhase2SliceFetch(axis, Number(e.target.value))}
                            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-cyan-400"
                          />
                          {suggestedSlice && suggestedSlice.axis === axis && suggestedSlice.index === index && (
                            <p className="mt-1.5 text-[9px] font-semibold text-cyan-300">Suggestion de l'algorithme</p>
                          )}
                        </div>

                        <button
                          onClick={handleConfirmSlice}
                          disabled={sliceLoading}
                          className={`w-full rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${sliceConfirmed ? 'border-emerald-400/35 bg-emerald-500/20 text-emerald-200' : 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20'} ${sliceLoading ? 'opacity-60 cursor-wait' : ''}`}
                        >
                          {sliceConfirmed ? 'Coupe confirmee' : 'Confirmer cette coupe'}
                        </button>

                        {sliceConfirmed && (
                          <div className="flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200">
                            <Check className="h-3.5 w-3.5" />
                            <span>Coupe {axis} n°{index + 1} confirmee</span>
                          </div>
                        )}

                        {sliceError && <p className="text-[10px] text-rose-300">{sliceError}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Identification View (Phase 3) */}
           {phase === 3 && (
            <div className="flex-1 min-h-0 flex gap-6 animate-in slide-in-from-right-12 duration-700">
              <div className="flex-[2] min-h-0 flex flex-col gap-4">
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
                    <div className="rounded-[2.5rem] overflow-hidden border border-white/10 bg-[#0d0f14] relative shadow-2xl group">
                      <div className="absolute top-4 left-5 z-10 px-3 py-1 rounded-full bg-blue-600/80 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur-md">Atlas de référence</div>
                      <canvas ref={refCanvasRef} onClick={e=>handleBrodmannClick(e,'reference')} onWheel={e=>handleWheel(e,'reference')} onMouseDown={e=>handleMouseDown(e,'reference')} onMouseMove={e=>handleMouseMove(e,'reference')} className="w-full h-full cursor-crosshair group-hover:scale-[1.02] transition-transform duration-700"/>
                      {brodmannTooltip?.panel === 'reference' && (
                        <div
                          className="pointer-events-none absolute z-20 w-[250px] rounded-xl border border-cyan-300/40 bg-[#071426]/90 px-3 py-2 shadow-[0_10px_26px_rgba(8,145,178,0.24)] backdrop-blur-sm"
                          style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}
                        >
                          {brodmannTooltip.insideBrain ? (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200">Zone détectée</p>
                              <p className="mt-0.5 text-[11px] font-black leading-snug text-white">
                                BA {brodmannTooltip.zoneId ?? '--'} - {brodmannTooltip.zoneName || 'Zone corticale'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">Hors cerveau</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-white/80">Aucune aire Brodmann à cet endroit</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[2.5rem] overflow-hidden border border-white/10 bg-[#0d0f14] relative shadow-2xl group">
                      <div className="absolute top-4 left-5 z-10 px-3 py-1 rounded-full bg-violet-600/80 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur-md">Patient recalé</div>
                      <canvas ref={patCanvasRef} onClick={e=>handleBrodmannClick(e,'patient')} onWheel={e=>handleWheel(e,'patient')} onMouseDown={e=>handleMouseDown(e,'patient')} onMouseMove={e=>handleMouseMove(e,'patient')} className="w-full h-full cursor-crosshair group-hover:scale-[1.02] transition-transform duration-700"/>
                      {brodmannTooltip?.panel === 'patient' && (
                        <div
                          className="pointer-events-none absolute z-20 w-[250px] rounded-xl border border-cyan-300/40 bg-[#071426]/90 px-3 py-2 shadow-[0_10px_26px_rgba(8,145,178,0.24)] backdrop-blur-sm"
                          style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}
                        >
                          {brodmannTooltip.insideBrain ? (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200">Zone détectée</p>
                              <p className="mt-0.5 text-[11px] font-black leading-snug text-white">
                                BA {brodmannTooltip.zoneId ?? '--'} - {brodmannTooltip.zoneName || 'Zone corticale'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">Hors cerveau</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-white/80">Aucune aire Brodmann à cet endroit</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Axis Switch + Slider */}
                  <div className="shrink-0 sticky bottom-0 z-20 rounded-[2rem] border border-white/[0.06] bg-[#0d0f14]/92 px-5 py-4 backdrop-blur-xl">
                    <div className="mb-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {axisOptions.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => { setAxis(key); sync3DViews(key, Math.floor(maxIndex / 2)); }}
                            className={`w-full rounded-xl border px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${axis===key ? 'border-blue-400/50 bg-blue-500/20 text-white shadow-lg shadow-blue-500/20' : 'border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90'}`}
                            aria-label={`Changer vers le plan ${label}`}
                            title={label}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Coupe {axis}</p>
                        <p className="text-sm font-black text-blue-300">Z = {index} / {maxIndex}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => sync3DViews(axis, Math.max(0, index - 1))}
                        disabled={index <= 0}
                        className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] text-lg font-bold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Coupe precedente"
                        title="Coupe precedente"
                      >
                        {'<'}
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="range"
                          min={0}
                          max={maxIndex}
                          value={index}
                          onChange={e => sync3DViews(axis, Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer"
                        />
                        <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-blue-500/35 via-violet-500/30 to-cyan-400/35" style={{ clipPath: `inset(0 ${100 - ((index / Math.max(1, maxIndex)) * 100)}% 0 0)` }} />
                      </div>

                      <button
                        onClick={() => sync3DViews(axis, Math.min(maxIndex, index + 1))}
                        disabled={index >= maxIndex}
                        className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] text-lg font-bold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Coupe suivante"
                        title="Coupe suivante"
                      >
                        {'>'}
                      </button>
                    </div>
                  </div>
               </div>
               <div className="flex-1 min-w-[320px]">
                  <BrodmannIdentificationView 
                    zone={zone} 
                    insideBrain={insideBrain} 
                    hasAttempt={hasBrodmannAttempt}
                    axis={axis} 
                    index={index} 
                    maxIndex={maxIndex}
                  />
               </div>
            </div>
          )}

          {/* Result panel */}
          {showResult&&(
            <div className="absolute inset-0 z-40 flex animate-in fade-in zoom-in-95 duration-300">
              <div ref={resultVisualRef} className="flex-1 relative bg-[#0a0c10] flex items-center justify-center overflow-hidden">
                {/* Mode tabs */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 p-1 bg-[#0d0f14]/85 backdrop-blur-md rounded-full border border-white/10">
                  {(['overlay','split','heatmap'] as const).map(mode=>(
                    <button key={mode} onClick={()=>setVisMode(mode)} className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${visMode===mode?'bg-blue-600 text-white':'text-white/45 hover:text-white/75'}`}>
                      {mode==='overlay'?'Superposition':mode==='split'?'Comparaison':'Différences'}
                    </button>
                  ))}
                </div>

                <div className="relative w-full h-full p-10 flex items-center justify-center">
                  <div className="relative" style={{width:'600px',height:'600px',maxWidth:'100%',maxHeight:'100%'}}>
                    <canvas ref={resultRefCanvasRef} width={600} height={600} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
                    <div style={{position:'absolute',inset:0,opacity:visMode==='overlay'?alphaBlending/100:1,clipPath:visMode==='split'?`inset(0 ${100-splitPos}% 0 0)`:'none'}}>
                      <canvas ref={resultPatCanvasRef} width={600} height={600} style={{width:'100%',height:'100%'}}/>
                    </div>
                    {/* Split draggable */}
                    {visMode==='split'&&(
                      <div className="absolute top-0 bottom-0 z-20" style={{left:`${splitPos}%`}}>
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" style={{boxShadow:'0 0 15px rgba(255,255,255,0.1)'}}/>
                        <div className="absolute top-4 bg-violet-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full -translate-x-14 shadow-lg">Patient</div>
                        <div className="absolute top-4 translate-x-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">Référence</div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0d0f14] rounded-full border border-white/10 shadow-2xl flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform"
                          onMouseDown={e=>{e.preventDefault();setIsDraggingSplit(true);}}>
                          <Layers className="w-4 h-4 text-white/70"/>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 px-4 py-2.5 bg-[#0d0f14]/85 backdrop-blur-xl rounded-xl border border-white/10">
                  {visMode==='overlay' && (
                    <>
                      <div className="mb-1.5 flex justify-between text-[9px] font-semibold text-white/35 uppercase tracking-[0.14em]">
                        <span>Transparence PET</span>
                        <span>{alphaBlending}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={alphaBlending} onChange={e=>setAlphaBlending(Number(e.target.value))} className="w-full h-1 rounded-full appearance-none cursor-pointer accent-blue-500 bg-white/10"/>
                    </>
                  )}
                  {visMode==='split' && (
                    <>
                      <div className="mb-1.5 flex justify-between text-[9px] font-semibold text-white/35 uppercase tracking-[0.14em]">
                        <span>Position slider</span>
                        <span>{splitPos}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={splitPos} onChange={e=>setSplitPos(Number(e.target.value))} className="w-full h-1 rounded-full appearance-none cursor-pointer accent-white bg-white/10"/>
                    </>
                  )}
                </div>
                <button onClick={()=>{setShowResult(false);setShowValidationModal(false);}} className="absolute top-4 right-4 z-50 p-2 bg-[#0d0f14]/60 hover:bg-[#0d0f14] rounded-full text-white/40 hover:text-white shadow-2xl transition-colors border border-white/10"><X className="w-4 h-4"/></button>
              </div>

              {/* Stats side */}
              <div className="w-64 flex-none bg-[#0d0f14] border-l border-white/10 flex flex-col p-4 overflow-y-auto">
                <div className="mb-5 border-b border-white/5 pb-4">
                  <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-7 bg-blue-500 rounded-full"/>
                    Recalage Terminé
                  </h3>
                  <p className="text-[9px] text-white/40 mt-1 uppercase tracking-[0.16em] font-bold flex items-center gap-2 opacity-70">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"/>
                    {registrationMode==='mine'?'Modèle Deep Learning AI':'Alignement Spatial Manuel'}
                  </p>
                </div>

                {registrationMode === 'manual' && (
                  <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-3">
                    <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">Recommendation clinique</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/72">
                      Pour un recalage plus robuste et reproductible, nous recommandons un second passage en mode automatique (Deep Learning AI).
                    </p>
                    <button
                      onClick={handleRecommendedAutoAlign}
                      disabled={autoAlignStatus === 'processing'}
                      className="mt-2.5 w-full rounded-lg border border-cyan-300/35 bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Essayer le mode auto recommande
                    </button>
                  </div>
                )}

                {/* Légende heatmap */}
                {visMode==='heatmap'&&(
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] mb-4 backdrop-blur-md">
                    <p className="text-[9px] font-bold text-white/45 uppercase tracking-[0.16em] mb-3">Interprétation</p>
                    <div className="h-2.5 rounded-full mb-1" style={{background:'linear-gradient(90deg,#2563eb,#06b6d4,#22c55e,#facc15,#ef4444)'}}/>
                    <div className="flex justify-between mb-3">
                      <span className="text-[9px] text-blue-400 font-bold uppercase">Aligné</span>
                      <span className="text-[9px] text-red-400 font-bold uppercase">Décalé</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        {color:'#2563eb',label:'Parfait',desc:'Structures superposées'},
                        {color:'#06b6d4',label:'Bon',desc:'Différence résiduelle'},
                        {color:'#facc15',label:'Moyen',desc:'Décalage modéré'},
                        {color:'#ef4444',label:'Décalé',desc:'Zone à corriger'},
                      ].map(({color,label,desc})=>(
                        <div key={label} className="flex items-center gap-2.5 group">
                          <span className="w-2 rounded-full h-2 shrink-0 group-hover:scale-125 transition-transform" style={{background:color,boxShadow:`0 0 8px ${color}40`}}/>
                          <span className="text-[11px] font-bold text-white/70 w-14">{label}</span>
                          <span className="text-[10px] text-white/30">{desc}</span>
                        </div>
                      ))}
                    </div>
                    {(window as any).__heatmapAlignPct!==undefined&&(
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-white/20">Pixels alignés</span>
                        <span className="text-sm font-black text-emerald-400">{(window as any).__heatmapAlignPct}%</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">

                  {/* Gauge MI */}
                  <div className="rounded-2xl p-4 border transition-all duration-500" style={{borderColor:miColor+'20',background:miColor+'05'}}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/30 mb-0.5">Indice de Confiance</span>
                        <span className="text-[11px] font-bold tracking-wide" style={{color:miColor}}>INFO. MUTUELLE</span>
                      </div>
                      <span className={`text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.14em] ${miBadgeBg}`}>{miQuality}</span>
                    </div>
                    <div className="flex justify-center mb-2 relative group">
                      <div className="absolute inset-0 bg-[miColor]/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"/>
                      <svg width="140" height="85" viewBox="0 0 120 75" className="relative z-10">
                        <path d="M 12 70 A 48 48 0 0 1 108 70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" strokeLinecap="round"/>
                        {mi!==undefined&&(()=> {
                          const pct = Math.min(0.999, Math.max(0.001, mi / 0.6));
                          const circumference = Math.PI * 48;
                          const dash = pct * circumference;
                          return (
                            <path d="M 12 70 A 48 48 0 0 1 108 70" fill="none" stroke={miColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} style={{filter:`drop-shadow(0 0 8px ${miColor}60)`}} className="transition-all duration-1000 ease-out"/>
                          );
                        })()}
                        <text x="60" y="65" textAnchor="middle" fill="white" fontSize="22" fontStyle="italic" fontWeight="900" style={{fontFamily:'monospace'}}>{mi!==undefined?mi.toFixed(3):'N/A'}</text>
                      </svg>
                    </div>
                    <div className="flex justify-between text-[8px] text-white/20 font-bold px-4 tracking-[0.14em] uppercase">
                      <span>Précision faible</span><span>Optimale</span>
                    </div>
                  </div>

                  {/* Qualité bar */}
                  <div className="rounded-xl p-3.5 bg-white/[0.02] border border-white/[0.06] shadow-inner">
                    <div className="flex justify-between mb-2">
                      <span className="text-[9px] font-bold text-white/28 uppercase tracking-[0.14em]">Qualité finale</span>
                      <span className="text-[9px] font-bold" style={{color:miColor}}>{mi===undefined?'—':mi>0.5?'EXCELLENT':mi>0.3?'CORRECT':'À REVOIR'}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{width:mi!==undefined?`${Math.min(100,(mi/0.6)*100)}%`:'0%',background:miColor,boxShadow:`0 0 10px ${miColor}`}}/>
                    </div>
                  </div>

                  {autoAlignMetrics?.processing_time_ms>0&&(
                    <div className="rounded-xl p-3.5 bg-blue-500/5 border border-blue-500/10">
                      <span className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.14em]">Temps GPU</span>
                      <div className="text-xl font-black text-blue-400 mt-1">{(autoAlignMetrics.processing_time_ms/1000).toFixed(1)}s</div>
                    </div>
                  )}

                </div>

                <div className="mt-auto space-y-3 pt-4 border-t border-white/5">
                  {is3D && !showValidationModal && (
                    <button
                      onClick={() => setShowValidationModal(true)}
                      disabled={autoAlignStatus === 'processing'}
                      className="w-full rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-100 transition-all duration-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Ouvrir validation finale
                    </button>
                  )}

                  <button onClick={exportResults} className="w-full py-2.5 bg-white/5 text-white/45 font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.14em] border border-white/10">
                    <Download className="w-3.5 h-3.5"/>Exporter
                  </button>
                </div>
              </div>

              {is3D && showValidationModal && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-sm"/>
                  <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-[linear-gradient(160deg,rgba(11,24,40,0.98),rgba(7,14,26,0.98))] shadow-[0_20px_56px_rgba(8,145,178,0.18)]">
                    <button
                      onClick={() => setShowValidationModal(false)}
                      className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/5 p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="border-b border-white/10 px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.17em] text-white/45">Validation médicale</p>
                          <h4 className="mt-1.5 text-2xl font-black tracking-tight text-white">Confirmer le résultat du recalage</h4>
                        </div>
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/12 px-3 py-1 text-sm font-black text-emerald-200">
                          <span className="h-2 w-2 rounded-full bg-emerald-300" />
                          {miQuality}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 border-b border-white/10 px-5 py-4">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-[12px] font-semibold text-white/45">Information mutuelle</p>
                        <p className="mt-1.5 text-3xl font-black" style={{ color: miColor }}>
                          {mi !== undefined ? mi.toFixed(3) : 'N/A'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/35">Cohérence inter-modale</p>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: mi !== undefined ? `${Math.min(100, (mi / 0.6) * 100)}%` : '0%',
                              background: miColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-white/10 px-5 py-3.5">
                      <p className="text-base font-semibold text-white/55">Le recalage est terminé. Choisissez une action clinique pour continuer.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r sm:border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Option 1</p>
                        <div className="mt-3 flex items-start gap-2.5">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/14 text-rose-300">
                            <X className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-xl font-black text-rose-200">Rejeter le résultat</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-white/45">Retour au placement de points pour corriger le recalage.</p>
                          </div>
                        </div>

                        <button
                          onClick={handleRejectRegistration}
                          disabled={autoAlignStatus === 'processing'}
                          className="mt-4 w-full rounded-xl border border-rose-300/35 bg-rose-500/10 py-2.5 text-center text-base font-black text-rose-100 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Rejeter →
                        </button>
                      </div>

                      <div className="p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Option 2</p>
                        <div className="mt-3 flex items-start gap-2.5">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/14 text-emerald-300">
                            <Check className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-xl font-black text-emerald-200">Zones corticales</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-white/45">Valider et ouvrir l'identification des zones corticales.</p>
                          </div>
                        </div>

                        <button
                          onClick={handleValidateRegistration}
                          disabled={autoAlignStatus === 'processing'}
                          className="mt-4 w-full rounded-xl border border-emerald-200/35 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 py-2.5 text-center text-base font-black text-slate-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Valider →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AutoAlignOverlay
        isVisible={autoAlignStatus==='processing' || autoAlignStatus==='error'}
        status={autoAlignStatus as any}
        metrics={autoAlignMetrics}
        errorMessage={autoAlignError}
        algorithm="MINE"
        onClose={()=>setAutoAlignStatus('idle')}
      />
    </div>
  );
}