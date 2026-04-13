import React from 'react';
import {
  Brain,
  Info,
  MapPin,
  Target,
  Activity,
  Maximize2,
  Minimize2
} from 'lucide-react';

type Zone = {
  id?: number;
  name?: string;
  desc?: string;
  functionality?: string;
};

type BrodmannIdentificationViewProps = {
  zone: Zone | null;
  insideBrain?: boolean;
  hasAttempt?: boolean;
  axis?: string;
  index?: number;
  maxIndex?: number;
  className?: string;
};

export default function BrodmannIdentificationView({
  zone,
  insideBrain = false,
  hasAttempt = false,
  axis = 'axial',
  index = 0,
  maxIndex = 0,
  className = ""
}: BrodmannIdentificationViewProps) {
  const axisLabel = axis === 'axial' ? 'Axial' : axis === 'coronal' ? 'Coronal' : 'Sagittal';

  return (
    <section className={`flex flex-col h-full bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl transition-all duration-500 ${className}`}>
      {/* Header with Ambient Effect */}
      <div className="relative px-6 py-5 border-b border-slate-200 bg-slate-50">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain className="w-24 h-24 text-blue-500" />
        </div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Identification Brodmann</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Atlas MNI152</p>
            </div>
          </div>
          
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-500 ${
            insideBrain 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.12)]' 
                : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${insideBrain ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {insideBrain ? 'DANS LE CERVEAU' : 'HORS CERVEAU'}
            </span>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto custom-scrollbar">
        <div className="min-h-full">
          {zone ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative overflow-hidden rounded-3xl border border-cyan-300/40 bg-gradient-to-br from-blue-100 via-indigo-100 to-cyan-100 p-5 shadow-[0_14px_30px_rgba(2,132,199,0.16)]">
                <div className="pointer-events-none absolute -right-3 -top-2 opacity-15">
                  <Activity className="h-14 w-14 text-cyan-600" />
                </div>

                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-700">Analyse corticale</p>
                    <h4 className="mt-1 text-lg font-black leading-tight text-slate-900">{zone.name || 'Zone Brodmann identifiee'}</h4>
                  </div>
                  <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-700">
                    BA {zone.id ?? '--'}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
                    <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-700">Statut</p>
                    <p className="mt-0.5 text-[11px] font-black text-emerald-800">Zone detectee</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">Plan</p>
                    <p className="mt-0.5 text-[11px] font-black text-slate-900">{axisLabel} / Slice {index}</p>
                  </div>
                </div>

                <p className="text-[12px] font-semibold leading-relaxed text-slate-700">
                  {zone.desc || "Region corticale associee a une organisation cytoarchitecturale specifique."}
                </p>

                <div className="mt-3 rounded-2xl border border-violet-300 bg-violet-50 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-violet-700">Interpretation fonctionnelle</p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-violet-900">
                    {zone.functionality || 'Fonction principale: traitement sensori-moteur et cognitif associe a la region selectionnee.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[11px] font-bold text-slate-800">Coordonnées</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-700 uppercase">A:{axis} / I:{index}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-[11px] font-bold text-slate-800">Coupes disponibles</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-700 uppercase">0-{maxIndex}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-[2.3rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Resultat d'identification</p>

              <div className="mt-4 flex flex-col items-center text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-full border border-dashed ${hasAttempt ? 'border-amber-400/35 bg-amber-500/8' : 'border-blue-400/25 bg-blue-500/8'}`}>
                  <Maximize2 className={`h-6 w-6 ${hasAttempt ? 'text-amber-300/80' : 'text-blue-300/75'}`} />
                </div>

                {hasAttempt ? (
                  <>
                    <p className="mt-4 text-sm font-bold text-amber-700">Aucune zone detectee</p>
                    <p className="mt-1 max-w-[230px] text-[12px] leading-relaxed text-slate-500">
                      Le curseur ne cible pas une region corticale valide sur cette coupe. Repositionnez le clic dans la zone coloree du cortex.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-sm font-bold text-slate-700">Cliquez pour identifier une zone</p>
                    <p className="mt-1 max-w-[230px] text-[12px] leading-relaxed text-slate-500">
                      Cliquez sur une region de l'image pour identifier l'aire de Brodmann correspondante.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-5 space-y-2">
                {[
                  { id: 4, name: 'Cortex Moteur Primaire' },
                  { id: 17, name: 'Cortex Visuel Primaire' },
                  { id: 44, name: 'Aire de Broca' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-black text-blue-700">{item.id}</span>
                    <span className="text-[11px] font-semibold text-slate-700">{item.name}</span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-center text-[10px] text-slate-500">Exemples d'aires de Brodmann</p>
            </div>
          )}

        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between opacity-70 group shadow-lg">
          <span className="text-[8px] font-black text-slate-600 tracking-[0.3em] uppercase">NeuroScan Engine v2.0</span>
          <Minimize2 className="w-3 h-3 text-slate-600" />
        </div>
      </div>
    </section>
  );
}
