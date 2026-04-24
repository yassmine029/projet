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
    <div className="max-w-[1160px] space-y-7 pb-12 animate-fade-in relative">
      <div className="absolute top-0 right-0 -z-10 w-1/2 h-[400px] bg-blue-50/50 blur-[120px] rounded-full pointer-events-none" />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/10 border border-blue-400/20">
        {/* Animated Background Gradients (Lighter) */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[140%] bg-blue-300 rotate-12 blur-[120px] opacity-20" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[120%] bg-white -rotate-12 blur-[100px] opacity-10" />

        <div className="relative z-10 grid lg:grid-cols-12 gap-8 p-10 md:p-12 items-center">
          <div className="lg:col-span-12 xl:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.1em] text-blue-100 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" /> Plateforme Médicale NeuroScan
            </div>
            
            <div className="space-y-1">
              <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
                {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-200">{doctorName}</span>.
              </h1>
              <p className="text-xl md:text-2xl font-medium text-blue-100/80 tracking-tight">
                Bienvenue dans votre espace de travail.
              </p>
            </div>

            <p className="text-white/80 text-[13px] font-medium max-w-md leading-relaxed">
              Votre tableau de bord unifié est prêt pour vos segmentations hippocampiques et analyses multimodales sécurisées.
            </p>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                onClick={() => navigate('/segmentation/nouvelle')}
                className="group relative px-6 py-3 bg-white text-blue-600 text-[12px] font-black rounded-xl hover:bg-blue-50 shadow-lg shadow-blue-900/10 transition-all active:scale-95 flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-blue-50 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10" />
                <Brain className="w-3.5 h-3.5" /> Nouvelle segmentation
              </button>
              <button
                onClick={() => navigate('/registration')}
                className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/30 text-white text-[12px] font-bold rounded-xl hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <GitMerge className="w-3.5 h-3.5" /> Lancer un recalage
              </button>
            </div>
            
            <div className="flex items-center gap-4 pt-4 border-t border-white/20">
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Système Opérationnel</span>
               </div>
               <span className="w-1 h-1 rounded-full bg-white/30" />
               <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{today}</span>
            </div>
          </div>

          <div className="lg:col-span-12 xl:col-span-5 hidden xl:flex flex-col gap-3">
            {[
              { icon: Cpu, label: 'Segmentation IA', desc: 'Précision hippocampique par Deep Learning', color: 'bg-white/20' },
              { icon: Boxes, label: 'Recalage MINE', desc: 'Algorithmes de recalage 2D & 3D multimodaux', color: 'bg-white/20' },
              { icon: ShieldCheck, label: 'Standard HDS', desc: 'Sécurité et confidentialité des données patients', color: 'bg-white/20' },
            ].map((item, i) => (
              <div key={i} className="group flex items-center gap-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl p-4 transition-all duration-300">
                <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner`}>
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-white leading-tight mb-0.5">{item.label}</p>
                  <p className="text-[10px] text-white/60 font-medium leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Users} label="Patients enregistrés" value={loading ? '—' : stats.patients} sub="Base active" color="blue" />
        <StatCard icon={FileImage} label="Analyses MRI" value={loading ? '—' : stats.analyses} sub="Segmentations" color="emerald" />
        <StatCard icon={GitMerge} label="Recalages" value="2D & 3D" sub="Multimodal" color="blue" />
        <StatCard icon={Zap} label="Performance IA" value="< 30s" sub="Temps moyen" color="amber" />
      </div>

      {/* ── Quick Access Grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-black text-slate-900 tracking-tight">Modules de diagnostic</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Accès direct aux outils d'analyse</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { id: 'seg', icon: Brain, title: 'Segmentation', desc: 'Volumétrie hippocampique IA', color: 'blue', to: '/segmentation/nouvelle' },
            { id: 'reg', icon: GitMerge, title: 'Recalage', desc: 'Multimodalité 2D / 3D', color: 'blue', to: '/registration' },
            { id: 'pat', icon: Users, title: 'Patients', desc: 'Gestion de la base clinique', color: 'emerald', to: '/dashboard/patients' },
            { id: 'rep', icon: FileText, title: 'Rapports', desc: 'Résultats et exports cliniques', color: 'amber', to: '/dashboard/analysesMRI' },
          ].map((m) => (
            <div
              key={m.id}
              onClick={() => navigate(m.to)}
              className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <m.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{m.title}</h3>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{m.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Dashboard Content ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left: Recent Activity (Spans 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black text-slate-900 tracking-tight">Activité récente</h2>
            <button onClick={() => navigate('/dashboard/analysesMRI')} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline px-2 py-1">Tout voir</button>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-3xl p-2 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 flex justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
            ) : recentRuns.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3"><Activity className="w-5 h-5 text-slate-300" /></div>
                <p className="text-xs font-bold text-slate-400">Aucune analyse récente</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
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

        {/* Right: System & Capabilities */}
        <div className="space-y-6">
          {/* System Status Section */}
          <div className="space-y-4">
             <h2 className="text-[15px] font-black text-slate-900 tracking-tight">Plateforme</h2>
             <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
               {[
                 { label: 'Calcul IA', ok: true, detail: 'U-Net++ ONNX' },
                 { label: 'Base de données', ok: true, detail: 'Disponible' },
                 { label: 'Accès Patient', ok: true, detail: 'Sécurisé' },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                     <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'}`} />
                     <span className="text-[12px] font-bold text-slate-600">{item.label}</span>
                   </div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.detail}</span>
                 </div>
               ))}
               <div className="mt-4 pt-4 border-t border-slate-50">
                  <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 group hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => navigate('/parametres')}>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shadow-sm">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-900">Préférences</p>
                      <p className="text-[9px] text-slate-500 font-medium">Configurez vos options</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                  </div>
               </div>
             </div>
          </div>

          {/* Mini Capabilities List */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/10">
             <div className="flex items-center gap-2 mb-4">
               <ShieldCheck className="w-4 h-4 text-emerald-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sécurité & Normes</span>
             </div>
             <p className="text-sm font-bold leading-snug">Données patients chiffrées de bout en bout (HDS).</p>
             <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">Conformité RGPD et ISO 27001 pour la gestion des données médicales.</p>
             <button onClick={() => navigate('/')} className="mt-4 w-full py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold hover:bg-white/10 transition-all uppercase tracking-widest">Voir les garanties</button>
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
