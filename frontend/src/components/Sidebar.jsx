import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileImage, 
  FileText, 
  HelpCircle, 
  User, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../api';

const NavItem = ({ to, icon: Icon, label, exact = false, isLogout = false, onClick }) => {
  if (isLogout) {
    return (
      <button 
        onClick={onClick}
        className="flex items-center gap-3 px-6 py-3 text-red-500 hover:bg-red-50 w-full text-left font-medium transition-colors border-l-[3px] border-transparent"
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-6 py-3 font-medium transition-colors ${
          isActive
            ? 'bg-[#eef2ff] text-[#4f6ef7] border-l-[3px] border-[#4f6ef7]'
            : 'text-[#6b7280] hover:bg-slate-50 border-l-[3px] border-transparent'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      {label}
    </NavLink>
  );
};

const NavSection = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="px-6 mb-2 text-[11px] font-bold tracking-wider text-[#9ca3af] uppercase">
      {title}
    </h3>
    <nav className="space-y-0.5">
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
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-slate-100 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Header / Logo */}
      <div className="h-24 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4f6ef7] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            V
          </div>
          <span className="text-xl font-extrabold text-[#1a1f3c] tracking-tight">VisionMed</span>
        </div>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto py-2">
        <NavSection title="Clinique">
          <NavItem to="/dashboard" exact icon={LayoutDashboard} label="Tableau de bord" />
          <NavItem to="/dashboard/patients" icon={Users} label="Mes Patients" />
        </NavSection>

        <NavSection title="Documents">
          <NavItem to="/dashboard/mri" icon={FileImage} label="Analyses MRI" />
          <NavItem to="/dashboard/reports" icon={FileText} label="Rapports" />
          <NavItem to="/dashboard/reclamations" icon={HelpCircle} label="Mes Réclamations" />
        </NavSection>

        <NavSection title="Compte">
          <NavItem to="/dashboard/profile" icon={User} label="Mon Profil" />
          <NavItem to="/dashboard/settings" icon={Settings} label="Paramètres" />
        </NavSection>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 mb-4">
        <NavItem isLogout icon={LogOut} label="Déconnexion" onClick={handleLogout} />
      </div>
    </aside>
  );
}
