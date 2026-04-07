import React from 'react';
import { 
  Brain,
  LayoutDashboard, 
  Users, 
  History,
  Settings, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { logout } from '../api';

const NavItem = ({ to, icon: Icon, label, exact = false, isLogout = false, onClick }) => {
  if (isLogout) {
    return (
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
      >
        <Icon className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-all ${
          isActive
            ? 'bg-gradient-to-r from-cyan-100 via-teal-50 to-emerald-50 text-teal-700 shadow-[0_10px_24px_rgba(20,184,166,0.15)]'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]'
        }`
      }
    >
      <span className="absolute left-0 top-2/4 h-7 w-1.5 -translate-y-2/4 rounded-r-full bg-teal-500 opacity-0 transition-opacity group-[.active]:opacity-100" />
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
};

export default function Sidebar() {
  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      window.location.href = '/';
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-72 flex-col border-r border-slate-200/90 bg-white/95 backdrop-blur xl:flex">
      <div className="border-b border-slate-100 px-6 py-6">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4">
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-cyan-200/35" />
          <div className="absolute -bottom-7 -left-7 h-20 w-20 rounded-full bg-emerald-200/35" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-100 bg-white text-cyan-600 shadow-[0_10px_24px_rgba(6,182,212,0.18)]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[30px] font-black tracking-tight text-slate-900 leading-none">NeuroScan</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Admin Console</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Navigation
        </div>
        <nav className="space-y-2">
          <NavItem to="/dashboard" exact icon={LayoutDashboard} label="Vue globale" />
          <NavItem to="/dashboard/comptes" icon={Users} label="Comptes" />
          <NavItem to="/dashboard/historique" icon={History} label="Historique" />
          <NavItem to="/dashboard/parametres" icon={Settings} label="Paramètres" />
        </nav>
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <Sparkles className="h-4 w-4 text-teal-500" />
          Securite et conformite activees
        </div>
        <NavItem isLogout icon={LogOut} label="Déconnexion" onClick={handleLogout} />
      </div>
    </aside>
  );
}
