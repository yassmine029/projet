import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  Stethoscope,
  Hash,
  Phone,
  Mail,
  FolderOpen,
  FileText,
  Clock3,
  Download,
  HardDrive,
  AlertCircle,
  RotateCcw,
  FolderTree,
} from 'lucide-react';
import api from '../../api';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);
  const [zipNotice, setZipNotice] = useState(null);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await api.get(`/patients/${id}/`);
        if (res.data && res.data.ok) {
          setPatient(res.data.patient);
        } else {
          setError(res.data.error || "Patient introuvable.");
        }
      } catch (err) {
        setError("Erreur de connexion au serveur.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  useEffect(() => {
    if (!zipNotice) return undefined;
    const timer = window.setTimeout(() => setZipNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [zipNotice]);

  // Calculate age roughly
  const calcAge = (dobString) => {
    if (!dobString) return '?';
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('fr-FR');
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '-';
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let size = value;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const files = (Array.isArray(patient?.mri_files) ? patient.mri_files : []).filter(Boolean);
  const fileTypes = useMemo(() => {
    const types = new Set();
    files.forEach((file) => {
      const name = String(file.original_filename || file.relative_path || '').toLowerCase();
      const dotIdx = name.lastIndexOf('.');
      if (dotIdx > -1 && dotIdx < name.length - 1) {
        types.add(name.slice(dotIdx + 1));
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [files]);

  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = files.filter((file) => {
      const originalName = String(file.original_filename || '').toLowerCase();
      const relativePath = String(file.relative_path || '').toLowerCase();
      const nameForType = originalName || relativePath;
      const dotIdx = nameForType.lastIndexOf('.');
      const ext = dotIdx > -1 && dotIdx < nameForType.length - 1 ? nameForType.slice(dotIdx + 1) : '';
      const matchesType = typeFilter === 'all' || ext === typeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        originalName.includes(normalizedSearch) ||
        relativePath.includes(normalizedSearch);
      return matchesType && matchesSearch;
    });

    next.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.original_filename || a.relative_path || '').localeCompare(
          String(b.original_filename || b.relative_path || ''),
          'fr',
          { sensitivity: 'base' }
        );
      }
      if (sortBy === 'size') {
        return Number(b.file_size || 0) - Number(a.file_size || 0);
      }
      const aDate = new Date(a.uploaded_at || 0).getTime();
      const bDate = new Date(b.uploaded_at || 0).getTime();
      return bDate - aDate;
    });

    return next;
  }, [files, search, typeFilter, sortBy]);

  const totalBytes = files.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
  const folderCount = new Set(
    files.map((file) => {
      const rel = (file.relative_path || file.original_filename || '').replace(/\\/g, '/');
      const idx = rel.lastIndexOf('/');
      return idx > 0 ? rel.slice(0, idx) : 'Racine';
    })
  ).size;

  const resolveFileUrl = (rawUrl) => {
    if (!rawUrl) return null;
    try {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
      const apiBase = api?.defaults?.baseURL || '';
      const apiOrigin = apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
      if (rawUrl.startsWith('/')) return `${apiOrigin}${rawUrl}`;
      return `${apiOrigin}/${rawUrl}`;
    } catch (e) {
      return rawUrl;
    }
  };

  const isPreviewable = (file) => {
    const lower = String(file.original_filename || file.relative_path || '').toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.gif', '.webp'].some((ext) => lower.endsWith(ext));
  };

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setSortBy('recent');
  };

  const downloadPatientZip = async () => {
    if (zipDownloading || !patient?.id) return;
    setZipDownloading(true);
    setZipProgress(0);
    setZipNotice(null);
    try {
      const response = await api.get(`/patients/${patient.id}/download-zip/`, {
        responseType: 'blob',
        onDownloadProgress: (evt) => {
          if (evt?.total) {
            const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
            setZipProgress(pct);
          } else {
            setZipProgress((prev) => (prev == null || prev >= 90 ? 10 : prev + 10));
          }
        },
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${patient.num_dossier || 'patient'}_dossier.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setZipProgress(100);
      setZipNotice({
        type: 'success',
        message: 'Le dossier ZIP a ete telecharge avec succes.',
      });
    } catch (err) {
      console.error('Erreur lors du telechargement ZIP du dossier patient:', err);
      setZipNotice({
        type: 'error',
        message: "Echec du telechargement ZIP. Veuillez reessayer.",
      });
    } finally {
      setZipDownloading(false);
      setTimeout(() => setZipProgress(null), 800);
    }
  };

  const folderTree = useMemo(() => {
    const root = {};

    filteredFiles.forEach((file) => {
      const rel = String(file.relative_path || file.original_filename || `fichier-${file.id}`)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');
      const parts = rel.split('/').filter(Boolean);
      const fileName = parts.length > 0 ? parts[parts.length - 1] : String(file.original_filename || `fichier-${file.id}`);
      const folders = parts.length > 1 ? parts.slice(0, -1) : [];

      let node = root;
      folders.forEach((segment) => {
        if (!node[segment]) {
          node[segment] = { __folders: {}, __files: [] };
        }
        node = node[segment].__folders;
      });

      if (!node.__root) {
        node.__root = { __folders: {}, __files: [] };
      }
      node.__root.__files.push({ ...file, treeLabel: fileName });
    });

    const normalize = (inputNode) => {
      const folders = [];
      const ownFiles = [];

      Object.entries(inputNode).forEach(([name, value]) => {
        if (name === '__root') {
          ownFiles.push(...value.__files);
          return;
        }
        folders.push({
          name,
          folders: normalize(value.__folders).folders,
          files: value.__files,
        });
      });

      folders.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      ownFiles.sort((a, b) => String(a.treeLabel).localeCompare(String(b.treeLabel), 'fr', { sensitivity: 'base' }));
      return { folders, files: ownFiles };
    };

    return normalize(root);
  }, [filteredFiles]);

  const renderTreeNode = (node, depth = 0, parentKey = 'root') => (
    <div className="space-y-2">
      {(node?.folders || []).map((folder) => (
        <div key={`${parentKey}/${folder.name}`} className="rounded-lg border border-slate-200 bg-white/70">
          <div className="px-3 py-2 text-sm font-semibold text-slate-900 flex items-center gap-2" style={{ paddingLeft: `${12 + depth * 12}px` }}>
            <FolderOpen className="w-4 h-4 text-blue-600" />
            {folder.name}
          </div>
          <div className="px-2 pb-2">
            {folder.files.map((file) => {
              const fileUrl = resolveFileUrl(file.file_url || file.file);
              return (
                <div
                  key={`file-${file.id}`}
                  className="mx-2 mb-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3"
                  style={{ marginLeft: `${depth * 12}px` }}
                >
                  <span className="truncate">{file.treeLabel}</span>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline shrink-0">
                      Ouvrir
                    </a>
                  )}
                </div>
              );
            })}
            {renderTreeNode({ folders: folder.folders, files: [] }, depth + 1, `${parentKey}/${folder.name}`)}
          </div>
        </div>
      ))}

      {(node?.files || []).map((file) => {
        const fileUrl = resolveFileUrl(file.file_url || file.file);
        return (
          <div
            key={`root-file-${file.id}`}
            className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3"
            style={{ marginLeft: `${depth * 12}px` }}
          >
            <span className="truncate">{file.treeLabel}</span>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline shrink-0">
                Ouvrir
              </a>
            )}
          </div>
        );
      })}
    </div>
  );

  const detailRows = [
    { icon: Phone, label: 'Téléphone', value: patient?.telephone || '-' },
    { icon: Mail, label: 'Email', value: patient?.email || '-' },
    { icon: Stethoscope, label: 'Pathologie', value: patient?.pathologie || '-' },
    { icon: FileText, label: 'Stade', value: patient?.stade || '-' },
  ];

  return (
    <div className="max-w-[1200px] space-y-6 pb-8 animate-fade-in">
      {loading ? (
        <div className="p-10 text-center text-slate-500">Chargement du profil patient...</div>
      ) : (error || !patient) ? (
        <div className="p-10">
          <button
            onClick={() => navigate('/dashboard/patients')}
            className="flex items-center gap-2 text-blue-600 font-bold mb-6 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux patients
          </button>
          <div className="p-6 bg-red-50 text-red-600 rounded-xl max-w-2xl border border-red-100">
            {error || 'Patient introuvable.'}
          </div>
        </div>
      ) : (
        <>
      <button 
        onClick={() => navigate('/dashboard/patients')}
        className="flex items-center gap-2 text-slate-500 font-bold mb-2 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </button>

      <div className="rounded-2xl bg-white border border-slate-200/60 p-8 shadow-card">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
          <User className="w-9 h-9" />
        </div>
        
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{patient.nom} {patient.prenom}</h1>
              <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm font-medium">
                <Hash className="w-4 h-4" />
                Dossier {patient.num_dossier}
                <span className="mx-2 text-slate-300">•</span>
                Patient enregistré le {formatDate(patient.created_at)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg text-blue-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Identité</p>
                <p className="text-sm font-semibold text-slate-900">
                  {patient.sexe === 'M' ? 'Homme' : 'Femme'}, {calcAge(patient.date_naissance)} ans
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg text-blue-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date de naissance</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDate(patient.date_naissance)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg text-blue-600">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Diagnostics associés</p>
                <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                  {patient.pathologie || patient.autres_maladies || 'Aucun diagnostic renseigné'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {detailRows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.label}</p>
              </div>
              <p className="text-sm text-slate-900 font-semibold break-words">{row.value}</p>
            </div>
          );
        })}
      </div>

      {(patient.antecedents || patient.notes) && (
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Contexte clinique</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">Antécédents</p>
              <p className="text-sm text-slate-900 font-medium">{patient.antecedents || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">Notes cliniques</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{patient.notes || '-'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-[#f8faff] to-[#f5f9ff]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Contenu du dossier uploadé</h2>
              <p className="text-sm text-slate-500 mt-1">Fichiers enregistrés lors de la création du patient</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPatientZip}
                disabled={zipDownloading || files.length === 0}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {zipDownloading ? 'Preparation ZIP...' : 'Telecharger le dossier'}
              </button>
              <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                {folderCount} dossier{folderCount > 1 ? 's' : ''}
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {files.length} fichier{files.length > 1 ? 's' : ''}
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600" />
                {formatSize(totalBytes)}
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un fichier ou un chemin..."
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              >
                <option value="all">Tous les types</option>
                {fileTypes.map((type) => (
                  <option key={type} value={type}>
                    .{type}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              >
                <option value="recent">Tri: plus récents</option>
                <option value="name">Tri: nom (A-Z)</option>
                <option value="size">Tri: taille (desc)</option>
              </select>

              <button
                type="button"
                onClick={resetFilters}
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reinitialiser les filtres
              </button>
            </div>
          )}

          {zipDownloading && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                <span>Preparation du dossier ZIP...</span>
                <span>{Number.isFinite(zipProgress) ? `${zipProgress}%` : ''}</span>
              </div>
              <div className="h-2 rounded-full bg-[#eaf0ff] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                  style={{ width: `${Math.max(8, Number(zipProgress || 0))}%` }}
                />
              </div>
            </div>
          )}

          {zipNotice && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                zipNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {zipNotice.message}
            </div>
          )}
        </div>

        {files.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
            Aucun fichier MRI trouvé pour ce patient.
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-blue-600" />
            Aucun fichier ne correspond à vos filtres.
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 grid grid-cols-1 gap-4">
              {filteredFiles.map((file) => {
                const fileUrl = resolveFileUrl(file.file_url || file.file);
                const previewUrl = resolveFileUrl(file.preview_url) || fileUrl;
                const relPath = file.relative_path || file.original_filename || 'fichier';
                return (
                  <div key={file.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-[#cdd9ff] hover:shadow-[0_6px_20px_rgba(79,110,247,0.08)] transition-all">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{file.original_filename || 'Fichier MRI'}</p>
                        <p className="text-xs text-slate-500 mt-1 break-all">{relPath}</p>
                      </div>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Ouvrir
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                        <p className="text-slate-400 uppercase font-bold">Taille</p>
                        <p className="text-slate-900 font-semibold mt-1">{formatSize(file.file_size)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                        <p className="text-slate-400 uppercase font-bold flex items-center gap-1"><Clock3 className="w-3 h-3" /> Ajoute le</p>
                        <p className="text-slate-900 font-semibold mt-1">{formatDateTime(file.uploaded_at)}</p>
                      </div>
                    </div>

                    {isPreviewable(file) && previewUrl && (
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                        <img
                          src={previewUrl}
                          alt={file.original_filename || 'apercu'}
                          className="w-full h-44 object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <aside className="rounded-xl border border-slate-200 bg-[#fbfdff] p-4 h-fit xl:sticky xl:top-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderTree className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Arborescence du dossier</h3>
              </div>
              <div className="max-h-[620px] overflow-auto pr-1 space-y-2">
                {renderTreeNode(folderTree)}
              </div>
            </aside>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-slate-900 mt-10">Analyses du patient</h2>
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 min-h-[200px] flex items-center justify-center">
        <p className="text-slate-400 italic text-sm">Les analyses seront affichées ici prochainement.</p>
      </div>
        </>
      )}
    </div>
  );
}
