import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, User, FileText, Box, Filter, Loader2, ChevronRight, Lock,
  Upload, FolderOpen, File, CheckCircle2, Database, RefreshCw,
} from 'lucide-react';

interface Patient {
  id: number;
  num_dossier: string;
  nom: string;
  prenom: string;
  age: number | null;
  sexe: string;
  has_2d: boolean;
  has_nifti: boolean;
  slices_count: number;
  has_registration?: boolean;
  last_registration_date?: string | null;
  registration_count?: number;
}

interface PatientSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatient: (patient: Patient) => void;
  onLocalImport?: (file: File) => void;
  mode?: '2d' | '3d' | 'advanced' | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function acceptForMode(mode?: '2d' | '3d' | 'advanced' | null): string {
  if (mode === '3d' || mode === 'advanced') return '.nii,.nii.gz';
  return 'image/*,.dcm,.dicom';
}

function hintForMode(mode?: '2d' | '3d' | 'advanced' | null): string {
  if (mode === '3d' || mode === 'advanced') return 'NIfTI (.nii / .nii.gz)';
  return 'Image médicale (JPG, PNG, DICOM…)';
}

function isValidFile(file: File, mode?: '2d' | '3d' | 'advanced' | null): boolean {
  const name = file.name.toLowerCase();
  if (mode === '3d' || mode === 'advanced') {
    return name.endsWith('.nii') || name.endsWith('.nii.gz');
  }
  return file.type.startsWith('image/') || name.endsWith('.dcm') || name.endsWith('.dicom');
}

// ── Component ─────────────────────────────────────────────────────────────────

