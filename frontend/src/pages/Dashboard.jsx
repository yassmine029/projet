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
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/* ────────────────────── Small reusable pieces ────────────────────── */

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const palette = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-slate-100',    bar: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-slate-100',    bar: 'bg-emerald-500' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-slate-100',    bar: 'bg-violet-500' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-slate-100',    bar: 'bg-amber-500' },
  };
  const c = palette[color] || palette.blue;

  return (
    <div className={`group relative bg-white border ${c.border} rounded-[1.25rem] p-5 hover:shadow-md transition-all duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </p>
        <div className={`w-8 h-8 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          {sub}
        </p>
      )}
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
    <div onClick={onClick} className="flex items-center gap-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-all cursor-pointer group">
      <div className={`w-2.5 h-2.5 rounded-full ${dot[status] || dot.pending} ring-4 ring-white shadow-sm`} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</p>
        <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${b.cls} uppercase tracking-wider`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{b.text}</span>
        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap hidden sm:block">{time}</span>
      </div>
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

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/user/');
        if (res.data) setUserProfile(res.data);
      } catch (e) {
        // Fallback
      }
    };
    fetchProfile();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bonjour';
    if (hour >= 12 && hour < 18) return 'Bon après-midi';
    if (hour >= 18 && hour < 22) return 'Bonsoir';
    return 'Bonne nuit'; // Pour les courageux qui travaillent tard
  };

  const doctorName = userProfile?.full_name || userProfile?.username || 'Docteur';

  return (
    <div className="max-w-[1100px] space-y-4 pb-8 animate-fade-in">

      {/* ── Hero Banner compact ── */}
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-lg"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(29,78,216,0.92), rgba(30,58,138,0.75)), url(/images/dashbord.jpeg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 flex items-center justify-between px-8 py-6 gap-8">
          {/* Left */}
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 border border-white/20 rounded-full text-[9px] font-black uppercase tracking-[0.18em] text-blue-100">
              <Sparkles className="w-3 h-3 text-blue-300" /> Plateforme Médicale BrainCore
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-tight">
                {getGreeting()}, <span className="text-blue-100">{doctorName}</span>.
              </h1>
              <p className="text-sm text-blue-100/80 mt-0.5">Bienvenue dans votre espace de travail clinique.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => navigate('/segmentation/nouvelle')}
                className="px-5 py-2 bg-white text-blue-700 text-[12px] font-bold rounded-xl hover:bg-blue-50 shadow transition-all flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Segmentation
              </button>
              <button onClick={() => navigate('/registration')}
                className="px-5 py-2 bg-white/10 border border-white/30 text-white text-[12px] font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5" /> Recalage
              </button>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] pt-1">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Système opérationnel</span>
              <span>·</span>
              <span>{today}</span>
            </div>
          </div>

          {/* Right — mini cards */}
          <div className="hidden xl:flex flex-col gap-2 w-64 flex-shrink-0">
            {[
              { icon: Cpu,        label: 'Segmentation IA',  desc: 'Deep Learning hippocampique' },
              { icon: Boxes,      label: 'Recalage MINE',    desc: 'Multimodal 2D & 3D' },
              { icon: ShieldCheck,label: 'Données sécurisées', desc: 'Confidentialité garantie' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white leading-none">{item.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats Row compact ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users,    label: 'Patients',      value: loading ? '—' : stats.patients, sub: 'Enregistrés',    color: 'blue' },
          { icon: FileImage,label: 'Analyses MRI',  value: loading ? '—' : stats.analyses, sub: 'Segmentations',  color: 'emerald' },
          { icon: GitMerge, label: 'Recalages',     value: '2D & 3D',                       sub: 'Multimodal',    color: 'violet' },
          { icon: Zap,      label: 'Performance IA',value: '< 30s',                         sub: 'Temps moyen',   color: 'amber' },
        ].map((s, i) => (
          <div key={i} className={`bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              s.color === 'blue' ? 'bg-blue-50' : s.color === 'emerald' ? 'bg-emerald-50' : s.color === 'violet' ? 'bg-violet-50' : 'bg-amber-50'
            }`}>
              <s.icon className={`w-4 h-4 ${
                s.color === 'blue' ? 'text-blue-600' : s.color === 'emerald' ? 'text-emerald-600' : s.color === 'violet' ? 'text-violet-600' : 'text-amber-600'
              }`} />
            </div>
            <div>
              <p className="text-[18px] font-black text-slate-900 leading-none">{s.value}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modules + Activity ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Activity (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <h2 className="text-[13px] font-bold text-slate-800">Activité récente</h2>
            <button onClick={() => navigate('/dashboard/analysesMRI')}
              className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline">
              Tout voir
            </button>
          </div>
          <div className="px-2">
            {loading ? (
              <div className="py-10 flex justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
            ) : recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileImage className="w-8 h-8 text-slate-200 mb-3" />
                <p className="text-[13px] font-bold text-slate-700 mb-1">Aucune analyse récente</p>
                <p className="text-[11px] text-slate-400 mb-4">Lancez votre première segmentation.</p>
                <button onClick={() => navigate('/segmentation/nouvelle')}
                  className="px-4 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Nouvelle segmentation
                </button>
              </div>
            ) : (
              <div>
                {recentRuns.map((run, i) => (
                  <RecentActivityItem
                    key={run.id || i}
                    title={run.patient_name || `Analyse #${run.id}`}
                    subtitle={`${run.model_key || 'IA'} · ${run.processed_count || 0} coupes`}
                    time={formatTime(run.created_at)}
                    status={run.status || 'pending'}
                    onClick={() => navigate(`/segmentation/nouvelle?run=${run.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-3">
          {/* Modules */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <h2 className="text-[13px] font-bold text-slate-800">Modules</h2>
            </div>
            <div className="p-2 space-y-1">
              {[
                { icon: Brain,    title: 'Segmentation',  desc: 'Hippocampe IA',    to: '/segmentation/nouvelle' },
                { icon: GitMerge, title: 'Recalage',      desc: '2D / 3D',          to: '/registration' },
                { icon: Users,    title: 'Patients',      desc: 'Base clinique',    to: '/dashboard/patients' },
                { icon: FileText, title: 'Rapports',      desc: 'Exports cliniques',to: '/dashboard/analysesMRI' },
              ].map((m, i) => (
                <div key={i} onClick={() => navigate(m.to)}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors flex-shrink-0">
                    <m.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{m.title}</p>
                    <p className="text-[10px] text-slate-400">{m.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>

          {/* Plateforme status */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-[13px] font-bold text-slate-800">Plateforme</h2>
            {[
              { label: 'Calcul IA',       detail: 'U-Net++ ONNX', ok: true },
              { label: 'Base de données', detail: 'Disponible',   ok: true },
              { label: 'Accès Patient',   detail: 'Sécurisé',     ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[12px] font-medium text-slate-600">{item.label}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.detail}</span>
              </div>
            ))}
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
