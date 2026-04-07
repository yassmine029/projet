import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Eye,
  FileText,
  Globe,
  Save,
  Search,
  Shield,
  UserPlus,
  Users
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  getAdminAccounts,
  getAdminHistory,
  getAdminOverview,
  getAdminSettings,
} from '../api';

export default function Dashboard() {
  const location = useLocation();
  const isHome = location.pathname === '/dashboard' || location.pathname === '/admin';
  const isAccounts = location.pathname === '/dashboard/comptes' || location.pathname === '/admin/comptes';
  const isHistory = location.pathname === '/dashboard/historique' || location.pathname === '/admin/historique';
  const isSettings = location.pathname === '/dashboard/parametres' || location.pathname === '/admin/parametres';

  const [overviewData, setOverviewData] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);

  const iconByType = {
    segmentation: Eye,
    rapport: FileText,
    fusion: Activity,
    analyse: ArrowUpRight,
  };

  const badgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('segmentation') || s.includes('actif')) return 'bg-emerald-100 text-emerald-700';
    if (s.includes('rapport') || s.includes('attente')) return 'bg-amber-100 text-amber-700';
    if (s.includes('fusion')) return 'bg-violet-100 text-violet-700';
    if (s.includes('analyse')) return 'bg-blue-100 text-blue-700';
    if (s.includes('inactif')) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  };

  const formatDate = (iso) => {
    if (!iso) return 'Jamais';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, acc, hist, setg] = await Promise.all([
          getAdminOverview(),
          getAdminAccounts(),
          getAdminHistory(),
          getAdminSettings(),
        ]);
        setOverviewData(ov.data || null);
        setAccountsData(acc.data || null);
        setHistoryData(hist.data || null);
        setSettingsData(setg.data || null);
      } catch (e) {
        console.error('Admin dashboard load failed:', e);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const s = overviewData?.stats;
    const d = s?.deltas || {};
    return [
      { label: 'ANALYSES TOTALES', value: (s?.analyses_totales ?? 0).toLocaleString('fr-FR'), delta: `+${d.analyses_totales ?? 0}%`, icon: Activity },
      { label: 'PATIENTS ACTIFS', value: (s?.patients_actifs ?? 0).toLocaleString('fr-FR'), delta: `+${d.patients_actifs ?? 0}%`, icon: Users },
      { label: 'RAPPORTS GÉNÉRÉS', value: (s?.rapports_generes ?? 0).toLocaleString('fr-FR'), delta: `+${d.rapports_generes ?? 0}%`, icon: FileText },
      { label: 'TAUX DE PRÉCISION', value: `${s?.taux_precision ?? 99.2}%`, delta: `+${d.taux_precision ?? 0.3}%`, icon: ArrowUpRight },
    ];
  }, [overviewData]);

  const historyRows = useMemo(() => {
    const rows = overviewData?.activity || [];
    return rows.map((r) => [r.action, r.user, r.type, formatDate(r.date), badgeClass(r.status || r.type)]);
  }, [overviewData]);

  const accounts = useMemo(() => {
    const rows = accountsData?.accounts || [];
    return rows.map((a) => [a.id, a.full_name || a.username, a.email, a.role, a.status, formatDate(a.last_login), badgeClass(a.status)]);
  }, [accountsData]);

  const timeline = useMemo(() => {
    const rows = historyData?.items || [];
    return rows.map((i) => {
      const key = String(i.status || i.type || '').toLowerCase();
      return [
        i.title,
        i.subtitle,
        i.type,
        formatDate(i.date),
        badgeClass(key),
        iconByType[key] || Activity,
      ];
    });
  }, [historyData]);

  const repartition = overviewData?.repartition || [
    { label: 'Segmentation IRM', percent: 42 },
    { label: 'PET-Scan', percent: 28 },
    { label: 'SPECT', percent: 18 },
    { label: 'Rapports', percent: 12 },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="group relative overflow-hidden rounded-3xl border border-slate-100/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-0.5">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-cyan-100/50 blur-xl" />
              <div className="relative flex items-start justify-between">
                <p className="text-sm font-bold tracking-[0.13em] text-slate-500">{s.label}</p>
                <span className="rounded-xl border border-cyan-100 bg-cyan-50 p-2.5 text-cyan-600"><Icon className="h-4 w-4" /></span>
              </div>
              <p className="relative mt-3 text-4xl font-black text-slate-900">{s.value}</p>
              <p className="relative mt-3 text-sm text-slate-500"><span className="font-bold text-emerald-600">↗ {s.delta}</span> vs mois dernier</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-100/90 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h3 className="mb-5 text-2xl font-black text-slate-900">Activité récente</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  <th className="pb-3">Action</th><th className="pb-3">Utilisateur</th><th className="pb-3">Type</th><th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRows.map((r) => (
                  <tr key={r[0]}>
                    <td className="py-4 font-bold text-slate-900">{r[0]}</td>
                    <td className="py-4 text-slate-600">{r[1]}</td>
                    <td className="py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${r[4].replace('400/20','100').replace('300','700')}`}>{r[2]}</span></td>
                    <td className="py-4 text-slate-500">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100/90 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h3 className="mb-6 text-2xl font-black text-slate-900">Répartition</h3>
          {repartition.map((item, idx) => {
            const color = idx === 0 ? 'bg-[#30d7d2]' : idx === 1 ? 'bg-[#ffb547]' : idx === 2 ? 'bg-[#a661ff]' : 'bg-[#4b8fff]';
            return (
            <div key={item.label} className="mb-4">
              <div className="mb-1 flex justify-between text-sm text-slate-600"><span className="font-medium">{item.label}</span><span className="font-bold text-slate-900">{item.percent}%</span></div>
              <div className="h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${color} shadow-[0_8px_16px_rgba(59,130,246,0.22)]`} style={{ width: `${item.percent}%` }} /></div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );

  const renderAccounts = () => (
    <div className="rounded-3xl border border-slate-100/90 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-3xl font-black text-slate-900">Gestion des comptes</h3>
          <p className="text-slate-500">{accountsData?.count ?? accounts.length} utilisateurs enregistrés</p>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-base font-black text-white shadow-[0_14px_30px_rgba(6,182,212,0.28)] transition-transform hover:-translate-y-0.5"><UserPlus className="h-4 w-4" />+ Nouveau compte</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-[0.12em]">
            <tr><th className="p-3">ID</th><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th><th className="p-3">Statut</th><th className="p-3">Dernière connexion</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((a) => (
              <tr key={a[0]}>
                <td className="p-3 text-slate-500">{a[0]}</td>
                <td className="p-3 font-bold text-slate-900">{a[1]}</td>
                <td className="p-3 text-slate-600">{a[2]}</td>
                <td className="p-3 text-slate-900">{a[3]}</td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${a[6].replace('400/20','100').replace('300','700')}`}>{a[4]}</span></td>
                <td className="p-3 text-slate-500">{a[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-3xl font-black text-slate-900">Historique des activités</h3>
          <p className="text-slate-500">Suivi complet des actions sur la plateforme</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-500 flex gap-1">
          <button className="rounded-xl bg-white px-4 py-2 text-slate-900 shadow-sm">Tout</button>
          <button className="rounded-xl px-4 py-2">Analyses</button>
          <button className="rounded-xl px-4 py-2">Rapports</button>
        </div>
      </div>
      {timeline.map((t) => {
        const Icon = t[5];
        return (
          <div key={t[0]} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="rounded-xl bg-cyan-50 p-3 text-cyan-600"><Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-2xl font-black text-slate-900">{t[0]}</p>
                <p className="text-slate-500">{t[1]}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${String(t[4]).replace('400/20','100').replace('300','700')}`}>{t[2]}</span>
              <span className="text-slate-500">{t[3]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-3xl font-black text-slate-900">Paramètres</h3>
          <p className="text-slate-500">Configuration générale de la plateforme</p>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-base font-black text-white shadow-[0_14px_30px_rgba(6,182,212,0.28)] transition-transform hover:-translate-y-0.5"><Save className="h-4 w-4" />Sauvegarder</button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h4 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Users className="h-5 w-5 text-cyan-600" />Profil administrateur</h4>
          <div className="flex justify-between text-slate-600"><span>Nom complet</span><span className="font-bold text-slate-900">{settingsData?.profile?.full_name || 'Admin'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Email</span><span className="font-bold text-slate-900">{settingsData?.profile?.email || '-'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Rôle</span><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{settingsData?.profile?.role || 'Admin'}</span></div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h4 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Shield className="h-5 w-5 text-cyan-600" />Sécurité</h4>
          <div className="flex justify-between text-slate-600"><span>Authentification à deux facteurs (2FA)</span><span className="rounded-full bg-cyan-500 h-7 w-12" /></div>
          <div className="flex justify-between text-slate-600"><span>Expiration de session</span><span className="font-bold text-slate-900">{settingsData?.security?.session_expiration || '30 min'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Forcer changement mot de passe</span><span className="font-bold text-slate-900">{settingsData?.security?.password_rotation || '90 jours'}</span></div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h4 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-600" />Notifications</h4>
          <div className="flex justify-between text-slate-600"><span>Notifications par email</span><span className="rounded-full bg-cyan-500 h-7 w-12" /></div>
          <div className="flex justify-between text-slate-600"><span>Notifications push</span><span className="rounded-full bg-cyan-500 h-7 w-12" /></div>
          <div className="flex justify-between text-slate-600"><span>Rapports automatiques</span><span className="rounded-full bg-slate-200 h-7 w-12" /></div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <h4 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Globe className="h-5 w-5 text-cyan-600" />Plateforme</h4>
          <div className="flex justify-between text-slate-600"><span>Langue</span><span className="font-bold text-slate-900">{settingsData?.platform?.language || 'Français'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Fuseau horaire</span><span className="font-bold text-slate-900">{settingsData?.platform?.timezone || 'Europe/Paris (UTC+2)'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Format de date</span><span className="font-bold text-slate-900">{settingsData?.platform?.date_format || 'DD/MM/YYYY'}</span></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f7fb] font-sans text-slate-900">
      <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[300px] w-[300px] rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] right-[-120px] h-[280px] w-[280px] rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="flex">
      <Sidebar />
      <main className="relative z-10 flex-1 xl:ml-72">
        <div className="sticky top-0 z-10 border-b border-slate-100/80 bg-white/92 px-4 py-4 backdrop-blur md:px-7 md:py-4">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[34px] font-black tracking-tight text-slate-900">{isHome ? 'Vue globale' : isAccounts ? 'Comptes' : isHistory ? 'Historique' : 'Paramètres'}</h1>
              <p className="text-slate-500">Bienvenue, Administrateur</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-400 md:min-w-[320px]">
                <Search className="h-4 w-4" />
                <span>Rechercher...</span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 font-black text-white shadow-[0_10px_24px_rgba(6,182,212,0.3)]">A</div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 xl:hidden">
            <NavLink to="/dashboard" end className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Vue globale</NavLink>
            <NavLink to="/dashboard/comptes" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Comptes</NavLink>
            <NavLink to="/dashboard/historique" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Historique</NavLink>
            <NavLink to="/dashboard/parametres" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Paramètres</NavLink>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1600px] p-4 md:p-7">
          <div className="rounded-[28px] border border-white/80 bg-white/70 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
            {isHome && renderOverview()}
            {isAccounts && renderAccounts()}
            {isHistory && renderHistory()}
            {isSettings && renderSettings()}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
