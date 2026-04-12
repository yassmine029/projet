import React, { useState } from 'react';
import { X, UserPlus, RefreshCw } from 'lucide-react';
import api from '../../api';

export default function PatientModal({ isOpen, onClose, onPatientCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    num_dossier: '',
    nom: '',
    prenom: '',
    date_naissance: '',
    sexe: 'M',
    autres_maladies: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/patients/', formData);
      if (res.data && res.data.ok) {
        setFormData({
          num_dossier: '',
          nom: '',
          prenom: '',
          date_naissance: '',
          sexe: 'M',
          autres_maladies: ''
        });
        onPatientCreated();
        onClose();
      } else {
        setError(res.data.error || "Une erreur est survenue lors de la création.");
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Erreur de connexion au serveur.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Nouveau Patient</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form id="create-patient-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* N° Dossier */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">N° Dossier <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="num_dossier" 
                  required 
                  value={formData.num_dossier} 
                  onChange={handleChange}
                  placeholder="Ex: DOS-2026-001" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Sexe */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Sexe <span className="text-red-500">*</span></label>
                <select 
                  name="sexe" 
                  required 
                  value={formData.sexe} 
                  onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>

              {/* Nom */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Nom <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="nom" 
                  required 
                  value={formData.nom} 
                  onChange={handleChange}
                  placeholder="Nom de famille" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Prénom */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Prénom <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="prenom" 
                  required 
                  value={formData.prenom} 
                  onChange={handleChange}
                  placeholder="Prénom" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Date Naissance */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-900 mb-2">Date de naissance <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  name="date_naissance" 
                  required 
                  value={formData.date_naissance} 
                  onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all"
                />
              </div>

              {/* Autres Maladies */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-900 mb-2">Autres Maladies / Diagnostics</label>
                <textarea 
                  name="autres_maladies" 
                  value={formData.autres_maladies} 
                  onChange={handleChange}
                  placeholder="Antécédents médicaux, notes diagnostiques..." 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all min-h-[100px] resize-y placeholder:text-slate-400"
                ></textarea>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-[#6b7280] hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            form="create-patient-form"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-2.5 bg-[#4f6ef7] text-white rounded-xl text-sm font-bold shadow-[0_4px_14px_rgba(79,110,247,0.3)] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
