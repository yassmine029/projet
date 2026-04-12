import React, { useState } from 'react';
import { Upload, Info, Lock, CheckCircle, FileImage, UserPlus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../api';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const PATHOLOGIES = ['Alzheimer', 'Epilepsie', 'Autre', 'Non defini'];
const STADES = ['Precoce', 'Modere', 'Avance', 'Non defini'];
const ANTECEDENTS = ['Oui', 'Non', 'Inconnu'];

function FormField({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function NewPatient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    dossier_number: '', date_naissance: '', sexe: '', telephone: '',
    email: '', pathologie: '', stade: '', antecedents: '',
    autres_maladies: '', notes: '', files: [],
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
        if (firstKey === 'dossier_number') return `Numero de dossier invalide: ${message} (format attendu: DOS-YYYY-NNNN)`;
        return `${firstKey}: ${message}`;
      }
    }
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    return 'Erreur lors de la creation du patient.';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm(prev => ({ ...prev, files }));
    setUploadError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.dossier_number.trim()) nextErrors.dossier_number = 'Requis';
    if (!form.date_naissance) nextErrors.date_naissance = 'Requis';
    if (!form.sexe) nextErrors.sexe = 'Requis';
    if (!form.files || form.files.length === 0) setUploadError('Veuillez selectionner un dossier contenant au moins un fichier.');
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }
    if (!form.files || form.files.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key !== 'files') formData.append(key, val);
      });
      for (let i = 0; i < form.files.length; i++) {
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

  const inputCls = (hasError) =>
    `w-full rounded-xl border ${hasError ? 'border-red-300' : 'border-slate-200'} px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 transition-all`;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        icon={UserPlus}
        title="Nouveau Patient"
        subtitle="Enregistrez un nouveau patient dans la base clinique avec ses coupes IRM."
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
        }
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3 mb-6">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-blue-700 leading-relaxed">
          Les patients sont anonymises dans la plateforme. Chaque dossier est associe a un identifiant patient genere automatiquement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Identification */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <span className="text-[11px] font-black text-blue-600">01</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">Identification patient</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Numero de dossier" required error={errors.dossier_number} hint="Format: DOS-YYYY-NNNN">
              <input name="dossier_number" value={form.dossier_number} onChange={handleChange}
                pattern="^DOS-\d{4}-\d{4}$" title="Format attendu: DOS-YYYY-NNNN"
                className={inputCls(errors.dossier_number)} placeholder="Ex: DOS-2026-0001" />
            </FormField>
            <FormField label="Date de naissance" required error={errors.date_naissance}>
              <input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange}
                className={inputCls(errors.date_naissance)} />
            </FormField>
            <FormField label="Sexe" required error={errors.sexe}>
              <select name="sexe" value={form.sexe} onChange={handleChange} className={inputCls(errors.sexe)}>
                <option value="">Selectionner</option>
                <option value="M">Masculin</option>
                <option value="F">Feminin</option>
              </select>
            </FormField>
            <FormField label="Telephone">
              <input name="telephone" value={form.telephone} onChange={handleChange}
                className={inputCls(false)} placeholder="Numero de telephone" />
            </FormField>
            <FormField label="Adresse e-mail">
              <input name="email" value={form.email} onChange={handleChange}
                className={inputCls(false)} placeholder="Adresse e-mail" />
            </FormField>
          </div>
        </Card>

        {/* Section 2: Clinical */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <span className="text-[11px] font-black text-emerald-600">02</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">Informations cliniques</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Pathologie suspectee">
              <select name="pathologie" value={form.pathologie} onChange={handleChange} className={inputCls(false)}>
                <option value="">Selectionner</option>
                {PATHOLOGIES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Stade clinique">
              <select name="stade" value={form.stade} onChange={handleChange} className={inputCls(false)}>
                <option value="">Selectionner</option>
                {STADES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Antecedents familiaux">
              <select name="antecedents" value={form.antecedents} onChange={handleChange} className={inputCls(false)}>
                <option value="">Selectionner</option>
                {ANTECEDENTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Autres maladies">
                <textarea name="autres_maladies" value={form.autres_maladies} onChange={handleChange}
                  className={`${inputCls(false)} min-h-[70px] resize-y`} placeholder="Autres pathologies / comorbidites" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notes cliniques">
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  className={`${inputCls(false)} min-h-[80px] resize-y`} placeholder="Observations, notes..." />
              </FormField>
            </div>
          </div>
        </Card>

        {/* Section 3: Upload */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
              <span className="text-[11px] font-black text-violet-600">03</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">Upload du dossier IRM</h2>
          </div>

          <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 transition-colors ${
            uploadError ? 'border-red-300 bg-red-50/50' : 'border-blue-300 bg-blue-50/30'
          }`}>
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-3">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            <p className="font-semibold text-slate-900 text-sm mb-1">Selectionnez un dossier contenant vos fichiers</p>
            <p className="text-xs text-slate-500 mb-3">Formats supportes : NIfTI, DICOM, JPEG, PNG, TIFF, BMP</p>
            <input type="file" multiple webkitdirectory="" directory="" onChange={handleFileChange} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]">
              Choisir un dossier
            </label>
            <div className="flex gap-1.5 mt-4 flex-wrap justify-center">
              {['.nii', '.nii.gz', '.dcm', '.jpg', '.png', '.tif', '.bmp'].map(ext => (
                <span key={ext} className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">{ext}</span>
              ))}
            </div>
            {uploadError && <p className="text-xs text-red-600 mt-3 font-medium">{uploadError}</p>}
            {form.files.length > 0 && (
              <div className="mt-4 w-full max-w-md">
                <p className="text-xs font-bold text-slate-700 mb-2">{form.files.length} fichier(s) selectionne(s) :</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {form.files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5">
                      <FileImage className="w-3.5 h-3.5 text-blue-500" /> {f.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-2.5">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Anonymisation DICOM obligatoire</span>
            <span className="text-[10px] text-emerald-600/70 ml-1">Protection des donnees patient imposee.</span>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-4">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Enregistrer le patient
          </Button>
        </div>
      </form>
    </div>
  );
}
