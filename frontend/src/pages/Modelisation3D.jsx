import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, ArrowLeft, X, FileText, Download, UserRound, Hash, CalendarDays, Brain, Activity, BarChart3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ModelViewerBlender from '../components/ModelViewerBlender.jsx';
import api from '../api';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ThresholdLine({ leftPercent, colorClass }) {
  return (
    <span
      className={`absolute top-1/2 h-5 w-[2px] -translate-y-1/2 ${colorClass}`}
      style={{ left: `calc(${clamp(leftPercent, 0, 100)}% - 1px)` }}
    />
  );
}

function StatusBadge({ tone, label }) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-sky-200 bg-sky-50 text-sky-700';

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

function getAiStatus(value) {
  const v = Math.abs(Number(value || 0));
  if (v <= 10) return { label: 'Normal', tone: 'ok', shortRule: '<= 10%' };
  if (v <= 20) return { label: 'Alerte', tone: 'warn', shortRule: '10-20%' };
  return { label: 'Eleve', tone: 'danger', shortRule: '> 20%' };
}

function getNiStatus(value) {
  const v = Number(value || 0);
  if (v < 60) return { label: 'Severe', tone: 'danger', shortRule: '< 60%' };
  if (v < 90) return { label: 'Alerte', tone: 'warn', shortRule: '60-90%' };
  if (v <= 110) return { label: 'Normal', tone: 'ok', shortRule: '90-110%' };
  return { label: 'Haut', tone: 'info', shortRule: '> 110%' };
}

