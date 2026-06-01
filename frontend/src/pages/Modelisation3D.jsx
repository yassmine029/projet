import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, ArrowLeft, ArrowRight, X, FileText, Download, UserRound, Hash, CalendarDays, Brain, Activity, BarChart3, CheckCircle2, Loader2, FolderOpen } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ModelViewerBlender from '../components/ModelViewerBlender.jsx';
import api from '../api';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function InfoPopover({ title, formula, variables, clinicalContext, threshold }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[10px] font-black text-blue-600 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Plus d'informations"
      >
        i
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          />
          <div className="absolute right-0 top-7 z-50 w-80 max-h-[min(26rem,80vh)] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-[#0f1f4b] to-[#1a3a8f] px-4 py-3">
              <p className="text-xs font-black text-white">{title}</p>
            </div>
            <div className="p-4 space-y-3">
              {formula && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Formule</p>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 font-mono text-[12px] font-semibold text-slate-800 break-all">
                    {formula}
                  </div>
                </div>
              )}
              {variables && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Variables</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{variables}</p>
                </div>
              )}
              {threshold && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Seuil clinique</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{threshold}</p>
                </div>
              )}
              {clinicalContext && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Contexte clinique</p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{clinicalContext}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

const getAiStatus = (value) => {
  const v = Number(value || 0);
  if (v <= 10) return { label: 'Normal', tone: 'ok' };
  return { label: 'Alerte', tone: 'warn' };
};

const getNiStatus = (value) => {
  const v = Number(value || 0);
  if (v < 60) return { label: 'Severe', tone: 'error' };
  if (v < 90) return { label: 'Alerte', tone: 'warn' };
  if (v <= 110) return { label: 'Normal', tone: 'ok' };
  return { label: 'Haut', tone: 'info' };
};

function AIGauge({ value, interpretation, leftVol, rightVol }) {
  const v = Math.abs(Number(value || 0));
  const status = getAiStatus(v);
  // Jauge sur 30% max, seuil à 10%
  const percent = clamp(v / 30, 0, 1);
  const thresholdPct = (10 / 30) * 100;

  const isNormal = v <= 10;
  const sc = isNormal
    ? { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', strip: 'from-emerald-400 to-emerald-500', ring: 'ring-emerald-200' }
    : { text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     strip: 'from-red-500 to-rose-600',       ring: 'ring-red-200'     };

  // Côté atrophié = celui dont le volume est inférieur
  const lv = Number(leftVol || 0);
  const rv = Number(rightVol || 0);
  const atrophySide = !isNormal && lv > 0 && rv > 0
    ? (lv < rv ? 'gauche' : 'droit')
    : null;

  const legend = [
    {
      range: '0 – 10 %',
      label: 'Asymétrie non significative',
      ref: 'Pas de latéralisation · Normal',
      dot: 'bg-emerald-400',
      active: isNormal,
    },
    {
      range: '> 10 %',
      label: atrophySide ? `Atrophie hippocampique ${atrophySide}` : 'Atrophie hippocampique',
      ref: 'Réduction unilatérale significative',
      dot: 'bg-red-500',
      active: !isNormal,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1 w-full bg-gradient-to-r ${sc.strip}`} />
      <div className="p-4">
        {/* Header compact */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">IA — Indice d'asymétrie</p>
            <h5 className="text-sm font-black text-slate-900">Asymétrie hippocampique</h5>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-black ${sc.bg} ${sc.border} ${sc.text}`}>{status.label}</span>
            <InfoPopover
              title="Indice d'Asymétrie (IA) — MTLE"
              formula="IA = |R − L| / ((R + L) / 2) × 100"
              variables="R : volume hippocampe droit (mm³) · L : volume hippocampe gauche (mm³)."
              threshold="Seuil clinique : 10 %. Au-delà, atrophie du côté au volume inférieur (Cendes et al. 1993)."
              clinicalContext="Classification : normale (≤ 10 %) et atrophie significative (> 10 %)."
            />
          </div>
        </div>

        {/* Valeur + jauge */}
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 ${sc.border} ${sc.bg}`}>
            <span className={`text-xl font-black tabular-nums leading-none ${sc.text}`}>{v.toFixed(2)}</span>
            <span className={`text-[10px] font-bold ${sc.text}`}>%</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-bold ${sc.text}`}>
              {isNormal ? 'Asymétrie non significative' : atrophySide ? `Atrophie ${atrophySide}` : 'Atrophie hippocampique'}
            </p>
            <div className="mt-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full shadow-inner">
                <div className="flex h-full w-full rounded-full">
                  <div className="h-full bg-emerald-400" style={{ width: `${thresholdPct}%` }} />
                  <div className="h-full flex-1 bg-red-500" />
                </div>
                <div className="absolute top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-sm border border-white bg-slate-900 shadow"
                  style={{ left: `clamp(0px, calc(${percent * 100}% - 2px), calc(100% - 4px))` }} aria-hidden />
              </div>
              <div className="mt-0.5 flex justify-between text-[8px] text-slate-400">
                <span>0%</span><span>10%</span><span>20%</span><span>30%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Légende compacte */}
        <div className="mt-3 space-y-1">
          {legend.map((item) => (
            <div key={item.range} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${item.active ? `${sc.bg} border ${sc.border}` : 'bg-slate-50'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
              <span className={`w-16 shrink-0 text-[10px] font-bold ${item.active ? sc.text : 'text-slate-500'}`}>{item.range}</span>
              <span className={`text-[10px] ${item.active ? `font-bold ${sc.text}` : 'text-slate-400'}`}>{item.label}</span>
              {item.active && <span className={`ml-auto text-[9px] font-black ${sc.text}`}>▲</span>}
            </div>
          ))}
        </div>

        {/* Interprétation */}
        {interpretation && (
          <p className={`mt-2.5 text-[10px] leading-relaxed rounded-lg border ${sc.border} ${sc.bg} px-2.5 py-1.5 ${sc.text}`}>{interpretation}</p>
        )}
      </div>
    </div>
  );
}

function NIGauge({ value, interpretation }) {
  const v = Number(value || 0);
  const status = getNiStatus(v);
  const percent = clamp(v / 100, 0, 1);

  // Barre 0→100 % : 4 segments proportionnels aux intervalles cliniques
  const w60   = 60;   // 0–60 % → rouge
  const w80   = 20;   // 60–80 % → orange
  const w90   = 10;   // 80–90 % → jaune
  const wRest = 10;   // ≥ 90 % → vert (jusqu'au bout)

  const sc = status.tone === 'ok'
    ? { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', strip: 'from-emerald-400 to-emerald-500', ring: 'ring-emerald-200' }
    : status.tone === 'info'
      ? { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', strip: 'from-blue-400 to-blue-500', ring: 'ring-blue-200' }
      : status.tone === 'warn'
        ? { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', strip: 'from-amber-400 to-orange-400', ring: 'ring-amber-200' }
        : { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', strip: 'from-red-500 to-rose-600', ring: 'ring-red-200' };

  const valLabel = v < 60 ? 'Réduction sévère (Asev)' : v < 80 ? 'Réduction modérée (Amod)' : v < 90 ? 'Réduction légère (Am)' : 'Volume normal (N)';

  const legend = [
    { range: '< 60 %',     code: 'Asev', label: 'Réduction sévère',        mmRef: '< 3 000 mm³',        dot: 'bg-red-500',     active: v < 60 },
    { range: '60 – 80 %',  code: 'Amod', label: 'Réduction modérée',       mmRef: '3 200 – 3 700 mm³',  dot: 'bg-orange-400',  active: v >= 60 && v < 80 },
    { range: '80 – 90 %',  code: 'Am',   label: 'Réduction légère',        mmRef: '3 700 – 4 500 mm³',  dot: 'bg-yellow-400',  active: v >= 80 && v < 90 },
    { range: '≥ 90 %',     code: 'N',    label: 'Volume normal',           mmRef: '4 500 – 5 300 mm³',  dot: 'bg-green-500',   active: v >= 90 },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1 w-full bg-gradient-to-r ${sc.strip}`} />
      <div className="p-4">
        {/* Header compact */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">IN — Indice de normalisation</p>
            <h5 className="text-sm font-black text-slate-900">Normalisation volumétrique</h5>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-black ${sc.bg} ${sc.border} ${sc.text}`}>{status.label}</span>
            <InfoPopover
              title="Indice de Normalisation (IN) — Alzheimer"
              formula="IN = (V_patient / V_normale) × 100"
              variables="V_patient : volume hippocampique total (mm³). V_normale : valeurs normatives sujets sains."
              threshold="≥ 90 % : Normal · 80–90 % : Légère · 60–80 % : Modérée · < 60 % : Sévère"
              clinicalContext="Référence IRM 1,5T, âge > 50 ans. Volume normal : 4 500–5 300 mm³."
            />
          </div>
        </div>

        {/* Valeur + jauge */}
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 ${sc.border} ${sc.bg}`}>
            <span className={`text-xl font-black tabular-nums leading-none ${sc.text}`}>{v.toFixed(2)}</span>
            <span className={`text-[10px] font-bold ${sc.text}`}>%</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-bold ${sc.text}`}>{valLabel}</p>
            <div className="mt-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full shadow-inner">
                <div className="flex h-full w-full">
                  <div className="h-full" style={{ width: `${w60}%`, background: '#ef4444' }} />
                  <div className="h-full" style={{ width: `${w80}%`, background: '#fb923c' }} />
                  <div className="h-full" style={{ width: `${w90}%`, background: '#fbbf24' }} />
                  <div className="h-full" style={{ width: `${wRest}%`, background: '#22c55e' }} />
                </div>
                <div className="absolute top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-sm border border-white bg-slate-900 shadow"
                  style={{ left: `clamp(0px, calc(${percent * 100}% - 2px), calc(100% - 4px))` }} aria-hidden />
              </div>
              <div className="relative mt-0.5 h-3 text-[8px] text-slate-400">
                {[{v:0,label:'0%'},{v:60,label:'60%'},{v:80,label:'80%'},{v:90,label:'90%'},{v:100,label:'100%'}].map(({v:pct,label})=>(
                  <span key={pct} className="absolute -translate-x-1/2" style={{left:`${pct}%`}}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Légende compacte */}
        <div className="mt-3 space-y-1">
          {legend.map((item) => (
            <div key={item.range} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${item.active ? `${sc.bg} border ${sc.border}` : 'bg-slate-50'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
              <span className={`w-16 shrink-0 text-[10px] font-bold ${item.active ? sc.text : 'text-slate-500'}`}>{item.range}</span>
              <span className={`text-[10px] ${item.active ? `font-bold ${sc.text}` : 'text-slate-400'}`}>{item.label}</span>
              <span className="ml-auto text-[9px] font-mono text-slate-300">{item.mmRef}</span>
              {item.active && <span className={`text-[9px] font-black ${sc.text}`}>▲</span>}
            </div>
          ))}
        </div>

        {/* Interprétation */}
        {interpretation && (
          <p className={`mt-2.5 text-[10px] leading-relaxed rounded-lg border ${sc.border} ${sc.bg} px-2.5 py-1.5 ${sc.text}`}>{interpretation}</p>
        )}
      </div>
    </div>
  );
}

function ageFromBirthDate(value) {
  if (!value) return null;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}

function formatDateFr(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('fr-FR');
}

function statusDotClass(status) {
  if (status === 'ok' || status === 'Normal') return 'bg-emerald-500';
  if (status === 'Alerte') return 'bg-amber-500';
  return 'bg-red-500';
}

function formatMm3(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function niceCeil(value, step) {
  const safe = Math.max(1, Number(value || 0));
  return Math.ceil(safe / step) * step;
}

function ComparativeGroupedChart({ title, unit, yTicks, yMax, series, categories }) {
  const safeMax = Math.max(1, Number(yMax || 1));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-blue-600">{title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[72px_1fr] gap-3">
        <div className="relative h-72">
          {yTicks.map((tick) => {
            const p = (tick / safeMax) * 100;
            return (
              <span
                key={tick}
                className="absolute -translate-y-1/2 text-right text-[12px] text-slate-500"
                style={{ bottom: `${p}%`, right: 0, width: '100%' }}
              >
                {`${Number(tick).toLocaleString('fr-FR')} ${unit}`}
              </span>
            );
          })}
        </div>

        <div className="relative h-72 rounded-xl border border-slate-200 bg-slate-50 px-4 pb-8 pt-3">
          {yTicks.map((tick) => {
            const p = (tick / safeMax) * 100;
            return (
              <span
                key={`line-${tick}`}
                className="absolute left-0 right-0 border-t border-slate-200"
                style={{ bottom: `${p}%` }}
              />
            );
          })}

          <div className="relative z-10 flex h-full items-end justify-around gap-5">
            {categories.map((cat) => (
              <div key={cat.label} className="flex h-full min-w-[90px] flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-1.5">
                  {series.map((s) => {
                    const v = Number(cat.values?.[s.key] || 0);
                    const h = (v / safeMax) * 100;
                    return (
                      <span
                        key={`${cat.label}-${s.key}`}
                        className="w-7 rounded-t-md"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          backgroundColor: s.color,
                          border: s.borderColor ? `2px solid ${s.borderColor}` : 'none',
                        }}
                        title={`${cat.label} - ${s.label}: ${v.toFixed(2)} ${unit}`}
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[13px] font-medium leading-5 text-slate-600">{cat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportPreviewModal({
  open,
  onClose,
  onExport,
  exportTargetRef,
  exportLoading,
  runInfo,
  modelingResult,
  patientDetail,
  toAbsoluteMediaUrl,
  doctorConclusion,
  doctorRecommendations,
  recommendations,
}) {
  if (!open || !modelingResult) return null;

  const ci = modelingResult?.clinical_indices || {};
  const vols = modelingResult?.volumes_mm3 || {};
  const ref = modelingResult?.reference_values_mm3 || {};
  const interp = modelingResult?.clinical_interpretation || {};

  const sex = patientDetail?.sexe === 'F' ? 'Feminin' : patientDetail?.sexe === 'M' ? 'Masculin' : '-';
  const age = ageFromBirthDate(patientDetail?.date_naissance);
  const examDate = formatDateFr(runInfo?.completed_at || runInfo?.created_at);

  const allSlices = Array.isArray(runInfo?.results)
    ? [...runInfo.results].sort((a, b) => (a.slice_index || 0) - (b.slice_index || 0))
    : [];

  const measures = [
    {
      name: 'Volume hippocampe gauche',
      value: `${Number(vols.left || 0).toFixed(0)} mm3`,
      norm: '2200 - 2600',
      status: Number(vols.left || 0) >= 2200 && Number(vols.left || 0) <= 2600 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Volume hippocampe droit',
      value: `${Number(vols.right || 0).toFixed(0)} mm3`,
      norm: '2200 - 2600',
      status: Number(vols.right || 0) >= 2200 && Number(vols.right || 0) <= 2600 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Volume total',
      value: `${Number(vols.total || 0).toFixed(0)} mm3`,
      norm: '4500 - 5300',
      status: Number(vols.total || 0) >= 4500 && Number(vols.total || 0) <= 5300 ? 'Normal' : 'Alerte',
    },
    {
      name: "Indice d'asymetrie (IA)",
      value: `${Math.abs(Number(ci.asymmetry_index_percent || 0)).toFixed(2)} %`,
      norm: '< 10 %',
      status: Math.abs(Number(ci.asymmetry_index_percent || 0)) < 10 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Indice de normalisation (IN)',
      value: `${Number(ci.normality_index_percent || 0).toFixed(2)} %`,
      norm: '90 - 110 %',
      status: Number(ci.normality_index_percent || 0) >= 90 && Number(ci.normality_index_percent || 0) <= 110 ? 'Normal' : 'Alerte',
    },
  ];

  const bars = [
    { label: 'Hippocampe gauche', patient: Number(vols.left || 0), norm: 2430 },
    { label: 'Hippocampe droit', patient: Number(vols.right || 0), norm: 2430 },
    { label: 'Volume total', patient: Number(vols.total || 0), norm: Number(ref.normative_total_mean || 4860) },
  ];
  const barMax = Math.max(1, ...bars.map((b) => Math.max(b.patient, b.norm)));

  const volumeCategories = [
    {
      label: 'Hippocampe gauche',
      values: {
        patient: Number(vols.left || 0),
        minNorm: Number(ref.left_min_mm3 || 2200),
        maxNorm: Number(ref.left_max_mm3 || 2600),
      },
    },
    {
      label: 'Hippocampe droit',
      values: {
        patient: Number(vols.right || 0),
        minNorm: Number(ref.right_min_mm3 || 2200),
        maxNorm: Number(ref.right_max_mm3 || 2600),
      },
    },
    {
      label: 'Volume total',
      values: {
        patient: Number(vols.total || 0),
        minNorm: Number(ref.total_min_mm3 || 4500),
        maxNorm: Number(ref.total_max_mm3 || 5300),
      },
    },
  ];

  const volumeMaxValue = niceCeil(
    Math.max(
      5300,
      ...volumeCategories.flatMap((c) => [
        Number(c.values.patient || 0),
        Number(c.values.minNorm || 0),
        Number(c.values.maxNorm || 0),
      ]),
    ) * 1.03,
    500,
  );
  const volumeTicks = [1500, 2500, 3500, 4500, volumeMaxValue].filter((v, i, arr) => v <= volumeMaxValue && arr.indexOf(v) === i);

  const iaValue = Math.abs(Number(ci.asymmetry_index_percent || 0));
  const inValue = Number(ci.normality_index_percent || 0);
  const indicesCategories = [
    {
      label: 'IA - Asymetrie (%)',
      values: {
        patient: iaValue,
        seuil: 10,
      },
    },
    {
      label: 'IN - Normalisation (%)',
      values: {
        patient: inValue,
        seuil: 90,
      },
    },
  ];
  const indicesMaxValue = niceCeil(
    Math.max(120, ...indicesCategories.flatMap((c) => [Number(c.values.patient || 0), Number(c.values.seuil || 0)])) * 1.08,
    10,
  );
  const indexTicks = [0, 20, 40, 60, 80, 100, 120, indicesMaxValue]
    .filter((v, i, arr) => v <= indicesMaxValue && arr.indexOf(v) === i)
    .sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 overflow-y-auto">
      <div ref={exportTargetRef} className="w-[96vw] max-w-[1180px] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-glass animate-slide-up">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <p className="text-lg font-bold text-slate-900 tracking-tight">Apercu du rapport clinique</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exportLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              {exportLoading ? 'Generation...' : 'Exporter PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[85vh] overflow-y-auto">
          <div className="px-8 py-6 space-y-6">

            {/* En-tête */}
            <div className="flex items-start justify-between border-b-2 border-blue-600 pb-5">
              <div>
                <p className="text-3xl font-black tracking-tight text-slate-900">Brain<span className="text-blue-600">Core</span></p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rapport de volumétrie hippocampique — Analyse assistée par IA</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date du rapport</p>
                <p className="text-xl font-black text-blue-600">{examDate}</p>
              </div>
            </div>

            {/* Informations patient */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Informations patient</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: UserRound,    label: 'Sexe',          value: sex,                              bg: 'bg-blue-50',    iconCls: 'text-blue-500' },
                  { icon: Hash,         label: 'Âge',           value: age != null ? `${age} ans` : '-', bg: 'bg-emerald-50', iconCls: 'text-emerald-500' },
                  { icon: CalendarDays, label: "Date d'examen", value: examDate,                        bg: 'bg-violet-50',  iconCls: 'text-violet-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                      <item.icon className={`h-4 w-4 ${item.iconCls}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mesures + modèle 3D côte à côte */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="bg-gradient-to-r from-[#0f1f4b] to-[#1a3a8f] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Mesures volumétriques</p>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-bold uppercase text-slate-500">Mesure</th>
                      <th className="px-4 py-2 text-[10px] font-bold uppercase text-slate-500">Valeur</th>
                      <th className="px-4 py-2 text-[10px] font-bold uppercase text-slate-500">Norme</th>
                      <th className="px-4 py-2 text-[10px] font-bold uppercase text-slate-500">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {measures.map((row) => (
                      <tr key={row.name}>
                        <td className="px-4 py-2 font-medium text-slate-700">{row.name}</td>
                        <td className="px-4 py-2 font-black tabular-nums text-blue-600">{row.value}</td>
                        <td className="px-4 py-2 text-xs text-slate-400">{row.norm}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.status === 'Normal' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(row.status)}`} />{row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-slate-900 px-4 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Reconstruction 3D — Hippocampe</p>
                  </div>
                  <div className="p-2">
                    <ModelViewerBlender variant="mini" objUrl={toAbsoluteMediaUrl(modelingResult?.obj_url)} stlUrl={toAbsoluteMediaUrl(modelingResult?.stl_url)} />
                  </div>
                </div>
                {allSlices.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Coupes représentatives ({allSlices.length} analysées)</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {(() => {
                        const n = allSlices.length;
                        const idxs = n <= 6 ? allSlices.map((_, i) => i) : [0, Math.floor(n*0.2), Math.floor(n*0.4), Math.floor(n*0.6), Math.floor(n*0.8), n-1];
                        return idxs.map((i) => {
                          const s = allSlices[i];
                          return (
                            <div key={s?.id || i} className="overflow-hidden rounded-lg bg-slate-900 border border-slate-700">
                              <div className="relative aspect-square">
                                {s?.source_url ? (<><img src={toAbsoluteMediaUrl(s.source_url)} alt={`c${i}`} className="h-full w-full object-cover" />{s?.mask_url && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundColor:'rgba(6,182,212,0.5)', WebkitMaskImage:`url(${toAbsoluteMediaUrl(s.mask_url)})`, maskImage:`url(${toAbsoluteMediaUrl(s.mask_url)})`, WebkitMaskSize:'cover', maskSize:'cover' }} />}</>) : <div className="flex h-full items-center justify-center"><Brain className="h-4 w-4 text-slate-500" /></div>}
                              </div>
                              <p className="py-0.5 text-center text-[9px] font-bold text-slate-400">#{s?.slice_index ?? i+1}</p>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interprétation automatique */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-gradient-to-r from-[#0f1f4b] to-[#1a3a8f] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white">Interprétation clinique automatique</p>
                <p className="mt-0.5 text-[10px] text-blue-300">Générée par le système IA — doit être validée par un clinicien</p>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-500" /><p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Épilepsie (MTLE) — IA = {iaValue.toFixed(2)} %</p></div>
                  <p className="text-sm leading-relaxed text-slate-700">{interp.mtle_message || interp.ai_message || '—'}</p>
                </div>
                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Alzheimer (MA) — IN = {inValue.toFixed(2)} %</p></div>
                  <p className="text-sm leading-relaxed text-slate-700">{interp.ni_message || '—'}</p>
                </div>
              </div>
            </div>


          {/* ── Conclusion du médecin dans le rapport ── */}
          {(doctorConclusion || (doctorRecommendations && doctorRecommendations.size > 0)) && (
            <div className="mt-6 overflow-hidden rounded-xl border-2 border-slate-800">
              <div className="bg-slate-900 px-5 py-3">
                <p className="text-sm font-black uppercase tracking-wider text-white">
                  Conclusion et recommandations cliniques
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Rédigée par {runInfo?.doctor_name || runInfo?.created_by || 'le médecin responsable'} · {examDate}
                </p>
              </div>
              <div className="bg-white px-5 py-4 space-y-4">
                {doctorConclusion && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Synthèse clinique</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{doctorConclusion}</p>
                  </div>
                )}
                {doctorRecommendations && doctorRecommendations.size > 0 && (
                  <div className={doctorConclusion ? 'border-t border-slate-100 pt-4' : ''}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recommandations</p>
                    <ul className="space-y-1">
                      {recommendations?.filter((r) => doctorRecommendations.has(r.id)).map((r) => (
                        <li key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-700" />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <p className="text-[10px] italic text-slate-400">
                    Cette conclusion engage la responsabilité médicale du praticien signataire.
                  </p>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-700">{runInfo?.doctor_name || runInfo?.created_by || '___________________'}</p>
                    <p className="text-[10px] text-slate-400">Signature du médecin</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>BrainCore — Plateforme de neuro-imagerie clinique</span>
            <span>Rapport généré le {examDate}</span>
          </div>
          </div>{/* fin px-8 py-6 space-y-6 */}
        </div>
      </div>
    </div>
  );
}

export default function Modelisation3D({ user = null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmergencySession = Boolean(user?.is_emergency_session);
  const runId = Number(searchParams.get('run'));
  const reportPreviewRef = useRef(null);

  const [loadingRun, setLoadingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [runInfo, setRunInfo] = useState(null);
  const [modelingLoading, setModelingLoading] = useState(false);
  const [modelingError, setModelingError] = useState('');
  const [modelingResult, setModelingResult] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(null); // { id, date }
  const [archiveError, setArchiveError] = useState('');
  const [existingReport, setExistingReport] = useState(null); // rapport déjà archivé pour ce run
  const [otherPatientReports, setOtherPatientReports] = useState([]); // autres runs archivés du même patient
  const [reportError, setReportError] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportPatientDetail, setReportPatientDetail] = useState(null);
  const [doctorConclusion, setDoctorConclusion] = useState('');
  const [doctorRecommendations, setDoctorRecommendations] = useState(new Set());
  const toggleRecommendation = (id) =>
    setDoctorRecommendations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const RECOMMENDATIONS = [
    { id: 'suivi_irm_6',            label: 'Suivi IRM dans 6 mois' },
    { id: 'suivi_irm_12',           label: 'Suivi IRM dans 12 mois' },
    { id: 'consultation_neuro',     label: 'Consultation neurologique' },
    { id: 'bilan_neuropsycho',      label: 'Bilan neuropsychologique' },
    { id: 'examen_complementaire',  label: 'Examen complémentaire' },
    { id: 'aucun_suivi',            label: 'Aucun suivi particulier' },
  ];
  /** Formulaire « mode standard » en popup compact ; se ferme après une modélisation réussie. */
  const [standardConfigOpen, setStandardConfigOpen] = useState(true);

  const [standardMode, setStandardMode] = useState({
    structure: 'both',
    quality: 'standard',
    smoothing: 'low',
    threshold: '0.75',
    knowsSpacing: false,
    spacingZ: '1.0',
    spacingY: '1.0',
    spacingX: '1.0',
    useCustomReference: false,
    normativeTotalMeanMm3: '4860.14',
    normativeTotalStdMm3: '201.16',
  });

  useEffect(() => {
    if (!Number.isFinite(runId) || runId <= 0) {
      setRunError('Run de segmentation invalide.');
      return;
    }

    const fetchRun = async () => {
      setLoadingRun(true);
      setRunError('');
      try {
        const token = localStorage.getItem('access');
        const response = await api.get(`/segmentation-runs/${runId}/`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const run = response?.data?.run;
        if (!run) {
          setRunError('Impossible de recuperer ce run de segmentation.');
          return;
        }

        setRunInfo(run);
        if (run?.threshold != null) {
          setStandardMode((prev) => ({ ...prev, threshold: String(run.threshold) }));
        }

        // Vérifier si un rapport a déjà été archivé pour ce run (+ historique patient)
        if (run?.patient) {
          try {
            const rToken = localStorage.getItem('access');
            const rRes = await api.get(`/patients/${run.patient}/reports/list/`, {
              headers: rToken ? { Authorization: `Bearer ${rToken}` } : {},
            });
            const allReports = rRes.data?.reports || [];
            const existing = allReports.find((r) => r.run_id === run.id);
            if (existing) setExistingReport(existing);
            setOtherPatientReports(allReports.filter((r) => r.run_id !== run.id));
          } catch { /* silencieux */ }
        }
      } catch {
        setRunError('Impossible de charger le run de segmentation.');
      } finally {
        setLoadingRun(false);
      }
    };

    fetchRun();
  }, [runId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setStandardMode((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLaunchModeling = () => {
    if (!Number.isFinite(runId) || runId <= 0) return;

    const payload = {
      structure: standardMode.structure,
      quality: standardMode.quality,
      smoothing: standardMode.smoothing,
      spacing_z: standardMode.knowsSpacing ? standardMode.spacingZ : 1.0,
      spacing_y: standardMode.knowsSpacing ? standardMode.spacingY : 1.0,
      spacing_x: standardMode.knowsSpacing ? standardMode.spacingX : 1.0,
      ...(standardMode.useCustomReference
        ? {
            normative_total_mean_mm3: standardMode.normativeTotalMeanMm3,
            normative_total_std_mm3: standardMode.normativeTotalStdMm3,
          }
        : {}),
    };

    const run = async () => {
      setModelingLoading(true);
      setModelingError('');
      setModelingResult(null);
      try {
        const token = localStorage.getItem('access');
        const response = await api.post(`/segmentation-runs/${runId}/modelisation-3d/`, payload, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeout: 300000,
        });

        const result = response?.data?.modelisation;
        if (!result) {
          setModelingError('Aucun resultat de modelisation 3D retourne par le serveur.');
          return;
        }
        setModelingResult(result);
        setStandardConfigOpen(false);
      } catch (err) {
        const apiMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.response?.data?.message;
        setModelingError(apiMessage || 'Echec de la modelisation 3D.');
      } finally {
        setModelingLoading(false);
      }
    };

    run();
  };

  const handleDownloadReportPdf = async () => {
    if (!Number.isFinite(runId) || runId <= 0 || !reportPreviewRef.current) {
      console.error('Invalid state for PDF export:', { runId, refExists: !!reportPreviewRef.current });
      return;
    }
    setReportLoading(true);
    setReportError('');

    try {
      const target = reportPreviewRef.current;
      console.log('Starting PDF export with target:', target);
      
      const scale = Math.min(2.2, Math.max(1.4, window.devicePixelRatio || 1.5));
      const canvas = await html2canvas(target, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale,
        logging: false,
      });

      console.log('Canvas created:', canvas.width, 'x', canvas.height);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const scaledHeight = (canvas.height * usableWidth) / canvas.width;

      let rendered = 0;
      let pageIndex = 0;
      while (rendered < scaledHeight) {
        if (pageIndex > 0) pdf.addPage();
        const remaining = scaledHeight - rendered;
        const drawHeight = Math.min(pageHeight - margin * 2, remaining);

        pdf.addImage(
          imgData,
          'PNG',
          margin,
          margin - rendered,
          usableWidth,
          scaledHeight,
          undefined,
          'FAST',
        );

        rendered += drawHeight;
        pageIndex += 1;
      }

      pdf.save(`rapport_segmentation_run_${runId}.pdf`);
      console.log('PDF exported successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      setReportError(`Echec generation du rapport PDF: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenReportPreview = async () => {
    setReportPreviewOpen(true);
    setReportError('');

    if (!runInfo?.patient) return;
    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/patients/${runInfo.patient}/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const patient = response?.data?.patient || response?.data;
      setReportPatientDetail(patient || null);
    } catch {
      setReportPatientDetail(null);
    }
  };

  const buildArchivePdfBlob = (patientDetail) => {
    // Helpers
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const m = 15;
    const w = W - m * 2;
    let y = m;
    const nl = (n = 5) => { y += n; };
    const sep = () => {
      pdf.setDrawColor(226, 232, 240);
      pdf.line(m, y, W - m, y);
      nl(5);
    };
    const check = (needed = 30) => {
      if (y + needed > H - 15) { pdf.addPage(); y = m; }
    };
    // Remplacer les caracteres non supportes par Helvetica de base
    const safe = (s) => String(s || '-')
      .replace(/³/g, '3')   // ³ -> 3
      .replace(/–/g, '-')   // en dash
      .replace(/—/g, '-')   // em dash
      .replace(/•/g, '-')   // bullet
      .replace(/’/g, "'");  // right single quote

    const vols   = modelingResult?.volumes_mm3 || {};
    const ci     = modelingResult?.clinical_indices || {};
    const interp = modelingResult?.clinical_interpretation || {};
    const ia     = Math.abs(Number(ci.asymmetry_index_percent || 0));
    const inn    = Number(ci.normality_index_percent || 0);
    const age    = ageFromBirthDate(patientDetail?.date_naissance);
    const sex    = patientDetail?.sexe === 'F' ? 'Feminin' : patientDetail?.sexe === 'M' ? 'Masculin' : '-';
    const exDate = formatDateFr(runInfo?.completed_at || runInfo?.created_at);
    const runId  = String(runInfo?.id || '-');
    const today  = new Date().toLocaleDateString('fr-FR');

    // ── En-tete ──────────────────────────────────────────────
    pdf.setFillColor(15, 31, 75);
    pdf.rect(0, 0, W, 26, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(255, 255, 255);
    pdf.text('BrainCore', m, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(147, 197, 253);
    pdf.text('Rapport de volumetrie hippocampique - Analyse assistee par IA', m, 22);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Run #' + runId, W - m, 13, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(exDate, W - m, 20, { align: 'right' });
    y = 34;

    // ── Patient ───────────────────────────────────────────────
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text('INFORMATIONS PATIENT', m, y);
    nl(5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Sexe : ' + sex, m, y);
    pdf.text('Age : ' + (age != null ? age + ' ans' : '-'), m + 55, y);
    pdf.text('Date examen : ' + exDate, m + 110, y);
    nl(9);
    sep();

    // ── Tableau mesures ───────────────────────────────────────
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text('MESURES VOLUMETRIQUES', m, y);
    nl(5);
    pdf.setFillColor(15, 31, 75);
    pdf.rect(m, y, w, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.text('Mesure', m + 2, y + 5);
    pdf.text('Valeur', m + 105, y + 5);
    pdf.text('Norme', m + 135, y + 5);
    pdf.text('Statut', m + 162, y + 5);
    nl(7);

    const rows = [
      ['Vol. hippocampe gauche', Number(vols.left  || 0).toFixed(0) + ' mm3', '2200-2600', Number(vols.left  || 0) >= 2200 && Number(vols.left  || 0) <= 2600],
      ['Vol. hippocampe droit',  Number(vols.right || 0).toFixed(0) + ' mm3', '2200-2600', Number(vols.right || 0) >= 2200 && Number(vols.right || 0) <= 2600],
      ['Volume total',           Number(vols.total || 0).toFixed(0) + ' mm3', '4500-5300', Number(vols.total || 0) >= 4500 && Number(vols.total || 0) <= 5300],
      ["Indice asymetrie (IA)",  ia.toFixed(2) + ' %',  '< 10 %',   ia < 10],
      ['Indice normalisation (IN)', inn.toFixed(2) + ' %', '90-110 %', inn >= 90 && inn <= 110],
    ];

    rows.forEach(([label, val, norm, ok], i) => {
      check(8);
      if (i % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(m, y, w, 7, 'F'); }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(30, 41, 59);
      pdf.text(label, m + 2, y + 5);
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(37, 99, 235);
      pdf.text(val, m + 105, y + 5);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139);
      pdf.text(norm, m + 135, y + 5);
      pdf.setTextColor(ok ? 5 : 180, ok ? 150 : 100, ok ? 90 : 30);
      pdf.text(ok ? 'Normal' : 'Alerte', m + 162, y + 5);
      nl(7);
    });
    nl(2);
    sep();

    // ── Interpretation ────────────────────────────────────────
    check(40);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
    pdf.text('INTERPRETATION CLINIQUE AUTOMATIQUE', m, y);
    nl(5);

    const block = (rawText, tr, tg, tb, fr, fg, fb) => {
      const text = safe(rawText);
      const lines = pdf.splitTextToSize(text, w - 4);
      const bh = lines.length * 5 + 6;
      check(bh + 4);
      pdf.setFillColor(fr, fg, fb);
      pdf.rect(m, y, w, bh, 'F');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(tr, tg, tb);
      pdf.text(lines, m + 2, y + 5);
      nl(bh + 4);
    };

    block(
      'MTLE - IA = ' + ia.toFixed(2) + '% : ' + (interp.mtle_message || interp.ai_message || '-'),
      109, 40, 217, 245, 243, 255
    );
    block(
      'Alzheimer MA - IN = ' + inn.toFixed(2) + '% : ' + (interp.ni_message || '-'),
      4, 120, 87, 240, 253, 244
    );
    sep();

    // ── Conclusion medecin ────────────────────────────────────
    if (doctorConclusion || doctorRecommendations.size > 0) {
      check(50);
      pdf.setFillColor(15, 31, 75);
      pdf.rect(0, y - 2, W, 12, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255);
      pdf.text('CONCLUSION ET RECOMMANDATIONS CLINIQUES', m, y + 6);
      nl(14);

      if (doctorConclusion) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
        pdf.text('Synthese clinique', m, y);
        nl(5);
        const cLines = pdf.splitTextToSize(safe(doctorConclusion), w);
        check(cLines.length * 5 + 5);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
        pdf.text(cLines, m, y);
        nl(cLines.length * 5 + 6);
      }

      const checkedRecs = RECOMMENDATIONS.filter((r) => doctorRecommendations.has(r.id));
      if (checkedRecs.length > 0) {
        check(10 + checkedRecs.length * 7);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
        pdf.text('Recommandations', m, y);
        nl(5);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
        checkedRecs.forEach((r) => { pdf.text('- ' + safe(r.label), m + 3, y); nl(6); });
        nl(3);
      }

      sep();
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(30, 41, 59);
      pdf.text(safe(runInfo?.doctor_name || runInfo?.created_by || '_____________________'), W - m, y, { align: 'right' });
      nl(4);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
      pdf.text('Signature du medecin responsable', W - m, y, { align: 'right' });
      nl(4);
      pdf.text('Cette conclusion engage la responsabilite medicale du praticien signataire.', W - m, y, { align: 'right' });
    }

    // ── Pied de page ──────────────────────────────────────────
    const totalPages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, H - 10, W, 10, 'F');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
      pdf.text('BrainCore - Plateforme de neuro-imagerie clinique', m, H - 4);
      pdf.text('Page ' + p + ' / ' + totalPages + '  |  ' + today, W - m, H - 4, { align: 'right' });
    }

    return pdf.output('blob');
  };

  const handleArchiveReport = async () => {
    if (!runInfo?.patient || !modelingResult) return;
    setArchiving(true);
    setArchiveError('');
    setArchiveSuccess(null);
    try {
      // Charger les infos patient si besoin
      let patientDetail = reportPatientDetail;
      if (!patientDetail) {
        try {
          const token = localStorage.getItem('access');
          const r = await api.get(`/patients/${runInfo.patient}/`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          patientDetail = r?.data?.patient || r?.data || null;
          setReportPatientDetail(patientDetail);
        } catch { /* continue sans */ }
      }

      // Générer le PDF via jsPDF (pas de html2canvas = pas de problème oklab)
      const pdfBlob = buildArchivePdfBlob(patientDetail);

      // Envoyer au backend
      const token = localStorage.getItem('access');
      const filename = `rapport_run${runInfo?.id || 'X'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const formData = new FormData();
      formData.append('pdf', pdfBlob, filename);
      if (runInfo?.id) formData.append('run_id', String(runInfo.id));
      formData.append('doctor_conclusion', doctorConclusion || '');
      formData.append('doctor_recommendations', JSON.stringify(
        RECOMMENDATIONS.filter((r) => doctorRecommendations.has(r.id)).map((r) => r.label)
      ));
      const totalVol = modelingResult?.volumes_mm3?.total;
      if (totalVol) formData.append('total_volume_mm3', String(totalVol));
      const leftVol  = modelingResult?.volumes_mm3?.left;
      const rightVol = modelingResult?.volumes_mm3?.right;
      if (leftVol  != null) formData.append('left_volume_mm3',  String(leftVol));
      if (rightVol != null) formData.append('right_volume_mm3', String(rightVol));
      const res = await api.post(`/patients/${runInfo.patient}/reports/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const newReport = { id: res.data.report_id, date: res.data.created_at };
      setArchiveSuccess(newReport);
      setExistingReport({ ...newReport, created_at: res.data.created_at, doctor_name: 'vous', file_url: null, run_id: runInfo?.id });
    } catch (err) {
      // Cas spécial : même IRM déjà enregistré dans le dossier patient (HTTP 409)
      if (err?.response?.status === 409 && err?.response?.data?.already_saved) {
        const d = err.response.data;
        setExistingReport({
          id: d.existing_report_id,
          created_at: d.existing_report_date,
          doctor_name: 'un médecin',
          file_url: null,
          run_id: null,
          same_mri: true,
        });
        setArchiveError(d.error || 'Ce résultat est déjà enregistré dans le dossier patient.');
      } else {
        const msg = err?.response?.data?.error || err?.message || 'Erreur lors de l\'archivage.';
        setArchiveError(msg);
      }
    } finally {
      setArchiving(false);
    }
  };

  const toAbsoluteMediaUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
  };

  const aiValue = Math.abs(Number(modelingResult?.clinical_indices?.asymmetry_index_percent || 0));
  const niValue = Number(modelingResult?.clinical_indices?.normality_index_percent || 0);
  const aiMeaning = modelingResult?.clinical_interpretation?.ai_message || '';
  const niMeaning = modelingResult?.clinical_interpretation?.ni_message || '';
  const mtleMeaning = modelingResult?.clinical_interpretation?.mtle_message || '-';
  const globalConclusion = modelingResult?.clinical_interpretation?.summary || '-';
  const aiStatus = getAiStatus(aiValue).label;
  const niStatus = getNiStatus(niValue).label;
  const conciseConclusion =
    niStatus === 'Severe'
      ? 'Atrophie hippocampique significative — corrélation clinique indispensable.'
      : niStatus === 'Alerte'
        ? 'Légère réduction volumique hippocampique — surveillance et comparaison évolutive recommandées.'
        : niStatus === 'Haut'
          ? 'Volume hippocampique supérieur à la norme — à interpréter selon le contexte clinique.'
          : aiStatus === 'Normal'
            ? 'Profil volumétrique dans les normes, sans latéralisation significative.'
            : 'Asymétrie hippocampique modérée — suivi clinique conseillé.';

  const fieldClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Barre de navigation ── */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => navigate(`/segmentation/nouvelle?run=${runId}`)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Retour aux résultats
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <Box className="h-3.5 w-3.5" />
              Reconstruction 3D
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4 md:p-6">

        {loadingRun && (
          <div className="flex h-32 items-center justify-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          </div>
        )}

        {!loadingRun && runError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{runError}</div>
        ) : null}

        {!loadingRun && !runError && runInfo && standardConfigOpen ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Fermer la fenetre"
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-[3px]"
              onClick={() => setStandardConfigOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modelisation-3d-standard-title"
              className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── En-tête gradient ── */}
              <div className="relative overflow-hidden bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-6 py-5 shrink-0">
                <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                      <Box className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <div>
                      <h1 id="modelisation-3d-standard-title" className="text-base font-black text-white">
                        Reconstruction 3D — Configuration
                      </h1>
                      <p className="mt-0.5 text-[12px] text-blue-200">
                        Paramétrez les options cliniques avant de lancer la modélisation
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStandardConfigOpen(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── Corps ── */}
              <div className="px-6 py-5 space-y-5">

                {/* Résumé de l'analyse */}
                <div className="flex items-center gap-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modèle utilisé</p>
                    <p className="text-sm font-black text-slate-800 mt-0.5">{runInfo.model_key?.toUpperCase() || 'UNETPP'}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Coupes analysées</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">{runInfo.selected_count || runInfo.processed_count || 0} coupes</p>
                  </div>
                </div>


                {/* Résolution voxel */}
                <div className={`rounded-xl border transition-colors ${standardMode.knowsSpacing ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Résolution voxel IRM</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Précisez les dimensions spatiales des voxels en mm</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="knowsSpacing" checked={standardMode.knowsSpacing} onChange={handleChange} className="sr-only peer" />
                      <div className="h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                  {standardMode.knowsSpacing && (
                    <div className="border-t border-blue-100 px-4 pb-4 pt-3 grid grid-cols-3 gap-3">
                      {[['spacingX', 'X — Largeur'], ['spacingY', 'Y — Hauteur'], ['spacingZ', 'Z — Épaisseur']].map(([name, label]) => (
                        <div key={name}>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
                          <div className="relative">
                            <input name={name} value={standardMode[name]} onChange={handleChange}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">mm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {modelingError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-sm text-red-700">{modelingError}</p>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={handleLaunchModeling}
                  disabled={modelingLoading}
                  className="inline-flex min-w-[14rem] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {modelingLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Reconstruction en cours…
                    </>
                  ) : (
                    <>
                      <Box className="h-4 w-4" />
                      Lancer la reconstruction 3D
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loadingRun && !runError && runInfo && !standardConfigOpen && !modelingResult ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-12 shadow-sm">
            <p className="max-w-md text-center text-sm text-slate-600">
              La fenetre de configuration est fermee. Rouvrez-la pour regler les parametres et lancer la modelisation 3D.
            </p>
            <button
              type="button"
              onClick={() => setStandardConfigOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            >
              <Box className="h-4 w-4" />
              Ouvrir la configuration
            </button>
          </div>
        ) : null}

        {modelingResult ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                    {/* Header épuré */}
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                          <Box className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Reconstruction volumétrique</p>
                          <p className="text-sm font-bold text-slate-800 leading-tight">Modèle 3D — Hippocampe</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStandardConfigOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <Box className="h-3.5 w-3.5" />
                        Reconfigurer
                      </button>
                    </div>
                    <div className="p-4 md:p-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1">
                        {modelingResult.context_brain_obj_url ? (
                          <ModelViewerBlender
                            brainObjUrl={toAbsoluteMediaUrl(modelingResult.context_brain_obj_url)}
                            objUrl={toAbsoluteMediaUrl(modelingResult.obj_url)}
                            stlUrl={toAbsoluteMediaUrl(modelingResult.stl_url)}
                            meshColor="#e11d48"
                            brainOpacity={0.2}
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                              {modelingResult.context_brain_error ||
                                "Contexte cerveau indisponible : affichage hippocampe seul (previews IRM du run requises pour l'enveloppe). Les options cerveau dans Outils n'apparaissent qu'avec le double maillage."}
                            </div>
                            <ModelViewerBlender
                              objUrl={toAbsoluteMediaUrl(modelingResult.obj_url)}
                              stlUrl={toAbsoluteMediaUrl(modelingResult.stl_url)}
                              meshColor="#e11d48"
                            />
                          </div>
                        )}
                      </div>

                      <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-100 pt-4 xl:w-[22rem] xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0 2xl:w-[24rem]">

                        {/* ── Volumes hippocampe ── */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Volumes hippocampe</p>
                          </div>
                          <div className="p-4 space-y-3">
                            {(() => {
                              const left  = Number(modelingResult?.volumes_mm3?.left  || 0);
                              const right = Number(modelingResult?.volumes_mm3?.right || 0);
                              const total = Number(modelingResult?.volumes_mm3?.total || 0);
                              const maxVal = Math.max(left, right, 1);
                              return [
                                { label: 'Gauche', mm3: left,  ml: modelingResult?.volumes_ml?.left,  bar: 'bg-blue-400',    text: 'text-blue-700',   pct: (left/maxVal)*100 },
                                { label: 'Droit',  mm3: right, ml: modelingResult?.volumes_ml?.right, bar: 'bg-violet-400',  text: 'text-violet-700', pct: (right/maxVal)*100 },
                                { label: 'Total',  mm3: total, ml: modelingResult?.volumes_ml?.total, bar: 'bg-emerald-400', text: 'text-emerald-700', pct: 100, highlight: true },
                              ].map((v) => (
                                <div key={v.label} className={`rounded-xl border px-3 py-2.5 ${v.highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                                    <span className="text-xs font-bold text-slate-600">{v.label}</span>
                                    <div className="text-right">
                                      <span className={`text-sm font-black tabular-nums ${v.text}`}>
                                        {v.mm3.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³
                                      </span>
                                      <span className="ml-2 text-[10px] text-slate-400">{Number(v.ml || 0).toFixed(2)} mL</span>
                                    </div>
                                  </div>
                                  {!v.highlight && (
                                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                      <div className={`h-full rounded-full ${v.bar} transition-all duration-700`} style={{ width: `${v.pct}%` }} />
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>

                        {/* ── Enveloppe cerveau ── */}
                        {modelingResult.context_brain_volume_voxel_mm3 != null && (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                              <span className="h-2 w-2 rounded-full bg-slate-400" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Enveloppe cerveau</p>
                              <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600">Approximation</span>
                            </div>
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Volume voxel</span>
                                <div className="text-right">
                                  <span className="text-sm font-bold tabular-nums text-slate-800">
                                    {Number(modelingResult.context_brain_volume_voxel_mm3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³
                                  </span>
                                  <span className="ml-1.5 text-[10px] text-slate-400">{Number(modelingResult.context_brain_volume_voxel_ml || 0).toFixed(2)} mL</span>
                                </div>
                              </div>
                              {modelingResult.context_brain_volume_mesh_mm3 != null && (
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                  <span className="text-xs text-slate-500">Volume maillage</span>
                                  <span className="text-sm font-bold tabular-nums text-slate-800">
                                    {Number(modelingResult.context_brain_volume_mesh_mm3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³
                                  </span>
                                </div>
                              )}
                              <p className="text-[10px] text-slate-400 pt-1">Calculé à partir des coupes du run · pas un scanner osseux</p>
                            </div>
                          </div>
                        )}

                        {/* ── Maillage & coupes ── */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Maillage hippocampe</p>
                          </div>
                          <div className="p-4 space-y-2">
                            {[
                              { label: 'Volume voxel',    val: `${Number(modelingResult.volume_voxel_mm3 || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³`, sub: `${Number(modelingResult.volume_voxel_ml || 0).toFixed(3)} mL` },
                              { label: 'Volume surface',  val: modelingResult.volume_mesh_mm3 != null ? `${Number(modelingResult.volume_mesh_mm3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³` : '—', sub: modelingResult.volume_mesh_ml != null ? `${Number(modelingResult.volume_mesh_ml).toFixed(3)} mL` : 'Non watertight' },
                              { label: 'Coupes utilisées', val: String(modelingResult.slices_used || 0), sub: null },
                            ].map((row, i, arr) => (
                              <div key={row.label} className={`flex items-center justify-between gap-2 ${i < arr.length - 1 ? 'border-b border-slate-100 pb-2' : ''}`}>
                                <span className="text-xs text-slate-500">{row.label}</span>
                                <div className="text-right">
                                  <span className="text-sm font-bold tabular-nums text-slate-800">{row.val}</span>
                                  {row.sub && <span className="ml-1.5 text-[10px] text-slate-400">{row.sub}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ── Indices cliniques ── */}
                        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
                          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/80 px-4 py-2.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Indices cliniques</p>
                          </div>
                          <div className="p-4 space-y-2.5">
                            {[
                              { label: 'IA · asymétrie', val: `${aiValue.toFixed(2)} %`, color: aiValue <= 10 ? 'text-emerald-600' : aiValue <= 20 ? 'text-amber-600' : 'text-red-600', dot: aiValue <= 10 ? 'bg-emerald-400' : aiValue <= 20 ? 'bg-amber-400' : 'bg-red-400' },
                              { label: 'IN · normalisation', val: `${niValue.toFixed(2)} %`, color: niValue >= 90 && niValue <= 110 ? 'text-emerald-600' : niValue < 80 ? 'text-red-600' : 'text-amber-600', dot: niValue >= 90 && niValue <= 110 ? 'bg-emerald-400' : niValue < 80 ? 'bg-red-400' : 'bg-amber-400' },
                            ].map((row, i, arr) => (
                              <div key={row.label} className={`flex items-center justify-between gap-2 ${i < arr.length - 1 ? 'border-b border-blue-100 pb-2.5' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                                  <span className="text-xs font-semibold text-slate-600">{row.label}</span>
                                </div>
                                <span className={`text-sm font-black tabular-nums ${row.color}`}>{row.val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </aside>
                    </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-card">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <AIGauge
                        value={aiValue}
                        interpretation={mtleMeaning || aiMeaning}
                        leftVol={modelingResult?.volumes_mm3?.left}
                        rightVol={modelingResult?.volumes_mm3?.right}
                      />
                      <NIGauge value={niValue} interpretation={niMeaning} />
                    </div>

                    {(() => {
                      const severity = (aiValue > 20 || niValue < 80) ? 'danger' : (aiValue > 10 || niValue < 90 || niValue > 110) ? 'warn' : 'ok';
                      const sev = severity === 'ok'
                        ? { strip: 'from-emerald-400 to-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Profil normal', badge: 'bg-emerald-100 border-emerald-200 text-emerald-700' }
                        : severity === 'warn'
                          ? { strip: 'from-amber-400 to-orange-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Surveillance requise', badge: 'bg-amber-100 border-amber-200 text-amber-700' }
                          : { strip: 'from-red-500 to-rose-600', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Alerte clinique', badge: 'bg-red-100 border-red-200 text-red-700' };
                      return (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className={`h-1 w-full bg-gradient-to-r ${sev.strip}`} />
                          <div className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              {/* Gauche : label + texte + badges */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Synthèse clinique</p>
                                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black ${sev.badge}`}>{sev.label}</span>
                                </div>
                                <p className="text-sm font-black text-slate-900 leading-snug">{conciseConclusion}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {aiValue > 20 ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><Activity className="h-3 w-3" /> Asymétrie sévère (MTLE)</span>
                                  ) : aiValue > 10 ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Activity className="h-3 w-3" /> Asymétrie à surveiller</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><Brain className="h-3 w-3" /> Asymétrie normale</span>
                                  )}
                                  {niValue < 80 ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><Activity className="h-3 w-3" /> Atrophie marquée</span>
                                  ) : niValue < 90 ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Activity className="h-3 w-3" /> Légère réduction volumique</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><Brain className="h-3 w-3" /> Volume normal</span>
                                  )}
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">
                                    <CalendarDays className="h-3 w-3" />
                                    {(aiValue > 10 || niValue < 90) ? 'Suivi recommandé' : 'Suivi de routine'}
                                  </span>
                                </div>
                              </div>
                              {/* Droite : indices compacts */}
                              <div className="flex shrink-0 items-stretch gap-2">
                                <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 ${aiValue <= 10 ? 'border-emerald-200 bg-emerald-50' : aiValue <= 20 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Indice IA</p>
                                  <p className={`text-lg font-black tabular-nums ${aiValue <= 10 ? 'text-emerald-600' : aiValue <= 20 ? 'text-amber-600' : 'text-red-600'}`}>{aiValue.toFixed(2)}</p>
                                  <p className={`text-[10px] font-bold ${aiValue <= 10 ? 'text-emerald-500' : aiValue <= 20 ? 'text-amber-500' : 'text-red-500'}`}>%</p>
                                </div>
                                <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 ${niValue >= 90 ? 'border-emerald-200 bg-emerald-50' : niValue < 80 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Indice IN</p>
                                  <p className={`text-lg font-black tabular-nums ${niValue >= 90 ? 'text-emerald-600' : niValue < 80 ? 'text-red-600' : 'text-amber-600'}`}>{niValue.toFixed(2)}</p>
                                  <p className={`text-[10px] font-bold ${niValue >= 90 ? 'text-emerald-500' : niValue < 80 ? 'text-red-500' : 'text-amber-500'}`}>%</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ══ CONCLUSION DU MÉDECIN ══ */}
                  {!isEmergencySession && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                      {/* Header compact */}
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                            <UserRound className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800">Conclusion du médecin</p>
                            <p className="text-[10px] text-slate-400">{runInfo?.doctor_name || 'Médecin responsable'} · {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {[
                            { label: 'IA', val: `${aiValue.toFixed(1)}%`, ok: aiValue <= 10 },
                            { label: 'IN', val: `${niValue.toFixed(1)}%`, ok: niValue >= 90 },
                          ].map(idx => (
                            <span key={idx.label} className={`rounded-md border px-2 py-0.5 text-[9px] font-black ${idx.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                              {idx.label} {idx.val}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Textarea conclusion */}
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700" htmlFor="doctor-conclusion">
                              Conclusion clinique
                            </label>
                            <span className="text-[10px] text-slate-400">{doctorConclusion.length}/2000</span>
                          </div>
                          <textarea
                            id="doctor-conclusion"
                            rows={3}
                            maxLength={2000}
                            value={doctorConclusion}
                            onChange={(e) => setDoctorConclusion(e.target.value)}
                            placeholder="Interprétation clinique, observations morphologiques, recommandations…"
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 leading-relaxed"
                          />
                          {doctorConclusion.length > 0 && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Sera incluse dans le rapport PDF
                            </p>
                          )}
                        </div>

                        {/* Recommandations compactes */}
                        <div>
                          <p className="mb-2 text-[11px] font-bold text-slate-700">
                            Recommandations <span className="font-normal text-slate-400">(optionnel)</span>
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {RECOMMENDATIONS.map((rec) => {
                              const checked = doctorRecommendations.has(rec.id);
                              return (
                                <label
                                  key={rec.id}
                                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium transition-all ${
                                    checked
                                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRecommendation(rec.id)}
                                    className="h-3.5 w-3.5 shrink-0 rounded accent-blue-600"
                                  />
                                  {rec.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isEmergencySession && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    {/* Header */}
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Exports &amp; Dossier</p>
                    </div>

                    <div className="p-4 space-y-3">

                    {/* Ligne exports */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={toAbsoluteMediaUrl(modelingResult.obj_url)} target="_blank" rel="noreferrer" download
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                        <Download className="h-3 w-3" /> OBJ
                      </a>
                      <a href={toAbsoluteMediaUrl(modelingResult.stl_url)} target="_blank" rel="noreferrer" download
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                        <Download className="h-3 w-3" /> STL
                      </a>
                      <div className="w-px h-4 bg-slate-200" />
                      <button type="button" onClick={handleOpenReportPreview}
                        disabled={reportLoading || !modelingResult}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition-all">
                        <FileText className="h-3 w-3" /> Aperçu rapport
                      </button>

                    {/* ── Bouton export PDF direct ── */}
                    <button type="button" onClick={async () => {
                        if (!modelingResult) return;
                        setReportLoading(true);
                        try {
                          let patientDetail = reportPatientDetail;
                          if (!patientDetail && runInfo?.patient) {
                            try {
                              const r = await api.get(`/patients/${runInfo.patient}/`);
                              patientDetail = r?.data?.patient || r?.data || null;
                            } catch { patientDetail = null; }
                          }
                          const blob = buildArchivePdfBlob(patientDetail);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `rapport_run_${runId}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          setReportError(`Echec export PDF : ${err.message}`);
                        } finally {
                          setReportLoading(false);
                        }
                      }}
                      disabled={reportLoading || !modelingResult}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-50 transition-all">
                      {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </button>
                    </div>

                    {reportError && <p className="text-[11px] font-medium text-red-600">{reportError}</p>}

                    {/* ── Dossier patient ── */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-bold text-slate-700">Dossier patient</p>
                        </div>
                        {existingReport && !existingReport.same_mri && (
                          <span className="text-[9px] font-bold text-amber-600 border border-amber-200 bg-amber-50 rounded-md px-1.5 py-0.5">Déjà archivé</span>
                        )}
                        {archiveSuccess && (
                          <span className="text-[9px] font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Enregistré
                          </span>
                        )}
                      </div>

                      {archiveError && !existingReport?.same_mri && (
                        <p className="mb-2 text-[10px] font-medium text-red-600">{archiveError}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleArchiveReport}
                          disabled={archiving || !modelingResult || !runInfo?.patient}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 transition-all"
                        >
                          {archiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
                          {archiving ? 'Enregistrement…' : existingReport && !existingReport.same_mri ? 'Ré-archiver' : 'Enregistrer'}
                        </button>
                        {runInfo?.patient && (
                          <button
                            onClick={() => navigate(`/dashboard/patients/${runInfo.patient}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            Voir dossier <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {otherPatientReports.length > 0 && (
                        <div className="mt-2.5 border-t border-slate-200 pt-2.5 space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Rapports précédents</p>
                          {otherPatientReports.slice(0, 3).map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded-md bg-white border border-slate-100 px-2.5 py-1.5">
                              <span className="text-[11px] font-medium text-slate-600">Rapport #{r.run_id || '—'}</span>
                              <span className="text-[10px] text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    </div>
                  </div>}
                </div>
        ) : null}
      </div>

      <ReportPreviewModal
        open={reportPreviewOpen}
        onClose={() => setReportPreviewOpen(false)}
        onExport={handleDownloadReportPdf}
        exportTargetRef={reportPreviewRef}
        exportLoading={reportLoading}
        runInfo={runInfo}
        modelingResult={modelingResult}
        patientDetail={reportPatientDetail}
        toAbsoluteMediaUrl={toAbsoluteMediaUrl}
        doctorConclusion={doctorConclusion}
        doctorRecommendations={doctorRecommendations}
        recommendations={RECOMMENDATIONS}
      />
    </div>
  );
}
