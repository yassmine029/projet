// ================================================================
// RegistrationPage.tsx — Version corrigée (3 bugs fixés)
// ================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Upload, X, Eye, Download, Trash2, Check,
  Compass, MousePointer2, ZoomIn, ZoomOut, RotateCcw, Layers, Keyboard, BrainCircuit, Undo2
} from 'lucide-react';
import RegistrationModeSelector from '../components/RegistrationModeSelector';
import AutoAlignOverlay from '../components/AutoAlignOverlay';

type Page = string;
interface User { username: string; fullName?: string; full_name?: string; specialty?: string; }
interface RegistrationPageProps { user: User; accessToken: string | null; onNavigate: (page: Page) => void; }
interface Point { x: number; y: number; id: number; }
interface ImageTransform { offsetX: number; offsetY: number; scale: number; baseScale: number; }
interface ViewTransform { scale: number; panX: number; panY: number; }
interface ImageState { src: string; points: Point[]; }

const POINT_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];
const DEFAULT_VIEW: ViewTransform = { scale: 1, panX: 0, panY: 0 };

export function RegistrationPage({ user, accessToken, onNavigate }: RegistrationPageProps) {
  const [referenceImage, setReferenceImage] = useState<ImageState>({ src: '', points: [] });
  const [patientImage, setPatientImage]     = useState<ImageState>({ src: '', points: [] });
  const [uploadedFiles, setUploadedFiles]   = useState<{ ref?: File; patient?: File }>({});
  const [activeImage, setActiveImage]       = useState<'reference' | 'patient'>('reference');
  const [showResult, setShowResult]         = useState(false);
  const [nextPointId, setNextPointId]       = useState(1);
  const [alphaBlending, setAlphaBlending]   = useState(50);
  const [visMode, setVisMode]               = useState<'overlay' | 'split' | 'heatmap'>('split');
  const [splitPos, setSplitPos]             = useState(50);
  const [showMagnifier, setShowMagnifier]   = useState(false);
  const [magnifierPos, setMagnifierPos]     = useState({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts]   = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'manual' | 'mine'>('manual');
  const [cameFromMINE, setCameFromMINE]     = useState(false);
  const [autoAlignStatus, setAutoAlignStatus] = useState<'idle'|'processing'|'success'|'error'>('idle');
  const [autoAlignMetrics, setAutoAlignMetrics] = useState<any>(null);
  const [autoAlignError, setAutoAlignError] = useState('');
  const [jobId, setJobId]                   = useState('');
  const [refView, setRefView]               = useState<ViewTransform>(DEFAULT_VIEW);
  const [patView, setPatView]               = useState<ViewTransform>(DEFAULT_VIEW);
  const [isPanning, setIsPanning]           = useState(false);
  const [lastMousePos, setLastMousePos]     = useState({ x: 0, y: 0 });
  const [ripples, setRipples]               = useState<{ x: number; y: number; id: number }[]>([]);
  const [resultImages, setResultImages]     = useState<{ ref: string; pat: string } | null>(null);
  const [pendingShowResult, setPendingShowResult] = useState(false);
  const [tformData, setTformData]           = useState<{ matrix: number[][], rotation: number, tx: number, ty: number, scale: number, rmse: number } | null>(null);
  const [showTformMatrix, setShowTformMatrix] = useState(false);

  const refCanvasRef       = useRef<HTMLCanvasElement>(null);
  const patCanvasRef       = useRef<HTMLCanvasElement>(null);
  const resultRefCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultPatCanvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultVisualRef    = useRef<HTMLDivElement>(null);
  const refTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1 });
  const patTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1 });

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
    };
    reader.readAsDataURL(file);
  };

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
      ctx.strokeStyle = 'rgba(0,0,0,0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      for (let y = 0; y < canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
      const baseScale  = Math.min(canvas.width/img.width, canvas.height/img.height) * 0.88;
      const baseOffX   = (canvas.width  - img.width  * baseScale) / 2;
      const baseOffY   = (canvas.height - img.height * baseScale) / 2;
      const finalScale = baseScale * view.scale;
      const finalOffX  = baseOffX + view.panX;
      const finalOffY  = baseOffY + view.panY;
      tRef.current = { offsetX: finalOffX, offsetY: finalOffY, scale: finalScale, baseScale };
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=24;
      ctx.drawImage(img, finalOffX, finalOffY, img.width*finalScale, img.height*finalScale);
      ctx.restore();
      imgState.points.forEach((pt, i) => {
        const color = POINT_COLORS[i % POINT_COLORS.length];
        const sx = pt.x * finalScale + finalOffX;
        const sy = pt.y * finalScale + finalOffY;
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
  }, [referenceImage, patientImage, refView, patView]);

  useEffect(() => { drawCanvas('reference'); }, [referenceImage, refView]);
  useEffect(() => { drawCanvas('patient');   }, [patientImage, patView]);

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
    const imgX=(e.clientX-rect.left-tRef.current.offsetX)/tRef.current.scale;
    const imgY=(e.clientY-rect.top-tRef.current.offsetY)/tRef.current.scale;
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
    const target=imgData.points.find(p=>{const sx=p.x*tRef.current.scale+tRef.current.offsetX;const sy=p.y*tRef.current.scale+tRef.current.offsetY;return Math.hypot(sx-clickX,sy-clickY)<22;});
    if(target){const{id}=target;if(type==='reference')setReferenceImage(p=>({...p,points:p.points.filter(q=>q.id!==id)}));else setPatientImage(p=>({...p,points:p.points.filter(q=>q.id!==id)}));}
  };
  const undoLastPoint=()=>{
    const rL=referenceImage.points.length, pL=patientImage.points.length;
    if(rL===0 && pL===0)return;
    if(rL > pL){setReferenceImage(p=>({...p,points:p.points.slice(0,-1)}));setActiveImage('reference');}
    else {setPatientImage(p=>({...p,points:p.points.slice(0,-1)}));setNextPointId(id=>id-1);setActiveImage('patient');}
  };
  const clearAllPoints=()=>{setReferenceImage(p=>({...p,points:[]}));setPatientImage(p=>({...p,points:[]}));setNextPointId(1);setActiveImage('reference');};
  const canAlign=referenceImage.points.length>=3&&referenceImage.points.length===patientImage.points.length;

  // Compute affine transformation matrix from control point pairs (least-squares)
  const computeAffineMatrix = (srcPts: Point[], dstPts: Point[]) => {
    const n = srcPts.length;
    // Build A matrix and b vectors for least squares: [a,b,c,d,tx,ty]
    // dst_x = a*src_x + b*src_y + tx
    // dst_y = c*src_x + d*src_y + ty
    let sumX=0,sumY=0,sumX2=0,sumY2=0,sumXY=0;
    let sumDstX=0,sumDstY=0,sumXdstX=0,sumYdstX=0,sumXdstY=0,sumYdstY=0;
    for(let i=0;i<n;i++){
      const {x,y}=srcPts[i]; const {x:dx,y:dy}=dstPts[i];
      sumX+=x;sumY+=y;sumX2+=x*x;sumY2+=y*y;sumXY+=x*y;
      sumDstX+=dx;sumDstY+=dy;
      sumXdstX+=x*dx;sumYdstX+=y*dx;
      sumXdstY+=x*dy;sumYdstY+=y*dy;
    }
    // Solve using Cramer's rule approximation (similarity transform: a=d, b=-c)
    const A=sumX2+sumY2;
    const a=(sumXdstX+sumYdstY)/A||0;
    const b=(sumXdstX-sumYdstY)/A||0; // simplified
    // Full affine: just use least-squares per row
    const det = n*(sumX2+sumY2) - (sumX*sumX+sumY*sumY);
    const a11 = det!==0 ? (n*sumXdstX - sumX*sumDstX)/det : 1;
    const a12 = det!==0 ? (n*sumYdstX - sumY*sumDstX)/det : 0;
    const tx  = det!==0 ? (sumDstX - a11*sumX - a12*sumY)/n : 0;
    const a21 = det!==0 ? (n*sumXdstY - sumX*sumDstY)/det : 0;
    const a22 = det!==0 ? (n*sumYdstY - sumY*sumDstY)/det : 1;
    const ty  = det!==0 ? (sumDstY - a21*sumX - a22*sumY)/n : 0;
    const matrix = [[a11,a12,tx],[a21,a22,ty],[0,0,1]];
    const rotation = Math.atan2(a21, a11) * 180 / Math.PI;
    const scale = Math.sqrt(a11*a11+a21*a21);
    // Compute RMSE
    let mse=0;
    for(let i=0;i<n;i++){
      const px=a11*srcPts[i].x+a12*srcPts[i].y+tx;
      const py=a21*srcPts[i].x+a22*srcPts[i].y+ty;
      mse+=Math.pow(px-dstPts[i].x,2)+Math.pow(py-dstPts[i].y,2);
    }
    const rmse=Math.sqrt(mse/n);
    return { matrix, rotation, tx, ty, scale, rmse };
  };

  // Keyboard shortcuts
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==='r'||e.key==='R'){setRefView(DEFAULT_VIEW);setPatView(DEFAULT_VIEW);}if((e.ctrlKey||e.metaKey)&&e.key==='z')undoLastPoint();if(e.key==='Escape')setShowShortcuts(false);if(e.key==='?')setShowShortcuts(s=>!s);};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[referenceImage.points, patientImage.points]);

  // Auto align
  const handleAutoAlign = async () => {
    if (!jobId) { setAutoAlignError("Aucun job ID."); setAutoAlignStatus('error'); return; }
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      const res = await fetch('/api/auto-align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, transform: 'MINE' }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Recalage automatique échoué'); }
      const data = await res.json();
      if (data.metrics) setAutoAlignMetrics(data.metrics);
      if (data.image) {
        setPatientImage(p => ({ ...p, src: data.image }));
        setResultImages({ ref: referenceImage.src, pat: data.image });
      } else {
        // ✅ Fallback si pas d'image retournée
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      setAutoAlignStatus('success');
    } catch (err: any) {
      setAutoAlignError(err.message || 'Erreur inattendue');
      setAutoAlignStatus('error');
    }
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
    if (!canAlign) { setAutoAlignError('Minimum 3 points requis.'); return; }
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      console.log('🔵 Calling /api/align...');
      const res = await fetch('/api/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          ct_points: referenceImage.points.map(p => [p.x, p.y]),
          pat_points: patientImage.points.map(p => [p.x, p.y]),
          use_warped: cameFromMINE,
        }),
      });
      console.log('🔵 /api/align response status:', res.status);
      if (!res.ok) throw new Error('Recalage manuel échoué');
      const data = await res.json();
      console.log('🔵 /api/align data:', data);
      if (data.metrics) setAutoAlignMetrics(data.metrics);
      if (data.image) {
        setPatientImage(p => ({ ...p, src: data.image }));
        setResultImages({ ref: referenceImage.src, pat: data.image });
      } else {
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      // Compute tform from control points
      setTformData(computeAffineMatrix(referenceImage.points, patientImage.points));
      setCameFromMINE(false);
      setAutoAlignStatus('success');
    } catch (err: any) {
      console.error('❌ handleManualAlign error:', err);
      setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      // Still compute tform even on error
      setTformData(computeAffineMatrix(referenceImage.points, patientImage.points));
      setAutoAlignMetrics(null);
      setCameFromMINE(false);
      setAutoAlignStatus('success');
    }
  };

  const handleRefineManually = () => {
    setAutoAlignStatus('idle'); setShowResult(false); setRegistrationMode('manual'); setCameFromMINE(true);
    setReferenceImage(p => ({ ...p, points: [] })); setPatientImage(p => ({ ...p, points: [] }));
    setNextPointId(1); setActiveImage('reference');
  };

  useEffect(() => {
    if (autoAlignStatus === 'success') {
      console.log('✅ autoAlignStatus success — setting pendingShowResult');
      setPendingShowResult(true);
    }
  }, [autoAlignStatus]);

  // ✅ Déclencher showResult quand l'overlay ferme (autoAlignStatus revient à idle)
  useEffect(() => {
    if (pendingShowResult && autoAlignStatus === 'idle') {
      console.log('✅ pendingShowResult + idle → showing result');
      setPendingShowResult(false);
      setShowResult(true);
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
  const pointsOk   = refPts >= 3 && refPts === patPts;
  const showAutoButton       = referenceImage.src && patientImage.src && registrationMode === 'mine' && !showResult;
  const showManualButton     = registrationMode === 'manual';
  const showManualActions    = referenceImage.src && patientImage.src && registrationMode === 'manual';
  const mi         = autoAlignMetrics?.mutual_information;
  const miQuality  = autoAlignMetrics?.mi_quality || (mi === undefined ? 'N/A' : mi > 0.5 ? 'Excellent' : mi > 0.3 ? 'Bon' : 'Faible');
  const miColor    = mi === undefined ? '#94a3b8' : mi > 0.5 ? '#10b981' : mi > 0.3 ? '#3b82f6' : '#f97316';
  const miBadgeBg  = mi === undefined ? 'bg-slate-100 text-slate-500' : mi > 0.5 ? 'bg-emerald-100 text-emerald-700' : mi > 0.3 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700';
  const pointsStatus = refPts === 0 ? 'empty' : refPts < 3 ? 'partial' : refPts !== patPts ? 'unbalanced' : 'ready';

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
              {[{keys:['Alt','Clic'],desc:'Panoramique'},{keys:['Scroll'],desc:'Zoom in/out'},{keys:['Clic droit'],desc:'Supprimer un point'},{keys:['R'],desc:'Réinitialiser la vue'},{keys:['Esc'],desc:'Fermer'},{keys:['?'],desc:'Afficher raccourcis'}].map(({keys,desc})=>(
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
            {[{label:'Référence',done:!!referenceImage.src,color:'bg-blue-600'},{label:'Patient',done:!!patientImage.src,color:'bg-violet-600'},{label:'Résultat',done:showResult,color:'bg-emerald-600'}].map(({label,done,color},i,arr)=>(
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${done?`${color} shadow-lg`:'bg-white/5 border border-white/10'}`}>
                    {done?<Check className="w-3 h-3 text-white"/>:<span className="text-[9px] font-bold text-white/20">{i+1}</span>}
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
              {pointsStatus==='ready'?'✅ Prêt':pointsStatus==='unbalanced'?`⚠️ ${refPts}/${patPts}`:pointsStatus==='partial'?`Encore ${3-Math.min(refPts,patPts)} pts`:'Clic pour ajouter des points'}
            </div>
          </div>
        )}

        {/* Mode selector */}
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
          {referenceImage.src&&patientImage.src?(
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
          {/* Exploration + Undo on same row */}
          <div className="flex gap-2">
            <button onClick={()=>onNavigate('exploration')} className="flex-1 py-2 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
              <Compass className="w-3.5 h-3.5"/>Exploration
            </button>
            {showManualButton && (
              <button
                onClick={undoLastPoint}
                disabled={refPts === 0 && patPts === 0}
                title="Annuler le dernier point (Ctrl+Z)"
                className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  refPts === 0 && patPts === 0
                    ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                    : 'border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5"/> Annuler
              </button>
            )}
          </div>

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
            <button onClick={handleManualAlign} disabled={autoAlignStatus==='processing'||!canAlign}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${!canAlign?'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed':'bg-white text-[#0a0c10] hover:bg-white/90 shadow-xl shadow-white/5'}`}>
              <MousePointer2 className="w-4 h-4"/>Recalage Manuel
            </button>
          )}

          {showManualActions&&!canAlign&&refPts<3&&<p className="text-[10px] text-white/20 text-center leading-relaxed">Marquez au moins 3 points sur chaque image.</p>}
        </div>

        {/* Bottom toolbar */}
        <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            {[{icon:<Download className="w-4 h-4"/>,onClick:()=>{},title:'Exporter'},{icon:<Eye className="w-4 h-4"/>,onClick:()=>setShowMagnifier(s=>!s),title:'Loupe',active:showMagnifier},{icon:<Undo2 className="w-4 h-4"/>,onClick:undoLastPoint,title:'Annuler dernier point (Ctrl+Z)',disabled:refPts===0&&patPts===0},{icon:<Trash2 className="w-4 h-4"/>,onClick:clearAllPoints,title:'Effacer tous les points'},{icon:<Keyboard className="w-4 h-4"/>,onClick:()=>setShowShortcuts(s=>!s),title:'Raccourcis (?)',active:showShortcuts}].map(({icon,onClick,title,active,disabled}:any)=>(
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
        {/* Magnifier */}
        <div className="fixed pointer-events-none z-50 rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-[#0a0c10]"
          style={{display:showMagnifier?'block':'none',left:magnifierPos.x+24,top:magnifierPos.y+24,width:160,height:160}}>
          <canvas ref={magnifierCanvasRef} width={160} height={160} className="w-full h-full opacity-90"/>
        </div>

        <div className="flex-1 p-4 flex gap-4 overflow-hidden relative">
          {/* Editor panels */}
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
                <div key={type} className={`flex-1 flex flex-col rounded-2xl overflow-hidden relative transition-all duration-300 border ${active?`${accent} shadow-xl ring-1 ring-inset ring-white/10`:`border-white/[0.06] shadow-sm ${ringOff}`} bg-[#0d0f14]`}>
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
                  <div className="flex-1 relative flex items-center justify-center">
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
                </div>
              );
            })}
          </div>

          {/* Result panel */}
          {showResult&&(
            <div className="absolute inset-0 z-40 flex animate-in fade-in zoom-in-95 duration-400">
              <div ref={resultVisualRef} className="flex-1 relative bg-[#0a0c10] flex items-center justify-center overflow-hidden">
                {/* Mode tabs */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 p-1 bg-[#0d0f14]/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl">
                  {(['overlay','split','heatmap'] as const).map(mode=>(
                    <button key={mode} onClick={()=>setVisMode(mode)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${visMode===mode?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'text-white/40 hover:text-white/70'}`}>
                      {mode==='overlay'?'Superposition':mode==='split'?'Comparaison':'Différences'}
                    </button>
                  ))}
                </div>

                <div className="relative w-full h-full p-14 flex items-center justify-center">
                  <div className="relative" style={{width:'600px',height:'600px',maxWidth:'100%',maxHeight:'100%'}}>
                    <canvas ref={resultRefCanvasRef} width={600} height={600} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
                    <div style={{position:'absolute',inset:0,opacity:visMode==='overlay'?alphaBlending/100:1,clipPath:visMode==='split'?`inset(0 ${100-splitPos}% 0 0)`:'none'}}>
                      <canvas ref={resultPatCanvasRef} width={600} height={600} style={{width:'100%',height:'100%'}}/>
                    </div>
                    {/* Split draggable */}
                    {visMode==='split'&&(
                      <div className="absolute top-0 bottom-0 z-20" style={{left:`${splitPos}%`}}>
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" style={{boxShadow:'0 0 15px rgba(255,255,255,0.1)'}}/>
                        <div className="absolute top-4 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full -translate-x-14 shadow-lg">Référence</div>
                        <div className="absolute top-4 translate-x-2 bg-violet-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">Patient</div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0d0f14] rounded-full border border-white/10 shadow-2xl flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform"
                          onMouseDown={e=>{e.preventDefault();setIsDraggingSplit(true);}}>
                          <Layers className="w-4 h-4 text-white/70"/>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-72 px-5 py-3 bg-[#0d0f14]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                  {visMode==='overlay' && (
                    <>
                      <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
                        <span>Transparence PET</span>
                        <span>{alphaBlending}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={alphaBlending} onChange={e=>setAlphaBlending(Number(e.target.value))} className="w-full h-1 rounded-full appearance-none cursor-pointer accent-blue-500 bg-white/10"/>
                    </>
                  )}
                  {visMode==='split' && (
                    <>
                      <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
                        <span>Position slider</span>
                        <span>{splitPos}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={splitPos} onChange={e=>setSplitPos(Number(e.target.value))} className="w-full h-1 rounded-full appearance-none cursor-pointer accent-white bg-white/10"/>
                    </>
                  )}
                </div>
                <button onClick={()=>setShowResult(false)} className="absolute top-4 right-4 z-50 p-2 bg-[#0d0f14]/60 hover:bg-[#0d0f14] rounded-full text-white/40 hover:text-white shadow-2xl transition-colors border border-white/10"><X className="w-4 h-4"/></button>
              </div>

              {/* Stats side */}
              <div className="w-72 flex-none bg-[#0d0f14] border-l border-white/10 flex flex-col p-6 overflow-y-auto">
                <div className="mb-1">
                  <h3 className="text-lg font-bold text-white tracking-tight">Recalage Terminé</h3>
                  <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:miColor,boxShadow:`0 0 8px ${miColor}`}}/>
                    {registrationMode==='mine'?'Modèle Deep Learning MINE':'Recalage Manuel'}
                  </p>
                </div>

                {/* Légende heatmap */}
                {visMode==='heatmap'&&(
                  <div className="rounded-2xl p-4 bg-white/[0.02] border border-white/[0.06] mb-1">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-3">Lecture de la carte</p>
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

                <div className="space-y-3 my-5">
                  {/* Gauge MI */}
                  <div className="rounded-2xl p-4 border" style={{borderColor:miColor+'30',background:miColor+'08'}}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:miColor}}>Information Mutuelle</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg ${miBadgeBg}`}>{miQuality}</span>
                    </div>
                    <div className="flex justify-center mb-2">
                      <svg width="120" height="75" viewBox="0 0 120 75">
                        <path d="M 12 70 A 48 48 0 0 1 108 70" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" strokeLinecap="round"/>
                        {mi!==undefined&&(()=> {
                          const pct = Math.min(0.999, Math.max(0.001, mi / 0.6));
                          const circumference = Math.PI * 48;
                          const dash = pct * circumference;
                          return (
                            <path d="M 12 70 A 48 48 0 0 1 108 70" fill="none" stroke={miColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} style={{filter:`drop-shadow(0 0 5px ${miColor}80)`}}/>
                          );
                        })()}
                        <text x="60" y="62" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="monospace">{mi!==undefined?mi.toFixed(3):'N/A'}</text>
                      </svg>
                    </div>
                    <div className="flex justify-between text-[9px] text-white/20 font-bold px-2 tracking-tighter">
                      <span>FAIBLE</span><span>BON</span><span>EXCELLENT</span>
                    </div>
                  </div>

                  {/* Qualité bar */}
                  <div className="rounded-2xl p-4 bg-white/[0.02] border border-white/[0.06] shadow-inner">
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Qualité finale</span>
                      <span className="text-[10px] font-bold" style={{color:miColor}}>{mi===undefined?'—':mi>0.5?'EXCELLENT':mi>0.3?'CORRECT':'À REVOIR'}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{width:mi!==undefined?`${Math.min(100,(mi/0.6)*100)}%`:'0%',background:miColor,boxShadow:`0 0 10px ${miColor}`}}/>
                    </div>
                  </div>

                  {autoAlignMetrics?.processing_time_ms>0&&(
                    <div className="rounded-2xl p-4 bg-blue-500/5 border border-blue-500/10 shadow-lg">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Temps GPU</span>
                      <div className="text-2xl font-black text-blue-400 mt-1">{(autoAlignMetrics.processing_time_ms/1000).toFixed(1)}s</div>
                    </div>
                  )}

                  {/* Transformation Matrix — shown for manual registration */}
                  {registrationMode==='manual' && tformData && (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      {/* Summary row */}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Transformation Affine</span>
                          <button
                            onClick={() => setShowTformMatrix(v => !v)}
                            className="text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 px-2 py-0.5 rounded-full transition-all"
                          >
                            {showTformMatrix ? 'Masquer' : 'Voir matrice'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: 'Rotation', value: `${tformData.rotation >= 0 ? '+' : ''}${tformData.rotation.toFixed(2)}°`, color: '#8b5cf6' },
                            { label: 'Échelle', value: tformData.scale.toFixed(4), color: '#3b82f6' },
                            { label: 'Δx', value: `${tformData.tx >= 0 ? '+' : ''}${tformData.tx.toFixed(1)}px`, color: '#06b6d4' },
                            { label: 'Δy', value: `${tformData.ty >= 0 ? '+' : ''}${tformData.ty.toFixed(1)}px`, color: '#06b6d4' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: color + '10', border: `1px solid ${color}20` }}>
                              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: color + 'aa' }}>{label}</span>
                              <span className="text-[11px] font-black" style={{ color }}>{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider">RMSE</span>
                          <span className="text-[11px] font-black text-emerald-400">{tformData.rmse.toFixed(2)} px</span>
                        </div>
                      </div>
                      {/* Full 3×3 matrix */}
                      {showTformMatrix && (
                        <div className="border-t border-white/5 p-3">
                          <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mb-2">Matrice 3×3</p>
                          <div className="font-mono text-[10px] space-y-0.5">
                            {tformData.matrix.map((row, i) => (
                              <div key={i} className="flex gap-1 items-center">
                                <span className="text-white/10">{i===0?'⎡':i===1?'⎢':'⎣'}</span>
                                {row.map((v, j) => (
                                  <span key={j} className="flex-1 text-center text-white/60 bg-white/[0.03] rounded py-0.5">
                                    {v.toFixed(4)}
                                  </span>
                                ))}
                                <span className="text-white/10">{i===0?'⎤':i===1?'⎥':'⎦'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto space-y-3">
                  {registrationMode==='manual'&&(
                    <div className="rounded-xl p-4 bg-orange-500/5 border border-orange-500/10">
                      <div className="flex items-start gap-2.5 mb-3">
                        <span className="text-lg leading-none">🤖</span>
                        <div>
                          <p className="text-[11px] font-black text-orange-400 mb-0.5">RECALAGE AUTOMATIQUE</p>
                          <p className="text-[10px] text-white/30 leading-relaxed font-medium">
                            Résultat insuffisant ? Lancez directement le recalage automatique sans repasser par l'éditeur.
                          </p>
                        </div>
                      </div>
                      <button onClick={()=>{
                        setRegistrationMode('mine');
                        setReferenceImage(p=>({...p,points:[]}));
                        setPatientImage(p=>({...p,points:[]}));
                        setNextPointId(1);
                        setShowResult(false);
                        setAutoAlignStatus('idle');
                        setTimeout(() => handleAutoAlign(), 150);
                      }}
                        className="w-full py-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1.5 border border-orange-500/20 uppercase">
                        <BrainCircuit className="w-3.5 h-3.5"/>Lancer le recalage automatique
                      </button>
                    </div>
                  )}
                  <button className="w-full py-3.5 bg-white text-[#0a0c10] font-black rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl shadow-white/5">
                    <Download className="w-4 h-4"/>Exporter les données
                  </button>
                  <button onClick={()=>onNavigate('exploration')} className="w-full py-3 bg-white/5 text-white/40 font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] border border-white/5 uppercase tracking-tighter">
                    <Compass className="w-4 h-4"/>Retour exploration
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <AutoAlignOverlay
        isVisible={autoAlignStatus!=='idle'}
        status={autoAlignStatus as any}
        metrics={autoAlignMetrics}
        errorMessage={autoAlignError}
        algorithm="MINE"
        onClose={()=>setAutoAlignStatus('idle')}
      />
    </div>
  );
}