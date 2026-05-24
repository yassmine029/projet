import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  TrendingDown, TrendingUp, Minus, Activity, Brain,
  Calendar, AlertTriangle, Loader2, BarChart2,
  Info, ImagePlus, PlusCircle, Cpu,
} from 'lucide-react';
import api from '../api';
import ClinicalAISummary from './ClinicalAISummary';

// ── Configuration des modèles ──────────────────────────────────────────────────
const MODEL_CONFIG = {
  unetpp:    { label: 'Modèle 1', short: 'M1', cls: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500' },
  nnunet:    { label: 'Modèle 2', short: 'M2', cls: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  swinunetr: { label: 'Modèle 3', short: 'M3', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};
const modelCfg = (key) => MODEL_CONFIG[key] || { label: key || 'Modèle', short: '?', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };

// ── Plages normatives ──────────────────────────────────────────────────────────
const NORM_LEFT_MIN  = 2100;
const NORM_LEFT_MAX  = 2700;
const NORM_RIGHT_MIN = 2100;
const NORM_RIGHT_MAX = 2700;
const NORM_TOTAL_MIN = 4200;
const NORM_TOTAL_MAX = 5400;

// ── Statut clinique basé sur le volume total ──────────────────────────────────
function getStatus(total) {
  if (!total) return { label: '— N/A', cls: 'bg-slate-50 text-slate-400 border-slate-100' };
  if (total < NORM_TOTAL_MIN) return { label: '⚠ Atrophie', cls: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (total > NORM_TOTAL_MAX) return { label: '⚠ Élevé',   cls: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: '✓ Normal', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
}

// Score de complétude d'un run (pour choisir le représentant par IRM)
function completenessScore(r) {
  return (r.left_volume_mm3  != null ? 2 : 0)
       + (r.right_volume_mm3 != null ? 2 : 0)
       + (r.total_volume_mm3 != null ? 1 : 0);
}

// ── Détection côté client : même IRM source ───────────────────────────────────
// Vélocité max cliniquement plausible : ~150 mm³/mois (Alzheimer avancé)
const MAX_PLAUSIBLE_VELOCITY_MM_MONTH = 150;

function detectSameSourceFrontend(history) {
  if (!history || history.length < 2) return false;

  // Uniquement via source_mri_ids : si toutes les empreintes sont identiques → même IRM.
  // La méthode variance a été supprimée (trop de faux positifs sur deux IRM légitimes proches).
  const withIds = history.filter(r => Array.isArray(r.source_mri_ids) && r.source_mri_ids.length > 0);
  if (withIds.length >= 2) {
    const ref = JSON.stringify(withIds[0].source_mri_ids);
    if (withIds.every(r => JSON.stringify(r.source_mri_ids) === ref)) return true;
  }

  return false;
}

// ── Calcul vélocité & projection ───────────────────────────────────────────────
function computeStats(history) {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first  = sorted[0];
  const last   = sorted[sorted.length - 1];
  const months = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0.5) return null;
  const dTotal  = (last.total_volume_mm3  || 0) - (first.total_volume_mm3  || 0);
  const dLeft   = (last.left_volume_mm3   || 0) - (first.left_volume_mm3   || 0);
  const dRight  = (last.right_volume_mm3  || 0) - (first.right_volume_mm3  || 0);
  const mmMonth = dTotal / months;

  let acceleration = 'stable';
  if (sorted.length >= 4) {
    const mid     = Math.floor(sorted.length / 2);
    const firstH  = sorted.slice(0, mid);
    const secondH = sorted.slice(mid);
    const mFirst  = (new Date(firstH[firstH.length-1].date) - new Date(firstH[0].date)) / (1000*60*60*24*30.44);
    const mSecond = (new Date(secondH[secondH.length-1].date) - new Date(secondH[0].date)) / (1000*60*60*24*30.44);
    const rateFirst  = mFirst  > 0 ? ((firstH[firstH.length-1].total_volume_mm3  || 0) - (firstH[0].total_volume_mm3  || 0)) / mFirst  : 0;
    const rateSecond = mSecond > 0 ? ((secondH[secondH.length-1].total_volume_mm3 || 0) - (secondH[0].total_volume_mm3 || 0)) / mSecond : 0;
    if (rateSecond < rateFirst - 5)  acceleration = 'accelerating';
    else if (rateSecond > rateFirst + 5) acceleration = 'decelerating';
  }

  const proj6m  = (last.total_volume_mm3 || 0) + mmMonth * 6;
  const proj12m = (last.total_volume_mm3 || 0) + mmMonth * 12;
  const pctChange = first.total_volume_mm3 ? ((dTotal / first.total_volume_mm3) * 100) : 0;

  return { mmMonth, months, dLeft, dRight, pctChange, proj6m, proj12m, acceleration, first, last };
}

// ── Tooltip personnalisé ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 min-w-[200px]">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-[11px] font-semibold text-slate-600">{entry.name}</span>
          </div>
          <span className="text-[12px] font-black text-slate-900">{entry.value?.toFixed(0)} mm³</span>
        </div>
      ))}
    </div>
  );
}

