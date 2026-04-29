import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import BrodmannIdentificationView from '../components/BrodmannIdentificationView';
import BrodmannSyncedViewer from '../components/BrodmannSyncedViewer';
import BrodmannZone3D from '../components/BrodmannZone3D';

// ── Brodmann areas catalogue ───────────────────────────────────────────────────
const BRODMANN_AREAS = [
  { id: 1,  name: 'Somatosensoriel I',       group: 'Pariétal' },
  { id: 2,  name: 'Somatosensoriel II',      group: 'Pariétal' },
  { id: 3,  name: 'Somatosensoriel III',     group: 'Pariétal' },
  { id: 4,  name: 'Moteur Primaire',         group: 'Frontal' },
  { id: 5,  name: 'Somatosensoriel Assoc.', group: 'Pariétal' },
  { id: 6,  name: 'Prémoteur',              group: 'Frontal' },
  { id: 7,  name: 'Pariétal Supérieur',     group: 'Pariétal' },
  { id: 8,  name: 'Frontal Oculomoteur',    group: 'Frontal' },
  { id: 9,  name: 'Préfrontal DL',          group: 'Frontal' },
  { id: 10, name: 'Préfrontal Ant.',        group: 'Frontal' },
  { id: 11, name: 'Orbitofrontal',          group: 'Frontal' },
  { id: 17, name: 'Visuel Primaire',        group: 'Occipital' },
  { id: 18, name: 'Visuel Associatif',      group: 'Occipital' },
  { id: 19, name: 'Visuel Assoc. II',       group: 'Occipital' },
  { id: 20, name: 'Temporal Inférieur',     group: 'Temporal' },
  { id: 21, name: 'Temporal Moyen',         group: 'Temporal' },
  { id: 22, name: 'Wernicke',               group: 'Temporal' },
  { id: 24, name: 'Cingulaire Ant.',        group: 'Cingulaire' },
  { id: 37, name: 'Fusiforme',              group: 'Temporal' },
  { id: 39, name: 'Gyrus Angulaire',        group: 'Pariétal' },
  { id: 40, name: 'Pariétal Inférieur',     group: 'Pariétal' },
  { id: 41, name: 'Auditif Primaire',       group: 'Temporal' },
  { id: 42, name: 'Auditif Assoc.',         group: 'Temporal' },
  { id: 44, name: 'Broca (pars op.)',       group: 'Frontal' },
  { id: 45, name: 'Broca (pars tri.)',      group: 'Frontal' },
  { id: 46, name: 'Préfrontal',             group: 'Frontal' },
  { id: 47, name: 'Frontal Inférieur',      group: 'Frontal' },
];