function LegendDot({ colorClass }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorClass}`} />;
}

/** Infobulle type plateforme pro : formule visible au survol du libellé. */
function FormulaTooltip({ label, formula, description }) {
  return (
    <span
      className="group relative inline-flex cursor-help items-center gap-1 border-b border-dotted border-slate-400 text-xs font-semibold text-slate-600 outline-none hover:border-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      tabIndex={0}
    >
      {label}
      <span
        className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-left shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-1/2 sm:-translate-x-1/2"
        role="tooltip"
      >
        <span className="block font-mono text-[11px] leading-relaxed text-slate-800">{formula}</span>
        {description ? (
          <span className="mt-2 block border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-500">
            {description}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function AIGauge({ value, interpretation }) {
  const v = Math.abs(Number(value || 0));
  const status = getAiStatus(v);
  const min = 0;
  const max = 40;
  const percent = clamp((v - min) / (max - min), 0, 1);

  const valColor = v <= 10 ? 'text-emerald-500' : v <= 20 ? 'text-amber-400' : v <= 30 ? 'text-orange-500' : 'text-red-500';
  const valLabel = v <= 10 ? 'Non significative' : v <= 20 ? 'Moderee' : v <= 30 ? 'Marquee' : 'Severe';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">IA — Indice d'asymetrie</p>
        <span className={`rounded-xl border px-2.5 py-0.5 text-xs font-bold ${status.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : status.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}`}>{status.label}</span>
      </div>
      <h5 className="mt-2 text-lg font-bold text-slate-900">Asymetrie hippocampique</h5>
      <p className="text-xs font-medium text-slate-400">Marqueur MTLE · epilepsie lobe temporal</p>

      <div className="mt-3">
        <FormulaTooltip
          label="Formule IA"
          formula="IA = |V_D − V_G| / ((V_D + V_G) / 2) × 100"
          description="V_D et V_G : volumes hippocampiques droit et gauche (mm³). Résultat exprimé en %."
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jauge (0 – 40 %)</p>
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner">
          <div className="flex h-full w-full">
            <div className="h-full w-1/4 bg-emerald-500" />
            <div className="h-full w-1/4 bg-amber-400" />
            <div className="h-full w-1/4 bg-orange-500" />
            <div className="h-full w-1/4 bg-red-500" />
          </div>
          <div
            className="absolute top-1/2 z-10 h-6 w-1 -translate-y-1/2 rounded-sm border-2 border-white bg-slate-900 shadow-md transition-[left] duration-500 ease-out"
            style={{ left: `clamp(0px, calc(${percent * 100}% - 2px), calc(100% - 4px))` }}
            aria-hidden
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">{v.toFixed(2)}</p>
          <p className={`mt-1 text-xs font-bold ${valColor}`}>% — Asymétrie {valLabel.toLowerCase()}</p>
        </div>
      </div>

      <div className="mt-8 space-y-2 text-xs font-medium text-slate-500">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-emerald-500" /> 0 – 10 %</span>
          <span className={v <= 10 ? "font-bold text-emerald-600" : ""}>Non significative {v <= 10 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-amber-400" /> 10 – 20 %</span>
          <span className={v > 10 && v <= 20 ? "font-bold text-amber-600" : ""}>Moderee {v > 10 && v <= 20 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-orange-500" /> 20 – 30 %</span>
          <span className={v > 20 && v <= 30 ? "font-bold text-orange-600" : ""}>Marquee {v > 20 && v <= 30 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-red-500" /> &gt; 30 %</span>
          <span className={v > 30 ? "font-bold text-red-600" : ""}>Severe {v > 30 && '← patient'}</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Epilepsie (MTLE)</p>
        <p className="mt-1.5 text-xs font-medium text-slate-700 leading-relaxed">{interpretation || `IA = ${v.toFixed(2)} %`}</p>
      </div>
    </div>
  );
}

function NIGauge({ value, interpretation }) {
  const v = Number(value || 0);
  const status = getNiStatus(v);
  const min = 0;
  const max = 150;
  const percent = clamp((v - min) / (max - min), 0, 1);

  const valColor = v < 60 ? 'text-red-500' : v < 80 ? 'text-orange-500' : v < 90 ? 'text-amber-500' : v <= 110 ? 'text-emerald-500' : 'text-blue-500';
  const valLabel = v < 60 ? 'Reduction severe' : v < 80 ? 'Reduction moderee' : v < 90 ? 'Reduction legere' : v <= 110 ? 'Volume normal' : 'Superieur a la moyenne';

  const w60 = (60 / 150) * 100;
  const w80 = ((80 - 60) / 150) * 100;
  const w90 = ((90 - 80) / 150) * 100;
  const w110 = ((110 - 90) / 150) * 100;
  const wRest = 100 - w60 - w80 - w90 - w110;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">IN — Indice de normalisation</p>
        <span className={`rounded-xl border px-2.5 py-0.5 text-xs font-bold ${status.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : status.tone === 'info' ? 'bg-blue-50 border-blue-200 text-blue-600' : status.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-red-50 border-red-200 text-red-600'}`}>{status.label}</span>
      </div>
      <h5 className="mt-2 text-lg font-bold text-slate-900">Normalisation volumetrique</h5>
      <p className="text-xs font-medium text-slate-400">Quantification atrophie · Alzheimer (MA)</p>

      <div className="mt-3">
        <FormulaTooltip
          label="Formule IN"
          formula="IN = (V_patient / V_moyenne volontaires sains) × 100"
          description="V_patient : volume hippocampique total patient (mm³). La moyenne de référence est configurable (valeur normative du run)."
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jauge (0 – 150 %)</p>
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner">
          <div className="flex h-full w-full">
            <div className="h-full bg-red-500" style={{ width: `${w60}%` }} />
            <div className="h-full bg-orange-500" style={{ width: `${w80}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${w90}%` }} />
            <div className="h-full bg-emerald-500" style={{ width: `${w110}%` }} />
            <div className="h-full bg-blue-500" style={{ width: `${wRest}%` }} />
          </div>
          <div
            className="absolute top-1/2 z-10 h-6 w-1 -translate-y-1/2 rounded-sm border-2 border-white bg-slate-900 shadow-md transition-[left] duration-500 ease-out"
            style={{ left: `clamp(0px, calc(${percent * 100}% - 2px), calc(100% - 4px))` }}
            aria-hidden
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">{v.toFixed(2)}</p>
          <p className={`mt-1 text-xs font-bold ${valColor}`}>% — {valLabel}</p>
        </div>
      </div>

      <div className="mt-8 space-y-2 text-xs font-medium text-slate-500">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-red-500" /> &lt; 60 %</span>
          <span className={v < 60 ? "font-bold text-red-600" : ""}>Reduction severe {v < 60 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-orange-500" /> 60 – 80 %</span>
          <span className={v >= 60 && v < 80 ? "font-bold text-orange-600" : ""}>Reduction moderee {v >= 60 && v < 80 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-amber-400" /> 80 – 90 %</span>
          <span className={v >= 80 && v < 90 ? "font-bold text-amber-600" : ""}>Reduction legere {v >= 80 && v < 90 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-emerald-500" /> ≥ 90 %</span>
          <span className={v >= 90 && v <= 110 ? "font-bold text-emerald-600" : ""}>Normal {v >= 90 && v <= 110 && '← patient'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LegendDot colorClass="bg-blue-500" /> &gt; 110 %</span>
          <span className={v > 110 ? "font-bold text-blue-600" : ""}>Superieur a la moyenne {v > 110 && '← patient'}</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 border-l-4 border-emerald-400">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Alzheimer (MA)</p>
        <p className="mt-1.5 text-xs font-medium text-slate-700 leading-relaxed">{interpretation || `IN = ${v.toFixed(2)} %`}</p>
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
      value: `${Number(ci.asymmetry_index_percent || 0).toFixed(2)} %`,
      norm: '< 10 %',
      status: Math.abs(Number(ci.asymmetry_index_percent || 0)) < 10 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Indice de normalisation (IN)',
      value: `${Number(ci.normality_index_percent || 0).toFixed(2)} %`,
      norm: '90 - 110 %',
      status: Number(ci.normality_index_percent || 0) >= 90 && Number(ci.normality_index_percent || 0) <= 110 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Z-Score',
      value: `${Number(ci.z_score || 0).toFixed(2)}`,
      norm: '-1.5 a +1.5',
      status: Number(ci.z_score || 0) >= -1.5 && Number(ci.z_score || 0) <= 1.5 ? 'Normal' : 'Alerte',
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

        <div className="max-h-[85vh] overflow-y-auto px-8 py-6">
          <div className="flex items-start justify-between pb-5 mb-6 border-b-2 border-blue-600">
            <div>
              <p className="text-3xl font-black tracking-tight text-slate-900">Neuro<span className="text-blue-600">Scan</span></p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rapport de volumetrie hippocampique</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date du rapport</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">{examDate}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Informations patient</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { icon: UserRound, label: 'Sexe', value: sex, color: 'blue' },
                { icon: Hash, label: 'Age', value: age != null ? `${age} ans` : '-', color: 'emerald' },
                { icon: CalendarDays, label: "Date d'examen", value: examDate, color: 'violet' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200/60 p-3.5">
                  <div className={`w-9 h-9 rounded-lg bg-${item.color}-50 flex items-center justify-center`}>
                    <item.icon className={`h-4 w-4 text-${item.color}-500`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className="text-sm font-bold text-slate-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><Brain className="h-4 w-4" />Images cles — IRM segmentation</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Coupes du patient ({allSlices.length})</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {allSlices.map((slice, idx) => (
                    <div key={slice.id || idx} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                      <div className="relative aspect-[4/3]">
                        {slice?.source_url ? (
                          <>
                            <img
                              src={toAbsoluteMediaUrl(slice.source_url)}
                              alt={`slice-${slice.slice_index || idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {slice?.mask_url ? (
                              <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 h-full w-full"
                                style={{
                                  backgroundColor: 'rgba(6, 182, 212, 0.55)',
                                  WebkitMaskImage: `url(${toAbsoluteMediaUrl(slice.mask_url)})`,
                                  maskImage: `url(${toAbsoluteMediaUrl(slice.mask_url)})`,
                                  WebkitMaskRepeat: 'no-repeat',
                                  maskRepeat: 'no-repeat',
                                  WebkitMaskPosition: 'center',
                                  maskPosition: 'center',
                                  WebkitMaskSize: 'cover',
                                  maskSize: 'cover',
                                }}
                              />
                            ) : null}
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center text-red-500"><Brain className="h-5 w-5" /></div>
                        )}
                      </div>
                      <p className="border-t border-white/10 px-2 py-1 text-center text-[10px] text-slate-200">Slice {slice?.slice_index ?? idx + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                <ModelViewerBlender
                  variant="mini"
                  objUrl={toAbsoluteMediaUrl(modelingResult?.obj_url)}
                  stlUrl={toAbsoluteMediaUrl(modelingResult?.stl_url)}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><FileText className="h-4 w-4" />Tableau des mesures volumetriques</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/60">
              <table className="w-full text-left">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
                  <tr>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white">Mesure</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white">Valeur</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white">Norme</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white">Statut</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {measures.map((row, idx) => (
                    <tr key={row.name} className={`border-t border-slate-100 ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                      <td className="px-5 py-3 font-bold text-blue-600">{row.value}</td>
                      <td className="px-5 py-3 text-slate-500">{row.norm}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${statusDotClass(row.status)}`} />
                          <span className={`text-xs font-semibold ${row.status === 'Normal' ? 'text-emerald-600' : 'text-amber-600'}`}>{row.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><Activity className="h-4 w-4" />Interpretation clinique automatique</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-violet-200/60 bg-violet-50/50 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Epilepsie (MTLE) — IA</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{interp.mtle_message || interp.ai_message || '-'}</p>
              </div>
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Alzheimer (MA) — IN</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{interp.ni_message || '-'}</p>
              </div>
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Deviation statistique — Z-score</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{interp.z_message || '-'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><BarChart3 className="h-4 w-4" />Graphiques personnalises du patient</p>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ComparativeGroupedChart
                title="Volumes hippocampiques (mm3)"
                unit="mm3"
                yTicks={volumeTicks}
                yMax={volumeMaxValue}
                series={[
                  { key: 'patient', label: 'Patient', color: '#2563eb' },
                  { key: 'minNorm', label: 'Norme minimale', color: '#a8c5e6' },
                  { key: 'maxNorm', label: 'Norme maximale', color: '#d7dfc8' },
                ]}
                categories={volumeCategories}
              />

              <ComparativeGroupedChart
                title="Indices cliniques IA et IN (%)"
                unit="%"
                yTicks={indexTicks}
                yMax={indicesMaxValue}
                series={[
                  { key: 'patient', label: 'Valeur patient', color: '#ef4444' },
                  { key: 'seuil', label: 'Seuil clinique', color: '#c4cad8', borderColor: '#2563eb' },
                ]}
                categories={indicesCategories}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Donnees patient: G={formatMm3(vols.left)} mm3, D={formatMm3(vols.right)} mm3, Total={formatMm3(vols.total)} mm3, IA={iaValue.toFixed(2)} %, IN={inValue.toFixed(2)} %.
            </p>
          </div>

          <div className="mt-6 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Remarques et constatations</p>
            <p className="mt-3 text-base leading-8 font-semibold text-white">{interp.summary || '-'}</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1">
              {[
                { l: 'Vol. G', v: `${Number(vols.left || 0).toFixed(0)} mm\u00B3` },
                { l: 'Vol. D', v: `${Number(vols.right || 0).toFixed(0)} mm\u00B3` },
                { l: 'Total', v: `${Number(vols.total || 0).toFixed(0)} mm\u00B3` },
                { l: 'IA', v: `${Number(ci.asymmetry_index_percent || 0).toFixed(2)}%` },
                { l: 'IN', v: `${Number(ci.normality_index_percent || 0).toFixed(2)}%` },
                { l: 'Z', v: `${Number(ci.z_score || 0).toFixed(2)}` },
              ].map((item) => (
                <span key={item.l} className="text-xs text-slate-400 font-medium">
                  <span className="text-slate-500">{item.l}:</span> <span className="text-blue-300 font-bold">{item.v}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>NeuroScan - Plateforme de neuro-imagerie clinique</span>
            <span>Rapport genere automatiquement - {examDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Modelisation3D() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runId = Number(searchParams.get('run'));
  const reportPreviewRef = useRef(null);

  const [loadingRun, setLoadingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [runInfo, setRunInfo] = useState(null);
  const [modelingLoading, setModelingLoading] = useState(false);
  const [modelingError, setModelingError] = useState('');
  const [modelingResult, setModelingResult] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportPatientDetail, setReportPatientDetail] = useState(null);
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
    if (!Number.isFinite(runId) || runId <= 0 || !reportPreviewRef.current) return;
    setReportLoading(true);
    setReportError('');

    try {
      const target = reportPreviewRef.current;
      const scale = Math.min(2.2, Math.max(1.4, window.devicePixelRatio || 1.5));
      const canvas = await html2canvas(target, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale,
        logging: false,
      });

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
    } catch (err) {
      setReportError('Echec generation du rapport PDF depuis l\'apercu.');
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

  const toAbsoluteMediaUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
  };

  const aiValue = Number(modelingResult?.clinical_indices?.asymmetry_index_percent || 0);
  const niValue = Number(modelingResult?.clinical_indices?.normality_index_percent || 0);
  const aiMeaning = modelingResult?.clinical_interpretation?.ai_message || '';
  const niMeaning = modelingResult?.clinical_interpretation?.ni_message || '';
  const mtleMeaning = modelingResult?.clinical_interpretation?.mtle_message || '-';
  const globalConclusion = modelingResult?.clinical_interpretation?.summary || '-';
  const aiStatus = getAiStatus(aiValue).label;
  const niStatus = getNiStatus(niValue).label;
  const conciseConclusion =
    niStatus === 'Severe'
      ? 'Atrophie hippocampique probable. Correlation clinique recommandee.'
      : niStatus === 'Alerte'
        ? 'Profil borderline. Surveillance clinique et comparaison evolutive conseillees.'
        : niStatus === 'Haut'
          ? 'Profil d\'hyperplasie. A interpreter avec le contexte clinique.'
          : aiStatus === 'Normal'
            ? 'Profil volumetrique dans la norme, sans lateralisation nette.'
            : 'Profil global stable avec asymetrie a surveiller.';

  const fieldClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20';

  return (
    <div className="min-h-screen bg-slate-100/90 p-4 md:p-8 animate-fade-in">
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/segmentation/nouvelle?run=${runId}`)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Retour aux resultats
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {modelingResult ? (
              <button
                type="button"
                onClick={() => setStandardConfigOpen(true)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Parametres 3D
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/dashboard/analysesMRI')}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Analyses MRI
            </button>
          </div>
        </div>

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
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
              onClick={() => setStandardConfigOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modelisation-3d-standard-title"
              className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
                    <Box className="h-5 w-5 text-slate-700" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h1 id="modelisation-3d-standard-title" className="text-lg font-semibold tracking-tight text-slate-900">
                      Modelisation 3D — Mode standard
                    </h1>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Configurez les parametres cliniques avant la reconstruction.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStandardConfigOpen(false)}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Run ID', value: `#${runInfo.id}` },
                    { label: 'Modele segmentation', value: runInfo.model_key || 'unetpp' },
                    {
                      label: 'Coupes traitees',
                      value: `${runInfo.processed_count || 0} / ${runInfo.selected_count || 0}`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parametres medicaux</h2>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Structure a reconstruire</label>
                      <select name="structure" value={standardMode.structure} onChange={handleChange} className={fieldClass}>
                        <option value="both">Hippocampe gauche + droit</option>
                        <option value="left">Hippocampe gauche</option>
                        <option value="right">Hippocampe droit</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Qualite maillage</label>
                      <select name="quality" value={standardMode.quality} onChange={handleChange} className={fieldClass}>
                        <option value="fast">Rapide</option>
                        <option value="standard">Standard</option>
                        <option value="high">Haute</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Lissage surface</label>
                      <select name="smoothing" value={standardMode.smoothing} onChange={handleChange} className={fieldClass}>
                        <option value="none">Aucun</option>
                        <option value="low">Faible</option>
                        <option value="medium">Moyen</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Seuil segmentation</label>
                      <input
                        name="threshold"
                        value={standardMode.threshold}
                        onChange={handleChange}
                        className={fieldClass}
                        placeholder="0.75"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      name="knowsSpacing"
                      checked={standardMode.knowsSpacing}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-slate-400 text-slate-800 focus:ring-slate-500"
                    />
                    Je connais le spacing voxel
                  </label>
                  {standardMode.knowsSpacing ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Spacing X (mm)</label>
                        <input name="spacingX" value={standardMode.spacingX} onChange={handleChange} className={fieldClass} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Spacing Y (mm)</label>
                        <input name="spacingY" value={standardMode.spacingY} onChange={handleChange} className={fieldClass} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Spacing Z (mm)</label>
                        <input name="spacingZ" value={standardMode.spacingZ} onChange={handleChange} className={fieldClass} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      name="useCustomReference"
                      checked={standardMode.useCustomReference}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-slate-400 text-slate-800 focus:ring-slate-500"
                    />
                    Utiliser une reference normative personnalisee (NI / Z-score)
                  </label>
                  {standardMode.useCustomReference ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Volume moyen de reference (mm3)</label>
                        <input
                          name="normativeTotalMeanMm3"
                          value={standardMode.normativeTotalMeanMm3}
                          onChange={handleChange}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Ecart-type de reference (mm3)</label>
                        <input
                          name="normativeTotalStdMm3"
                          value={standardMode.normativeTotalStdMm3}
                          onChange={handleChange}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {modelingError ? (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {modelingError}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/analysesMRI')}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Revenir aux analyses
                </button>
                <button
                  type="button"
                  onClick={handleLaunchModeling}
                  disabled={modelingLoading}
                  className="inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {modelingLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Modelisation en cours...
                    </>
                  ) : (
                    'Lancer la modelisation 3D'
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
              className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Ouvrir la configuration
            </button>
          </div>
        ) : null}

        {modelingResult ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card md:p-6">
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

                      <aside className="flex w-full shrink-0 flex-col gap-4 border-t border-slate-200 pt-5 xl:w-[20rem] xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0 2xl:w-[22rem]">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 xl:hidden">Statistiques</p>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Volumes hippocampe
                          </p>
                          <div className="space-y-2">
                            {[
                              {
                                label: 'Gauche',
                                mm3: modelingResult?.volumes_mm3?.left,
                                ml: modelingResult?.volumes_ml?.left,
                                accent: 'text-blue-700',
                              },
                              {
                                label: 'Droit',
                                mm3: modelingResult?.volumes_mm3?.right,
                                ml: modelingResult?.volumes_ml?.right,
                                accent: 'text-violet-700',
                              },
                              {
                                label: 'Total',
                                mm3: modelingResult?.volumes_mm3?.total,
                                ml: modelingResult?.volumes_ml?.total,
                                accent: 'text-emerald-700',
                                highlight: true,
                              },
                            ].map((v) => (
                              <div
                                key={v.label}
                                className={`flex items-baseline justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 ${
                                  v.highlight ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                                }`}
                              >
                                <span className="text-xs font-semibold text-slate-700">{v.label}</span>
                                <div className="text-right">
                                  <span className={`block text-sm font-bold tabular-nums ${v.accent}`}>
                                    {Number(v.mm3 || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {Number(v.ml || 0).toFixed(3)} mL
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {modelingResult.context_brain_volume_voxel_mm3 != null ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              Enveloppe cerveau (contexte IRM)
                            </p>
                            <dl className="space-y-2.5 text-sm">
                              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                                <dt className="text-slate-600">Volume voxel</dt>
                                <dd className="text-right">
                                  <span className="font-semibold tabular-nums text-slate-900">
                                    {Number(modelingResult.context_brain_volume_voxel_mm3).toLocaleString('fr-FR', {
                                      maximumFractionDigits: 0,
                                    })}{' '}
                                    mm³
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {Number(modelingResult.context_brain_volume_voxel_ml || 0).toFixed(2)} mL
                                  </span>
                                </dd>
                              </div>
                              {modelingResult.context_brain_volume_mesh_mm3 != null ? (
                                <div className="flex justify-between gap-3">
                                  <dt className="text-slate-600">Volume maillage</dt>
                                  <dd className="text-right font-semibold tabular-nums text-slate-900">
                                    {Number(modelingResult.context_brain_volume_mesh_mm3).toLocaleString('fr-FR', {
                                      maximumFractionDigits: 0,
                                    })}{' '}
                                    mm³
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            <p className="mt-3 text-[10px] leading-snug text-slate-500">
                              Approximation à partir des coupes du run (pas un volume osseux scanner).
                            </p>
                          </div>
                        ) : null}

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Maillage hippocampe &amp; coupes
                          </p>
                          <dl className="space-y-2.5 text-sm">
                            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                              <dt className="text-slate-600">Volume voxel</dt>
                              <dd className="text-right font-semibold tabular-nums text-slate-900">
                                {Number(modelingResult.volume_voxel_mm3 || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³
                                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                                  {Number(modelingResult.volume_voxel_ml || 0).toFixed(3)} mL
                                </span>
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                              <dt className="text-slate-600">Volume surface (mesh)</dt>
                              <dd className="text-right font-semibold tabular-nums text-slate-900">
                                {modelingResult.volume_mesh_mm3 != null
                                  ? `${Number(modelingResult.volume_mesh_mm3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} mm³`
                                  : '—'}
                                {modelingResult.volume_mesh_ml != null ? (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                                    {Number(modelingResult.volume_mesh_ml).toFixed(3)} mL
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">Non watertight</span>
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-600">Coupes utilisées</dt>
                              <dd className="font-semibold tabular-nums text-slate-900">{modelingResult.slices_used || 0}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Indices cliniques (résumé)
                          </p>
                          <dl className="space-y-2.5 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-600">IA · asymétrie</dt>
                              <dd className="font-bold tabular-nums text-slate-900">{aiValue.toFixed(2)} %</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-600">IN · normalisation</dt>
                              <dd className="font-bold tabular-nums text-slate-900">{niValue.toFixed(2)} %</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-600">Z-score</dt>
                              <dd className="font-bold tabular-nums text-slate-900">
                                {Number(modelingResult?.clinical_indices?.z_score || 0).toFixed(2)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </aside>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-card">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <AIGauge value={aiValue} interpretation={mtleMeaning || aiMeaning} />
                      <NIGauge value={niValue} interpretation={niMeaning} />
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Remarques et constatations</p>
                          <h3 className="text-lg font-extrabold text-slate-900 inline-flex items-center">{conciseConclusion}</h3>
                          
                          <div className="mt-4 flex flex-wrap gap-2">
                            {aiValue > 20 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"><Activity className="h-3.5 w-3.5" /> Asymetrie severe (MTLE)</span>
                            ) : aiValue > 10 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><Activity className="h-3.5 w-3.5" /> Asymetrie a surveiller</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Brain className="h-3.5 w-3.5" /> Asymetrie normale</span>
                            )}
                            
                            {niValue < 80 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"><Activity className="h-3.5 w-3.5" /> Atrophie marquee</span>
                            ) : niValue < 90 ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><Activity className="h-3.5 w-3.5" /> Reduction focale</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Brain className="h-3.5 w-3.5" /> Volume total normal</span>
                            )}

                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                              <CalendarDays className="h-3.5 w-3.5" /> {
                                (aiValue > 10 || niValue < 90 || niValue > 110) ? 'Suivi recommande' : 'Suivi de routine'
                              }
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-5 md:pt-0 md:pl-6 text-right">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Indice asymetrie</p>
                            <p className={`mt-0.5 text-xl font-black ${aiValue <= 10 ? 'text-emerald-600' : aiValue <= 20 ? 'text-amber-600' : 'text-red-600'}`}>{aiValue.toFixed(2)} %</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Indice normalisation</p>
                            <p className={`mt-0.5 text-xl font-black ${niValue >= 90 && niValue <= 110 ? 'text-emerald-600' : niValue < 80 ? 'text-red-600' : 'text-amber-600'}`}>{niValue.toFixed(2)} %</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Actions</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={toAbsoluteMediaUrl(modelingResult.obj_url)}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                      >
                        <Download className="h-4 w-4" />
                        OBJ
                      </a>
                      <a
                        href={toAbsoluteMediaUrl(modelingResult.stl_url)}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                      >
                        <Download className="h-4 w-4" />
                        STL
                      </a>
                      <button
                        type="button"
                        onClick={handleOpenReportPreview}
                        disabled={reportLoading || !modelingResult}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                      >
                        <FileText className="h-4 w-4" />
                        Apercu du rapport
                      </button>
                    </div>
                    {reportError ? (
                      <p className="mt-3 text-xs font-medium text-red-600">{reportError}</p>
                    ) : null}
                    <p className="mt-3 text-[11px] text-slate-400 font-medium">
                      Les fichiers OBJ/STL sont compatibles avec Blender, MeshLab et 3D Slicer.
                    </p>
                  </div>
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
      />
    </div>
  );
}
