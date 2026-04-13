import React, { useEffect, useState } from 'react';
import {
  Brain,
  Users,
  FileImage,
  GitMerge,
  FileText,
  ArrowRight,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Eye,
  Download,
  Cpu,
  CheckCircle2,
  BarChart3,
  Boxes,
  Plus,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/* ────────────────────── Small reusable pieces ────────────────────── */

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const palette = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100',    bar: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', bar: 'bg-emerald-500' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  bar: 'bg-violet-500' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100',   bar: 'bg-amber-500' },
  };
  const c = palette[color] || palette.blue;

  return (
    <div className={`group relative bg-white border ${c.border} rounded-2xl p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
      <div className={`absolute top-0 left-0 h-1 w-full ${c.bar} opacity-60`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      <p className="text-[26px] font-black text-slate-900 tracking-tight leading-none">{value}</p>
      <p className="text-[12px] font-semibold text-slate-500 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{sub}</p>}
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="flex gap-4 items-start group">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] || colors.blue} transition-transform group-hover:scale-110`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function RecentActivityItem({ title, subtitle, time, status, onClick }) {
  const dot = {
    done: 'bg-emerald-500',
    running: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-500',
    pending: 'bg-amber-500',
  };
  const badge = {
    done: { text: 'Terminé', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    running: { text: 'En cours', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    failed: { text: 'Échec', cls: 'bg-red-50 text-red-700 border-red-200' },
    pending: { text: 'En attente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const b = badge[status] || badge.pending;

  return (
    <div onClick={onClick} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0 hover:bg-blue-50/40 -mx-3 px-3 rounded-xl transition-colors cursor-pointer group">
      <div className={`w-2 h-2 rounded-full ${dot[status] || dot.pending} ring-4 ring-white`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{title}</p>
        <p className="text-[11px] text-slate-400 font-medium truncate">{subtitle}</p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.cls} whitespace-nowrap`}>{b.text}</span>
      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap hidden sm:block">{time}</span>
    </div>
  );
}

/* ────────────────────── Dashboard Home ────────────────────── */

function DashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ patients: 0, analyses: 0 });
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const initials = (fullName) => {
    const txt = String(fullName || '').trim();
    if (!txt) return 'NA';
    const parts = txt.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, rRes] = await Promise.allSettled([
          api.get('/patients/'),
          api.get('/segmentation-runs/', { params: { limit: 8 } }),
        ]);
        if (pRes.status === 'fulfilled' && pRes.value?.data?.ok) {
          setStats(s => ({ ...s, patients: pRes.value.data.patients?.length || 0 }));
        }
        if (rRes.status === 'fulfilled') {
          const runs = Array.isArray(rRes.value?.data?.runs) ? rRes.value.data.runs : [];
          setRecentRuns(runs.slice(0, 8));
          setStats(s => ({ ...s, analyses: runs.length }));
        }
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatTime = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return "À l'instant";
    if (diff < 60) return `${diff} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-[1160px] space-y-7 pb-12 animate-fade-in">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/4 w-32 h-32 bg-indigo-400/10 rounded-full blur-2xl" />

        <div className="relative z-10 grid lg:grid-cols-5 gap-6 p-8 md:p-10">
          <div className="lg:col-span-3 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Activity className="w-3 h-3" /> Plateforme Clinique NeuroScan
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Bienvenue sur votre<br />tableau de bord
            </h1>
            <p className="text-blue-100 text-[13px] font-medium max-w-md leading-relaxed">
              Segmentation hippocampique, recalage multimodal, gestion patients et rapports cliniques — tout depuis un espace unifié et sécurisé.
            </p>
            <p className="text-blue-200/60 text-[10px] font-bold uppercase tracking-[0.15em] pt-1">{today}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate('/segmentation/nouvelle')}
                className="px-5 py-2.5 bg-white text-blue-600 text-[12px] font-black rounded-xl hover:bg-blue-50 shadow-lg transition-all active:scale-95"
              >
                Nouvelle segmentation
              </button>
              <button
                onClick={() => navigate('/registration')}
                className="px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-[12px] font-bold rounded-xl hover:bg-white/20 transition-all active:scale-95"
              >
                Lancer un recalage
              </button>
            </div>
          </div>

          {/* Right side: mini summary cards */}
          <div className="lg:col-span-2 flex flex-col gap-3 justify-center">
            {[
              { icon: Brain, label: 'Segmentation IA', desc: 'Deep Learning hippocampique', c: 'bg-white/10' },
              { icon: GitMerge, label: 'Recalage 2D / 3D', desc: 'IRM & TEP multimodal', c: 'bg-white/10' },
              { icon: ShieldCheck, label: 'Sécurité HDS', desc: 'Chiffrement bout en bout', c: 'bg-white/10' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 ${item.c} backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3`}>
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white leading-tight">{item.label}</p>
                  <p className="text-[10px] text-blue-200 font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Patients enregistrés" value={loading ? '—' : stats.patients} sub="Base active" color="blue" />
        <StatCard icon={FileImage} label="Analyses MRI" value={loading ? '—' : stats.analyses} sub="Segmentations" color="emerald" />
        <StatCard icon={GitMerge} label="Recalages" value="2D & 3D" sub="Multimodal" color="violet" />
        <StatCard icon={Zap} label="Temps d'analyse" value="< 30s" sub="Segmentation moyenne" color="amber" />
      </div>

      {/* ── Quick Action Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Accès rapide aux modules</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Cliquez pour accéder directement</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Card 1 — Segmentation (big) */}
          <div
            onClick={() => navigate('/segmentation/nouvelle')}
            className="group relative bg-white border border-slate-100 rounded-[1.5rem] p-6 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className="pointer-events-none absolute -bottom-6 -right-6 w-32 h-32 bg-blue-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                  <Brain className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                  <Sparkles className="h-3 w-3" /> IA
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Segmentation Volumétrique</h3>
              <p className="text-[12px] text-slate-500 leading-relaxed mb-4">Segmentation automatique de l'hippocampe gauche et droit par deep learning. Calcul des volumes et index d'asymétrie.</p>
              <div className="flex items-center gap-4">
                {['Volume L/R', 'Asymétrie', 'Reconstruction 3D'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                Lancer une analyse <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Card 2 — Recalage (big) */}
          <div
            onClick={() => navigate('/registration')}
            className="group relative bg-white border border-slate-100 rounded-[1.5rem] p-6 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className="pointer-events-none absolute -bottom-6 -right-6 w-32 h-32 bg-violet-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-500">
                  <GitMerge className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600">
                  2D & 3D
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Recalage Multimodal</h3>
              <p className="text-[12px] text-slate-500 leading-relaxed mb-4">Recalage automatique et manuel IRM/IRM et TEP/IRM. Identification des zones corticales d'intérêt.</p>
              <div className="flex items-center gap-4">
                {['Manuel', 'Automatique', 'Hybride'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-violet-500" /> {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-violet-600 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                Ouvrir le recalage <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Card 3 — Patients (compact) */}
          <div
            onClick={() => navigate('/dashboard/patients')}
            className="group relative bg-white border border-slate-100 rounded-[1.5rem] p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center gap-5"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Gestion Patients</h3>
              <p className="text-[11px] text-slate-500 font-medium">Dossiers cliniques, historique et suivi longitudinal.</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[22px] font-black text-emerald-600">{loading ? '—' : stats.patients}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
            </div>
          </div>

          {/* Card 4 — Analyses MRI (compact) */}
          <div
            onClick={() => navigate('/dashboard/analysesMRI')}
            className="group relative bg-white border border-slate-100 rounded-[1.5rem] p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center gap-5"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Analyses & Rapports</h3>
              <p className="text-[11px] text-slate-500 font-medium">Résultats de segmentation, exports PDF et CSV.</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[22px] font-black text-amber-600">{loading ? '—' : stats.analyses}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Activity + Platform Capabilities ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">Activité récente</h2>
                <p className="text-[10px] text-slate-400 font-medium">Dernières analyses et segmentations</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard/analysesMRI')}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              Tout voir <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <span className="inline-block h-7 w-7 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                  <FileImage className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1">Aucune analyse récente</p>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-4">
                  Lancez votre première segmentation volumétrique pour voir apparaître vos analyses ici.
                </p>
                <button
                  onClick={() => navigate('/segmentation/nouvelle')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-[12px] font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouvelle segmentation
                </button>
              </div>
            ) : (
              <div>
                {recentRuns.map((run, i) => (
                  <RecentActivityItem
                    key={run.id || i}
                    title={run.patient_name || `Analyse #${run.id}`}
                    subtitle={`${run.model_version || run.model_key || 'U-Net++ ONNX'} · ${run.processed_count || 0}/${run.selected_count || 0} coupes`}
                    time={formatTime(run.created_at)}
                    status={run.status || 'pending'}
                    onClick={() => navigate(`/segmentation/nouvelle?run=${run.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Platform Capabilities */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Boxes className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">Capacités</h2>
              <p className="text-[10px] text-slate-400 font-medium">Modules disponibles</p>
            </div>
          </div>

          <div className="space-y-4">
            <FeatureRow icon={Brain} title="Segmentation Hippocampique" desc="Volume L/R, asymétrie, normes de référence." color="blue" />
            <FeatureRow icon={Layers} title="Reconstruction 3D" desc="Visualisation interactive de l'hippocampe." color="violet" />
            <FeatureRow icon={GitMerge} title="Recalage Multimodal" desc="IRM/IRM et TEP/IRM en 2D et 3D." color="emerald" />
            <FeatureRow icon={BarChart3} title="Rapports Cliniques" desc="PDF structuré, CSV, modèles 3D STL/OBJ." color="amber" />
            <FeatureRow icon={Eye} title="Zones Corticales" desc="Identification automatique Brodmann." color="rose" />
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Workflow + System Info ── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* Workflow / Getting started */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">Workflow clinique</h2>
              <p className="text-[10px] text-slate-400 font-medium">De l'image au diagnostic en 4 étapes</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { step: '01', icon: Download, title: 'Import', desc: 'Importez vos fichiers NIfTI depuis le PACS ou votre poste.', to: '/segmentation/nouvelle' },
              { step: '02', icon: Cpu, title: 'Traitement IA', desc: 'Segmentation et recalage lancés automatiquement.', to: '/segmentation/nouvelle' },
              { step: '03', icon: Eye, title: 'Visualisation', desc: 'Explorez la reconstruction 3D et les images recalées.', to: '/segmentation/modelisation' },
              { step: '04', icon: FileText, title: 'Rapport', desc: 'Volumes, asymétries et résultats prêts pour le dossier.', to: '/dashboard/analysesMRI' },
            ].map((item) => (
              <div
                key={item.step}
                onClick={() => navigate(item.to)}
                className="group relative rounded-xl border border-slate-100 p-4 hover:border-blue-200 hover:shadow-card-hover cursor-pointer transition-all text-center"
              >
                <div className="w-10 h-10 bg-blue-600 text-white text-[11px] font-black rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/20">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {item.step}
                </div>
                <p className="text-[12px] font-bold text-slate-900 mb-1">{item.title}</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">État du système</h2>
              <p className="text-[10px] text-slate-400 font-medium">Statut de la plateforme</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'API Backend', status: 'En ligne', ok: true },
              { label: 'Modèle Segmentation', status: 'U-Net++ ONNX', ok: true },
              { label: 'Recalage MINE', status: 'Deep Learning', ok: true },
              { label: 'Base de données', status: 'Opérationnel', ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-[12px] font-semibold text-slate-700">{item.label}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.ok ? 'text-emerald-600' : 'text-red-600'}`}>{item.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Assistance</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Besoin d'aide ? Retournez à l'accueil pour contacter notre équipe technique.
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
              >
                Page d'accueil <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ────────────────────── Dashboard (rendered inside AppLayout) ────────────────────── */

export default function Dashboard() {
  return <DashboardHome />;
}
