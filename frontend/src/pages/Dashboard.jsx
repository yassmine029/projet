import React from 'react';
import Sidebar from '../components/Sidebar';
import { Calendar, ChevronDown } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';

export default function Dashboard() {
  const location = useLocation();
  const isHome = location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 p-10 mt-4">
        {isHome ? (
          <div className="max-w-[1200px] space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <h1 className="text-[28px] font-bold text-[#1a1f3c] mb-2 tracking-tight">Tableau de bord</h1>
                <p className="text-[#6b7280]">Bienvenue, Dr. VisionMed. Voici l'état de votre service aujourd'hui.</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-sm font-semibold text-[#1a1f3c]">
                <Calendar className="w-4 h-4 text-[#4f6ef7]" />
                16 mars 2026
              </div>
            </div>

            {/* Top Cards Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activité des Analyses */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 min-h-[360px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-[#1a1f3c]">Activité des Analyses</h2>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f8fafc] hover:bg-slate-100 border border-slate-100 transition-colors rounded-lg text-xs font-semibold text-[#6b7280] cursor-pointer">
                    Derniers 7 jours
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-sm italic">
                  {/* Empty container for chart */}
                </div>
              </div>

              {/* Répartition Diagnostics */}
              <div className="lg:col-span-1 bg-white rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 min-h-[360px] flex flex-col">
                <h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Répartition Diagnostics</h2>
                <div className="flex-1 flex items-center justify-center text-[#9ca3af] text-sm italic">
                  {/* Empty container for pie chart */}
                </div>
              </div>
            </div>

            {/* Analyses Récentes Section */}
            <div className="mt-10">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-[#1a1f3c]">Analyses Récentes</h2>
                <button className="text-sm font-bold text-[#4f6ef7] hover:text-blue-700 transition-colors">Voir tout</button>
              </div>
              <div className="bg-white rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 min-h-[200px]">
                {/* Empty container for table */}
              </div>
            </div>

          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
