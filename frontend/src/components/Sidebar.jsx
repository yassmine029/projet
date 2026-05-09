import React from 'react';
import {
  Brain,
  House,
  LayoutDashboard,
  Users,
  FileImage,
  FileText,
  HelpCircle,
  User,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../api';

const NavItem = ({ to, icon: Icon, label, exact = false, isLogout = false, onClick }) => {
  if (isLogout) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-[13px] font-medium rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
      >
        <Icon className="w-[18px] h-[18px]" />
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 relative ${
          isActive
            ? 'bg-blue-500/15 text-blue-400 shadow-inner-glow'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
          )}
          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
          <span className="flex-1">{label}</span>
          {!isActive && (
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </>
      )}
    </NavLink>
  );
};

const NavSection = ({ title, children }) => (
  <div className="mb-4">
    <h3 className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
      {title}
    </h3>
    <nav className="space-y-0.5 px-1">
      {children}
    </nav>
  </div>
);

export default function Sidebar() {
  const navigate = useNavigate();

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
    <aside className="fixed top-0 left-0 h-screen w-[260px] bg-sidebar-gradient flex flex-col z-10 border-r border-white/[0.06]">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-blue-500/[0.04] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-blue-500/[0.03] to-transparent" />

      {/* Logo */}
      <div className="h-[72px] flex items-center px-5 relative">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate('/')}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[15px] font-bold tracking-tight text-white block leading-tight">NeuroScan</span>
            <span className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-[0.15em]">Clinical Platform</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        <NavSection title="Principal">
          <NavItem to="/" icon={House} label="Accueil" />
          <NavItem to="/dashboard" exact icon={LayoutDashboard} label="Tableau de bord" />
        </NavSection>

        <NavSection title="Clinique">
          <NavItem to="/dashboard/patients" icon={Users} label="Mes Patients" />
          <NavItem to="/dashboard/analysesMRI" icon={FileImage} label="Analyses MRI" />
        </NavSection>

        <NavSection title="Documents">
          <NavItem to="/dashboard/reports" icon={FileText} label="Mes rapports" />
        </NavSection>

        <NavSection title="Aide & Support">
          <NavItem to="/dashboard/reclamations" icon={HelpCircle} label="Réclamations" />
        </NavSection>

        <NavSection title="Compte">
          <NavItem to="/dashboard/profile" icon={User} label="Mon Profil" />
          <NavItem to="/dashboard/settings" icon={Settings} label="Paramètres" />
        </NavSection>
      </div>

      {/* Bottom section */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="p-3">
        <NavItem isLogout icon={LogOut} label="Déconnexion" onClick={handleLogout} />
      </div>
    </aside>
  );
}
