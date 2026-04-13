import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Search, UserRound, X } from 'lucide-react';
import api from '../api';

const CHECKLIST_STEPS = [
  'Préparation des données',
  'Chargement du modèle',
  'Inférence Deep Learning',
  'Calcul volumétrique',
  'Génération du rapport',
];

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706'];

function getDoctorName() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'Medecin';
    const user = JSON.parse(raw);
    const fromFullName = String(user?.fullName || user?.full_name || '').trim();
    if (fromFullName && !fromFullName.includes('@')) return fromFullName;

    const firstName = String(user?.first_name || user?.prenom || '').trim();
    const lastName = String(user?.last_name || user?.nom || '').trim();
    const merged = `${firstName} ${lastName}`.trim();
    if (merged) return merged;

    const username = String(user?.username || '').trim();
    if (!username || username.includes('@')) return 'Medecin';
    return username;
  } catch {
    return 'Medecin';
  }
}

function getPatientName(patient) {
  const firstName = String(patient?.first_name || patient?.prenom || '').trim();
  const lastName = String(patient?.last_name || patient?.nom || '').trim();
  const full = `${firstName} ${lastName}`.trim();
  const fallback = String(patient?.full_name || patient?.name || '').trim();
  return full || fallback || `Patient #${patient?.id ?? '—'}`;
}

function getPatientKey(patient, index) {
  return patient?.id || patient?.dossier_number || patient?.num_dossier || patient?.patient_id || `patient-${index}`;
}

