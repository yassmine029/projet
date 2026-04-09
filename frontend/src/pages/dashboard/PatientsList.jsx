import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import api from '../../api';
import PatientModal from '../../components/dashboard/PatientModal';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';

export default function PatientsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({
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
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const getSlicesCount = (patient) => {
    if (typeof patient?.slices_count === 'number') return patient.slices_count;
    if (Array.isArray(patient?.mri_files)) return patient.mri_files.length;
    return null;
  };
  
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

    setEditLoading(true);
    setEditError('');
    try {
      const payload = {
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
      };

      await api.patch(`/patients/${editingPatient.id}/`, payload);
      closeEditModal();
      fetchPatients();
    } catch (err) {
      console.error('Failed to update patient:', err);
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors && typeof apiErrors === 'object') {
        const key = Object.keys(apiErrors)[0];
        const val = apiErrors[key];
        const msg = Array.isArray(val) ? val[0] : val;
        setEditError(`${key}: ${msg}`);
      } else {
        setEditError(err?.response?.data?.error || 'La modification du patient a echoue.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px] space-y-6 bg-[#f5f7ff]">
      {location.state?.createdPatientId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Patient créé avec succès. ID patient généré : PID-{location.state.createdPatientId}
        </div>
      ) : null}

      <PageHeader
        title="Mes Patients"
        subtitle={`${patients.length} patients enregistres`}
        actions={
          <Button variant="primary" onClick={() => navigate('/new-patient')} className="flex items-center gap-2 shadow-card">
            <Plus className="w-5 h-5" />
            Nouveau Patient
          </Button>
        }
      />

      <Card padding="md" className="rounded-[14px]">
        <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 items-end md:grid-cols-5">
          <Input
            label="Rechercher"
            name="id"
            value={filters.id}
            onChange={handleFilterChange}
            placeholder="Nom, ID patient..."
            icon={<Search className="w-4 h-4" />}
          />
          <Input
            label="N° Dossier"
            name="num_dossier"
            value={filters.num_dossier}
            onChange={handleFilterChange}
            placeholder="DOS-XXXX..."
          />
          <div>
            <label className="text-sm font-medium text-primary mb-1.5 block">Sexe</label>
            <select
              name="sexe"
              value={filters.sexe}
              onChange={handleFilterChange}
              className="w-full border border-surface-border rounded-md px-4 py-2.5 text-sm text-primary bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              <option value="">Tous</option>
              <option value="M">Masculin</option>
              <option value="F">Feminin</option>
            </select>
          </div>
          <Input
            label="Diagnostic"
            name="autres_maladies"
            value={filters.autres_maladies}
            onChange={handleFilterChange}
            placeholder="Mots cles..."
          />
          <Button type="submit" variant="outline" className="h-[42px] flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />
            Filtrer
          </Button>
        </form>
      </Card>

      <Card padding="sm" className="rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f7ff] border-b border-surface-border">
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">N° Dossier</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Prenom</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date Naissance</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sexe</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Coupes MRI</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Diagnostics</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-600">Chargement des patients...</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-600">Aucun patient trouve.</td>
                </tr>
              ) : (
                patients.map(patient => (
                  <tr key={patient.id} className="hover:bg-[#f5f7ff] transition-colors">
                    <td className="p-4 text-sm font-semibold text-primary">{patient.num_dossier}</td>
                    <td className="p-4 text-sm font-medium text-primary">{patient.nom}</td>
                    <td className="p-4 text-sm text-gray-600">{patient.prenom}</td>
                    <td className="p-4 text-sm text-gray-600">{patient.date_naissance}</td>
                    <td className="p-4">
                      <Badge variant="info">{patient.sexe === 'M' ? 'Homme' : 'Femme'}</Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{getSlicesCount(patient) ?? '—'}</td>
                    <td className="p-4 text-sm text-gray-600 truncate max-w-[200px]">
                      {patient.autres_maladies || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                          className="font-medium"
                        >
                          Voir
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openEditModal(patient)}
                          className="font-medium"
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="accent"
                          onClick={() => handleDeletePatient(patient)}
                          className="font-medium"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Patient Modal (disabled for reset) */}
      {/*
      <PatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPatientCreated={handlePatientCreated}
      />
      */}

      {isEditOpen && editingPatient ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 md:p-6" onClick={closeEditModal}>
          <div className="flex min-h-full items-start justify-center py-4 md:py-8">
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#1a1f3c]">Modifier patient</h3>
                <p className="text-xs text-slate-500 mt-1">Mettez a jour les champs cliniques du patient.</p>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5 px-6 py-5 overflow-y-auto max-h-[calc(92vh-88px)]">
              {editError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Numero dossier</label>
                  <input
                    name="dossier_number"
                    value={editForm.dossier_number}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Date de naissance</label>
                  <input
                    type="date"
                    name="date_naissance"
                    value={editForm.date_naissance || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Sexe</label>
                  <select
                    name="sexe"
                    value={editForm.sexe}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  >
                    <option value="">Selectionner</option>
                    <option value="M">Masculin</option>
                    <option value="F">Feminin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Telephone</label>
                  <input
                    name="telephone"
                    value={editForm.telephone || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Pathologie</label>
                  <input
                    name="pathologie"
                    value={editForm.pathologie || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Stade</label>
                  <input
                    name="stade"
                    value={editForm.stade || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Antecedents</label>
                  <input
                    name="antecedents"
                    value={editForm.antecedents || ''}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Autres maladies</label>
                <textarea
                  name="autres_maladies"
                  value={editForm.autres_maladies || ''}
                  onChange={handleEditChange}
                  className="min-h-[90px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Notes</label>
                <textarea
                  name="notes"
                  value={editForm.notes || ''}
                  onChange={handleEditChange}
                  className="min-h-[90px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="outline" onClick={closeEditModal}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" disabled={editLoading}>
                  {editLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
