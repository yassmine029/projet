import React from 'react';
import { 
  House,
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
        className="flex items-center gap-3 px-4 py-2.5 text-accent hover:bg-accent-light w-full text-left text-sm transition-colors"
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
        `flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors ${
          isActive
            ? 'bg-primary-light text-primary font-medium border-l-2 border-primary rounded-r-none'
            : 'text-gray-600 hover:bg-[#f5f7ff] hover:text-primary border-l-2 border-transparent'
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
    <h3 className="px-4 mb-1 text-[10px] uppercase tracking-widest text-gray-400 font-medium">
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
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-surface-border flex flex-col z-10">
      {/* Header / Logo */}
      <div className="h-24 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg shadow-sm">
            V
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">VisionMed</span>
        </div>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto py-2">
        <NavSection title="Clinique">
          <NavItem to="/" icon={House} label="Accueil" />
          <NavItem to="/dashboard" exact icon={LayoutDashboard} label="Tableau de bord" />
          <NavItem to="/dashboard/patients" icon={Users} label="Mes Patients" />
        </NavSection>

        <NavSection title="Documents">
          <NavItem to="/dashboard/analysesMRI" icon={FileImage} label="Analyses MRI" />
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