function getInitials(patient) {
  const first = String(patient?.first_name || patient?.prenom || '').trim();
  const last = String(patient?.last_name || patient?.nom || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase().trim();
  return initials || '?';
}

function getDateOfBirth(patient) {
  return patient?.date_of_birth || patient?.birth_date || patient?.dob || patient?.date_naissance || null;
}

function formatDate(value, withYear = true) {
  if (!value) return withYear ? 'Date inconnue' : '--/--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return withYear ? 'Date inconnue' : '--/--';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (!withYear) return `${day}/${month}`;

  return `${day}/${month}/${date.getFullYear()}`;
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const age = Math.floor((new Date() - dob) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function getBirthPrefix(patient) {
  const sex = String(patient?.sexe || patient?.gender || patient?.sex || '').toLowerCase();
  if (sex === 'f' || sex === 'female' || sex === 'femme') return 'Née';
  return 'Né';
}

function formatIpp(patient) {
  const raw = String(
    patient?.ipp || patient?.patient_id || patient?.dossier_id || patient?.dossier_number || patient?.num_dossier || patient?.id || ''
  ).trim();

  if (!raw) return 'IPP-—';

  const noPrefix = raw.replace(/^IPP-/i, '');
  const compact = noPrefix.length > 12 ? noPrefix.slice(-8) : noPrefix;
  return `IPP-${compact}`;
}

function getPathologyBadge(patient) {
  const source = String(patient?.pathology || patient?.pathologie || patient?.diagnosis || patient?.motif || '').toLowerCase();
  if (source.includes('alz')) return { label: 'Alzheimer', classes: 'bg-red-50 text-red-700' };
  if (source.includes('épil') || source.includes('epil')) return { label: 'Épilepsie', classes: 'bg-violet-50 text-violet-700' };
  return { label: 'Suivi', classes: 'bg-emerald-50 text-emerald-700' };
}

function getSlicesCount(patient) {
  if (Array.isArray(patient?.mri_files)) return patient.mri_files.length;
  if (typeof patient?.slices_count === 'number') return patient.slices_count;
  if (typeof patient?.analyses_count === 'number') return patient.analyses_count;
  if (Array.isArray(patient?.folder)) return patient.folder.length;
  return null;
}

function getLastExam(patient) {
  return patient?.last_exam || patient?.updated_at || patient?.created_at || null;
}

export default function NouvelleSegmentation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const launchTriggeredRef = useRef(false);

  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [slices, setSlices] = useState([]);
  const [selectedSlices, setSelectedSlices] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [slicesLoading, setSlicesLoading] = useState(false);
  const [slicesError, setSlicesError] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [progress, setProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [launchResult, setLaunchResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [persistedResults, setPersistedResults] = useState([]);

  const [doctorName, setDoctorName] = useState(getDoctorName());
  const runIdFromQuery = searchParams.get('run');

  useEffect(() => {
    const loadDoctorName = async () => {
      try {
        const response = await api.get('/check_session');
        const user = response?.data?.user;
        if (!user || typeof user !== 'object') return;

        const fromFullName = String(user.fullName || user.full_name || '').trim();
        let display = fromFullName;
        if (!display || display.includes('@')) {
          const firstName = String(user.first_name || user.prenom || '').trim();
          const lastName = String(user.last_name || user.nom || '').trim();
          display = `${firstName} ${lastName}`.trim();
        }
        if (!display) {
          const username = String(user.username || '').trim();
          display = (!username || username.includes('@')) ? 'Medecin' : username;
        }

        setDoctorName(display);
        localStorage.setItem('user', JSON.stringify(user));
      } catch {
        // Keep local fallback name when session call fails.
      }
    };

    loadDoctorName();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access');
      const response = await api.get('/patients/', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = response.data;
      const normalized = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.patients)
          ? payload.patients
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

      setPatients(normalized);
    } catch {
      setError('Erreur de chargement');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatientSlices = async () => {
    if (!selectedPatient?.id) return;

    setSlicesLoading(true);
    setSlicesError(false);

    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/patients/${selectedPatient.id}/mri-files/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = response?.data;
      const files = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.mri_files)
          ? payload.mri_files
          : Array.isArray(payload?.files)
            ? payload.files
            : [];

      setSlices(files);
      setSelectedSlices([]);
      setImageErrors({});
    } catch {
      setSlices([]);
      setSlicesError(true);
    } finally {
      setSlicesLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2 && selectedPatient?.id) {
      fetchPatientSlices();
    }
  }, [step, selectedPatient?.id]);

  useEffect(() => {
    if (step !== 4 || !isLaunching) return undefined;

    const interval = setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        return current + 2;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [step, isLaunching]);

  const launchSegmentation = async () => {
    if (!selectedPatient?.id) {
      setLaunchError('Veuillez sélectionner un patient avant de lancer la segmentation.');
      setProgress(0);
      return;
    }
    if (!selectedModel) {
      setLaunchError('Veuillez choisir un modèle IA avant de lancer la segmentation.');
      setProgress(0);
      return;
    }
    if (!Array.isArray(selectedSlices) || selectedSlices.length === 0) {
      setLaunchError('Aucune coupe sélectionnée. Revenez à l\'étape 2 pour choisir au moins une coupe.');
      setProgress(0);
      return;
    }

    setIsLaunching(true);
    setLaunchError('');
    setLaunchResult(null);
    setShowResults(false);
    setResultsError('');
    setPersistedResults([]);
    setProgress(5);

    try {
      const token = localStorage.getItem('access');
      const response = await api.post(
        `/patients/${selectedPatient.id}/segment/`,
        {
          model: selectedModel,
          file_ids: selectedSlices,
          threshold: 0.25,
        },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      setLaunchResult(response?.data || null);
      setProgress(100);
    } catch (err) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message;
      setLaunchError(apiMessage || 'Le lancement de la segmentation a échoué.');
      setProgress(0);
    } finally {
      setIsLaunching(false);
    }
  };

  useEffect(() => {
    if (step !== 4) {
      launchTriggeredRef.current = false;
      setIsLaunching(false);
      setLaunchError('');
      setLaunchResult(null);
      setShowResults(false);
      setResultsError('');
      setPersistedResults([]);
      setProgress(0);
      return;
    }

    if (!launchTriggeredRef.current) {
      launchTriggeredRef.current = true;
      launchSegmentation();
    }
  }, [step, selectedPatient?.id, selectedModel, selectedSlices]);

  const toAbsoluteMediaUrl = (rawUrl) => {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const loadSegmentationResults = async (runId) => {
    setResultsLoading(true);
    setResultsError('');
    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/segmentation-runs/${runId}/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const run = response?.data?.run || {};
      const rows = Array.isArray(run?.results) ? run.results : [];
      setPersistedResults(rows);
      setShowResults(true);

      const runPatientId = run?.patient;
      if (runPatientId && !selectedPatient) {
        setSelectedPatient((prev) => prev || { id: runPatientId, full_name: `Patient #${runPatientId}` });
      }

      const runModel = String(run?.model_key || '').trim();
      if (runModel) {
        setSelectedModel(runModel);
      }

      if (rows.length > 0) {
        const inferredSliceIds = Array.from(
          new Set(
            rows
              .map((r) => r?.mri_file)
              .filter((id) => id != null)
          )
        );
        if (inferredSliceIds.length > 0) {
          setSelectedSlices((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : inferredSliceIds));
        }
      }
    } catch (err) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message;
      setResultsError(apiMessage || 'Impossible de charger les résultats de segmentation.');
    } finally {
      setResultsLoading(false);
    }
  };

  const openSegmentationResults = async () => {
    const runId = launchResult?.run_id;
    if (!runId) {
      setPersistedResults(Array.isArray(launchResult?.results) ? launchResult.results : []);
      setShowResults(true);
      return;
    }
    await loadSegmentationResults(runId);
  };

  const currentRunId = Number(launchResult?.run_id || runIdFromQuery || 0);

  useEffect(() => {
    if (!runIdFromQuery) return;
    const parsed = Number(runIdFromQuery);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    launchTriggeredRef.current = true;
    setStep(4);
    setProgress(100);
    setLaunchError('');
    setLaunchResult({ run_id: parsed });
    loadSegmentationResults(parsed);
  }, [runIdFromQuery]);

  const flowSteps = [
    { id: 1, label: 'Sélection du patient' },
    { id: 2, label: 'Coupes IRM' },
    { id: 3, label: 'Modèle IA' },
    { id: 4, label: 'Lancement' },
  ];

  const filteredPatients = useMemo(
    () =>
      patients.filter((p) =>
        (`${p.first_name || p.prenom || ''} ${p.last_name || p.nom || ''}`)
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [patients, search]
  );

  const completedSteps = Math.min(5, Math.floor(progress / 20));

  const resolveSliceUrl = (slice) => {
    const raw = String(slice?.preview_url || slice?.file_url || slice?.url || slice?.file || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const getSliceIndex = (slice, index) => {
    if (typeof slice?.index === 'number') return slice.index;
    return index + 1;
  };

  const getSliceName = (slice, index) => {
    const fileName = String(slice?.original_filename || slice?.filename || slice?.relative_path || '').trim();
    return fileName || `Coupe N°${getSliceIndex(slice, index)}`;
  };

  const truncateFilename = (value) => {
    if (!value) return 'fichier';
    return value.length > 14 ? `${value.slice(0, 14)}...` : value;
  };

  const toggleSlice = (sliceId) => {
    if (sliceId == null) return;
    setSelectedSlices((prev) =>
      prev.includes(sliceId)
        ? prev.filter((index) => index !== sliceId)
        : [...prev, sliceId]
    );
  };

  const resetFlow = () => {
    if (runIdFromQuery) {
      navigate('/segmentation/nouvelle', { replace: true });
    }
    setStep(1);
    setSelectedPatient(null);
    setSlices([]);
    setSelectedSlices([]);
    setSelectedModel('');
    setSlicesLoading(false);
    setSlicesError(false);
    setImageErrors({});
    setProgress(0);
    setIsLaunching(false);
    setLaunchError('');
    setLaunchResult(null);
    setShowResults(false);
    setResultsError('');
    setPersistedResults([]);
    launchTriggeredRef.current = false;
    setSearch('');
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans">
      <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
            <UserRound className="h-4 w-4" />
          </span>
          <div>
            <p className="text-white text-[14px] font-medium">Nouvelle segmentation hippocampique</p>
            <p className="text-blue-300 text-[11px]">Analyses MRI · Dr. {doctorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
          >
            Acceder au dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
            aria-label="Retour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-surface-border flex items-center px-6 overflow-x-auto">
        {flowSteps.map((item, index) => {
          const isCompleted = step > item.id;
          const isActive = step === item.id;
          return (
            <React.Fragment key={item.id}>
              <div
                className={`flex items-center gap-2 py-3 border-b-2 ${
                  isActive
                    ? 'text-primary font-medium border-primary'
                    : isCompleted
                      ? 'text-primary font-medium border-transparent'
                      : 'text-gray-400 border-transparent'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                    isActive
                      ? 'bg-primary text-white rounded-full'
                      : isCompleted
                        ? 'bg-green-500 text-white rounded-full'
                        : 'border-2 border-surface-border text-gray-400 rounded-full'
                  }`}
                >
                  {isCompleted ? '✓' : item.id}
                </span>
                <span className="text-sm whitespace-nowrap">{item.id}. {item.label}</span>
              </div>
              {index < flowSteps.length - 1 && <span className="px-3 text-gray-300">›</span>}
            </React.Fragment>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-card border border-surface-border overflow-hidden">
          <div className="p-6 lg:p-8">
            {step === 1 && (
              <div className="space-y-4">
                <div className="search-box flex items-center gap-2 px-3 py-2 border border-surface-border rounded-lg bg-slate-50 text-sm">
                  <Search className="w-4 h-4 text-slate-500 opacity-35" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher par nom, prénom ou IPP…"
                    className="w-full bg-transparent outline-none"
                  />
                  <span className="rounded-full bg-white border border-surface-border px-2.5 py-1 text-xs text-gray-600 whitespace-nowrap">
                    {filteredPatients.length} patients
                  </span>
                </div>

                {loading && (
                  <div className="h-56 flex items-center justify-center">
                    <span className="inline-block h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  </div>
                )}

                {!loading && error && (
                  <div className="h-56 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm font-semibold text-red-600">Erreur de chargement</p>
                    <button
                      type="button"
                      onClick={fetchPatients}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Réessayer
                    </button>
                  </div>
                )}

                {!loading && !error && (
                  <>
                    <p className="text-[11px] uppercase tracking-[0.06em] text-gray-400">Mes patients</p>

                    <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                      {filteredPatients.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-gray-600 bg-white border border-surface-border rounded-lg">
                          Aucun patient correspondant.
                        </div>
                      )}

                      {filteredPatients.map((patient, index) => {
                        const key = getPatientKey(patient, index);
                        const isSelected = selectedPatient && getPatientKey(selectedPatient, -1) === key;
                        const pathology = getPathologyBadge(patient);
                        const slicesCount = getSlicesCount(patient);
                        const ippLabel = formatIpp(patient);
                        const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
                        const dob = getDateOfBirth(patient);
                        const age = getAge(dob);

                        return (
                          <div
                            key={key}
                            onClick={() => setSelectedPatient(patient)}
                            className={`patient-row flex items-center gap-3 px-4 py-4 bg-white border border-surface-border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                              isSelected ? 'border-[1.5px] border-blue-600 bg-blue-50' : ''
                            }`}
                          >
                            <span
                              className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                            </span>

                            <div
                              className="w-[38px] h-[38px] shrink-0 rounded-full text-white flex items-center justify-center font-semibold text-xs"
                              style={{ backgroundColor: avatarColor }}
                            >
                              {getInitials(patient)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-primary truncate">{getPatientName(patient)}</p>
                              <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                                {getBirthPrefix(patient)} le {formatDate(dob)} · {age !== null ? `${age} ans` : 'Âge inconnu'} ·{' '}
                                <span className="inline-flex items-center rounded-[3px] bg-[#f1f5f9] px-[6px] py-[1px] font-mono text-[11px] text-[#64748b] align-middle">
                                  {ippLabel}
                                </span>
                              </p>
                            </div>

                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pathology.classes}`}>
                              {pathology.label}
                            </span>

                            <div className="w-14 shrink-0 text-center">
                              <p className="text-xs font-semibold text-primary">{slicesCount ?? '—'}</p>
                              <p className="text-[10px] text-gray-400">coupes</p>
                            </div>

                            <div className="w-24 shrink-0 text-center">
                              <p className="text-xs font-semibold text-primary">{formatDate(getLastExam(patient), false)}</p>
                              <p className="text-[10px] text-gray-400">dernier examen</p>
                            </div>

                            <span className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {selectedPatient && (
                      <div className="mt-4 rounded-md border px-[14px] py-[10px] flex items-center gap-2 bg-blue-50 border-blue-200">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm text-[#2563eb]">
                          Patient sélectionné : {getPatientName(selectedPatient)} · {getSlicesCount(selectedPatient) ?? '—'} coupes IRM disponibles
                        </p>
                      </div>
                    )}

                    <div className="mt-6 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-surface-border flex items-center justify-between">
                      <p className="text-sm text-gray-500">Étape 1 sur 4</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(-1)}
                          className="outline-button border border-surface-border text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-blue-50/50"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={!selectedPatient}
                          onClick={() => setStep(2)}
                          className="bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#2563eb] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#2563eb] disabled:hover:bg-[#2563eb]"
                        >
                          Confirmer le patient →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 shrink-0 rounded-full text-white flex items-center justify-center font-semibold text-xs"
                      style={{ backgroundColor: '#2563eb' }}
                    >
                      {getInitials(selectedPatient || {})}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 truncate">
                        Patient sélectionné : <span className="font-semibold">{getPatientName(selectedPatient || {})}</span>
                      </p>
                      <p className="text-xs text-blue-700">{slices.length} coupes IRM disponibles</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedSlices([]);
                    }}
                    className="text-sm text-blue-700 hover:text-blue-800"
                  >
                    ← Changer de patient
                  </button>
                </div>

                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlices(slices.map((slice) => slice.id).filter((id) => id != null))}
                    disabled={slicesLoading || slices.length === 0}
                    className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Tout sélectionner
                  </button>
                  <p className="text-sm text-slate-600 px-1">{selectedSlices.length} coupes sélectionnées</p>
                  <button
                    type="button"
                    onClick={() => setSelectedSlices([])}
                    disabled={slicesLoading || selectedSlices.length === 0}
                    className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-blue-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Tout désélectionner
                  </button>
                </div>

                {slicesLoading && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={`skeleton-${index}`} className="overflow-hidden rounded-lg border border-surface-border bg-white">
                        <div className="aspect-square animate-pulse bg-gray-200" />
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-14 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!slicesLoading && slicesError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-red-700">Impossible de charger les coupes</p>
                    <button
                      type="button"
                      onClick={fetchPatientSlices}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                    >
                      Réessayer
                    </button>
                  </div>
                )}

                {!slicesLoading && !slicesError && slices.length === 0 && (
                  <div className="rounded-lg border border-blue-100 bg-white px-6 py-10 text-center">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5c-4.5 0-8 2.6-9.5 6.5C4 15.4 7.5 18 12 18s8-2.6 9.5-6.5C20 7.6 16.5 5 12 5Z" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="12" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-800">Aucune coupe IRM trouvée pour ce patient.</p>
                    <p className="mt-1 text-sm text-slate-600">Veuillez d'abord uploader un dossier IRM dans la fiche patient.</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${selectedPatient?.id}`)}
                      className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                    >
                      Aller à la fiche patient
                    </button>
                  </div>
                )}

                {!slicesLoading && !slicesError && slices.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {slices.map((slice, index) => {
                      const sliceId = slice?.id;
                      const isSelected = selectedSlices.includes(sliceId);
                      const imageBroken = Boolean(imageErrors[sliceId]);
                      const imageSrc = resolveSliceUrl(slice);
                      const sliceIndex = getSliceIndex(slice, index);
                      const filename = getSliceName(slice, index);

                      return (
                        <button
                          key={sliceId || `slice-${index}`}
                          type="button"
                          onClick={() => toggleSlice(sliceId)}
                          className={`relative overflow-hidden rounded-lg border border-surface-border bg-white text-left cursor-pointer transition-colors ${
                            isSelected ? 'border-[1.5px] border-[#2563eb]' : 'hover:border-blue-200'
                          }`}
                        >
                          {isSelected && <div className="absolute inset-x-0 top-0 h-8 bg-[#2563eb]/10" />}
                          <span
                            className={`absolute right-2 top-2 z-10 h-5 w-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>

                          <div className="aspect-square w-full bg-gray-100">
                            {!imageBroken && imageSrc ? (
                              <img
                                src={imageSrc}
                                alt={`Coupe ${sliceIndex}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={() => setImageErrors((prev) => ({ ...prev, [sliceId]: true }))}
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-400">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M12 5c-4.5 0-8 2.6-9.5 6.5C4 15.4 7.5 18 12 18s8-2.6 9.5-6.5C20 7.6 16.5 5 12 5Z" stroke="currentColor" strokeWidth="1.6" />
                                  <circle cx="12" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between px-3 py-2">
                            <p className="text-[11px] text-slate-500">{truncateFilename(filename)}</p>
                            <p className="text-[11px] text-[#2563eb]">Coupe N°{sliceIndex}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-surface-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-700">{selectedSlices.length} / {slices.length} coupes sélectionnées</p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-blue-50/50"
                    >
                      ← Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={selectedSlices.length === 0}
                      className="rounded-lg bg-[#2563eb] border border-[#2563eb] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#2563eb] disabled:hover:bg-[#2563eb]"
                    >
                      Continuer vers le modèle →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-primary">Étape 3/4 : Sélection du modèle Deep Learning</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Choisissez le modèle à utiliser pour ce lancement de segmentation.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { key: 'swinunetr', label: 'SwinUNETR', desc: 'Transformers 3D pour segmentation volumétrique.' },
                    { key: 'nnunet', label: 'nnU-Net', desc: 'Pipeline auto-configuré robuste pour imagerie médicale.' },
                    { key: 'unetpp', label: 'U-Net++', desc: 'Architecture U-Net avec skip connections denses.' },
                  ].map((model) => {
                    const isActive = selectedModel === model.key;
                    return (
                      <button
                        key={model.key}
                        type="button"
                        onClick={() => setSelectedModel(model.key)}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          isActive
                            ? 'border-primary bg-primary-light'
                            : 'border-surface-border bg-white hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-primary">{model.label}</p>
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                              isActive ? 'border-primary bg-primary text-white' : 'border-surface-border text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">{model.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 border-t border-surface-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Patient: <span className="font-medium text-primary">{getPatientName(selectedPatient || {})}</span> · {selectedSlices.length} coupe{selectedSlices.length > 1 ? 's' : ''}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-blue-50/50"
                    >
                      ← Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      disabled={!selectedModel}
                      className="rounded-lg bg-[#2563eb] border border-[#2563eb] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#2563eb] disabled:hover:bg-[#2563eb]"
                    >
                      Confirmer le modèle →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                {showResults && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-primary">Résultats de segmentation</h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!Number.isFinite(currentRunId) || currentRunId <= 0) return;
                            navigate(`/segmentation/modelisation?run=${currentRunId}`);
                          }}
                          disabled={!Number.isFinite(currentRunId) || currentRunId <= 0}
                          className="rounded-lg bg-[#2563eb] border border-[#2563eb] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Valider segmentation
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowResults(false);
                            setStep(2);
                            setProgress(0);
                            setLaunchError('');
                            launchTriggeredRef.current = false;
                          }}
                          className="rounded-lg bg-[#2563eb] border border-[#2563eb] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
                        >
                          Choisir un autre modele
                        </button>
                      </div>
                    </div>

                    {resultsLoading && (
                      <div className="h-40 flex items-center justify-center">
                        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                      </div>
                    )}

                    {!resultsLoading && resultsError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-700">{resultsError}</p>
                      </div>
                    )}

                    {!resultsLoading && !resultsError && persistedResults.length === 0 && (
                      <div className="rounded-lg border border-surface-border bg-white p-4 text-sm text-gray-600">
                        Aucun résultat disponible pour ce lancement.
                      </div>
                    )}

                    {!resultsLoading && !resultsError && persistedResults.length > 0 && (
                      <div className="space-y-3">
                        {persistedResults.map((row, idx) => {
                          const sourceSrc = toAbsoluteMediaUrl(row?.source_url || row?.source_file);
                          const maskSrc = toAbsoluteMediaUrl(row?.mask_url || row?.mask_file);
                          const sliceLabel = row?.slice_index || idx + 1;
                          return (
                            <div key={row?.id || `${row?.mri_file || 'slice'}-${idx}`} className="rounded-xl border border-surface-border bg-white p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold text-primary">Coupe N°{sliceLabel}</p>
                                <p className="text-xs text-gray-500">{row?.source_filename || 'fichier IRM'}</p>
                              </div>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Coupe originale</p>
                                  <div className="overflow-hidden rounded-lg border border-surface-border bg-slate-50">
                                    {sourceSrc ? (
                                      <img src={sourceSrc} alt={`source-${sliceLabel}`} className="h-56 w-full object-contain" loading="lazy" />
                                    ) : (
                                      <div className="h-56 flex items-center justify-center text-sm text-gray-500">Image source indisponible</div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Masque généré</p>
                                  <div className="overflow-hidden rounded-lg border border-surface-border bg-slate-50">
                                    {maskSrc ? (
                                      <img src={maskSrc} alt={`mask-${sliceLabel}`} className="h-56 w-full object-contain" loading="lazy" />
                                    ) : (
                                      <div className="h-56 flex items-center justify-center text-sm text-gray-500">Masque indisponible</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {!showResults && (
                  <>
                <div>
                  <h2 className="text-xl font-semibold text-primary">Étape 4/4 : Segmentation en cours</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{getPatientName(selectedPatient || {})}</span> · {selectedSlices.length} coupe{selectedSlices.length > 1 ? 's' : ''} sélectionnée{selectedSlices.length > 1 ? 's' : ''} · modèle {selectedModel || '—'}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">Progression</span>
                    <span className="font-bold text-blue-600">{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {launchError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">{launchError}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={launchSegmentation}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                      >
                        Réessayer
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50/50"
                      >
                        Retour au choix du modèle
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {CHECKLIST_STEPS.map((item, index) => {
                    const done = index < completedSteps;
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                          done
                            ? 'border-blue-200 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                            done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {done ? '✓' : '•'}
                        </span>
                        <span className="text-sm">{item}</span>
                      </div>
                    );
                  })}
                </div>

                {(launchResult || progress >= 100) && !launchError && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Segmentation terminée ✓</h3>
                    <p className="mt-1 text-sm text-slate-700">Les résultats seront disponibles dans Analyses MRI</p>
                    {launchResult?.count != null && (
                      <p className="mt-1 text-xs text-slate-600">{launchResult.count} coupe{launchResult.count > 1 ? 's' : ''} traitée{launchResult.count > 1 ? 's' : ''}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openSegmentationResults}
                        className="inline-flex items-center rounded-lg border border-[#2563eb] bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
                      >
                        Voir les résultats
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="inline-flex items-center rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50/50"
                      >
                        Modifier les coupes
                      </button>
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
