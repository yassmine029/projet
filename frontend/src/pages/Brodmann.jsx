import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import BrodmannIdentificationView from '../components/BrodmannIdentificationView';

const DEFAULT_AXIS = 'axial';

export default function BrodmannPage() {
  const [jobId, setJobId] = useState('');
  const [axis, setAxis] = useState(DEFAULT_AXIS);
  const [index, setIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);

  const [atlasImage, setAtlasImage] = useState('');
  const [patientImage, setPatientImage] = useState('');

  const [zone, setZone] = useState(null);
  const [insideBrain, setInsideBrain] = useState(false);
  const [selectedRatios, setSelectedRatios] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoAlignIters, setAutoAlignIters] = useState(60);
  const [alignRuns, setAlignRuns] = useState([]);

  const [uploadFile, setUploadFile] = useState(null);
  const viewerRef = useRef(null);

  const canWork = useMemo(() => !!jobId, [jobId]);

  const refreshAtlasSlice = async (nextAxis = axis, nextIndex = index) => {
    const res = await api.get('/volume/atlas_slice', {
      params: { axis: nextAxis, index: nextIndex },
    });
    const data = res.data || {};
    if (data.image) setAtlasImage(data.image);
    if (typeof data.index === 'number') setIndex(data.index);
    if (typeof data.max_index === 'number') setMaxIndex(data.max_index);
  };

  const refreshPatientSlice = async (nextJobId = jobId, nextAxis = axis, nextIndex = index) => {
    const res = await api.get('/volume/patient_slice', {
      params: { jobId: nextJobId, axis: nextAxis, index: nextIndex },
    });
    const data = res.data || {};
    if (data.image) setPatientImage(data.image);
    if (typeof data.index === 'number') setIndex(data.index);
    if (typeof data.max_index === 'number') setMaxIndex(data.max_index);
  };

  const syncSlices = async (nextJobId = jobId, nextAxis = axis, nextIndex = index) => {
    await refreshAtlasSlice(nextAxis, nextIndex);
    if (nextJobId) {
      await refreshPatientSlice(nextJobId, nextAxis, nextIndex);
    }
  };

  const loadDemoPatient = async (options = {}) => {
    const silent = !!options.silent;
    if (!silent) {
      setBusy(true);
      setError('');
      setMessage('Chargement du patient demo...');
    }
    try {
      const res = await api.post('/volume/load-demo');
      const data = res.data || {};
      const nextJobId = data.jobId;
      if (!nextJobId) throw new Error('jobId manquant');
      setJobId(nextJobId);
      sessionStorage.setItem('volumeJobId', nextJobId);

      const nextIndex = typeof data.z === 'number' ? data.z : 0;
      if (typeof data.max_z === 'number') setMaxIndex(data.max_z);
      setIndex(nextIndex);
      if (data.median_slice) setPatientImage(data.median_slice);

      await refreshAtlasSlice(axis, nextIndex);
      if (!silent) {
        setMessage('Patient demo charge. Vous pouvez lancer le recalage atlas.');
      }
      return nextJobId;
    } catch (e) {
      if (!silent) {
        setError('Impossible de charger le patient demo.');
        setMessage('');
      }
      return '';
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  };

  const uploadPatientVolume = async () => {
    if (!uploadFile) {
      setError('Choisissez un fichier patient (.nii/.nii.gz ou image).');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('Upload du volume patient...');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await api.post('/volume/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data || {};
      const nextJobId = data.jobId;
      if (!nextJobId) throw new Error('jobId manquant');

      setJobId(nextJobId);
      sessionStorage.setItem('volumeJobId', nextJobId);
      const nextIndex = typeof data.z === 'number' ? data.z : 0;
      if (typeof data.max_z === 'number') setMaxIndex(data.max_z);
      setIndex(nextIndex);
      if (data.median_slice) setPatientImage(data.median_slice);

      await refreshAtlasSlice(axis, nextIndex);
      setMessage('Volume patient charge. Lancez le recalage atlas.');
    } catch (e) {
      setError('Echec upload volume patient.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const runAutoAlign = async () => {
    if (!jobId) return;
    setBusy(true);
    setError('');
    setMessage(`Recalage atlas automatique en cours (${autoAlignIters} iterations)...`);
    try {
      const res = await api.post('/volume/auto-align', { jobId, n_iters: autoAlignIters });
      const data = res.data || {};
      if (data.images?.atlas) setAtlasImage(data.images.atlas);
      if (data.images?.patient) setPatientImage(data.images.patient);
      if (!data.images?.atlas || !data.images?.patient) {
        await syncSlices(jobId, axis, index);
      }
      const metrics = data.metrics || {};
      const runSummary = {
        n_iters: Number(data.n_iters || metrics.n_iters || autoAlignIters),
        mutual_information: Number(metrics.mutual_information || 0),
        ncc_after: Number(metrics.ncc_after || 0),
        processing_time_ms: Number(metrics.processing_time_ms || 0),
        mi_quality: metrics.mi_quality || 'N/A',
      };
      setAlignRuns((prev) => [runSummary, ...prev].slice(0, 5));
      setMessage('Recalage atlas termine. Comparez les metriques et validez si correct.');
    } catch (e) {
      setError('Recalage atlas automatique echoue.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const validateRegistration = async () => {
    if (!jobId) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/volume/validate-registration', { jobId });
      const data = res.data || {};
      if (data.images?.atlas) setAtlasImage(data.images.atlas);
      if (data.images?.patient) setPatientImage(data.images.patient);
      setMessage('Recalage valide et applique au volume complet.');
      return true;
    } catch (e) {
      setError('Validation du recalage echouee.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rejectRegistration = async () => {
    if (!jobId) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/volume/reject-registration', { jobId });
      await syncSlices(jobId, axis, index);
      setMessage('Resultat rejete. Vous pouvez relancer le recalage.');
      return true;
    } catch (e) {
      setError('Rejet du recalage echoue.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const proceedToIdentification = async () => {
    const ok = await validateRegistration();
    if (ok && viewerRef.current) {
      viewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAxisChange = async (nextAxis) => {
    setAxis(nextAxis);
    setZone(null);
    setInsideBrain(false);
    setSelectedRatios(null);
    if (!jobId) {
      await refreshAtlasSlice(nextAxis, 0);
      return;
    }
    await syncSlices(jobId, nextAxis, index);
  };

  const handleIndexChange = async (nextIndex) => {
    setIndex(nextIndex);
    setZone(null);
    setInsideBrain(false);
    setSelectedRatios(null);
    if (!jobId) {
      await refreshAtlasSlice(axis, nextIndex);
      return;
    }
    await syncSlices(jobId, axis, nextIndex);
  };

  const identifyFromClick = async (event) => {
    if (!jobId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xr = (event.clientX - rect.left) / Math.max(1, rect.width);
    const yr = (event.clientY - rect.top) / Math.max(1, rect.height);
    const xRatio = Math.max(0, Math.min(1, xr));
    const yRatio = Math.max(0, Math.min(1, yr));

    setBusy(true);
    setError('');
    try {
      const res = await api.get('/volume/brodmann', {
        params: { jobId, axis, index, xRatio, yRatio },
      });
      const data = res.data || {};
      setZone(data.zone || null);
      setInsideBrain(!!data.insideBrain);
      setSelectedRatios({ xRatio, yRatio });
      if (data.images?.atlas) setAtlasImage(data.images.atlas);
      if (data.images?.patient) setPatientImage(data.images.patient);
      setMessage(data.insideBrain ? 'Zone Brodmann identifiee.' : 'Point hors cerveau.');
    } catch (e) {
      setError('Identification de zone echouee.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const saved = sessionStorage.getItem('volumeJobId') || '';
      try {
        await refreshAtlasSlice(axis, index);
        if (saved) {
          try {
            setJobId(saved);
            await syncSlices(saved, axis, index);
            setMessage('Session volume restauree automatiquement.');
            return;
          } catch (savedError) {
            setJobId('');
            sessionStorage.removeItem('volumeJobId');
          }
        }

        const demoJobId = await loadDemoPatient({ silent: true });
        if (demoJobId) {
          setMessage('Atlas et patient test charges automatiquement.');
        } else {
          setMessage('Atlas charge. Chargez un volume patient ou utilisez le mode demo.');
        }
      } catch (e) {
        setJobId('');
        sessionStorage.removeItem('volumeJobId');
        await refreshAtlasSlice(axis, index);
        setMessage('Atlas charge. Chargez un volume patient ou utilisez le mode demo.');
      }
    };
    init();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 pb-36 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_45%),radial-gradient(circle_at_20%_20%,_rgba(59,130,246,0.2),_transparent_38%)]" />

      <div className="relative mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_10px_45px_rgba(2,6,23,0.6)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">NeuroScan Workflow</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Recalage Atlas et Identification Brodmann</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Pipeline clinique: chargez le volume, lancez le recalage automatique, puis confirmez ou rejetez le resultat avant l'identification precise des zones.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <p className="text-xs uppercase tracking-wider text-emerald-300/70">Session active</p>
              <p className="mt-1 font-mono">{jobId || 'Aucun Job ID'}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.55)] backdrop-blur md:p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="file"
              accept=".nii,.nii.gz,image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400"
            />
            <button
              onClick={uploadPatientVolume}
              disabled={busy}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Charger volume patient
            </button>
            <button
              onClick={loadDemoPatient}
              disabled={busy}
              className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Charger patient demo
            </button>
            <button
              onClick={runAutoAlign}
              disabled={busy || !canWork}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lancer recalage auto
            </button>
            <label className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <span className="whitespace-nowrap">Iterations</span>
              <input
                type="number"
                min={30}
                max={1000}
                step={10}
                value={autoAlignIters}
                onChange={(e) => setAutoAlignIters(Number(e.target.value || 120))}
                className="w-24 rounded-md border border-emerald-200/30 bg-slate-900/80 px-2 py-1 text-sm text-white outline-none focus:border-cyan-300"
              />
            </label>
          </div>

          {(message || error) && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {message && <p className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">{message}</p>}
              {error && <p className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200">{error}</p>}
            </div>
          )}

          {alignRuns.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Comparaison des derniers recalages</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-200">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-2 py-1">Iterations</th>
                      <th className="px-2 py-1">MI</th>
                      <th className="px-2 py-1">Qualite MI</th>
                      <th className="px-2 py-1">NCC apres</th>
                      <th className="px-2 py-1">Temps (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alignRuns.map((run, idxRun) => (
                      <tr key={`${run.n_iters}-${idxRun}`} className={idxRun === 0 ? 'bg-emerald-500/10' : ''}>
                        <td className="px-2 py-1 font-semibold text-emerald-200">{run.n_iters}</td>
                        <td className="px-2 py-1">{run.mutual_information.toFixed(4)}</td>
                        <td className="px-2 py-1">{run.mi_quality}</td>
                        <td className="px-2 py-1">{run.ncc_after.toFixed(4)}</td>
                        <td className="px-2 py-1">{(run.processing_time_ms / 1000).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section ref={viewerRef} className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.55)] backdrop-blur lg:col-span-2 md:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Axe</label>
              <select
                value={axis}
                onChange={(e) => handleAxisChange(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                <option value="axial">axial</option>
                <option value="coronal">coronal</option>
                <option value="sagittal">sagittal</option>
              </select>

              <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-300">Coupe</label>
              <input
                type="range"
                min={0}
                max={maxIndex}
                value={index}
                onChange={(e) => handleIndexChange(Number(e.target.value))}
                className="w-full max-w-xs accent-cyan-400"
              />
              <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-cyan-200">{index}/{maxIndex}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Atlas (clic pour identifier)</p>
                <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-black/80 shadow-inner shadow-cyan-500/5">
                  {atlasImage ? (
                    <img
                      src={atlasImage}
                      alt="atlas"
                      className="block w-full cursor-crosshair"
                      onClick={identifyFromClick}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-500">Atlas indisponible</div>
                  )}

                  {selectedRatios && (
                    <div
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75)]"
                      style={{ left: `${selectedRatios.xRatio * 100}%`, top: `${selectedRatios.yRatio * 100}%` }}
                    />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Patient</p>
                <div className="overflow-hidden rounded-2xl border border-slate-700 bg-black/80 shadow-inner shadow-cyan-500/5">
                  {patientImage ? (
                    <img
                      src={patientImage}
                      alt="patient"
                      className="block w-full cursor-crosshair"
                      onClick={identifyFromClick}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-500">Patient indisponible</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <BrodmannIdentificationView
            zone={zone}
            insideBrain={insideBrain}
            axis={axis}
            index={index}
            maxIndex={maxIndex}
            onAxisChange={handleAxisChange}
            onIndexChange={handleIndexChange}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/15 bg-slate-950/90 px-4 py-3 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
            Decision medicale finale: confirmer pour identifier les zones ou rejeter le recalage
          </p>
          <div className="flex gap-2">
            <button
              onClick={rejectRegistration}
              disabled={busy || !canWork}
              className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rejeter le resultat
            </button>
            <button
              onClick={proceedToIdentification}
              disabled={busy || !canWork}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Passer a l'identification des zones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
