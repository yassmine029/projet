import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CloudUpload,
  Database,
  FileImage,
  Hash,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { createPatient } from '../api';

const API_BASE_URL = 'http://localhost:8000';

const PATHOLOGIES = ['Alzheimer', 'Epilepsie', 'Autre', 'Non defini'];
const SEX_OPTIONS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
];

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR').format(d);
}

function getPatientInitials(nom, prenom) {
  const a = (prenom || '').charAt(0).toUpperCase();
  const b = (nom || '').charAt(0).toUpperCase();
  return (a + b) || '?';
}

const AVATAR_PALETTE = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-sky-600',
];

function avatarGradient(id) {
  return AVATAR_PALETTE[(id || 0) % AVATAR_PALETTE.length];
}

function StatusBadge({ status }) {
  const map = {
    completed:  { label: 'Terminé',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    in_review:  { label: 'En révision', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    urgent:     { label: 'Urgent',      cls: 'bg-red-50 text-red-600 border-red-200' },
    pending:    { label: 'En attente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const s = status ? map[status.toLowerCase()] : null;
  if (!s) return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-slate-50 text-slate-500 border-slate-200">
      Aucun examen
    </span>
  );
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function PatientAvatar({ nom, prenom, id, size = 'md' }) {
  const szCls = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm ${szCls} ${avatarGradient(id)}`}>
      {getPatientInitials(nom, prenom)}
    </span>
  );
}

/* ─── Sidebar: Queue + Storage ─────────────────────────────────────────────── */
function SidebarPanel() {
  return (
    <div className="flex flex-col gap-4">
      {/* Queue status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1f4b] to-[#1a3a8f] p-5 text-white shadow-lg">
        <div className="absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -right-2 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-200">
            <CircleDot className="h-3 w-3 animate-pulse text-emerald-400" />
            Queue Status
          </div>
          <p className="mt-2 text-3xl font-black tracking-tight">98.4%</p>
          <p className="text-xs font-medium text-blue-200">Précision système</p>
          <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-medium text-blue-100">
            4 segmentations en traitement
          </div>
        </div>
      </div>

      {/* Storage */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Database className="h-3.5 w-3.5" />
          Stockage
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>1.2 TB utilisés</span>
            <span className="text-slate-400">5 TB</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[24%] rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">24% utilisé · 3.8 TB disponible</p>
        </div>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-1 gap-2">
        {[
          { icon: ShieldCheck, label: 'HIPAA Compliant', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { icon: Zap,         label: 'GPU Accéléré',    color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { icon: ShieldCheck, label: 'Transfert chiffré', color: 'text-sky-600 bg-sky-50 border-sky-200' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${color}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab: Patient existant ─────────────────────────────────────────────────── */
function ExistingPatientTab({ onPatientSelected }) {
  const [patients, setPatients]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const token = localStorage.getItem('access');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE_URL}/api/patients/`, { headers })
      .then((r) => { if (!r.ok) throw new Error('Impossible de charger les patients.'); return r.json(); })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        setPatients(list);
      })
      .catch((e) => { if (active) setError(e.message || 'Erreur serveur.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter((p) =>
      `${p.prenom || p.first_name || ''} ${p.nom || p.last_name || ''} ${p.dossier_number || ''}`
        .toLowerCase().includes(t)
    );
  }, [patients, searchTerm]);

  const selected = useMemo(() => patients.find((p) => p.id === selectedId) || null, [patients, selectedId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par nom, prénom ou numéro de dossier…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Count */}
      {!loading && !error && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Users className="h-3.5 w-3.5" />
          <span>{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</span>
          {searchTerm && <span className="text-slate-400">· filtrés sur {patients.length}</span>}
        </div>
      )}

      {/* List */}
      <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
        {loading && (
          <div className="flex items-center justify-center gap-2.5 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Chargement…</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <UserRound className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Aucun patient trouvé</p>
            {searchTerm && <p className="text-xs">Essayez un autre terme de recherche</p>}
          </div>
        )}

        {!loading && !error && filtered.map((patient) => {
          const isSelected = selectedId === patient.id;
          const nom    = patient.nom    || patient.last_name  || '';
          const prenom = patient.prenom || patient.first_name || '';
          const fullName = `${prenom} ${nom}`.trim() || 'Patient sans nom';
          const lastRun  = patient.segmentation_runs?.[0];
          const lastDate = lastRun?.created_at || patient.updated_at || null;

          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => setSelectedId(patient.id)}
              className={`group w-full rounded-xl border p-3.5 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <PatientAvatar nom={nom} prenom={prenom} id={patient.id} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`truncate text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                      {fullName}
                    </p>
                    <StatusBadge status={lastRun?.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {patient.dossier_number && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {patient.dossier_number}
                      </span>
                    )}
                    {lastDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDate(lastDate)}
                      </span>
                    )}
                    {patient.pathologie && (
                      <span className="flex items-center gap-1">
                        <Brain className="h-3 w-3" /> {patient.pathologie}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'rotate-90 text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Sticky CTA */}
      {selected && (
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PatientAvatar
              nom={selected.nom || selected.last_name}
              prenom={selected.prenom || selected.first_name}
              id={selected.id}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {`${selected.prenom || selected.first_name || ''} ${selected.nom || selected.last_name || ''}`.trim()}
              </p>
              <p className="text-[11px] text-slate-500">{selected.dossier_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPatientSelected(selected)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Nouveau patient ──────────────────────────────────────────────────── */
function NewPatientTab({ onPatientSelected }) {
  const [form, setForm] = useState({
    nom: '', prenom: '', date_naissance: '', sexe: '', pathologie: '', dossier_number: '',
  });
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState('');
  const [dragging, setDragging]     = useState(false);
  const [mriFile, setMriFile]       = useState(null);
  const fileInputRef                = useRef(null);

  /* Auto-fetch next dossier number */
  useEffect(() => {
    const token = localStorage.getItem('access');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE_URL}/api/patients/next-dossier/`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.ok) setForm((f) => ({ ...f, dossier_number: data.dossier_number })); })
      .catch(() => {});
  }, []);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.prenom.trim()) e.prenom = 'Requis';
    if (!form.nom.trim())    e.nom    = 'Requis';
    if (!form.date_naissance) e.date_naissance = 'Requis';
    if (!form.sexe)           e.sexe = 'Requis';
    if (!form.pathologie)     e.pathologie = 'Requis';
    return e;
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) setMriFile(file);
  }, []);

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    setApiError('');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) payload.append(k, v); });
      if (mriFile) payload.append('files', mriFile);
      const res = await createPatient(payload);
      const created = res.data;
      onPatientSelected(created);
    } catch (err) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(' · ')
        : 'Erreur lors de la création du patient.';
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Form grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Prénom */}
        <Field label="Prénom" error={errors.prenom} required>
          <input
            type="text"
            value={form.prenom}
            onChange={(e) => set('prenom', e.target.value)}
            placeholder="ex. Sarah"
            className={inputCls(errors.prenom)}
          />
        </Field>

        {/* Nom */}
        <Field label="Nom" error={errors.nom} required>
          <input
            type="text"
            value={form.nom}
            onChange={(e) => set('nom', e.target.value)}
            placeholder="ex. Al-Fayed"
            className={inputCls(errors.nom)}
          />
        </Field>

        {/* Date naissance */}
        <Field label="Date de naissance" error={errors.date_naissance} required>
          <input
            type="date"
            value={form.date_naissance}
            onChange={(e) => set('date_naissance', e.target.value)}
            className={inputCls(errors.date_naissance)}
          />
        </Field>

        {/* Sexe */}
        <Field label="Sexe" error={errors.sexe} required>
          <div className="grid grid-cols-2 gap-2">
            {SEX_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('sexe', value)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  form.sexe === value
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {/* Pathologie */}
        <Field label="Pathologie" error={errors.pathologie} required className="col-span-2">
          <div className="flex flex-wrap gap-2">
            {PATHOLOGIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('pathologie', p)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  form.pathologie === p
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        {/* Dossier */}
        <Field label="N° dossier (auto)" className="col-span-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono text-slate-500">
            <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {form.dossier_number || <span className="italic text-slate-400">Génération auto…</span>}
          </div>
        </Field>
      </div>

      {/* MRI upload zone */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Scan IRM / NIfTI <span className="font-normal normal-case text-slate-400">(optionnel)</span>
        </p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : mriFile
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".nii,.nii.gz,.dcm,.dicom"
            className="hidden"
            onChange={handleFileDrop}
          />
          {mriFile ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <FileImage className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-emerald-800">{mriFile.name}</p>
                <p className="text-xs text-emerald-600">{(mriFile.size / 1024 / 1024).toFixed(1)} MB · Prêt à importer</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMriFile(null); }}
                className="ml-auto rounded-full p-1 text-emerald-500 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                <CloudUpload className="h-6 w-6 text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Glisser-déposer votre fichier DICOM ou NIfTI
              </p>
              <p className="text-xs text-slate-400">ou cliquer pour parcourir · .nii .nii.gz .dcm</p>
            </div>
          )}
        </div>

        {/* Import from PACS */}
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Building2 className="h-4 w-4" />
          Importer depuis le PACS
        </button>
      </div>

      {/* API error */}
      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {apiError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {submitting ? 'Création en cours…' : 'Créer le patient et continuer'}
        {!submitting && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function inputCls(hasError) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:ring-2 ${
    hasError
      ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200'
      : 'border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20'
  }`;
}

function Field({ label, error, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────────────────────────────── */
function StepDot({ active, done, label, n }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition ${
        done   ? 'bg-emerald-400 text-white' :
        active ? 'bg-white text-blue-700 shadow' :
                 'bg-white/20 text-white/60'
      }`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={`hidden text-[11px] font-semibold sm:block ${active ? 'text-white' : 'text-white/60'}`}>
        {label}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */
export default function SegmentationModal({ onClose, onPatientSelected }) {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/30 max-h-[92vh]">

        {/* ── Header gradient ──────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0f1f4b] via-[#0e2d82] to-[#1a3a8f] px-6 py-5">
          {/* decorative circles */}
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
          <span className="absolute right-24 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">VisionMed AI</p>
                <h2 className="text-lg font-black text-white">Nouvelle Segmentation</h2>
              </div>
            </div>

            {/* Steps */}
            <div className="hidden md:flex items-center gap-3">
              <StepDot n={1} active label="Patient" />
              <span className="h-px w-6 bg-white/30" />
              <StepDot n={2} label="Coupes" />
              <span className="h-px w-6 bg-white/30" />
              <StepDot n={3} label="Inférence" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="relative mt-5 inline-flex rounded-xl bg-white/10 p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                mode === 'existing'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Patient existant
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                mode === 'new'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Nouveau patient
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Sub-header */}
            <div className="mb-5">
              {mode === 'existing' ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Search className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Sélectionner un patient</h3>
                    <p className="text-xs text-slate-500">Recherchez dans les dossiers cliniques existants</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                    <UserPlus className="h-4.5 w-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Enregistrer un nouveau patient</h3>
                    <p className="text-xs text-slate-500">Créez un dossier patient et importez le scan IRM</p>
                  </div>
                </div>
              )}
            </div>

            {mode === 'existing'
              ? <ExistingPatientTab onPatientSelected={onPatientSelected} />
              : <NewPatientTab onPatientSelected={onPatientSelected} />
            }
          </div>

          {/* Sidebar */}
          <div className="hidden w-64 shrink-0 overflow-y-auto border-l border-slate-100 bg-slate-50/60 p-5 xl:block">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Système</p>
            <SidebarPanel />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>Étape <strong className="text-slate-600">1</strong> sur 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
