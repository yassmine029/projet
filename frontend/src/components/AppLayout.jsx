import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ChevronRight, Bell, Search, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Sidebar from './Sidebar';

const BREADCRUMB_MAP = {
  '/dashboard': 'Tableau de bord',
  '/dashboard/patients': 'Patients',
  '/dashboard/analysesMRI': 'Analyses MRI',
  '/dashboard/reclamations': 'Réclamations',
  '/dashboard/profile': 'Profil',
  '/dashboard/settings': 'Paramètres',
  '/segmentation/nouvelle': 'Segmentation',
  '/segmentation/modelisation': 'Modélisation 3D',
  '/registration': 'Recalage',
  '/new-patient': 'Nouveau Patient',
  '/profil': 'Mon Profil',
};

export default function AppLayout({ children }) {
  const location = useLocation();
  const path = location.pathname;
  const pageName = BREADCRUMB_MAP[path] || Object.entries(BREADCRUMB_MAP).find(([k]) => path.startsWith(k))?.[1] || '';
  
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Analyse terminée', desc: 'La segmentation du patient DOS-2026-0004 est prête.', time: 'Il y a 5 min', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 2, title: 'Nouvelle connexion', desc: 'Connexion détectée depuis un nouvel appareil.', time: 'Il y a 2h', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 3, title: 'Rappel système', desc: 'Maintenance prévue à 23h00 ce soir.', time: 'Il y a 4h', icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex font-sans">
      <Sidebar />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
            <Link to="/" className="hover:text-blue-600 transition-colors inline-flex items-center gap-1.5">
              <House className="w-3.5 h-3.5" />
              <span>Accueil</span>
            </Link>
            {pageName && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-slate-800 font-semibold">{pageName}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-48 pl-9 pr-3 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-400 transition-all focus:w-64"
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
                  showNotifications 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-glass border border-slate-100 z-40 overflow-hidden animate-slide-up">
                    <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">3 Nouvelles</span>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                          <div className="flex gap-3">
                            <div className={`w-8 h-8 rounded-lg ${n.bg} ${n.color} flex items-center justify-center flex-shrink-0`}>
                              <n.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{n.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.desc}</p>
                              <p className="text-[9px] text-slate-400 mt-2 font-medium uppercase tracking-wider">{n.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-3 text-[11px] font-bold text-slate-400 hover:text-blue-600 bg-slate-50/30 transition-colors">
                      Voir toutes les notifications
                    </button>
                  </div>
                </>
              )}
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold text-slate-600 shadow-card transition-all hover:shadow-card-hover hover:border-blue-200 hover:text-blue-600"
            >
              <House className="h-3.5 w-3.5" />
              Retour
            </Link>
          </div>
        </header>

        {/* Content */}
        <div
          className="flex-1 p-8 animate-fade-in relative z-0"
        >
          <div style={{ position:'relative', zIndex:1 }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
