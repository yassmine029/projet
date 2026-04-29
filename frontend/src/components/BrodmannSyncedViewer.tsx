/**
 * BrodmannSyncedViewer — Viewer neuroimaging 3 coupes synchronisées
 *
 * Trois panneaux (Axiale · Coronale · Sagittale) avec :
 *  - Crosshair vert synchronisé entre les 3 vues
 *  - Zone de Brodmann surlignée dans les 3 coupes simultanément
 *  - Navigation indépendante par slider
 *  - Callback vers le parent avec zone + coordonnées MNI
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PanelState {
  index: number;
  maxIndex: number;
  atlasImg: string;
  patientImg: string;
  crosshair: { xRatio: number; yRatio: number } | null;
  loading: boolean;
}

type AxisKey = 'axial' | 'coronal' | 'sagittal';

interface Zone {
  id: number;
  name: string;
  desc?: string;
  functionality?: string;
}

interface MniCoords { x: number; y: number; z: number }

interface BrodmannSyncedViewerProps {
  jobId: string;
  onZoneIdentified?: (
    zone: Zone | null,
    insideBrain: boolean,
    mniCoords: MniCoords | null,
  ) => void;
  hasAttempt?: boolean;
  className?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const AXES: AxisKey[] = ['axial', 'coronal', 'sagittal'];
const AXIS_LABELS: Record<AxisKey, string> = {
  axial: 'Axiale',
  coronal: 'Coronale',
  sagittal: 'Sagittale',
};
const AXIS_BADGE_COLORS: Record<AxisKey, string> = {
  axial:    'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  coronal:  'bg-violet-500/20 text-violet-300 border-violet-400/30',
  sagittal: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
};
const AXIS_GLOW: Record<AxisKey, string> = {
  axial:    'hover:shadow-[0_0_24px_rgba(6,182,212,0.15)]',
  coronal:  'hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]',
  sagittal: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]',
};

const DEFAULT_PANEL: PanelState = {
  index: 0, maxIndex: 0,
  atlasImg: '', patientImg: '',
  crosshair: null, loading: false,
};

// ── Crosshair overlay ──────────────────────────────────────────────────────────

function Crosshair({ xRatio, yRatio }: { xRatio: number; yRatio: number }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 w-[1px] bg-emerald-400/70"
        style={{ left: `${xRatio * 100}%` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 h-[1px] bg-emerald-400/70"
        style={{ top: `${yRatio * 100}%` }}
      />
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400 bg-emerald-400/30 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
        style={{ left: `${xRatio * 100}%`, top: `${yRatio * 100}%` }}
      />
    </>
  );
}

// ── Loading shimmer ─────────────────────────────────────────────────────────────

function ImageShimmer() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
      <div className="flex flex-col items-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          Chargement
        </span>
      </div>
    </div>
  );
}

// ── Single axis panel ──────────────────────────────────────────────────────────

interface AxisPanelProps {
  axis: AxisKey;
  panel: PanelState;
  onSliceChange: (axis: AxisKey, index: number) => void;
  onImageClick: (axis: AxisKey, xRatio: number, yRatio: number) => void;
  showPatient: boolean;
}

function AxisPanel({ axis, panel, onSliceChange, onImageClick, showPatient }: AxisPanelProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    onImageClick(axis, xRatio, yRatio);
  };

  const axisLabel = AXIS_LABELS[axis];
  const badgeCls  = AXIS_BADGE_COLORS[axis];
  const glowCls   = AXIS_GLOW[axis];

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border border-white/8 bg-slate-900/60 p-3 transition-all duration-300 ${glowCls}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] ${badgeCls}`}>
          {axisLabel}
        </span>
        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-slate-400">
          {panel.index}
          <span className="text-slate-600">/{panel.maxIndex}</span>
        </span>
      </div>

      {/* Image pair */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Atlas */}
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">Atlas</span>
          <div
            className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-800 bg-black/80"
            onClick={handleClick}
          >
            {panel.atlasImg ? (
              <img
                ref={imgRef}
                src={panel.atlasImg}
                alt={`atlas-${axis}`}
                className="block h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[9px] text-slate-600">
                Indisponible
              </div>
            )}
            {panel.crosshair && (
              <Crosshair xRatio={panel.crosshair.xRatio} yRatio={panel.crosshair.yRatio} />
            )}
            {panel.loading && <ImageShimmer />}
          </div>
        </div>

        {/* Patient */}
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">Patient</span>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-800 bg-black/80">
            {panel.patientImg && showPatient ? (
              <img
                src={panel.patientImg}
                alt={`patient-${axis}`}
                className="block h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[9px] text-slate-600">
                {showPatient ? 'Indisponible' : 'Session inactive'}
              </div>
            )}
            {panel.crosshair && showPatient && (
              <Crosshair xRatio={panel.crosshair.xRatio} yRatio={panel.crosshair.yRatio} />
            )}
            {panel.loading && showPatient && <ImageShimmer />}
          </div>
        </div>
      </div>

      {/* Slice slider */}
      <div className="flex items-center gap-2 px-0.5">
        <input
          type="range"
          min={0}
          max={panel.maxIndex || 100}
          value={panel.index}
          onChange={(e) => onSliceChange(axis, Number(e.target.value))}
          className="flex-1 accent-emerald-400"
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BrodmannSyncedViewer({
  jobId,
  onZoneIdentified,
  hasAttempt,
  className = '',
}: BrodmannSyncedViewerProps) {
  const [panels, setPanels] = useState<Record<AxisKey, PanelState>>({
    axial:    { ...DEFAULT_PANEL },
    coronal:  { ...DEFAULT_PANEL },
    sagittal: { ...DEFAULT_PANEL },
  });
  const [globalLoading, setGlobalLoading] = useState(false);
  const initDoneRef = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setAxisLoading = useCallback((axis: AxisKey, loading: boolean) => {
    setPanels(prev => ({ ...prev, [axis]: { ...prev[axis], loading } }));
  }, []);

  // Fetch plain atlas+patient slice (no highlight)
  const fetchSlice = useCallback(async (axis: AxisKey, index: number, silent = false) => {
    if (!silent) setAxisLoading(axis, true);
    try {
      const [atlasRes, patientRes] = await Promise.allSettled([
        api.get('/volume/atlas_slice', { params: { axis, index } }),
        jobId
          ? api.get('/volume/patient_slice', { params: { jobId, axis, index } })
          : Promise.resolve(null),
      ]);

      setPanels(prev => {
        const atlasImg =
          atlasRes.status === 'fulfilled' ? (atlasRes.value?.data?.image ?? prev[axis].atlasImg) : prev[axis].atlasImg;
        const patientImg =
          patientRes.status === 'fulfilled' && patientRes.value
            ? (patientRes.value?.data?.image ?? prev[axis].patientImg)
            : prev[axis].patientImg;
        const maxIndex =
          atlasRes.status === 'fulfilled'
            ? (atlasRes.value?.data?.max_index ?? prev[axis].maxIndex)
            : prev[axis].maxIndex;

        return {
          ...prev,
          [axis]: { ...prev[axis], atlasImg, patientImg, maxIndex, index, loading: false },
        };
      });
    } catch {
      if (!silent) setAxisLoading(axis, false);
    }
  }, [jobId, setAxisLoading]);

  // Initialize all 3 axes at center
  const initPanels = useCallback(async () => {
    setGlobalLoading(true);
    await Promise.all(AXES.map(ax => fetchSlice(ax, 0, true)));
    setGlobalLoading(false);
  }, [fetchSlice]);

  useEffect(() => {
    if (!initDoneRef.current) {
      initDoneRef.current = true;
      initPanels();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (jobId) {
      // Re-fetch patient images when jobId becomes available/changes
      AXES.forEach(ax =>
        setPanels(prev => {
          const idx = prev[ax].index;
          return prev; // trigger via fetchSlice
        }),
      );
      AXES.forEach(ax => fetchSlice(ax, panels[ax].index, true));
    }
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slice change (slider) ─────────────────────────────────────────────────────

  const handleSliceChange = useCallback(async (axis: AxisKey, index: number) => {
    setPanels(prev => ({
      ...prev,
      [axis]: { ...prev[axis], index, crosshair: null },
    }));
    await fetchSlice(axis, index);
  }, [fetchSlice]);

  // ── Click → identify + synchronize ────────────────────────────────────────────

  const handleImageClick = useCallback(async (axis: AxisKey, xRatio: number, yRatio: number) => {
    if (!jobId) return;

    // Mark all panels as loading
    setPanels(prev => ({
      axial:    { ...prev.axial,    loading: true },
      coronal:  { ...prev.coronal,  loading: true },
      sagittal: { ...prev.sagittal, loading: true },
    }));

    try {
      const clickedIndex = panels[axis].index;

      // 1) Identify zone on clicked axis
      const res = await api.get('/volume/brodmann', {
        params: { jobId, axis, index: clickedIndex, xRatio, yRatio },
      });
      const data = res.data ?? {};

      const zone: Zone | null   = data.zone ?? null;
      const insideBrain: boolean = !!data.insideBrain;
      const mniCoords: MniCoords | null = data.mni_coords ?? null;
      const crosshairRatios: Record<AxisKey, { xRatio: number; yRatio: number }> =
        data.crosshair_ratios ?? {
          axial:    { xRatio, yRatio },
          coronal:  { xRatio, yRatio },
          sagittal: { xRatio, yRatio },
        };
      const sliceIndices: Record<AxisKey, number> = data.slice_indices ?? {
        axial:    clickedIndex,
        coronal:  panels.coronal.index,
        sagittal: panels.sagittal.index,
      };
      const labelId: number = data.label_id ?? 0;

      // Update clicked axis immediately
      const clickedAtlas   = data.images?.atlas ?? panels[axis].atlasImg;
      const clickedPatient = data.images?.patient ?? panels[axis].patientImg;

      setPanels(prev => ({
        ...prev,
        [axis]: {
          ...prev[axis],
          atlasImg: clickedAtlas,
          patientImg: clickedPatient,
          index: data.index ?? clickedIndex,
          maxIndex: data.max_index ?? prev[axis].maxIndex,
          crosshair: crosshairRatios[axis],
          loading: false,
        },
      }));

      // Notify parent
      onZoneIdentified?.(zone, insideBrain, mniCoords);

      // 2) Fetch other 2 axes in parallel (with labelId if zone found)
      const otherAxes = AXES.filter(ax => ax !== axis);
      await Promise.all(
        otherAxes.map(async (otherAxis) => {
          const otherIndex = sliceIndices[otherAxis];
          try {
            let otherAtlas   = '';
            let otherPatient = '';
            let otherMaxIdx  = panels[otherAxis].maxIndex;

            if (labelId > 0) {
              // Fetch highlighted view for this axis
              const otherRes = await api.get('/volume/brodmann', {
                params: { jobId, axis: otherAxis, index: otherIndex, labelId },
              });
              const od = otherRes.data ?? {};
              otherAtlas   = od.images?.atlas   ?? '';
              otherPatient = od.images?.patient ?? '';
              otherMaxIdx  = od.max_index ?? otherMaxIdx;
            } else {
              // No zone → just fetch plain slices
              const [aRes, pRes] = await Promise.allSettled([
                api.get('/volume/atlas_slice',   { params: { axis: otherAxis, index: otherIndex } }),
                api.get('/volume/patient_slice', { params: { jobId, axis: otherAxis, index: otherIndex } }),
              ]);
              if (aRes.status === 'fulfilled') { otherAtlas = aRes.value?.data?.image ?? ''; otherMaxIdx = aRes.value?.data?.max_index ?? otherMaxIdx; }
              if (pRes.status === 'fulfilled') otherPatient = pRes.value?.data?.image ?? '';
            }

            setPanels(prev => ({
              ...prev,
              [otherAxis]: {
                ...prev[otherAxis],
                atlasImg: otherAtlas || prev[otherAxis].atlasImg,
                patientImg: otherPatient || prev[otherAxis].patientImg,
                index: otherIndex,
                maxIndex: otherMaxIdx,
                crosshair: crosshairRatios[otherAxis],
                loading: false,
              },
            }));
          } catch {
            setAxisLoading(otherAxis, false);
          }
        }),
      );
    } catch {
      AXES.forEach(ax => setAxisLoading(ax, false));
    }
  }, [jobId, panels, onZoneIdentified, setAxisLoading]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Panel header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
            Vue synchronisée
          </span>
        </div>
        <span className="flex-1 border-t border-slate-800" />
        {globalLoading && (
          <span className="text-[9px] font-semibold text-slate-500 animate-pulse">
            Initialisation...
          </span>
        )}
        {!jobId && (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300">
            Atlas uniquement
          </span>
        )}
      </div>

      {/* Instructions */}
      {!hasAttempt && (
        <div className="flex items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-3 py-2.5">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <p className="text-[10px] font-semibold text-cyan-300/80">
            Cliquez sur n'importe quelle coupe pour identifier la zone de Brodmann correspondante
          </p>
        </div>
      )}

      {/* 3 panels in a row */}
      <div className="grid grid-cols-3 gap-3">
        {AXES.map(ax => (
          <AxisPanel
            key={ax}
            axis={ax}
            panel={panels[ax]}
            onSliceChange={handleSliceChange}
            onImageClick={handleImageClick}
            showPatient={!!jobId}
          />
        ))}
      </div>

      {/* Shortcut legend */}
      <div className="flex items-center justify-end gap-4 px-1">
        <span className="flex items-center gap-1 text-[9px] text-slate-600">
          <span className="h-[1px] w-3 bg-emerald-400/60" />
          Crosshair
        </span>
        <span className="flex items-center gap-1 text-[9px] text-slate-600">
          <span className="inline-block h-2 w-2 rounded-sm bg-cyan-400/30 ring-1 ring-cyan-400/40" />
          Zone Brodmann
        </span>
      </div>
    </div>
  );
}
