import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Stethoscope, Hash } from 'lucide-react';
import api from '../../api';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await api.get(`/patients/${id}/`);
        if (res.data && res.data.ok) {
          setPatient(res.data.patient);
        } else {
          setError(res.data.error || "Patient introuvable.");
        }
      } catch (err) {
        setError("Erreur de connexion au serveur.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-[#6b7280]">Chargement du profil patient...</div>;
  }

  if (error || !patient) {
    return (
      <div className="p-10">
        <button 
          onClick={() => navigate('/dashboard/patients')}
          className="flex items-center gap-2 text-[#4f6ef7] font-bold mb-6 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux patients
        </button>
        <div className="p-6 bg-red-50 text-red-600 rounded-xl max-w-2xl border border-red-100">
          {error || "Patient introuvable."}
        </div>
      </div>
    );
  }

  // Calculate age roughly
  const calcAge = (dobString) => {
    if (!dobString) return '?';
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <button 
        onClick={() => navigate('/dashboard/patients')}
        className="flex items-center gap-2 text-[#6b7280] font-bold mb-2 hover:text-[#4f6ef7] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </button>

      {/* Identity Card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 p-8 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-24 h-24 bg-blue-50 text-[#4f6ef7] rounded-3xl flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
          <User className="w-10 h-10" />
        </div>
        
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1a1f3c] tracking-tight">{patient.nom} {patient.prenom}</h1>
              <div className="flex items-center gap-2 mt-2 text-[#6b7280] text-sm font-medium">
                <Hash className="w-4 h-4" />
                Dossier {patient.num_dossier}
                <span className="mx-2 text-slate-300">•</span>
                Patient enregistré le {new Date(patient.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-[#6b7280]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#9ca3af] mb-1">Identité</p>
                <p className="text-sm font-semibold text-[#1a1f3c]">
                  {patient.sexe === 'M' ? 'Homme' : 'Femme'}, {calcAge(patient.date_naissance)} ans
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-[#6b7280]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#9ca3af] mb-1">Date de naissance</p>
                <p className="text-sm font-semibold text-[#1a1f3c]">
                  {new Date(patient.date_naissance).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-[#6b7280]">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#9ca3af] mb-1">Diagnostics associés</p>
                <p className="text-sm font-semibold text-[#1a1f3c] line-clamp-2">
                  {patient.autres_maladies || "Aucun diagnostic renseigné"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Placeholder */}
      <h2 className="text-xl font-bold text-[#1a1f3c] mt-10">Analyses du patient</h2>
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 min-h-[200px] flex items-center justify-center">
        <p className="text-[#9ca3af] italic text-sm">Les analyses seront affichées ici prochainement.</p>
      </div>
    </div>
  );
}
