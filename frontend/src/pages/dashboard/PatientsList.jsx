import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, X, Users, ChevronRight, Pencil, Trash2, Eye } from 'lucide-react';
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
        const msg = Array.isArray(val) ? val[0] : val;
        setEditError(`${key}: ${msg}`);
      } else {
        setEditError(err?.response?.data?.error || 'La modification du patient a échoué.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const initials = (nom, prenom) => {
    const a = (nom || '').charAt(0).toUpperCase();
    const b = (prenom || '').charAt(0).toUpperCase();
    return (a + b) || '?';
  };

  const avatarColor = (id) => {
    const colors = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
    return colors[(id || 0) % colors.length];
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return d; }
  };

  return (
    <div style={{ maxWidth: 1100, fontFamily: "'Noto Sans', system-ui, sans-serif" }}>
      {location.state?.createdPatientId && (
        <div style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
          Patient créé avec succès — ID : PID-{location.state.createdPatientId}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Mes Patients</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
            {loading ? 'Chargement...' : `${patients.length} patient${patients.length > 1 ? 's' : ''} enregistré${patients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/new-patient')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
        >
          <Plus size={15} /> Nouveau Patient
        </button>
      </div>

      {/* Filtres */}
      <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Rechercher</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input name="id" value={filters.id} onChange={handleFilterChange} placeholder="Nom, prénom…"
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>N° Dossier</label>
            <input name="num_dossier" value={filters.num_dossier} onChange={handleFilterChange} placeholder="DOS-XXXX…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Sexe</label>
            <select name="sexe" value={filters.sexe} onChange={handleFilterChange}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none' }}>
              <option value="">Tous</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Diagnostic</label>
            <input name="autres_maladies" value={filters.autres_maladies} onChange={handleFilterChange} placeholder="Mots-clés…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button type="submit"
            style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Search size={13} /> Filtrer
          </button>
        </form>
      </div>

      {/* Liste */}
      <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, overflow: 'hidden' }}>
        {/* En-tête table */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr 0.8fr 1.5fr auto', gap: 0, padding: '10px 20px', borderBottom: '1px solid #f8fafc', background: '#fafbfc' }}>
          {['Patient', 'N° Dossier', 'Naissance', 'Sexe', 'MRI', 'Diagnostic', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Chargement…</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '50px 0', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Users size={24} style={{ color: '#cbd5e1' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Aucun patient trouvé</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Créez votre premier patient pour commencer.</p>
          </div>
        ) : (
          patients.map((patient, idx) => (
            <div
              key={patient.id}
              onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr 0.8fr 1.5fr auto',
                gap: 0, padding: '13px 20px', cursor: 'pointer',
                borderBottom: idx < patients.length - 1 ? '1px solid #f8fafc' : 'none',
                transition: 'background 0.12s',
                alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fbff'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Patient — avatar + nom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: avatarColor(patient.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {initials(patient.nom, patient.prenom)}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>{patient.nom} {patient.prenom}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>ID {patient.id}</p>
                </div>
              </div>

              {/* Dossier */}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{patient.num_dossier || '—'}</span>

              {/* Naissance */}
              <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(patient.date_naissance)}</span>

              {/* Sexe */}
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: patient.sexe === 'M' ? '#eff6ff' : '#fdf2f8',
                color: patient.sexe === 'M' ? '#2563eb' : '#9333ea',
                border: patient.sexe === 'M' ? '1px solid #bfdbfe' : '1px solid #e9d5ff',
              }}>
                {patient.sexe === 'M' ? 'Homme' : 'Femme'}
              </span>

              {/* MRI */}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{getSlicesCount(patient) ?? '—'}</span>

              {/* Diagnostic */}
              <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {patient.autres_maladies || '—'}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                  title="Voir"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <Eye size={13} />
                </button>
                <button onClick={() => openEditModal(patient)}
                  title="Modifier"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDeletePatient(patient)}
                  title="Supprimer"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fee2e2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