const GROUP_COLORS = {
  Frontal:    'text-blue-400',
  Pariétal:   'text-emerald-400',
  Temporal:   'text-amber-400',
  Occipital:  'text-violet-400',
  Cingulaire: 'text-rose-400',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function BrodmannPage() {
  const [jobId, setJobId] = useState('');

  // Zone identification state
  const [zone, setZone] = useState(null);
  const [insideBrain, setInsideBrain] = useState(false);
  const [hasAttempt, setHasAttempt] = useState(false);
  const [mniCoords, setMniCoords] = useState(null);
  const [activeLabelId, setActiveLabelId] = useState(null);

  // Workflow state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoAlignIters, setAutoAlignIters] = useState(60);
  const [alignRuns, setAlignRuns] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);

  // View tab: '2d' | '3d'
  const [activeTab, setActiveTab] = useState('2d');
  const [showMetrics, setShowMetrics] = useState(false);

  const canWork = useMemo(() => !!jobId, [jobId]);

  // Auto-switch to 3D tab when a zone is identified
  useEffect(() => {
    if (activeLabelId) setActiveTab('3d');
  }, [activeLabelId]);

  // ── Patient loading ──────────────────────────────────────────────────────────

  const loadDemoPatient = async (options = {}) => {
    const silent = !!options.silent;
    if (!silent) { setBusy(true); setError(''); setMessage('Chargement du patient demo...'); }
    try {
      const res = await api.post('/volume/load-demo');
      const data = res.data || {};
      const nextJobId = data.jobId;
      if (!nextJobId) throw new Error('jobId manquant');
      setJobId(nextJobId);
      sessionStorage.setItem('volumeJobId', nextJobId);
      if (!silent) setMessage('Patient demo chargé.');
      return nextJobId;
    } catch {
      if (!silent) { setError('Impossible de charger le patient demo.'); setMessage(''); }
      return '';
    } finally {
      if (!silent) setBusy(false);
    }
  };

  const uploadPatientVolume = async () => {
    if (!uploadFile) { setError('Choisissez un fichier patient (.nii/.nii.gz ou image).'); return; }
    setBusy(true); setError(''); setMessage('Upload du volume patient...');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await api.post('/volume/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data || {};
      const nextJobId = data.jobId;
      if (!nextJobId) throw new Error('jobId manquant');
      setJobId(nextJobId);
      sessionStorage.setItem('volumeJobId', nextJobId);
      setMessage('Volume chargé. Lancez le recalage.');
    } catch {
      setError('Echec upload volume patient.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  // ── Registration ─────────────────────────────────────────────────────────────

  const runAutoAlign = async () => {
    if (!jobId) return;
    setBusy(true); setError('');
    setMessage(`Recalage en cours (${autoAlignIters} iters)...`);
    try {
      const res = await api.post('/volume/auto-align', { jobId, n_iters: autoAlignIters });
      const data = res.data || {};
      const metrics = data.metrics || {};
      const runSummary = {
        n_iters: Number(data.n_iters || metrics.n_iters || autoAlignIters),
        mutual_information: Number(metrics.mutual_information || 0),
        ncc_after: Number(metrics.ncc_after || 0),
        processing_time_ms: Number(metrics.processing_time_ms || 0),
        mi_quality: metrics.mi_quality || 'N/A',
      };
      setAlignRuns(prev => [runSummary, ...prev].slice(0, 5));
      setMessage('Recalage terminé. Validez si correct.');
      setShowMetrics(true);
    } catch {
      setError('Recalage automatique échoué.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const validateRegistration = async () => {
    if (!jobId) return false;
    setBusy(true); setError('');
    try {
      await api.post('/volume/validate-registration', { jobId });
      setMessage('Recalage validé et appliqué.');
      return true;
    } catch {
      setError('Validation du recalage échouée.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rejectRegistration = async () => {
    if (!jobId) return false;
    setBusy(true); setError('');
    try {
      await api.post('/volume/reject-registration', { jobId });
      setMessage('Résultat rejeté. Vous pouvez relancer.');
      return true;
    } catch {
      setError('Rejet du recalage échoué.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const proceedToIdentification = async () => {
    await validateRegistration();
  };

  // ── Zone identification callback ─────────────────────────────────────────────

  const handleZoneIdentified = (identifiedZone, isInside, mni) => {
    setZone(identifiedZone);
    setInsideBrain(isInside);
    setMniCoords(mni);
    setHasAttempt(true);
    setActiveLabelId(identifiedZone?.id ?? null);
    setMessage(isInside ? 'Zone Brodmann identifiée.' : 'Point hors cerveau.');
  };

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const saved = sessionStorage.getItem('volumeJobId') || '';
      if (saved) {
        setJobId(saved);
        setMessage('Session restaurée.');
        return;
      }
      const demoJobId = await loadDemoPatient({ silent: true });
      if (demoJobId) setMessage('Atlas et patient test chargés.');
      else setMessage('Chargez un volume ou utilisez le mode démo.');
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Top header: title + controls ──────────────────────────────────────── */}
      <header className="shrink-0 border-b border-white/5 bg-slate-900/80 backdrop-blur">

        {/* Row 1: title + session */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400/80">NeuroScan</p>
              <h1 className="text-sm font-bold text-white leading-tight">Recalage Atlas · Identification Brodmann</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(message || error) && (
              <p className={`text-[10px] font-semibold max-w-xs truncate ${error ? 'text-rose-300' : 'text-cyan-300/80'}`}>
                {error || message}
              </p>
            )}
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.2em] text-slate-600">Session</p>
              <p className="text-[10px] font-mono text-emerald-300/80">{jobId || '—'}</p>
            </div>
          </div>
        </div>

        {/* Row 2: controls */}
        <div className="flex items-center gap-2 px-5 py-2 flex-wrap">
          <input
            type="file"
            accept=".nii,.nii.gz,image/*"
            onChange={e => setUploadFile(e.target.files?.[0] || null)}
            className="text-[11px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-[11px] file:text-slate-200 file:cursor-pointer hover:file:bg-slate-700 max-w-[180px]"
          />
          <button
            onClick={uploadPatientVolume}
            disabled={busy}
            className="rounded-lg bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/30 disabled:opacity-40 transition"
          >
            Charger
          </button>
          <button
            onClick={loadDemoPatient}
            disabled={busy}
            className="rounded-lg bg-slate-800 border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
          >
            Patient démo
          </button>
          <div className="h-4 w-px bg-white/10" />
          <button
            onClick={runAutoAlign}
            disabled={busy || !canWork}
            className="rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 transition"
          >
            {busy ? 'En cours…' : 'Recalage auto'}
          </button>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            Iters
            <input
              type="number"
              min={30} max={1000} step={10}
              value={autoAlignIters}
              onChange={e => setAutoAlignIters(Number(e.target.value || 60))}
              className="w-16 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[11px] text-white outline-none focus:border-cyan-400"
            />
          </label>

          {/* Metrics toggle */}
          {alignRuns.length > 0 && (
            <button
              onClick={() => setShowMetrics(v => !v)}
              className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:bg-white/10 transition"
            >
              {showMetrics ? 'Masquer métriques' : `Métriques (${alignRuns.length})`}
            </button>
          )}
        </div>

        {/* Row 3: registration metrics (collapsible) */}
        {showMetrics && alignRuns.length > 0 && (
          <div className="px-5 py-2 border-t border-white/[0.04] overflow-x-auto">
            <table className="min-w-full text-left text-[10px] text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="pr-4 py-0.5">Itérations</th>
                  <th className="pr-4 py-0.5">MI</th>
                  <th className="pr-4 py-0.5">Qualité MI</th>
                  <th className="pr-4 py-0.5">NCC</th>
                  <th className="pr-4 py-0.5">Temps (s)</th>
                </tr>
              </thead>
              <tbody>
                {alignRuns.map((run, i) => (
                  <tr key={`${run.n_iters}-${i}`} className={i === 0 ? 'text-emerald-200' : ''}>
                    <td className="pr-4 py-0.5 font-semibold">{run.n_iters}</td>
                    <td className="pr-4 py-0.5">{run.mutual_information.toFixed(4)}</td>
                    <td className="pr-4 py-0.5">{run.mi_quality}</td>
                    <td className="pr-4 py-0.5">{run.ncc_after.toFixed(4)}</td>
                    <td className="pr-4 py-0.5">{(run.processing_time_ms / 1000).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </header>

      {/* ── Main 3-column layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Zone description panel */}
        <aside className="w-64 shrink-0 border-r border-white/5 bg-slate-900/30 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
              Description de zone
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <BrodmannIdentificationView
              zone={zone}
              insideBrain={insideBrain}
              hasAttempt={hasAttempt}
              mniCoords={mniCoords}
              className="h-full"
            />
          </div>
        </aside>

        {/* CENTER: Tab viewer */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-slate-900/20 shrink-0">
            <button
              onClick={() => setActiveTab('2d')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                activeTab === '2d'
                  ? 'bg-blue-500/20 border border-blue-400/30 text-blue-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Coupes 2D
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                activeTab === '3d'
                  ? 'bg-violet-500/20 border border-violet-400/30 text-violet-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Visualisation 3D
              {activeLabelId && (
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === '2d' ? (
              <BrodmannSyncedViewer
                jobId={jobId}
                onZoneIdentified={handleZoneIdentified}
                hasAttempt={hasAttempt}
              />
            ) : (
              <div className="h-full min-h-[400px]">
                <BrodmannZone3D
                  labelId={activeLabelId}
                  zoneName={zone?.name}
                  className="h-full"
                />
              </div>
            )}
          </div>
        </main>

        {/* RIGHT: Brodmann zones list */}
        <aside className="w-52 shrink-0 border-l border-white/5 bg-slate-900/30 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
              Atlas Brodmann
            </p>
            <p className="text-[8px] text-slate-600 mt-0.5">{BRODMANN_AREAS.length} aires disponibles</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
            {BRODMANN_AREAS.map(area => {
              const isActive = activeLabelId === area.id;
              const groupColor = GROUP_COLORS[area.group] || 'text-slate-400';
              return (
                <div
                  key={area.id}
                  className={`flex items-center gap-2.5 px-3 py-2 border-b border-white/[0.02] transition-all duration-200 cursor-default ${
                    isActive
                      ? 'bg-blue-500/15 border-l-2 border-l-blue-400'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <span className={`text-[9px] font-black font-mono w-7 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-600'}`}>
                    {area.id}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-semibold leading-tight truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {area.name}
                    </p>
                    <p className={`text-[8px] ${groupColor} opacity-70`}>{area.group}</p>
                  </div>
                  {isActive && (
                    <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

      </div>

      {/* ── Bottom validation bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-5 py-3 backdrop-blur flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
          Décision clinique — confirmer ou rejeter le recalage
        </p>
        <div className="flex gap-2">
          <button
            onClick={rejectRegistration}
            disabled={busy || !canWork}
            className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 transition"
          >
            Rejeter
          </button>
          <button
            onClick={proceedToIdentification}
            disabled={busy || !canWork}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-[11px] font-semibold text-slate-950 hover:brightness-110 disabled:opacity-40 transition"
          >
            Valider → Identification
          </button>
        </div>
      </div>

    </div>
  );
}
