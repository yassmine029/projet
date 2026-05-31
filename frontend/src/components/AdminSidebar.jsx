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
  ChevronRight,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { logout } from '../api';

const NAV_SECTIONS = [
  {
    label: 'Navigation',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
      { to: '/admin/comptes', icon: Users, label: 'Comptes' },
      { to: '/admin/temoignages', icon: Quote, label: 'Témoignages' },
      { to: '/admin/reclamations', icon: MessageSquareWarning, label: 'Réclamations' },
      { to: '/admin/historique', icon: History, label: 'Historique' },
    ],
  },
  {
    label: 'Système',
    items: [
      { to: '/admin/parametres', icon: Settings, label: 'Paramètres' },
    ],
  },
];

export default function AdminSidebar({ user, onLogout }) {
  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      try { await logout(); } catch (e) { console.error(e); } finally { window.location.href = '/'; }
    }
  };

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, zIndex: 20,
      width: 240, height: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #f1f5f9',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Noto Sans', system-ui, sans-serif",
    }} className="hidden xl:flex">

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif", fontSize: 17, fontWeight: 700, color: '#0f172a', lineHeight: 1, margin: 0 }}>BrainCore</p>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '3px 0 0' }}>Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 24 }}>
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

      {/* User */}
      <div style={{ padding: '12px 12px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, background: '#f8fafc', marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <User size={15} color="#4f46e5" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.fullName || user?.full_name || 'Administrateur'}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '1px 0 0' }}>Super Admin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
