import { MapPin, Activity, Brain, Crosshair, Zap } from 'lucide-react';

type Zone = {
  id?: number;
  name?: string;
  desc?: string;
  functionality?: string;
};

type MniCoords = { x: number; y: number; z: number };

type BrodmannIdentificationViewProps = {
  zone: Zone | null;
  insideBrain?: boolean;
  hasAttempt?: boolean;
  mniCoords?: MniCoords | null;
  className?: string;
};

const AXIS_COLORS = {
  x: { label: 'text-rose-500',   val: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  y: { label: 'text-emerald-500', val: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  z: { label: 'text-blue-500',   val: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
};

export default function BrodmannIdentificationView({
  zone,
  insideBrain = false,
  hasAttempt = false,
  mniCoords = null,
  className = '',
}: BrodmannIdentificationViewProps) {
  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>

      {/* ── Status banner ── */}
      <div className={`shrink-0 px-4 py-2.5 flex items-center gap-2 transition-colors duration-500 ${
        insideBrain
          ? 'bg-emerald-50 border-b border-emerald-100'
          : hasAttempt
          ? 'bg-amber-50 border-b border-amber-100'
          : 'bg-slate-50 border-b border-slate-100'
      }`}>
        <span className={`h-2 w-2 rounded-full shrink-0 ${
          insideBrain ? 'bg-emerald-500 animate-pulse' :
          hasAttempt  ? 'bg-amber-400' : 'bg-slate-300'
        }`} />
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${
          insideBrain ? 'text-emerald-700' :
          hasAttempt  ? 'text-amber-700' : 'text-slate-400'
        }`}>
          {insideBrain ? 'Cortex Détecté' : hasAttempt ? 'Hors Cerveau' : 'En attente'}
        </p>
        <p className="ml-auto text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          Description de zone
        </p>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {zone ? (
          <div className="p-4 space-y-4">

            {/* ── Identité BA ── */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-4 text-white shadow-lg shadow-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-200 mb-1">
                    Aire de Brodmann
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black font-mono leading-none">
                      BA
                    </span>
                    <span className="text-5xl font-black font-mono leading-none">
                      {zone.id ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white/80" />
                </div>
              </div>
              <p className="mt-2 text-[12px] font-bold text-blue-100 leading-snug">
                {zone.name || 'Zone inconnue'}
              </p>
            </div>

            {/* ── Description ── */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Crosshair className="h-3 w-3 text-slate-500" />
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Description
                </p>
              </div>
              {zone.desc ? (
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {zone.desc}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  Aucune description disponible pour cette région.
                </p>
              )}
            </div>

            {/* ── Fonctionnalité / Réseaux ── */}
            {zone.functionality && (
              <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3 w-3 text-violet-600" />
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-700">
                    Réseaux Associés
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed text-violet-900">
                  {zone.functionality}
                </p>
              </div>
            )}

            {/* ── Coordonnées MNI ── */}
            {mniCoords && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Coordonnées MNI (mm)
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['x', 'y', 'z'] as const).map(ax => {
                    const c = AXIS_COLORS[ax];
                    const val = mniCoords[ax];
                    return (
                      <div key={ax} className={`rounded-lg border ${c.border} ${c.bg} px-2 py-2 text-center`}>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${c.label} mb-0.5`}>{ax}</p>
                        <p className={`text-[13px] font-black font-mono ${c.val}`}>
                          {val > 0 ? '+' : ''}{val.toFixed(1)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        ) : (
          /* ── Idle ── */
          <div className="flex flex-col items-center justify-center h-full px-5 py-10 text-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                <Brain className="h-6 w-6 text-slate-300" />
              </div>
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <MapPin className="h-2.5 w-2.5 text-slate-400" />
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-600">Aucune zone sélectionnée</p>
              <p className="text-[10px] text-slate-400 leading-relaxed max-w-[140px] mx-auto">
                Cliquez sur une coupe cérébrale pour identifier une aire de Brodmann
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
              <Activity className="h-3 w-3" />
              <span>47 aires disponibles</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
