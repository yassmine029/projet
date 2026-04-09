import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers, MapPin } from 'lucide-react';
import api from '../api';
import atlasLabels from '../constants/atlas_labels.json';

const AXES = ['axial', 'coronal', 'sagittal'] as const;

type Axis = (typeof AXES)[number];

type Zone = {
  id?: number;
  name?: string;
  desc?: string;
  functionality?: string;
};

export default function ExplorationPage() {
  const [jobId, setJobId] = useState('');
  const [axis, setAxis] = useState<Axis>('axial');
  const [sliceIndex, setSliceIndex] = useState(0);
  const [maxSlice, setMaxSlice] = useState(0);

  const [atlasImage, setAtlasImage] = useState('');
  const [patientImage, setPatientImage] = useState('');

  const [zone, setZone] = useState<Zone | null>(null);
  const [insideBrain, setInsideBrain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [hoverHint, setHoverHint] = useState('Cliquez sur une région de l\'atlas pour identifier.');

  const labelsMap = useMemo(() => atlasLabels as Record<string, string>, []);

  const refreshAtlasSlice = async (nextAxis: Axis, nextIndex: number) => {
    const res = await api.get('/volume/atlas_slice', {
      params: { axis: nextAxis, index: nextIndex },
    });
    const data = res.data || {};
    if (data.image) setAtlasImage(data.image);
    if (typeof data.index === 'number') setSliceIndex(data.index);
    if (typeof data.max_index === 'number') setMaxSlice(data.max_index);
  };

  const refreshPatientSlice = async (nextJobId: string, nextAxis: Axis, nextIndex: number) => {
    const res = await api.get('/volume/patient_slice', {
      params: { jobId: nextJobId, axis: nextAxis, index: nextIndex },
    });
    const data = res.data || {};
    if (data.image) setPatientImage(data.image);
  };

  const syncImages = async (nextJobId: string, nextAxis: Axis, nextIndex: number) => {
    await refreshAtlasSlice(nextAxis, nextIndex);
    if (nextJobId) {
      await refreshPatientSlice(nextJobId, nextAxis, nextIndex);
    }
  };

  const autoLoadDemoPatient = async () => {
    const res = await api.post('/volume/load-demo');
    const data = res.data || {};
    const nextJobId = data.jobId || '';
    if (!nextJobId) throw new Error('jobId manquant pour le patient test');

    setJobId(nextJobId);
    sessionStorage.setItem('volumeJobId', nextJobId);

    const nextIndex = typeof data.z === 'number' ? data.z : 0;
    setSliceIndex(nextIndex);
    if (typeof data.max_z === 'number') setMaxSlice(data.max_z);
    if (data.median_slice) setPatientImage(data.median_slice);

    await refreshAtlasSlice(axis, nextIndex);
  };

  const getContainImageRatios = (event: React.MouseEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;

    const containerAspect = cw / Math.max(1e-6, ch);
    const imageAspect = iw / Math.max(1e-6, ih);

    let displayW = cw;
    let displayH = ch;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > containerAspect) {
      displayW = cw;
      displayH = cw / imageAspect;
      offsetY = (ch - displayH) / 2;
    } else {
      displayH = ch;
      displayW = ch * imageAspect;
      offsetX = (cw - displayW) / 2;
    }

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (
      localX < offsetX ||
      localY < offsetY ||
      localX > offsetX + displayW ||
      localY > offsetY + displayH
    ) {
      return null;
    }

    const xRatio = (localX - offsetX) / Math.max(1e-6, displayW);
    const yRatio = (localY - offsetY) / Math.max(1e-6, displayH);

    return {
      xRatio: Math.max(0, Math.min(1, xRatio)),
      yRatio: Math.max(0, Math.min(1, yRatio)),
    };
  };

  const identifyZone = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (!jobId) return;
    const ratios = getContainImageRatios(event);
    if (!ratios) {
      setZone(null);
      setInsideBrain(false);
      setHoverHint('Cliquez sur l image (pas sur les bandes noires).');
      return;
    }

    const { xRatio, yRatio } = ratios;

    setBusy(true);
    setError('');
    try {
      const res = await api.get('/volume/brodmann', {
        params: { jobId, axis, index: sliceIndex, xRatio, yRatio },
      });
      const data = res.data || {};
      setZone(data.zone || null);
      setInsideBrain(!!data.insideBrain);
      if (data.images?.atlas) setAtlasImage(data.images.atlas);
      if (data.images?.patient) setPatientImage(data.images.patient);

      if (data.zone?.name) {
        setHoverHint(`Zone détectée: ${data.zone.name}`);
      } else {
        setHoverHint('Point hors cerveau. Essayez une autre région.');
      }
    } catch {
      setError('Identification de zone impossible.');
      setHoverHint('La détection a échoué. Vérifiez que le backend est démarré.');
    } finally {
      setBusy(false);
    }
  };

  const handleAxisChange = async (nextAxis: Axis) => {
    setAxis(nextAxis);
    setZone(null);
    setInsideBrain(false);
    setHoverHint('Cliquez sur une région de l\'atlas pour identifier.');

    try {
      await syncImages(jobId, nextAxis, sliceIndex);
    } catch {
      setError('Impossible de changer l\'axe.');
    }
  };

  const handleSliceChange = async (nextIndex: number) => {
    setSliceIndex(nextIndex);
    setZone(null);
    setInsideBrain(false);

    try {
      await syncImages(jobId, axis, nextIndex);
    } catch {
      setError('Impossible de charger cette coupe.');
    }
  };

  useEffect(() => {
    const init = async () => {
      setBusy(true);
      setError('');
      try {
        const savedJobId = sessionStorage.getItem('volumeJobId') || '';
        await refreshAtlasSlice(axis, 0);

        if (savedJobId) {
          try {
            setJobId(savedJobId);
            await refreshPatientSlice(savedJobId, axis, sliceIndex);
            setHoverHint('Atlas et patient rechargés automatiquement.');
            return;
          } catch {
            sessionStorage.removeItem('volumeJobId');
            setJobId('');
          }
        }

        await autoLoadDemoPatient();
        setHoverHint('Atlas et patient test chargés automatiquement.');
      } catch {
        setError('Échec du chargement automatique atlas/patient.');
      } finally {
        setBusy(false);
      }
    };

    init();
  }, []);

  return (
    <div className="min-h-screen bg-[#05080f] text-white">
      <header className="border-b border-white/10 bg-[#060b14] px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>

          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-indigo-600/20 px-3 py-1 text-xs font-semibold text-indigo-300">Identification Brodmann</span>
            <span className="text-xs text-white/40">Atlas MNI152</span>
          </div>

          <div className="text-xs text-white/40">Cliquez pour identifier • Scroll pour naviguer</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-3 p-3">
        <section className="col-span-5 rounded-2xl border border-cyan-500/20 bg-[#070d18] p-2">
          <div className="mb-2 text-sm font-bold text-cyan-100">PATIENT RECALÉ</div>
          <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
            {patientImage ? (
              <img
                src={patientImage}
                alt="patient"
                className="h-full w-full cursor-crosshair object-contain"
                onClick={identifyZone}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/30">Chargement patient...</div>
            )}
          </div>
        </section>

        <section className="col-span-5 rounded-2xl border border-violet-500/20 bg-[#070d18] p-2">
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-violet-100">
            <span>ATLAS MNI • BRODMANN</span>
            <span className="text-xs text-white/50">{axis.toUpperCase()} • {sliceIndex}/{maxSlice}</span>
          </div>
          <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
            {atlasImage ? (
              <img
                src={atlasImage}
                alt="atlas"
                className="h-full w-full cursor-crosshair object-contain"
                onClick={identifyZone}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/30">Chargement atlas...</div>
            )}
          </div>
        </section>

        <aside className="col-span-2 rounded-2xl border border-white/10 bg-[#070d18] p-3">
          <h3 className="mb-3 text-sm font-bold text-white/80">RÉSULTAT D'IDENTIFICATION</h3>
          <p className="mb-4 text-xs text-white/50">{hoverHint}</p>

          {zone ? (
            <div className="space-y-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <div className="text-xs text-cyan-200">Zone {zone.id}</div>
              <div className="text-sm font-semibold text-white">{zone.name}</div>
              <div className="text-xs text-white/60">{zone.desc}</div>
              {zone.functionality && <div className="text-xs text-emerald-200">{zone.functionality}</div>}
              <div className="text-[11px] text-emerald-300">{insideBrain ? 'Dans le cerveau' : 'Hors cerveau'}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-white/40">
              Cliquez sur l'image atlas pour identifier une aire.
            </div>
          )}

          <div className="mt-5">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white/50">
              <Layers className="h-3.5 w-3.5" /> Exemples d'aires
            </h4>
            <div className="space-y-1.5">
              {[4, 17, 44].map((id) => (
                <div key={id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/80">
                  <span className="mr-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-200">{id}</span>
                  {labelsMap[String(id)] || `Aire ${id}`}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="col-span-12 rounded-2xl border border-white/10 bg-[#070d18] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/50">Axe</span>
              <div className="flex gap-1">
                {AXES.map((a) => (
                  <button
                    key={a}
                    onClick={() => handleAxisChange(a)}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${axis === a ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    disabled={busy}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-xs text-white/40">{Math.round((sliceIndex / Math.max(1, maxSlice || 1)) * 100)}%</span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, maxSlice)}
            value={sliceIndex}
            onChange={(e) => handleSliceChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
            disabled={busy}
          />

          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>Coupe {axis}</span>
            <span>Z = {sliceIndex} / {maxSlice || '?'}</span>
          </div>

          {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
        </section>
      </main>
    </div>
  );
}
