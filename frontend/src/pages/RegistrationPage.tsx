// ================================================================
// RegistrationPage.tsx — Version corrigée (3 bugs fixés)
// ================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDown, Upload, X, Eye, Download, Trash2, Check,
  MousePointer2, ZoomIn, ZoomOut, RotateCcw, Keyboard, BrainCircuit, Brain, Undo2,
  Box, Loader2, FileText, Users, ChevronRight, Search, ScanSearch, Zap, ChevronLeft, Columns2,
  Lightbulb, Target, Microscope, Map
} from 'lucide-react';

const GuideIcon = () => (
  <img src="/assets/images/creative.png" alt="guide" className="h-6 w-6 object-contain" />
);
import api from '../api';
import RegistrationModeSelector from '../components/RegistrationModeSelector';
import AutoAlignOverlay from '../components/AutoAlignOverlay';
import ExplorationPage from './ExplorationPage';
import BrodmannIdentificationView from '../components/BrodmannIdentificationView';
import BrodmannZone3D from '../components/BrodmannZone3D';
import BrainVolume3D from '../components/BrainVolume3D';
import OrientationPanel from '../components/viewer/OrientationPanel';
import PatientSelectionModal from '../components/PatientSelectionModal';

type Page = string;
interface User {
  username: string;
  fullName?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  prenom?: string;
  nom?: string;
  specialty?: string;
}
interface RegistrationPageProps { user: User; accessToken: string | null; onNavigate: (page: Page) => void; }
interface Point { x: number; y: number; id: number; }
interface ImageTransform { offsetX: number; offsetY: number; scale: number; baseScale: number; imageWidth: number; imageHeight: number; }
interface ViewTransform { scale: number; panX: number; panY: number; }
interface ImageState { src: string; points: Point[]; }
interface SliceShape { x: number; y: number; z: number; }
interface SuggestedSlice { axis: 'axial' | 'coronal' | 'sagittal'; index: number; }
interface CorticalZoneItem { id: number; name: string; }
type AtlasSourceOption = 'official' | 'custom';
type RegistrationDimension = '2d' | '3d' | 'advanced';
interface OrientationState { rotation: number; flipH: boolean; flipV: boolean; }

const POINT_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];
const DEFAULT_VIEW: ViewTransform = { scale: 1, panX: 0, panY: 0 };

