import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ChevronRight, Bell, Search } from 'lucide-react';
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
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
            </button>
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
        <div className="flex-1 p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
