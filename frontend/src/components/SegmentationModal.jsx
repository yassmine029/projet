import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserRound, X, RefreshCw, ArrowRight } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

function formatBirthDate(value) {
  if (!value) return 'Date inconnue';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('fr-FR').format(date);
}

export default function SegmentationModal({ onClose, onPatientSelected }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  useEffect(() => {
    let active = true;

    const loadPatients = async () => {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('access');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch(`${API_BASE_URL}/api/patients/`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error('Impossible de charger les patients.');
        }

        const data = await response.json();
        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];

        if (active) {
          setPatients(normalized);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Erreur de connexion au serveur.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPatients();

    return () => {
      active = false;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return patients;

    return patients.filter((patient) => {
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase();
      return fullName.includes(term);
    });
  }, [patients, searchTerm]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-[#3b6fd4]">
              <UserRound className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-[#1a1f3c]">
              Nouvelle segmentation — Étape 1/3 : Sélection du patient
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un patient par nom..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3b6fd4]/30 focus:border-[#3b6fd4] text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-[300px]">
          {loading && (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-[#3b6fd4]" />
              <span className="text-sm font-medium">Chargement des patients...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          {!loading && !error && filteredPatients.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Aucun patient correspondant.
            </div>
          )}

          {!loading && !error && filteredPatients.length > 0 && (
            <div className="space-y-3">
              {filteredPatients.map((patient) => {
                const isSelected = selectedPatientId === patient.id;
                const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient sans nom';

                return (
                  <div
                    key={patient.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-[#3b6fd4] bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1a1f3c]">{fullName}</p>
                        <p className="text-sm text-slate-500">Date de naissance : {formatBirthDate(patient.date_of_birth)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPatientId(patient.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[#3b6fd4] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Sélectionner
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end">
          {selectedPatient && (
            <button
              type="button"
              onClick={() => onPatientSelected(selectedPatient)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3b6fd4] text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors"
            >
              Continuer →
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