// ── Carte vélocité ─────────────────────────────────────────────────────────────
function VelocityCard({ stats }) {
  if (!stats) return null;
  const isDecline  = stats.mmMonth < -2;
  const isStable   = Math.abs(stats.mmMonth) <= 2;
  const Icon       = isDecline ? TrendingDown : isStable ? Minus : TrendingUp;
  const color      = isDecline ? 'text-rose-600' : isStable ? 'text-slate-600' : 'text-emerald-600';
  const bg         = isDecline ? 'bg-rose-50 border-rose-200' : isStable ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-200';
  const accLabel   = { accelerating: 'En accélération ↑', decelerating: 'En ralentissement ↓', stable: 'Taux stable' };
  const accColor   = { accelerating: 'text-rose-500', decelerating: 'text-emerald-600', stable: 'text-slate-500' };

  return (
    <div className={`rounded-2xl border ${bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Vélocité d'atrophie</p>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className={`text-3xl font-black ${color} leading-none`}>
          {stats.mmMonth > 0 ? '+' : ''}{stats.mmMonth.toFixed(1)}
        </p>
        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">mm³ / mois</p>
      </div>
      <p className={`text-[10px] font-black ${accColor[stats.acceleration]}`}>
        {accLabel[stats.acceleration]}
      </p>
    </div>
  );
}

// ── Cartes projection ──────────────────────────────────────────────────────────
function ProjectionCard({ label, value }) {
  const isBelow = value < NORM_TOTAL_MIN;
  return (
    <div className={`rounded-2xl border p-4 ${isBelow ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-100'}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-black ${isBelow ? 'text-rose-700' : 'text-blue-800'} leading-none`}>
        {value?.toFixed(0)}
        <span className="text-[11px] font-semibold ml-1">mm³</span>
      </p>
      {isBelow && (
        <p className="text-[9px] text-rose-500 font-bold mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Sous le seuil normatif
        </p>
      )}
    </div>
  );
}

// ── Point de donnée avec étiquette valeur ─────────────────────────────────
function ValueDot({ cx, cy, value, color }) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 11} textAnchor="middle" fontSize={9} fontWeight="700" fill={color}>
        {Math.round(value).toLocaleString()}
      </text>
    </g>
  );
}

