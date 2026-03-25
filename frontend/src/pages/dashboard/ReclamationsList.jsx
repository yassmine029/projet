import React, { useState, useEffect } from 'react';
import { Plus, FileText, Search } from 'lucide-react';
import api from '../../api';
import ReclamationModal from '../../components/dashboard/ReclamationModal';

export default function ReclamationsList() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReclamations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reclamations/');
      if (res.data && res.data.ok) {
        setReclamations(res.data.reclamations || []);
      }
    } catch (err) {
      console.error("Failed to fetch reclamations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReclamations();
  }, []);

  const handleReclamationCreated = () => {
    fetchReclamations();
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'payee':
        return <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold">Payée</span>;
      case 'rejetee':
        return <span className="px-3 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">Rejetée</span>;
      case 'en_attente':
      default:
        return <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold">En attente</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
        <div>
          <h1 className="text-[28px] font-bold text-[#1a1f3c] tracking-tight">Mes Réclamations</h1>
          <p className="text-[#6b7280]">{reclamations.length} réclamations trouvées</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4f6ef7] text-white rounded-xl font-bold shadow-[0_4px_14px_rgba(79,110,247,0.3)] hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Ajouter Réclamation
        </button>
      </div>

      {/* Reclamations Table */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Numéro</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide w-1/3">Description</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Date</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide text-center">État</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide text-right">Consulter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#6b7280]">Chargement des réclamations...</td>
                </tr>
              ) : reclamations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#6b7280]">Aucune réclamation trouvée.</td>
                </tr>
              ) : (
                reclamations.map(reclamation => (
                  <tr key={reclamation.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-semibold text-[#1a1f3c]">{reclamation.numero}</td>
                    <td className="p-4 text-sm text-[#6b7280] truncate max-w-[250px]">
                      {reclamation.description}
                    </td>
                    <td className="p-4 text-sm text-[#6b7280]">{formatDate(reclamation.date)}</td>
                    <td className="p-4 text-center">
                      {getStatusBadge(reclamation.etat)}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          if (reclamation.fichier_url) {
                            window.open(api.getUri() + reclamation.fichier_url, '_blank');
                          }
                        }}
                        disabled={!reclamation.fichier_url}
                        className={`p-2 rounded-lg transition-colors inline-block 
                          ${reclamation.fichier_url 
                            ? 'text-[#4f6ef7] bg-[#eef2ff] hover:bg-blue-100 cursor-pointer' 
                            : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                        title={reclamation.fichier_url ? "Voir le fichier" : "Aucun fichier joint"}
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReclamationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onReclamationCreated={handleReclamationCreated} 
      />
    </div>
  );
}
