import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText } from 'lucide-react';
import api from '../../api';
import PatientModal from '../../components/dashboard/PatientModal';

export default function PatientsList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    id: '',
    num_dossier: '',
    date_naissance: '',
    sexe: '',
    autres_maladies: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      // Build query string
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      
      const res = await api.get(`/patients/?${params.toString()}`);
      if (res.data && res.data.ok) {
        setPatients(res.data.patients || []);
      }
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPatients();
  };

  const handlePatientCreated = () => {
    fetchPatients();
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
        <div>
          <h1 className="text-[28px] font-bold text-[#1a1f3c] tracking-tight">Mes Patients</h1>
          <p className="text-[#6b7280]">{patients.length} patients enregistrés</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4f6ef7] text-white rounded-xl font-bold shadow-[0_4px_14px_rgba(79,110,247,0.3)] hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau Patient
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] font-bold uppercase text-[#9ca3af] mb-1">Rechercher</label>
            <input 
              type="text" 
              name="id" 
              value={filters.id} 
              onChange={handleFilterChange} 
              placeholder="Nom, ID patient..." 
              className="w-full text-sm p-2.5 rounded-lg border border-[#e5e7eb] focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none" 
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] font-bold uppercase text-[#9ca3af] mb-1">N° Dossier</label>
            <input 
              type="text" 
              name="num_dossier" 
              value={filters.num_dossier} 
              onChange={handleFilterChange} 
              placeholder="DOS-XXXX..." 
              className="w-full text-sm p-2.5 rounded-lg border border-[#e5e7eb] focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none" 
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] font-bold uppercase text-[#9ca3af] mb-1">Sexe</label>
            <select 
              name="sexe" 
              value={filters.sexe} 
              onChange={handleFilterChange} 
              className="w-full text-sm p-2.5 rounded-lg border border-[#e5e7eb] focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none bg-white"
            >
              <option value="">Tous</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
             <label className="block text-[11px] font-bold uppercase text-[#9ca3af] mb-1">Diagnostic</label>
             <input 
              type="text" 
              name="autres_maladies" 
              value={filters.autres_maladies} 
              onChange={handleFilterChange} 
              placeholder="Mots clés..." 
              className="w-full text-sm p-2.5 rounded-lg border border-[#e5e7eb] focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none" 
            />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-slate-100 font-bold text-[#1a1f3c] rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" />
            Filtrer
          </button>
        </form>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">N° Dossier</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Nom</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Prénom</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Date Naissance</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Sexe</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide">Diagnostics</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#6b7280]">Chargement des patients...</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#6b7280]">Aucun patient trouvé.</td>
                </tr>
              ) : (
                patients.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-semibold text-[#1a1f3c]">{patient.num_dossier}</td>
                    <td className="p-4 text-sm font-medium text-[#1a1f3c]">{patient.nom}</td>
                    <td className="p-4 text-sm text-[#6b7280]">{patient.prenom}</td>
                    <td className="p-4 text-sm text-[#6b7280]">{patient.date_naissance}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        patient.sexe === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                      }`}>
                        {patient.sexe === 'M' ? 'Homme' : 'Femme'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#6b7280] truncate max-w-[200px]">
                      {patient.autres_maladies || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                        className="px-4 py-1.5 text-xs font-bold text-[#4f6ef7] bg-[#eef2ff] rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Patient Modal */}
      <PatientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onPatientCreated={handlePatientCreated} 
      />
    </div>
  );
}