// ── Cellule de volume avec delta ───────────────────────────────────────────
function VolumeCell({ value, delta, min, max, color }) {
  if (!value) return <span className="text-[13px] font-semibold text-slate-300">—</span>;
  const outOfRange = value < min || (max != null && value > max);
  return (
    <div className="flex flex-col items-center">
      <span className={`text-[13px] font-black tabular-nums ${outOfRange ? 'text-rose-600' : color}`}>
        {Math.round(value).toLocaleString()}
      </span>
      {delta != null && (
        <span className={`text-[9px] font-bold mt-0.5 ${delta < 0 ? 'text-rose-400' : delta > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  );
}

// ── Tableau comparatif : une ligne par IRM ─────────────────────────────────
function ComparisonTable({ acquisitions }) {
  if (!acquisitions || acquisitions.length === 0) return null;
  const hasAny = acquisitions.some(a => a.left_volume_mm3 || a.right_volume_mm3 || a.total_volume_mm3);
  if (!hasAny) return null;
  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <Brain className="w-5 h-5 text-blue-500" />
        <div>
          <h4 className="text-sm font-black text-slate-900">Comparaison des volumes hippocampiques</h4>
          <p className="text-[10px] text-slate-400 font-medium">Une analyse représentative par IRM · valeurs en mm³ · ↑↓ = évolution vs examen précédent</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-3 text-left   text-[9px] font-black uppercase tracking-widest text-slate-400">IRM</th>
              <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-blue-500">Gauche (mm³)</th>
              <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-violet-500">Droit (mm³)</th>
              <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-emerald-600">Total (mm³)</th>
              <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {acquisitions.map((acq, i) => {
              const prev = i > 0 ? acquisitions[i - 1] : null;
              const dL = prev && acq.left_volume_mm3  && prev.left_volume_mm3  ? Math.round(acq.left_volume_mm3  - prev.left_volume_mm3)  : null;
              const dR = prev && acq.right_volume_mm3 && prev.right_volume_mm3 ? Math.round(acq.right_volume_mm3 - prev.right_volume_mm3) : null;
              const dT = prev && acq.total_volume_mm3 && prev.total_volume_mm3 ? Math.round(acq.total_volume_mm3 - prev.total_volume_mm3) : null;
              const st = getStatus(acq.total_volume_mm3);
              return (
                <tr key={acq.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-[11px] font-black text-blue-600 shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-[12px] font-black text-slate-800">{acq.date_display || '—'}</p>
                        <p className="text-[9px] text-slate-400 font-medium">{modelCfg(acq.model_key).label}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <VolumeCell value={acq.left_volume_mm3}  delta={dL} min={NORM_LEFT_MIN}  max={NORM_LEFT_MAX}  color="text-blue-700" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <VolumeCell value={acq.right_volume_mm3} delta={dR} min={NORM_RIGHT_MIN} max={NORM_RIGHT_MAX} color="text-violet-700" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <VolumeCell value={acq.total_volume_mm3} delta={dT} min={NORM_TOTAL_MIN} max={NORM_TOTAL_MAX} color="text-emerald-700" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
        <p className="text-[9px] text-slate-400 font-medium">
          Normatives · Gauche : {NORM_LEFT_MIN}–{NORM_LEFT_MAX} mm³ · Droit : {NORM_RIGHT_MIN}–{NORM_RIGHT_MAX} mm³ · Total : {NORM_TOTAL_MIN}–{NORM_TOTAL_MAX} mm³
        </p>
      </div>
    </div>
  );
}

// ── Zone d'import nouveau IRM ──────────────────────────────────────────────────
function ImportZone({ patientId }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/segmentation/nouvelle?patientId=${patientId}`)}
      className="w-full group rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 hover:border-violet-500 hover:bg-violet-50 transition-all p-8 flex flex-col items-center gap-3 cursor-pointer"
    >
      <div className="w-14 h-14 rounded-2xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
        <ImagePlus className="w-7 h-7 text-violet-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-black text-violet-800 mb-1">Importer un nouveau volume IRM</p>
        <p className="text-[11px] text-violet-600/70 leading-relaxed max-w-xs">
          Sélectionnez un nouvel IRM acquis à une date différente pour activer le suivi longitudinal
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-[11px] font-black text-white shadow-sm group-hover:bg-violet-700 transition-colors">
        <PlusCircle className="w-4 h-4" /> Lancer une nouvelle segmentation
      </span>
    </button>
  );
}



// ── Composant principal ────────────────────────────────────────────────────────
export default function LongitudinalDashboard({ patientId, patient }) {
  const [history, setHistory]       = useState([]);
  const [allSameSource, setAllSame] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/patients/${patientId}/segmentation-history/`)
      .then(r => {
        setHistory(r.data.history || []);
        setAllSame(r.data.all_same_source || false);
      })
      .catch(() => setError('Impossible de charger l\'historique.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  // Dédupliquer par acquisition_id : un run représentatif par IRM
  // Priorité : run avec le plus de données (gauche+droit+total), à égalité le plus récent
  const uniqueAcquisitions = useMemo(() => {
    const byAcq = {};
    history.forEach(r => {
      const key = r.acquisition_id || String(r.id);
      const existing = byAcq[key];
      if (!existing) {
        byAcq[key] = r;
      } else {
        const scoreNew = completenessScore(r);
        const scoreOld = completenessScore(existing);
        if (scoreNew > scoreOld || (scoreNew === scoreOld && new Date(r.date) > new Date(existing.date))) {
          byAcq[key] = r;
        }
      }
    });
    return Object.values(byAcq).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [history]);

  // Regrouper tous les runs par acquisition (pour le tableau multi-modèles)
  const groupedByAcquisition = useMemo(() => {
    const groups = {};
    history.forEach(r => {
      const key = r.acquisition_id || String(r.id);
      if (!groups[key]) groups[key] = { key, date: r.date, date_display: r.date_display, variants: [] };
      groups[key].variants.push(r);
    });
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [history]);

  const effectiveSameSource = useMemo(
    () => allSameSource || detectSameSourceFrontend(uniqueAcquisitions),
    [allSameSource, uniqueAcquisitions],
  );

  const stats = useMemo(() => {
    if (effectiveSameSource) return null;
    const s = computeStats(uniqueAcquisitions);
    if (s && Math.abs(s.mmMonth) > MAX_PLAUSIBLE_VELOCITY_MM_MONTH) return null;
    return s;
  }, [uniqueAcquisitions, effectiveSameSource]);

  const chartData = useMemo(() =>
    uniqueAcquisitions.map(r => ({
      date:      r.date_display,
      gauche:    r.left_volume_mm3  ? Math.round(r.left_volume_mm3)  : null,
      droit:     r.right_volume_mm3 ? Math.round(r.right_volume_mm3) : null,
      total:     r.total_volume_mm3 ? Math.round(r.total_volume_mm3) : null,
      asymétrie: r.asymmetry_index  ? Math.abs(r.asymmetry_index)    : null,
    })),
    [uniqueAcquisitions]
  );

  // Domaine Y dynamique basé sur les valeurs réelles (per-side only)
  const yDomain = useMemo(() => {
    const vals = chartData.flatMap(d => [d.gauche, d.droit].filter(v => v != null && v > 0));
    if (!vals.length) return [1500, 3200];
    const minV = Math.max(0, Math.min(...vals) - 300);
    const maxV = Math.max(...vals) + 300;
    return [Math.floor(minV / 100) * 100, Math.ceil(maxV / 100) * 100];
  }, [chartData]);

  // Domaine Y pour le volume total
  const yDomainTotal = useMemo(() => {
    const vals = chartData.map(d => d.total).filter(v => v != null && v > 0);
    if (!vals.length) return [3000, 6000];
    const minV = Math.max(0, Math.min(...vals) - 400);
    const maxV = Math.max(...vals) + 400;
    return [Math.floor(minV / 100) * 100, Math.ceil(maxV / 100) * 100];
  }, [chartData]);

  const chartHasData = chartData.some(d => d.gauche != null || d.droit != null);
  const totalHasData = chartData.some(d => d.total != null);

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      <span className="text-sm font-semibold">Chargement du suivi longitudinal…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-rose-700 text-sm font-semibold">
      {error}
    </div>
  );

  const hasRealLongitudinal = uniqueAcquisitions.length >= 2 && !effectiveSameSource;

  // Cas : pas de volumes enregistrés OU 1 seul IRM
  if (history.length === 0 || !hasRealLongitudinal) {
    const hasVolumes = history.length > 0 && history.some(r => r.has_volumes !== false && r.total_volume_mm3);
    return (
      <div className="space-y-5">
        {/* Bannière principale */}
        <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-slate-50 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-violet-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">Suivi longitudinal</p>
              <h4 className="text-base font-black text-slate-800 mb-2">
                {hasVolumes ? 'IRM unique — résultats actuels' : 'Aucun volume enregistré'}
              </h4>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                {hasVolumes
                  ? <>Analyses réalisées sur le même IRM source. Importez un <strong className="text-violet-700">nouvel IRM</strong> à une date différente pour activer l'évolution temporelle.</>
                  : <>Générez un rapport PDF depuis la page de segmentation pour enregistrer les volumes, puis importez un <strong className="text-violet-700">second IRM</strong> à une date différente pour activer le suivi longitudinal.</>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tableau de volumes : toutes les analyses disponibles */}
        {hasVolumes && groupedByAcquisition.length > 0 && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <Brain className="w-5 h-5 text-blue-500" />
              <div>
                <h4 className="text-sm font-black text-slate-900">Volumes hippocampiques enregistrés</h4>
                <p className="text-[10px] text-slate-400 font-medium">{history.length} analyse{history.length > 1 ? 's' : ''} disponible{history.length > 1 ? 's' : ''} · valeurs en mm³</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left   text-[9px] font-black uppercase tracking-widest text-slate-400">IRM / Modèle</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-blue-500">Gauche (mm³)</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-violet-500">Droit (mm³)</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-emerald-600">Total (mm³)</th>
                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedByAcquisition.map((group, gi) =>
                    group.variants.map((run, ri) => {
                      const cfg = modelCfg(run.model_key);
                      const st  = getStatus(run.total_volume_mm3);
                      return (
                        <tr key={run.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-[11px] font-black text-blue-600 shrink-0">
                                {groupedByAcquisition.length - gi}
                              </span>
                              <div>
                                <p className="text-[12px] font-black text-slate-800">{group.date_display || '—'}</p>
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                                  <Cpu className="w-2.5 h-2.5" />{cfg.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <VolumeCell value={run.left_volume_mm3}  delta={null} min={NORM_LEFT_MIN}  max={NORM_LEFT_MAX}  color="text-blue-700" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <VolumeCell value={run.right_volume_mm3} delta={null} min={NORM_RIGHT_MIN} max={NORM_RIGHT_MAX} color="text-violet-700" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <VolumeCell value={run.total_volume_mm3} delta={null} min={NORM_TOTAL_MIN} max={NORM_TOTAL_MAX} color="text-emerald-700" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
              <p className="text-[9px] text-slate-400 font-medium">
                Normatives · Gauche : {NORM_LEFT_MIN}–{NORM_LEFT_MAX} mm³ · Droit : {NORM_RIGHT_MIN}–{NORM_RIGHT_MAX} mm³ · Total : {NORM_TOTAL_MIN}–{NORM_TOTAL_MAX} mm³
              </p>
            </div>
          </div>
        )}

        {/* Zone d'import */}
        <ImportZone patientId={patientId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Résumé IA clinique ─────────────────────────────────────────────── */}
      <ClinicalAISummary history={history} patient={patient} allSameSource={false} />

      {/* ── KPIs rapides ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">IRM distincts</p>
          <p className="text-3xl font-black text-slate-900">{uniqueAcquisitions.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{history.length} analyse{history.length > 1 ? 's' : ''} au total</p>
        </div>

        {/* Vélocité & projections */}
        {stats && (
          <>
            <VelocityCard stats={stats} />
            <ProjectionCard label="Projection 6 mois"  value={stats.proj6m} />
            <ProjectionCard label="Projection 12 mois" value={stats.proj12m} />
          </>
        )}

        {/* Plusieurs IRM mais délai trop court */}
        {!stats && history.length > 1 && (
          <div className="col-span-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3 text-slate-600">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-[12px] font-semibold">
              Intervalle entre les examens trop court pour calculer une vélocité fiable (minimum 2 semaines).
            </p>
          </div>
        )}
      </div>

      {/* ── Graphique principal : volume total au cours du temps ───────────── */}
      {chartData.length >= 1 && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Évolution temporelle · 1 valeur par IRM</p>
              <h4 className="text-base font-black text-slate-900">Volume hippocampique total (mm³)</h4>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <div className="w-3 h-3 rounded-full bg-emerald-500"/><span>Total</span>
            </div>
          </div>

          {totalHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={yDomainTotal} width={60} tickFormatter={v => `${v}`} />
                <ReferenceArea y1={NORM_TOTAL_MIN} y2={NORM_TOTAL_MAX} fill="#dcfce7" fillOpacity={0.5} />
                <ReferenceLine y={NORM_TOTAL_MIN} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `Min ${NORM_TOTAL_MIN}`, position: 'insideBottomLeft', fontSize: 9, fill: '#22c55e', fontWeight: 700 }} />
                <ReferenceLine y={NORM_TOTAL_MAX} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `Max ${NORM_TOTAL_MAX}`, position: 'insideTopLeft', fontSize: 9, fill: '#22c55e', fontWeight: 700 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" name="Volume total" stroke="#10b981" strokeWidth={3} fill="url(#total)"
                  dot={(props) => <ValueDot {...props} color="#10b981" />} activeDot={{ r: 8 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <Brain className="w-10 h-10 mb-3 opacity-20 text-slate-400" />
              <p className="text-sm font-semibold text-slate-500">Volumes non calculés</p>
              <p className="text-[11px] mt-1 text-slate-400 text-center max-w-xs">
                Générez un rapport PDF depuis la segmentation pour enregistrer les volumes de chaque IRM
              </p>
            </div>
          )}

          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
            Zone verte = plage normative ({NORM_TOTAL_MIN.toLocaleString()} – {NORM_TOTAL_MAX.toLocaleString()} mm³)
          </p>
        </div>
      )}

      {/* ── Graphique par côté (gauche/droit) — uniquement si données disponibles ─ */}
      {chartData.length >= 1 && chartHasData && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Latéralisation</p>
              <h4 className="text-base font-black text-slate-900">Volumes hippocampiques gauche / droit (mm³)</h4>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"/><span>Gauche</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500"/><span>Droit</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gauche" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="droit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={yDomain} width={55} tickFormatter={v => `${v}`} />
              <ReferenceArea y1={NORM_LEFT_MIN} y2={NORM_LEFT_MAX} fill="#dcfce7" fillOpacity={0.5} />
              <ReferenceLine y={NORM_LEFT_MIN} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `Min ${NORM_LEFT_MIN}`, position: 'insideBottomLeft', fontSize: 9, fill: '#22c55e', fontWeight: 700 }} />
              <ReferenceLine y={NORM_LEFT_MAX} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `Max ${NORM_LEFT_MAX}`, position: 'insideTopLeft', fontSize: 9, fill: '#22c55e', fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="gauche" name="Hippocampe gauche" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gauche)"
                dot={(props) => <ValueDot {...props} color="#3b82f6" />} activeDot={{ r: 7 }} connectNulls />
              <Area type="monotone" dataKey="droit"  name="Hippocampe droit"  stroke="#8b5cf6" strokeWidth={2.5} fill="url(#droit)"
                dot={(props) => <ValueDot {...props} color="#8b5cf6" />} activeDot={{ r: 7 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
            Zone verte = plage normative ({NORM_LEFT_MIN.toLocaleString()} – {NORM_LEFT_MAX.toLocaleString()} mm³ par côté)
          </p>
        </div>
      )}

      {/* ── Tableau comparatif (une ligne par IRM) ─────────────────────────── */}
      <ComparisonTable acquisitions={uniqueAcquisitions} />

      {/* ── Graphique asymétrie (uniquement si plusieurs IRM distincts) ─────── */}
      {!effectiveSameSource && chartData.length >= 2 && chartData.some(d => d.asymétrie !== null) && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="mb-6">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Latéralisation</p>
            <h4 className="text-base font-black text-slate-900">Index d'asymétrie gauche / droite (%)</h4>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 20]} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Seuil clinique', position: 'insideBottomRight', fontSize: 9, fill: '#f59e0b', fontWeight: 700 }} />
              <Tooltip formatter={(v) => [`${v?.toFixed(1)}%`, "Asymétrie"]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }} />
              <Line type="monotone" dataKey="asymétrie" name="Asymétrie" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
            Au-delà de 10% — asymétrie cliniquement significative
          </p>
        </div>
      )}

      {/* ── Tableau des sessions groupé par IRM + modèle ──────────────────── */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          <h4 className="text-sm font-black text-slate-900">Détail des examens</h4>
          <span className="ml-auto text-[10px] font-bold text-slate-400">{uniqueAcquisitions.length} IRM · {history.length} analyse{history.length > 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {groupedByAcquisition.map((group, gi) => (
            <div key={group.key} className="px-6 py-4">
              {/* En-tête du groupe IRM */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-slate-500">{groupedByAcquisition.length - gi}</span>
                </div>
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[12px] font-black text-slate-700">IRM du {group.date_display}</span>
                <span className="text-[10px] text-slate-400 font-medium ml-1">
                  · {group.variants.length} analyse{group.variants.length > 1 ? 's' : ''}
                </span>
              </div>
              {/* Variants par modèle */}
              <div className="space-y-2 pl-9">
                {group.variants.map(run => {
                  const cfg = modelCfg(run.model_key);
                  const st  = getStatus(run.total_volume_mm3);
                  return (
                    <div key={run.id} className="flex items-center gap-3 rounded-xl bg-slate-50/70 border border-slate-100 px-3 py-2.5">
                      {/* Badge modèle */}
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${cfg.cls}`}>
                        <Cpu className="w-2.5 h-2.5" />{cfg.label}
                      </span>
                      {/* Volumes */}
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {[['Gauche', run.left_volume_mm3, NORM_LEFT_MIN, NORM_LEFT_MAX], ['Droit', run.right_volume_mm3, NORM_RIGHT_MIN, NORM_RIGHT_MAX], ['Total', run.total_volume_mm3, NORM_TOTAL_MIN, NORM_TOTAL_MAX]].map(([lbl, val, min, max]) => (
                          <div key={lbl} className="text-center">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lbl}</p>
                            <p className={`text-[12px] font-black ${val && (val < min || val > max) ? 'text-rose-600' : val ? 'text-slate-800' : 'text-slate-300'}`}>
                              {val ? `${Math.round(val)} mm³` : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                      <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-full border ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
