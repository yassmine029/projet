import React from 'react';
import {
  Brain,
  LayoutDashboard,
  Users,
  History,
  Settings,
  LogOut,
  User,
  MessageSquareWarning,
  Quote,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { logout } from '../api';

const NavItem = ({ to, icon: Icon, label, exact = false, isLogout = false, onClick }) => {
  if (isLogout) {
    return (
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-blue-100/70 transition-all hover:bg-white/10 hover:text-white"
      >
        <Icon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
          isActive
            ? 'bg-blue-500 text-white shadow-[0_8px_20px_rgba(59,130,246,0.3)]'
            : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
};

export default function AdminSidebar() {
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
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col border-r border-blue-200/20 bg-[#1e40af] xl:flex">
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-lg">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[22px] font-bold tracking-tight text-white leading-none">NeuroScan</p>
            <p className="mt-1 text-[10px] font-medium text-blue-200/80 uppercase tracking-wider">Admin Portal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200/50">
          Navigation
        </div>
        <nav className="space-y-1">
          <NavItem to="/admin" exact icon={LayoutDashboard} label="Tableau de bord" />
          <NavItem to="/admin/comptes" icon={Users} label="Comptes" />
          <NavItem to="/admin/temoignages" icon={Quote} label="Témoignages" />
          <NavItem to="/admin/reclamations" icon={MessageSquareWarning} label="Réclamations" />
          <NavItem to="/admin/historique" icon={History} label="Historique" />
        </nav>

        <div className="mb-3 mt-8 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200/50">
          Système
        </div>
        <nav className="space-y-1">
          <NavItem to="/admin/parametres" icon={Settings} label="Paramètres" />
        </nav>
      </div>

      <div className="p-4">
        <div className="mb-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-blue-400/30 ring-2 ring-white/25">
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <User size={16} />
              </div>
              <img
                src="/assets/images/admin.jpg"
                alt="Profil administrateur"
                className="relative z-10 h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-none">Administrateur</p>
              <p className="mt-1 text-[11px] font-medium text-blue-100/60 truncate max-w-[140px]">admin@neuroscan.com</p>
            </div>
          </div>
        </div>
        <NavItem isLogout icon={LogOut} label="Déconnexion" onClick={handleLogout} />
      </div>
    </aside>
  );
}
