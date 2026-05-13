import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Calendar, FileText, Phone, Mail, Stethoscope, Clock, ShieldCheck,
  MapPin, Activity, Star, Plus, Boxes, Layers, ChevronRight, ChevronDown,
  Lock, Eye, Download, Edit3, ArrowLeftRight, Trash2, Hash, User, Search, Filter, ArrowUpDown,
  HardDrive, FolderOpen, FolderTree, Settings, CheckCircle2, LineChart, AlertCircle,
  Brain, Box
} from 'lucide-react';
import api from '../../api';
import LongitudinalDashboard from '../../components/LongitudinalDashboard';

// --- UI Sub-components ---

function Badge({ children, type = 'blue', pulse = false }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-slate-100 text-slate-600',
    darkBlue: 'bg-[#1e3a8a] text-white',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[type] || colors.blue} ${pulse ? 'pulse-green' : ''}`}>
      {children}
    </span>
  );
}

const ANALYSIS_COLORS = {
  registration: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Boxes },
  segmentation: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Layers },
  reconstruction: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: Activity },
};

function FileActionRow({ file, sessionColor, onOpen }) {
  return (
    <div className="group flex items-center justify-between p-3 mr-2 bg-white border border-slate-100/60 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${sessionColor ? `bg-${sessionColor}-50` : 'bg-slate-50'}`}>
          <FileText className={`w-4 h-4 ${sessionColor ? `text-${sessionColor}-600` : 'text-slate-400'}`} />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800 truncate max-w-[200px] md:max-w-md">{file.name || file.original_filename || 'Fichier'}</div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
            <span className="uppercase">{file.type || file.format || 'Fichier'}</span> • {file.size || 'N/A'}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onOpen} title="Voir" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
        <button title="Télécharger" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
        <button title="Annoter" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
        <button title="Comparer" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><ArrowLeftRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function ResultsSection({ sessions, analysisFiles, resolveFileUrl, formatDate, formatSize }) {
  const [filter, setFilter] = React.useState('all');

  const serieFiles = analysisFiles.filter(f =>
    /^reg_serie_/i.test(String(f.original_filename || '')) && String(f.original_filename || '').endsWith('.zip')
  );
  const otherAnalysis = analysisFiles.filter(f =>
    !(/^reg_serie_/i.test(String(f.original_filename || '')) && String(f.original_filename || '').endsWith('.zip'))
  );
  const recalageAll = [...serieFiles, ...otherAnalysis];
  const totalCount  = sessions.length + recalageAll.length;
  const showSeg = filter === 'all' || filter === 'segmentation';
  const showRec = filter === 'all' || filter === 'recalage';

  return (
    <div id="analyses-start" className="relative pl-12 pb-4">
      {/* Timeline dot */}
      <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
        <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-lg border-4 border-white">
          <Activity className="w-4 h-4" />
        </div>
      </div>

      {/* Container — même style que baseline */}
      <div className="bg-[#f0fdf4]/60 rounded-3xl border border-emerald-200/60 shadow-sm overflow-hidden">
        <div className="p-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-xl shrink-0">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-black text-emerald-900">Résultats cliniques</h3>
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                    {totalCount} résultat{totalCount > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-emerald-700/60 font-semibold uppercase tracking-wider">
                  Segmentation volumétrique · Recalage IRM
                </p>
              </div>
            </div>

            {/* Filtres */}
            {totalCount > 0 && sessions.length > 0 && recalageAll.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-white/70 rounded-2xl border border-emerald-100 shadow-sm">
                {[
                  { key: 'all',          label: 'Tous',          count: totalCount },
                  { key: 'segmentation', label: 'Segmentation',  count: sessions.length },
                  { key: 'recalage',     label: 'Recalage',      count: recalageAll.length },
                ].map(({ key, label, count }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      filter === key
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}>
                    {label}
                    <span className={`rounded-full px-1.5 text-[9px] font-black ${filter === key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Résumé segmentations ── */}
          {sessions.length > 0 && (filter === 'all' || filter === 'segmentation') && (() => {
            const sorted = [...sessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const lastDate = sorted[0]?.created_at ? formatDate(sorted[0].created_at) : null;
            const models = [...new Set(sorted.map(s => s.model_version).filter(Boolean))];
            return (
              <div className="mb-5 flex items-stretch gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white overflow-hidden">
                <div className="w-1 bg-violet-400 shrink-0" />
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-3 pr-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Segmentations effectuées</p>
                    <p className="text-xl font-black text-violet-800 leading-none">{sessions.length}</p>
                  </div>
                  {lastDate && (
                    <div className="border-l border-violet-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Dernière analyse</p>
                      <p className="text-sm font-bold text-slate-700">{lastDate}</p>
                    </div>
                  )}
                  {models.length > 0 && (
                    <div className="border-l border-violet-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 mb-0.5">Modèles utilisés</p>
                      <p className="text-sm font-bold text-slate-700">{models.join(' · ')}</p>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 self-center">
                    {sorted.slice(0, 5).map((s, i) => (
                      <div key={s.id} title={s.created_at ? formatDate(s.created_at) : ''}
                        className={`rounded-full border-2 border-white shadow-sm ${i === 0 ? 'w-3 h-3 bg-violet-500' : 'w-2.5 h-2.5 bg-violet-200'}`} />
                    ))}
                    {sessions.length > 5 && <span className="text-[9px] font-bold text-violet-400">+{sessions.length - 5}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Résumé recalages ── */}
          {recalageAll.length > 0 && (filter === 'all' || filter === 'recalage') && (() => {
            const dated = recalageAll.filter(f => f.uploaded_at).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
            const lastDate = dated[0] ? formatDate(dated[0].uploaded_at) : null;
            const miValues = recalageAll.map(f => {
              const m = (f.original_filename || '').match(/MI([\d.]+)/);
              return m ? parseFloat(m[1]) : null;
            }).filter(v => v !== null);
            const bestMI = miValues.length ? Math.max(...miValues) : null;
            return (
              <div className="mb-5 flex items-stretch gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white overflow-hidden">
                <div className="w-1 bg-teal-400 shrink-0" />
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-3 pr-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Recalages effectués</p>
                    <p className="text-xl font-black text-teal-800 leading-none">{recalageAll.length}</p>
                  </div>
                  {lastDate && (
                    <div className="border-l border-teal-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Dernier recalage</p>
                      <p className="text-sm font-bold text-slate-700">{lastDate}</p>
                    </div>
                  )}
                  {bestMI !== null && (
                    <div className="border-l border-teal-200 pl-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-teal-500 mb-0.5">Meilleure qualité (MI)</p>
                      <p className={`text-sm font-black ${bestMI >= 0.5 ? 'text-emerald-600' : bestMI >= 0.3 ? 'text-amber-600' : 'text-red-500'}`}>
                        {bestMI.toFixed(3)}
                      </p>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 self-center">
                    {dated.slice(0, 5).map((f, i) => (
                      <div key={f.id} title={formatDate(f.uploaded_at)}
                        className={`rounded-full border-2 border-white shadow-sm ${i === 0 ? 'w-3 h-3 bg-teal-500' : 'w-2.5 h-2.5 bg-teal-200'}`} />
                    ))}
                    {recalageAll.length > 5 && <span className="text-[9px] font-bold text-teal-400">+{recalageAll.length - 5}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {totalCount === 0 ? (
            <div className="py-10 text-center bg-white/50 rounded-2xl border border-dashed border-emerald-200">
              <Activity className="w-8 h-8 text-emerald-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-emerald-800/50">Aucune analyse disponible.</p>
              <p className="text-xs text-emerald-700/40 mt-1">Lancez une segmentation ou un recalage pour commencer.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">

              {/* Segmentation */}
              {showSeg && sessions.map((session, idx) => (
                <SessionCard key={`seg-${idx}`} session={session} />
              ))}

              {/* Recalage : séries ZIP */}
              {showRec && serieFiles.map(file => {
                const fileUrl = resolveFileUrl(file.file_url || file.file);
                return (
                  <div key={file.id} className="group flex items-center gap-4 bg-white/80 px-5 py-4 rounded-2xl border border-white hover:border-violet-300 hover:shadow-sm transition-all">
                    <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                      <ArrowLeftRight className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-100 text-violet-700">Recalage</span>
                        <span className="text-sm font-bold text-slate-800">Série IRM recalée</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(file.uploaded_at)}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span className="font-mono font-semibold">{formatSize(file.file_size)} · ZIP</span>
                      </div>
                    </div>
                    <a href={fileUrl} download
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-all shadow-sm shrink-0">
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </a>
                  </div>
                );
              })}

              {/* Recalage : fichiers individuels */}
              {showRec && otherAnalysis.map(file => {
                const fname   = file.original_filename || '';
                const miMatch = fname.match(/MI([\d.]+)/);
                const miVal   = miMatch ? parseFloat(miMatch[1]) : null;
                const modeM   = fname.match(/_(2d|3d|advanced)_/i);
                const mode    = modeM ? ({ '2d':'2D','3d':'3D','advanced':'3D avec identification des zones' }[modeM[1].toLowerCase()] || '2D') : '2D';
                const fileUrl = resolveFileUrl(file.file_url || file.file);
                return (
                  <div key={file.id} className="group flex items-center gap-4 bg-white/80 px-5 py-4 rounded-2xl border border-white hover:border-violet-300 hover:shadow-sm transition-all">
                    <div className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
                      <Boxes className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-100 text-violet-700">Recalage {mode}</span>
                        {miVal !== null && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${miVal>=0.5?'bg-emerald-100 text-emerald-700':miVal>=0.3?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>
                            MI {miVal.toFixed(3)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(file.uploaded_at)}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span>{formatSize(file.file_size)}</span>
                      </div>
                    </div>
                    <a href={fileUrl} download className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-bold hover:bg-violet-600 hover:text-white transition-all shrink-0">
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </a>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const totalFiles = (session.groups || []).reduce((acc, g) => acc + (g.files?.length || 0), 0);
  const groupCount = (session.groups || []).length;
  const has3D = Boolean(session.has_3d_reconstruction);

  return (
    <div className={`bg-white/80 rounded-2xl border hover:shadow-sm transition-all overflow-hidden ${has3D ? 'border-white hover:border-emerald-200' : 'border-amber-100 hover:border-amber-300'}`}>
      {/* Collapsed header — toujours visible */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Segmentation</span>
            <span className="text-sm font-bold text-slate-800">{session.session_num}</span>
            {/* Badge modèle IA */}
            {session.model_key && (() => {
              const cfg = { unetpp: { cls: 'bg-blue-100 text-blue-700', label: 'Modèle 1' }, nnunet: { cls: 'bg-violet-100 text-violet-700', label: 'Modèle 2' }, swinunetr: { cls: 'bg-emerald-100 text-emerald-700', label: 'Modèle 3' } }[session.model_key] || { cls: 'bg-slate-100 text-slate-600', label: session.model_label || session.model_key };
              return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${cfg.cls}`}>{cfg.label}</span>;
            })()}
            {session.is_new && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500 text-white animate-pulse">Nouveau</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.date}{session.time && ` · ${session.time}`}</span>
            <span className="w-px h-3 bg-slate-200" />
            <span>{groupCount} groupe{groupCount > 1 ? 's' : ''} · {totalFiles} fichier{totalFiles > 1 ? 's' : ''}</span>
          </div>
        </div>
        <button className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all shrink-0
          ${isOpen ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-100'}`}>
          {isOpen ? <><ChevronDown className="w-3.5 h-3.5" /> Masquer</> : <><ChevronRight className="w-3.5 h-3.5" /> Voir les fichiers</>}
        </button>
      </div>

      {/* Indicateur reconstruction 3D */}
      <div className={`mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 ${
        has3D
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-amber-50 border border-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {has3D
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            : <Box className="w-4 h-4 text-amber-500 shrink-0" />
          }
          <div>
            <p className={`text-[11px] font-black ${has3D ? 'text-emerald-700' : 'text-amber-700'}`}>
              {has3D ? 'Reconstruction 3D effectuée' : 'Reconstruction 3D non effectuée'}
            </p>
            {has3D && session.total_volume_mm3 && (
              <p className="text-[10px] text-emerald-600">Volume total : {Math.round(session.total_volume_mm3)} mm³</p>
            )}
            {!has3D && (
              <p className="text-[10px] text-amber-600">Seuls les masques de segmentation sont disponibles</p>
            )}
          </div>
        </div>
        {!has3D && session.run_id && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/segmentation/modelisation?run=${session.run_id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-black hover:bg-amber-600 transition-all shadow-sm shrink-0"
          >
            <Brain className="w-3.5 h-3.5" /> Lancer la reconstruction 3D
          </button>
        )}
        {has3D && session.run_id && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/segmentation/modelisation?run=${session.run_id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition-all shrink-0"
          >
            <Brain className="w-3.5 h-3.5" /> Voir les résultats 3D
          </button>
        )}
      </div>

      {/* Détails dépliés */}
      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">
          {(session.groups || []).map((group, gIdx) => (
            <div key={gIdx}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center">
                  {ANALYSIS_COLORS[group.type]
                    ? React.createElement(ANALYSIS_COLORS[group.type].icon, { className: 'w-3.5 h-3.5 text-white' })
                    : <Layers className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-xs font-black text-emerald-700">{group.label}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{group.count}</span>
              </div>
              <div className="space-y-1.5">
                {(group.files || []).map((file, fIdx) => (
                  <div key={fIdx} className="group flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-700 truncate">{file.name || 'Fichier segmentation'}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-emerald-500 uppercase">{file.type || 'Mask'}</span>
                        {file.size && file.size !== 'N/A' && <span className="text-[10px] text-slate-400">{file.size}</span>}
                      </div>
                    </div>
                    {file.url && (
                      <a href={file.url} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200">
                        <Eye className="w-3 h-3" /> Voir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChronologyNav({ patient, totalBytes, fileCount, onJump, onDelete }) {
  return (
    <div className="sticky top-[68px] z-30 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-3xl p-3 px-5 mb-8 shadow-2xl shadow-blue-900/5 flex items-center justify-between animate-slide-down">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
           <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center text-white text-xs font-black shadow-lg">
              {patient.nom?.[0]}{patient.prenom?.[0]}
           </div>
           <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter leading-none mb-1">Dossier Clinique</p>
              <p className="text-sm font-black text-slate-900 leading-none">{patient.nom} {patient.prenom}</p>
           </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Baseline</span>
                <span className="text-[11px] font-black text-blue-900">{fileCount} fichiers</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Taille</span>
                <span className="text-[11px] font-black text-blue-900">{formatSize(totalBytes)}</span>
            </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button onClick={() => onJump('baseline-start')} className="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 group">
           <Lock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Baseline
        </button>
        <button onClick={() => onJump('analyses-start')} className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center gap-2 active:scale-95">
           <Activity className="w-3.5 h-3.5 animate-pulse" /> Voir les analyses du patient
        </button>
        <button 
          onClick={onDelete} 
          title="Supprimer ce dossier"
          className="p-3 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center active:scale-95 border border-red-100"
        >
           <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- Helpers ---

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

// --- Main Component ---

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipNotice, setZipNotice] = useState(null);
  const [zipProgress, setZipProgress] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [isBaselineExpanded, setIsBaselineExpanded] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      if (!id) return;
      setReportsLoading(true);
      try {
        const token = localStorage.getItem('access');
        const res = await api.get(`/patients/${id}/reports/list/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data?.ok) setReports(res.data.reports || []);
      } catch { /* silencieux */ }
      finally { setReportsLoading(false); }
    };
    fetchReports();
  }, [id]);

  const fetchPatient = useCallback(async () => {
    try {
      const res = await api.get(`/patients/${id}/`);
      if (res.data && res.data.ok) {
        setPatient(res.data.patient);
      } else {
        setError(res.data.error || "Patient introuvable.");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Chargement initial
  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  // Rafraîchissement au retour sur la page (ex. après reconstruction 3D)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPatient(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchPatient]);

  // Rafraîchissement à chaque navigation vers cette page
  useEffect(() => { fetchPatient(); }, [location.key, fetchPatient]);

  useEffect(() => {
    if (!zipNotice) return undefined;
    const timer = window.setTimeout(() => setZipNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [zipNotice]);

  // Rough age calculation
  const calcAge = (dobString) => {
    if (!dobString) return '?';
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const allFiles = useMemo(() => (Array.isArray(patient?.mri_files) ? patient.mri_files : []).filter(Boolean), [patient]);
  const isAnalysisFile = (f) => f.file_type === 'analysis' || /^reg_/i.test(String(f.original_filename || ''));
  const files = useMemo(() => allFiles.filter(f => !isAnalysisFile(f)), [allFiles]);
  const analysisFiles = useMemo(() => allFiles.filter(f => isAnalysisFile(f)), [allFiles]);

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

  const totalBytes = allFiles.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
  const folderCount = new Set(
    files.map((file) => {
      const rel = (file.relative_path || file.original_filename || '').replace(/\\/g, '/');
      const idx = rel.lastIndexOf('/');
      return idx > 0 ? rel.slice(0, idx) : 'Racine';
    })
  ).size;

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
        message: 'Le dossier ZIP a éte téléchargé avec succès.',
      });
    } catch (err) {
      console.error('Erreur lors du téléchargement ZIP du dossier patient:', err);
      setZipNotice({
        type: 'error',
        message: "Échec du téléchargement ZIP.",
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
        if (!node[segment]) node[segment] = { __folders: {}, __files: [] };
        node = node[segment].__folders;
      });
      if (!node.__root) node.__root = { __folders: {}, __files: [] };
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
        folders.push({ name, folders: normalize(value.__folders).folders, files: value.__files });
      });
      folders.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      ownFiles.sort((a, b) => String(a.treeLabel).localeCompare(String(b.treeLabel), 'fr', { sensitivity: 'base' }));
      return { folders, files: ownFiles };
    };
    return normalize(root);
  }, [filteredFiles]);

  const renderTreeNode = (node, depth = 0) => (
    <div className="space-y-2">
      {(node?.folders || []).map((folder) => (
        <div key={folder.name} className="rounded-lg border border-slate-200 bg-white/70">
          <div className="px-3 py-2 text-sm font-semibold text-slate-900 flex items-center gap-2" style={{ paddingLeft: `${12 + depth * 12}px` }}>
            <FolderOpen className="w-4 h-4 text-blue-600" />
            {folder.name}
          </div>
          <div className="px-2 pb-2">
            {folder.files.map((file) => {
              const fileUrl = resolveFileUrl(file.file_url || file.file);
              return (
                <div key={file.id} className="mx-2 mb-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3">
                  <span className="truncate">{file.treeLabel}</span>
                  {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline shrink-0">Ouvrir</a>}
                </div>
              );
            })}
            {renderTreeNode({ folders: folder.folders, files: [] }, depth + 1)}
          </div>
        </div>
      ))}
      {(node?.files || []).map((file) => {
        const fileUrl = resolveFileUrl(file.file_url || file.file);
        return (
          <div key={file.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-3">
            <span className="truncate">{file.treeLabel}</span>
            {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline shrink-0">Ouvrir</a>}
          </div>
        );
      })}
    </div>
  );

  // Real sessions from backend
  const sessions = useMemo(() => {
    const list = patient?.segmentation_runs?.map(run => {
      const runner = run.doctor || patient.doctor || {};
      const fullName = runner.full_name || `${runner.prenom || ''} ${runner.nom || ''}`.trim() || runner.username || 'Médecin';
      
      return {
        id: run.id,
        run_id: run.id,
        session_num: `Rapport d'Analyse #${run.id}`,
        date: formatDate(run.created_at),
        time: new Date(run.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        author: fullName,
        role: runner.specialty || (runner.is_staff ? 'Administrateur' : 'Praticien'),
        is_new: run.status === 'running' || (new Date() - new Date(run.created_at)) < 86400000,
        has_3d_reconstruction: Boolean(run.has_3d_reconstruction),
        total_volume_mm3: run.total_volume_mm3 ?? null,
        model_key: run.model_key || 'unetpp',
        model_label: run.model_version || 'Modèle 1',
        groups: [
          {
            type: 'segmentation',
            label: 'Segmentation volumétrique',
            count: run.selected_count || 1,
            color: 'emerald',
            files: (run.results || []).map(res => ({
              name: res.mask_file,
              type: 'Mask',
              size: 'N/A',
              url: resolveFileUrl(res.mask_url)
            }))
          }
        ]
      };
    }) || [];
    return list;
  }, [patient]);

  const [activeTab, setActiveTab] = useState('dossier');

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-tight">Chargement du dossier clinique...</p>
      </div>
    </div>
  );

  if (error || !patient) return (
    <div className="p-10 max-w-2xl mx-auto">
      <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-slate-500 font-bold mb-6 hover:text-blue-600"><ArrowLeft className="w-4 h-4" /> Retour aux patients</button>
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-4">
        <AlertCircle className="w-6 h-6" /> {error || 'Patient introuvable.'}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1300px] mx-auto space-y-8 pb-12 font-['Inter']">
      {/* 1. Header */}
      <div className="relative group overflow-hidden">
        <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-slate-500 font-bold mb-6 hover:text-blue-600 transition-colors z-20 relative"><ArrowLeft className="w-4 h-4" /> Retour à la liste</button>
        
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl">
          <div className="h-48 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 absolute top-0 left-0 right-0 z-0"></div>
          
          <div className="relative z-10 p-8 pt-12">
            <div className="flex flex-col md:flex-row items-end justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border-[6px] border-white/20 flex items-center justify-center text-white text-4xl font-black shadow-2xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  {(patient.nom?.[0]||'').toUpperCase()}{(patient.prenom?.[0]||'').toUpperCase()}
                </div>
                <div className="mb-2">
                  <div className="flex items-center gap-3 mb-2.5">
                    <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{patient.nom} {patient.prenom}</h1>
                    <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider leading-none">ID: {patient.num_dossier}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-blue-100/70 text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      <Calendar className="w-3.5 h-3.5" /> Né le {formatDate(patient.date_naissance)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      <User className="w-3.5 h-3.5" /> {patient.sexe === 'M' ? 'Homme' : 'Femme'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[10px] uppercase font-bold tracking-wide">
                      <ShieldCheck className="w-3.5 h-3.5" /> Données Anonymisées
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mb-2">
                <button className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all"><Settings className="w-5 h-5" /></button>
                <button onClick={downloadPatientZip} disabled={zipDownloading} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50">
                  <Download className="w-4 h-4" /> {zipDownloading ? 'Preparation...' : 'Télécharger ZIP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Phone, label: 'Téléphone', value: patient.telephone || '-' },
          { icon: Mail, label: 'Email', value: patient.email || '-' },
          { icon: Stethoscope, label: 'Pathologie', value: patient.pathologie || '-' },
          { icon: FileText, label: 'Stade', value: patient.stade || '-' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <item.icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{item.label}</p>
            </div>
            <p className="text-sm text-slate-900 font-bold leading-none truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Onglets navigation ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'dossier',      label: 'Dossier clinique',    icon: FolderTree },
          { id: 'longitudinal', label: 'Suivi longitudinal',  icon: LineChart,  badge: patient?.segmentation_runs?.length > 1 ? '✦ Nouveau' : null },
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-200 ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. Chronology & Content Section */}
      {activeTab === 'longitudinal' ? (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 xl:col-span-8">
            <LongitudinalDashboard patientId={patient.id} patient={patient} />
          </div>
          <div className="col-span-12 xl:col-span-4 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Activity className="w-5 h-5"/></div>
                <h3 className="text-base font-black text-slate-900">À propos du suivi</h3>
              </div>
              <div className="space-y-3 text-[12px] text-slate-600 leading-relaxed">
                <p>Le suivi longitudinal analyse l'évolution du volume hippocampique à travers les examens successifs.</p>
                <p>Les volumes sont enregistrés automatiquement lors de la <strong>génération d'un rapport PDF</strong> de segmentation.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { color: 'bg-emerald-400', label: 'Zone verte — volume normal' },
                    { color: 'bg-amber-400',   label: 'Zone orange — atrophie légère' },
                    { color: 'bg-rose-400',    label: 'Zone rouge — atrophie sévère' },
                  ].map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${l.color}`}/>
                      <span className="text-[11px] font-semibold text-slate-600">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-12 gap-8 relative">
        {/* Timeline Side */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
            <ChronologyNav 
                patient={patient} 
                fileCount={files.length}
                totalBytes={totalBytes}
                onJump={(id) => {
                    const target = document.getElementById(id);
                    if (target) {
                        const offset = 140; // AppLayout (68) + ChronoNav (70)
                        const elementPosition = target.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - offset;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                }} 
                onDelete={async () => {
                   if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${patient.nom} ${patient.prenom} ? Cette action est irréversible.`)) {
                     try {
                        await api.delete(`/patients/${patient.id}/`);
                        navigate('/dashboard/patients');
                     } catch (err) {
                        console.error("Erreur lors de la suppression:", err);
                        alert("Une erreur est survenue lors de la suppression du dossier.");
                     }
                   }
                }}
            />

            <div id="baseline-start" className="flex items-center justify-between mb-2 scroll-mt-40">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Chronologie du dossier</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Du plus récent au plus ancien — le dossier initial sert de référence.</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Original</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nouveau</span></div>
                </div>
            </div>

            <div className="relative">
                <div className="timeline-line"></div>

                {/* Original Folder (Baseline) */}
                <div className="relative pl-12 pb-12">
                    <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
                        <div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg border-4 border-white"><Lock className="w-4 h-4" /></div>
                    </div>

                    <div className="bg-[#e9f0ff]/50 rounded-3xl border border-blue-200/60 shadow-sm overflow-hidden">
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-900 flex items-center justify-center text-white shadow-xl flex-shrink-0"><Lock className="w-8 h-8" /></div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-black text-blue-900">Dossier initial du patient</h3>
                                            <Badge type="darkBlue">Original</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-800/60 font-bold text-xs uppercase tracking-wider">
                                            Lecture seule • <HardDrive className="w-3 h-3" /> {formatSize(totalBytes)} • {files.length} fichiers
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-blue-100 shadow-sm">
                                        <Search className="w-3.5 h-3.5 text-blue-500" />
                                        <input type="text" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Chercher dans baseline..." className="bg-transparent border-none outline-none text-xs text-blue-900 placeholder-blue-300 w-32 md:w-48" />
                                    </div>
                                    <button onClick={() => setShowTree(!showTree)} className={`p-2 rounded-xl transition-all ${showTree ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'}`} title="Arborescence">
                                        <FolderTree className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Tree View Overlay */}
                            {showTree ? (
                                <div className="bg-white/80 p-6 rounded-2xl border border-white mb-6 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4"><FolderTree className="w-4 h-4 text-blue-600" /><h4 className="text-sm font-bold text-blue-900">Arborescence baseline</h4></div>
                                    <div className="max-h-96 overflow-auto pr-2">{renderTreeNode(folderTree)}</div>
                                </div>
                            ) : null}

                            {/* File Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(isBaselineExpanded ? filteredFiles : filteredFiles.slice(0, 4)).map((file, i) => (
                                    <div key={file.id} className="group relative flex items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white hover:border-blue-300 transition-all cursor-default overflow-hidden">
                                        <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors"><FileText className="w-5 h-5 text-blue-700" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-blue-950 text-sm leading-tight truncate">{file.original_filename || 'Fichier MRI'}</div>
                                            <div className="text-[10px] text-blue-600/60 font-bold uppercase mt-1 tracking-widest">{file.relative_path?.split('.').pop() || 'File'} • {formatSize(file.file_size)}</div>
                                        </div>
                                        <div className="absolute right-4 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                            <a href={resolveFileUrl(file.file_url || file.file)} target="_blank" rel="noreferrer" title="Ouvrir" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></a>
                                            <button title="Télécharger" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Download className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                                {filteredFiles.length === 0 && <div className="col-span-2 text-center py-10 bg-white/40 rounded-2xl border border-dashed border-blue-200 text-blue-400 italic text-sm">Aucun fichier ne correspond à votre recherche.</div>}
                            </div>

                            {filteredFiles.length > 4 && (
                                <button 
                                    onClick={() => setIsBaselineExpanded(!isBaselineExpanded)}
                                    className="w-full mt-6 py-3 rounded-2xl border-2 border-dashed border-blue-200/50 text-blue-600 font-bold text-xs uppercase tracking-widest hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isBaselineExpanded ? (
                                        <><ChevronDown className="w-4 h-4 rotate-180" /> Masquer les fichiers supplémentaires</>
                                    ) : (
                                        <><Plus className="w-4 h-4" /> Afficher les {filteredFiles.length - 4} fichiers restants</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Rapports archivés ── même structure timeline que baseline ── */}
                {(reports.length > 0 || reportsLoading) && (
                  <div className="relative pl-12 pb-6">
                    {/* Timeline dot */}
                    <div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
                      <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-lg border-4 border-white">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Container — même style que baseline (teinte bleue) */}
                    <div className="bg-[#eff6ff]/60 rounded-3xl border border-blue-200/60 shadow-sm overflow-hidden">
                      <div className="p-6">

                        {/* Header */}
                        <div className="flex items-start gap-4 mb-5">
                          <div className="w-14 h-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white shadow-xl shrink-0">
                            <FileText className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-black text-blue-900">Rapports cliniques archivés</h3>
                              <span className="px-3 py-1 rounded-lg bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                                {reports.length} rapport{reports.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700/60 font-semibold uppercase tracking-wider">
                              Volumétrie · Recalage · PDF exportables
                            </p>
                          </div>
                        </div>

                        {reportsLoading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-blue-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                            Chargement des rapports…
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                            {reports.map((report) => {
                              let reportMeta = null;
                              try { reportMeta = JSON.parse(report.doctor_conclusion); } catch {}
                              const isRecalage = reportMeta?.type === 'recalage';
                              const iconBg  = isRecalage ? 'bg-emerald-600' : 'bg-blue-600';
                              const badgeCls = isRecalage
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-blue-50 border-blue-100 text-blue-600';

                              return (
                                <div key={report.id}
                                  className="group flex items-center gap-4 bg-white/80 px-5 py-4 rounded-2xl border border-white hover:border-blue-300 hover:shadow-sm transition-all">
                                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
                                    <FileText className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="text-sm font-bold text-slate-800">
                                        {isRecalage ? 'Rapport de recalage' : 'Rapport de volumétrie'}
                                      </p>
                                      {isRecalage && reportMeta?.mode && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                                          Recalage {reportMeta.mode}{reportMeta.mi_quality ? ` · ${reportMeta.mi_quality}` : ''}
                                        </span>
                                      )}
                                      {!isRecalage && report.run_id && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                                          Segmentation #{report.run_id}
                                        </span>
                                      )}
                                      {/* Badge modèle IA */}
                                      {!isRecalage && report.model_key && (() => {
                                        const mCfg = { unetpp: { cls: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Modèle 1' }, nnunet: { cls: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Modèle 2' }, swinunetr: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Modèle 3' } }[report.model_key] || { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: report.model_label || report.model_key };
                                        return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${mCfg.cls}`}>{mCfg.label}</span>;
                                      })()}
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                      <Calendar className="inline h-3 w-3 mr-1" />
                                      {report.created_at} · Dr. {report.doctor_name}
                                    </p>
                                  </div>
                                  {report.file_url && (
                                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <a href={report.file_url} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                        <Eye className="h-3.5 w-3.5" /> Voir
                                      </a>
                                      <a href={report.file_url} target="_blank" rel="noreferrer" download
                                        className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                                        <Download className="h-3.5 w-3.5" /> PDF
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ RÉSULTATS CLINIQUES — section unifiée ══ */}
                <ResultsSection
                  sessions={sessions}
                  analysisFiles={analysisFiles}
                  resolveFileUrl={resolveFileUrl}
                  formatDate={formatDate}
                  formatSize={formatSize}
                />
            </div>
        </div>

        {/* Sidebar Side */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600"><Activity className="w-5 h-5" /></div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Statistiques rapides</h3>
                </div>
                
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Volume total</p>
                        <p className="text-xl font-black text-slate-900">{formatSize(totalBytes)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Baseline</p>
                            <p className="text-xl font-black text-blue-900">{files.length}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Analyses</p>
                            <p className="text-xl font-black text-emerald-900">{sessions.length}</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Légende des couleurs</p>
                        <div className="space-y-2">
                             {[
                                { color: '#1e3a8a', label: 'Baseline / Original' },
                                { color: '#c084fc', label: 'Recalage d\'images' },
                                { color: '#34d399', label: 'Segmentation volumétrique' },
                                { color: '#fb923c', label: 'Reconstruction 3D' }
                             ].map((l, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }}></div>
                                    <span className="text-[11px] font-bold text-slate-600 tracking-tight">{l.label}</span>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>
            </div>


        </div>
      </div>
      )}
    </div>
  );
}
