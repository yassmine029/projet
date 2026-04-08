import React from 'react';
import Sidebar from '../components/Sidebar';
import { Calendar, ChevronDown, House } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-[#f5f7ff] flex font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 p-10 mt-4">
        <div className="sticky top-4 z-20 mb-6 flex justify-end bg-[#f5f7ff]/90 py-2 backdrop-blur-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-surface-border bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-light"
          >
            <House className="h-4 w-4" />
            Retour a l'accueil
          </Link>
        </div>
        {isHome ? (
          <div className="max-w-[1200px] space-y-8">
            <PageHeader
              title="Tableau de bord"
              subtitle="Bienvenue, Dr. VisionMed. Voici l'etat de votre service aujourd'hui."
              actions={
                <Card padding="sm" className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Calendar className="w-4 h-4 text-primary" />
                  16 mars 2026
                </Card>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 min-h-[360px] flex flex-col" padding="lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-base font-semibold text-primary">Activite des Analyses</h2>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-[#f5f7ff] hover:bg-primary-light border border-surface-border transition-colors rounded-lg text-xs font-semibold text-gray-600 cursor-pointer">
                    Derniers 7 jours
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic" />
              </Card>

              <Card className="lg:col-span-1 min-h-[360px] flex flex-col" padding="lg">
                <h2 className="text-base font-semibold text-primary mb-6">Repartition Diagnostics</h2>
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic" />
              </Card>
            </div>

            <div className="mt-10">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-semibold text-primary">Analyses MRI</h2>
                <Button variant="primary" onClick={() => navigate('/dashboard/analysesMRI')}>
                  Voir les analyses
                </Button>
              </div>
              <Card className="min-h-[120px] flex items-center justify-between" padding="lg">
                <p className="text-sm text-gray-600">Les segmentations sauvegardees sont disponibles dans l'espace Analyses MRI.</p>
                <Button variant="primary" onClick={() => navigate('/dashboard/analysesMRI')}>
                  Acceder a Analyses MRI
                </Button>
              </Card>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
