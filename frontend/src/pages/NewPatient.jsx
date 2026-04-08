import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Upload, Info, Lock, CheckCircle, FileImage } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../api';

const PATHOLOGIES = ['Alzheimer', 'Epilepsie', 'Autre', 'Non defini'];
const STADES = ['Precoce', 'Modere', 'Avance', 'Non defini'];
const ANTECEDENTS = ['Oui', 'Non', 'Inconnu'];

export default function NewPatient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    dossier_number: '',
    date_naissance: '',
    sexe: '',
    telephone: '',
    email: '',
    pathologie: '',
    stade: '',
    antecedents: '',
    autres_maladies: '',
    notes: '',
    files: [],
  });
  const [errors, setErrors] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const extractApiError = (err) => {
    const data = err?.response?.data;
    if (!data) return 'Erreur lors de la creation du patient.';

    if (typeof data.error === 'string' && data.error.trim()) return data.error;

    if (data.errors && typeof data.errors === 'object') {
      const firstKey = Object.keys(data.errors)[0];
      const firstVal = data.errors[firstKey];
      const message = Array.isArray(firstVal) ? firstVal[0] : firstVal;
      if (message) {
        if (firstKey === 'dossier_number') {
          return `Numero de dossier invalide: ${message} (format attendu: DOS-YYYY-NNNN)`;
        }
        return `${firstKey}: ${message}`;
      }
    }

    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    return 'Erreur lors de la creation du patient.';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm((prev) => ({ ...prev, files }));
    setUploadError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.dossier_number.trim()) nextErrors.dossier_number = 'Requis';
    if (!form.date_naissance) nextErrors.date_naissance = 'Requis';
    if (!form.sexe) nextErrors.sexe = 'Requis';
    if (!form.files || form.files.length === 0) {
      setUploadError('Veuillez selectionner un dossier contenant au moins un fichier.');
    }
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (!form.files || form.files.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('dossier_number', form.dossier_number.trim());
      formData.append('date_naissance', form.date_naissance);
      formData.append('sexe', form.sexe);
      formData.append('telephone', form.telephone);
      formData.append('email', form.email);
      formData.append('pathologie', form.pathologie);
      formData.append('stade', form.stade);
      formData.append('antecedents', form.antecedents);
      formData.append('autres_maladies', form.autres_maladies);
      formData.append('notes', form.notes);

      for (let i = 0; i < form.files.length; i += 1) {
        formData.append('files', form.files[i]);
        formData.append('relative_paths', form.files[i].webkitRelativePath || form.files[i].name);
      }

      await createPatient(formData);
      navigate('/dashboard/patients');
    } catch (err) {
      setUploadError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 ml-64 px-0 md:px-12 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8 p-4 rounded-xl border-l-4 border-[#0A1172] bg-white shadow-sm">
            <Info className="w-5 h-5 text-[#0A1172]" />
            <span className="text-sm font-semibold text-[#0A1172]">
              Les patients sont anonymises dans la plateforme. Chaque dossier est associe a un identifiant patient genere automatiquement par le systeme.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 p-8">
            <section>
              <h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Identification patient</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Numero de dossier <span className="text-red-500">*</span></label>
                  <input
                    name="dossier_number"
                    value={form.dossier_number}
                    onChange={handleChange}
                    required
                    pattern="^DOS-\d{4}-\d{4}$"
                    title="Format attendu: DOS-YYYY-NNNN"
                    className={`w-full p-3 rounded-xl border ${errors.dossier_number ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400`}
                    placeholder="Ex: DOS-2026-0001"
                  />
                  {errors.dossier_number && <div className="text-xs text-red-500 mt-1 font-medium">{errors.dossier_number}</div>}
                  <div className="text-[11px] text-slate-500 mt-1">Format requis: DOS-YYYY-NNNN (ex: DOS-2026-0001)</div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Date de naissance <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="date_naissance"
                    value={form.date_naissance}
                    onChange={handleChange}
                    required
                    className={`w-full p-3 rounded-xl border ${errors.date_naissance ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all`}
                  />
                  {errors.date_naissance && <div className="text-xs text-red-500 mt-1 font-medium">{errors.date_naissance}</div>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Sexe <span className="text-red-500">*</span></label>
                  <select
                    name="sexe"
                    value={form.sexe}
                    onChange={handleChange}
                    required
                    className={`w-full p-3 rounded-xl border ${errors.sexe ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white`}
                  >
                    <option value="">Selectionner</option>
                    <option value="M">Masculin</option>
                    <option value="F">Feminin</option>
                  </select>
                  {errors.sexe && <div className="text-xs text-red-500 mt-1 font-medium">{errors.sexe}</div>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Telephone</label>
                  <input
                    name="telephone"
                    value={form.telephone}
                    onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400"
                    placeholder="Numero de telephone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Adresse e-mail</label>
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400"
                    placeholder="Adresse e-mail"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Informations cliniques</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Pathologie suspectee</label>
                  <select name="pathologie" value={form.pathologie} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
                    <option value="">Selectionner</option>
                    {PATHOLOGIES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Stade clinique</label>
                  <select name="stade" value={form.stade} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
                    <option value="">Selectionner</option>
                    {STADES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Antecedents familiaux</label>
                  <select name="antecedents" value={form.antecedents} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
                    <option value="">Selectionner</option>
                    {ANTECEDENTS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Autres maladies</label>
                  <textarea name="autres_maladies" value={form.autres_maladies} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all min-h-[80px] resize-y placeholder:text-slate-400" placeholder="Autres pathologies / comorbidites" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-[#1a1f3c] mb-2">Notes cliniques</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all min-h-[100px] resize-y placeholder:text-slate-400" placeholder="Notes, observations, etc." />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Upload du dossier IRM</h2>
              <div className="mb-4">
                <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors ${uploadError ? 'border-red-400 bg-red-50' : 'border-[#4f6ef7] bg-blue-50/30'}`}>
                  <Upload className="w-8 h-8 text-[#4f6ef7] mb-2" />
                  <span className="font-semibold text-[#1a1f3c]">Selectionnez un dossier contenant 1 ou plusieurs fichiers</span>
                  <input
                    type="file"
                    multiple
                    webkitdirectory=""
                    directory=""
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="mt-2 px-4 py-2 bg-[#4f6ef7] text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-blue-600 transition-colors">Choisir un dossier</label>
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {['.nii', '.nii.gz', '.dcm', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'].map((ext) => (
                      <span key={ext} className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">{ext}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-[#0A1172] font-medium">Le dossier selectionne sera enregistre avec le patient.</div>
                  {uploadError && <div className="text-xs text-red-500 mt-2 font-medium">{uploadError}</div>}
                  {form.files.length > 0 && (
                    <div className="mt-4 w-full">
                      <div className="text-xs font-bold text-[#1a1f3c] mb-2">Fichiers selectionnes :</div>
                      <ul className="text-xs text-[#4f6ef7] space-y-1">
                        {form.files.map((f, i) => (
                          <li key={i} className="flex items-center gap-2"><FileImage className="w-4 h-4" /> {f.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked disabled className="accent-[#10b981] w-4 h-4" id="anonymize" />
                <label htmlFor="anonymize" className="text-sm font-semibold text-[#10b981] flex items-center gap-1">
                  <Lock className="w-4 h-4" /> Anonymisation DICOM obligatoire
                </label>
                <span className="text-xs text-slate-500 ml-2">Cette option est imposee pour la protection des donnees patient.</span>
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-8 border-t border-slate-100 mt-8">
              <button
                type="button"
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-[#6b7280] hover:bg-slate-200 transition-colors"
                onClick={() => window.history.back()}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-8 py-2.5 bg-[#4f6ef7] text-white rounded-xl text-sm font-bold shadow-[0_4px_14px_rgba(79,110,247,0.3)] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />} Enregistrer le patient
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
