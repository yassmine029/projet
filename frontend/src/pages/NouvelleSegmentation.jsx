import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CloudUpload,
  FileImage,
  FolderOpen,
  Hash,
  Info,
  Loader2,
  Move,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import api, { createPatient, stageEmergencyPatient } from '../api';

const CHECKLIST_STEPS = [
  'Préparation des données',
  'Chargement du modèle',
  'Inférence Deep Learning',
];

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706'];

const LIST_PAGE_SIZE = 10;

/** Seuil envoyé à l’API au lancement (affiché aussi dans la modale de confirmation). */
const DEFAULT_SEGMENTATION_THRESHOLD = 0.75;

function GmailStylePagination({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
  showPageJump = false,
  onJumpToPage,
}) {
  const lastPage = total === 0 ? 0 : Math.max(0, Math.ceil(total / pageSize) - 1);
  const safePage = Math.min(Math.max(0, page), lastPage);
  const start = total === 0 ? 0 : safePage * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, (safePage + 1) * pageSize);
  const pageCount = lastPage + 1;
  const jumpEnabled = Boolean(showPageJump && onJumpToPage && total > 0 && lastPage > 0);

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[13px] text-slate-600">
      {jumpEnabled ? (
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap text-slate-500">Aller à la page</span>
          <select
            value={safePage}
            onChange={(e) => onJumpToPage(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-800 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label="Choisir une page du catalogue"
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <option key={i} value={i}>
                {i + 1} / {pageCount}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <span className="tabular-nums select-none">
        {start}–{end} sur {total.toLocaleString('fr-FR')}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={safePage <= 0}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={safePage >= lastPage}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/** Infobulle au survol / focus clavier du bouton (sélection par plage). */
function ButtonWithHelpTooltip({ helpText, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 w-[min(17.5rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] leading-relaxed text-slate-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {helpText}
      </span>
    </span>
  );
}

function sliceRangeTooltipText(totalSlices) {
  const n = Number(totalSlices) || 0;
  if (n < 1) return '';
  return `Les numéros correspondent aux vignettes « Coupe x/${n} » dans l’ordre du dossier. Vous pouvez sélectionner une plage sans cliquer sur chaque image.`;
}

const LAUNCH_SUMMARY_HELP_TEXT =
  "Structure cible : hippocampe · superposition : masque coloré sur la coupe IRM (même géométrie que l’originale). Volume 3D / PDF : coupes non rejetées (masque courant) ; les coupes rejetées sont exclues.";

/** Icône info + infobulle (texte long hors écran pour gagner de la place). */
function IconHelpTooltip({ helpText, ariaLabel = 'Aide' }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="rounded p-0.5 text-slate-400 outline-none hover:bg-slate-200/80 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={ariaLabel}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] leading-relaxed text-slate-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {helpText}
      </span>
    </span>
  );
}

function getDoctorName() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'Medecin';
    const user = JSON.parse(raw);
    const fromFullName = String(user?.fullName || user?.full_name || '').trim();
    if (fromFullName && !fromFullName.includes('@')) return fromFullName;

    const firstName = String(user?.first_name || user?.prenom || '').trim();
    const lastName = String(user?.last_name || user?.nom || '').trim();
    const merged = `${firstName} ${lastName}`.trim();
    if (merged) return merged;

    const username = String(user?.username || '').trim();
    if (!username || username.includes('@')) return 'Medecin';
    return username;
  } catch {
    return 'Medecin';
  }
}

function getPatientName(patient) {
  const firstName = String(patient?.first_name || patient?.prenom || '').trim();
  const lastName = String(patient?.last_name || patient?.nom || '').trim();
  const full = `${firstName} ${lastName}`.trim();
  const fallback = String(patient?.full_name || patient?.name || '').trim();
  return full || fallback || `Patient #${patient?.id ?? '—'}`;
}

function getPatientKey(patient, index) {
  return patient?.id || patient?.dossier_number || patient?.num_dossier || patient?.patient_id || `patient-${index}`;
}

function getInitials(patient) {
  const first = String(patient?.first_name || patient?.prenom || '').trim();
  const last = String(patient?.last_name || patient?.nom || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase().trim();
  return initials || '?';
}

function getDateOfBirth(patient) {
  return patient?.date_of_birth || patient?.birth_date || patient?.dob || patient?.date_naissance || null;
}

function formatDate(value, withYear = true) {
  if (!value) return withYear ? 'Date inconnue' : '--/--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return withYear ? 'Date inconnue' : '--/--';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (!withYear) return `${day}/${month}`;

  return `${day}/${month}/${date.getFullYear()}`;
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const age = Math.floor((new Date() - dob) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function getBirthPrefix(patient) {
  const sex = String(patient?.sexe || patient?.gender || patient?.sex || '').toLowerCase();
  if (sex === 'f' || sex === 'female' || sex === 'femme') return 'Née';
  return 'Né';
}

function formatIpp(patient) {
  const raw = String(
    patient?.ipp || patient?.patient_id || patient?.dossier_id || patient?.dossier_number || patient?.num_dossier || patient?.id || ''
  ).trim();

  if (!raw) return 'IPP-—';

  const noPrefix = raw.replace(/^IPP-/i, '');
  const compact = noPrefix.length > 12 ? noPrefix.slice(-8) : noPrefix;
  return `IPP-${compact}`;
}

function getPathologyBadge(patient) {
  const source = String(patient?.pathology || patient?.pathologie || patient?.diagnosis || patient?.motif || '').toLowerCase();
  if (source.includes('alz')) return { label: 'Alzheimer', classes: 'bg-red-50 text-red-700' };
  if (source.includes('épil') || source.includes('epil')) return { label: 'Épilepsie', classes: 'bg-violet-50 text-violet-700' };
  return { label: 'Suivi', classes: 'bg-emerald-50 text-emerald-700' };
}

function getSlicesCount(patient) {
  if (Array.isArray(patient?.mri_files)) return patient.mri_files.length;
  if (typeof patient?.slices_count === 'number') return patient.slices_count;
  if (typeof patient?.analyses_count === 'number') return patient.analyses_count;
  if (Array.isArray(patient?.folder)) return patient.folder.length;
  return null;
}

function getLastExam(patient) {
  return patient?.last_exam || patient?.updated_at || patient?.created_at || null;
}

function formatDateTimeShort(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateTimeDetail(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getFileExtension(name) {
  const s = String(name || '');
  const i = s.lastIndexOf('.');
  return i >= 0 ? s.slice(i + 1).toUpperCase() : '—';
}

function truncateMiddle(str, max = 52) {
  const s = String(str || '');
  if (s.length <= max) return s;
  const keep = max - 3;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${s.slice(0, head)}…${s.slice(s.length - tail)}`;
}

function formatFileSizeBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

/** Libellé « Coupe x/y » avec y = nombre total de coupes de la série (ou du run). */
function formatCoupeXY(rank1Based, totalSlices) {
  const y = totalSlices > 0 ? totalSlices : 1;
  const x = Math.min(Math.max(1, rank1Based), y);
  return `Coupe ${x}/${y}`;
}

/** Rang « Coupe x/n » pour une ligne de résultat (aligné sur l’ordre du dossier si `slices` est chargé). */
function resultRowCoupeRank(row, indexInPersisted, slices) {
  const fileId = row?.mri_file ?? row?.file_id;
  if (Array.isArray(slices) && slices.length > 0 && fileId != null) {
    const idx = slices.findIndex((s) => s?.id === fileId);
    if (idx >= 0) return idx + 1;
  }
  const si = Number(row?.slice_index ?? row?.index);
  if (Number.isFinite(si) && si >= 1) return si;
  return indexInPersisted + 1;
}

function getSliceDimensionsLabel(slice) {
  const w = slice?.image_width;
  const h = slice?.image_height;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return `${w} × ${h} px`;
  }
  return '—';
}

function reviewStatusBadge(reviewStatus) {
  const s = String(reviewStatus || 'pending').toLowerCase();
  if (s === 'validated') return { label: 'Validée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (s === 'rejected') return { label: 'Rejetée', className: 'bg-red-100 text-red-800 border-red-200' };
  return { label: 'En attente', className: 'bg-amber-50 text-amber-900 border-amber-200' };
}

/** Libellés affichés : clés API inchangées (unetpp, nnunet, swinunetr). */
function modelKeyToDisplayName(key) {
  const k = String(key || '').trim().toLowerCase();
  if (k === 'unetpp') return 'Modèle 1';
  if (k === 'nnunet') return 'Modèle 2';
  if (k === 'swinunetr') return 'Modèle 3';
  return k ? String(key) : '—';
}

function effectiveMaskModelLabel(row, runModelVersion) {
  if (row?.mask_model_version) return row.mask_model_version;
  const mk = String(row?.mask_model_key || '').trim();
  if (!mk) return runModelVersion || 'Modèle 1';
  return modelKeyToDisplayName(mk);
}

function priorMaskTraceLabel(row) {
  if (row?.prior_mask_model_version) return row.prior_mask_model_version;
  return modelKeyToDisplayName(row?.prior_mask_model_key);
}

/** Indique si ce masque est disponible pour adoption (aligné sur l’API adopt-reference). */
function canAdoptAlternativeModel(row, modelKey) {
  const mk = String(modelKey || '').toLowerCase();
  const cur = String(row?.mask_model_key || '').toLowerCase();
  const priorK = String(row?.prior_mask_model_key || '').toLowerCase();
  if (mk === 'unetpp') {
    if (cur === 'unetpp' && row?.mask_file) return true;
    if (cur === 'swinunetr' && priorK === 'unetpp' && row?.prior_mask_file) return true;
    return false;
  }
  if (mk === 'nnunet') {
    if (cur === 'swinunetr' && priorK === 'nnunet' && row?.prior_mask_file) return true;
    if (cur === 'nnunet' && row?.mask_file) return true;
    return false;
  }
  if (mk === 'swinunetr') return cur === 'swinunetr' && Boolean(row?.mask_file);
  return false;
}

/** N’affiche pas « Adopter Mx » si Mx est déjà le modèle de référence (bandeau du haut). */
function canShowAdoptReferenceButton(row, modelKey) {
  const ref = String(row?.initial_mask_model_key || 'unetpp').toLowerCase() || 'unetpp';
  const mk = String(modelKey || '').toLowerCase();
  if (ref === mk) return false;
  return canAdoptAlternativeModel(row, modelKey);
}

function referenceMaskLabel(row) {
  return (
    row?.initial_mask_model_version ||
    modelKeyToDisplayName(row?.initial_mask_model_key) ||
    'Modèle 1'
  );
}

/** Masque de référence Modèle 1 pour affichage / fusions (initial, ou prior si c’était encore M1). */
function m1ReferenceMaskSrc(row, initialMaskSrc, priorMaskSrc, maskSrc) {
  if (initialMaskSrc) return initialMaskSrc;
  const pk = String(row?.prior_mask_model_key || '').toLowerCase();
  if (pk === 'unetpp' && priorMaskSrc) return priorMaskSrc;
  return maskSrc;
}

function normalizeSegModelKey(row, runFallback) {
  const mk = String(row?.mask_model_key || runFallback || 'unetpp').trim().toLowerCase();
  return mk || 'unetpp';
}

/** Hauteur commune des panneaux résultats (moins de marge vide, pas de barres bleutées). */
const RESULT_VIEW_IMG =
  'mx-auto w-full min-h-[13rem] max-h-[min(52vh,34rem)] object-contain';

/** Vues comparaison M2/M3 : plus lisibles tout en tenant sur une ligne à 4 colonnes (xl). */
const RESULT_VIEW_COMPACT_IMG =
  'mx-auto h-auto w-full max-h-[min(58vh,22rem)] min-h-[14rem] object-contain';

const maxSlicePanelHeightPx = () => Math.min(window.innerHeight * 0.52, 34 * 16);

/** Teinte uniquement sur les pixels du masque (l’IRM reste en niveaux de gris). */
const HIPPO_OVERLAY_RGB = [6, 182, 212];
const HIPPO_OVERLAY_ALPHA = 0.55;
const OVERLAY_RGB_M2 = [251, 146, 60];
const OVERLAY_RGB_M3 = [168, 85, 247];

function overlayRgbForCompareModelKey(modelKey) {
  const k = String(modelKey || '').toLowerCase();
  if (k === 'nnunet') return OVERLAY_RGB_M2;
  if (k === 'swinunetr') return OVERLAY_RGB_M3;
  return HIPPO_OVERLAY_RGB;
}

function dedupeCompareRowsByMaskSrc(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r?.maskSrc) continue;
    if (seen.has(r.maskSrc)) continue;
    seen.add(r.maskSrc);
    out.push(r);
  }
  return out;
}

/**
 * Lignes masque + overlay pour la vue « originale à gauche » (après relance M2/M3).
 */
function buildSegmentationCompareRows({
  row,
  m1RefSrc,
  maskSrc,
  priorMaskSrc,
  curSegKey,
  modelLabel,
  showM2ThenM3Stack,
  isArchiveAfterRestore,
  hasRelaunchComparison,
  refModelKey,
}) {
  if (!hasRelaunchComparison && !showM2ThenM3Stack) {
    return { extended: false, rows: [] };
  }
  const base = {
    modelKey: refModelKey,
    label: referenceMaskLabel(row),
    subtitle: 'Référence (bandeau du haut)',
    maskSrc: m1RefSrc,
  };
  let rest = [];
  if (showM2ThenM3Stack) {
    rest = [
      { modelKey: 'nnunet', label: 'Modèle 2', subtitle: 'Masque conservé (avant M3)', maskSrc: priorMaskSrc },
      { modelKey: 'swinunetr', label: 'Modèle 3', subtitle: 'Dernier calcul', maskSrc: maskSrc },
    ];
  } else if (isArchiveAfterRestore) {
    rest = [
      { modelKey: 'unetpp', label: 'Modèle 1', subtitle: 'Masque courant', maskSrc: maskSrc },
      {
        modelKey: String(row?.prior_mask_model_key || 'nnunet').toLowerCase(),
        label: priorMaskTraceLabel(row),
        subtitle: 'Archivé',
        maskSrc: priorMaskSrc,
      },
    ];
  } else {
    rest = [{ modelKey: curSegKey, label: modelLabel, subtitle: 'Dernier calcul', maskSrc: maskSrc }];
  }
  const rows = dedupeCompareRowsByMaskSrc([base, ...rest]);
  return { extended: true, rows };
}

/** Image masque dans les rangées comparaison (hauteur modérée, plusieurs lignes). */
const RESULT_VIEW_COMPARE_ROW_IMG =
  'mx-auto w-full max-h-[min(38vh,18rem)] min-h-[10rem] object-contain';
/** Masque blanc sur noir : luminance au-dessus → pixel colorié. */
const HIPPO_MASK_LUM_THRESHOLD = 96;

/** Jet (bleu froid → rouge chaud), pour cartes comparatives type heatmap. */
function jetColormapRgb(t) {
  const x = Math.max(0, Math.min(1, t));
  let r;
  let g;
  let b;
  if (x < 0.25) {
    const u = x / 0.25;
    r = 0;
    g = 0;
    b = 0.35 + 0.65 * u;
  } else if (x < 0.5) {
    const u = (x - 0.25) / 0.25;
    r = 0;
    g = u;
    b = 1;
  } else if (x < 0.75) {
    const u = (x - 0.5) / 0.25;
    r = u;
    g = 1;
    b = 1 - u;
  } else {
    const u = (x - 0.75) / 0.25;
    r = 1;
    g = 1 - u * 0.85;
    b = 0;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Modes d’affichage pour l’analyse M1 vs second masque (cadre heatmap uniquement). */
const HEATMAP_ANALYSIS_MODES = [
  { id: 'heatmap', label: 'Jet' },
  { id: 'm1only', label: 'M1 seul' },
  { id: 'm2only', label: 'M2 seul' },
  { id: 'union', label: 'Union' },
];

function classifyHippoPairToT(m1on, m2on, k) {
  if (!m1on && !m2on) return null;
  if (m1on && m2on) return 0.52;
  if (m1on) return 0.14;
  return k === 'swinunetr' ? 0.88 : 0.86;
}

function pixelRgbHeatmapAnalysis(m1on, m2on, mode, k, bgRgb) {
  const secondHot = k === 'swinunetr' ? 0.88 : 0.86;
  if (mode === 'heatmap') {
    const t = classifyHippoPairToT(m1on, m2on, k);
    if (t == null) return null;
    return jetColormapRgb(t);
  }
  if (mode === 'm1only') {
    if (m1on) return jetColormapRgb(0.16);
    return null;
  }
  if (mode === 'm2only') {
    if (m2on) return jetColormapRgb(secondHot);
    return null;
  }
  if (mode === 'union') {
    if (!m1on && !m2on) return null;
    if (m1on && m2on) return jetColormapRgb(0.52);
    if (m1on) return jetColormapRgb(0.16);
    return jetColormapRgb(secondHot);
  }
  return null;
}

/**
 * Comparaison deux masques en taille native (même emprise que les images masque), heatmap + zoom + stats.
 */
function DualHippocampusHeatmapCrop({
  maskM1Src,
  maskM2Src,
  secondModelKey = 'nnunet',
  alt,
  compact = false,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [viewMode, setViewMode] = useState('heatmap');
  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  }, [maskM1Src, maskM2Src, viewMode]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!maskM1Src || !maskM2Src || !wrap || !canvas) return undefined;

    let cancelled = false;
    const m1 = new Image();
    const m2 = new Image();
    m1.crossOrigin = 'anonymous';
    m2.crossOrigin = 'anonymous';

    const th = HIPPO_MASK_LUM_THRESHOLD;
    const mode = viewMode;
    const k = String(secondModelKey || 'nnunet').toLowerCase();
    const bgRgb = [15, 23, 42];

    const paint = () => {
      if (cancelled || !wrap || !m1.complete || !m2.complete || m1.naturalWidth < 1 || m2.naturalWidth < 1)
        return;
      const w = m1.naturalWidth;
      const h = m1.naturalHeight;
      if (m2.naturalWidth !== w || m2.naturalHeight !== h) {
        console.warn('DualHippocampusHeatmapCrop: tailles de masques différentes');
      }

      const c1 = document.createElement('canvas');
      const c2 = document.createElement('canvas');
      c1.width = c2.width = w;
      c1.height = c2.height = h;
      const t1 = c1.getContext('2d', { willReadFrequently: true });
      const t2 = c2.getContext('2d', { willReadFrequently: true });
      if (!t1 || !t2) return;
      t1.drawImage(m1, 0, 0, w, h);
      t2.drawImage(m2, 0, 0, w, h);
      const d1 = t1.getImageData(0, 0, w, h).data;
      const d2 = t2.getImageData(0, 0, w, h).data;

      let any = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum1 =
            (0.299 * d1[i] + 0.587 * d1[i + 1] + 0.114 * d1[i + 2]) * (d1[i + 3] / 255);
          const lum2 =
            (0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2]) * (d2[i + 3] / 255);
          if (lum1 > th || lum2 > th) any = true;
        }
      }

      if (!any) {
        setStats(null);
        const rawW = Math.max(1, wrap.clientWidth);
        const dw = Math.max(1, Math.round(rawW));
        const dh = compact ? 168 : 208;
        canvas.width = dw;
        canvas.height = dh;
        canvas.style.width = `${dw}px`;
        canvas.style.height = `${dh}px`;
        const ctx0 = canvas.getContext('2d');
        if (ctx0) {
          ctx0.fillStyle = `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
          ctx0.fillRect(0, 0, dw, dh);
          ctx0.fillStyle = '#94a3b8';
          ctx0.font = '13px sans-serif';
          ctx0.fillText('Aucune région masquée détectée', 16, Math.round(dh / 2));
        }
        return;
      }

      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      if (!tctx) return;
      const td = tctx.createImageData(w, h);
      const out = td.data;

      let cntM1 = 0;
      let cntM2 = 0;
      let cntBoth = 0;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const q = (y * w + x) * 4;
          const p = q;
          const lum1 =
            (0.299 * d1[q] + 0.587 * d1[q + 1] + 0.114 * d1[q + 2]) * (d1[q + 3] / 255);
          const lum2 =
            (0.299 * d2[q] + 0.587 * d2[q + 1] + 0.114 * d2[q + 2]) * (d2[q + 3] / 255);
          const m1on = lum1 > th;
          const m2on = lum2 > th;
          if (m1on && m2on) cntBoth += 1;
          else if (m1on) cntM1 += 1;
          else if (m2on) cntM2 += 1;

          const rgb = pixelRgbHeatmapAnalysis(m1on, m2on, mode, k, bgRgb);
          if (rgb == null) {
            out[p] = bgRgb[0];
            out[p + 1] = bgRgb[1];
            out[p + 2] = bgRgb[2];
            out[p + 3] = 255;
          } else {
            out[p] = rgb[0];
            out[p + 1] = rgb[1];
            out[p + 2] = rgb[2];
            out[p + 3] = 255;
          }
        }
      }

      const dice =
        2 * cntBoth + cntM1 + cntM2 > 0
          ? (2 * cntBoth) / (2 * cntBoth + cntM1 + cntM2)
          : null;

      setStats({
        m1Only: cntM1,
        m2Only: cntM2,
        overlap: cntBoth,
        dice,
        roiW: w,
        roiH: h,
      });

      tctx.putImageData(td, 0, 0);

      const rawW = Math.max(1, wrap.clientWidth);
      let dispW;
      let dispH;
      const maxCompactH = Math.min(window.innerHeight * 0.42, 22 * 16);
      if (compact) {
        let scale = rawW / Math.max(1, w);
        dispW = Math.max(1, Math.round(rawW));
        dispH = Math.max(1, Math.round(h * scale));
        if (dispH > maxCompactH) {
          scale = maxCompactH / Math.max(1, h);
          dispH = Math.max(1, Math.round(h * scale));
          dispW = Math.max(1, Math.round(w * scale));
        }
      } else {
        const wrapW = rawW;
        const scale = wrapW / Math.max(1, w);
        dispW = Math.max(1, Math.round(wrapW));
        dispH = Math.max(1, Math.round(h * scale));
      }
      canvas.width = dispW;
      canvas.height = dispH;
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
      ctx.fillRect(0, 0, dispW, dispH);
      ctx.drawImage(tmp, 0, 0, w, h, 0, 0, dispW, dispH);
    };

    const schedulePaint = () => {
      if (cancelled) return;
      if (m1.complete && m2.complete && m1.naturalWidth >= 1 && m2.naturalWidth >= 1) paint();
    };

    m1.onload = schedulePaint;
    m2.onload = schedulePaint;
    m1.onerror = schedulePaint;
    m2.onerror = schedulePaint;
    m1.src = maskM1Src;
    m2.src = maskM2Src;

    const ro = new ResizeObserver(() => schedulePaint());
    ro.observe(wrap);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [maskM1Src, maskM2Src, secondModelKey, viewMode, compact]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.12 : 0.12;
      setUserZoom((z) => {
        const nz = Math.round(Math.min(5, Math.max(1, z + step)) * 100) / 100;
        if (nz === 1) setPan({ x: 0, y: 0 });
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDownPan = (e) => {
    if (userZoom <= 1 || e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const zoomOut = () => {
    setUserZoom((z) => {
      const nz = Math.max(1, Math.round((z - 0.25) * 100) / 100);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  };
  const zoomIn = () => setUserZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100));
  const resetView = () => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const k = String(secondModelKey || 'nnunet').toLowerCase();
  const m2Label = k === 'swinunetr' ? 'M3' : 'M2';

  return (
    <div className={`flex w-full flex-col bg-black ${compact ? 'min-h-[12rem]' : 'min-h-[13rem]'}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-950 px-1.5 py-1">
        <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Analyse</span>
        {HEATMAP_ANALYSIS_MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setViewMode(id)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
              viewMode === id
                ? 'bg-cyan-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {id === 'm2only' ? `${m2Label} seul` : label}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-slate-700" aria-hidden />
        <button
          type="button"
          onClick={zoomOut}
          disabled={userZoom <= 1}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title="Zoom arrière"
          aria-label="Zoom arrière"
        >
          <ZoomOut className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <span className="min-w-[2.75rem] text-center text-[9px] tabular-nums text-slate-400">
          {Math.round(userZoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={userZoom >= 5}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title="Zoom avant"
          aria-label="Zoom avant"
        >
          <ZoomIn className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Réinitialiser zoom et position"
          aria-label="Réinitialiser zoom"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        {userZoom > 1 ? (
          <span className="ml-0.5 inline-flex items-center gap-0.5 text-[8px] text-slate-500">
            <Move className="h-3 w-3" strokeWidth={2} />
            glisser
          </span>
        ) : null}
      </div>
      {stats ? (
        <div className="border-b border-slate-800 bg-slate-900/95 px-2 py-1 text-[9px] leading-snug text-slate-400">
          <span className="text-slate-500">Image {stats.roiW}×{stats.roiH}px</span>
          {' · '}
          M1∖{m2Label} <span className="font-mono text-slate-300">{stats.m1Only.toLocaleString('fr-FR')}</span>
          {' · '}
          {m2Label}∖M1 <span className="font-mono text-slate-300">{stats.m2Only.toLocaleString('fr-FR')}</span>
          {' · '}
          ∩ <span className="font-mono text-slate-300">{stats.overlap.toLocaleString('fr-FR')}</span>
          {stats.dice != null ? (
            <>
              {' · '}
              Dice{' '}
              <span className="font-mono font-semibold text-cyan-200/90">
                {stats.dice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      <div
        ref={wrapRef}
        className={`relative flex min-h-[10rem] w-full flex-1 cursor-crosshair overflow-x-hidden overflow-y-auto bg-black ${
          compact ? 'items-center justify-center' : 'items-start justify-center'
        }`}
        onMouseDown={onMouseDownPan}
        role="presentation"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${userZoom})`,
            transformOrigin: compact ? 'center center' : 'center top',
          }}
          className={compact ? '' : 'w-full'}
        >
          <canvas
            ref={canvasRef}
            className={compact ? 'mx-auto block max-w-full' : 'mx-auto block w-full max-w-none'}
            aria-label={alt || 'Heatmap comparative des deux masques hippocampes'}
            role="img"
          />
        </div>
      </div>
      <p className="border-t border-slate-900 px-2 py-0.5 text-[8px] text-slate-600">
        Molette : zoom · « Union » : M1 seul (froid), {m2Label} seul (chaud), chevauchement (milieu jet)
      </p>
    </div>
  );
}

/**
 * Compose IRM + masque sur canvas (pas de mask-image CSS : sans CORS ça teinte tout le panneau).
 */
function HippocampusOverlayPreview({
  sourceSrc,
  maskSrc,
  alt,
  overlayRgb = HIPPO_OVERLAY_RGB,
  overlayAlpha = HIPPO_OVERLAY_ALPHA,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!sourceSrc || !maskSrc || !wrap || !canvas) return undefined;

    let cancelled = false;
    const mri = new Image();
    const mask = new Image();
    mri.crossOrigin = 'anonymous';
    mask.crossOrigin = 'anonymous';

    const paint = () => {
      if (cancelled || !mri.complete || mri.naturalWidth < 1) return;

      const wrapW = Math.max(1, wrap.clientWidth);
      const maxH = Math.max(208, maxSlicePanelHeightPx());
      const nw = mri.naturalWidth;
      const nh = mri.naturalHeight;
      const scale = Math.min(wrapW / nw, maxH / nh, 1);
      const dispW = Math.max(1, Math.round(nw * scale));
      const dispH = Math.max(1, Math.round(nh * scale));

      canvas.width = dispW;
      canvas.height = dispH;
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;
      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, dispW, dispH);
      ctx.drawImage(mri, 0, 0, dispW, dispH);

      if (!mask.complete || mask.naturalWidth < 1) return;

      try {
        const mc = document.createElement('canvas');
        mc.width = dispW;
        mc.height = dispH;
        const mctx = mc.getContext('2d', { willReadFrequently: true });
        if (!mctx) return;
        mctx.drawImage(mask, 0, 0, dispW, dispH);
        const md = mctx.getImageData(0, 0, dispW, dispH).data;
        const slice = ctx.getImageData(0, 0, dispW, dispH);
        const od = slice.data;
        const [mr, mg, mb] = overlayRgb;
        const a = overlayAlpha;

        for (let i = 0; i < md.length; i += 4) {
          const ma = md[i + 3] / 255;
          const lum = (0.299 * md[i] + 0.587 * md[i + 1] + 0.114 * md[i + 2]) * ma;
          if (lum <= HIPPO_MASK_LUM_THRESHOLD) continue;
          od[i] = od[i] * (1 - a) + mr * a;
          od[i + 1] = od[i + 1] * (1 - a) + mg * a;
          od[i + 2] = od[i + 2] * (1 - a) + mb * a;
        }
        ctx.putImageData(slice, 0, 0);
      } catch (e) {
        console.warn('HippocampusOverlayPreview: fusion masque impossible (souvent CORS)', e);
      }
    };

    const onAny = () => {
      if (cancelled) return;
      paint();
    };

    mri.onload = onAny;
    mask.onload = onAny;
    mri.onerror = onAny;
    mask.onerror = onAny;
    mri.src = sourceSrc;
    mask.src = maskSrc;

    const ro = new ResizeObserver(onAny);
    ro.observe(wrap);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [sourceSrc, maskSrc, overlayRgb, overlayAlpha]);

  return (
    <div
      ref={wrapRef}
      className="relative flex min-h-[13rem] w-full items-center justify-center overflow-hidden bg-black"
    >
      {sourceSrc ? (
        <canvas
          ref={canvasRef}
          className="mx-auto max-h-[min(52vh,34rem)] max-w-full"
          aria-label={alt || 'Coupe IRM avec surimpression hippocampe'}
          role="img"
        />
      ) : (
        <div className="flex min-h-[13rem] items-center justify-center px-4 text-sm text-slate-500">Image indisponible</div>
      )}
    </div>
  );
}

/**
 * Paire masque + heatmap pour une grille parente (2 ou 4 colonnes).
 * `contents` : les 2 cellules participent au grid du parent (une ligne à 4 images sur xl).
 */
function RelaunchComparisonPairColumns({
  coupeLabel,
  maskColumnTitle,
  binaryMaskSrc,
  fusionColumnTitle,
  m1FusionSrc,
  m2FusionSrc,
  secondModelKey,
  fusionAlt,
  compact = false,
}) {
  const imgClass = compact ? RESULT_VIEW_COMPACT_IMG : RESULT_VIEW_IMG;
  const emptyMinH = compact ? 'min-h-[12rem]' : 'min-h-[13rem]';
  return (
    <div className="contents">
      <div className="min-w-0 bg-black">
        <p className="bg-slate-950 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:px-3 sm:text-[10px]">
          {maskColumnTitle}
        </p>
        <div className="flex justify-center overflow-hidden bg-black py-1">
          {binaryMaskSrc ? (
            <img src={binaryMaskSrc} alt={`masque-${coupeLabel}`} className={imgClass} loading="lazy" />
          ) : (
            <div className={`flex ${emptyMinH} w-full items-center justify-center text-sm text-slate-500`}>
              Masque indisponible
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 bg-black">
        <p className="bg-slate-950 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:px-3 sm:text-[10px]">
          {fusionColumnTitle}
        </p>
        {m1FusionSrc && m2FusionSrc ? (
          <DualHippocampusHeatmapCrop
            maskM1Src={m1FusionSrc}
            maskM2Src={m2FusionSrc}
            secondModelKey={secondModelKey}
            alt={fusionAlt}
            compact={compact}
          />
        ) : (
          <div className={`flex ${emptyMinH} items-center justify-center text-sm text-slate-500`}>
            Carte indisponible
          </div>
        )}
      </div>
    </div>
  );
}

/** Masque binaire + heatmap (une paire seule, 2 colonnes). */
function RelaunchResultTriptych({
  coupeLabel,
  binaryMaskSrc,
  m1FusionSrc,
  m2FusionSrc,
  secondModelKey,
  fusionColumnTitle,
  fusionAlt,
  compact = false,
  maskColumnTitle = 'Masque binaire',
}) {
  return (
    <div className="border-t border-slate-800 bg-slate-950/90">
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-700 border-t border-slate-200 bg-black">
        <RelaunchComparisonPairColumns
          coupeLabel={coupeLabel}
          maskColumnTitle={maskColumnTitle}
          binaryMaskSrc={binaryMaskSrc}
          fusionColumnTitle={fusionColumnTitle}
          m1FusionSrc={m1FusionSrc}
          m2FusionSrc={m2FusionSrc}
          secondModelKey={secondModelKey}
          fusionAlt={fusionAlt}
          compact={compact}
        />
      </div>
    </div>
  );
}

function SliceMetaModalDialog({ slice, coupeXY, seriesTotal, onClose }) {
  const sliceId = slice?.id;
  const rel = String(slice?.relative_path || '').trim();
  const uploadedAt = slice?.uploaded_at;
  const originalName = String(slice?.original_filename || '').trim();
  const storagePath = String(slice?.file || '').trim();
  const previewEndpoint = sliceId != null ? `/api/mri-files/${sliceId}/preview/` : '';
  const fileUrl = String(slice?.file_url || '').trim();
  const w = slice?.image_width;
  const h = slice?.image_height;
  const pixelCount =
    typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? w * h : null;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px] transition-opacity"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slice-meta-title"
        className="relative z-10 flex max-h-[min(36rem,88vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Détails techniques</p>
            <h2 id="slice-meta-title" className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              {coupeXY}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Série : {seriesTotal} coupe{seriesTotal > 1 ? 's' : ''}</p>
            {originalName ? (
              <p className="mt-2 break-all text-xs font-medium text-slate-700" title={originalName}>
                {originalName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="space-y-3.5 text-[13px] leading-snug">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Position dans la série</dt>
              <dd className="mt-0.5 font-mono text-slate-900">{coupeXY}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Extension</dt>
              <dd className="mt-0.5 font-mono text-slate-900">{getFileExtension(originalName)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Chemin relatif (dossier)</dt>
              <dd className="mt-0.5 break-all text-slate-900">{rel || '—'}</dd>
            </div>
            {storagePath ? (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Emplacement de stockage</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-800" title={storagePath}>
                  {truncateMiddle(storagePath, 64)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold text-slate-500">Identifiant fichier (API)</dt>
              <dd className="mt-0.5 font-mono text-slate-900">{sliceId != null ? `#${sliceId}` : '—'}</dd>
            </div>
            {slice?.patient != null ? (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Référence patient</dt>
                <dd className="mt-0.5 font-mono text-slate-900">#{slice.patient}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold text-slate-500">Dimensions (pixels)</dt>
              <dd className="mt-0.5 font-mono text-slate-900">{getSliceDimensionsLabel(slice)}</dd>
            </div>
            {pixelCount != null ? (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Nombre de pixels</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{pixelCount.toLocaleString('fr-FR')}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold text-slate-500">Taille sur disque</dt>
              <dd className="mt-0.5 font-mono text-slate-900">{formatFileSizeBytes(slice?.file_size)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Horodatage d&apos;import</dt>
              <dd className="mt-0.5 text-slate-900">{formatDateTimeDetail(uploadedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Aperçu (API)</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-800" title={previewEndpoint}>
                {previewEndpoint || '—'}
              </dd>
            </div>
            {fileUrl ? (
              <div>
                <dt className="text-xs font-semibold text-slate-500">URL média</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-800" title={fileUrl}>
                  {truncateMiddle(fileUrl, 64)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <p className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-center text-[11px] text-slate-500">
          Échap ou clic sur le fond pour fermer
        </p>
      </div>
    </div>
  );
}

export default function NouvelleSegmentation({ user: userProp = null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const launchTriggeredRef = useRef(false);

  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [slices, setSlices] = useState([]);
  const [selectedSlices, setSelectedSlices] = useState([]);
  const [selectedModel, setSelectedModel] = useState('unetpp');
  const [runSummary, setRunSummary] = useState(null);
  const [slicesLoading, setSlicesLoading] = useState(false);
  const [slicesError, setSlicesError] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [progress, setProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launchResult, setLaunchResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [persistedResults, setPersistedResults] = useState([]);
  const [patientListPage, setPatientListPage] = useState(0);
  const [slicesListPage, setSlicesListPage] = useState(0);
  const [resultsListPage, setResultsListPage] = useState(0);
  /** Filtre d’affichage résultats : coupes from–to (1-based), null = toutes. */
  const [resultsViewRange, setResultsViewRange] = useState(null);
  const [resultsViewRangeFromInput, setResultsViewRangeFromInput] = useState('');
  const [resultsViewRangeToInput, setResultsViewRangeToInput] = useState('');
  const [resultsViewRangeMessage, setResultsViewRangeMessage] = useState('');
  /** Rang 1-based de la coupe suivie dans la série chargée (étapes 2–3 : affichage persistant type 12/35). */
  const [workflowSliceRank, setWorkflowSliceRank] = useState(1);
  const [maskActionBusy, setMaskActionBusy] = useState({});
  /** Modal métadonnées coupe (étape 2) — ouverture par le bouton sur la vignette. */
  const [sliceMetaModal, setSliceMetaModal] = useState(null);
  /** Avant l’étape 3 : le médecin confirme patient + coupes sélectionnées. */
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false);
  const [validateConfirmOpen, setValidateConfirmOpen] = useState(false);
  /** Confirmation « adopter M2/M3 comme référence » (une coupe). */
  const [adoptConfirm, setAdoptConfirm] = useState(null);
  /** Par id de masque : modèle choisi pour adoption (radio « conserver »). */
  const [finalModelSelection, setFinalModelSelection] = useState({});
  /** Plage « Coupe début → fin » (numéros 1…n dans l’ordre du dossier). */
  const [sliceRangeFrom, setSliceRangeFrom] = useState('1');
  const [sliceRangeTo, setSliceRangeTo] = useState('');
  const [sliceRangeFeedback, setSliceRangeFeedback] = useState(null);

  // ── Qualité des coupes (preprocessing anti-coupes noires) ────────────────
  const [sliceQuality, setSliceQuality] = useState({});     // { fileId: {brain_ratio, is_empty, is_low_content, recommended} }
  const [qualitySummary, setQualitySummary] = useState(null); // { total, recommended, low_content, empty, auto_excluded }

  // ── Mode sélection patient (existant | nouveau | import urgence) ───────────
  const [patientSelectMode, setPatientSelectMode] = useState('existing');
  const [isEmergencySession, setIsEmergencySession] = useState(() =>
    Boolean(userProp?.is_emergency_session)
  );
  const [emergencyFiles, setEmergencyFiles] = useState([]);
  const emergencyFolderInputRef = useRef(null);
  const emergencyMultiInputRef = useRef(null);
  const [npForm, setNpForm] = useState({ prenom: '', nom: '', date_naissance: '', sexe: '', pathologie: '', dossier_number: '' });
  const [npErrors, setNpErrors] = useState({});
  const [npSubmitting, setNpSubmitting] = useState(false);
  const [npApiError, setNpApiError] = useState('');
  const [npDragging, setNpDragging] = useState(false);
  const [npFiles, setNpFiles] = useState([]);
  const npFileRef = useRef(null);
  const npFolderRef = useRef(null);

  const [doctorName, setDoctorName] = useState(getDoctorName());
  const runIdFromQuery = searchParams.get('run');

  useEffect(() => {
    if (userProp == null || typeof userProp !== 'object') return;
    setIsEmergencySession(Boolean(userProp.is_emergency_session));
    if (userProp.is_emergency_session) setPatientSelectMode('emergency_upload');
  }, [userProp]);

  useEffect(() => {
    const loadDoctorName = async () => {
      try {
        const response = await api.get('/check_session');
        const user = response?.data?.user;
        if (!user || typeof user !== 'object') return;

        const fromFullName = String(user.fullName || user.full_name || '').trim();
        let display = fromFullName;
        if (!display || display.includes('@')) {
          const firstName = String(user.first_name || user.prenom || '').trim();
          const lastName = String(user.last_name || user.nom || '').trim();
          display = `${firstName} ${lastName}`.trim();
        }
        if (!display) {
          const username = String(user.username || '').trim();
          display = (!username || username.includes('@')) ? 'Medecin' : username;
        }

        setDoctorName(display);
        setIsEmergencySession(Boolean(response?.data?.is_emergency_session));
        localStorage.setItem('user', JSON.stringify({
          ...user,
          is_emergency_session: Boolean(response?.data?.is_emergency_session),
        }));
      } catch {
        // Keep local fallback name when session call fails.
      }
    };

    loadDoctorName();
  }, []);

  useEffect(() => {
    if (isEmergencySession) setPatientSelectMode('emergency_upload');
  }, [isEmergencySession]);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access');
      const response = await api.get('/patients/', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = response.data;
      const normalized = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.patients)
          ? payload.patients
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

      setPatients(normalized);
    } catch {
      setError('Erreur de chargement');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (step !== 2) setSliceMetaModal(null);
  }, [step]);

  useEffect(() => {
    if (step !== 2) setLaunchConfirmOpen(false);
  }, [step]);

  useEffect(() => {
    if (!launchConfirmOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLaunchConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [launchConfirmOpen]);

  useEffect(() => {
    if (!launchConfirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [launchConfirmOpen]);

  useEffect(() => {
    if (sliceMetaModal == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setSliceMetaModal(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sliceMetaModal]);

  useEffect(() => {
    if (sliceMetaModal == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sliceMetaModal]);

  const fetchPatientSlices = async () => {
    if (!selectedPatient?.id) return;

    setSlicesLoading(true);
    setSlicesError(false);
    setSliceQuality({});
    setQualitySummary(null);

    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/patients/${selectedPatient.id}/mri-files/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = response?.data;
      const files = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.mri_files)
          ? payload.mri_files
          : Array.isArray(payload?.files)
            ? payload.files
            : [];

      // ── Qualité des coupes ─────────────────────────────────────────────
      const quality = payload?.quality || {};
      const summary = payload?.quality_summary || null;
      setSliceQuality(quality);
      setQualitySummary(summary);

      setSlices(files);

      // Auto-sélection : on ne pré-sélectionne que les coupes recommandées.
      // Si aucune info qualité disponible (ancien backend), on sélectionne tout.
      const hasQuality = Object.keys(quality).length > 0;
      if (hasQuality) {
        const recommended = files
          .filter((f) => quality[String(f.id)]?.recommended !== false)
          .map((f) => f.id);
        setSelectedSlices(recommended);
      } else {
        setSelectedSlices([]);
      }

      setImageErrors({});
      setWorkflowSliceRank(1);
    } catch {
      setSlices([]);
      setSlicesError(true);
    } finally {
      setSlicesLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2 && selectedPatient?.id) {
      fetchPatientSlices();
    }
  }, [step, selectedPatient?.id]);

  useEffect(() => {
    if (step !== 3 || !isLaunching) return undefined;
    // Durée estimée : ~0.5s par coupe, on cible 90% en ce temps-là
    const nSlices = Math.max(10, selectedSlices.length);
    const targetMs = nSlices * 500; // ex: 91 coupes → ~45s pour atteindre 90%
    const tickMs  = Math.max(100, Math.round(targetMs / 45)); // 45 ticks de 2% = 90%
    const interval = setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        return current + 2;
      });
    }, tickMs);
    return () => clearInterval(interval);
  }, [step, isLaunching, selectedSlices.length]);

  const launchSegmentation = async () => {
    if (!selectedPatient?.id) {
      setLaunchError('Veuillez sélectionner un patient avant de lancer la segmentation.');
      setProgress(0);
      return;
    }
    if (!Array.isArray(selectedSlices) || selectedSlices.length === 0) {
      setLaunchError('Aucune coupe sélectionnée. Revenez à l\'étape 2 pour choisir au moins une coupe.');
      setProgress(0);
      return;
    }

    setIsLaunching(true);
    setLaunchError('');
    setLaunchResult(null);
    setShowResults(false);
    setResultsError('');
    setPersistedResults([]);
    setRunSummary(null);
    setProgress(5);

    try {
      const token = localStorage.getItem('access');
      const response = await api.post(
        `/patients/${selectedPatient.id}/segment/`,
        {
          model: selectedModel || 'unetpp',
          file_ids: selectedSlices,
          threshold: DEFAULT_SEGMENTATION_THRESHOLD,
        },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      setLaunchResult(response?.data || null);
      setProgress(100);
    } catch (err) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message;
      setLaunchError(apiMessage || 'Le lancement de la segmentation a échoué.');
      setProgress(0);
    } finally {
      setIsLaunching(false);
    }
  };

  useEffect(() => {
    if (step !== 3) {
      launchTriggeredRef.current = false;
      setIsLaunching(false);
      setLaunchError('');
      setLaunchResult(null);
      setShowResults(false);
      setResultsError('');
      setPersistedResults([]);
      setRunSummary(null);
      setProgress(0);
      return;
    }

    if (!launchTriggeredRef.current) {
      launchTriggeredRef.current = true;
      launchSegmentation();
    }
  }, [step, selectedPatient?.id, selectedModel, selectedSlices]);

  const toAbsoluteMediaUrl = (rawUrl) => {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const loadSegmentationResults = async (runId) => {
    setResultsLoading(true);
    setResultsError('');
    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/segmentation-runs/${runId}/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const run = response?.data?.run || {};
      const rows = Array.isArray(run?.results) ? run.results : [];
      setPersistedResults(rows);
      setRunSummary({
        run_id: run?.id,
        model_key: run?.model_key,
        model_version: run?.model_version,
        threshold: run?.threshold,
        selected_count: run?.selected_count,
        processed_count: run?.processed_count,
        status: run?.status,
        created_at: run?.created_at,
        completed_at: run?.completed_at,
      });
      setShowResults(true);

      const runPatientId = run?.patient;
      if (runPatientId && !selectedPatient) {
        setSelectedPatient((prev) => prev || { id: runPatientId, full_name: `Patient #${runPatientId}` });
      }

      const runModel = String(run?.model_key || '').trim();
      if (runModel) {
        setSelectedModel(runModel);
      }

      if (rows.length > 0) {
        const inferredSliceIds = Array.from(
          new Set(
            rows
              .map((r) => r?.mri_file)
              .filter((id) => id != null)
          )
        );
        if (inferredSliceIds.length > 0) {
          setSelectedSlices((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : inferredSliceIds));
        }
      }
    } catch (err) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message;
      setResultsError(apiMessage || 'Impossible de charger les résultats de segmentation.');
    } finally {
      setResultsLoading(false);
    }
  };

  const openSegmentationResults = async () => {
    const runId = launchResult?.run_id;
    if (runId) {
      await loadSegmentationResults(runId);
      return;
    }
    setPersistedResults(Array.isArray(launchResult?.results) ? launchResult.results : []);
    setRunSummary(
      launchResult
        ? {
            run_id: launchResult.run_id,
            model_key: launchResult.model || 'unetpp',
            model_version: launchResult.model_version,
            threshold: launchResult.threshold,
            processed_count: launchResult.count,
            selected_count: launchResult.count,
          }
        : null
    );
    setShowResults(true);
  };

  const currentRunId = Number(launchResult?.run_id || runIdFromQuery || 0);

  const effectiveRunId = Number.isFinite(currentRunId) && currentRunId > 0 ? currentRunId : Number(runSummary?.run_id) || 0;

  useEffect(() => {
    setResultsViewRange(null);
    setResultsViewRangeFromInput('');
    setResultsViewRangeToInput('');
    setResultsViewRangeMessage('');
    setResultsListPage(0);
  }, [effectiveRunId]);

  const mergeMaskRowsIntoState = (updates) => {
    const byId = new Map((updates || []).filter((u) => u?.id != null).map((u) => [u.id, u]));
    if (byId.size === 0) return;
    setPersistedResults((prev) => prev.map((row) => (row?.id != null && byId.has(row.id) ? { ...row, ...byId.get(row.id) } : row)));
  };

  const setMaskBusyKey = (key, busy) => {
    setMaskActionBusy((prev) => {
      const next = { ...prev };
      if (busy) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  const patchMaskReview = async (runId, maskId, reviewStatus) => {
    if (!runId || !maskId) return;
    setMaskBusyKey(maskId, true);
    setResultsError('');
    try {
      const token = localStorage.getItem('access');
      const res = await api.patch(
        `/segmentation-runs/${runId}/masks/${maskId}/review/`,
        { review_status: reviewStatus },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const updated = res?.data?.result;
      if (updated?.id) mergeMaskRowsIntoState([updated]);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Mise à jour du statut impossible.';
      setResultsError(msg);
    } finally {
      setMaskBusyKey(maskId, false);
    }
  };

  const resegmentSliceWithModel = async (runId, mriFileId, modelKey) => {
    if (!runId || !mriFileId) return;
    const busyKey = `reseg-${mriFileId}`;
    setMaskBusyKey(busyKey, true);
    setResultsError('');
    try {
      const token = localStorage.getItem('access');
      const res = await api.post(
        `/segmentation-runs/${runId}/resegment/`,
        { model: modelKey, mri_file_ids: [mriFileId] },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const list = res?.data?.results;
      if (Array.isArray(list)) mergeMaskRowsIntoState(list);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Lancement segmentation impossible.';
      setResultsError(msg);
    } finally {
      setMaskBusyKey(busyKey, false);
    }
  };

  const adoptReferenceMask = async (runId, maskId, modelKey) => {
    if (!runId || !maskId || !modelKey) return;
    setMaskBusyKey(maskId, true);
    setResultsError('');
    try {
      const token = localStorage.getItem('access');
      const res = await api.post(
        `/segmentation-runs/${runId}/masks/${maskId}/adopt-reference/`,
        { model_key: modelKey },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const updated = res?.data?.result;
      if (updated?.id) mergeMaskRowsIntoState([updated]);
      setFinalModelSelection((prev) => {
        const next = { ...prev };
        delete next[maskId];
        return next;
      });
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.response?.data?.detail || 'Adoption du masque impossible.';
      setResultsError(msg);
    } finally {
      setMaskBusyKey(maskId, false);
    }
  };

  useEffect(() => {
    if (!runIdFromQuery) return;
    const parsed = Number(runIdFromQuery);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    launchTriggeredRef.current = true;
    setStep(3);
    setProgress(100);
    setLaunchError('');
    setLaunchResult({ run_id: parsed });
    loadSegmentationResults(parsed);
  }, [runIdFromQuery]);

  const flowSteps = [
    { id: 1, label: 'Sélection du patient' },
    { id: 2, label: 'Coupes IRM' },
    { id: 3, label: 'Segmentation (Modèle 1)' },
  ];

  const filteredPatients = useMemo(
    () =>
      patients.filter((p) =>
        (`${p.first_name || p.prenom || ''} ${p.last_name || p.nom || ''}`)
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [patients, search]
  );

  useEffect(() => {
    setPatientListPage(0);
  }, [search, patients.length]);

  useEffect(() => {
    if (step === 2) setSlicesListPage(0);
  }, [step, selectedPatient?.id]);

  useEffect(() => {
    if (step !== 2 || slices.length === 0) {
      setSliceRangeFeedback(null);
      return;
    }
    setSliceRangeFrom('1');
    setSliceRangeTo(String(slices.length));
  }, [step, selectedPatient?.id, slices.length]);

  useEffect(() => {
    setResultsListPage(0);
  }, [persistedResults.length, showResults]);

  const paginatedPatients = useMemo(() => {
    const start = patientListPage * LIST_PAGE_SIZE;
    return filteredPatients.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredPatients, patientListPage]);

  const patientLastPage = useMemo(
    () => (filteredPatients.length === 0 ? 0 : Math.max(0, Math.ceil(filteredPatients.length / LIST_PAGE_SIZE) - 1)),
    [filteredPatients.length]
  );

  const paginatedSlices = useMemo(() => {
    const start = slicesListPage * LIST_PAGE_SIZE;
    return slices.slice(start, start + LIST_PAGE_SIZE);
  }, [slices, slicesListPage]);

  const slicesLastPage = useMemo(
    () => (slices.length === 0 ? 0 : Math.max(0, Math.ceil(slices.length / LIST_PAGE_SIZE) - 1)),
    [slices.length]
  );

  const persistedResultsRankedSorted = useMemo(() => {
    const list = persistedResults.map((row, i) => ({
      row,
      rank: resultRowCoupeRank(row, i, slices),
    }));
    return [...list].sort((a, b) => a.rank - b.rank || (a.row?.id ?? 0) - (b.row?.id ?? 0));
  }, [persistedResults, slices]);

  const persistedResultsFiltered = useMemo(() => {
    if (!resultsViewRange) return persistedResultsRankedSorted.map((d) => d.row);
    const { from, to } = resultsViewRange;
    return persistedResultsRankedSorted.filter((d) => d.rank >= from && d.rank <= to).map((d) => d.row);
  }, [persistedResultsRankedSorted, resultsViewRange]);

  const paginatedResults = useMemo(() => {
    const start = resultsListPage * LIST_PAGE_SIZE;
    return persistedResultsFiltered.slice(start, start + LIST_PAGE_SIZE);
  }, [persistedResultsFiltered, resultsListPage]);

  const resultsLastPage = useMemo(
    () =>
      persistedResultsFiltered.length === 0
        ? 0
        : Math.max(0, Math.ceil(persistedResultsFiltered.length / LIST_PAGE_SIZE) - 1),
    [persistedResultsFiltered.length]
  );

  /** Affichage persistant « coupe courante / total série » depuis la sélection jusqu’aux résultats. */
  const workflowSliceCounter = useMemo(() => {
    const totalSeries = slices.length;
    if (step < 2) return null;

    if (step === 2) {
      if (totalSeries === 0) return slicesLoading ? { current: null, total: null, pending: true } : null;
      return {
        current: Math.min(totalSeries, Math.max(1, workflowSliceRank)),
        total: totalSeries,
        pending: false,
      };
    }

    if (step === 3) {
      if (totalSeries > 0) {
        if (!showResults) {
          const current = Math.max(1, Math.min(totalSeries, Math.round((progress / 100) * totalSeries)));
          return { current, total: totalSeries, pending: false };
        }
        const first = paginatedResults[0];
        if (first) {
          const fid = first.mri_file ?? first.file_id;
          const idx = slices.findIndex((s) => s?.id === fid);
          let current = idx >= 0 ? idx + 1 : Number(first.slice_index ?? first.index ?? 1);
          if (!Number.isFinite(current) || current < 1) current = 1;
          return { current: Math.min(totalSeries, current), total: totalSeries, pending: false };
        }
        return {
          current: Math.min(totalSeries, Math.max(1, workflowSliceRank)),
          total: totalSeries,
          pending: false,
        };
      }
      if (showResults && persistedResults.length > 0) {
        const start = resultsListPage * LIST_PAGE_SIZE;
        const n = persistedResultsFiltered.length;
        return {
          current: n === 0 ? 0 : Math.min(n, start + 1),
          total: n,
          pending: false,
          fallbackResults: true,
        };
      }
    }

    return null;
  }, [
    step,
    slices,
    workflowSliceRank,
    progress,
    showResults,
    paginatedResults,
    resultsListPage,
    persistedResults.length,
    persistedResultsFiltered.length,
    slicesLoading,
  ]);

  const reviewStats = useMemo(() => {
    let validated = 0;
    let rejected = 0;
    let pending = 0;
    for (const row of persistedResults) {
      const s = String(row?.review_status || 'pending').toLowerCase();
      if (s === 'validated') validated += 1;
      else if (s === 'rejected') rejected += 1;
      else pending += 1;
    }
    return { validated, rejected, pending, total: persistedResults.length };
  }, [persistedResults]);

  useEffect(() => {
    setPatientListPage((p) => Math.min(p, patientLastPage));
  }, [patientLastPage]);

  useEffect(() => {
    setSlicesListPage((p) => Math.min(p, slicesLastPage));
  }, [slicesLastPage]);

  useEffect(() => {
    setResultsListPage((p) => Math.min(p, resultsLastPage));
  }, [resultsLastPage]);

  /** À chaque page du catalogue de coupes, positionner le compteur sur la première coupe de la page. */
  useEffect(() => {
    if (step !== 2 || slices.length === 0) return;
    const start = slicesListPage * LIST_PAGE_SIZE;
    setWorkflowSliceRank(Math.min(slices.length, start + 1));
  }, [slicesListPage, step, slices.length]);

  const goToFlowStep = (targetStep) => {
    if (targetStep === step) return;
    if (targetStep === 1) {
      if (runIdFromQuery) navigate('/segmentation/nouvelle', { replace: true });
      setShowResults(false);
      setPersistedResults([]);
      setRunSummary(null);
      setLaunchResult(null);
      setLaunchError('');
      setProgress(0);
      launchTriggeredRef.current = false;
      setStep(1);
      return;
    }
    if (targetStep === 2) {
      if (!selectedPatient?.id) return;
      setShowResults(false);
      setProgress(0);
      setLaunchError('');
      launchTriggeredRef.current = false;
      setStep(2);
      return;
    }
    if (targetStep === 3) {
      const canEnter = step === 3 || (Boolean(selectedPatient?.id) && selectedSlices.length > 0);
      if (!canEnter) return;
      if (step === 2) {
        setLaunchConfirmOpen(true);
        return;
      }
      setStep(3);
    }
  };

  const checklistStepSize = 100 / CHECKLIST_STEPS.length;
  const completedSteps = Math.min(CHECKLIST_STEPS.length, Math.floor(progress / checklistStepSize));

  const resolveSliceUrl = (slice) => {
    const raw = String(slice?.preview_url || slice?.file_url || slice?.url || slice?.file || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const getSliceName = (slice, index0InSeries, totalSlices) => {
    const fileName = String(slice?.original_filename || slice?.filename || slice?.relative_path || '').trim();
    if (fileName) return fileName;
    const rank =
      typeof slice?.index === 'number' && Number.isFinite(slice.index) && slice.index >= 1
        ? slice.index
        : index0InSeries + 1;
    return formatCoupeXY(rank, totalSlices);
  };

  const launchConfirmationLines = useMemo(() => {
    const total = slices.length;
    const labelFor = (slice, index0InSeries) => {
      const fileName = String(slice?.original_filename || slice?.filename || slice?.relative_path || '').trim();
      if (fileName) return fileName;
      const rank =
        typeof slice?.index === 'number' && Number.isFinite(slice.index) && slice.index >= 1
          ? slice.index
          : index0InSeries + 1;
      return formatCoupeXY(rank, total);
    };
    return [...selectedSlices]
      .filter((id) => id != null)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => {
        const idx = slices.findIndex((s) => s?.id === id);
        const slice = idx >= 0 ? slices[idx] : null;
        const coupe = idx >= 0 ? formatCoupeXY(idx + 1, total) : `IRM fichier #${id}`;
        const filename = slice ? labelFor(slice, idx) : '—';
        return { id, coupe, filename };
      });
  }, [selectedSlices, slices]);

  const toggleSlice = (sliceId) => {
    if (sliceId == null) return;
    setSelectedSlices((prev) =>
      prev.includes(sliceId)
        ? prev.filter((index) => index !== sliceId)
        : [...prev, sliceId]
    );
  };

  const parseSliceRangeInputs = () => {
    const n = slices.length;
    const rawA = parseInt(String(sliceRangeFrom).trim(), 10);
    const rawB = parseInt(String(sliceRangeTo).trim(), 10);
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) {
      return { error: 'Indiquez deux numéros entiers (ex. 10 et 30).' };
    }
    const from = Math.min(rawA, rawB);
    const to = Math.max(rawA, rawB);
    if (from < 1 || to < 1) {
      return { error: 'Les numéros de coupe commencent à 1.' };
    }
    if (from > n || to > n) {
      return { error: `Ce dossier comporte ${n} coupe${n > 1 ? 's' : ''} (de 1 à ${n}).` };
    }
    return { from, to };
  };

  const idsForSliceRange = (from, to) => {
    const ids = [];
    for (let i = from - 1; i <= to - 1; i++) {
      const id = slices[i]?.id;
      if (id != null) ids.push(id);
    }
    return ids;
  };

  const applySliceRange = (mode) => {
    if (slices.length === 0) return;
    const parsed = parseSliceRangeInputs();
    if (parsed.error) {
      setSliceRangeFeedback({ ok: false, text: parsed.error });
      return;
    }
    const { from, to } = parsed;
    const ids = idsForSliceRange(from, to);
    if (ids.length === 0) {
      setSliceRangeFeedback({ ok: false, text: 'Aucun fichier valide dans cette plage.' });
      return;
    }
    if (mode === 'replace') setSelectedSlices(ids);
    else setSelectedSlices((prev) => Array.from(new Set([...prev, ...ids])));
    setSliceRangeFeedback({
      ok: true,
      text:
        mode === 'replace'
          ? `Plage ${from}–${to} : ${ids.length} coupe${ids.length > 1 ? 's' : ''} sélectionnée${ids.length > 1 ? 's' : ''}.`
          : `Plage ${from}–${to} ajoutée (${ids.length} coupe${ids.length > 1 ? 's' : ''}).`,
    });
    setWorkflowSliceRank(from);
    const pageIdx = Math.floor((from - 1) / LIST_PAGE_SIZE);
    const sn = slices.length;
    const lastPg = sn === 0 ? 0 : Math.max(0, Math.ceil(sn / LIST_PAGE_SIZE) - 1);
    setSlicesListPage(Math.max(0, Math.min(lastPg, pageIdx)));
  };

  const applyResultsViewRange = () => {
    const maxN = Math.max(1, slices.length > 0 ? slices.length : persistedResults.length);
    let fromStr = String(resultsViewRangeFromInput).trim();
    let toStr = String(resultsViewRangeToInput).trim();
    if (fromStr.includes('-') && !toStr) {
      const parts = fromStr.split(/\s*-\s*/).filter(Boolean);
      if (parts.length === 2) {
        [fromStr, toStr] = parts;
      }
    }
    const rawA = parseInt(fromStr, 10);
    const rawB = parseInt(toStr, 10);
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) {
      setResultsViewRangeMessage('Indiquez deux numéros ou une plage (ex. 5 et 18, ou 5-18 dans le premier champ).');
      return;
    }
    const from = Math.min(rawA, rawB);
    const to = Math.max(rawA, rawB);
    if (from < 1) {
      setResultsViewRangeMessage('La première coupe est numérotée 1.');
      return;
    }
    if (to > maxN) {
      setResultsViewRangeMessage(`Ce run comporte des coupes 1 à ${maxN} (réf. « Coupe x/${maxN} »).`);
      return;
    }
    const ranked = persistedResults.map((row, i) => ({
      rank: resultRowCoupeRank(row, i, slices),
    }));
    const countInRun = ranked.filter((d) => d.rank >= from && d.rank <= to).length;
    setResultsViewRange({ from, to });
    setResultsViewRangeMessage(
      countInRun === 0
        ? `Aucun résultat pour les coupes ${from}–${to}.`
        : `Coupes ${from} à ${to} : ${countInRun} résultat${countInRun > 1 ? 's' : ''} affiché${countInRun > 1 ? 's' : ''}.`
    );
    setResultsListPage(0);
  };

  const clearResultsViewRange = () => {
    setResultsViewRange(null);
    setResultsViewRangeMessage('');
    setResultsListPage(0);
  };

  // Auto-fetch next dossier number when switching to new-patient tab
  useEffect(() => {
    if (patientSelectMode !== 'new' || npForm.dossier_number) return;
    const token = localStorage.getItem('access');
    api.get('/patients/next-dossier/', token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then((r) => { if (r.data?.ok) setNpForm((f) => ({ ...f, dossier_number: r.data.dossier_number })); })
      .catch(() => {});
  }, [patientSelectMode]);

  const npSet = (key, val) => {
    setNpForm((f) => ({ ...f, [key]: val }));
    setNpErrors((e) => ({ ...e, [key]: '' }));
  };

  const ACCEPTED_EXTS = ['.nii', '.nii.gz', '.dcm', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'];
  const npHandleFileDrop = useCallback((e) => {
    e.preventDefault();
    setNpDragging(false);
    const raw = e.dataTransfer?.files || e.target?.files;
    if (!raw) return;
    const filtered = Array.from(raw).filter((f) =>
      ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (filtered.length > 0) setNpFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...filtered.filter((f) => !names.has(f.name))];
    });
    e.target.value = '';
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const minDob = new Date(new Date().setFullYear(new Date().getFullYear() - 130)).toISOString().split('T')[0];

  const npHandleSubmit = async () => {
    const errs = {};
    if (!npForm.date_naissance) {
      errs.date_naissance = 'Requis';
    } else if (npForm.date_naissance > today) {
      errs.date_naissance = 'La date de naissance ne peut pas être dans le futur';
    } else if (npForm.date_naissance < minDob) {
      errs.date_naissance = 'Date invalide (âge maximum : 130 ans)';
    }
    if (!npForm.sexe)       errs.sexe = 'Requis';
    if (!npForm.pathologie) errs.pathologie = 'Requis';
    if (Object.keys(errs).length) { setNpErrors(errs); return; }
    setNpSubmitting(true);
    setNpApiError('');
    try {
      const payload = new FormData();
      Object.entries(npForm).forEach(([k, v]) => { if (v) payload.append(k, v); });
      npFiles.forEach((f) => payload.append('files', f));
      const res = await createPatient(payload);
      const created = res.data?.patient ?? res.data;
      // Add to patients list and select
      setPatients((prev) => [created, ...prev]);
      setSelectedPatient(created);
      setPatientSelectMode('existing');
    } catch (err) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(' · ')
        : 'Erreur lors de la création du patient.';
      setNpApiError(msg);
    } finally {
      setNpSubmitting(false);
    }
  };

  const pickEmergencyFiles = (fileList) => {
    const list = fileList ? Array.from(fileList) : [];
    setEmergencyFiles(list);
    setNpApiError('');
  };

  const submitEmergencyStaging = async () => {
    if (emergencyFiles.length === 0) {
      setNpApiError('Ajoutez au moins un fichier ou choisissez un dossier.');
      return;
    }
    setNpSubmitting(true);
    setNpApiError('');
    try {
      const fd = new FormData();
      emergencyFiles.forEach((f) => {
        fd.append('files', f);
        fd.append('relative_paths', f.webkitRelativePath || f.name);
      });
      const res = await stageEmergencyPatient(fd);
      if (!res.data?.ok) {
        setNpApiError(res.data?.error || 'Import impossible.');
        return;
      }
      const patient = res.data.patient;
      setSelectedPatient(patient);
      setStep(2);
    } catch (err) {
      const apiDetail = err?.response?.data?.error || err?.response?.data?.detail;
      const isNetwork =
        !err.response &&
        (err.code === 'ERR_NETWORK' ||
          String(err.message || '').toLowerCase().includes('network'));
      let msg = apiDetail
        ? (Array.isArray(apiDetail) ? apiDetail.join(' ') : String(apiDetail))
        : '';
      if (!msg && isNetwork) {
        msg =
          'Connexion au serveur interrompue (session expirée, backend arrêté, ou import très lourd). Reconnectez-vous ou réessayez.';
      }
      if (!msg) msg = err.message || 'Erreur lors de l’import.';
      setNpApiError(msg);
    } finally {
      setNpSubmitting(false);
    }
  };

  const resetFlow = () => {
    if (runIdFromQuery) {
      navigate('/segmentation/nouvelle', { replace: true });
    }
    setStep(1);
    setSelectedPatient(null);
    setSlices([]);
    setSelectedSlices([]);
    setSelectedModel('unetpp');
    setSlicesLoading(false);
    setSlicesError(false);
    setImageErrors({});
    setProgress(0);
    setIsLaunching(false);
    setLaunchError('');
    setLaunchResult(null);
    setShowResults(false);
    setResultsError('');
    setPersistedResults([]);
    setRunSummary(null);
    launchTriggeredRef.current = false;
    setSearch('');
    setWorkflowSliceRank(1);
    setLaunchConfirmOpen(false);
    setSliceRangeFeedback(null);
    setSliceRangeFrom('1');
    setSliceRangeTo('');
    setResultsViewRange(null);
    setResultsViewRangeFromInput('');
    setResultsViewRangeToInput('');
    setResultsViewRangeMessage('');
    setEmergencyFiles([]);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans">
      <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
            <UserRound className="h-4 w-4" />
          </span>
          <div>
            <p className="text-white text-[14px] font-medium">Nouvelle segmentation hippocampique</p>
            <p className="text-blue-300 text-[11px]">Analyses MRI · Dr. {doctorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEmergencySession ? (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Acceder au dashboard
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
            aria-label="Retour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-surface-border flex items-center px-6 overflow-x-auto">
        {flowSteps.map((item, index) => {
          const isCompleted = step > item.id;
          const isActive = step === item.id;
          const canClick =
            item.id === 1
              ? true
              : item.id === 2
                ? Boolean(selectedPatient?.id)
                : step === 3 || (Boolean(selectedPatient?.id) && selectedSlices.length > 0);
          return (
            <React.Fragment key={item.id}>
              <button
                type="button"
                disabled={!canClick}
                onClick={() => goToFlowStep(item.id)}
                className={`flex items-center gap-2 py-3 border-b-2 text-left transition-opacity ${
                  isActive
                    ? 'text-primary font-medium border-primary'
                    : isCompleted
                      ? 'text-primary font-medium border-transparent'
                      : 'text-gray-400 border-transparent'
                } ${canClick ? 'cursor-pointer hover:opacity-90' : 'cursor-not-allowed opacity-60'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    isActive
                      ? 'bg-primary text-white rounded-full'
                      : isCompleted
                        ? 'bg-green-500 text-white rounded-full'
                        : 'border-2 border-surface-border text-gray-400 rounded-full'
                  }`}
                >
                  {isCompleted ? '✓' : item.id}
                </span>
                <span className="text-sm whitespace-nowrap">{item.id}. {item.label}</span>
              </button>
              {index < flowSteps.length - 1 && <span className="px-3 text-gray-300 select-none">›</span>}
            </React.Fragment>
          );
        })}
      </div>

      {workflowSliceCounter && (
        <div className="flex items-center justify-end border-b border-slate-200 bg-slate-50 px-6 py-2">
          {workflowSliceCounter.pending ? (
            <span className="text-[13px] font-medium text-slate-500">Chargement des coupes…</span>
          ) : workflowSliceCounter.current != null && workflowSliceCounter.total != null ? (
            <p className="text-[13px] font-semibold tabular-nums text-slate-700" aria-live="polite">
              Coupe{' '}
              <span className="text-slate-900">{workflowSliceCounter.current}</span>
              <span className="text-slate-400"> / </span>
              <span>{workflowSliceCounter.total}</span>
            </p>
          ) : null}
        </div>
      )}

      <main className="flex-1 overflow-hidden px-6 py-6 flex flex-col">
        <div className="bg-white rounded-xl shadow-card border border-surface-border overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 p-6 lg:p-8">
            {step === 1 && (
              <div className="space-y-5">
                {isEmergencySession ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      <p className="font-bold text-amber-900">Session urgence</p>
                      <p className="mt-1 text-xs text-amber-800/90">
                        Importez un dossier ou plusieurs fichiers : DICOM (.dcm), NIfTI (.nii,
                        .nii.gz), images (JPEG, PNG, TIFF, BMP). Même préparation que le mode
                        standard. Les données temporaires sont supprimées à la déconnexion.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => emergencyMultiInputRef.current?.click()}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Choisir des fichiers
                      </button>
                      <button
                        type="button"
                        onClick={() => emergencyFolderInputRef.current?.click()}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Choisir un dossier
                      </button>
                      {emergencyFiles.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => pickEmergencyFiles([])}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                        >
                          Effacer la sélection
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={emergencyMultiInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".nii,.nii.gz,.dcm,.dicom,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
                      onChange={(e) => {
                        pickEmergencyFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={emergencyFolderInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".nii,.nii.gz,.dcm,.dicom,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
                      {...{ webkitdirectory: '', directory: '' }}
                      onChange={(e) => {
                        pickEmergencyFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {emergencyFiles.length === 0 ? (
                        <span className="text-slate-500">Aucun fichier sélectionné.</span>
                      ) : (
                        <span className="font-semibold">
                          {emergencyFiles.length} fichier{emergencyFiles.length !== 1 ? 's' : ''} prêt
                          {emergencyFiles.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {npApiError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                        {npApiError}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                {/* ── Mode tabs (yesmine) ────────────────────────────────────────────── */}
                <div className="flex items-center gap-2">
                  {[
                    { mode: 'existing', icon: Users,    label: 'Patient existant' },
                    { mode: 'new',      icon: UserPlus, label: 'Nouveau patient'  },
                  ].map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPatientSelectMode(mode)}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200 ${
                        patientSelectMode === mode
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200'
                          : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── TAB: Patient existant ─────────────────────────────────── */}
                {patientSelectMode === 'existing' && (<>

                {/* Barre de recherche premium */}
                <div className="relative group">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-10`} />
                  <div className="relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-blue-400 focus-within:shadow-md focus-within:shadow-blue-100/50">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher par nom, prénom ou IPP…"
                      className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                    />
                    <span className="shrink-0 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500">
                      {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Loading */}
                {loading && (
                  <div className="flex h-52 flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border-4 border-blue-100" />
                      <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Chargement des patients…</p>
                  </div>
                )}

                {/* Error */}
                {!loading && error && (
                  <div className="flex h-52 flex-col items-center justify-center gap-3">
                    <p className="text-sm font-semibold text-red-500">Erreur de chargement</p>
                    <button type="button" onClick={fetchPatients}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
                      Réessayer
                    </button>
                  </div>
                )}

                {/* List */}
                {!loading && !error && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          Mes patients
                        </p>
                      </div>
                      {filteredPatients.length > 0 && (
                        <GmailStylePagination
                          page={patientListPage} pageSize={LIST_PAGE_SIZE}
                          total={filteredPatients.length}
                          onPrev={() => setPatientListPage((p) => Math.max(0, p - 1))}
                          onNext={() => setPatientListPage((p) => Math.min(patientLastPage, p + 1))}
                          showPageJump
                          onJumpToPage={(p) => setPatientListPage(Math.max(0, Math.min(patientLastPage, p)))}
                        />
                      )}
                    </div>

                    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                      {filteredPatients.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                            <UserRound className="h-8 w-8 opacity-40" />
                          </div>
                          <p className="text-sm font-semibold">Aucun patient correspondant</p>
                        </div>
                      )}

                      {paginatedPatients.map((patient, index) => {
                        const globalIndex = patientListPage * LIST_PAGE_SIZE + index;
                        const key = getPatientKey(patient, globalIndex);
                        const isSelected = selectedPatient && getPatientKey(selectedPatient, -1) === key;
                        const pathology = getPathologyBadge(patient);
                        const slicesCount = getSlicesCount(patient);
                        const ippLabel = formatIpp(patient);
                        const avatarColor = AVATAR_COLORS[globalIndex % AVATAR_COLORS.length];
                        const dob = getDateOfBirth(patient);
                        const age = getAge(dob);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedPatient(patient)}
                            className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md shadow-blue-100/50'
                                : 'border-slate-150 bg-white hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50'
                            }`}
                          >
                            {/* Barre latérale colorée */}
                            <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl transition-all duration-200 ${
                              isSelected ? 'bg-gradient-to-b from-blue-500 to-indigo-500' : 'bg-slate-100 group-hover:bg-blue-200'
                            }`} />

                            <div className="flex items-center gap-3 pl-4 pr-4 py-3.5">
                              {/* Radio dot */}
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 shadow-sm shadow-blue-200'
                                  : 'border-slate-300 bg-white group-hover:border-blue-300'
                              }`}>
                                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </span>

                              {/* Avatar */}
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm transition-transform duration-200 group-hover:scale-105 ${isSelected ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                style={{ backgroundColor: avatarColor }}>
                                {getInitials(patient)}
                              </div>

                              {/* Info principale */}
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm font-black ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                                  {getPatientName(patient)}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <CalendarDays className="h-3 w-3" />
                                    {getBirthPrefix(patient)} {formatDate(dob)}{age !== null ? ` · ${age} ans` : ''}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                                    <Hash className="h-2.5 w-2.5" />{ippLabel}
                                  </span>
                                </div>
                              </div>

                              {/* Pathologie */}
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${pathology.classes}`}>
                                {pathology.label}
                              </span>

                              {/* Stats */}
                              <div className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 ${isSelected ? 'bg-blue-100/60' : 'bg-slate-50'}`}>
                                <div className="text-center">
                                  <p className={`text-base font-black leading-none tabular-nums ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {slicesCount ?? '—'}
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">coupes</p>
                                </div>
                                <div className="mx-2 h-6 w-px bg-slate-200" />
                                <div className="text-center">
                                  <p className={`text-xs font-bold leading-none ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                    {formatDate(getLastExam(patient), false)}
                                  </p>
                                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">dernier</p>
                                </div>
                              </div>

                              {/* Indicateur sélection */}
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                                isSelected ? 'bg-blue-600 shadow-sm shadow-blue-200' : 'bg-slate-100 group-hover:bg-blue-100'
                              }`}>
                                <ChevronRight className={`h-4 w-4 transition-all duration-200 ${isSelected ? 'text-white rotate-90' : 'text-slate-400 group-hover:text-blue-500'}`} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected patient banner */}
                    {selectedPatient && (
                      <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 shadow-md shadow-blue-200/50">
                        <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 font-bold text-sm text-white shadow-inner"
                            style={{ backgroundColor: AVATAR_COLORS[0] }}>
                            {getInitials(selectedPatient)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white truncate">{getPatientName(selectedPatient)}</p>
                            <p className="text-[11px] font-medium text-blue-200">
                              {getSlicesCount(selectedPatient) ?? '—'} coupes IRM · Prêt pour la segmentation
                            </p>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                </>)}

                {/* ── TAB: Nouveau patient ──────────────────────────────────── */}
                {patientSelectMode === 'new' && (
                  <div className="space-y-5">

                    {/* Bannière anonymat */}
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                        <ShieldCheck className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-800">Patient anonymisé</p>
                        <p className="text-xs text-amber-600 mt-0.5">Aucune donnée nominative n'est enregistrée. L'identification se fait uniquement par numéro de dossier.</p>
                      </div>
                    </div>

                    {/* N° dossier éditable */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        N° dossier <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={npForm.dossier_number}
                          onChange={(e) => npSet('dossier_number', e.target.value)}
                          placeholder="DOS-2026-XXXX"
                          className={`w-full rounded-xl border py-2.5 pl-10 pr-28 font-mono text-sm outline-none transition focus:ring-2 ${npErrors.dossier_number ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20'}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Auto-généré
                        </span>
                      </div>
                      {npErrors.dossier_number && <p className="mt-1 text-[11px] font-semibold text-red-500">{npErrors.dossier_number}</p>}
                    </div>

                    {/* Date de naissance + Sexe */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          Date de naissance <span className="text-red-400">*</span>
                        </label>
                        <input type="date" value={npForm.date_naissance}
                          min={minDob} max={today}
                          onChange={(e) => {
                            const v = e.target.value;
                            npSet('date_naissance', v);
                            if (v > today) {
                              setNpErrors((err) => ({ ...err, date_naissance: 'La date de naissance ne peut pas être dans le futur' }));
                            } else if (v && v < minDob) {
                              setNpErrors((err) => ({ ...err, date_naissance: 'Date invalide (âge maximum : 130 ans)' }));
                            } else {
                              setNpErrors((err) => ({ ...err, date_naissance: '' }));
                            }
                          }}
                          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${npErrors.date_naissance ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20'}`}
                        />
                        {npErrors.date_naissance && <p className="mt-1 text-[11px] font-semibold text-red-500">{npErrors.date_naissance}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          Sexe <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ v: 'M', l: 'Masculin' }, { v: 'F', l: 'Féminin' }].map(({ v, l }) => (
                            <button key={v} type="button" onClick={() => npSet('sexe', v)}
                              className={`rounded-xl border py-2.5 text-sm font-semibold transition ${npForm.sexe === v ? 'border-blue-500 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                        {npErrors.sexe && <p className="mt-1 text-[11px] font-semibold text-red-500">{npErrors.sexe}</p>}
                      </div>
                    </div>

                    {/* Pathologie */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Pathologie <span className="text-red-400">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['Alzheimer', 'Épilepsie', 'Autre', 'Non défini'].map((p) => (
                          <button key={p} type="button" onClick={() => npSet('pathologie', p)}
                            className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${npForm.pathologie === p ? 'border-blue-500 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                      {npErrors.pathologie && <p className="mt-1 text-[11px] font-semibold text-red-500">{npErrors.pathologie}</p>}
                    </div>

                    {/* Zone upload images 2D */}
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Images IRM <span className="font-normal normal-case text-slate-400">(optionnel)</span>
                      </label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setNpDragging(true); }}
                        onDragLeave={() => setNpDragging(false)}
                        onDrop={npHandleFileDrop}
                        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                          npDragging ? 'border-blue-400 bg-blue-50 scale-[1.01]' :
                          npFiles.length > 0 ? 'border-emerald-400 bg-emerald-50' :
                          'border-slate-200 bg-slate-50'}`}>
                        <input ref={npFileRef} type="file" multiple
                          accept=".nii,.nii.gz,.dcm,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
                          className="hidden" onChange={npHandleFileDrop} />
                        <input ref={npFolderRef} type="file"
                          accept=".nii,.nii.gz,.dcm,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
                          className="hidden" onChange={npHandleFileDrop}
                          {...{ webkitdirectory: '', directory: '' }} />

                        {npFiles.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center gap-2 text-emerald-700">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="text-sm font-bold">
                                {npFiles.length} fichier{npFiles.length > 1 ? 's' : ''} sélectionné{npFiles.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="max-h-28 overflow-y-auto rounded-xl border border-emerald-200 bg-white/70 px-3 py-2 text-left">
                              {npFiles.slice(0, 12).map((f, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                                  <p className="truncate text-xs font-medium text-emerald-800">{f.name}</p>
                                  <span className="shrink-0 text-[10px] text-emerald-500">{(f.size / 1024).toFixed(0)} Ko</span>
                                </div>
                              ))}
                              {npFiles.length > 12 && (
                                <p className="mt-1 text-center text-xs italic text-emerald-500">+{npFiles.length - 12} autres fichiers…</p>
                              )}
                            </div>
                            <button type="button" onClick={() => setNpFiles([])}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50">
                              <X className="h-3 w-3" /> Tout effacer
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                              <CloudUpload className="h-7 w-7 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">Sélectionnez vos fichiers ou un dossier complet</p>
                              <p className="mt-0.5 text-xs text-slate-400">Formats supportés : NIfTI, DICOM, JPEG, PNG, TIFF, BMP</p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); npFolderRef.current?.click(); }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-sm">
                                <FolderOpen className="h-4 w-4" />
                                DOSSIER
                              </button>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); npFileRef.current?.click(); }}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                                <FileImage className="h-4 w-4" />
                                FICHIERS
                              </button>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {['.nii', '.nii.gz', '.dcm', '.jpg', '.png', '.tif', '.bmp'].map((ext) => (
                                <span key={ext} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-500">{ext}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges sécurité */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { icon: ShieldCheck, label: 'HIPAA Compliant',    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                        { icon: Zap,         label: 'GPU Accéléré',       cls: 'text-amber-600  bg-amber-50  border-amber-200'  },
                        { icon: ShieldCheck, label: 'Transfert chiffré',  cls: 'text-sky-600    bg-sky-50    border-sky-200'    },
                      ].map(({ icon: Icon, label, cls }) => (
                        <div key={label} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${cls}`}>
                          <Icon className="h-3.5 w-3.5" />{label}
                        </div>
                      ))}
                    </div>

                    {npApiError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{npApiError}</div>
                    )}
                  </div>
                )}
                  </>
                )}

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="mt-4 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-500">Étape <strong>1</strong> sur 3</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => navigate(-1)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                      Annuler
                    </button>
                    {isEmergencySession ? (
                      <button
                        type="button"
                        onClick={submitEmergencyStaging}
                        disabled={npSubmitting || emergencyFiles.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {npSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                        {npSubmitting ? 'Import…' : 'Importer et continuer'}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : patientSelectMode === 'existing' ? (
                      <button type="button" disabled={!selectedPatient} onClick={() => setStep(2)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                        Confirmer le patient
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={npHandleSubmit} disabled={npSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60">
                        {npSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        {npSubmitting ? 'Création…' : 'Créer et continuer'}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">

                {/* ══════════════════════════════════════════════════════════
                    EN-TÊTE ÉTAPE 2 — Redesign unifié
                ══════════════════════════════════════════════════════════ */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">

                  {/* Bande patient — gradient identique à l'étape 1 */}
                  <div className="relative bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-5 py-4">
                    <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                    <span className="absolute right-20 -bottom-4 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
                    <div className="relative flex flex-wrap items-center justify-between gap-4">
                      {/* Identité patient */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-black text-sm shadow-md"
                          style={{ backgroundColor: AVATAR_COLORS[0] }}
                        >
                          {getInitials(selectedPatient || {})}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Patient sélectionné</p>
                          <p className="mt-0.5 truncate text-base font-black text-white">
                            {getPatientName(selectedPatient || {})}
                          </p>
                          {selectedPatient?.dossier_number && (
                            <p className="mt-0.5 text-[11px] font-mono text-blue-300">
                              {selectedPatient.dossier_number}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Stats rapides */}
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white/10 px-4 py-2 text-center">
                          <p className="text-xl font-black text-white">{slices.length}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">coupes</p>
                        </div>
                        {qualitySummary && (
                          <div className="rounded-xl bg-emerald-500/20 px-4 py-2 text-center">
                            <p className="text-xl font-black text-emerald-300">{qualitySummary.recommended}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-200">recommandées</p>
                          </div>
                        )}
                        {qualitySummary && qualitySummary.auto_excluded > 0 && (
                          <div className="rounded-xl bg-amber-400/20 px-4 py-2 text-center">
                            <p className="text-xl font-black text-amber-300">{qualitySummary.auto_excluded}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">exclues</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setStep(1); setSelectedSlices([]); }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          Changer
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Panneau preprocessing qualité */}
                  {qualitySummary && qualitySummary.auto_excluded > 0 && (
                    <div className="border-t border-slate-100 bg-amber-50/60 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Détail catégories */}
                        <div className="flex flex-wrap items-center gap-5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                              <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                            </span>
                            <div>
                              <p className="text-xs font-black text-amber-800">Preprocessing automatique</p>
                              <p className="text-[11px] text-amber-600">
                                {qualitySummary.empty > 0 && <span className="mr-2"><strong>{qualitySummary.empty}</strong> noires</span>}
                                {qualitySummary.low_content > 0 && <span><strong>{qualitySummary.low_content}</strong> à faible contenu</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            </span>
                            <div>
                              <p className="text-xs font-black text-emerald-800">{qualitySummary.recommended} pré-sélectionnées</p>
                              <p className="text-[11px] text-emerald-600">Coupes avec tissu cérébral exploitable</p>
                            </div>
                          </div>
                        </div>
                        {/* Actions rapides dans la bannière */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const rec = slices.filter((s) => sliceQuality[String(s.id)]?.recommended !== false).map((s) => s.id).filter(Boolean);
                              setSelectedSlices(rec);
                            }}
                            className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-700 shadow-sm transition hover:bg-amber-50"
                          >
                            Recommandées ({qualitySummary.recommended})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSlices(slices.map((s) => s.id).filter(Boolean))}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
                          >
                            Tout inclure ({qualitySummary.total})
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Barre de sélection active */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* Compteur principal */}
                      <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 ${selectedSlices.length === 0 ? 'border-slate-200 bg-slate-50' : 'border-blue-100 bg-blue-50'}`}>
                        <CheckCircle2 className={`h-4 w-4 ${selectedSlices.length === 0 ? 'text-slate-400' : 'text-blue-600'}`} />
                        <span className={`text-sm font-black ${selectedSlices.length === 0 ? 'text-slate-500' : 'text-blue-800'}`}>{selectedSlices.length}</span>
                        <span className="text-xs font-medium text-slate-400">/ {slices.length} coupes cochées</span>
                      </div>
                      {/* Barre de progression visuelle */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${slices.length > 0 ? Math.round((selectedSlices.length / slices.length) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums text-slate-500">
                          {slices.length > 0 ? Math.round((selectedSlices.length / slices.length) * 100) : 0}%
                        </span>
                      </div>
                      {selectedSlices.length === 0 && (
                        <span className="hidden sm:block text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                          Cochez au moins une coupe pour continuer
                        </span>
                      )}
                      {selectedSlices.length > 0 && qualitySummary && selectedSlices.length > qualitySummary.recommended && (
                        <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          {selectedSlices.length - qualitySummary.recommended} coupe{selectedSlices.length - qualitySummary.recommended > 1 ? 's' : ''} hors recommandation incluse{selectedSlices.length - qualitySummary.recommended > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Boutons sélection */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const hasQuality = Object.keys(sliceQuality).length > 0;
                          if (hasQuality) {
                            const rec = slices.filter((s) => sliceQuality[String(s.id)]?.recommended !== false).map((s) => s.id).filter(Boolean);
                            setSelectedSlices(rec);
                          } else {
                            setSelectedSlices(slices.map((s) => s.id).filter(Boolean));
                          }
                        }}
                        disabled={slicesLoading || slices.length === 0}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        {Object.keys(sliceQuality).length > 0 ? '✓ Recommandées' : 'Tout sélectionner'}
                      </button>
                      {Object.keys(sliceQuality).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlices(slices.map((s) => s.id).filter(Boolean))}
                          disabled={slicesLoading}
                          className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Tout inclure
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedSlices([])}
                        disabled={slicesLoading || selectedSlices.length === 0}
                        className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Désélectionner
                      </button>
                    </div>
                  </div>
                </div>
                {/* ══ Fin en-tête ═══════════════════════════════════════════ */}

                {!slicesLoading && !slicesError && slices.length > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/30 px-5 py-4 shadow-sm">

                    {/* En-tête */}
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                        <Hash className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Sélection par plage de coupes</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Sélectionnez rapidement un groupe de coupes consécutives sans avoir à cliquer sur chaque image.
                          Les numéros correspondent aux numéros affichés sur les vignettes ci-dessous.
                        </p>
                      </div>
                    </div>

                    {/* Saisie des bornes + compteur live */}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coupe de départ</span>
                        <input
                          type="number" min={1} max={slices.length} inputMode="numeric"
                          value={sliceRangeFrom} placeholder="1"
                          onChange={(e) => { setSliceRangeFrom(e.target.value); setSliceRangeFeedback(null); }}
                          className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tabular-nums text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="flex items-end pb-0.5 text-slate-400 font-bold text-lg">→</div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coupe de fin</span>
                        <input
                          type="number" min={1} max={slices.length} inputMode="numeric"
                          value={sliceRangeTo} placeholder={String(slices.length)}
                          onChange={(e) => { setSliceRangeTo(e.target.value); setSliceRangeFeedback(null); }}
                          className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tabular-nums text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      {(() => {
                        const f = parseInt(String(sliceRangeFrom).trim(), 10);
                        const t = parseInt(String(sliceRangeTo).trim(), 10);
                        const count = (!isNaN(f) && !isNaN(t) && t >= f && f >= 1 && t <= slices.length) ? t - f + 1 : null;
                        return count !== null ? (
                          <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-sm">
                            <span className="text-base font-black text-blue-700">{count}</span>
                            <span className="text-xs font-medium text-blue-500">coupe{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Boutons d'action */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applySliceRange('replace')}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Remplacer la sélection
                      </button>
                      <button
                        type="button"
                        onClick={() => applySliceRange('add')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <span className="text-base leading-none">+</span>
                        Ajouter à la sélection
                      </button>
                    </div>

                    {/* Explication des deux modes */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-blue-100 bg-white/80 px-3 py-2.5">
                        <p className="text-[11px] font-bold text-blue-700">Remplacer la sélection</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Efface toutes les coupes actuellement cochées et sélectionne uniquement les coupes de cette plage. À utiliser quand vous voulez repartir de zéro.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5">
                        <p className="text-[11px] font-bold text-slate-700">Ajouter à la sélection</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Conserve les coupes déjà cochées et y ajoute les coupes de cette nouvelle plage. Pratique pour combiner plusieurs intervalles.
                        </p>
                      </div>
                    </div>

                    {sliceRangeFeedback && (
                      <p
                        role="status"
                        className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${sliceRangeFeedback.ok ? 'text-emerald-700' : 'text-amber-700'}`}
                      >
                        <span>{sliceRangeFeedback.ok ? '✓' : '⚠'}</span>
                        {sliceRangeFeedback.text}
                      </p>
                    )}
                  </div>
                )}

                {slicesLoading && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={`skeleton-${index}`} className="overflow-hidden rounded-lg border border-surface-border bg-white">
                        <div className="aspect-square animate-pulse bg-gray-200" />
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-14 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!slicesLoading && slicesError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-red-700">Impossible de charger les coupes</p>
                    <button
                      type="button"
                      onClick={fetchPatientSlices}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                    >
                      Réessayer
                    </button>
                  </div>
                )}

                {!slicesLoading && !slicesError && slices.length === 0 && (
                  <div className="rounded-lg border border-blue-100 bg-white px-6 py-10 text-center">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5c-4.5 0-8 2.6-9.5 6.5C4 15.4 7.5 18 12 18s8-2.6 9.5-6.5C20 7.6 16.5 5 12 5Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-800">Aucune coupe IRM trouvée pour ce patient.</p>
                    <p className="mt-1 text-sm text-slate-600">Veuillez d'abord uploader un dossier IRM dans la fiche patient.</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${selectedPatient?.id}`)}
                      className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                    >
                      Aller à la fiche patient
                    </button>
                  </div>
                )}

                {!slicesLoading && !slicesError && slices.length > 0 && (
                  <div className="space-y-3">
                    <GmailStylePagination
                      page={slicesListPage}
                      pageSize={LIST_PAGE_SIZE}
                      total={slices.length}
                      onPrev={() => setSlicesListPage((p) => Math.max(0, p - 1))}
                      onNext={() => setSlicesListPage((p) => Math.min(slicesLastPage, p + 1))}
                      showPageJump
                      onJumpToPage={(p) => setSlicesListPage(Math.max(0, Math.min(slicesLastPage, p)))}
                    />
                    {slicesLastPage > 0 ? (
                      <p className="text-[11px] text-slate-400">
                        Utilisez « Aller à la page » pour naviguer directement vers un groupe de coupes.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {paginatedSlices.map((slice, index) => {
                      const globalSliceIndex = slicesListPage * LIST_PAGE_SIZE + index;
                      const sliceId = slice?.id;
                      const isSelected = selectedSlices.includes(sliceId);
                      const imageBroken = Boolean(imageErrors[sliceId]);
                      const imageSrc = resolveSliceUrl(slice);
                      const rankInSeries = globalSliceIndex + 1;
                      const coupeXY = formatCoupeXY(rankInSeries, slices.length);
                      const filename = getSliceName(slice, globalSliceIndex, slices.length);

                      // Quality data for this slice
                      const q = sliceQuality[String(sliceId)] || null;
                      const isEmpty     = q?.is_empty === true;
                      const isLowContent = !isEmpty && q?.is_low_content === true;
                      const isExcluded  = isEmpty || isLowContent;

                      return (
                        <button
                          key={sliceId || `slice-${index}`}
                          type="button"
                          onClick={() => {
                            toggleSlice(sliceId);
                            setWorkflowSliceRank(globalSliceIndex + 1);
                          }}
                          className={`relative flex flex-col overflow-hidden rounded-lg border text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-[1.5px] border-[#2563eb] bg-white'
                              : isExcluded
                                ? 'border-slate-200 bg-slate-50/60 opacity-60 hover:opacity-90 hover:border-slate-300'
                                : 'border-surface-border bg-white hover:border-blue-200'
                          }`}
                        >
                          {isSelected && <div className="absolute inset-x-0 top-0 z-[1] h-8 bg-[#2563eb]/10" />}

                          {/* Numéro de coupe — badge proéminent en haut au centre */}
                          <div className={`absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums shadow backdrop-blur-sm whitespace-nowrap ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900/75 text-white'
                          }`}>
                            {rankInSeries} / {slices.length}
                          </div>

                          {/* Quality badge — en bas à gauche pour ne pas masquer le numéro */}
                          {isEmpty && (
                            <div className="absolute left-2 bottom-10 z-20 flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-200 backdrop-blur-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Vide
                            </div>
                          )}
                          {isLowContent && (
                            <div className="absolute left-2 bottom-10 z-20 flex items-center gap-1 rounded-full bg-amber-800/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                              Faible
                            </div>
                          )}
                          <span
                            className={`absolute right-2 top-2 z-20 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm ${
                              isSelected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>

                          <div className="relative aspect-square w-full min-h-0 flex-1 bg-slate-900/95">
                            {!imageBroken && imageSrc ? (
                              <img
                                src={imageSrc}
                                alt={coupeXY}
                                loading="lazy"
                                className="h-full w-full object-contain"
                                onError={() => setImageErrors((prev) => ({ ...prev, [sliceId]: true }))}
                              />
                            ) : (
                              <div className="flex h-full min-h-[8rem] w-full items-center justify-center text-slate-400">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M12 5c-4.5 0-8 2.6-9.5 6.5C4 15.4 7.5 18 12 18s8-2.6 9.5-6.5C20 7.6 16.5 5 12 5Z" stroke="currentColor" strokeWidth="1.6" />
                                  <circle cx="12" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                                </svg>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSliceMetaModal({ slice, globalSliceIndex });
                              }}
                              className="absolute left-2 bottom-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/95 text-blue-700 shadow-md backdrop-blur-sm transition hover:bg-white hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              title="Détails techniques de la coupe"
                              aria-label={`Détails techniques — ${coupeXY}`}
                            >
                              <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
                            <p className="min-w-0 flex-1 truncate text-[10px] text-slate-400" title={filename}>
                              {filename || '—'}
                            </p>
                            {q?.score != null && (
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                isExcluded ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {Math.round(q.score * 100)}%
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-surface-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      <span className="text-blue-700 font-black">{selectedSlices.length}</span>
                      <span className="text-slate-400"> / {slices.length}</span> coupes sélectionnées pour l'analyse
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">Étape 2 sur 3 · Confirmez votre sélection pour lancer le modèle IA</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-blue-50/50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchConfirmOpen(true)}
                      disabled={selectedSlices.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 border border-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Lancer la segmentation (Modèle 1)
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {sliceMetaModal ? (
                  <SliceMetaModalDialog
                    slice={sliceMetaModal.slice}
                    coupeXY={formatCoupeXY(sliceMetaModal.globalSliceIndex + 1, slices.length)}
                    seriesTotal={slices.length}
                    onClose={() => setSliceMetaModal(null)}
                  />
                ) : null}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                {showResults && (
                  <div className="space-y-3">
                    {/* ── Header gradient résultats ── */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                      <div className="relative bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-6 py-5">
                        <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                        <div className="relative flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 shadow-inner">
                              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Étape 3 / 3 · Terminée</p>
                              <p className="mt-0.5 text-base font-black text-white">Résultats de segmentation</p>
                              <p className="mt-0.5 text-[11px] text-blue-300">
                                {getPatientName(selectedPatient || {})}
                                {selectedPatient?.dossier_number ? ` · ${selectedPatient.dossier_number}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                              <p className="text-lg font-black text-white">{persistedResults.length}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">coupes</p>
                            </div>
                            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                              <p className="text-sm font-black text-white">{runSummary?.model_version || modelKeyToDisplayName(runSummary?.model_key) || 'Modèle 1'}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">modèle</p>
                            </div>
                            {Number.isFinite(currentRunId) && currentRunId > 0 && (
                              <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                                <p className="text-sm font-black font-mono text-white">#{currentRunId}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">run</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Barre d'actions principale */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3">
                        <p className="text-xs text-slate-500">
                          Examinez chaque coupe, puis validez la segmentation pour continuer vers la modélisation 3D.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowResults(false);
                              setStep(2);
                              setProgress(0);
                              setLaunchError('');
                              launchTriggeredRef.current = false;
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Modifier les coupes
                          </button>
                          <button
                            type="button"
                            onClick={() => setValidateConfirmOpen(true)}
                            disabled={
                              !Number.isFinite(effectiveRunId) ||
                              effectiveRunId <= 0 ||
                              (reviewStats.total > 0 && reviewStats.rejected === reviewStats.total)
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Valider la segmentation
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Section : Relancer toutes les coupes avec un autre modèle ── */}
                    {!resultsLoading && persistedResults.length > 0 && (
                      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-indigo-50/40 px-5 py-4">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                            <RotateCcw className="h-4 w-4 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Pas satisfait du résultat global ?</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Relancez la segmentation sur toutes les coupes sélectionnées avec un modèle différent. Chaque modèle utilise une architecture distincte — les résultats peuvent varier sur des cas difficiles.
                            </p>
                          </div>
                        </div>
                        {/* Guide des modèles */}
                        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {[
                            {
                              key: 'unetpp', label: 'Modèle 1', sublabel: 'U-Net++',
                              color: 'border-slate-200 bg-white',
                              badge: 'bg-slate-100 text-slate-600',
                              desc: 'Modèle par défaut. Rapide et fiable, recommandé pour la majorité des cas courants.',
                              tag: 'Par défaut',
                            },
                            {
                              key: 'nnunet', label: 'Modèle 2', sublabel: 'nnU-Net',
                              color: 'border-indigo-100 bg-indigo-50/50',
                              badge: 'bg-indigo-100 text-indigo-700',
                              desc: 'Référence en segmentation médicale automatique. Plus robuste sur les anatomies atypiques.',
                              tag: 'Robuste',
                            },
                            {
                              key: 'swinunetr', label: 'Modèle 3', sublabel: 'Swin-UNETR',
                              color: 'border-violet-100 bg-violet-50/50',
                              badge: 'bg-violet-100 text-violet-700',
                              desc: 'Architecture Transformer. Optimisé pour les structures complexes et les petits volumes.',
                              tag: 'Avancé',
                            },
                          ].map((m) => (
                            <div key={m.key} className={`rounded-xl border px-3 py-2.5 ${m.color}`}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div>
                                  <span className="text-sm font-black text-slate-800">{m.label}</span>
                                  <span className="ml-1.5 text-[11px] text-slate-500">· {m.sublabel}</span>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.badge}`}>{m.tag}</span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-500">{m.desc}</p>
                              <button
                                type="button"
                                disabled={String(runSummary?.model_key || 'unetpp').toLowerCase() === m.key}
                                onClick={() => {
                                  setSelectedModel(m.key);
                                  launchTriggeredRef.current = false;
                                  setIsLaunching(false);
                                  setLaunchError('');
                                  setLaunchResult(null);
                                  setShowResults(false);
                                  setResultsError('');
                                  setPersistedResults([]);
                                  setRunSummary(null);
                                  setProgress(5);
                                }}
                                className={`mt-2.5 w-full rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                  String(runSummary?.model_key || 'unetpp').toLowerCase() === m.key
                                    ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                    : 'border border-violet-200 bg-violet-600 text-white hover:bg-violet-700'
                                }`}
                              >
                                {String(runSummary?.model_key || 'unetpp').toLowerCase() === m.key
                                  ? 'Modèle actuel'
                                  : `Relancer avec ${m.label}`}
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          La relance conserve la même sélection de coupes ({selectedSlices.length} coupe{selectedSlices.length > 1 ? 's' : ''}). Les résultats précédents ne sont pas supprimés — vous pouvez comparer les modèles coupe par coupe.
                        </p>
                      </div>
                    )}

                    {resultsLoading && (
                      <div className="h-40 flex items-center justify-center">
                        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                      </div>
                    )}

                    {!resultsLoading && resultsError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-700">{resultsError}</p>
                      </div>
                    )}

                    {!resultsLoading && !resultsError && persistedResults.length === 0 && (
                      <div className="rounded-lg border border-surface-border bg-white p-4 text-sm text-gray-600">
                        Aucun résultat disponible pour ce lancement.
                      </div>
                    )}

                    {!resultsLoading && !resultsError && persistedResults.length > 0 && (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Informations sur le lancement
                            </p>
                            <IconHelpTooltip
                              helpText={LAUNCH_SUMMARY_HELP_TEXT}
                              ariaLabel="Détails structure cible et volume 3D"
                            />
                          </div>
                          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-6">
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Patient</dt>
                              <dd className="truncate text-[13px] font-medium text-slate-900" title={getPatientName(selectedPatient || {})}>
                                {getPatientName(selectedPatient || {})}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Modèle</dt>
                              <dd className="truncate text-[13px] font-medium text-slate-900">
                                {runSummary?.model_version || modelKeyToDisplayName(runSummary?.model_key) || 'Modèle 1'}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Seuil</dt>
                              <dd className="font-mono text-[13px] text-slate-900">{runSummary?.threshold != null ? String(runSummary.threshold) : '—'}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Coupes traitées</dt>
                              <dd className="text-[13px] font-medium text-slate-900">
                                {persistedResults.length}
                                {runSummary?.selected_count != null ? ` (${runSummary.selected_count} sélect.)` : ''}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Run</dt>
                              <dd className="font-mono text-[12px] text-slate-900">
                                #{Number.isFinite(currentRunId) && currentRunId > 0 ? currentRunId : runSummary?.run_id ?? '—'}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] text-slate-500">Horodatage</dt>
                              <dd className="text-[12px] text-slate-900">{formatDateTimeShort(runSummary?.completed_at || runSummary?.created_at)}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="flex flex-col items-end gap-2 pt-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="text-[12px] font-medium text-slate-600">Plage à afficher</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              aria-label="Coupe début ou plage 5-18"
                              value={resultsViewRangeFromInput}
                              onChange={(e) => {
                                setResultsViewRangeFromInput(e.target.value);
                                setResultsViewRangeMessage('');
                              }}
                              placeholder="5 ou 5-18"
                              className="w-[5.25rem] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-slate-400" aria-hidden>
                              —
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, slices.length || persistedResults.length)}
                              aria-label="Coupe fin"
                              value={resultsViewRangeToInput}
                              onChange={(e) => {
                                setResultsViewRangeToInput(e.target.value);
                                setResultsViewRangeMessage('');
                              }}
                              placeholder="18"
                              title="Laisser vide si vous avez saisi une plage du type 5-18 dans le premier champ"
                              className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <button
                              type="button"
                              onClick={applyResultsViewRange}
                              className="rounded-lg bg-slate-800 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-slate-900"
                            >
                              Afficher
                            </button>
                            {resultsViewRange ? (
                              <button
                                type="button"
                                onClick={clearResultsViewRange}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Tout le run
                              </button>
                            ) : null}
                          </div>
                          <div className="flex shrink-0">
                            <GmailStylePagination
                              page={resultsListPage}
                              pageSize={LIST_PAGE_SIZE}
                              total={persistedResultsFiltered.length}
                              onPrev={() => setResultsListPage((p) => Math.max(0, p - 1))}
                              onNext={() => setResultsListPage((p) => Math.min(resultsLastPage, p + 1))}
                            />
                          </div>
                          {resultsViewRangeMessage ? (
                            <p className="w-full text-right text-[11px] text-slate-600" role="status">
                              {resultsViewRangeMessage}
                            </p>
                          ) : null}
                        </div>

                        {paginatedResults.map((row, idx) => {
                          const globalIdx = resultsListPage * LIST_PAGE_SIZE + idx;
                          const sourceSrc = toAbsoluteMediaUrl(row?.source_url || row?.source_file);
                          const maskSrc = toAbsoluteMediaUrl(row?.mask_url || row?.mask_file);
                          const initialMaskSrc = toAbsoluteMediaUrl(row?.initial_mask_url || row?.initial_mask_file);
                          const priorMaskSrc = toAbsoluteMediaUrl(row?.prior_mask_url || row?.prior_mask_file);
                          const hasRelaunchComparison = Boolean(priorMaskSrc && maskSrc);
                          const curSegKey = normalizeSegModelKey(row, runSummary?.model_key);
                          const m1RefSrc = m1ReferenceMaskSrc(row, initialMaskSrc, priorMaskSrc, maskSrc);
                          const isM3Current = curSegKey === 'swinunetr';
                          const priorSegKey = String(row?.prior_mask_model_key || '').toLowerCase();
                          const showM2ThenM3Stack =
                            hasRelaunchComparison && isM3Current && priorSegKey === 'nnunet';
                          const isArchiveAfterRestore = curSegKey === 'unetpp' && hasRelaunchComparison;
                          const fileId = row?.mri_file ?? row?.file_id;
                          const idxInSlices = slices.findIndex((s) => s?.id === fileId);
                          let sliceRank =
                            idxInSlices >= 0
                              ? idxInSlices + 1
                              : Number(row?.slice_index ?? row?.index ?? globalIdx + 1);
                          if (!Number.isFinite(sliceRank) || sliceRank < 1) sliceRank = globalIdx + 1;
                          const sliceTotalForLabel =
                            slices.length > 0 ? slices.length : Math.max(1, persistedResults.length);
                          const coupeLabel = formatCoupeXY(sliceRank, sliceTotalForLabel);
                          const maskId = row?.id;
                          const review = String(row?.review_status || 'pending').toLowerCase();
                          const badge = reviewStatusBadge(review);
                          const modelLabel = effectiveMaskModelLabel(row, runSummary?.model_version);
                          const busyRow =
                            Boolean(maskActionBusy[maskId]) ||
                            Boolean(maskActionBusy[`reseg-${fileId}`]);
                          const canActions = effectiveRunId > 0 && maskId != null && fileId != null;
                          /** M2 et M3 déjà lancés pour cette coupe : les deux blocs sont visibles → ne pas relancer. */
                          const bothAltModelsShownForSlice = showM2ThenM3Stack;
                          /** Modèle dont les pixels servent de référence en tête de carte (`initial_mask_model_key`). */
                          const refModelKey = String(row?.initial_mask_model_key || 'unetpp').toLowerCase() || 'unetpp';
                          const relaunchM2Disabled =
                            busyRow ||
                            curSegKey === 'nnunet' ||
                            bothAltModelsShownForSlice ||
                            refModelKey === 'nnunet';
                          const relaunchM3Disabled =
                            busyRow ||
                            curSegKey === 'swinunetr' ||
                            bothAltModelsShownForSlice ||
                            refModelKey === 'swinunetr';
                          const relaunchM1Unlocked =
                            refModelKey === 'nnunet' ||
                            refModelKey === 'swinunetr' ||
                            curSegKey !== 'unetpp';
                          const relaunchM1Disabled =
                            busyRow ||
                            curSegKey === 'unetpp' ||
                            bothAltModelsShownForSlice ||
                            !relaunchM1Unlocked;
                          const { extended: segCompareExtended, rows: segCompareRows } =
                            buildSegmentationCompareRows({
                              row,
                              m1RefSrc,
                              maskSrc,
                              priorMaskSrc,
                              curSegKey,
                              modelLabel,
                              showM2ThenM3Stack,
                              isArchiveAfterRestore,
                              hasRelaunchComparison,
                              refModelKey,
                            });
                          const selectedFinalKey = finalModelSelection[maskId];
                          const hasAdoptableCompareOption = segCompareRows.some((cr) =>
                            canShowAdoptReferenceButton(row, cr.modelKey),
                          );
                          return (
                            <div key={row?.id || `${fileId || 'slice'}-${globalIdx}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-black text-white tabular-nums">
                                    {coupeLabel}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {modelLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-right text-xs text-gray-500">
                                  <p className="font-mono text-[10px] text-slate-500 truncate max-w-[12rem]" title={row?.source_filename}>{row?.source_filename || 'fichier IRM'}</p>
                                </div>
                              </div>
                              <div className="border-t border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                Référence — {referenceMaskLabel(row)}
                              </div>
                              {!segCompareExtended ? (
                                <div className="grid grid-cols-1 gap-0 border-t border-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-slate-200">
                                  <div className="bg-black">
                                    <p className="bg-slate-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Image originale
                                    </p>
                                    <div className="overflow-hidden bg-black">
                                      {sourceSrc ? (
                                        <img src={sourceSrc} alt={`source-${coupeLabel}`} className={RESULT_VIEW_IMG} loading="lazy" />
                                      ) : (
                                        <div className="flex min-h-[13rem] items-center justify-center text-sm text-slate-500">
                                          Image source indisponible
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-black">
                                    <p className="bg-slate-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Masque (référence)
                                    </p>
                                    <div className="overflow-hidden bg-black">
                                      {m1RefSrc ? (
                                        <img src={m1RefSrc} alt={`masque-ref-${coupeLabel}`} className={RESULT_VIEW_IMG} loading="lazy" />
                                      ) : (
                                        <div className="flex min-h-[13rem] items-center justify-center text-sm text-slate-500">
                                          Masque indisponible
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-black">
                                    <p className="bg-slate-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Overlay
                                    </p>
                                    {m1RefSrc ? (
                                      <HippocampusOverlayPreview
                                        sourceSrc={sourceSrc}
                                        maskSrc={m1RefSrc}
                                        alt={coupeLabel}
                                        overlayRgb={HIPPO_OVERLAY_RGB}
                                      />
                                    ) : (
                                      <div className="flex min-h-[13rem] items-center justify-center text-sm text-slate-500">
                                        Overlay indisponible
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex flex-col border-t border-slate-200 lg:flex-row lg:items-stretch">
                                    <div className="border-b border-slate-200 bg-black lg:w-[min(42%,26rem)] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-slate-200">
                                      <p className="bg-slate-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                        Image originale
                                      </p>
                                      <div className="flex min-h-[12rem] items-stretch overflow-hidden bg-black lg:min-h-[min(52vh,30rem)]">
                                        {sourceSrc ? (
                                          <img
                                            src={sourceSrc}
                                            alt={`source-${coupeLabel}`}
                                            className="mx-auto w-full max-h-[min(60vh,36rem)] min-h-[12rem] object-contain"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="flex min-h-[13rem] flex-1 items-center justify-center text-sm text-slate-500">
                                            Image source indisponible
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1 bg-slate-950">
                                      <div className="border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                                        Masques et overlays par modèle
                                      </div>
                                      <div className="divide-y divide-slate-800">
                                        {segCompareRows.map((cr, ri) => {
                                          const adoptable = canShowAdoptReferenceButton(row, cr.modelKey);
                                          const isRefRow =
                                            String(cr.modelKey).toLowerCase() === refModelKey;
                                          const rowGroup = `seg-final-${maskId ?? globalIdx}`;
                                          const rowId = `${rowGroup}-${cr.modelKey}-${ri}`;
                                          return (
                                            <div
                                              key={rowId}
                                              className="grid grid-cols-1 bg-black sm:grid-cols-[1fr_1fr_auto] sm:divide-x sm:divide-slate-800"
                                            >
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 bg-slate-950 px-2 py-1.5 sm:px-3">
                                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                    Masque · {cr.label}
                                                  </p>
                                                  <p className="text-[10px] text-slate-500">{cr.subtitle}</p>
                                                </div>
                                                <div className="overflow-hidden bg-black px-1 pb-2 pt-1 sm:px-2">
                                                  {cr.maskSrc ? (
                                                    <img
                                                      src={cr.maskSrc}
                                                      alt={`masque-${cr.modelKey}-${coupeLabel}`}
                                                      className={RESULT_VIEW_COMPARE_ROW_IMG}
                                                      loading="lazy"
                                                    />
                                                  ) : (
                                                    <div className="flex min-h-[10rem] items-center justify-center text-xs text-slate-500">
                                                      Masque indisponible
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="min-w-0 border-t border-slate-800 sm:border-t-0">
                                                <p className="bg-slate-950 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:px-3">
                                                  Overlay · {cr.label}
                                                </p>
                                                <div className="overflow-hidden bg-black px-1 pb-2 pt-1 sm:px-2">
                                                  {cr.maskSrc ? (
                                                    <HippocampusOverlayPreview
                                                      sourceSrc={sourceSrc}
                                                      maskSrc={cr.maskSrc}
                                                      alt={`${coupeLabel}-${cr.modelKey}`}
                                                      overlayRgb={overlayRgbForCompareModelKey(cr.modelKey)}
                                                    />
                                                  ) : (
                                                    <div className="flex min-h-[10rem] items-center justify-center text-xs text-slate-500">
                                                      Overlay indisponible
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex flex-col justify-center border-t border-slate-800 bg-slate-900 px-3 py-3 sm:w-[9.5rem] sm:border-t-0 sm:border-l sm:border-slate-800">
                                                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                                  Conserver
                                                </p>
                                                {adoptable ? (
                                                  <label
                                                    htmlFor={rowId}
                                                    className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-[11px] text-slate-200 hover:border-slate-500"
                                                  >
                                                    <input
                                                      id={rowId}
                                                      type="radio"
                                                      name={rowGroup}
                                                      className="mt-0.5 h-4 w-4 shrink-0 accent-teal-500"
                                                      checked={selectedFinalKey === cr.modelKey}
                                                      disabled={busyRow}
                                                      onChange={() =>
                                                        setFinalModelSelection((prev) => ({
                                                          ...prev,
                                                          [maskId]: cr.modelKey,
                                                        }))
                                                      }
                                                    />
                                                    <span>
                                                      <span className="font-semibold text-slate-100">{cr.label}</span>
                                                      <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                                                        Adopter comme référence
                                                      </span>
                                                    </span>
                                                  </label>
                                                ) : isRefRow ? (
                                                  <p className="mt-2 text-[11px] leading-snug text-slate-400">
                                                    Déjà la référence affichée en tête de carte.
                                                  </p>
                                                ) : (
                                                  <p className="mt-2 text-[11px] text-slate-500">—</p>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {hasAdoptableCompareOption ? (
                                        <div className="border-t border-slate-800 bg-slate-900 px-3 py-2.5">
                                          <p className="text-[11px] leading-snug text-slate-400">
                                            Sélectionnez un modèle dans la colonne «&nbsp;Conserver&nbsp;», puis confirmez. Une boîte
                                            de dialogue récapitule l&apos;adoption du masque de référence.
                                          </p>
                                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                            <button
                                              type="button"
                                              disabled={
                                                busyRow ||
                                                !selectedFinalKey ||
                                                !canShowAdoptReferenceButton(row, selectedFinalKey)
                                              }
                                              onClick={() =>
                                                setAdoptConfirm({
                                                  maskId,
                                                  runId: effectiveRunId,
                                                  modelKey: selectedFinalKey,
                                                  label: modelKeyToDisplayName(selectedFinalKey),
                                                })
                                              }
                                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                                              Valider le choix du modèle
                                            </button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  {showM2ThenM3Stack ? (
                                    <details className="group border-t border-slate-200 bg-slate-50">
                                      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-slate-700 marker:content-none hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                                        <span className="inline-flex items-center gap-2">
                                          <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 group-open:border-teal-600 group-open:text-teal-800">
                                            Analyse avancée
                                          </span>
                                          Heatmaps M1 vs M2 et M1 vs M3
                                        </span>
                                      </summary>
                                      <div className="border-t border-slate-200">
                                        <div className="bg-gradient-to-r from-amber-950/95 via-slate-900 to-violet-950/95">
                                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-100">
                                            Modèles 2 et 3 — masque + heatmap (4 vues sur grand écran)
                                          </div>
                                          <div className="grid grid-cols-2 divide-x divide-y divide-slate-700 border-t border-slate-700 bg-black xl:grid-cols-4 xl:divide-y-0">
                                            <RelaunchComparisonPairColumns
                                              coupeLabel={coupeLabel}
                                              maskColumnTitle="Masque · M2 (conservé)"
                                              binaryMaskSrc={priorMaskSrc}
                                              m1FusionSrc={m1RefSrc}
                                              m2FusionSrc={priorMaskSrc}
                                              secondModelKey="nnunet"
                                              fusionColumnTitle="Heatmap M1 + M2"
                                              fusionAlt={`${coupeLabel} heatmap M1 et Modèle 2`}
                                              compact
                                            />
                                            <RelaunchComparisonPairColumns
                                              coupeLabel={coupeLabel}
                                              maskColumnTitle={`Masque · ${modelLabel}`}
                                              binaryMaskSrc={maskSrc}
                                              m1FusionSrc={m1RefSrc}
                                              m2FusionSrc={maskSrc}
                                              secondModelKey="swinunetr"
                                              fusionColumnTitle="Heatmap M1 + M3"
                                              fusionAlt={`${coupeLabel} heatmap M1 et Modèle 3`}
                                              compact
                                            />
                                          </div>
                                        </div>
                                        <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
                                          Grille 2×2 sur mobile ; une rangée de 4 panneaux en largeur xl. Modes&nbsp;: Jet, masques seuls,
                                          Union.
                                        </p>
                                      </div>
                                    </details>
                                  ) : hasRelaunchComparison ? (
                                    <details className="group border-t border-slate-200 bg-slate-50">
                                      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-slate-700 marker:content-none hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                                        <span className="inline-flex items-center gap-2">
                                          <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 group-open:border-teal-600 group-open:text-teal-800">
                                            Analyse avancée
                                          </span>
                                          Heatmap et masque fusion (compact)
                                        </span>
                                      </summary>
                                      <div className="border-t border-slate-200">
                                        <div className="border-t-2 border-indigo-900 bg-indigo-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-100">
                                          {isArchiveAfterRestore
                                            ? 'Archivé — état antérieur (référence M1 inchangée)'
                                            : `Après lancement — ${modelLabel}`}
                                          {row?.prior_mask_model_version || row?.prior_mask_model_key ? (
                                            <span className="ml-2 font-normal normal-case text-indigo-200/90">
                                              · masque archivé : {priorMaskTraceLabel(row)}
                                            </span>
                                          ) : null}
                                        </div>
                                        <RelaunchResultTriptych
                                          coupeLabel={coupeLabel}
                                          binaryMaskSrc={isArchiveAfterRestore ? priorMaskSrc : maskSrc}
                                          m1FusionSrc={m1RefSrc}
                                          m2FusionSrc={isArchiveAfterRestore ? priorMaskSrc : maskSrc}
                                          secondModelKey={
                                            isArchiveAfterRestore
                                              ? String(row?.prior_mask_model_key || 'nnunet').toLowerCase()
                                              : curSegKey
                                          }
                                          fusionColumnTitle={
                                            String(
                                              isArchiveAfterRestore ? row?.prior_mask_model_key : curSegKey,
                                            ).toLowerCase() === 'swinunetr'
                                              ? 'Heatmap M1 + M3'
                                              : 'Heatmap M1 + M2'
                                          }
                                          fusionAlt={`${coupeLabel} heatmap M1 et masque courant`}
                                          compact
                                          maskColumnTitle={
                                            isArchiveAfterRestore
                                              ? `Masque · ${priorMaskTraceLabel(row)}`
                                              : `Masque · ${modelLabel}`
                                          }
                                        />
                                        <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
                                          Vue compacte. Jet / référence ou second masque seul / Union.
                                        </p>
                                      </div>
                                    </details>
                                  ) : null}
                                </>
                              )}
                              {canActions ? (
                              <div className="border-t border-slate-200 bg-slate-50/95 px-4 py-3">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-slate-200/80 bg-white p-1 shadow-sm">
                                      <button
                                        type="button"
                                        disabled={busyRow || review === 'validated'}
                                        onClick={() => patchMaskReview(effectiveRunId, maskId, 'validated')}
                                        className="inline-flex h-9 min-w-[8.5rem] items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white shadow-sm ring-1 ring-emerald-800/30 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Valider cette coupe
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyRow || review === 'rejected'}
                                        onClick={() => patchMaskReview(effectiveRunId, maskId, 'rejected')}
                                        className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-md border border-red-400 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Rejeter
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-slate-200/80 bg-white p-1 shadow-sm">
                                      <button
                                        type="button"
                                        disabled={relaunchM1Disabled}
                                        onClick={() => resegmentSliceWithModel(effectiveRunId, fileId, 'unetpp')}
                                        title={
                                          bothAltModelsShownForSlice
                                            ? 'Modèles 2 et 3 : résultats déjà affichés pour cette coupe'
                                            : !relaunchM1Unlocked
                                              ? 'Recalcul Modèle 1 : lancez M2 ou M3, ou attendez un masque courant différent du Modèle 1'
                                              : curSegKey === 'unetpp'
                                                ? 'Le masque courant provient déjà du Modèle 1'
                                                : 'Relancer la segmentation avec le Modèle 1 (comme M2/M3)'
                                        }
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-slate-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Lancer Modèle 1
                                      </button>
                                      <button
                                        type="button"
                                        disabled={relaunchM2Disabled}
                                        onClick={() => resegmentSliceWithModel(effectiveRunId, fileId, 'nnunet')}
                                        title={
                                          bothAltModelsShownForSlice
                                            ? 'Modèles 2 et 3 : résultats déjà affichés pour cette coupe'
                                            : refModelKey === 'nnunet'
                                              ? 'Le Modèle 2 est déjà le masque de référence (bandeau du haut)'
                                              : curSegKey === 'nnunet'
                                                ? 'Le masque courant provient déjà du Modèle 2'
                                                : 'Lancer la segmentation avec le Modèle 2'
                                        }
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Lancer Modèle 2
                                      </button>
                                      <button
                                        type="button"
                                        disabled={relaunchM3Disabled}
                                        onClick={() => resegmentSliceWithModel(effectiveRunId, fileId, 'swinunetr')}
                                        title={
                                          bothAltModelsShownForSlice
                                            ? 'Modèles 2 et 3 : résultats déjà affichés pour cette coupe'
                                            : refModelKey === 'swinunetr'
                                              ? 'Le Modèle 3 est déjà le masque de référence (bandeau du haut)'
                                              : curSegKey === 'swinunetr'
                                                ? 'Le masque courant provient déjà du Modèle 3'
                                                : 'Lancer la segmentation avec le Modèle 3'
                                        }
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-violet-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Lancer Modèle 3
                                      </button>
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                                    <p className="font-bold text-slate-700 mb-1">Tester un autre modèle sur cette coupe uniquement</p>
                                    <p>
                                      Cliquez sur <span className="font-semibold text-indigo-700">Lancer M2</span> ou <span className="font-semibold text-violet-700">Lancer M3</span> pour obtenir une segmentation alternative sur cette coupe.
                                      Les deux masques apparaîtront dans la grille «&nbsp;Masques et overlays&nbsp;» — cochez celui à conserver, puis cliquez sur <span className="font-semibold text-teal-700">Valider le choix du modèle</span>.
                                    </p>
                                  </div>
                                </div>
                              </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {!showResults && (
                  <>
                  {/* ── En-tête gradient ── */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                    <div className="relative bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-6 py-5">
                      <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                      <span className="absolute right-20 -bottom-4 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
                      <div className="relative flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                            {(launchResult || progress >= 100) && !launchError
                              ? <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                              : <Brain className="h-6 w-6 text-white" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Étape 3 / 3</p>
                            <p className="mt-0.5 text-base font-black text-white">
                              {(launchResult || progress >= 100) && !launchError ? 'Segmentation terminée' : 'Segmentation IA en cours…'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="rounded-xl bg-white/10 px-4 py-2 text-center">
                            <p className="text-lg font-black text-white">{selectedSlices.length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">coupes</p>
                          </div>
                          <div className="rounded-xl bg-white/10 px-4 py-2 text-center">
                            <p className="text-sm font-black text-white">{modelKeyToDisplayName(selectedModel)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">modèle</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Barre de progression ── */}
                    {!launchError && (
                      <div className="border-t border-slate-100 bg-white px-6 py-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-700">Progression</span>
                          <div className="flex items-center gap-3">
                            {progress < 100 && isLaunching && (
                              <span className="text-xs font-medium text-slate-400">
                                ~{Math.max(1, Math.ceil((90 - progress) / 2 * Math.max(100, Math.round(selectedSlices.length * 500 / 45)) / 1000))}s restantes
                              </span>
                            )}
                            <span className={`text-base font-black tabular-nums ${progress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                              {progress}%
                            </span>
                          </div>
                        </div>
                        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              progress >= 100
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 shadow-[0_0_10px_rgba(37,99,235,0.45)]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Erreur ── */}
                  {launchError && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-red-700">Erreur lors du lancement</p>
                        <p className="mt-0.5 text-sm text-red-600">{launchError}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button type="button" onClick={launchSegmentation}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                            <RotateCcw className="h-3.5 w-3.5" /> Réessayer
                          </button>
                          <button type="button" onClick={() => setStep(2)}
                            className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                            Retour aux coupes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Checklist des étapes ── */}
                  {!launchError && (
                    <div className="space-y-2">
                      {CHECKLIST_STEPS.map((item, index) => {
                        const done    = index < completedSteps;
                        const active  = index === completedSteps && progress < 100;
                        return (
                          <div key={item}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
                              done   ? 'border-emerald-200 bg-emerald-50'
                              : active ? 'border-blue-200 bg-blue-50 shadow-sm'
                              : 'border-slate-100 bg-slate-50'
                            }`}
                          >
                            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                              done   ? 'bg-emerald-500 text-white'
                              : active ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                            }`}>
                              {done ? '✓' : index + 1}
                            </span>
                            <span className={`flex-1 text-sm font-semibold ${
                              done ? 'text-emerald-800' : active ? 'text-blue-800' : 'text-slate-400'
                            }`}>
                              {item}
                            </span>
                            {done && <span className="text-[11px] font-bold text-emerald-600">Terminé</span>}
                            {active && (
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                En cours…
                              </span>
                            )}
                            {!done && !active && <span className="text-[11px] text-slate-400">En attente</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Carte de succès ── */}
                  {(launchResult || progress >= 100) && !launchError && (
                    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm">
                      <div className="px-6 py-5">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-black text-emerald-900">Segmentation terminée avec succès</h3>
                            <p className="mt-0.5 text-sm text-emerald-700">L'analyse IA a été effectuée. Les masques de segmentation sont prêts à être examinés.</p>
                          </div>
                        </div>

                        {/* Stats rapides */}
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div className="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2.5 text-center">
                            <p className="text-xl font-black text-emerald-700">{launchResult?.count ?? selectedSlices.length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">coupes traitées</p>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2.5 text-center">
                            <p className="text-sm font-black text-emerald-700">{modelKeyToDisplayName(selectedModel)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">modèle utilisé</p>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2.5 text-center">
                            <p className="text-sm font-black text-emerald-700">{DEFAULT_SEGMENTATION_THRESHOLD}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">seuil confiance</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={openSegmentationResults}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Voir les résultats
                          </button>
                          <button type="button" onClick={() => setStep(2)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                            <ChevronLeft className="h-4 w-4" />
                            Modifier les coupes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            )}
          </div>
          {step === 1 && (
            <div className="shrink-0 px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">Étape <strong>1</strong> sur 3</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => navigate(-1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  Annuler
                </button>
                {patientSelectMode === 'existing' ? (
                  <button type="button" disabled={!selectedPatient} onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Confirmer le patient
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" onClick={npHandleSubmit} disabled={npSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60">
                    {npSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {npSubmitting ? 'Création…' : 'Créer et continuer'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {launchConfirmOpen && step === 2 ? (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="launch-confirm-title"
          onClick={() => setLaunchConfirmOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── En-tête gradient ── */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-6 py-5">
              <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
              <span className="absolute right-16 -bottom-4 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 id="launch-confirm-title" className="text-base font-black text-white">
                    Confirmer le lancement de la segmentation
                  </h2>
                  <p className="mt-0.5 text-[12px] text-blue-200">
                    Vérifiez attentivement les paramètres avant de démarrer l'analyse IA
                  </p>
                </div>
              </div>
            </div>

            {/* ── Corps scrollable ── */}
            <div className="max-h-[min(58vh,28rem)] overflow-y-auto px-6 py-5 space-y-4">

              {/* Question centrale */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3.5">
                <p className="text-sm font-bold text-blue-900 leading-relaxed">
                  Êtes-vous sûr de vouloir lancer la segmentation avec le{' '}
                  <span className="text-blue-700">{modelKeyToDisplayName(selectedModel)} (modèle par défaut)</span>{' '}
                  sur les{' '}
                  <span className="text-xl font-black text-blue-700">{selectedSlices.length}</span>{' '}
                  coupe{selectedSlices.length > 1 ? 's' : ''} sélectionnée{selectedSlices.length > 1 ? 's' : ''} ?
                </p>
              </div>

              {/* Résumé en 4 cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                    {getPatientName(selectedPatient || {})}
                  </p>
                  {selectedPatient?.dossier_number && (
                    <p className="font-mono text-[11px] text-slate-500">{selectedPatient.dossier_number}</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modèle IA</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">{modelKeyToDisplayName(selectedModel)}</p>
                  <p className="text-[11px] text-slate-500">Segmentation hippocampe</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Coupes à analyser</p>
                  <p className="mt-0.5 text-2xl font-black tabular-nums text-blue-700">{selectedSlices.length}</p>
                  <p className="text-[11px] text-blue-500">sur {slices.length} coupes disponibles</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seuil de confiance</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">{DEFAULT_SEGMENTATION_THRESHOLD}</p>
                  <p className="text-[11px] text-slate-500">Paramètre par défaut</p>
                </div>
              </div>

              {/* Avertissement coupes de faible qualité incluses */}
              {(() => {
                const lowQty = selectedSlices.filter((id) => {
                  const q = sliceQuality[String(id)];
                  return q?.is_empty === true || q?.is_low_content === true;
                }).length;
                return lowQty > 0 ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-amber-800">
                        {lowQty} coupe{lowQty > 1 ? 's' : ''} à faible qualité incluse{lowQty > 1 ? 's' : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
                        Ces coupes ont été détectées comme vides ou à faible contenu cérébral lors du preprocessing. Leur inclusion peut réduire la précision de la segmentation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-[11px] font-medium text-emerald-800">
                      Toutes les coupes sélectionnées ont une qualité suffisante pour l'analyse.
                    </p>
                  </div>
                );
              })()}

              {/* Durée estimée + info arrière-plan */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-slate-600">
                  <span className="font-bold text-slate-700">Durée estimée : </span>
                  environ {Math.max(1, Math.ceil(selectedSlices.length / 10))} min selon la charge serveur.
                  L'analyse s'exécute en arrière-plan — vous pouvez suivre la progression en temps réel à l'étape suivante.
                </p>
              </div>

              {/* Détail des coupes — accordéon */}
              <details className="group rounded-xl border border-slate-100 bg-slate-50">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:text-blue-700">
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  Voir le détail des {selectedSlices.length} coupes sélectionnées
                </summary>
                <ul className="max-h-36 overflow-y-auto border-t border-slate-100 px-4 py-2 space-y-1">
                  {launchConfirmationLines.map((line) => (
                    <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-slate-100/60 py-1 last:border-0">
                      <span className="text-[12px] font-bold text-blue-700">{line.coupe}</span>
                      <span className="min-w-0 flex-1 break-all text-right text-[11px] text-slate-500">{line.filename}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* ── Footer ── */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLaunchConfirmOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Non, modifier la sélection
              </button>
              <button
                type="button"
                onClick={() => {
                  setLaunchConfirmOpen(false);
                  setStep(3);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
              >
                <Brain className="h-4 w-4" />
                Oui, lancer l'analyse sur {selectedSlices.length} coupe{selectedSlices.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adoptConfirm ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fermer"
            onClick={() => setAdoptConfirm(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="adopt-ref-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="adopt-ref-title" className="text-base font-semibold text-slate-900">
              Confirmer le masque de référence
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Adopter <span className="font-semibold text-slate-800">{adoptConfirm.label}</span> pour cette coupe&nbsp;? La ligne
              «&nbsp;Référence&nbsp;» et le masque actif seront mis à jour avec cette segmentation (équivalent à un choix de contour
              validé sur les viewers cliniques).
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Les comparaisons avec les relances précédentes disparaissent jusqu’au prochain lancement d’un modèle (M1, M2 ou M3).
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAdoptConfirm(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={Boolean(maskActionBusy[adoptConfirm.maskId])}
                onClick={async () => {
                  const { runId, maskId, modelKey } = adoptConfirm;
                  await adoptReferenceMask(runId, maskId, modelKey);
                  setAdoptConfirm(null);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════
          MODAL — Confirmation validation finale & reconstruction 3D
      ══════════════════════════════════════════════════════════════ */}
      {validateConfirmOpen && (
        <div
          className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="validate-confirm-title"
          onClick={() => setValidateConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── En-tête gradient émeraude ── */}
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 py-5">
              <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <span className="absolute right-14 -bottom-4 h-16 w-16 rounded-full bg-white/10 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 id="validate-confirm-title" className="text-base font-black text-white">
                    Valider la segmentation ?
                  </h2>
                  <p className="mt-0.5 text-[12px] text-emerald-100">
                    Cette action finalise l'analyse et lance la reconstruction 3D
                  </p>
                </div>
              </div>
            </div>

            {/* ── Corps ── */}
            <div className="px-6 py-5 space-y-4">

              {/* Question centrale */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3.5">
                <p className="text-sm font-bold text-emerald-900 leading-relaxed">
                  Êtes-vous sûr de vouloir valider cette segmentation et passer à la reconstruction 3D ?
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Une fois validée, la segmentation sera transmise au module de modélisation volumétrique.
                </p>
              </div>

              {/* Récapitulatif */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{getPatientName(selectedPatient || {})}</p>
                  {selectedPatient?.dossier_number && (
                    <p className="font-mono text-[11px] text-slate-500">{selectedPatient.dossier_number}</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modèle utilisé</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">
                    {runSummary?.model_version || modelKeyToDisplayName(runSummary?.model_key) || 'Modèle 1'}
                  </p>
                  <p className="text-[11px] text-slate-500">Segmentation hippocampe</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Coupes validées</p>
                  <p className="mt-0.5 text-2xl font-black tabular-nums text-emerald-700">{reviewStats.validated}</p>
                  <p className="text-[11px] text-emerald-500">sur {reviewStats.total} coupes traitées</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Statut</p>
                  {reviewStats.rejected > 0 && (
                    <p className="mt-0.5 text-[11px] font-semibold text-red-600">
                      {reviewStats.rejected} coupe{reviewStats.rejected > 1 ? 's' : ''} rejetée{reviewStats.rejected > 1 ? 's' : ''}
                    </p>
                  )}
                  {reviewStats.pending > 0 && (
                    <p className="text-[11px] font-semibold text-amber-600">
                      {reviewStats.pending} coupe{reviewStats.pending > 1 ? 's' : ''} en attente
                    </p>
                  )}
                  {reviewStats.pending === 0 && reviewStats.rejected === 0 && (
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-600">Toutes validées</p>
                  )}
                </div>
              </div>

              {/* Avertissement si coupes non examinées */}
              {reviewStats.pending > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      {reviewStats.pending} coupe{reviewStats.pending > 1 ? 's' : ''} non examinée{reviewStats.pending > 1 ? 's' : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
                      Vous n'avez pas encore statué sur toutes les coupes. La validation inclura ces coupes telles quelles.
                    </p>
                  </div>
                </div>
              )}

              {/* Ce qui se passe ensuite */}
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div>
                  <p className="text-xs font-bold text-blue-800">Prochaine étape : Reconstruction 3D</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700">
                    Les masques de segmentation validés seront assemblés en un volume 3D de l'hippocampe, visualisable et exportable.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setValidateConfirmOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Non, continuer l'examen
              </button>
              <button
                type="button"
                onClick={() => {
                  setValidateConfirmOpen(false);
                  const rid = effectiveRunId;
                  if (!Number.isFinite(rid) || rid <= 0) return;
                  navigate(`/segmentation/modelisation?run=${rid}`);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Oui, valider et passer à la reconstruction 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