const PatientSelectionModal: React.FC<PatientSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectPatient,
  onLocalImport,
  mode,
}) => {
  // DB tab state
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all' | '2d' | '3d' | 'registered' | 'unregistered'>('all');

  // Tab state
  const [activeTab, setActiveTab] = useState<'db' | 'local'>('db');

  // Local import state
  const [dragOver, setDragOver]   = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === '3d' || mode === 'advanced') setFilter('3d');
      else if (mode === '2d') setFilter('2d');
      else setFilter('all');
      setLocalFile(null);
      setFileError('');
      setActiveTab('db');
      fetchPatients();
    }
  }, [isOpen, mode]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/patients/');
      const data = await response.json();
      if (data.ok) setPatients(data.patients);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = (patient: Patient): boolean => {
    if (mode === '3d' || mode === 'advanced') return !patient.has_nifti;
    if (mode === '2d') return !patient.has_2d;
    return false;
  };

  const blockReason = (patient: Patient): string => {
    if ((mode === '3d' || mode === 'advanced') && !patient.has_nifti)
      return 'Aucun volume NIfTI 3D disponible';
    if (mode === '2d' && !patient.has_2d)
      return 'Aucune image 2D disponible';
    return '';
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = `${p.nom} ${p.prenom} ${p.num_dossier}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === '2d' && p.has_2d) ||
      (filter === '3d' && p.has_nifti) ||
      (filter === 'registered' && p.has_registration) ||
      (filter === 'unregistered' && !p.has_registration);
    return matchesSearch && matchesFilter;
  });

  const availableCount = filteredPatients.filter(p => !isBlocked(p)).length;
  const blockedCount   = filteredPatients.filter(p =>  isBlocked(p)).length;

  // ── Local import handlers ────────────────────────────────────────────────────

  const handleFileDrop = useCallback((file: File) => {
    setFileError('');
    if (!isValidFile(file, mode)) {
      setFileError(`Format non supporté. Attendu : ${hintForMode(mode)}`);
      setLocalFile(null);
      return;
    }
    setLocalFile(file);
  }, [mode]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileDrop(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
    e.target.value = '';
  };

  const confirmLocalImport = () => {
    if (!localFile || !onLocalImport) return;
    onLocalImport(localFile);
    onClose();
  };

  // ── Mode label ───────────────────────────────────────────────────────────────

  const modeLabel =
    mode === '3d'       ? '3D NIfTI' :
    mode === 'advanced' ? 'Avancé 3D + Brodmann' :
    mode === '2d'       ? '2D' : null;

  const modeColor =
    (mode === '3d' || mode === 'advanced')
      ? { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: <Box className="w-3.5 h-3.5" /> }
      : { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: <FileText className="w-3.5 h-3.5" /> };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/40 bg-white/80 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200/60 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 shadow-inner">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Charger les données
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Sélectionnez un dossier patient ou importez un fichier depuis votre disque
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Mode banner ─────────────────────────────────────────────────────── */}
        {modeLabel && (
          <div className={`flex items-center gap-3 px-8 py-3 text-[11px] font-black uppercase tracking-[0.15em] border-b ${modeColor.bg} ${modeColor.border} ${modeColor.text}`}>
            {modeColor.icon}
            <span>Mode {modeLabel} actif</span>
            {activeTab === 'db' && (
              <span className="ml-auto font-semibold normal-case tracking-normal">
                {availableCount} patient{availableCount !== 1 ? 's' : ''} compatible{availableCount !== 1 ? 's' : ''}
                {blockedCount > 0 && ` · ${blockedCount} incompatible${blockedCount !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200/60 bg-slate-50/50 px-8">
          <button
            onClick={() => setActiveTab('db')}
            className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-black transition-all ${
              activeTab === 'db'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Database className="h-4 w-4" />
            Base de données
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`ml-6 flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-black transition-all ${
              activeTab === 'local'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Upload className="h-4 w-4" />
            Import local
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Tab: Base de données ────────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'db' && (
          <>
            {/* Toolbar */}
            <div className="border-b border-slate-200/60 bg-slate-50/50 px-8 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all',          label: 'Tous' },
                    { id: '2d',           label: 'Images 2D' },
                    { id: '3d',           label: 'Volume NIfTI' },
                    { id: 'registered',   label: 'Recalés' },
                    { id: 'unregistered', label: 'Non recalés' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setFilter(opt.id as any)}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border ${
                        filter === opt.id
                          ? opt.id === 'registered'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : opt.id === 'unregistered'
                              ? 'bg-slate-600 text-white border-slate-600 shadow-sm'
                              : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="relative group min-w-[280px]">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou numéro..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none ring-blue-500/10 transition-all focus:border-blue-400 focus:ring-4 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Patient list */}
            <div className="max-h-[420px] min-h-[320px] overflow-y-auto px-8 py-6 custom-scrollbar">
              {loading ? (
                <div className="flex h-[280px] flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                    <div className="absolute inset-0 blur-xl bg-blue-400/20 animate-pulse rounded-full" />
                  </div>
                  <p className="text-base font-black text-slate-400 animate-pulse">Chargement des dossiers...</p>
                </div>
              ) : filteredPatients.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPatients.map(patient => {
                    const blocked = isBlocked(patient);
                    const reason  = blockReason(patient);
                    return (
                      <div key={patient.id} className="relative group">
                        <button
                          onClick={() => !blocked && onSelectPatient(patient)}
                          disabled={blocked}
                          className={`w-full relative flex flex-col items-start rounded-3xl border-2 p-5 text-left transition-all duration-300 overflow-hidden ${
                            blocked
                              ? 'border-slate-100 bg-slate-50/80 opacity-50 cursor-not-allowed'
                              : patient.has_registration
                                ? 'border-teal-200 bg-white hover:-translate-y-1 hover:border-teal-400 hover:shadow-[0_20px_40px_-12px_rgba(20,184,166,0.15)] active:scale-95 cursor-pointer'
                                : 'border-slate-100 bg-white hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-[0_20px_40px_-12px_rgba(37,99,235,0.1)] active:scale-95 cursor-pointer'
                          }`}
                        >
                          {/* Accent bar gauche pour les patients déjà recalés */}
                          {patient.has_registration && !blocked && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400 rounded-l-3xl" />
                          )}
                          {blocked && (
                            <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                              <Lock className="h-3.5 w-3.5" />
                            </div>
                          )}

                          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-colors ${
                            blocked ? 'bg-slate-100 text-slate-300' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                          }`}>
                            <User className="h-6 w-6" />
                          </div>

                          <h3 className={`text-lg font-black tracking-tight line-clamp-1 ${blocked ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-900'}`}>
                            {patient.nom} {patient.prenom}
                          </h3>

                          <div className="mt-1 flex items-center gap-2 text-[12px] font-bold text-slate-400">
                            <span className="font-mono">{patient.num_dossier}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{patient.age ? `${patient.age} ans` : 'Âge inconnu'}</span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {patient.has_2d && (
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                                blocked && (mode === '3d' || mode === 'advanced') ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100/80 text-emerald-700'
                              }`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${blocked && (mode === '3d' || mode === 'advanced') ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                                2D
                              </span>
                            )}
                            {patient.has_nifti && (
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                                blocked && mode === '2d' ? 'bg-slate-100 text-slate-400' : 'bg-blue-100/80 text-blue-700'
                              }`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${blocked && mode === '2d' ? 'bg-slate-300' : 'bg-blue-500'}`} />
                                3D NIfTI
                              </span>
                            )}
                            {!patient.has_2d && !patient.has_nifti && (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Aucune image
                              </span>
                            )}
                          </div>

                          {/* Historique de recalage — ligne discrète */}
                          {patient.has_registration && !blocked && (
                            <div className="mt-4 pt-3 border-t border-teal-100 w-full flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-teal-600">
                                {patient.registration_count === 1 ? '1 recalage' : `${patient.registration_count} recalages`}
                              </span>
                              {patient.last_registration_date && (
                                <span className="text-[10px] text-slate-400">
                                  Dernier : {formatShortDate(patient.last_registration_date)}
                                </span>
                              )}
                            </div>
                          )}

                          {!blocked && (
                            <div className="absolute top-4 right-4 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                              <ChevronRight className="h-5 w-5 text-blue-600" />
                            </div>
                          )}
                        </button>

                        {blocked && (
                          <div className="absolute inset-x-0 -bottom-1 flex items-center justify-center gap-1.5 rounded-b-3xl bg-red-50 border border-red-100 px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            <Lock className="h-3 w-3 text-red-400 shrink-0" />
                            <span className="text-[10px] font-black text-red-500 truncate">{reason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-3xl bg-slate-100 p-6 text-slate-300">
                    <Search className="h-12 w-12" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900">Aucun patient trouvé</h4>
                  <p className="mt-2 text-sm font-semibold text-slate-500 max-w-xs">
                    Essayez d'ajuster vos filtres ou effectuez une nouvelle recherche.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200/60 bg-slate-50/50 px-8 py-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span className="uppercase tracking-[0.2em]">{filteredPatients.length} Patients synchronisés</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"/> Prêts pour recalage
                  </span>
                  <span
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600"
                    onClick={fetchPatients}
                  >
                    Actualiser
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Tab: Import local ───────────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'local' && (
          <div className="px-8 py-8">
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptForMode(mode)}
              className="hidden"
              onChange={onFileChange}
            />

            {!localFile ? (
              /* ── Drop zone ── */
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed transition-all duration-300 ${
                  dragOver
                    ? 'border-purple-500 bg-purple-50/80 scale-[1.01]'
                    : 'border-slate-300 bg-slate-50/60 hover:border-purple-400 hover:bg-purple-50/40'
                }`}
              >
                {/* Glow on drag */}
                {dragOver && (
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-purple-400/10 blur-xl" />
                )}

                <div className={`flex h-20 w-20 items-center justify-center rounded-3xl border-2 transition-all duration-300 ${
                  dragOver
                    ? 'border-purple-300 bg-purple-100 text-purple-600 shadow-lg shadow-purple-200'
                    : 'border-slate-200 bg-white text-slate-400 group-hover:border-purple-200 group-hover:text-purple-500'
                }`}>
                  {dragOver
                    ? <FolderOpen className="h-10 w-10" />
                    : <Upload className="h-10 w-10" />
                  }
                </div>

                <div className="text-center">
                  <p className={`text-lg font-black transition-colors ${
                    dragOver ? 'text-purple-700' : 'text-slate-700 group-hover:text-purple-700'
                  }`}>
                    {dragOver ? 'Relâchez pour importer' : 'Glissez votre fichier ici'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    ou{' '}
                    <span className="font-black text-purple-600 underline underline-offset-2 group-hover:text-purple-700">
                      cliquez pour parcourir
                    </span>
                  </p>
                  <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 shadow-sm">
                    Format accepté · {hintForMode(mode)}
                  </p>
                </div>

                {fileError && (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600">
                    {fileError}
                  </p>
                )}
              </div>
            ) : (
              /* ── File selected ── */
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-6">
                {/* File card */}
                <div className="w-full max-w-md rounded-3xl border-2 border-purple-200 bg-purple-50/60 p-6 shadow-lg shadow-purple-100/50">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-purple-200 bg-white text-purple-600 shadow-sm">
                      <File className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-slate-900">{localFile.name}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{formatBytes(localFile.size)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-600">
                          Fichier valide · {hintForMode(mode)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setLocalFile(null); setFileError(''); }}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                  >
                    Changer de fichier
                  </button>
                  <button
                    onClick={confirmLocalImport}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-200 transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-95"
                  >
                    Lancer le recalage →
                  </button>
                </div>

                <p className="text-center text-[11px] font-semibold text-slate-400 max-w-xs">
                  Le fichier sera uploadé temporairement pour cette session. Aucune donnée n'est conservée en base.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSelectionModal;
