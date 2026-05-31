import React, { useState } from 'react';
import {
  Brain,
  House,
  LayoutDashboard,
  Users,
  FileImage,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../api';

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { to: '/',          icon: House,          label: 'Accueil',        exact: true },
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    label: 'Clinique',
    items: [
      { to: '/dashboard/patients',    icon: Users,     label: 'Mes Patients'  },
      { to: '/dashboard/analysesMRI', icon: FileImage,  label: 'Analyses MRI'  },
    ],
  },
  {
    label: 'Aide & Support',
    items: [
      { to: '/dashboard/reclamations', icon: HelpCircle, label: 'Réclamations' },
    ],
  },
  {
    label: 'Compte',
    items: [
      { to: '/dashboard/profile',  icon: User,     label: 'Mon Profil'  },
      { to: '/dashboard/settings', icon: Settings, label: 'Paramètres'  },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('theme-dark'));

  const toggleTheme = () => {
    const nowDark = document.documentElement.classList.toggle('theme-dark');
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
    setIsDark(nowDark);
  };

  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.error(e); } finally { window.location.href = '/'; }
  };

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, zIndex: 20,
      width: 260, height: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #f1f5f9',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Noto Sans', system-ui, sans-serif",
    }}>

      {/* Logo */}
      <div
        style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: '#0f172a', lineHeight: 1, margin: 0 }}>BrainCore</p>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '3px 0 0' }}>Clinical Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 22 }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>
              {section.label}
            </p>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 9,
                    fontSize: 13, fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#2563eb' : '#475569',
                    background: isActive ? '#eff6ff' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  })}
                  onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!e.currentTarget.style.background.includes('eff6ff')) e.currentTarget.style.background = 'transparent' }}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={15} style={{ color: isActive ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={toggleTheme}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {isDark ? <Sun size={15} style={{ color: '#94a3b8' }} /> : <Moon size={15} style={{ color: '#94a3b8' }} />}
          {isDark ? 'Mode clair' : 'Mode sombre'}
        </button>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <LogOut size={15} style={{ color: '#ef4444' }} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