export function RegistrationPage({ user, accessToken, onNavigate }: RegistrationPageProps) {
  const navigate = useNavigate();
  const doctorDisplayName = React.useMemo(() => {
    const fromFullName = String(user?.fullName || user?.full_name || '').trim();
    if (fromFullName && !fromFullName.includes('@')) return fromFullName;

    const firstName = String(user?.first_name || user?.prenom || '').trim();
    const lastName = String(user?.last_name || user?.nom || '').trim();
    const merged = `${firstName} ${lastName}`.trim();
    if (merged) return merged;

    const username = String(user?.username || '').trim();
    if (!username || username.includes('@')) return 'Medecin';
    return username;
  }, [user]);

  const [registrationDimension, setRegistrationDimension] = useState<RegistrationDimension | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageState>({ src: '', points: [] });
  const [patientImage, setPatientImage]     = useState<ImageState>({ src: '', points: [] });
  const [uploadedFiles, setUploadedFiles]   = useState<{ ref?: File; patient?: File }>({});
  const [activeImage, setActiveImage]       = useState<'reference' | 'patient'>('reference');
  const [showResult, setShowResult]         = useState(false);
  const [phase, setPhase]                   = useState<1 | 2 | 3>(1);
  const [nextPointId, setNextPointId]       = useState(1);
  const [visMode, setVisMode]               = useState<'overlay' | 'heatmap' | 'blend'>('overlay');
  const [overlayRefOpacity, setOverlayRefOpacity] = useState(78);
  const [overlayPatOpacity, setOverlayPatOpacity] = useState(72);
  const [heatSensitivity, setHeatSensitivity] = useState(50);
  const resultPatYOffset = 0;
  const [showMagnifier, setShowMagnifier]   = useState(false);
  const [magnifierPos, setMagnifierPos]     = useState({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts]   = useState(false);
  const [showGrid, setShowGrid]             = useState(true);
  const [gridSize, setGridSize]             = useState(32);
  const [registrationMode, setRegistrationMode] = useState<'manual' | 'mine'>('manual');
  const [cameFromMINE, setCameFromMINE]     = useState(false);
  const [autoAlignStatus, setAutoAlignStatus] = useState<'idle'|'processing'|'success'|'error'>('idle');
  const [autoAlignMetrics, setAutoAlignMetrics] = useState<any>(null);
  const [autoAlignError, setAutoAlignError] = useState('');
  const [autoAlignProgress, setAutoAlignProgress] = useState<number | undefined>(undefined);
  const [autoAlignStageMessage, setAutoAlignStageMessage] = useState('');
  const [autoAlignIters, setAutoAlignIters] = useState(300);
  const [jobId, setJobId]                   = useState('');
  const [referenceJobId, setReferenceJobId] = useState('');
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
  const [originalImages, setOriginalImages] = useState<{ ref: string; pat: string } | null>(null);
  const [displayResultImages, setDisplayResultImages] = useState<{ ref: string; pat: string } | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [splitPos, setSplitPos]             = useState(50);
  const [resultsAxis, setResultsAxis]       = useState('axial');
  const [resultsIdx, setResultsIdx]         = useState(0);
  const [resultsMax, setResultsMax]         = useState(0);
  const [resultsSliceLoading, setResultsSliceLoading] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [showAutoGuide, setShowAutoGuide] = useState(false);
  const [showAutoGuide3D, setShowAutoGuide3D] = useState(false);
  const [showHybridGuide, setShowHybridGuide] = useState(false);
  // Normalized versions (all drawn on same canvas size) used for display
  const [, setNormalizedResult]     = useState<{ ref: string; pat: string } | null>(null);
  const [, setNormalizedOriginal] = useState<{ ref: string; pat: string } | null>(null);
  const [pendingShowResult, setPendingShowResult] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showExploration, setShowExploration] = useState(false);
  const [savingToPatient, setSavingToPatient] = useState(false);
  const [saveToPatientResult, setSaveToPatientResult] = useState<{ ok: boolean; filename?: string; downloadUrl?: string; uploadedAt?: string; error?: string } | null>(null);
  const [autoSavedToPatient, setAutoSavedToPatient] = useState<{ ok: boolean; filename?: string } | null>(null);
  const [applyingToSeries, setApplyingToSeries] = useState(false);
  const [applyingToSeriesStatus, setApplyingToSeriesStatus] = useState<'idle'|'processing'|'success'|'error'>('idle');
  const [applyingToSeriesProgress, setApplyingToSeriesProgress] = useState<number | undefined>(undefined);
  const [applyingToSeriesMessage, setApplyingToSeriesMessage] = useState('');
  const [applyingToSeriesError, setApplyingToSeriesError] = useState('');
  const [comparisonData, setComparisonData] = useState<{
    patientCount: number; refCount: number;
    patientName: string; patientDossier: string; refName: string;
  } | null>(null);
  // per-panel: thumbs (small), selected index, full-size preview, loading flags
  const [panelThumbs, setPanelThumbs] = useState<{ ref: (string | null)[]; patient: (string | null)[] }>({ ref: [], patient: [] });
  const [panelThumbsLoading, setPanelThumbsLoading] = useState<{ ref: boolean; patient: boolean }>({ ref: false, patient: false });
  const [panelIndex, setPanelIndex] = useState<{ ref: number; patient: number }>({ ref: 0, patient: 0 });
  const [panelFullImg, setPanelFullImg] = useState<{ ref: string | null; patient: string | null }>({ ref: null, patient: null });
  const [panelFullLoading, setPanelFullLoading] = useState<{ ref: boolean; patient: boolean }>({ ref: false, patient: false });
  const panelDebounceRef = useRef<{ ref: ReturnType<typeof setTimeout> | null; patient: ReturnType<typeof setTimeout> | null }>({ ref: null, patient: null });
  const filmstripRefRef = useRef<HTMLDivElement>(null);
  const filmstripPatRef = useRef<HTMLDivElement>(null);
  const [showSeriesApplyConfirm, setShowSeriesApplyConfirm] = useState(false);
  const [showRegisteredSeries, setShowRegisteredSeries] = useState(false);
  const [loadingCorticalZones, setLoadingCorticalZones] = useState(false);
  const [brodmannTooltip, setBrodmannTooltip] = useState<{
    panel: 'reference' | 'patient';
    x: number;
    y: number;
    insideBrain: boolean;
    zoneId?: number;
    zoneName?: string;
  } | null>(null);

  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showThreeDSubModal, setShowThreeDSubModal] = useState(false);
  const [showModeAssistant, setShowModeAssistant] = useState(false);
  const [assistantObjective, setAssistantObjective] = useState<'fast' | 'precise' | 'cortical' | 'manual' | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientFiles, setPatientFiles] = useState<any[]>([]);
  const [selectionPendingMode, setSelectionPendingMode] = useState<RegistrationDimension | null>(null);
  const [loadingPatientFiles, setLoadingPatientFiles] = useState(false);
  const [selectedRefFileId, setSelectedRefFileId] = useState<number | null>(null);
  const [selectedPatFileId, setSelectedPatFileId] = useState<number | null>(null);
  const [isInitializingRegistration, setIsInitializingRegistration] = useState(false);

  // All patients list (loaded once on mode selection)
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [allPatientsLoading, setAllPatientsLoading] = useState(false);
  // Legacy per-panel inline browsing (kept for compat — replaced by picker modal)
  const [panelPatient, setPanelPatient] = useState<{ reference: any | null; patient: any | null }>({ reference: null, patient: null });
  const [panelPatientFiles, setPanelPatientFiles] = useState<{ reference: any[]; patient: any[] }>({ reference: [], patient: [] });
  const [panelFilesLoading, setPanelFilesLoading] = useState<{ reference: boolean; patient: boolean }>({ reference: false, patient: false });

  // Patient picker modal (full-screen, per-panel)
  const [panelPickerOpen, setPanelPickerOpen] = useState<'reference' | 'patient' | null>(null);
  const [pickerSelectedPatient, setPickerSelectedPatient] = useState<any>(null);
  const [pickerPatientFiles, setPickerPatientFiles] = useState<any[]>([]);
  const [pickerFilesLoading, setPickerFilesLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  // Tracks which patient was confirmed for each panel (to prevent duplicate selection)
  const [confirmedPanelPatients, setConfirmedPanelPatients] = useState<{ reference: any | null; patient: any | null }>({ reference: null, patient: null });

  // Interactive confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    detail?: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const refCanvasRef       = useRef<HTMLCanvasElement>(null);
  const patCanvasRef       = useRef<HTMLCanvasElement>(null);
  const resultRefCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultPatCanvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const patientVolumeInputRef = useRef<HTMLInputElement>(null);
  const atlasVolumeInputRef = useRef<HTMLInputElement>(null);
  const brodmannTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const patTransformRef    = useRef<ImageTransform>({ offsetX:0, offsetY:0, scale:1, baseScale:1, imageWidth:0, imageHeight:0 });
  const sliceFetchSeqRef   = useRef(0);
  const sliceDebounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAlignWsRef     = useRef<WebSocket | null>(null);
  const lastProgressUpdateRef = useRef<number>(0);
  const splitDragRef       = useRef(false);
  const superpositionPanelRef = useRef<HTMLDivElement>(null);

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

  // Auto-load MNI152 atlas for advanced mode (reference is fixed)
  useEffect(() => {
    if (registrationDimension !== 'advanced') return;
    let alive = true;
    const bootstrapAtlas = async () => {
      if (referenceImage.src) return;
      try {
        const atlasRes = await fetch('/api/volume/atlas_slice?axis=axial', { credentials: 'include' });
        if (!atlasRes.ok || !alive) return;
        const atlasData = await atlasRes.json();
        if (!alive) return;
        if (atlasData.image) {
          setReferenceImage({ src: atlasData.image, points: [] });
          setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
          setAxis(atlasData.axis || 'axial');
          setIndex(typeof atlasData.index === 'number' ? atlasData.index : 0);
          setMaxIndex(typeof atlasData.max_index === 'number' ? atlasData.max_index : 0);
          setPhase(2);
        }
      } catch (err) {
        console.error('Auto atlas bootstrap failed:', err);
      }
    };
    bootstrapAtlas();
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
        const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
        if (res.ok) {
          const d = await res.json();
          setJobId(d.jobId);

          // Some browsers cannot render TIFF data URLs directly.
          // Always prefer server-generated PNG previews when available.
          const refPreview = typeof d?.refPreview === 'string' && d.refPreview
            ? `data:image/png;base64,${d.refPreview}`
            : '';
          const patPreview = typeof d?.patPreview === 'string' && d.patPreview
            ? `data:image/png;base64,${d.patPreview}`
            : '';

          if (refPreview) {
            setReferenceImage({ src: refPreview, points: [] });
          }
          if (patPreview) {
            setPatientImage({ src: patPreview, points: [] });
          }
        }
        else {
          let errMsg = `Échec de l'envoi (${res.status})`;
          try { const j = await res.json(); errMsg = j?.message || j?.error || errMsg; } catch { /* non-JSON response */ }
          setAutoAlignError(errMsg); setAutoAlignStatus('error');
        }
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
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const container = canvas.parentElement;
      if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
      ctx.fillStyle = '#f1f5f9';
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
    img.onerror = (err) => {
      console.error(`❌ Erreur de chargement de l'image (${type}):`, err);
      // Optionnel: on pourrait mettre un message d'erreur dans l'état de l'image ici
    };
    img.src = imgState.src;
  }, [referenceImage, patientImage, refView, patView, phase, registrationMode, showGrid, gridSize, patientOrientation, applyPatientOrientationToScreen]);

  useEffect(() => { drawCanvas('reference'); }, [drawCanvas]);
  useEffect(() => { drawCanvas('patient');   }, [drawCanvas]);

  useEffect(() => {
    if ((autoAlignStatus !== 'processing' && applyingToSeriesStatus !== 'processing') || !jobId) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/ws/registration/${encodeURIComponent(jobId)}/`;

    try {
      const ws = new WebSocket(wsUrl);
      autoAlignWsRef.current = ws;

      ws.onopen = () => {
        if (autoAlignStatus === 'processing') {
          setAutoAlignStageMessage('Moteur de recalage connecté — en attente des données...');
        } else if (applyingToSeriesStatus === 'processing') {
          setApplyingToSeriesMessage('Connexion établie — application en cours...');
        }
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data || '{}');
          if (payload?.type !== 'progress') return;
          if (String(payload?.jobId || '') !== String(jobId)) return;

          const p = Number(payload?.progress);
          const msg = String(payload?.message || payload?.stage || '').trim();

          if (autoAlignStatus === 'processing') {
            if (Number.isFinite(p)) {
              setAutoAlignProgress(Math.max(0, Math.min(100, Math.round(p))));
              lastProgressUpdateRef.current = Date.now();
            }
            if (msg) setAutoAlignStageMessage(msg);
          } else if (applyingToSeriesStatus === 'processing') {
            if (Number.isFinite(p)) {
              setApplyingToSeriesProgress(Math.max(0, Math.min(100, Math.round(p))));
            }
            if (msg) setApplyingToSeriesMessage(msg);
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      ws.onerror = () => {
        // Silently ignore — the polling fallback takes over.
      };
    } catch {
      // WebSocket initialization can fail depending on proxy/local setup.
    }

    return () => {
      try {
        if (autoAlignWsRef.current) {
          autoAlignWsRef.current.close();
          autoAlignWsRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, [autoAlignStatus, applyingToSeriesStatus, jobId]);

  useEffect(() => {
    if (autoAlignStatus !== 'processing') return;

    // Timestamp de démarrage du fallback (local à cet effet)
    const startTime = Date.now();
    const FAKE_DURATION_MS = 55_000; // durée cible pour atteindre ~93% (~55s)
    const MAX_FAKE_PCT   = 93;       // plafond — les derniers % sont réservés au vrai résultat

    const timer = setInterval(() => {
      const sinceLastRealUpdate = Date.now() - (lastProgressUpdateRef.current || 0);

      // Si une vraie donnée WebSocket vient d'arriver (<= 3s), on laisse faire
      if (sinceLastRealUpdate <= 3000) return;

      // Progrès fictif basé sur le temps écoulé depuis le démarrage (courbe log)
      const elapsed = Date.now() - startTime;
      const ratio   = Math.min(1, elapsed / FAKE_DURATION_MS);
      // Courbe logarithmique : monte vite au début, puis ralentit vers MAX_FAKE_PCT
      const targetPct = Math.round(MAX_FAKE_PCT * (1 - Math.exp(-3.5 * ratio)));

      setAutoAlignProgress((prev) => {
        // Ne jamais régresser, ne jamais dépasser MAX_FAKE_PCT
        const current = typeof prev === 'number' ? prev : 0;
        if (current >= MAX_FAKE_PCT) return current;
        return Math.max(current, targetPct);
      });

      // Message de phase adapté au niveau d'avancement
      if (sinceLastRealUpdate > 5000) {
        setAutoAlignProgress((prev) => {
          const pct = typeof prev === 'number' ? prev : 0;
          if (pct < 20) {
            setAutoAlignStageMessage('Initialisation des pyramides multi-résolution...');
          } else if (pct < 50) {
            setAutoAlignStageMessage('Optimisation MINE — itérations en cours...');
          } else if (pct < 80) {
            setAutoAlignStageMessage('Calcul des transformations affines 3D...');
          } else {
            setAutoAlignStageMessage('Finalisation — déformation du volume patient...');
          }
          return prev;
        });
      }
    }, 800);

    return () => clearInterval(timer);
  }, [autoAlignStatus]);

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
      img.crossOrigin = 'anonymous';
      img.onload = () => { console.log('✅ Image loaded:', img.width, img.height); resolve(img); };
      img.onerror = (e) => { console.error('❌ Image load error:', e); reject(e); };
      img.src = src;
    });

    const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, offsetY = 0) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const s = Math.min(SIZE / img.width, SIZE / img.height) * 0.95;
      ctx.drawImage(img, (SIZE - img.width * s) / 2, ((SIZE - img.height * s) / 2) + offsetY, img.width * s, img.height * s);
    };

    const getLuma = (r: number, g: number, b: number) => (0.299 * r) + (0.587 * g) + (0.114 * b);

    const buildForegroundMask = (data: Uint8ClampedArray) => {
      const mask = new Uint8Array(SIZE * SIZE);
      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        const l = getLuma(data[i], data[i + 1], data[i + 2]);
        mask[p] = (l > 18 && l < 235) ? 1 : 0;
      }
      return mask;
    };

    const tintForeground = (
      sourceData: Uint8ClampedArray,
      color: [number, number, number],
      opacity01: number,
      canvasCtx: CanvasRenderingContext2D,
      spatialMask?: Uint8Array | null,   // optional gate: pixel must be 1 in mask to be colored
    ) => {
      const out = canvasCtx.createImageData(SIZE, SIZE);
      const alphaBase = Math.round(Math.max(0, Math.min(1, opacity01)) * 255);
      for (let i = 0, p = 0; i < sourceData.length; i += 4, p += 1) {
        const l = getLuma(sourceData[i], sourceData[i + 1], sourceData[i + 2]);
        // Raised lower-bound to 18 to suppress background noise; also skip if outside spatial mask
        const isForeground = l > 18 && l < 235 && (spatialMask == null || spatialMask[p] === 1);
        if (!isForeground) {
          out.data[i + 3] = 0;
          continue;
        }
        const intensity = Math.max(0.45, Math.min(1, l / 255));
        out.data[i] = Math.round(color[0] * intensity);
        out.data[i + 1] = Math.round(color[1] * intensity);
        out.data[i + 2] = Math.round(color[2] * intensity);
        out.data[i + 3] = alphaBase;
      }
      return out;
    };

    const distanceToMask = (sourceMask: Uint8Array, targetMask: Uint8Array) => {
      const inf = 1e9;
      const dist = new Float32Array(SIZE * SIZE);
      const queueX = new Int32Array(SIZE * SIZE);
      const queueY = new Int32Array(SIZE * SIZE);
      let qh = 0;
      let qt = 0;

      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const idx = y * SIZE + x;
          if (targetMask[idx]) {
            dist[idx] = 0;
            queueX[qt] = x;
            queueY[qt] = y;
            qt += 1;
          } else {
            dist[idx] = inf;
          }
        }
      }

      while (qh < qt) {
        const x = queueX[qh];
        const y = queueY[qh];
        qh += 1;
        const base = dist[y * SIZE + x];

        if (x > 0) {
          const ni = y * SIZE + (x - 1);
          if (dist[ni] > base + 1) {
            dist[ni] = base + 1;
            queueX[qt] = x - 1;
            queueY[qt] = y;
            qt += 1;
          }
        }
        if (x < SIZE - 1) {
          const ni = y * SIZE + (x + 1);
          if (dist[ni] > base + 1) {
            dist[ni] = base + 1;
            queueX[qt] = x + 1;
            queueY[qt] = y;
            qt += 1;
          }
        }
        if (y > 0) {
          const ni = (y - 1) * SIZE + x;
          if (dist[ni] > base + 1) {
            dist[ni] = base + 1;
            queueX[qt] = x;
            queueY[qt] = y - 1;
            qt += 1;
          }
        }
        if (y < SIZE - 1) {
          const ni = (y + 1) * SIZE + x;
          if (dist[ni] > base + 1) {
            dist[ni] = base + 1;
            queueX[qt] = x;
            queueY[qt] = y + 1;
            qt += 1;
          }
        }
      }

      const out = new Float32Array(SIZE * SIZE);
      for (let i = 0; i < out.length; i += 1) {
        out[i] = sourceMask[i] ? dist[i] : 0;
      }
      return out;
    };

    Promise.all([loadImg(refSrc), loadImg(patSrc)]).then(([refImg, patImg]) => {
      console.log('✅ Both images loaded, drawing canvases...');
      refCanvas.width = refCanvas.height = SIZE;
      const refCtx = refCanvas.getContext('2d')!;
      drawCover(refCtx, refImg, 0);

      patCanvas.width = patCanvas.height = SIZE;
      const patCtx = patCanvas.getContext('2d')!;
      drawCover(patCtx, patImg, resultPatYOffset);
      console.log('✅ Both canvases drawn successfully');

      const refD = refCtx.getImageData(0, 0, SIZE, SIZE);
      const patD = patCtx.getImageData(0, 0, SIZE, SIZE);

      // Reference mask is used as spatial gate for patient colorization:
      // patient pixels outside the atlas brain boundary are suppressed.
      const refSpatialMask = buildForegroundMask(refD.data);

      if (visMode === 'overlay') {
        // CSS opacity (sur le canvas) gère la transparence interactive — pixel alpha = plein
        const redRef  = tintForeground(refD.data, [231, 76, 60],  1.0, refCtx);
        const bluePat = tintForeground(patD.data, [41, 128, 255], 1.0, patCtx, refSpatialMask);
        refCtx.clearRect(0, 0, SIZE, SIZE);
        patCtx.clearRect(0, 0, SIZE, SIZE);
        refCtx.putImageData(redRef, 0, 0);
        patCtx.putImageData(bluePat, 0, 0);
      }

      if (visMode === 'heatmap') {
        // Fond anatomique : référence en niveaux de gris atténués (40% brightness) sous le heatmap
        const bgData = refCtx.createImageData(SIZE, SIZE);
        for (let j = 0; j < refD.data.length; j += 4) {
          const l = Math.round(getLuma(refD.data[j], refD.data[j + 1], refD.data[j + 2]) * 0.4);
          bgData.data[j] = l; bgData.data[j + 1] = l; bgData.data[j + 2] = l; bgData.data[j + 3] = 255;
        }
        refCtx.clearRect(0, 0, SIZE, SIZE);
        refCtx.putImageData(bgData, 0, 0);

        const refMask = buildForegroundMask(refD.data);
        const patMask = buildForegroundMask(patD.data);
        const distPatToRef = distanceToMask(patMask, refMask);
        const distRefToPat = distanceToMask(refMask, patMask);

        const sens01 = Math.max(0.01, Math.min(1, heatSensitivity / 100));
        const strictTolerance = 0.8 + (Math.pow(1 - sens01, 2.1) * 8.0);
        const moderateTolerance = strictTolerance + 1.6 + (Math.pow(1 - sens01, 1.4) * 3.2);

        const out = patCtx.createImageData(SIZE, SIZE);
        let alignedCount = 0;
        let validCount = 0;

        for (let i = 0; i < refMask.length; i += 1) {
          const pi = i * 4;
          const hasRef = refMask[i] === 1;
          const hasPat = patMask[i] === 1;

          if (!hasRef && !hasPat) {
            out.data[pi + 3] = 0;
            continue;
          }

          validCount += 1;

          if (hasRef && hasPat) {
            out.data[pi] = 22;
            out.data[pi + 1] = 163;
            out.data[pi + 2] = 74;
            out.data[pi + 3] = 220;
            alignedCount += 1;
            continue;
          }

          if (hasPat && !hasRef) {
            const d = distPatToRef[i];
            if (d <= moderateTolerance) {
              out.data[pi] = 251;
              out.data[pi + 1] = 146;
              out.data[pi + 2] = 60;
              out.data[pi + 3] = d <= strictTolerance ? 220 : 185;
            } else {
              // Far outside the reference brain — suppress to avoid artifacts
              out.data[pi + 3] = 0;
            }
            continue;
          }

          if (hasRef && !hasPat) {
            const d = distRefToPat[i];
            if (d <= moderateTolerance) {
              out.data[pi] = 251;
              out.data[pi + 1] = 146;
              out.data[pi + 2] = 60;
              out.data[pi + 3] = d <= strictTolerance ? 220 : 185;
            } else {
              out.data[pi] = 220;
              out.data[pi + 1] = 38;
              out.data[pi + 2] = 38;
              out.data[pi + 3] = 220;
            }
          }
        }

        (window as any).__heatmapAlignPct = validCount > 0 ? Math.round((alignedCount / validCount) * 100) : 0;
        (window as any).__heatmapSensitivity = heatSensitivity;

        patCtx.clearRect(0, 0, SIZE, SIZE);
        patCtx.putImageData(out, 0, 0);
      }

      if (visMode === 'blend') {
        // Fusion screen : cyan (référence) + orange (patient) → blanc sur les zones alignées
        const cyanRef = tintForeground(refD.data, [0, 210, 210],  1.0, refCtx);
        const warmPat = tintForeground(patD.data, [255, 120, 30], 1.0, patCtx, refSpatialMask);
        const merged  = patCtx.createImageData(SIZE, SIZE);
        for (let i = 0; i < merged.data.length; i += 4) {
          const ca = cyanRef.data[i + 3], pa = warmPat.data[i + 3];
          if (ca === 0 && pa === 0) { merged.data[i + 3] = 0; continue; }
          merged.data[i]     = 255 - Math.round((255 - cyanRef.data[i])     * (255 - warmPat.data[i])     / 255);
          merged.data[i + 1] = 255 - Math.round((255 - cyanRef.data[i + 1]) * (255 - warmPat.data[i + 1]) / 255);
          merged.data[i + 2] = 255 - Math.round((255 - cyanRef.data[i + 2]) * (255 - warmPat.data[i + 2]) / 255);
          merged.data[i + 3] = Math.max(ca, pa);
        }
        refCtx.clearRect(0, 0, SIZE, SIZE);
        patCtx.clearRect(0, 0, SIZE, SIZE);
        patCtx.putImageData(merged, 0, 0);
      }
    }).catch(e => console.error('drawResultImages error:', e));
  }, [resultImages, referenceImage.src, patientImage.src, visMode, overlayRefOpacity, overlayPatOpacity, heatSensitivity]);

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

  // Display-only remapping: preserve registration geometry while restoring
  // patient intensity close to the original acquisition.
  const matchIntensityToOriginal = useCallback((registeredSrc: string, originalSrc: string, size = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = (e) => rej(e);
        img.src = src;
      });

      const drawContained = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        const s = Math.min(size / img.width, size / img.height) * 0.95;
        ctx.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
      };

      Promise.all([loadImg(registeredSrc), loadImg(originalSrc)]).then(([regImg, origImg]) => {
        const regCanvas = document.createElement('canvas');
        regCanvas.width = size;
        regCanvas.height = size;
        const regCtx = regCanvas.getContext('2d');
        if (!regCtx) {
          reject(new Error('2D canvas context unavailable'));
          return;
        }
        drawContained(regCtx, regImg);

        const refCanvas = document.createElement('canvas');
        refCanvas.width = size;
        refCanvas.height = size;
        const refCtx = refCanvas.getContext('2d');
        if (!refCtx) {
          reject(new Error('2D canvas context unavailable'));
          return;
        }
        drawContained(refCtx, origImg);

        const regData = regCtx.getImageData(0, 0, size, size);
        const refData = refCtx.getImageData(0, 0, size, size);
        const out = regData.data;
        const ref = refData.data;

        const regLuma: number[] = [];
        const refLuma: number[] = [];
        for (let i = 0; i < out.length; i += 4) {
          const rl = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
          const ol = 0.299 * ref[i] + 0.587 * ref[i + 1] + 0.114 * ref[i + 2];
          if (rl > 8) regLuma.push(rl);
          if (ol > 8) refLuma.push(ol);
        }

        if (regLuma.length < 100 || refLuma.length < 100) {
          resolve(regCanvas.toDataURL('image/png'));
          return;
        }

        regLuma.sort((a, b) => a - b);
        refLuma.sort((a, b) => a - b);
        const rMed = regLuma[Math.floor(regLuma.length * 0.5)];
        const oMed = refLuma[Math.floor(refLuma.length * 0.5)];
        const rLo = regLuma[Math.floor(regLuma.length * 0.02)];
        const rHi = regLuma[Math.floor(regLuma.length * 0.98)];
        const oLo = refLuma[Math.floor(refLuma.length * 0.02)];
        const oHi = refLuma[Math.floor(refLuma.length * 0.98)];

        const rRange = Math.max(1, rHi - rLo);
        const oRange = Math.max(1, oHi - oLo);

        const medDelta = Math.abs(rMed - oMed);
        const rangeRatio = oRange / Math.max(1, rRange);
        if (medDelta < 6 && rangeRatio > 0.9 && rangeRatio < 1.1) {
          resolve(regCanvas.toDataURL('image/png'));
          return;
        }

        const regHist = new Uint32Array(256);
        const refHist = new Uint32Array(256);
        for (let i = 0; i < out.length; i += 4) {
          const rl = Math.max(0, Math.min(255, Math.round(0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2])));
          const ol = Math.max(0, Math.min(255, Math.round(0.299 * ref[i] + 0.587 * ref[i + 1] + 0.114 * ref[i + 2])));
          if (rl > 8) regHist[rl] += 1;
          if (ol > 8) refHist[ol] += 1;
        }

        const regCdf = new Float32Array(256);
        const refCdf = new Float32Array(256);
        let regTot = 0;
        let refTot = 0;
        for (let i = 0; i < 256; i += 1) {
          regTot += regHist[i];
          refTot += refHist[i];
          regCdf[i] = regTot;
          refCdf[i] = refTot;
        }
        if (regTot < 100 || refTot < 100) {
          resolve(regCanvas.toDataURL('image/png'));
          return;
        }
        for (let i = 0; i < 256; i += 1) {
          regCdf[i] /= regTot;
          refCdf[i] /= refTot;
        }

        const lut = new Uint8Array(256);
        let j = 0;
        for (let i = 0; i < 256; i += 1) {
          while (j < 255 && refCdf[j] < regCdf[i]) j += 1;
          lut[i] = j;
        }

        const strength = 0.96;
        for (let i = 0; i < out.length; i += 4) {
          const rl = Math.max(0, Math.min(255, Math.round(0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2])));
          if (rl <= 8) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            continue;
          }
          const mapped = lut[rl];
          const target = (1 - strength) * rl + strength * mapped;
          const gain = Math.max(0.55, Math.min(1.12, target / Math.max(16, rl)));
          out[i] = Math.max(0, Math.min(255, Math.round(out[i] * gain)));
          out[i + 1] = Math.max(0, Math.min(255, Math.round(out[i + 1] * gain)));
          out[i + 2] = Math.max(0, Math.min(255, Math.round(out[i + 2] * gain)));
        }

        regCtx.putImageData(regData, 0, 0);
        resolve(regCanvas.toDataURL('image/png'));
      }).catch(reject);
    });
  }, []);

  // Keep raw result for computation/export; only the displayed patient gets remapped.
  useEffect(() => {
    if (!resultImages) {
      setDisplayResultImages(null);
      return;
    }

    let alive = true;
    const run = async () => {
      if (!resultImages.pat || !originalImages?.pat) {
        if (alive) setDisplayResultImages(resultImages);
        return;
      }

      try {
        const correctedPat = await matchIntensityToOriginal(resultImages.pat, originalImages.pat);
        if (!alive) return;
        setDisplayResultImages({ ...resultImages, pat: correctedPat });
      } catch {
        if (alive) setDisplayResultImages(resultImages);
      }
    };

    void run();
    return () => { alive = false; };
  }, [resultImages, originalImages, matchIntensityToOriginal]);

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
      const atlasRes = await fetch('/api/volume/atlas_slice?axis=axial', { credentials: 'include' });
      if (!atlasRes.ok) return;
      const atlasData = await atlasRes.json();

      const demoRes = await fetch('/api/volume/load-demo', { method: 'POST', credentials: 'include' });
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
        const atlasGrayRes = await fetch(`/api/volume/atlas_slice?jobId=${nextJobId}&axis=axial&index=${nextIndex}&showLabels=0`, { credentials: 'include' });
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
      if (!uploadRes.ok) {
        const uploadErr = await readApiError(uploadRes, 'Upload patient 3D echoue');
        throw new Error(uploadErr);
      }

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

      const patientRes = await fetch(`/api/volume/get-slice?jobId=${nextJobId}&axis=${nextAxis}&index=${nextIndex}`, { credentials: 'include' });
      if (!patientRes.ok) throw new Error(await readApiError(patientRes, 'patient indisponible'));

      let atlasData: any = {};
      if (!is3D) {
        // 2D fallback only — in 3D the reference is always another patient volume
        const atlasRes = await fetch(`/api/volume/atlas_slice?jobId=${nextJobId}&axis=${nextAxis}&index=${nextIndex}&showLabels=0`, { credentials: 'include' });
        if (atlasRes.ok) atlasData = await atlasRes.json();
      }
      const patientData = await patientRes.json();

      setUploadedFiles({});
      const nextPatientSrc = patientData.slice || patientData.image || uploadData.median_slice || '';
      if (!is3D && atlasData.image) {
        setReferenceImage({ src: atlasData.image, points: [] });
        setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      }
      setPatientImage({ src: nextPatientSrc, points: [] });
      setActiveImage('patient');
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
      {
        const pm = typeof patientData.max_index === 'number' ? patientData.max_index : null;
        let initialMax = typeof uploadData.max_z === 'number' ? uploadData.max_z : 0;
        if (pm !== null) initialMax = pm;
        const rawIdx = typeof patientData.index === 'number' ? patientData.index : nextIndex;
        const clampedIdx = Math.min(Math.max(0, rawIdx), Math.max(0, initialMax));
        setMaxIndex(initialMax);
        setIndex(clampedIdx);
      }

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
      setAutoAlignError((err as any)?.message || 'Import patient 3D echoue. Verifiez le fichier et recommencez.');
      setAutoAlignStatus('error');
    }
  };

  const importReferenceVolume3D = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/volume/upload', { method: 'POST', credentials: 'include', body: fd });
      if (!uploadRes.ok) throw new Error(await readApiError(uploadRes, 'Upload référence 3D échoué'));
      const uploadData = await uploadRes.json();
      const refJobId = uploadData.jobId || '';
      if (!refJobId) throw new Error('Job ID manquant pour la référence');

      const nextIndex = typeof uploadData.z === 'number' ? uploadData.z : 0;
      const nextMax = typeof uploadData.max_z === 'number' ? uploadData.max_z : 0;

      const sliceRes = await fetch(`/api/volume/get-slice?jobId=${refJobId}&axis=axial&index=${nextIndex}`, { credentials: 'include' });
      const sliceData = sliceRes.ok ? await sliceRes.json() : {};

      setReferenceJobId(refJobId);
      setReferenceImage({ src: sliceData.image || sliceData.slice || '', points: [] });
      setMaxIndex(nextMax);
      setAxis('axial');
      setIndex(nextIndex);
      setAutoAlignError('');
      setAutoAlignStatus('idle');
      setPhase(2);
    } catch (err) {
      console.error('Import reference volume 3D failed:', err);
      setAutoAlignError((err as any)?.message || 'Import référence 3D échoué.');
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

  const resetCurrentRegistration = () => {
    // Réinitialise la session sans changer le mode (2D/3D/advanced)
    sessionStorage.removeItem('volumeJobId');
    setUploadedFiles({});
    setReferenceImage({ src: '', points: [] });
    setPatientImage({ src: '', points: [] });
    setActiveImage('reference');
    setShowResult(false);
    setShowValidationModal(false);
    setPhase(1);
    setNextPointId(1);
    setOverlayRefOpacity(78);
    setOverlayPatOpacity(72);
    setHeatSensitivity(50);
    setShowGrid(true);
    setGridSize(32);
    setVisMode('overlay');
    setRegistrationMode(registrationDimension === '2d' ? 'manual' : 'mine');
    setReferenceJobId('');
    setCameFromMINE(false);
    setAutoAlignStatus('idle');
    setAutoAlignMetrics(null);
    setAutoAlignError('');
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('');
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
    setOriginalImages(null);
    setDisplayResultImages(null);
    setNormalizedResult(null);
    setNormalizedOriginal(null);
    setPendingShowResult(false);
    setSaveToPatientResult(null);
    setAutoSavedToPatient(null);
    setConfirmedPanelPatients({ reference: null, patient: null });
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
    setOverlayRefOpacity(78);
    setOverlayPatOpacity(72);
    setHeatSensitivity(50);
    setShowGrid(true);
    setGridSize(32);
    setVisMode('overlay');
    setRegistrationMode(registrationDimension === '2d' ? 'manual' : 'mine');
    setReferenceJobId('');
    setCameFromMINE(false);
    setAutoAlignStatus('idle');
    setAutoAlignMetrics(null);
    setAutoAlignError('');
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('');
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
    setOriginalImages(null);
    setDisplayResultImages(null);
    setNormalizedResult(null);
    setNormalizedOriginal(null);
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
    // Capture the original images BEFORE registration overwrites patientImage/referenceImage
    setOriginalImages({ ref: referenceImage.src, pat: patientImage.src });
    lastProgressUpdateRef.current = Date.now();
    setAutoAlignProgress(undefined); // indeterminate jusqu'à la première vraie donnée WebSocket
    setAutoAlignStageMessage('Initialisation du recalage neuronal...');
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      const autoAlignEndpoints = is3D
        ? ['/api/volume/auto-align']
        : ['/api/volume/auto-align', '/api/auto-align'];

      const safeIters = Math.max(30, Math.min(1000, Number(autoAlignIters) || 300));
      const data = await postRegistrationWithFallback(
        autoAlignEndpoints,
        {
          jobId, transform: 'MINE', axis, index, n_iters: safeIters, strict_atlas_grid: is3D,
          ...(is3D && referenceJobId ? { fixedJobId: referenceJobId } : {}),
        },
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
      // In 3D/advanced, keep manual validation as a mandatory clinical step after auto result.
      if (is3D) {
        setShowValidationModal(false);
        setPhase(2);
      }
      // ✅ FIX: on monte d'abord à 100% avec un message de fin,
      // puis on laisse la barre se remplir visuellement (transition CSS 0.6s)
      // avant de passer à l'état succès — évite l'effet "terminé à 20%"
      setAutoAlignProgress(100);
      setAutoAlignStageMessage('Finalisation — recalage terminé ✓');
      await new Promise<void>((res) => setTimeout(res, 750));
      setAutoAlignStatus('success');
    } catch (err: any) {
      const msg = String(err?.message || 'Erreur inattendue');
      const lower = msg.toLowerCase();
      const staleJob = lower.includes('job not found') || lower.includes('jobid not found') || lower.includes('session expiree');

      if (is3D && staleJob) {
        sessionStorage.removeItem('volumeJobId');
        setJobId('');
        setReferenceJobId('');
        setReferenceImage({ src: '', points: [] });
        setPatientImage({ src: '', points: [] });
        setPhase(1);
        setAutoAlignError('Session 3D expirée — réimportez les deux volumes patients.');
      } else {
        setAutoAlignError(msg);
      }
      setAutoAlignProgress(undefined);
      setAutoAlignStatus('error');
    }
  };

  const handleRecommendedAutoAlign = async () => {
    setRegistrationMode('mine');
    await handleAutoAlign();
  };

  const handleHybridAlign = async () => {
    if (!jobId) { setAutoAlignError('Aucun job ID.'); setAutoAlignStatus('error'); return; }
    setOriginalImages({ ref: referenceImage.src, pat: patientImage.src });
    lastProgressUpdateRef.current = Date.now();
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('Initialisation du recalage hybride (Affine + VoxelMorph)…');
    setAutoAlignStatus('processing'); setAutoAlignError('');
    try {
      const safeIters = Math.max(30, Math.min(1000, Number(autoAlignIters) || 300));
      const data = await postRegistrationWithFallback(
        ['/api/volume/auto-align'],
        {
          jobId,
          transform: 'HYBRID',
          axis,
          index,
          n_iters: safeIters,
          strict_atlas_grid: is3D,
          ...(is3D && referenceJobId ? { fixedJobId: referenceJobId } : {}),
        },
        'Recalage hybride échoué'
      );
      if (data.metrics) setAutoAlignMetrics(data.metrics);
      const nextPatient = data.images?.patient || data.image;
      const nextAtlas = data.images?.atlas || referenceImage.src;
      if (nextPatient) {
        setPatientImage(p => ({ ...p, src: nextPatient }));
        setReferenceImage(p => ({ ...p, src: nextAtlas }));
        setResultImages({ ref: nextAtlas, pat: nextPatient });
      } else {
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      if (is3D) { setShowValidationModal(false); setPhase(2); }
      setAutoAlignProgress(100);
      setAutoAlignStageMessage('Recalage hybride terminé ✓');
      await new Promise<void>(res => setTimeout(res, 750));
      setAutoAlignStatus('success');
    } catch (err: any) {
      setAutoAlignError(String(err?.message || 'Erreur inattendue'));
      setAutoAlignProgress(undefined);
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
    if (!canAlign) { setAutoAlignError('Minimum 4 points requis.'); return; }
    // Capture the original images BEFORE registration
    setOriginalImages({ ref: referenceImage.src, pat: patientImage.src });
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('');
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
        // Keep the editable patient canvas unchanged so landmark points remain valid
        // when returning from result view to manual refinement.
        setResultImages({ ref: referenceImage.src, pat: data.image });
      } else {
        setResultImages({ ref: referenceImage.src, pat: patientImage.src });
      }
      setCameFromMINE(false);
      setAutoAlignStatus('success');
    } catch (err: any) {
      console.error('❌ handleManualAlign error:', err);
      setResultImages(null);
      setOriginalImages(null);
      setDisplayResultImages(null);
      setNormalizedResult(null);
      setNormalizedOriginal(null);
      setAutoAlignMetrics(null);
      setCameFromMINE(false);
      setAutoAlignError(err?.message || 'Recalage manuel échoué');
      setAutoAlignStatus('error');
    }
  };

  const handleSaveToPatient = async () => {
    const dbPatient = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
    if (!dbPatient) {
      setSaveToPatientResult({ ok: false, error: 'Aucun patient sélectionné — choisissez un patient dans le panneau avant de valider.' });
      return;
    }
    setSavingToPatient(true);
    setSaveToPatientResult(null);
    try {
      // Pour le mode 2D : envoyer l'image recalée en base64 (le job serveur peut ne pas
      // contenir le volume ; le frontend l'a en mémoire dans resultImages).
      const imageData2D = (registrationDimension === '2d' && resultImages?.pat)
        ? resultImages.pat
        : undefined;

      const res = await api.post('/volume/save-registered-to-patient', {
        jobId: jobId || '',
        patientId: dbPatient.id,
        mode: registrationDimension ?? '3d',
        mi: autoAlignMetrics?.mutual_information ?? null,
        ncc: autoAlignMetrics?.ncc_after ?? null,
        n_iters: autoAlignMetrics?.n_iters ?? null,
        processing_time_ms: autoAlignMetrics?.processing_time_ms ?? null,
        ...(imageData2D ? { imageData: imageData2D } : {}),
      });
      const data = res.data;
      if (data.success) {
        setSaveToPatientResult({ ok: true, filename: data.original_filename, downloadUrl: data.file_url, uploadedAt: data.uploaded_at });
      } else {
        setSaveToPatientResult({ ok: false, error: data.error || 'Erreur inconnue' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erreur réseau — vérifiez votre connexion.';
      setSaveToPatientResult({ ok: false, error: msg });
    } finally {
      setSavingToPatient(false);
    }
  };

  const handleExportSeries = async (panel: 'patient' | 'reference' | 'all') => {
    if (!jobId) return;
    try {
      const res = await fetch(
        `/api/download_registered_series?jobId=${encodeURIComponent(jobId)}&panel=${panel}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Export échoué : ${err.error || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const label = panel === 'patient' ? 'serie_recalee' : panel === 'reference' ? 'serie_reference' : 'series_completes';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label}_${jobId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('handleExportSeries:', err);
      alert('Erreur lors du téléchargement.');
    }
  };

  const handleDownloadVolume = async (panel: 'patient' | 'reference' | 'all') => {
    // For patient panel: prefer the already-saved media file (no extra endpoint needed)
    if (panel === 'patient' && saveToPatientResult?.downloadUrl) {
      const a = document.createElement('a');
      a.href = saveToPatientResult.downloadUrl;
      a.download = saveToPatientResult.filename || 'volume_recale.nii.gz';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (!jobId) return;
    try {
      const res = await fetch(
        `/api/volume/download-nifti?jobId=${encodeURIComponent(jobId)}&panel=${panel}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || res.statusText;
        alert(`Export échoué : ${msg}\n\nSi le problème persiste, redémarrez le serveur Django.`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const labels: Record<string, string> = { patient: 'volume_recale', reference: 'volume_reference', all: 'volumes' };
      const exts:   Record<string, string> = { patient: '.nii.gz',       reference: '.nii.gz',          all: '.zip' };
      const a = document.createElement('a');
      a.href = url;
      a.download = `${labels[panel]}_${jobId.slice(0, 8)}${exts[panel]}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('handleDownloadVolume:', err);
      alert('Erreur lors du téléchargement.');
    }
  };

  const handleApplyToSeries = async () => {
    const dbPatient = confirmedPanelPatients.patient;
    const dbRef = confirmedPanelPatients.reference;
    if (!dbPatient || !jobId) {
      alert(`Données manquantes — patient: ${JSON.stringify(dbPatient?.id)}, jobId: ${jobId}`);
      return;
    }
    setApplyingToSeries(true);
    setApplyingToSeriesStatus('processing');
    setApplyingToSeriesProgress(undefined);
    setApplyingToSeriesMessage('Initialisation de l\'application à la série...');
    setApplyingToSeriesError('');
    setComparisonData(null);
    setShowSeriesApplyConfirm(false);
    try {
      console.log('apply_to_patient_series envoi:', { jobId, patientId: dbPatient.id, refPatientId: dbRef?.id });
      const res = await api.post('/apply_to_patient_series', {
        jobId,
        patientId: dbPatient.id,
        refPatientId: dbRef?.id ?? null,
      });
      const data = res.data;
      console.log('apply_to_patient_series réponse:', data);

      if (!data.success) {
        const msg = `Le serveur a répondu sans succès.\nRéponse: ${JSON.stringify(data).slice(0, 200)}`;
        setApplyingToSeriesError(msg);
        setApplyingToSeriesStatus('error');
        alert(msg);
        return;
      }

      const patientCount = typeof data.patient_count === 'number' ? data.patient_count : 0;
      const refCount     = typeof data.ref_count     === 'number' ? data.ref_count     : 0;

      setComparisonData({
        patientCount,
        refCount,
        patientName:    data.patient_name    ?? dbPatient.nom ?? '',
        patientDossier: data.patient_dossier ?? '',
        refName:        data.ref_name        ?? dbRef?.nom    ?? '',
      });

      // Thumbnails inclus dans la réponse — pas besoin de second appel
      if (Array.isArray(data.patient_thumbs)) {
        setPanelThumbs(prev => ({ ...prev, patient: data.patient_thumbs as (string | null)[] }));
      }
      if (Array.isArray(data.ref_thumbs)) {
        setPanelThumbs(prev => ({ ...prev, ref: data.ref_thumbs as (string | null)[] }));
      }

      setShowRegisteredSeries(true);
      setShowValidationModal(false);
      setApplyingToSeriesStatus('success');
      setApplyingToSeriesMessage('Série recaléée et prête pour examen');
      setApplyingToSeriesProgress(100);

      // ── Sauvegarde automatique de la série recalée dans le dossier patient ──
      try {
        const saveRes = await fetch('/api/save_registered_series_to_patient', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, patientId: dbPatient.id }),
        });
        const saveData = await saveRes.json();
        if (saveData.success) {
          setAutoSavedToPatient({ ok: true, filename: saveData.filename });
        } else {
          setAutoSavedToPatient({ ok: false });
        }
      } catch {
        setAutoSavedToPatient({ ok: false });
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error
        ?? (typeof err?.response?.data === 'string' ? err.response.data.slice(0, 300) : null)
        ?? err?.message ?? 'Erreur réseau';
      const status = err?.response?.status ?? '?';
      const msg = `Erreur ${status} lors de l'application à la série :\n${serverMsg}`;
      setApplyingToSeriesError(msg);
      setApplyingToSeriesStatus('error');
      alert(msg);
      console.error('apply_to_patient_series error:', err?.response?.data);
    } finally {
      setApplyingToSeries(false);
    }
  };

  const handleRejectRegistration = async () => {
    // UI reset always happens regardless of jobId
    setShowValidationModal(false);
    setShowResult(false);
    setAutoAlignStatus('idle');
    setReferenceImage({ src: '', points: [] });
    setPatientImage({ src: '', points: [] });
    setConfirmedPanelPatients({ reference: null, patient: null });
    setAutoSavedToPatient(null);
    setSaveToPatientResult(null);
    setPhase(1);

    // Notify backend only when a server-side job exists
    if (jobId) {
      try {
        await fetch('/api/volume/reject-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ jobId }),
        });
      } catch (err) {
        console.error('reject-registration API error:', err);
      }
    }
  };

  const handleValidateRegistration = async () => {
    if (!jobId) return;

    // Immediate UI transition: clinician should enter zone identification right away.
    setShowValidationModal(false);
    setShowResult(false);
    setPhase(3);
    setHasBrodmannAttempt(false);

    try {
      const res = await fetch('/api/volume/validate-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    } catch (err: any) {
      // If validation fails server-side, return user to result panel and show error.
      setPhase(2);
      setShowResult(true);
      setAutoAlignError("Échec de la validation volumétrique.");
      setAutoAlignStatus('error');
    }
  };

  const handleValidateAndExplore = async () => {
    if (!jobId) return;
    setShowValidationModal(false);

    // 1. Validate registration on backend
    try {
      await fetch('/api/volume/validate-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId }),
      });
    } catch {
      // continue anyway — jobId is valid, exploration can proceed
    }

    // 2. Auto-save to patient folder
    const dbPatient = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
    if (dbPatient) {
      setSavingToPatient(true);
      try {
        const res = await api.post('/volume/save-registered-to-patient', {
          jobId,
          patientId: dbPatient.id,
          mode: 'advanced',
          mi: autoAlignMetrics?.mutual_information ?? null,
          ncc: autoAlignMetrics?.ncc_after ?? null,
          n_iters: autoAlignMetrics?.n_iters ?? null,
          processing_time_ms: autoAlignMetrics?.processing_time_ms ?? null,
        });
        const data = res.data;
        if (data.success) {
          setSaveToPatientResult({ ok: true, filename: data.original_filename, downloadUrl: data.file_url, uploadedAt: data.uploaded_at });
        } else {
          setSaveToPatientResult({ ok: false, error: data.error || 'Erreur inconnue' });
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'Erreur réseau';
        setSaveToPatientResult({ ok: false, error: msg });
      } finally {
        setSavingToPatient(false);
      }
    }

    sessionStorage.setItem('volumeJobId', jobId);
    setShowExploration(true);
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

  const handleCorticalZoneSelect = async (item: CorticalZoneItem) => {
    if (phase !== 3 || !jobId) return;
    setHasBrodmannAttempt(true);

    try {
      const res = await fetch(
        `/api/volume/brodmann?jobId=${jobId}&axis=${axis}&index=${index}&labelId=${item.id}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Brodmann zone selection failed');

      const data = await res.json();
      setZone(data.zone || null);
      setInsideBrain(Boolean(data.insideBrain));
      if (typeof data.index === 'number') setIndex(data.index);
      if (typeof data.max_index === 'number') setMaxIndex(data.max_index);
      if (data.images) {
        setReferenceImage(p => ({ ...p, src: data.images.atlas }));
        setPatientImage(p => ({ ...p, src: data.images.patient }));
      }
    } catch (err) {
      console.error('Cortical zone selection error:', err);
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
      const axisMax = getAxisMax(nextAxis);
      const clampedIndex = Math.max(0, Math.min(nextIndex, axisMax));
      const refUrl = referenceJobId
        ? `/api/volume/get-slice?jobId=${referenceJobId}&axis=${nextAxis}&index=${clampedIndex}`
        : `/api/volume/atlas_slice?jobId=${jobId}&axis=${nextAxis}&index=${clampedIndex}&showContour=1&showLabels=1`;
      const p1 = fetch(refUrl, { credentials: 'include' }).then(r => r.json());
      const p2 = fetch(`/api/volume/patient_slice?jobId=${jobId}&axis=${nextAxis}&index=${clampedIndex}&showContour=1`, { credentials: 'include' }).then(r => r.json());
      const [ref, patient] = await Promise.all([p1, p2]);
      const refImg = ref.image || ref.slice;
      if (refImg) setReferenceImage(p => ({ ...p, src: refImg }));
      if (!referenceJobId) setAtlasSource((ref.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
      if (patient.image) setPatientImage(p => ({ ...p, src: patient.image }));
      setAxis(nextAxis);
      const rm = typeof ref.max_index === 'number' ? ref.max_index : null;
      const pm = typeof patient.max_index === 'number' ? patient.max_index : null;
      let resolvedMax = axisMax;
      if (rm !== null && pm !== null) resolvedMax = Math.min(rm, pm, axisMax);
      else if (pm !== null) resolvedMax = Math.min(pm, axisMax);
      else if (rm !== null) resolvedMax = Math.min(rm, axisMax);
      setMaxIndex(resolvedMax);
      setIndex(Math.max(0, Math.min(clampedIndex, Math.max(0, resolvedMax))));
    } catch (err) {
      console.error('3D Sync failed:', err);
    }
  };

  const handleRefineManually = () => {
    if (!is2D) return;
    setAutoAlignStatus('idle'); setShowResult(false); setRegistrationMode('manual'); setCameFromMINE(true);
    setReferenceImage(p => ({ ...p, points: [] })); setPatientImage(p => ({ ...p, points: [] }));
    setNextPointId(1); setActiveImage('reference'); setPhase(2);
  };

  const handleBackToRegistration = () => {
    setPhase(2);
    setShowValidationModal(false);
    if (resultImages) {
      setShowResult(true);
      setVisMode('overlay');
      return;
    }
    setShowResult(false);
  };

  const handleBackToImagesPanel = () => {
    setShowValidationModal(false);
    setShowResult(false);
    // phase is already 2 — no reset needed; force canvas redraw after layout settles
    requestAnimationFrame(() => {
      drawCanvas('reference');
      drawCanvas('patient');
    });
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
      setVisMode('overlay');
      setTimeout(() => { console.log('🎨 Draw 1'); drawResultImages(); }, 100);
      setTimeout(() => { console.log('🎨 Draw 2'); drawResultImages(); }, 400);
      setTimeout(() => { console.log('🎨 Draw 3'); drawResultImages(); }, 800);
    }
  }, [pendingShowResult, autoAlignStatus, drawResultImages]);

  const loadPanelFull = useCallback((key: 'ref' | 'patient', idx: number) => {
    const panel = key === 'ref' ? 'reference' : 'patient';
    if (panelDebounceRef.current[key]) clearTimeout(panelDebounceRef.current[key]!);
    panelDebounceRef.current[key] = setTimeout(async () => {
      setPanelFullLoading(prev => ({ ...prev, [key]: true }));
      setPanelFullImg(prev => ({ ...prev, [key]: null }));
      try {
        const res = await api.get('/series_comparison_slice', { params: { jobId, panel, index: idx } });
        setPanelFullImg(prev => ({ ...prev, [key]: res.data.image ?? null }));
      } catch (e) {
        console.error(`series_comparison_slice ${key} error:`, e);
      } finally {
        setPanelFullLoading(prev => ({ ...prev, [key]: false }));
      }
    }, 150);
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load thumbnails when comparison opens — only if not already provided by apply response
  useEffect(() => {
    if (!showRegisteredSeries || !comparisonData || !jobId) return;

    setPanelIndex({ ref: 0, patient: 0 });
    setPanelFullImg({ ref: null, patient: null });

    const loadPanelThumbs = async (panel: 'patient' | 'reference', key: 'patient' | 'ref') => {
      const count = key === 'patient' ? comparisonData.patientCount : comparisonData.refCount;
      // Skip API call if thumbnails already loaded from apply response
      if (count === 0) return;
      setPanelThumbsLoading(prev => ({ ...prev, [key]: true }));
      try {
        const res = await api.get('/series_all_thumbnails', { params: { jobId, panel } });
        const thumbs: (string | null)[] = (res.data.thumbs as any[]).map((t: any) => t.b64 ?? null);
        setPanelThumbs(prev => ({ ...prev, [key]: thumbs }));
        if (thumbs.length > 0) loadPanelFull(key, 0);
      } catch (e) {
        console.error(`series_all_thumbnails ${panel} error:`, e);
      } finally {
        setPanelThumbsLoading(prev => ({ ...prev, [key]: false }));
      }
    };

    // Use thumbnails from apply response if available, otherwise fetch
    setPanelThumbs(prev => {
      const needPatient = prev.patient.length === 0 && comparisonData.patientCount > 0;
      const needRef     = prev.ref.length     === 0 && comparisonData.refCount     > 0;
      if (needPatient) loadPanelThumbs('patient', 'patient');
      if (needRef)     loadPanelThumbs('reference', 'ref');
      // Load first full-size from whichever thumbnails already exist
      if (prev.patient.length > 0) loadPanelFull('patient', 0);
      if (prev.ref.length     > 0) loadPanelFull('ref', 0);
      return prev; // no change — just trigger side effects
    });
  }, [showRegisteredSeries, comparisonData, jobId, loadPanelFull]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise results-slice navigation when the result panel opens in 3D mode
  useEffect(() => {
    if (!showResult) return;
    const is3DMode = registrationDimension === '3d' || registrationDimension === 'advanced';
    if (!is3DMode) return;
    const initAxis = axis;
    const initIdx  = index;
    setResultsAxis(initAxis);
    setResultsIdx(initIdx);
    setResultsMax(maxIndex);
    // Pass maxIndex directly to avoid stale-closure bug (resultsMax still=0 in closure at this point)
    if (jobId) void fetchResultsSlices(initAxis, initIdx, maxIndex);
  }, [showResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag handler for before/after comparison slider
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!splitDragRef.current) return;
      const panel = superpositionPanelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const pos = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPos(pos);
    };
    const onUp = () => { splitDragRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Computed
  const refPts     = referenceImage.points.length;
  const patPts     = patientImage.points.length;
  const pointsOk   = refPts >= 4 && refPts === patPts;
  const slicesVerified = sliceConfirmed && atlasSliceConfirmed;
  const is2D = registrationDimension === '2d';
  const is3D = registrationDimension === '3d' || registrationDimension === 'advanced';
  const canRunManualAlign = canAlign && (is2D || slicesVerified);
  // Keep auto controls available even after a manual result so clinicians can refine with MINE.
  const showAutoButton       = referenceImage.src && patientImage.src && (registrationMode === 'mine' || is3D);
  const showManualButton     = registrationMode === 'manual' && is2D;
  const showManualActions    = referenceImage.src && patientImage.src && registrationMode === 'manual' && is2D;
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
    const isAdvancedMode = registrationDimension === 'advanced';
    if (!jobId && !referenceJobId && !isAdvancedMode) return;
    const reqId = ++sliceFetchSeqRef.current;
    setSliceLoading(true);
    setSliceError('');
    try {
      const qAxis = encodeURIComponent(nextAxis);
      const qRefJob = referenceJobId ? encodeURIComponent(referenceJobId) : null;
      const qJob = jobId ? encodeURIComponent(jobId) : null;

      // Build fetches for available panels
      // In advanced mode, reference is the atlas (no jobId needed)
      const fetches: Promise<Response>[] = [];
      const fetchOrder: ('ref' | 'patient')[] = [];

      if (qRefJob) {
        fetches.push(fetch(`/api/volume/get-slice?jobId=${qRefJob}&axis=${qAxis}&index=${nextIndex}`, { credentials: 'include' }));
        fetchOrder.push('ref');
      } else if (isAdvancedMode) {
        fetches.push(fetch(`/api/volume/atlas_slice?axis=${qAxis}&index=${nextIndex}`, { credentials: 'include' }));
        fetchOrder.push('ref');
      }
      if (qJob) {
        fetches.push(fetch(`/api/volume/get-slice?jobId=${qJob}&axis=${qAxis}&index=${nextIndex}`, { credentials: 'include' }));
        fetchOrder.push('patient');
      }

      const responses = await Promise.all(fetches);
      for (const res of responses) {
        if (!res.ok) {
          if (res.status === 404) {
            sessionStorage.removeItem('volumeJobId');
            setJobId('');
            setReferenceJobId('');
            setSliceShape(null);
            setSuggestedSlice(null);
            throw new Error('Session expirée — réimportez les volumes.');
          }
          if (res.status === 401) throw new Error('Session utilisateur expirée. Reconnectez-vous puis réessayez.');
          throw new Error(`Chargement dynamique échoué (${res.status})`);
        }
      }

      const results = await Promise.all(responses.map(r => r.json()));
      if (reqId !== sliceFetchSeqRef.current) return;

      let refData: any = null;
      let patientData: any = null;

      fetchOrder.forEach((role, i) => {
        if (role === 'ref') refData = results[i];
        else patientData = results[i];
      });

      if (refData) {
        const refImg = refData.image || refData.slice;
        if (refImg) setReferenceImage(p => ({ ...p, src: refImg }));
      }
      if (patientData) {
        if (patientData.slice || patientData.image) {
          setPatientImage(p => ({ ...p, src: patientData.slice || patientData.image }));
        }
      }

      const rm = refData && typeof refData.max_index === 'number' ? refData.max_index : null;
      const pm = patientData && typeof patientData.max_index === 'number' ? patientData.max_index : null;
      let nextMax = maxIndex;
      if (rm !== null && pm !== null) nextMax = Math.min(rm, pm);
      else if (pm !== null) nextMax = pm;
      else if (rm !== null) nextMax = rm;

      setAxis(nextAxis);
      setMaxIndex(nextMax);
      setIndex(Math.min(Math.max(nextIndex, 0), Math.max(0, nextMax)));
      setSliceConfirmed(false);
      setAtlasSliceConfirmed(false);
    } catch (err: any) {
      if (reqId !== sliceFetchSeqRef.current) return;
      console.error('Phase 2 slice navigation failed:', err);
      setSliceError(err?.message || 'Navigation des coupes échouée');
      setAtlasSliceError(err?.message || 'Navigation des coupes échouée');
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

  const fetchResultsSlices = async (nextAxis: string, nextIdx: number, knownMax?: number) => {
    if (!jobId) return;
    setResultsSliceLoading(true);
    try {
      // Use knownMax if provided (avoids stale-closure bug where resultsMax=0 at panel open)
      const effectiveMax = knownMax ?? resultsMax;
      const clamped = effectiveMax > 0 ? Math.max(0, Math.min(nextIdx, effectiveMax)) : Math.max(0, nextIdx);
      // Normalized position (0–1): used for volumes with different slice counts
      // so the atlas and original patient show the anatomically equivalent slice.
      const pct = effectiveMax > 0 ? (clamped / effectiveMax).toFixed(6) : '0.5';
      const [beforeRes, afterRes, refRes] = await Promise.all([
        fetch(`/api/volume/get-slice?jobId=${jobId}&axis=${nextAxis}&pct=${pct}&source=original`, { credentials: 'include' }),
        fetch(`/api/volume/get-slice?jobId=${jobId}&axis=${nextAxis}&index=${clamped}&source=registered`, { credentials: 'include' }),
        referenceJobId
          ? fetch(`/api/volume/get-slice?jobId=${referenceJobId}&axis=${nextAxis}&pct=${pct}`, { credentials: 'include' })
          : fetch(`/api/volume/atlas_slice?jobId=${jobId}&axis=${nextAxis}&pct=${pct}&showLabels=0`, { credentials: 'include' }),
      ]);
      const [beforeData, afterData, refData] = await Promise.all([
        beforeRes.ok ? beforeRes.json() : null,
        afterRes.ok ? afterRes.json() : null,
        refRes.ok ? refRes.json() : null,
      ]);
      const newMax = afterData?.max_index ?? beforeData?.max_index ?? effectiveMax;
      if (newMax !== resultsMax) setResultsMax(newMax);
      setResultsIdx(clamped);
      if (beforeData?.image) setOriginalImages(prev => prev ? { ...prev, pat: beforeData.image } : prev);
      const patAfter = afterData?.image || afterData?.slice;
      const refImg   = refData?.image || refData?.slice;
      if (patAfter || refImg) {
        setResultImages(prev => ({
          ref: refImg   || prev?.ref || '',
          pat: patAfter || prev?.pat || '',
        }));
      }
    } catch { /* keep existing images on error */ }
    finally { setResultsSliceLoading(false); }
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
    setSelectionPendingMode(mode);
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
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('');
    setJobId('');
    setResultImages(null);
    setOriginalImages(null);
    setDisplayResultImages(null);
    setNormalizedResult(null);
    setNormalizedOriginal(null);
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
    setSelectedPatient(null);
    setPatientFiles([]);
    setPanelPatient({ reference: null, patient: null });
    setPanelPatientFiles({ reference: [], patient: [] });
    setConfirmedPanelPatients({ reference: null, patient: null });

    void fetchAllPatientsForPanels();

    setRegistrationMode(mode === '2d' ? 'manual' : 'mine');
    setReferenceJobId('');

    if (mode === 'advanced') {
      await loadChosenAtlasAndDemo();
    }
  };

  const handlePatientSelect = async (patient: any) => {
    setShowPatientSelector(false);
    setSelectedPatient(patient);
    setSelectedRefFileId(null);
    setSelectedPatFileId(null);
    setJobId('');
    
    if (selectionPendingMode) {
      const mode = selectionPendingMode;
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
      setAutoAlignProgress(undefined);
      setAutoAlignStageMessage('');
      setJobId('');
      setReferenceJobId('');
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

      // Fetch patient files then auto-load NIfTI in 3D mode
      setLoadingPatientFiles(true);
      try {
        const res = await fetch(`/api/patients/${patient.id}/mri-files/`, { credentials: 'include' });
        const data = await res.json();
        if (data.ok) {
          const files: any[] = data.mri_files || [];
          setPatientFiles(files);

          if (mode === '3d') {
            const niftiFiles = files.filter((f: any) => {
              const name = (f.original_filename || '').toLowerCase();
              return name.endsWith('.nii') || name.endsWith('.nii.gz');
            });
            if (niftiFiles.length > 0) {
              // Auto-select the first NIfTI — reference is always MNI152
              await handleSelectPatientFile(niftiFiles[0], 'patient');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching patient files:', err);
      } finally {
        setLoadingPatientFiles(false);
      }
    }
  };

  const loadChosenAtlasAndDemo = async () => {
    try {
      const atlasRes = await fetch('/api/volume/atlas_slice?axis=axial', { credentials: 'include' });
      if (!atlasRes.ok) return;
      const atlasData = await atlasRes.json();
      if (atlasData.image) {
        setReferenceImage({ src: atlasData.image, points: [] });
        setAtlasSource((atlasData.source === 'custom' ? 'custom' : 'official') as AtlasSourceOption);
        setAxis(atlasData.axis || 'axial');
        setIndex(typeof atlasData.index === 'number' ? atlasData.index : 0);
        setMaxIndex(typeof atlasData.max_index === 'number' ? atlasData.max_index : 0);
        setPhase(2);
      }
    } catch (err) {
      console.error('Load atlas failed:', err);
    }
  };

  // ── Confirmation dialog helper ────────────────────────────────────────────────
  const askConfirm = (
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
    options?: { detail?: string; danger?: boolean }
  ) => {
    setConfirmDialog({ title, message, confirmLabel, onConfirm, ...options });
  };

  // ── Picker modal helpers ──────────────────────────────────────────────────────
  const openPanelPicker = (panelType: 'reference' | 'patient') => {
    setPickerSelectedPatient(null);
    setPickerPatientFiles([]);
    setPickerSearch('');
    setPanelPickerOpen(panelType);
  };

  const closePanelPicker = () => {
    setPanelPickerOpen(null);
    setPickerSelectedPatient(null);
    setPickerPatientFiles([]);
  };

  const selectPickerPatient = async (patient: any) => {
    setPickerSelectedPatient(patient);
    setPickerFilesLoading(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/mri-files/`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setPickerPatientFiles(data.mri_files || []);
    } catch (err) {
      console.error('Failed to load picker files:', err);
    } finally {
      setPickerFilesLoading(false);
    }
  };

  const handlePickerFileSelect = (file: any) => {
    const panelType = panelPickerOpen!;
    const typeLabel = panelType === 'reference' ? 'RÉFÉRENCE (Fixe)' : 'PATIENT (Moving)';
    const patientName = `${pickerSelectedPatient?.nom || ''} ${pickerSelectedPatient?.prenom || ''}`.trim();
    askConfirm(
      `Confirmer l'image ${typeLabel}`,
      `Vous avez sélectionné "${file.original_filename}" du dossier ${patientName}.`,
      'Confirmer ce choix',
      () => {
        handleSelectPatientFile(file, panelType, pickerSelectedPatient);
        setConfirmedPanelPatients(prev => ({ ...prev, [panelType]: pickerSelectedPatient }));
        closePanelPicker();
        setConfirmDialog(null);
      },
      {
        detail: `Cette image sera utilisée comme image ${typeLabel}. ${
          panelType === 'reference'
            ? 'Elle restera fixe et servira de référence tout au long du recalage.'
            : 'Elle sera déplacée et alignée sur l\'image de référence.'
        } Confirmez-vous ce choix ?`,
      }
    );
  };

  const handleLocalFileWithConfirm = (file: File, panelType: 'reference' | 'patient') => {
    const typeLabel = panelType === 'reference' ? 'RÉFÉRENCE (Fixe)' : 'PATIENT (Moving)';
    askConfirm(
      `Confirmer l'image ${typeLabel}`,
      `Vous allez importer "${file.name}" comme image ${typeLabel}.`,
      'Oui, utiliser cette image',
      () => {
        if (is3D) {
          panelType === 'patient' ? void importPatient3D(file) : void importReferenceVolume3D(file);
        } else {
          handleImageUpload(file, panelType);
        }
        setConfirmDialog(null);
      },
      {
        detail: `${panelType === 'reference'
          ? 'Cette image restera fixe — elle sera la référence que le recalage cherchera à aligner.'
          : 'Cette image sera alignée sur la référence. Assurez-vous que le fichier correspond bien au volume patient à recaler.'
        }`,
      }
    );
  };

  // ── Per-panel patient browsing ────────────────────────────────────────────────
  const fetchAllPatientsForPanels = async () => {
    setAllPatientsLoading(true);
    try {
      const res = await fetch('/api/patients/', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setAllPatients(data.patients || []);
    } catch (err) {
      console.error('Failed to fetch patients for panels:', err);
    } finally {
      setAllPatientsLoading(false);
    }
  };

  const fetchFilesForPanel = async (patient: any, panelType: 'reference' | 'patient') => {
    setPanelFilesLoading(prev => ({ ...prev, [panelType]: true }));
    try {
      const res = await fetch(`/api/patients/${patient.id}/mri-files/`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setPanelPatientFiles(prev => ({ ...prev, [panelType]: data.mri_files || [] }));
      }
    } catch (err) {
      console.error('Failed to fetch files for panel:', err);
    } finally {
      setPanelFilesLoading(prev => ({ ...prev, [panelType]: false }));
    }
  };

  const selectPatientForPanel = (patient: any, panelType: 'reference' | 'patient') => {
    setPanelPatient(prev => ({ ...prev, [panelType]: patient }));
    setSelectedPatient(patient);
    fetchFilesForPanel(patient, panelType);
  };

  const resetPanelPatient = (panelType: 'reference' | 'patient') => {
    setPanelPatient(prev => ({ ...prev, [panelType]: null }));
    setPanelPatientFiles(prev => ({ ...prev, [panelType]: [] }));
  };

  // ── Local file import ────────────────────────────────────────────────────────
  const handleLocalImport = async (file: File) => {
    const mode = selectionPendingMode;
    if (!mode) return;

    setShowPatientSelector(false);
    setSelectedPatient(null);
    setSelectedRefFileId(null);
    setSelectedPatFileId(null);
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
    setAutoAlignProgress(undefined);
    setAutoAlignStageMessage('');
    setJobId('');
    setResultImages(null);
    setOriginalImages(null);
    setDisplayResultImages(null);
    setNormalizedResult(null);
    setNormalizedOriginal(null);
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

    const isNifti = file.name.toLowerCase().endsWith('.nii') || file.name.toLowerCase().endsWith('.nii.gz');

    if (isNifti) {
      // 3D / Advanced path — upload NIfTI, initialize job, load first slices
      setIsInitializingRegistration(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch('/api/volume/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.jobId) throw new Error('jobId manquant');

        const newJobId = uploadData.jobId as string;
        setJobId(newJobId);
        sessionStorage.setItem('volumeJobId', newJobId);

        // Load atlas + patient first slices in parallel
        const [atlasRes, sliceRes] = await Promise.all([
          fetch(`/api/volume/atlas_slice?jobId=${newJobId}&axis=axial&index=0&showLabels=0`, { credentials: 'include' }),
          fetch(`/api/volume/get-slice?jobId=${newJobId}&axis=axial&index=0`, { credentials: 'include' }),
        ]);
        const [atlasData, sliceData] = await Promise.all([atlasRes.json(), sliceRes.json()]);

        if (atlasData.image) {
          setReferenceImage({ src: atlasData.image, points: [] });
          setAtlasSource('official');
        }
        if (sliceData.image) {
          setPatientImage({ src: sliceData.image, points: [] });
        }
        if (typeof atlasData.max_index === 'number') {
          setMaxIndex(atlasData.max_index);
        }

        setPhase(2);
      } catch (err) {
        console.error('Local NIfTI import failed:', err);
      } finally {
        setIsInitializingRegistration(false);
      }
    } else {
      // 2D path — read file as DataURL, set as patient image
      const reader = new FileReader();
      reader.onload = e => {
        const src = e.target?.result as string;
        if (src) setPatientImage({ src, points: [] });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPatientFile = async (file: any, type: 'reference' | 'patient', patientOverride?: any) => {
    const effectivePatient = patientOverride || panelPatient[type] || selectedPatient;
    try {
      setSliceLoading(true);
      const isNifti = file.original_filename.toLowerCase().endsWith('.nii') || file.original_filename.toLowerCase().endsWith('.nii.gz');

      if (isNifti) {
        setIsInitializingRegistration(true);
        try {
          const res = await fetch('/api/registration/initialize/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              pat_file_id: file.id,
              patient_id: effectivePatient?.num_dossier || 'Unknown'
            })
          });
          const data = await res.json();
          if (data.ok) {
            const sliceRes = await fetch(`/api/volume/get-slice?jobId=${data.jobId}&axis=axial&index=0`, { credentials: 'include' });
            const sliceData = sliceRes.ok ? await sliceRes.json() : {};

            if (type === 'reference') {
              setReferenceJobId(data.jobId);
              setReferenceImage({ src: sliceData.image || '', points: [] });
              setIndex(0);
              setMaxIndex(sliceData.max_index || 0);
              if (jobId) setPhase(2);
            } else {
              setJobId(data.jobId);
              sessionStorage.setItem('volumeJobId', data.jobId);
              setPatientImage({ src: sliceData.image || '', points: [] });
              setIndex(0);
              setMaxIndex(sliceData.max_index || 0);
              if (referenceJobId || referenceImage.src) setPhase(2);
            }
          }
        } catch (err) {
          console.error('Error initializing 3D registration:', err);
        } finally {
          setIsInitializingRegistration(false);
        }
      } else {
        // 2D images
        const src = file.file_url;
        let hasRef = !!referenceImage.src;
        let hasPat = !!patientImage.src;

        if (type === 'reference') {
          setReferenceImage({ src, points: [] });
          setRefView(DEFAULT_VIEW);
          setSelectedRefFileId(file.id);
          hasRef = true;
        } else {
          setPatientImage({ src, points: [] });
          setPatView(DEFAULT_VIEW);
          setSelectedPatFileId(file.id);
          hasPat = true;
        }

        // If both are now selected from the dossier, initialize the job
        const refId = type === 'reference' ? file.id : selectedRefFileId;
        const patId = type === 'patient' ? file.id : selectedPatFileId;

        if (refId && patId) {
          setIsInitializingRegistration(true);
          try {
            const initRes = await fetch('/api/registration/initialize/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                ref_file_id: refId,
                pat_file_id: patId,
                patient_id: effectivePatient?.num_dossier || 'Unknown'
              })
            });
            const initData = await initRes.json();
            if (initData.ok) {
              setJobId(initData.jobId);
              // Now that both are selected and session is ready, switch to Phase 2
              setPhase(2);
            }
          } catch (err) {
            console.error('Error initializing 2D registration:', err);
          } finally {
            setIsInitializingRegistration(false);
          }
        }
      }
    } catch (err) {
      console.error('Error selecting patient file:', err);
    } finally {
      setSliceLoading(false);
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
    const FLOWS = [
      {
        id: '2d' as const,
        step: '01',
        icon: <MousePointer2 className="h-6 w-6" />,
        title: 'Recalage 2D',
        subtitle: 'Image par image',
        desc: 'Importez deux images médicales (référence + patient), placez des points de repère ou lancez le recalage automatique MINE, puis exportez les résultats annotés.',
        tags: ['Import PNG/JPEG/NIfTI', 'Recalage manuel', 'Recalage auto', 'Export résultats'],
        accent: {
          card: 'border-2 border-cyan-400 bg-gradient-to-br from-cyan-500 to-teal-500',
          iconWrap: 'bg-white/20 text-white border border-white/30',
          tag: 'bg-white/20 text-white border border-white/25',
          step: 'text-white/20',
          title: 'text-white',
          subtitle: 'text-cyan-100',
          desc: 'text-white/80',
          footer: 'border-white/20',
          dot: 'bg-white',
          dotOff: 'bg-white/25',
          badgeText: 'Débutant',
          cta: 'text-white',
          hover: 'hover:shadow-cyan-300/40',
        },
        levels: 1,
      },
      {
        id: '3d' as const,
        step: '02',
        icon: <BrainCircuit className="h-6 w-6" />,
        title: 'Recalage 3D',
        subtitle: 'Standard ou basé atlas MNI152',
        desc: 'Choisissez entre un recalage volumique standard (2 volumes NIfTI) ou un recalage basé atlas MNI152 avec identification interactive des aires de Brodmann.',
        tags: ['Recalage standard', 'Atlas MNI152 auto', 'MINE 3D / Hybride', 'Brodmann'],
        accent: {
          card: 'border-2 border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600',
          iconWrap: 'bg-white/20 text-white border border-white/30',
          tag: 'bg-white/20 text-white border border-white/25',
          step: 'text-white/20',
          title: 'text-white',
          subtitle: 'text-blue-200',
          desc: 'text-white/80',
          footer: 'border-white/20',
          dot: 'bg-white',
          dotOff: 'bg-white/25',
          badgeText: 'Intermédiaire',
          cta: 'text-white',
          hover: 'hover:shadow-blue-400/40',
        },
        levels: 2,
      },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">

        {/* ── HERO — image pleine largeur ── */}
        <div className="relative h-[46vh] min-h-[280px] max-h-[420px] overflow-hidden rounded-b-3xl shadow-xl mx-4 mt-4">
          <img
            src="/assets/images/recalage.jpg"
            alt="Médecins analysant des IRM cérébrales"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Overlay léger — pointer-events-none pour ne pas bloquer les boutons */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-slate-900/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 via-transparent to-blue-900/20 pointer-events-none" />

          {/* Texte centré — pointer-events-none pour laisser passer les clics vers les boutons */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/80 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Recalage multimodal assisté par IA
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-lg">
              Choisissez votre<br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                flux de recalage
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/55 leading-relaxed">
              Sélectionnez le mode adapté à votre objectif clinique et lancez l'analyse.
            </p>
          </div>

          {/* Boutons z-10 — au-dessus de tous les overlays */}
          <button
            onClick={() => onNavigate('')}
            className="absolute top-5 left-6 z-10 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="h-3 w-3" /> Retour
          </button>
          <div className="absolute top-5 right-6 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-1.5">
            <div className="h-4 w-4 rounded-md bg-blue-500 flex items-center justify-center">
              <BrainCircuit className="h-2.5 w-2.5 text-white" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">VisionMed</p>
          </div>
        </div>

        {/* ── CARDS section ── */}
        <div className="mx-auto max-w-5xl px-6 pb-12 pt-8">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-8">
            Sélectionnez votre flux clinique
          </p>

          {/* Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-3xl mx-auto">
            {FLOWS.map((flow) => (
              <button
                key={flow.id}
                onClick={() => flow.id === '3d' ? setShowThreeDSubModal(true) : void handleChooseRegistrationDimension(flow.id)}
                className={`group relative text-left rounded-2xl ${flow.accent.card} p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${flow.accent.hover} shadow-lg`}
              >
                {/* Icon */}
                <div className={`inline-flex rounded-xl border p-3 mb-4 ${flow.accent.iconWrap}`}>
                  {flow.icon}
                </div>

                {/* Title */}
                <h2 className={`text-xl font-black ${flow.accent.title} leading-tight`}>{flow.title}</h2>
                <p className={`text-[11px] font-semibold mt-0.5 mb-3 ${flow.accent.subtitle}`}>{flow.subtitle}</p>

                {/* Description */}
                <p className={`text-[12px] leading-relaxed mb-4 ${flow.accent.desc}`}>{flow.desc}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {flow.tags.map(tag => (
                    <span key={tag} className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${flow.accent.tag}`}>{tag}</span>
                  ))}
                </div>

                {/* CTA */}
                <div className={`flex items-center justify-end pt-3 border-t ${flow.accent.footer}`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all ${flow.accent.cta}`}>
                    Lancer <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Hint */}
          <p className="text-center text-[11px] text-slate-400 mt-8">
            Vous pouvez changer de flux à tout moment en revenant à cette page.
          </p>
        </div>{/* end cards section */}

        {/* ── Modal choix sous-flux 3D ── */}
        {showThreeDSubModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowThreeDSubModal(false)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-[fadeInScale_0.2s_ease-out]">
              {/* Header */}
              <button
                onClick={() => setShowThreeDSubModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Recalage 3D</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Choisissez votre approche volumique</p>
                </div>
              </div>
              <div className="h-px bg-slate-100 my-4" />

              {/* Option 1 — Standard */}
              <button
                onClick={() => { setShowThreeDSubModal(false); void handleChooseRegistrationDimension('3d'); }}
                className="w-full text-left rounded-xl border-2 border-blue-200 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 p-4 mb-3 transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <BrainCircuit className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">Recalage 3D Standard</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Importez deux volumes NIfTI (référence + patient) et lancez le recalage neuronal MINE 3D ou Hybride avec navigation coupes axiales/coronales/sagittales.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['2 volumes NIfTI', 'MINE 3D / Hybride', 'Navigation coupes', 'Validation clinique'].map(t => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 mt-1 transition-colors shrink-0" />
                </div>
              </button>

              {/* Option 2 — Atlas MNI152 + Brodmann */}
              <button
                onClick={() => { setShowThreeDSubModal(false); void handleChooseRegistrationDimension('advanced'); }}
                className="w-full text-left rounded-xl border-2 border-violet-200 hover:border-violet-500 bg-violet-50/50 hover:bg-violet-50 p-4 transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <BrainCircuit className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 group-hover:text-violet-700 transition-colors">Recalage 3D basé atlas MNI152</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Uploadez uniquement votre volume patient — l'atlas MNI152 se télécharge automatiquement. Suivi d'une identification interactive des 47 aires de Brodmann avec coordonnées MNI.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['1 volume patient', 'Atlas MNI152 auto', '47 zones Brodmann', 'Coordonnées MNI'].map(t => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 mt-1 transition-colors shrink-0" />
                </div>
              </button>
            </div>
          </div>
        )}

        <PatientSelectionModal
          isOpen={showPatientSelector}
          onClose={() => setShowPatientSelector(false)}
          onSelectPatient={handlePatientSelect}
          onLocalImport={handleLocalImport}
          mode={selectionPendingMode}
        />
      </div>
    );
  }

  return (
    <div className="registration-full-dark flex h-screen bg-[#eef4ff] text-slate-800 overflow-hidden font-sans selection:bg-blue-100">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"/>
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
      <aside className="w-72 flex-none bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl overflow-hidden">
        {/* ── Zone fixe : Retour + Header ── */}
        <div className="shrink-0">
        {/* ── Bouton Retour (identique aux autres boutons Retour de l'app) ── */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <button
            onClick={startNewRegistration}
            disabled={autoAlignStatus === 'processing'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour au choix du mode
          </button>
        </div>
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Brain className="text-white w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black tracking-tight text-slate-900">NeuroScan</h1>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">Registration Hub</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">Dr. {doctorDisplayName}</span>
            </div>
          </div>
        </div>
        </div>{/* fin zone fixe */}

        {/* ── Zone scrollable : Progression + Mode + Actions ── */}
        <div className="flex-1 overflow-y-auto flex flex-col">

        {/* Progression */}
        <div className="px-4 py-2.5 border-b border-slate-200 shrink-0">
          <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-2">Progression</p>
          <div className="flex items-center gap-0">
            {[{label:'Import',done:phase>=1,active:phase===1,color:'bg-blue-600'},{label:'Recalage',done:phase>=2,active:phase===2,color:'bg-blue-500'},{label:registrationDimension==='advanced' ? 'Brodmann' : 'Validation',done:phase>=3,active:phase===3,color:'bg-blue-700'}].map(({label,done,active,color},i,arr)=>(
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${done?`${color} shadow-lg ${active?'ring-4 ring-blue-100':''}`:'bg-slate-100 border border-slate-300'}`}>
                    {done && phase > i+1 ? <Check className="w-3 h-3 text-white"/> : <span className={`text-[9px] font-bold ${done?'text-white':'text-slate-700'}`}>{i+1}</span>}
                  </div>
                  <span className={`text-[8px] font-semibold whitespace-nowrap ${done?'text-slate-700':'text-slate-500'}`}>{label}</span>
                </div>
                {i<arr.length-1&&<div className={`flex-1 h-px mb-4 mx-1 transition-colors duration-500 ${done?'bg-slate-400':'bg-slate-200'}`}/>}
              </React.Fragment>
            ))}
          </div>
        </div>


        {/* Mode selector or Phase 3 Info */}
        <div className="px-3 py-2.5 border-b border-slate-200">
          {phase === 3 ? (
            <div className="space-y-3">
              <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{is3D ? 'Mode Brodmann' : 'Mode Resultats'}</p>
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
                {is3D ? (
                  <>
                    <p className="text-[10px] font-bold text-emerald-700">Navigation centralisee</p>
                    <p className="mt-1 text-[9px] text-slate-600">
                      Utilisez le slider principal sous les images et les boutons A/C/S pour changer les coupes.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-emerald-700">Visualisation finale</p>
                    <p className="mt-1 text-[9px] text-slate-600">
                      Visualisez la superposition coloree et la heatmap de differences, puis exportez le resultat.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : referenceImage.src&&patientImage.src&&is2D?(
            <RegistrationModeSelector selectedMode={registrationMode as any} onModeChange={setRegistrationMode as any} disabled={autoAlignStatus==='processing'} onShowManualGuide={() => setShowManualGuide(true)} onShowAutoGuide={() => setShowAutoGuide(true)} onShowAssistant={() => { setAssistantObjective(null); setShowModeAssistant(true); }}/>
          ):(
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Mode de Recalage</p>
              <div className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-[10px] text-slate-500 text-center italic">Importez les deux images pour choisir le mode</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 py-3 space-y-2 flex-1 overflow-y-auto">
          {phase === 3 ? (
            <>
              <button onClick={handleBackToRegistration} className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5"/> Retour au Recalage
              </button>
              <button onClick={resetCurrentRegistration} className="w-full py-2.5 px-4 rounded-xl border border-blue-300 bg-blue-50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors">
                <RotateCcw className="w-3.5 h-3.5"/> Nouveau recalage
              </button>

              {is3D && (
              <div className="mt-2 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 p-3 shadow-[0_10px_22px_rgba(37,99,235,0.12)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black text-blue-800 uppercase tracking-[0.12em]">Zones corticales</p>
                  <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800">
                    {availableCorticalZones.length}
                  </span>
                </div>

                {atlasSource !== 'official' ? (
                  <p className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold leading-relaxed text-amber-800">
                    Atlas personnalise: liste officielle indisponible.
                  </p>
                ) : loadingCorticalZones ? (
                  <p className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700">
                    Chargement des zones...
                  </p>
                ) : availableCorticalZones.length === 0 ? (
                  <p className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700">
                    Aucune zone disponible.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {availableCorticalZones.map((item) => {
                      const active = zone?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => void handleCorticalZoneSelect(item)}
                          className={`cursor-pointer flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[10px] transition-colors ${active ? 'border-blue-300 bg-blue-100 text-blue-900 shadow-[0_0_10px_rgba(37,99,235,0.12)]' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                        >
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-700'}`}>
                            {item.id}
                          </span>
                          <span className="truncate font-semibold">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={resetCurrentRegistration}
                disabled={autoAlignStatus==='processing'}
                className={`w-full py-2.5 px-4 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-2 transition-colors ${autoAlignStatus==='processing' ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              >
                <RotateCcw className="w-3.5 h-3.5"/> Nouveau recalage
              </button>

              {showManualButton && (
                <button
                  onClick={undoLastPoint}
                  disabled={refPts === 0 && patPts === 0}
                  title="Annuler le dernier point (Ctrl+Z)"
                  className={`w-full py-2 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border ${
                    refPts === 0 && patPts === 0
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <Undo2 className="w-3.5 h-3.5"/> Annuler
                </button>
              )}

              {showAutoButton&&(
                <>
                  {/* Bouton Automatique */}
                  <div className="relative">
                    <button
                      onClick={handleAutoAlign}
                      disabled={autoAlignStatus === 'processing'}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-all flex items-center gap-3
                        ${autoAlignStatus === 'processing'
                          ? 'bg-slate-100 border-2 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-lg shadow-blue-200 cursor-pointer border-2 border-blue-600'
                        }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        {autoAlignStatus === 'processing'
                          ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          : <BrainCircuit className="w-4 h-4 text-white" />
                        }
                      </div>
                      <div className="flex-1 pr-5">
                        <p className={`text-xs font-black ${autoAlignStatus === 'processing' ? 'text-slate-400' : 'text-white'}`}>
                          {autoAlignStatus === 'processing' ? 'Recalage en cours…' : 'Recalage affine'}
                        </p>
                        <p className={`text-[9px] mt-0.5 ${autoAlignStatus === 'processing' ? 'text-slate-400' : 'text-blue-200'}`}>
                          Transformations affines globales · ⚡ Rapide
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setShowAutoGuide3D(true); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white transition-colors"
                      title="Guide d'utilisation"
                    >
                      <GuideIcon />
                    </button>
                  </div>

                  {/* Bouton Hybride */}
                  <div className="relative">
                    <button
                      onClick={is3D && autoAlignStatus !== 'processing' ? handleHybridAlign : undefined}
                      disabled={!is3D || autoAlignStatus === 'processing'}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-all flex items-center gap-3
                        ${!is3D || autoAlignStatus === 'processing'
                          ? 'bg-slate-100 border-2 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-violet-600 hover:bg-violet-700 active:scale-[0.99] shadow-lg shadow-violet-200 cursor-pointer border-2 border-violet-600'
                        }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        <Box className={`w-4 h-4 ${!is3D ? 'text-slate-400' : 'text-white'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-5">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-black ${!is3D ? 'text-slate-400' : 'text-white'}`}>Recalage déformable</p>
                          {!is3D && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                              3D uniquement
                            </span>
                          )}
                          {is3D && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-violet-400/40 text-violet-100 px-1.5 py-0.5 rounded-full">
                              Recommandé
                            </span>
                          )}
                        </div>
                        <p className={`text-[9px] mt-0.5 ${!is3D ? 'text-slate-400' : 'text-violet-200'}`}>
                          {is3D ? 'Global + corrections locales · ⏱ ~30s' : '3D uniquement'}
                        </p>
                      </div>
                    </button>
                    {is3D && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowHybridGuide(true); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white transition-colors"
                        title="Guide d'utilisation"
                      >
                        <GuideIcon />
                      </button>
                    )}
                  </div>

                  {/* Bouton Aide au choix (3D uniquement — en 2D il est dans le RegistrationModeSelector) */}
                  {is3D && (
                    <button
                      onClick={() => { setAssistantObjective(null); setShowModeAssistant(true); }}
                      disabled={autoAlignStatus === 'processing'}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      Aide au choix de mode
                    </button>
                  )}

                  {/* Modal guide Mode Automatique (3D) */}
                  {showAutoGuide3D && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAutoGuide3D(false)}>
                      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
                              <BrainCircuit className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Aide</p>
                              <h2 className="text-sm font-black text-white">Alignement automatique Standard</h2>
                            </div>
                          </div>
                          <button onClick={() => setShowAutoGuide3D(false)} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                              <BrainCircuit className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed">
                              Ce mode automatise l'alignement global des images. En un clic, le système ajuste l'orientation et l'échelle pour superposer les deux coupes.
                            </p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-base leading-none mt-0.5">✓</span>
                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                              <span className="font-black">Idéal pour : </span>un gain de temps ou si le mode manuel s'avère imprécis. Aucun marquage de points requis.
                            </p>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                            <span className="text-amber-500 font-black text-sm mt-0.5">!</span>
                            <p className="text-[10px] text-amber-800 leading-relaxed">
                              <span className="font-black">Note : </span>Vérifiez toujours le résultat dans la vue de superposition avant de valider.
                            </p>
                          </div>
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                          <button onClick={() => setShowAutoGuide3D(false)} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition">
                            Compris
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal guide Mode Hybride */}
                  {showHybridGuide && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHybridGuide(false)}>
                      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-violet-700 to-purple-600 px-6 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
                              <Box className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">Aide</p>
                              <h2 className="text-sm font-black text-white">Alignement Haute Précision</h2>
                            </div>
                          </div>
                          <button onClick={() => setShowHybridGuide(false)} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          <div className="flex items-start gap-3 rounded-xl bg-violet-50 border border-violet-100 p-4">
                            <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Box className="h-4 w-4 text-violet-600" />
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed">
                              Ce mode avancé combine un ajustement global et une correction locale détaillée. Il s'adapte aux variations anatomiques spécifiques du patient pour garantir une superposition parfaite, même sur les structures cérébrales complexes.
                            </p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-2">
                            <span className="text-emerald-500 font-black text-base leading-none mt-0.5">✓</span>
                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                              <span className="font-black">Idéal pour : </span>les cas complexes où l'alignement automatique standard ne suffit pas. Corrige les variations anatomiques locales.
                            </p>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                            <span className="text-amber-500 font-black text-sm mt-0.5">!</span>
                            <p className="text-[10px] text-amber-800 leading-relaxed">
                              <span className="font-black">Note : </span>Temps de calcul légèrement supérieur (~30s). Disponible en mode 3D et Avancé uniquement.
                            </p>
                          </div>
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                          <button onClick={() => setShowHybridGuide(false)} className="px-5 py-2 rounded-xl bg-violet-700 text-white text-xs font-black hover:bg-violet-800 transition">
                            Compris
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {showManualActions&&(
                <button onClick={handleManualAlign} disabled={autoAlignStatus==='processing'||!canRunManualAlign}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${!canRunManualAlign?'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed':'bg-slate-800 text-white hover:bg-slate-700 shadow-lg'}`}>
                  <MousePointer2 className="w-4 h-4"/>Recalage Manuel
                </button>
              )}

              {/* Modal guide recalage manuel */}
              {showManualGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowManualGuide(false)}>
                  <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
                          <MousePointer2 className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aide</p>
                          <h2 className="text-sm font-black text-white">Guide : Recalage Manuel</h2>
                        </div>
                      </div>
                      <button onClick={() => setShowManualGuide(false)} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>

                    {/* Intro */}
                    <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        Ce mode vous permet d'aligner manuellement l'image du patient sur l'image de référence en plaçant des points de correspondance anatomique.
                      </p>
                    </div>

                    {/* Étapes */}
                    <div className="px-6 py-4 space-y-3">
                      {[
                        { n: '1', title: 'Identification', color: 'bg-slate-700', desc: 'Repérez une structure anatomique identique sur les deux coupes affichées (ex. : un sillon, une cavité, un repère osseux).' },
                        { n: '2', title: 'Marquage', color: 'bg-blue-600', desc: 'Placez un point sur l\'image de référence, puis placez son correspondant au même endroit sur l\'image du patient.' },
                        { n: '3', title: 'Précision', color: 'bg-indigo-600', desc: 'Répétez l\'opération pour au moins 4 paires de points bien répartis. Plus les emplacements sont précis, plus l\'alignement sera fidèle.' },
                        { n: '4', title: 'Calcul', color: 'bg-emerald-600', desc: 'Une fois les points validés, l\'algorithme calcule instantanément la transformation pour superposer les deux volumes.' },
                        { n: '5', title: 'Ajustement', color: 'bg-violet-600', desc: 'Vous pouvez déplacer ou supprimer vos marqueurs à tout moment avant de confirmer le résultat final.' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <span className={`shrink-0 h-6 w-6 rounded-full ${step.color} text-white text-[10px] font-black flex items-center justify-center mt-0.5`}>
                            {step.n}
                          </span>
                          <div>
                            <p className="text-[11px] font-black text-slate-800">{step.title}</p>
                            <p className="text-[10px] text-slate-500 leading-relaxed">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    <div className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                      <span className="shrink-0 text-amber-500 font-black text-sm mt-0.5">!</span>
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        <span className="font-black">Note clinique : </span>
                        Un bon résultat dépend de la précision du placement de vos paires de points. Privilégiez des repères anatomiques stables et bien visibles sur les deux images.
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <button onClick={() => setShowManualGuide(false)}
                        className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-black hover:bg-slate-700 transition">
                        Compris
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal guide mode automatique */}
              {showAutoGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAutoGuide(false)}>
                  <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-700 to-purple-600 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
                          <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-purple-300">Aide</p>
                          <h2 className="text-sm font-black text-white">Alignement automatique Standard</h2>
                        </div>
                      </div>
                      <button onClick={() => setShowAutoGuide(false)} className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>

                    {/* Contenu */}
                    <div className="px-6 py-5 space-y-4">
                      <div className="flex items-start gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <BrainCircuit className="h-4 w-4 text-purple-600" />
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          Ce mode automatise l'alignement global des images. En un clic, le système ajuste l'orientation et l'échelle pour superposer les deux coupes.
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-2">
                        <span className="text-emerald-500 font-black text-base leading-none mt-0.5">✓</span>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          <span className="font-black">Idéal pour : </span>
                          un gain de temps ou si le mode manuel s'avère imprécis. Aucun marquage de points requis.
                        </p>
                      </div>

                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                        <span className="text-amber-500 font-black text-sm mt-0.5">!</span>
                        <p className="text-[10px] text-amber-800 leading-relaxed">
                          <span className="font-black">Note : </span>
                          Vérifiez toujours le résultat dans la vue de superposition après l'alignement automatique avant de valider.
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <button onClick={() => setShowAutoGuide(false)}
                        className="px-5 py-2 rounded-xl bg-purple-700 text-white text-xs font-black hover:bg-purple-800 transition">
                        Compris
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showManualActions&&!canAlign&&refPts<4&&<p className="text-[10px] text-slate-600 text-center leading-relaxed">Marquez au moins 4 points sur chaque image.</p>}
              {showManualActions&&is3D&&canAlign&&!slicesVerified&&(
                <p className="text-[10px] text-amber-700 text-center leading-relaxed">
                  Verifiez et confirmez d'abord la coupe Atlas et la coupe Patient.
                </p>
              )}
            </>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            {[{icon:<Download className="w-4 h-4"/>,onClick:exportResults,title:'Exporter'},{icon:<Eye className="w-4 h-4"/>,onClick:()=>setShowMagnifier(s=>!s),title:'Loupe',active:showMagnifier},{icon:<Undo2 className="w-4 h-4"/>,onClick:undoLastPoint,title:'Annuler dernier point (Ctrl+Z)',disabled:refPts===0&&patPts===0},{icon:<Trash2 className="w-4 h-4"/>,onClick:clearAllPoints,title:'Effacer tous les points'},{icon:<Keyboard className="w-4 h-4"/>,onClick:()=>setShowShortcuts(s=>!s),title:'Raccourcis (?)',active:showShortcuts}].map(({icon,onClick,title,active,disabled}:any)=>(
              <button key={title} title={title} onClick={onClick} disabled={disabled} className={`p-2 rounded-lg transition-colors ${active?'bg-blue-100 text-blue-700':disabled?'opacity-40 cursor-not-allowed text-slate-300':'hover:bg-slate-200 text-slate-500 hover:text-slate-700'}`}>{icon}</button>
            ))}
            <div className="flex items-center gap-1">
              <button onClick={()=>setRefView(v=>({...v,scale:Math.min(v.scale*1.2,10)}))} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors" title="Zoom +"><ZoomIn className="w-3.5 h-3.5"/></button>
              <button onClick={()=>{setRefView(DEFAULT_VIEW);setPatView(DEFAULT_VIEW);}} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors" title="Reset (R)"><RotateCcw className="w-3.5 h-3.5"/></button>
              <button onClick={()=>setRefView(v=>({...v,scale:Math.max(v.scale*0.8,0.3)}))} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors" title="Zoom -"><ZoomOut className="w-3.5 h-3.5"/></button>
            </div>
          </div>
        </div>
        </div>{/* fin zone scrollable */}
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
        <div className="fixed pointer-events-none z-50 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-slate-100"
          style={{display:showMagnifier?'block':'none',left:magnifierPos.x+24,top:magnifierPos.y+24,width:160,height:160}}>
          <canvas ref={magnifierCanvasRef} width={160} height={160} className="w-full h-full opacity-90"/>
        </div>

        <div className="flex-1 p-4 flex gap-4 overflow-hidden relative">
          {/* Workflow Guide Banner */}
          {(isInitializingRegistration || phase === 1) && (
            <div className="absolute top-4 inset-x-4 z-[60] flex justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-md border-2 border-blue-500/30 px-8 py-3 rounded-[24px] shadow-[0_20px_50px_rgba(37,99,235,0.2)] flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 pointer-events-auto">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  {isInitializingRegistration ? <Loader2 className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                    {isInitializingRegistration ? 'Initialisation...' : 'Étape 1 · Configuration'}
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    {isInitializingRegistration ? (
                      'Préparation de la session de recalage...'
                    ) : (
                      <>
                        Importez le volume <span className="underline decoration-blue-500 decoration-2 underline-offset-4">{activeImage === 'reference' ? 'RÉFÉRENCE (Fixe)' : 'PATIENT MOBILE (À recaler)'}</span>
                        {is2D ? ' — choisissez pour chaque panneau' : ' — importez deux volumes NIfTI patients'}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Editor panels (Phase 2) */}
          {phase !== 3 && (
            <div className="flex-1 min-h-0 flex flex-col">
            <div className={`flex-1 min-h-0 flex gap-4 transition-all duration-700 relative ${showResult?'opacity-0 pointer-events-none absolute inset-4':''}`}>
              {(['reference','patient'] as const).map((type)=>{
                const img=type==='reference'?referenceImage:patientImage;
                const active=activeImage===type;
                const canRef=type==='reference'?refCanvasRef:patCanvasRef;
                const label=type==='reference'?(is3D?'Référence (Fixe)':'Référence'):(is3D?'Patient Mobile':'Patient');
                const color=type==='reference'?'#3b82f6':'#475569';
                const accent=type==='reference'?'border-blue-500/40 shadow-blue-500/10':'border-slate-400/50 shadow-slate-400/10';
                const ringOff=type==='reference'?'border-slate-200 hover:border-blue-300':'border-slate-200 hover:border-slate-400';
                const pts=type==='reference'?refPts:patPts;
                return(
                  <div key={type} className={`flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden relative transition-all duration-300 border ${active?`${accent} shadow-xl ring-1 ring-inset ring-blue-100`:`border-slate-200 shadow-sm ${ringOff}`} bg-white`}>
                    <div className="absolute top-3 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur border border-slate-200 shadow-lg">
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:color,boxShadow:`0 0 10px ${color}`}}/>
                      <span className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">{label}</span>
                      {showManualActions ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          pts >= 4 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          pts > 0  ? 'bg-amber-50 border-amber-300 text-amber-700' :
                                     'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {pts} pts{pts >= 4 ? ' ✓' : pts > 0 ? ` (encore ${4 - pts})` : ''}
                        </span>
                      ) : (
                        pts > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-slate-500" style={{background:color+'15'}}>{pts} pts</span>
                      )}
                    </div>
                    {active&&(
                      <div className="absolute top-3 right-3 z-10">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 shadow-xl">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>ACTIF
                        </span>
                      </div>
                    )}
                    {type === 'reference' && registrationDimension === 'advanced' && img.src && (
                      <div className="absolute top-3 right-3 z-20">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 text-white text-[10px] font-bold shadow-lg backdrop-blur-sm border border-indigo-400/40">
                          Atlas MNI152 — Fixe
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-h-0 relative flex items-center justify-center">
                      {img.src?(
                        <canvas ref={canRef} onClick={e=>handleCanvasClick(e,type)} onContextMenu={e=>handleContextMenu(e,type)} onWheel={e=>handleWheel(e,type)} onMouseDown={e=>handleMouseDown(e,type)} onMouseMove={e=>handleMouseMove(e,type)} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} className={`w-full h-full ${active?'cursor-crosshair':'cursor-grab'}`}/>
                      ):(
                        /* ── Empty state: 2 clear choices ── */
                        <div className="flex flex-col items-center justify-center w-full h-full gap-6 p-8 animate-in fade-in zoom-in-95 duration-500">

                          {/* Panel icon + title */}
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg transition-all duration-500 ${active ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                              {type === 'reference' ? <Box className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8" />}
                            </div>
                            <h4 className="text-base font-black text-slate-900">
                              {type === 'reference'
                                ? (is3D ? 'Patient RÉFÉRENCE' : 'Image RÉFÉRENCE')
                                : (is3D ? 'Patient MOBILE' : 'Image PATIENT')}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                              {type === 'reference'
                                ? (is3D ? 'Volume fixe — ce patient sert de référence' : 'Cette image restera fixe — elle sert de référence')
                                : (is3D ? 'Volume à recaler sur le patient référence' : 'Cette image sera alignée sur la référence')}
                            </p>
                          </div>

                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Comment voulez-vous charger cette image ?
                          </p>

                          {/* Two big choice cards */}
                          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">

                            {/* ── Choice 1: Local disk ── */}
                            <label className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 cursor-pointer hover:border-blue-500 hover:bg-blue-50/80 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-blue-100">
                              <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-400 group-hover:text-blue-600 group-hover:border-blue-400 transition-colors shadow-sm">
                                <Upload className="w-6 h-6" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-black text-slate-800 group-hover:text-blue-800 leading-tight">Depuis mon disque</p>
                                <p className="text-[10px] text-slate-400 mt-1">{is3D ? '.nii / .nii.gz' : 'JPG · PNG · DICOM'}</p>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-500 border border-blue-200 rounded-full px-2 py-0.5 bg-white">
                                Import local
                              </span>
                              <input
                                type="file"
                                accept={is3D ? '.nii,.nii.gz' : 'image/*'}
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  handleLocalFileWithConfirm(f, type);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>

                            {/* ── Choice 2: From patients DB ── */}
                            <button
                              onClick={() => openPanelPicker(type)}
                              className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50/80 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-emerald-100"
                            >
                              <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-400 group-hover:text-emerald-600 group-hover:border-emerald-400 transition-colors shadow-sm">
                                <Users className="w-6 h-6" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-black text-slate-800 group-hover:text-emerald-800 leading-tight">Mes patients</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {allPatientsLoading
                                    ? 'Chargement…'
                                    : `${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length} dossier${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length !== 1 ? 's' : ''} disponible${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length !== 1 ? 's' : ''}`
                                  }
                                </p>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5 bg-white">
                                Base de données
                              </span>
                            </button>

                          </div>
                        </div>
                      )}
                    </div>


                    {is3D && img.src && (jobId || referenceJobId || registrationDimension === 'advanced') && (
                      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 pt-0 pb-3 space-y-2">
                        <div className="rounded-b-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-white uppercase tracking-[0.1em] leading-none mb-0.5">Recalage 3D volumétrique</p>
                            <p className="text-[9px] text-emerald-100 leading-snug font-medium">
                              Le traitement porte sur le <span className="font-black text-white">volume entier</span> — cette vue n'influence pas le résultat.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.14em]">Exploration visuelle</p>
                            <span className="text-[8px] font-semibold text-slate-400 normal-case tracking-normal">(n'affecte pas le recalage)</span>
                          </div>
                          <p className="text-[10px] font-black text-blue-800">{index + 1} / {maxIndex + 1}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {axisOptions.map(({ key, label }) => (
                            <button key={key}
                              onClick={() => { const t = Math.floor(getAxisMax(key) / 2); queuePhase2SliceFetch(key, t); }}
                              className={`flex-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${axis===key ? 'border-sky-400 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-600'}`}
                            >{label}</button>
                          ))}
                        </div>
                        <input type="range" min={0} max={Math.max(0, maxIndex)} value={index}
                          onChange={e => queuePhase2SliceFetch(axis, Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-blue-500"
                        />
                        {type === 'patient' && sliceError && <p className="text-[10px] text-rose-600">{sliceError}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Barre statut points + toolbar grille (mode manuel uniquement) ── */}
            {showManualActions && (
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-white/90 backdrop-blur border-t border-slate-200 rounded-b-xl mx-0">
                {/* Compteur Référence */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold ${refPts>=4?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  <span className="w-2 h-2 rounded-full bg-blue-500"/>
                  Référence : <span className="font-black">{refPts}</span> pts
                  {refPts>=4&&<Check className="w-3 h-3 text-emerald-600"/>}
                  {refPts>0&&refPts<4&&<span className="text-[9px] opacity-60">({4-refPts} manquant{4-refPts>1?'s':''})</span>}
                </div>

                {/* Statut global */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border ${
                  pointsStatus==='ready'      ? 'bg-emerald-100 border-emerald-300 text-emerald-800' :
                  pointsStatus==='unbalanced' ? 'bg-orange-100 border-orange-300 text-orange-700' :
                  pointsStatus==='partial'    ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                'bg-slate-100 border-slate-200 text-slate-500'
                }`}>
                  {pointsStatus==='ready'      && <><Check className="w-3 h-3"/>Prêt à recaler</>}
                  {pointsStatus==='unbalanced' && <>⚠ Déséquilibré ({refPts} / {patPts})</>}
                  {pointsStatus==='partial'    && <>Encore {Math.max(0,4-Math.min(refPts,patPts))} paire{Math.max(0,4-Math.min(refPts,patPts))>1?'s':''}</>}
                  {pointsStatus==='empty'      && <>Cliquez sur les images pour placer des points</>}
                </div>

                {/* Compteur Patient */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold ${patPts>=4?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-slate-100 border-slate-200 text-slate-700'}`}>
                  <span className="w-2 h-2 rounded-full bg-slate-500"/>
                  Patient : <span className="font-black">{patPts}</span> pts
                  {patPts>=4&&<Check className="w-3 h-3 text-emerald-600"/>}
                  {patPts>0&&patPts<4&&<span className="text-[9px] opacity-60">({4-patPts} manquant{4-patPts>1?'s':''})</span>}
                </div>

                {/* Toggle grille */}
                <button
                  onClick={() => setShowGrid(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black transition-colors ${showGrid?'bg-blue-100 border-blue-300 text-blue-700':'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                  title="Afficher/masquer la grille (G)"
                >
                  <span className="text-xs">⊞</span> Grille
                </button>
              </div>
            )}
            </div>
          )}

          {/* Identification View (Phase 3) */}
           {phase === 3 && (
            <div className="flex-1 min-h-0 flex gap-6 animate-in slide-in-from-right-12 duration-700">
              <div className="flex-[2] min-h-0 flex flex-col gap-4">
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
                    <div className="rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white relative shadow-xl group">
                      <div className="absolute top-4 left-5 z-10 px-3 py-1 rounded-full bg-blue-600/80 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur-md">Atlas de référence</div>
                      <canvas ref={refCanvasRef} onClick={e=>handleBrodmannClick(e,'reference')} onWheel={e=>handleWheel(e,'reference')} onMouseDown={e=>handleMouseDown(e,'reference')} onMouseMove={e=>handleMouseMove(e,'reference')} className="w-full h-full cursor-crosshair"/>
                      {brodmannTooltip?.panel === 'reference' && (
                        <div
                          className="pointer-events-none absolute z-20 w-[250px] rounded-xl border border-blue-200 bg-white/95 px-3 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.18)] backdrop-blur-sm"
                          style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}
                        >
                          {brodmannTooltip.insideBrain ? (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">Zone détectée</p>
                              <p className="mt-0.5 text-[11px] font-black leading-snug text-slate-900">
                                BA {brodmannTooltip.zoneId ?? '--'} - {brodmannTooltip.zoneName || 'Zone corticale'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">Hors cerveau</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-600">Aucune aire Brodmann à cet endroit</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white relative shadow-xl group">
                      <div className="absolute top-4 left-5 z-10 px-3 py-1 rounded-full bg-slate-700/90 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur-md">Patient recalé</div>
                      <canvas ref={patCanvasRef} onClick={e=>handleBrodmannClick(e,'patient')} onWheel={e=>handleWheel(e,'patient')} onMouseDown={e=>handleMouseDown(e,'patient')} onMouseMove={e=>handleMouseMove(e,'patient')} className="w-full h-full cursor-crosshair"/>
                      {brodmannTooltip?.panel === 'patient' && (
                        <div
                          className="pointer-events-none absolute z-20 w-[250px] rounded-xl border border-blue-200 bg-white/95 px-3 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.18)] backdrop-blur-sm"
                          style={{ left: brodmannTooltip.x, top: brodmannTooltip.y }}
                        >
                          {brodmannTooltip.insideBrain ? (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">Zone détectée</p>
                              <p className="mt-0.5 text-[11px] font-black leading-snug text-slate-900">
                                BA {brodmannTooltip.zoneId ?? '--'} - {brodmannTooltip.zoneName || 'Zone corticale'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">Hors cerveau</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-600">Aucune aire Brodmann à cet endroit</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Axis Switch + Slider */}
                  <div className="shrink-0 sticky bottom-0 z-20 rounded-[2rem] border border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-xl shadow-lg">
                    <div className="mb-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {axisOptions.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => {
                              const axisMax = getAxisMax(key);
                              const mid = Math.floor(axisMax / 2);
                              setAxis(key);
                              setIndex(mid);
                              void sync3DViews(key, mid);
                            }}
                            className={`w-full rounded-xl border px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${axis===key ? 'border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-200' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
                            aria-label={`Changer vers le plan ${label}`}
                            title={label}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Coupe {axis}</p>
                        <p className="text-sm font-black text-blue-700">Coupe {index + 1} / {maxIndex + 1}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const next = Math.max(0, index - 1);
                          setIndex(next);
                          void sync3DViews(axis, next);
                        }}
                        disabled={index <= 0}
                        className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
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
                          onChange={e => {
                            const next = Number(e.target.value);
                            setIndex(next);
                            void sync3DViews(axis, next);
                          }}
                          className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-blue-500 cursor-pointer"
                        />
                        <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-blue-500/35 via-blue-400/30 to-slate-500/30" style={{ clipPath: `inset(0 ${100 - (maxIndex > 0 ? (index / maxIndex) * 100 : 100)}% 0 0)` }} />
                      </div>

                      <button
                        onClick={() => {
                          const next = Math.min(maxIndex, index + 1);
                          setIndex(next);
                          void sync3DViews(axis, next);
                        }}
                        disabled={index >= maxIndex}
                        className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Coupe suivante"
                        title="Coupe suivante"
                      >
                        {'>'}
                      </button>
                    </div>
                  </div>
               </div>
               <div className="flex-1 min-w-[320px] flex flex-col gap-4 min-h-0 overflow-y-auto">
                  <BrodmannIdentificationView
                    zone={zone}
                    insideBrain={insideBrain}
                    hasAttempt={hasBrodmannAttempt}
                    axis={axis}
                    index={index}
                    maxIndex={maxIndex}
                  />
                  <BrodmannZone3D
                    labelId={zone?.id ?? null}
                    zoneName={zone?.name}
                  />
               </div>
            </div>
          )}

          {/* ══ Result panel — plein écran, style clair ══ */}
          {showResult && (
            <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f1f4f8] animate-in fade-in duration-300">

                {/* ══ HEADER ══ */}
                {/* paddingRight: 115px réserve l'espace du bouton "Sombre" (fixed right:16px) */}
                <div className="shrink-0 flex items-center justify-between bg-white border-b border-gray-200 pl-5 py-3 shadow-sm" style={{ minHeight: 52, paddingRight: 115 }}>
                  {/* Left */}
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      onClick={handleBackToImagesPanel}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Retour
                    </button>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-4 w-1 rounded-full bg-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Analyse comparative · Recalage</span>
                        {/* Infos patient (si disponible) */}
                        {(confirmedPanelPatients.patient || confirmedPanelPatients.reference) && (() => {
                          const pat = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
                          const fullName = [pat.nom, pat.prenom].filter(Boolean).join(' ') || 'Patient';
                          const dossier  = pat.dossier || pat.dossier_id || pat.numero_dossier || null;
                          return (
                            <span className="block text-[10px] font-semibold text-slate-500 truncate">
                              <span className="text-slate-400 font-normal">Patient :</span>{' '}
                              <span className="font-bold text-slate-600">{fullName}</span>
                              {dossier && (
                                <span className="ml-2 font-mono text-[9px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-500">
                                  DOS {dossier}
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  {/* Right — métriques + export (après validation) */}
                  <div className="flex items-center gap-3 pr-2">
                    {mi !== undefined && (
                      <div
                        className="flex items-center gap-3 rounded-xl px-4 py-2 shadow-sm"
                        style={{ background: miColor + '18', border: `1.5px solid ${miColor}55` }}
                      >
                        <div>
                          <p style={{ color: '#475569', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 2 }}>
                            Information Mutuelle
                          </p>
                          <p style={{ color: miColor, fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{mi.toFixed(3)}</p>
                        </div>
                        <span
                          style={{
                            background: miColor,
                            color: '#fff',
                            borderRadius: 8,
                            padding: '3px 10px',
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                          }}
                        >
                          {miQuality}
                        </span>
                      </div>
                    )}
                    {autoAlignMetrics?.processing_time_ms > 0 && (
                      <div
                        className="flex flex-col items-end rounded-xl px-4 py-2"
                        style={{ background: '#f1f5f9', border: '1.5px solid #cbd5e1' }}
                      >
                        <p style={{ color: '#64748b', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 2 }}>Durée</p>
                        <p style={{ color: '#0f172a', fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{(autoAlignMetrics.processing_time_ms / 1000).toFixed(1)} s</p>
                      </div>
                    )}
                    {/* ── Exports NIfTI (visibles après validation 3D) ── */}
                    {saveToPatientResult && registrationDimension !== '2d' && (
                      <>
                        <div className="w-px h-6 bg-gray-200 shrink-0" />
                        {/* Badge statut sauvegarde */}
                        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold shrink-0 ${
                          saveToPatientResult.ok
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border border-amber-200 text-amber-700'
                        }`}>
                          {saveToPatientResult.ok
                            ? <><Check className="h-3.5 w-3.5" /> Enregistré dans le dossier patient</>
                            : <><X className="h-3.5 w-3.5" /> {saveToPatientResult.error || 'Sauvegarde non effectuée'}</>}
                        </div>
                        <div className="w-px h-6 bg-gray-200 shrink-0" />
                        {/* Boutons export NIfTI */}
                        <button
                          onClick={() => handleDownloadVolume('patient')}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition shrink-0"
                          title="Télécharger le volume patient recalé (.nii.gz)"
                        >
                          <Download className="h-3.5 w-3.5" /> Vol. recalé
                        </button>
                        <button
                          onClick={() => handleDownloadVolume('reference')}
                          className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition shrink-0"
                          title="Télécharger le volume de référence / atlas (.nii.gz)"
                        >
                          <Download className="h-3.5 w-3.5" /> Vol. référence
                        </button>
                        <button
                          onClick={() => handleDownloadVolume('all')}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
                          title="Télécharger les deux volumes en ZIP (.zip)"
                        >
                          <Download className="h-3.5 w-3.5" /> Tout exporter
                        </button>
                        {/* Lien vers le dossier patient */}
                        {saveToPatientResult?.ok && (confirmedPanelPatients.patient || confirmedPanelPatients.reference) && (
                          <button
                            onClick={() => {
                              const pat = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
                              navigate(`/dashboard/patients/${pat.id}`);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100 transition shrink-0"
                            title="Ouvrir le dossier patient"
                          >
                            <FileText className="h-3.5 w-3.5" /> Voir dossier
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ══ VIEWER AREA ══ */}
                <div className="min-h-0 flex-1 grid grid-cols-3 gap-3 p-3 overflow-hidden">

                  {/* ── Panel 1 : Patient AVANT ── */}
                  <div className="flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
                    {/* Panel header */}
                    <div className="shrink-0 flex items-center gap-2.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                      <span className="text-[12px] font-black uppercase tracking-[0.2em] text-gray-500">Patient — Avant recalage</span>
                    </div>
                    {/* Viewer */}
                    <div className="flex-1 relative overflow-hidden bg-black min-h-0">
                      {originalImages?.pat ? (
                        <img src={originalImages.pat} alt="avant" className="absolute inset-0 w-full h-full object-contain" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">Non disponible</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Panel 2 : Patient APRÈS ── */}
                  <div className="flex flex-col overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
                    {/* Panel header */}
                    <div className="shrink-0 flex items-center gap-2.5 border-b border-blue-100 bg-blue-50 px-4 py-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-[12px] font-black uppercase tracking-[0.2em] text-blue-700">Patient — Après recalage</span>
                    </div>
                    {/* Viewer */}
                    <div className="flex-1 relative overflow-hidden bg-black min-h-0">
                      {displayResultImages?.pat ? (
                        <img src={displayResultImages.pat} alt="après" className="absolute inset-0 w-full h-full object-contain" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">Non disponible</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Panel 3 : Superposition Référence + Patient ── */}
                  <div className="flex flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
                    {/* Panel header */}
                    <div className="shrink-0 flex items-center gap-2.5 border-b border-violet-100 bg-violet-50 px-4 py-2">
                      <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                      <span className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-700">Superposition — Réf. + Patient recalé</span>
                    </div>
                    {/* Viewer */}
                    <div className="flex-1 relative overflow-hidden bg-black min-h-0">
                      {displayResultImages?.ref || displayResultImages?.pat ? (<>
                        {displayResultImages?.ref && (
                          <img src={displayResultImages.ref} alt="référence" className="absolute inset-0 w-full h-full object-contain" />
                        )}
                        {displayResultImages?.pat && (
                          <img src={displayResultImages.pat} alt="patient recalé"
                            className="absolute inset-0 w-full h-full object-contain transition-opacity"
                            style={{ opacity: overlayOpacity / 100 }} />
                        )}
                        {/* Légende DICOM-style */}
                        <div className="absolute bottom-2 left-2 pointer-events-none flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-mono text-[8px] text-white/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" /> REF
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-[8px] text-white/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" /> PAT {overlayOpacity}%
                          </span>
                        </div>
                      </>) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider text-center px-6">Superposition disponible après recalage</p>
                        </div>
                      )}
                    </div>
                    {/* Transparency control */}
                    <div className="shrink-0 px-3 py-2 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 shrink-0">Réf</span>
                        <button
                          onClick={() => setOverlayOpacity(v => Math.max(0, v - 10))}
                          className="h-6 w-6 shrink-0 rounded border border-gray-300 bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition flex items-center justify-center"
                        >‹</button>
                        <div className="relative flex-1 h-1.5 bg-gray-200 rounded-full">
                          <div className="absolute left-0 top-0 h-full rounded-full bg-violet-500"
                            style={{ width: `${overlayOpacity}%` }} />
                          <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-[1.5px] border-violet-500 shadow-sm pointer-events-none"
                            style={{ left: `calc(${overlayOpacity}% - 7px)` }} />
                          <input type="range" min={0} max={100} value={overlayOpacity}
                            onChange={e => setOverlayOpacity(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                        </div>
                        <button
                          onClick={() => setOverlayOpacity(v => Math.min(100, v + 10))}
                          className="h-6 w-6 shrink-0 rounded border border-gray-300 bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition flex items-center justify-center"
                        >›</button>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 shrink-0">Pat</span>
                        <span className="text-[9px] font-black text-gray-600 shrink-0 tabular-nums w-7 text-right">{overlayOpacity}%</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ══ NAVIGATION 3D ══ */}
                {is3D && (
                  <div className="shrink-0 flex items-center gap-4 px-5 py-2 border-t border-gray-200 bg-white">
                    {/* Label */}
                    <div className="flex items-center gap-2 shrink-0">
                      <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">Navigation coupes</span>
                    </div>
                    <div className="w-px h-5 bg-gray-200 shrink-0" />
                    {/* Prev */}
                    <button
                      onClick={() => { const n = Math.max(0,resultsIdx-1); setResultsIdx(n); void fetchResultsSlices(resultsAxis,n); }}
                      disabled={resultsIdx<=0}
                      className="h-8 w-8 shrink-0 rounded-lg border border-gray-300 bg-white text-gray-500 font-semibold hover:bg-gray-50 disabled:opacity-30 transition flex items-center justify-center text-sm"
                    >‹</button>
                    {/* Segmented axis selector */}
                    <div className="flex shrink-0 rounded-lg border border-gray-300 overflow-hidden divide-x divide-gray-300">
                      {(['axial','coronal','sagittal'] as const).map(ax => (
                        <button key={ax}
                          onClick={() => { const mid=Math.floor(resultsMax/2); setResultsAxis(ax); setResultsIdx(mid); void fetchResultsSlices(ax,mid); }}
                          className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${resultsAxis===ax ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >{ax}</button>
                      ))}
                    </div>
                    {/* Next */}
                    <button
                      onClick={() => { const n=Math.min(resultsMax,resultsIdx+1); setResultsIdx(n); void fetchResultsSlices(resultsAxis,n); }}
                      disabled={resultsIdx>=resultsMax}
                      className="h-8 w-8 shrink-0 rounded-lg border border-gray-300 bg-white text-gray-500 font-semibold hover:bg-gray-50 disabled:opacity-30 transition flex items-center justify-center text-sm"
                    >›</button>
                    {/* Slice slider */}
                    <div className="relative flex-1 h-1.5 bg-gray-200 rounded-full">
                      <div className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-none"
                        style={{ width: resultsMax>0 ? `${(resultsIdx/resultsMax)*100}%` : '0%' }} />
                      <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white border-[1.5px] border-blue-500 shadow-sm pointer-events-none"
                        style={{ left: resultsMax>0 ? `calc(${(resultsIdx/resultsMax)*100}% - 7px)` : '-7px' }} />
                      <input type="range" min={0} max={Math.max(0,resultsMax)} value={resultsIdx}
                        onChange={e => setResultsIdx(Number(e.target.value))}
                        onMouseUp={e => void fetchResultsSlices(resultsAxis, Number((e.target as HTMLInputElement).value))}
                        onTouchEnd={e => void fetchResultsSlices(resultsAxis, Number((e.target as HTMLInputElement).value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    </div>
                    {/* Counter */}
                    <span className="text-[10px] font-black text-gray-500 shrink-0 tabular-nums">
                      {resultsSliceLoading ? '…' : `${resultsIdx+1} / ${resultsMax+1}`}
                    </span>
                  </div>
                )}

                {/* ══ FOOTER ══ */}
                <div className="shrink-0 flex items-center justify-between border-t border-gray-200 bg-white px-5 py-2.5 gap-3">
                  <div>
                    {registrationMode === 'manual' && (
                      <button
                        onClick={handleRecommendedAutoAlign}
                        disabled={autoAlignStatus === 'processing'}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition"
                      >
                        Recalage auto recommandé
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {registrationDimension === '2d' && confirmedPanelPatients.patient && !showValidationModal && (
                      <>
                        <button
                          onClick={() => setConfirmDialog({
                            title: 'Rejeter le recalage ?',
                            message: 'Vous allez annuler le résultat actuel et relancer un nouvel essai de recalage.',
                            detail: 'Le résultat calculé sera supprimé. Vous serez redirigé vers la sélection des coupes pour un nouvel essai.',
                            confirmLabel: 'Oui, rejeter et réessayer',
                            danger: true,
                            onConfirm: handleRejectRegistration,
                          })}
                          disabled={applyingToSeries || autoAlignStatus === 'processing'}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          <X className="h-3.5 w-3.5" /> Rejeter le recalage
                        </button>
                        <button
                          onClick={() => {
                            const dbPatient = confirmedPanelPatients.patient!;
                            setConfirmDialog({
                              title: 'Valider le recalage ?',
                              message: `Appliquer le recalage à toutes les coupes IRM de ${dbPatient.nom} ${dbPatient.prenom} ?`,
                              detail: 'La transformation calculée sera appliquée à chaque image de la série du patient.',
                              confirmLabel: 'Oui, valider',
                              onConfirm: handleApplyToSeries,
                            });
                          }}
                          disabled={applyingToSeries || autoAlignStatus === 'processing'}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {applyingToSeries ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Traitement…</> : <><Check className="h-3.5 w-3.5" /> Valider le recalage</>}
                        </button>
                      </>
                    )}
                    {!(registrationDimension === '2d' && confirmedPanelPatients.patient) && !showValidationModal && !saveToPatientResult && (
                      <>
                        <button
                          onClick={() => setConfirmDialog({
                            title: 'Rejeter le recalage ?',
                            message: 'Vous allez annuler le résultat actuel et relancer un nouvel essai de recalage.',
                            detail: 'Le résultat calculé sera supprimé. Vous serez redirigé vers la sélection des coupes pour un nouvel essai.',
                            confirmLabel: 'Oui, rejeter et réessayer',
                            danger: true,
                            onConfirm: handleRejectRegistration,
                          })}
                          disabled={autoAlignStatus === 'processing'}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          <X className="h-3.5 w-3.5" /> Rejeter le recalage
                        </button>
                        <button
                          onClick={() => setConfirmDialog({
                            title: 'Valider le recalage ?',
                            message: 'Êtes-vous satisfait du résultat du recalage ?',
                            detail: registrationDimension === 'advanced'
                              ? 'Le volume recalé sera sauvegardé automatiquement dans le dossier patient, puis vous accéderez à l\'exploration des zones corticales de Brodmann.'
                              : 'Le volume recalé sera enregistré dans le dossier patient.',
                            confirmLabel: 'Oui, valider',
                            onConfirm: registrationDimension === 'advanced' ? handleValidateAndExplore : handleSaveToPatient,
                          })}
                          disabled={autoAlignStatus === 'processing' || savingToPatient}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {savingToPatient
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…</>
                            : <><Check className="h-3.5 w-3.5" /> Valider le recalage</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Validation modal — available for all modes ── */}
                {showValidationModal && (
                  <div className="absolute inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setShowValidationModal(false); setSaveToPatientResult(null); }} />
                    <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.22)] my-auto">

                      {/* Close */}
                      <button
                        onClick={() => { setShowValidationModal(false); setSaveToPatientResult(null); }}
                        className="absolute right-4 top-4 z-20 rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {/* Header */}
                      <div className="border-b border-slate-100 px-6 pt-6 pb-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Décision médicale requise</p>
                        <h4 className="mt-1 text-[22px] font-black leading-tight tracking-tight text-slate-900">
                          Êtes-vous satisfait du résultat<br />du recalage ?
                        </h4>
                        <p className="mt-2 text-sm text-slate-500">
                          Vérifiez la superposition avant de confirmer. Cette décision est enregistrée dans le dossier patient.
                        </p>
                      </div>

                      {/* MI score summary */}
                      {mi !== undefined && (
                        <div className="border-b border-slate-100 px-6 py-4">
                          <div className="flex items-center gap-4 rounded-2xl border px-4 py-3" style={{ borderColor: miColor + '30', background: miColor + '08' }}>
                            <div className="flex-1">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Indice de qualité — Information Mutuelle</p>
                              <div className="mt-1.5 flex items-end gap-2">
                                <span className="text-3xl font-black" style={{ color: miColor }}>{mi.toFixed(3)}</span>
                                <span className={`mb-0.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${miBadgeBg}`}>{miQuality}</span>
                              </div>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (mi / 0.6) * 100)}%`, background: miColor }} />
                              </div>
                            </div>
                            {autoAlignMetrics?.processing_time_ms > 0 && (
                              <div className="shrink-0 text-center">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Durée</p>
                                <p className="text-lg font-black text-slate-700">{(autoAlignMetrics.processing_time_ms / 1000).toFixed(1)}s</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Options */}
                      <div className="grid gap-0 grid-cols-2 divide-x divide-slate-100">

                        {/* Option 1 — Rejeter */}
                        <div className="flex flex-col gap-3 p-5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                            <X className="h-5 w-5 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-rose-700">Rejeter</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Résultat insatisfaisant — retour au recalage pour correction.</p>
                          </div>
                          <button
                            onClick={handleRejectRegistration}
                            disabled={autoAlignStatus === 'processing'}
                            className="mt-auto w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Rejeter →
                          </button>
                        </div>

                        {/* Option 2 — avancé : Explorer zones / sinon : Exporter */}
                        {registrationDimension === 'advanced' ? (
                          <div className="flex flex-col gap-3 p-5 bg-indigo-50/40">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 border border-indigo-200">
                              <ScanSearch className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-indigo-700">Valider &amp; Explorer</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Résultat accepté — le volume recalé est sauvegardé automatiquement dans le dossier patient, puis vous accédez aux zones corticales de Brodmann.</p>
                            </div>
                            <button
                              onClick={handleValidateAndExplore}
                              disabled={autoAlignStatus === 'processing'}
                              className="mt-auto w-full rounded-xl border border-indigo-400 bg-indigo-600 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Identifier les zones →
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 p-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100">
                              <Download className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-blue-700">Accepter &amp; Exporter</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Résultat validé — télécharger les images et les métriques.</p>
                            </div>
                            <button
                              onClick={() => { setShowValidationModal(false); exportResults(); }}
                              disabled={autoAlignStatus === 'processing'}
                              className="mt-auto w-full rounded-xl border border-blue-300 bg-blue-600 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Exporter →
                            </button>
                          </div>
                        )}

                      </div>

                      {/* En mode avancé : Exporter aussi disponible */}
                      {registrationDimension === 'advanced' && (
                        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
                          <p className="text-[10px] text-slate-400 font-medium">Autres actions</p>
                          <button
                            onClick={() => { setShowValidationModal(false); exportResults(); }}
                            disabled={autoAlignStatus === 'processing'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition disabled:opacity-45"
                          >
                            <Download className="h-3 w-3" /> Exporter les résultats
                          </button>
                        </div>
                      )}

                      {/* ── Option : Sauvegarder dans le dossier patient (DB uniquement) ── */}
                      {(() => {
                        const dbPatient = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
                        if (!dbPatient) return null;
                        return (
                          <div className="border-t border-slate-100 px-5 py-4">
                            {/* En-tête */}
                            <div className="mb-3 flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-50 border border-violet-200">
                                <FileText className="h-3.5 w-3.5 text-violet-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-violet-700">
                                  Sauvegarder dans le dossier patient
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  Dossier&nbsp;
                                  <span className="font-bold text-slate-700">
                                    {dbPatient.nom} {dbPatient.prenom}
                                  </span>
                                  {dbPatient.num_dossier && (
                                    <span className="ml-1 font-mono text-slate-400">· {dbPatient.num_dossier}</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Détails qui seront stockés */}
                            <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Informations enregistrées</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span className="text-[10px] text-slate-600">
                                  <span className="font-bold">Date :</span>{' '}
                                  {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}{' '}
                                  à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                  <span className="font-bold">Mode :</span>{' '}
                                  {registrationDimension === '3d' ? '3D NIfTI' : registrationDimension === 'advanced' ? 'Avancé 3D' : '2D'}
                                </span>
                                {mi !== undefined && (
                                  <span className="text-[10px]" style={{ color: miColor }}>
                                    <span className="font-bold text-slate-600">MI :</span> {mi.toFixed(4)}
                                  </span>
                                )}
                                {autoAlignMetrics?.ncc_after > 0 && (
                                  <span className="text-[10px] text-slate-600">
                                    <span className="font-bold">NCC :</span> {Number(autoAlignMetrics.ncc_after).toFixed(4)}
                                  </span>
                                )}
                                {autoAlignMetrics?.n_iters > 0 && (
                                  <span className="text-[10px] text-slate-600">
                                    <span className="font-bold">Itérations :</span> {autoAlignMetrics.n_iters}
                                  </span>
                                )}
                                {autoAlignMetrics?.processing_time_ms > 0 && (
                                  <span className="text-[10px] text-slate-600">
                                    <span className="font-bold">Durée :</span> {(autoAlignMetrics.processing_time_ms / 1000).toFixed(1)} s
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Résultat de la sauvegarde */}
                            {saveToPatientResult && (
                              <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                                saveToPatientResult.ok
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700'
                              }`}>
                                {saveToPatientResult.ok ? (
                                  <div className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <div>
                                      <p className="font-black">Fichier sauvegardé avec succès</p>
                                      <p className="mt-0.5 font-mono text-[9px] break-all text-emerald-600">{saveToPatientResult.filename}</p>
                                      {saveToPatientResult.uploadedAt && (
                                        <p className="mt-0.5 text-[9px] text-emerald-500">
                                          {new Date(saveToPatientResult.uploadedAt).toLocaleString('fr-FR')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <p>{saveToPatientResult.error}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Bouton */}
                            <button
                              onClick={handleSaveToPatient}
                              disabled={savingToPatient || autoAlignStatus === 'processing' || !!saveToPatientResult?.ok}
                              className="w-full rounded-xl border border-violet-300 bg-violet-600 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {savingToPatient ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Sauvegarde en cours…
                                </span>
                              ) : saveToPatientResult?.ok ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Check className="h-3.5 w-3.5" />
                                  Sauvegardé
                                </span>
                              ) : (
                                'Sauvegarder dans le dossier →'
                              )}
                            </button>
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                )}

                {/* ── Comparaison Série — deux panneaux indépendants ── */}
                {showRegisteredSeries && comparisonData && (() => {
                  // Defensive: ensure counts are valid numbers
                  const safeData = {
                    ...comparisonData,
                    patientCount: Number.isFinite(comparisonData.patientCount) ? comparisonData.patientCount : 0,
                    refCount: Number.isFinite(comparisonData.refCount) ? comparisonData.refCount : 0,
                  };
                  const mkPanel = (
                    key: 'ref' | 'patient',
                    label: string,
                    name: string,
                    count: number,
                    accentCls: string,
                    dotCls: string,
                    filmRef: React.RefObject<HTMLDivElement>
                  ) => {
                    const thumbs = panelThumbs[key];
                    const thumbsLoading = panelThumbsLoading[key];
                    const selIdx = panelIndex[key];
                    const fullImg = panelFullImg[key];
                    const fullLoading = panelFullLoading[key];

                    const setIdx = (i: number) => {
                      const clamped = Math.max(0, Math.min(count - 1, i));
                      setPanelIndex(prev => ({ ...prev, [key]: clamped }));
                      loadPanelFull(key, clamped);
                      // Auto-scroll filmstrip to selected thumb
                      if (filmRef.current) {
                        const child = filmRef.current.children[clamped] as HTMLElement | undefined;
                        child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }
                    };

                    return (
                      <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200 last:border-r-0">

                        {/* Panel header */}
                        <div className={`shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 ${accentCls}`}>
                          <div className={`h-3 w-3 rounded-full shrink-0 ${dotCls}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                            <p className="text-base font-bold text-slate-900 truncate leading-tight">{name || '—'}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-slate-500">{count} coupes</span>
                        </div>

                        {/* Main area : sidebar coupes + grande preview */}
                        <div className="flex-1 flex min-h-0 bg-white">

                          {/* Sidebar coupes — scroll vertical natif */}
                          <div className="w-44 shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 min-h-0">
                            {/* Header fixe de la sidebar */}
                            <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-100">
                              <p className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wider">
                                {count} coupe{count > 1 ? 's' : ''}
                              </p>
                            </div>
                            {/* Zone de scroll */}
                            <div
                              ref={filmRef}
                              className="flex-1 overflow-y-auto min-h-0 py-2 px-2 space-y-2"
                              style={{ overscrollBehavior: 'contain' }}
                            >
                              {thumbsLoading ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                  <span className="text-[10px] text-slate-400">Chargement…</span>
                                </div>
                              ) : (
                                thumbs.map((thumb, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setIdx(i)}
                                    className={`w-full relative rounded-xl overflow-hidden transition-all duration-150 block ${
                                      i === selIdx
                                        ? `ring-2 ring-offset-2 ${key === 'ref' ? 'ring-blue-500' : 'ring-emerald-500'} scale-[1.02]`
                                        : 'opacity-65 hover:opacity-100 hover:scale-[1.01]'
                                    }`}
                                    style={{ height: 130 }}
                                    title={`Coupe ${i + 1}`}
                                  >
                                    {thumb ? (
                                      <img src={thumb} alt={`${i + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-slate-200" />
                                    )}
                                    <span className={`absolute bottom-0 inset-x-0 text-center text-[9px] py-1 font-mono font-black ${
                                      i === selIdx
                                        ? key === 'ref' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                                        : 'bg-black/55 text-slate-200'
                                    }`}>
                                      Coupe {i + 1}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>

                          </div>

                          {/* Grande preview — flex-1 remplit l'espace restant */}
                          <div className="flex-1 flex items-center justify-center bg-black min-h-0 relative overflow-hidden">
                            {count === 0 ? (
                              <p className="text-[10px] text-slate-500">Non disponible</p>
                            ) : fullLoading ? (
                              <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                            ) : fullImg ? (
                              <img
                                src={fullImg}
                                alt={`${label} coupe ${selIdx + 1}`}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : thumbs[selIdx] ? (
                              <img
                                src={thumbs[selIdx]!}
                                alt={`${label} coupe ${selIdx + 1}`}
                                className="max-w-full max-h-full object-contain"
                                style={{ filter: 'blur(1px)' }}
                              />
                            ) : (
                              <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                            )}
                            {count > 0 && (
                              <div className="absolute bottom-2 right-2 bg-black/60 rounded px-2 py-0.5 text-[8px] font-mono"
                                style={{ color: key === 'ref' ? '#60a5fa' : '#34d399' }}>
                                {selIdx + 1} / {count}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="absolute inset-0 z-[80] flex flex-col bg-slate-50 animate-in fade-in duration-300">

                      {/* Top bar — paddingRight réserve l'espace du bouton "Sombre" (fixed right:16px) */}
                      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 gap-3" style={{ paddingRight: 115 }}>
                        {/* Gauche : Retour + Titre */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Bouton Retour — même style que les autres */}
                          <button
                            onClick={() => setShowRegisteredSeries(false)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> Retour
                          </button>
                          <div className="w-px h-5 bg-slate-200 shrink-0" />
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
                              <Columns2 className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-black text-slate-900">Comparaison — Séries recalées</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                Naviguez indépendamment dans chaque série
                                {safeData.patientDossier && (
                                  <span className="ml-1 font-mono font-semibold">· DOS {safeData.patientDossier}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Badge auto-save + accès dossier patient */}
                        {autoSavedToPatient && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold ${
                              autoSavedToPatient.ok
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-600'
                            }`}>
                              {autoSavedToPatient.ok ? (
                                <><Check className="h-3.5 w-3.5" /> Résultat sauvegardé dans le dossier patient</>
                              ) : (
                                <><X className="h-3.5 w-3.5" /> Échec de la sauvegarde auto</>
                              )}
                            </div>
                            {autoSavedToPatient.ok && confirmedPanelPatients.patient && (
                              <button
                                onClick={() => navigate(`/dashboard/patients/${confirmedPanelPatients.patient!.id}`)}
                                className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100 transition shrink-0"
                              >
                                <FileText className="h-3.5 w-3.5" /> Voir le dossier patient →
                              </button>
                            )}
                          </div>
                        )}

                        {/* Boutons export + Retour */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Export série recalée */}
                          <button
                            onClick={() => handleExportSeries('patient')}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                            title="Télécharger toutes les coupes du patient recalé"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Série recalée
                          </button>

                          {/* Export série référence */}
                          {safeData.refCount > 0 && (
                            <button
                              onClick={() => handleExportSeries('reference')}
                              className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition"
                              title="Télécharger toutes les coupes de la référence"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Série référence
                            </button>
                          )}

                          {/* Export tout */}
                          <button
                            onClick={() => handleExportSeries('all')}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition"
                            title="Télécharger les deux séries en ZIP"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Tout exporter
                          </button>

                        </div>
                      </div>

                      {/* Two independent panels */}
                      <div className="flex-1 flex min-h-0 divide-x divide-slate-200 overflow-hidden">
                        {mkPanel('ref', 'Référence (Fixe)', safeData.refName || 'Référence', safeData.refCount, 'bg-blue-50', 'bg-blue-500', filmstripRefRef)}
                        {mkPanel('patient', 'Patient — Recalé', safeData.patientName, safeData.patientCount, 'bg-emerald-50', 'bg-emerald-500', filmstripPatRef)}
                      </div>

                    </div>
                  );
                })()}

                {/* Hidden canvases kept for export functionality */}
                <canvas ref={resultRefCanvasRef} width={600} height={600} style={{ display: 'none' }} />
                <canvas ref={resultPatCanvasRef} width={600} height={600} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      </main>

      <AutoAlignOverlay
        isVisible={autoAlignStatus==='processing' || autoAlignStatus==='error'}
        status={autoAlignStatus as any}
        metrics={autoAlignMetrics}
        progressOverride={autoAlignProgress}
        stageMessage={autoAlignStageMessage}
        errorMessage={autoAlignError}
        algorithm="MINE"
        onClose={()=>setAutoAlignStatus('idle')}
      />

      <AutoAlignOverlay
        isVisible={applyingToSeriesStatus==='processing' || applyingToSeriesStatus==='success' || applyingToSeriesStatus==='error'}
        status={applyingToSeriesStatus as any}
        metrics={undefined}
        progressOverride={applyingToSeriesProgress}
        stageMessage={applyingToSeriesMessage}
        errorMessage={applyingToSeriesError}
        mode="apply_series"
        onClose={()=>{
          setApplyingToSeriesStatus('idle');
          setApplyingToSeriesProgress(undefined);
          setApplyingToSeriesMessage('');
          setApplyingToSeriesError('');
        }}
      />

      <PatientSelectionModal
        isOpen={showPatientSelector}
        onClose={() => setShowPatientSelector(false)}
        onSelectPatient={handlePatientSelect}
        onLocalImport={handleLocalImport}
        mode={selectionPendingMode}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          PATIENT PICKER MODAL — full-screen, per-panel
      ══════════════════════════════════════════════════════════════════════ */}
      {panelPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-6">
          <div className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_40px_80px_-16px_rgba(0,0,0,0.35)] animate-in zoom-in-95 slide-in-from-bottom-6 duration-400">

            {/* Header */}
            <div className={`flex items-center justify-between px-8 py-5 border-b border-slate-100 ${panelPickerOpen === 'reference' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner ${panelPickerOpen === 'reference' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {panelPickerOpen === 'reference' ? <Box className="h-6 w-6" /> : <BrainCircuit className="h-6 w-6" />}
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${panelPickerOpen === 'reference' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    Sélection · Image {panelPickerOpen === 'reference' ? 'RÉFÉRENCE (Fixe)' : 'PATIENT (Moving)'}
                  </p>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5">
                    {panelPickerOpen === 'reference'
                      ? 'Choisissez l\'image de référence'
                      : 'Choisissez l\'image du patient à recaler'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {panelPickerOpen === 'reference'
                      ? 'Cette image restera fixe. Le recalage alignera le patient sur elle.'
                      : 'Cette image sera déplacée et alignée sur la référence.'}
                  </p>
                </div>
              </div>
              <button
                onClick={closePanelPicker}
                className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body: left = patient list, right = file grid */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* ── Left: patient list ── */}
              <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-100 bg-slate-50/50">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un patient…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                    {allPatientsLoading ? 'Chargement…' : `${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length} patient${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length !== 1 ? 's' : ''} compatible${allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                  {allPatientsLoading ? (
                    <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-semibold">Chargement…</span>
                    </div>
                  ) : (
                    allPatients
                      .filter(p => {
                        const compatible = is3D ? p.has_nifti : p.has_2d;
                        const matchSearch = `${p.nom} ${p.prenom} ${p.num_dossier}`.toLowerCase().includes(pickerSearch.toLowerCase());
                        return compatible && matchSearch;
                      })
                      .map(p => {
                        const isSelected = pickerSelectedPatient?.id === p.id;
                        // The "other" panel is the opposite of the one currently open
                        const otherPanel = panelPickerOpen === 'reference' ? 'patient' : 'reference';
                        const isUsedByOtherPanel = confirmedPanelPatients[otherPanel]?.id === p.id;
                        return (
                          <div key={p.id} className="relative group/item">
                            <button
                              disabled={isUsedByOtherPanel}
                              onClick={() => !isUsedByOtherPanel && selectPickerPatient(p)}
                              className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                                isUsedByOtherPanel
                                  ? 'bg-slate-50 border border-slate-100 opacity-50 cursor-not-allowed'
                                  : isSelected
                                    ? (panelPickerOpen === 'reference' ? 'bg-blue-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md')
                                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isUsedByOtherPanel ? 'bg-slate-100' : isSelected ? 'bg-white/20' : 'bg-slate-100'
                              }`}>
                                <Users className={`w-4 h-4 ${
                                  isUsedByOtherPanel ? 'text-slate-300' : isSelected ? 'text-white' : 'text-slate-400'
                                }`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-black truncate ${
                                  isUsedByOtherPanel ? 'text-slate-400' : isSelected ? 'text-white' : 'text-slate-900'
                                }`}>
                                  {p.nom} {p.prenom}
                                </p>
                                <p className={`text-[10px] font-mono mt-0.5 ${
                                  isUsedByOtherPanel ? 'text-slate-300' : isSelected ? 'text-white/70' : 'text-slate-400'
                                }`}>
                                  {p.num_dossier} · {p.age ? `${p.age} ans` : '—'}
                                </p>
                              </div>
                              {isUsedByOtherPanel
                                ? <X className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                : isSelected
                                  ? <Check className="w-4 h-4 text-white flex-shrink-0" />
                                  : <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              }
                            </button>
                            {/* Tooltip on hover for blocked patients */}
                            {isUsedByOtherPanel && (
                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 hidden group-hover/item:flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                                <X className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="text-[10px] font-black text-amber-700">
                                  Déjà utilisé pour l'image {otherPanel === 'reference' ? 'RÉFÉRENCE' : 'PATIENT'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                  {!allPatientsLoading && allPatients.filter(p => is3D ? p.has_nifti : p.has_2d).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                      <Users className="w-8 h-8 text-slate-200" />
                      <p className="text-sm font-semibold text-center">Aucun patient compatible</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: file grid ── */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {!pickerSelectedPatient ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300">
                      <Users className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-700">Sélectionnez un patient</p>
                      <p className="text-sm text-slate-400 mt-1">Choisissez un dossier dans la liste à gauche pour voir ses fichiers</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Patient info bar */}
                    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-white">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${panelPickerOpen === 'reference' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{pickerSelectedPatient.nom} {pickerSelectedPatient.prenom}</p>
                        <p className="text-xs font-mono text-slate-400">{pickerSelectedPatient.num_dossier} · {pickerSelectedPatient.age ? `${pickerSelectedPatient.age} ans` : '—'} · {pickerSelectedPatient.sexe || '—'}</p>
                      </div>
                      {pickerFilesLoading && <Loader2 className="w-5 h-5 animate-spin text-blue-500 ml-auto" />}
                      <p className={`ml-auto text-[11px] font-black uppercase tracking-[0.15em] ${panelPickerOpen === 'reference' ? 'text-blue-600' : 'text-emerald-600'}`}>
                        {pickerFilesLoading ? 'Chargement des fichiers…' : `${pickerPatientFiles.filter(f => { const isNifti = f.original_filename?.toLowerCase().endsWith('.nii') || f.original_filename?.toLowerCase().endsWith('.nii.gz'); return is3D ? isNifti : !isNifti; }).length} fichier${pickerPatientFiles.length !== 1 ? 's' : ''} compatible${pickerPatientFiles.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>

                    {/* File grid — large thumbnails */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {pickerFilesLoading ? (
                        <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-base font-semibold">Chargement des coupes…</span>
                        </div>
                      ) : (() => {
                        const compatFiles = pickerPatientFiles.filter(f => {
                          const isNifti = f.original_filename?.toLowerCase().endsWith('.nii') || f.original_filename?.toLowerCase().endsWith('.nii.gz');
                          return is3D ? isNifti : !isNifti;
                        });
                        return compatFiles.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {compatFiles.map(file => (
                              <button
                                key={file.id}
                                onClick={() => handlePickerFileSelect(file)}
                                title={file.original_filename}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-500 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                              >
                                {/* Thumbnail */}
                                <div className="relative aspect-square overflow-hidden bg-slate-100">
                                  {file.preview_url ? (
                                    <img
                                      src={file.preview_url}
                                      alt=""
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200">
                                      <FileText className="w-10 h-10 text-slate-400" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">NIfTI</span>
                                    </div>
                                  )}
                                  {/* Hover overlay */}
                                  <div className="absolute inset-0 bg-blue-600/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <Check className="w-8 h-8 text-white" />
                                    <span className="text-sm font-black text-white">Sélectionner</span>
                                  </div>
                                </div>
                                {/* File info */}
                                <div className="p-2.5">
                                  <p className="text-[11px] font-black text-slate-800 truncate leading-tight">{file.original_filename}</p>
                                  {file.file_size_mb && (
                                    <p className="text-[9px] text-slate-400 mt-0.5">{file.file_size_mb} Mo</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                            <FileText className="w-12 h-12 text-slate-200" />
                            <div className="text-center">
                              <p className="text-base font-black text-slate-600">Aucun fichier compatible</p>
                              <p className="text-sm mt-1">{is3D ? 'Ce patient n\'a pas de volume NIfTI (.nii/.nii.gz)' : 'Ce patient n\'a pas d\'images 2D disponibles'}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer hint */}
            <div className="border-t border-slate-100 bg-slate-50 px-8 py-3 flex items-center gap-3">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${panelPickerOpen === 'reference' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              <p className="text-[10px] font-semibold text-slate-500">
                {panelPickerOpen === 'reference'
                  ? 'Conseil : Choisissez une image de qualité et bien orientée — elle sert de base fixe pour tout le recalage.'
                  : 'Conseil : Choisissez le volume patient correspondant à l\'examen à analyser.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CONFIRM DIALOG — interactive question at critical steps
      ══════════════════════════════════════════════════════════════════════ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/40 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] animate-in zoom-in-90 slide-in-from-bottom-4 duration-300">

            {/* Top accent bar */}
            <div className={`h-1.5 w-full ${confirmDialog.danger ? 'bg-gradient-to-r from-rose-500 to-red-400' : 'bg-gradient-to-r from-blue-500 to-indigo-400'}`} />

            <div className="p-7">
              {/* Icon */}
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${confirmDialog.danger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmDialog.danger
                  ? <X className="h-7 w-7" />
                  : <Check className="h-7 w-7" />
                }
              </div>

              {/* Question */}
              <h3 className="text-center text-lg font-black text-slate-900">{confirmDialog.title}</h3>
              <p className="mt-2 text-center text-sm font-semibold text-slate-700">{confirmDialog.message}</p>

              {/* Detail */}
              {confirmDialog.detail && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs leading-relaxed text-blue-800">{confirmDialog.detail}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:bg-slate-100 active:scale-95"
                >
                  Annuler
                </button>
                <button
                  onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition-all hover:brightness-110 active:scale-95 ${
                    confirmDialog.danger
                      ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-rose-200'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-500 shadow-blue-200'
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assistant de choix de mode ── */}
      {showModeAssistant && (() => {
        const objectives = [
          {
            id: 'fast' as const,
            icon: <Zap className="w-5 h-5" />,
            label: 'Analyse rapide',
            desc: 'Je veux un premier alignement en quelques secondes',
            color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', borderHover: 'hover:border-blue-400',
            disabled: false,
          },
          {
            id: 'precise' as const,
            icon: <Microscope className="w-5 h-5" />,
            label: 'Analyse anatomique précise',
            desc: 'Je veux le meilleur alignement possible pour une analyse clinique',
            color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', borderHover: 'hover:border-violet-400',
            disabled: false,
          },
          {
            id: 'cortical' as const,
            icon: <Map className="w-5 h-5" />,
            label: 'Projection atlas cérébral',
            desc: 'Je veux identifier les zones de Brodmann sur le volume recalé',
            color: is3D ? 'text-emerald-600' : 'text-slate-400', bg: is3D ? 'bg-emerald-50' : 'bg-slate-50', border: is3D ? 'border-emerald-200' : 'border-slate-200', borderHover: is3D ? 'hover:border-emerald-400' : '',
            disabled: !is3D,
          },
          {
            id: 'manual' as const,
            icon: <Target className="w-5 h-5" />,
            label: 'Recalage manuel',
            desc: 'Je veux placer moi-même les points de correspondance',
            color: is3D ? 'text-slate-400' : 'text-emerald-600', bg: is3D ? 'bg-slate-50' : 'bg-emerald-50', border: is3D ? 'border-slate-200' : 'border-emerald-200', borderHover: is3D ? '' : 'hover:border-emerald-400',
            disabled: is3D,
          },
        ];

        const recommendations: Record<string, { label: string; justification: string; precision: number; speed: number; action: () => void }> = {
          fast: {
            label: 'Recalage affine',
            justification: is3D
              ? 'Repositionne le volume entier par transformation affine (rotation, translation, échelle). Idéal pour un premier alignement en quelques secondes.'
              : 'L\'algorithme MINE aligne les deux images par transformation affine globale. Rapide et efficace pour la plupart des cas 2D.',
            precision: 3, speed: 5,
            action: () => { is3D ? handleAutoAlign() : setRegistrationMode('mine'); setShowModeAssistant(false); setAssistantObjective(null); },
          },
          precise: {
            label: is3D ? 'Recalage déformable' : 'Recalage affine',
            justification: is3D
              ? 'Combine alignement affine global et corrections déformables locales (VoxelMorph). Chaque structure anatomique s\'ajuste individuellement. Recommandé pour les analyses cliniques.'
              : 'Pour les images 2D, l\'alignement global IA offre la meilleure précision disponible.',
            precision: is3D ? 4 : 3, speed: is3D ? 3 : 5,
            action: () => { is3D ? handleHybridAlign() : setRegistrationMode('mine'); setShowModeAssistant(false); setAssistantObjective(null); },
          },
          cortical: {
            label: 'Recalage déformable',
            justification: 'Les corrections locales sont essentielles pour projeter précisément les 47 zones corticales de Brodmann sur l\'atlas MNI152.',
            precision: 4, speed: 3,
            action: () => { handleHybridAlign(); setShowModeAssistant(false); setAssistantObjective(null); },
          },
          manual: {
            label: 'Recalage manuel',
            justification: 'Vous placez des points de correspondance anatomique sur les deux images. Idéal si vous maîtrisez précisément les structures à aligner.',
            precision: 5, speed: 1,
            action: () => { setRegistrationMode('manual'); setShowModeAssistant(false); setAssistantObjective(null); },
          },
        };

        const rec = assistantObjective ? recommendations[assistantObjective] : null;

        const Dots = ({ filled, color }: { filled: number; color: string }) => (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < filled ? color : 'bg-slate-200'}`} />
            ))}
          </div>
        );

        return (
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowModeAssistant(false); setAssistantObjective(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ animation: 'fadeInScale 0.2s ease-out' }}>

              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-100">Assistant</p>
                    <h3 className="text-sm font-black text-white">Quel est votre objectif ?</h3>
                  </div>
                </div>
                <button onClick={() => { setShowModeAssistant(false); setAssistantObjective(null); }} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {/* Options */}
                {objectives.map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => !obj.disabled && setAssistantObjective(obj.id)}
                    disabled={obj.disabled}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                      obj.disabled
                        ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
                        : assistantObjective === obj.id
                          ? `${obj.border} ${obj.bg} shadow-sm`
                          : `border-slate-200 bg-white ${obj.borderHover} hover:bg-slate-50`
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${obj.disabled ? 'bg-slate-100 text-slate-400' : `${obj.bg} ${obj.color}`}`}>
                      {obj.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black ${obj.disabled ? 'text-slate-400' : 'text-slate-900'}`}>{obj.label}</p>
                      <p className={`text-[10px] ${obj.disabled ? 'text-slate-300' : 'text-slate-500'}`}>{obj.disabled ? (is3D ? 'Mode 2D uniquement' : 'Mode 3D uniquement') : obj.desc}</p>
                    </div>
                    {assistantObjective === obj.id && <Check className={`w-4 h-4 shrink-0 ${obj.color}`} />}
                  </button>
                ))}

                {/* Recommandation */}
                {rec && (
                  <div className="mt-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3" style={{ animation: 'fadeInScale 0.15s ease-out' }}>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Mode recommandé</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">{rec.label}</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{rec.justification}</p>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Précision</p>
                        <Dots filled={rec.precision} color="bg-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Vitesse</p>
                        <Dots filled={rec.speed} color="bg-blue-500" />
                      </div>
                    </div>
                    <button
                      onClick={rec.action}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black py-2.5 transition flex items-center justify-center gap-2"
                    >
                      <Check className="w-3.5 h-3.5" /> Utiliser ce mode
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Overlay Exploration Corticale (advanced mode, sans navigation) ── */}
      {showExploration && (
        <div className="fixed inset-0 z-[250] flex flex-col">
          {/* Bandeau sauvegarde automatique */}
          {saveToPatientResult && (
            <div className={`shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 text-[11px] font-bold z-10 ${
              saveToPatientResult.ok
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white'
            }`} style={{ paddingRight: 130 }}>
              <div className="flex items-center gap-2">
                {saveToPatientResult.ok ? (
                  <>
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      Résultat sauvegardé automatiquement dans le dossier patient
                      {saveToPatientResult.filename && (
                        <span className="ml-2 font-mono text-[10px] opacity-80">— {saveToPatientResult.filename}</span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 shrink-0" />
                    <span>Sauvegarde échouée : {saveToPatientResult.error}</span>
                  </>
                )}
              </div>
              {saveToPatientResult.ok && (confirmedPanelPatients.patient || confirmedPanelPatients.reference) && (
                <button
                  onClick={() => {
                    const pat = confirmedPanelPatients.patient ?? confirmedPanelPatients.reference;
                    navigate(`/dashboard/patients/${pat.id}`);
                  }}
                  className="shrink-0 rounded-lg border border-white/30 bg-white/15 hover:bg-white/25 px-3 py-1 text-[10px] font-black tracking-wide transition"
                >
                  Voir le dossier patient →
                </button>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <ExplorationPage onBack={() => setShowExploration(false)} />
          </div>
        </div>
      )}
    </div>
  );
}