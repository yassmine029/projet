import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ReferenceArea, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  TrendingDown, TrendingUp, Minus, Activity, Brain,
  Calendar, AlertTriangle, ChevronRight, Loader2, BarChart2,
  Info, ImagePlus, PlusCircle,
} from 'lucide-react';
import api from '../api';
import ClinicalAISummary from './ClinicalAISummary';

// ── Plages normatives ──────────────────────────────────────────────────────────
const NORM_LEFT_MIN  = 2100;
const NORM_LEFT_MAX  = 2700;
const NORM_RIGHT_MIN = 2100;
const NORM_RIGHT_MAX = 2700;
const NORM_TOTAL_MIN = 4200;
const NORM_TOTAL_MAX = 5400;

// ── Détection côté client : même IRM source ───────────────────────────────────
// Vélocité max cliniquement plausible : ~150 mm³/mois (Alzheimer avancé)
const MAX_PLAUSIBLE_VELOCITY_MM_MONTH = 150;

function detectSameSourceFrontend(history) {
  if (!history || history.length < 2) return false;

  // Méthode 1 (prioritaire) : comparer les empreintes source_mri_ids
  // Le backend envoie la liste triée d'IDs de fichiers pour chaque run.
  // Si toutes les empreintes sont identiques → même IRM.
  const withIds = history.filter(r => Array.isArray(r.source_mri_ids) && r.source_mri_ids.length > 0);
  if (withIds.length >= 2) {
    const ref = JSON.stringify(withIds[0].source_mri_ids);
    if (withIds.every(r => JSON.stringify(r.source_mri_ids) === ref)) return true;
  }

  // Méthode 2 (fallback) : variance des volumes
  // Même IRM avec seuil différent → volumes légèrement différents, mais < 15 % d'écart
  const vols = history.map(r => r.total_volume_mm3).filter(Boolean);
  if (vols.length < 2) return false;
  const mean = vols.reduce((s, v) => s + v, 0) / vols.length;
  const maxDev = Math.max(...vols.map(v => Math.abs(v - mean)));
  if (maxDev / mean < 0.15) return true;

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

// ── Bouton "Nouvel IRM" ────────────────────────────────────────────────────────
function NouvelIrmButton({ patientId }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/segmentation/nouvelle?patientId=${patientId}`)}
      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-black text-white shadow-sm hover:bg-violet-700 transition-colors active:scale-95"
    >
      <PlusCircle className="w-4 h-4" />
      Importer un nouvel IRM et lancer la segmentation
    </button>
  );
}

// ── Bannière source unique (même IRM) ──────────────────────────────────────────
function SameSourceBanner({ runCount, patientId }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
        <Info className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-black text-amber-800 mb-1">Analyses issues du même IRM</p>
        <p className="text-[12px] text-amber-700 leading-relaxed mb-3">
          Les {runCount} analyse{runCount > 1 ? 's' : ''} disponible{runCount > 1 ? 's' : ''} pour ce patient
          {runCount > 1
            ? ' ont été effectuées sur les mêmes images IRM. Les valeurs affichées sont identiques — il ne s\'agit pas d\'une évolution réelle au cours du temps.'
            : ' a été effectuée sur un seul jeu d\'images IRM.'}
        </p>
        <NouvelIrmButton patientId={patientId} />
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function LongitudinalDashboard({ patientId, patient }) {
  const [history, setHistory]         = useState([]);
  const [allSameSource, setAllSame]   = useState(false);
  const [uniqueMriCount, setUnique]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/patients/${patientId}/segmentation-history/`)
      .then(r => {
        setHistory(r.data.history || []);
        setAllSame(r.data.all_same_source || false);
        setUnique(r.data.unique_mri_count || 0);
      })
      .catch(() => setError('Impossible de charger l\'historique.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  // Renforcer la détection côté client : volumes quasi-identiques = même IRM
  const effectiveSameSource = allSameSource || detectSameSourceFrontend(history);

  const stats = useMemo(() => {
    if (effectiveSameSource) return null;
    const s = computeStats(history);
    // Vélocité biologiquement impossible → données incohérentes, ne pas afficher
    if (s && Math.abs(s.mmMonth) > MAX_PLAUSIBLE_VELOCITY_MM_MONTH) return null;
    return s;
  }, [history, effectiveSameSource]);

  const chartData = useMemo(() =>
    [...history]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => ({
        date:      r.date_display,
        gauche:    r.left_volume_mm3  ? Math.round(r.left_volume_mm3)  : null,
        droit:     r.right_volume_mm3 ? Math.round(r.right_volume_mm3) : null,
        total:     r.total_volume_mm3 ? Math.round(r.total_volume_mm3) : null,
        asymétrie: r.asymmetry_index  ? Math.abs(r.asymmetry_index)    : null,
      })),
    [history]
  );

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

  if (history.length === 0) return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <Activity className="w-8 h-8 text-blue-400" />
      </div>
      <h4 className="text-base font-black text-slate-700 mb-2">Aucun suivi volumétrique disponible</h4>
      <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
        Les volumes hippocampiques sont enregistrés automatiquement lors de la génération d'un rapport PDF de segmentation.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Bannière même IRM ──────────────────────────────────────────────── */}
      {effectiveSameSource && <SameSourceBanner runCount={history.length} patientId={patientId} />}

      {/* ── Résumé IA clinique ─────────────────────────────────────────────── */}
      <ClinicalAISummary history={history} patient={patient} allSameSource={effectiveSameSource} />

      {/* ── KPIs rapides ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Examens</p>
          <p className="text-3xl font-black text-slate-900">{history.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {effectiveSameSource ? 'sur le même IRM' : 'sessions analysées'}
          </p>
        </div>

        {/* Vélocité & projections : uniquement si plusieurs IRM distincts */}
        {stats && !effectiveSameSource && (
          <>
            <VelocityCard stats={stats} />
            <ProjectionCard label="Projection 6 mois"  value={stats.proj6m} />
            <ProjectionCard label="Projection 12 mois" value={stats.proj12m} />
          </>
        )}

        {/* Cas : 1 seul run (ou même IRM) → invite à ajouter une séquence */}
        {(effectiveSameSource || (!stats && history.length <= 1)) && (
          <div className="col-span-3 rounded-2xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
            <Brain className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
            <div className="flex-1">
              <p className="text-[12px] font-bold text-blue-700 leading-snug">
                {effectiveSameSource
                  ? `Résultats actuels (${history.length} analyse${history.length > 1 ? 's' : ''} — même IRM)`
                  : 'Un second examen est nécessaire pour calculer la vélocité d\'atrophie et les projections.'}
              </p>
              <p className="text-[11px] mt-1 text-blue-600 font-medium leading-snug mb-3">
                Importez un IRM d'une autre date pour obtenir une comparaison temporelle réelle.
              </p>
              <NouvelIrmButton patientId={patientId} />
            </div>
          </div>
        )}

        {/* Cas : plusieurs IRM mais délai trop court pour stats (<0.5 mois) */}
        {!effectiveSameSource && !stats && history.length > 1 && (
          <div className="col-span-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3 text-slate-600">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-[12px] font-semibold">
              Intervalle entre les examens trop court pour calculer une vélocité fiable (minimum 2 semaines).
            </p>
          </div>
        )}
      </div>

      {/* ── Graphique volumes hippocampiques ───────────────────────────────── */}
      {chartData.length >= 1 && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                {effectiveSameSource ? 'Résultats actuels' : 'Évolution temporelle'}
              </p>
              <h4 className="text-base font-black text-slate-900">Volumes hippocampiques (mm³)</h4>
              {effectiveSameSource && (
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                  Valeurs issues du même IRM — pas d'évolution réelle
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"/><span>Gauche</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500"/><span>Droit</span></div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[1500, 3200]} width={50} tickFormatter={v => `${v}`} />
              <ReferenceArea y1={NORM_LEFT_MIN} y2={NORM_LEFT_MAX} fill="#dcfce7" fillOpacity={0.4} />
              <ReferenceLine y={NORM_LEFT_MIN} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Seuil min', position: 'insideBottomRight', fontSize: 9, fill: '#22c55e', fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="gauche" name="Hippocampe gauche" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gauche)" dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
              <Area type="monotone" dataKey="droit"  name="Hippocampe droit"  stroke="#8b5cf6" strokeWidth={2.5} fill="url(#droit)"  dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>

          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
            Zone verte = plage normative (2 100 – 2 700 mm³)
          </p>
        </div>
      )}

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

      {/* ── Tableau des sessions ────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          <h4 className="text-sm font-black text-slate-900">
            {effectiveSameSource ? 'Analyses effectuées (même IRM)' : 'Détail des examens'}
          </h4>
        </div>
        <div className="divide-y divide-slate-50">
          {[...history].sort((a, b) => new Date(b.date) - new Date(a.date)).map((run, i) => {
            const isOk = run.total_volume_mm3 >= NORM_TOTAL_MIN;
            return (
              <div key={run.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black ${isOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                  {history.length - i}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">{run.date_display}</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {[['Gauche', run.left_volume_mm3, NORM_LEFT_MIN], ['Droit', run.right_volume_mm3, NORM_RIGHT_MIN], ['Total', run.total_volume_mm3, NORM_TOTAL_MIN]].map(([lbl, val, min]) => (
                    <div key={lbl} className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lbl}</p>
                      <p className={`text-[13px] font-black ${val < min ? 'text-rose-600' : 'text-slate-900'}`}>
                        {val ? `${Math.round(val)} mm³` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="shrink-0">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide ${isOk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isOk ? '✓ Normal' : '⚠ Bas'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
