import React, { useState, useEffect } from 'react';
import { X, FilePlus, RefreshCw } from 'lucide-react';
import api from '../../api';

export default function ReclamationModal({ isOpen, onClose, onReclamationCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
  });
  const [fichier, setFichier] = useState(null);


  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    console.log("File selected:", e.target.files[0]);
    setFichier(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      data.append('description', formData.description);
      if (fichier) {
        data.append('fichier', fichier);
      }

      const res = await api.post('/reclamations/', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.ok) {
        setFormData({ description: '' });
        setFichier(null);
        onReclamationCreated();
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
              <FilePlus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#1a1f3c]">Nouvelle Réclamation</h2>
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

          <form id="create-reclamation-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Description <span className="text-red-500">*</span></label>
                <textarea 
                  name="description" 
                  required
                  value={formData.description} 
                  onChange={handleChange}
                  placeholder="Détails de la réclamation..." 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all min-h-[120px] resize-y placeholder:text-slate-400"
                ></textarea>
              </div>

              {/* Fichier */}
              <div>
                <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Fichier joint (optionnel)</label>
                <input 
                  type="file" 
                  name="fichier" 
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all"
                />
                <p className="mt-2 text-xs text-slate-500">Formats acceptés : Images, PDF.</p>
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
            form="create-reclamation-form"
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
