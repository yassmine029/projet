import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, X, Users, ChevronRight, Filter, UserCircle2 } from 'lucide-react';
import api from '../../api';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

export default function PatientsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({
    dossier_number: '', date_naissance: '', sexe: '', telephone: '',
    email: '', pathologie: '', stade: '', antecedents: '',
    autres_maladies: '', notes: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const getSlicesCount = (patient) => {
    if (typeof patient?.slices_count === 'number') return patient.slices_count;
    if (Array.isArray(patient?.mri_files)) return patient.mri_files.length;
    return null;
  };

  const [filters, setFilters] = useState({
    id: '', num_dossier: '', date_naissance: '', sexe: '', autres_maladies: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
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

  useEffect(() => { fetchPatients(); }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPatients();
  };

  const handleDeletePatient = async (patient) => {
    const fullName = `${patient?.nom || ''} ${patient?.prenom || ''}`.trim() || `patient #${patient?.id}`;
    const ok = window.confirm(`Supprimer ${fullName} de la base de donnees ? Cette action est irreversible.`);
    if (!ok) return;
    try {
      await api.delete(`/patients/${patient.id}/`);
      fetchPatients();
    } catch (err) {
      console.error('Failed to delete patient:', err);
      window.alert("La suppression du patient a echoue.");
    }
  };

  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setEditForm({
      dossier_number: patient?.dossier_number || patient?.num_dossier || '',
      date_naissance: patient?.date_naissance || '',
      sexe: patient?.sexe || '',
      telephone: patient?.telephone || '',
      email: patient?.email || '',
      pathologie: patient?.pathologie || '',
      stade: patient?.stade || '',
      antecedents: patient?.antecedents || '',
      autres_maladies: patient?.autres_maladies || '',
      notes: patient?.notes || '',
    });
    setEditError('');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingPatient(null);
    setEditLoading(false);
    setEditError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPatient?.id) return;

    // ─── Front-end Validations ───
    const errors = [];
    
    // 1. Required fields
    if (!editForm.dossier_number?.trim()) errors.push("Le numéro de dossier est obligatoire.");
    if (!editForm.sexe) errors.push("Le sexe du patient est obligatoire.");
    if (!editForm.date_naissance) {
      errors.push("La date de naissance est obligatoire.");
    } else {
      // 2. Date in the future check
      const d = new Date(editForm.date_naissance);
      if (d > new Date()) {
        errors.push("La date de naissance ne peut pas être dans le futur.");
      }
    }

    // 3. Email format check
    if (editForm.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editForm.email)) {
        errors.push("Le format de l'email est invalide.");
      }
    }

    if (errors.length > 0) {
      setEditError(errors[0]); // Display first error
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await api.patch(`/patients/${editingPatient.id}/`, {
        dossier_number: editForm.dossier_number, 
        date_naissance: editForm.date_naissance,
        sexe: editForm.sexe, 
        telephone: editForm.telephone, 
        email: editForm.email,
        pathologie: editForm.pathologie, 
        stade: editForm.stade, 
        antecedents: editForm.antecedents,
        autres_maladies: editForm.autres_maladies, 
        notes: editForm.notes,
      });
      closeEditModal();
      fetchPatients();
    } catch (err) {
      console.error('Failed to update patient:', err);
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors && typeof apiErrors === 'object') {
        const key = Object.keys(apiErrors)[0];
        const val = apiErrors[key];
        setEditError(`${key}: ${Array.isArray(val) ? val[0] : val}`);
      } else {
        setEditError(err?.response?.data?.error || 'La modification du patient a échoué.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const getInitials = (nom, prenom) => {
    return `${(nom || '')[0] || ''}${(prenom || '')[0] || ''}`.toUpperCase() || '?';
  };

  const getAvatarColor = (id) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-emerald-500 to-emerald-600',
      'from-violet-500 to-violet-600',
      'from-amber-500 to-amber-600',
      'from-rose-500 to-rose-600',
      'from-cyan-500 to-cyan-600',
    ];
    return colors[(id || 0) % colors.length];
  };

  return (
    <div className="max-w-[1200px] space-y-6 animate-fade-in">
      {location.state?.createdPatientId && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Patient cree avec succes. ID patient genere : PID-{location.state.createdPatientId}
        </div>
      )}

      <PageHeader
        icon={Users}
        title="Mes Patients"
        subtitle={`${patients.length} patient${patients.length !== 1 ? 's' : ''} enregistre${patients.length !== 1 ? 's' : ''} dans votre base clinique`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="soft" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />
              Filtres
            </Button>
            <Button variant="primary" onClick={() => navigate('/new-patient')}>
              <Plus className="w-4 h-4" />
              Nouveau Patient
            </Button>
          </div>
        }
      />

      {/* Search + Filters */}
      <Card padding="md">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="id"
              value={filters.id}
              onChange={handleFilterChange}
              placeholder="Rechercher par nom, ID, dossier..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 transition-all"
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="w-4 h-4" />
            Rechercher
          </Button>
        </form>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 gap-3 md:grid-cols-4 animate-slide-up">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">N° Dossier</label>
              <input name="num_dossier" value={filters.num_dossier} onChange={handleFilterChange}
                placeholder="DOS-XXXX..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Sexe</label>
              <select name="sexe" value={filters.sexe} onChange={handleFilterChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10">
                <option value="">Tous</option>
                <option value="M">Masculin</option>
                <option value="F">Feminin</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Diagnostic</label>
              <input name="autres_maladies" value={filters.autres_maladies} onChange={handleFilterChange}
                placeholder="Mots cles..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10" />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={() => { setFilters({ id: '', num_dossier: '', date_naissance: '', sexe: '', autres_maladies: '' }); }} className="w-full">
                Reinitialiser
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Patient Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">N° Dossier</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Naissance</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sexe</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coupes MRI</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diagnostics</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-16 text-center">
                    <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
                    <p className="text-sm text-slate-500 mt-3">Chargement des patients...</p>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-16 text-center">
                    <UserCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500 mb-1">Aucun patient trouve</p>
                    <p className="text-xs text-slate-400 mb-4">Ajoutez votre premier patient pour commencer.</p>
                    <Button variant="primary" size="sm" onClick={() => navigate('/new-patient')}>
                      <Plus className="w-3.5 h-3.5" /> Ajouter un patient
                    </Button>
                  </td>
                </tr>
              ) : (
                patients.map(patient => (
                  <tr 
                    key={patient.id} 
                    onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 bg-gradient-to-br ${getAvatarColor(patient.id)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                          {getInitials(patient.nom, patient.prenom)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{patient.nom} {patient.prenom}</p>
                          <p className="text-[11px] text-slate-400 font-medium">PID-{patient.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-700">{patient.num_dossier || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{patient.date_naissance || '—'}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={patient.sexe === 'M' ? 'info' : 'success'} dot>
                        {patient.sexe === 'M' ? 'Homme' : 'Femme'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-700">{getSlicesCount(patient) ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 truncate max-w-[180px]">
                      {patient.autres_maladies || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${patient.id}`); }}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          Voir
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(patient); }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Modifier
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      {isEditOpen && editingPatient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-900/60 backdrop-blur-sm p-4 md:p-6" onClick={closeEditModal}>
          <div className="flex min-h-full items-start justify-center py-4 md:py-8">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-glass max-h-[92vh] overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Modifier patient</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Mettez a jour les champs cliniques du patient.</p>
                </div>
                <button onClick={closeEditModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-5 px-6 py-5 overflow-y-auto max-h-[calc(92vh-88px)]">
                {editError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 font-medium">{editError}</div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { name: 'dossier_number', label: 'Numero dossier' },
                    { name: 'date_naissance', label: 'Date de naissance', type: 'date' },
                    { name: 'telephone', label: 'Telephone' },
                    { name: 'email', label: 'Email', type: 'email' },
                    { name: 'pathologie', label: 'Pathologie' },
                    { name: 'stade', label: 'Stade' },
                    { name: 'antecedents', label: 'Antecedents' },
                  ].map(({ name, label, type }) => (
                    <div key={name}>
                      <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
                      <input
                        type={type || 'text'} name={name} value={editForm[name] || ''} onChange={handleEditChange}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sexe</label>
                    <select name="sexe" value={editForm.sexe} onChange={handleEditChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10">
                      <option value="">Selectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Feminin</option>
                    </select>
                  </div>
                </div>

                {[
                  { name: 'autres_maladies', label: 'Autres maladies' },
                  { name: 'notes', label: 'Notes' },
                ].map(({ name, label }) => (
                  <div key={name}>
                    <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
                    <textarea name={name} value={editForm[name] || ''} onChange={handleEditChange}
                      className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10" />
                  </div>
                ))}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline" onClick={closeEditModal}>Annuler</Button>
                  <Button type="submit" variant="primary" disabled={editLoading}>
                    {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
