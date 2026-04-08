import React, { useState, useEffect } from 'react';
import { Plus, FileText, X, ExternalLink } from 'lucide-react';
import api from '../../api';
import ReclamationModal from '../../components/dashboard/ReclamationModal';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

export default function ReclamationsList() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState(null);
  const [previewHasError, setPreviewHasError] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingReclamation, setEditingReclamation] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', etat: 'en_attente', file: null });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const resolveFichierUrl = (fichierUrl) => {
    if (!fichierUrl) return null;

    // If the backend already returns an absolute URL, use it directly.
    if (/^https?:\/\//i.test(fichierUrl)) return fichierUrl;

    const apiBase = api.defaults?.baseURL || window.location.origin;
    const backendOrigin = new URL(apiBase, window.location.origin).origin;
    return new URL(fichierUrl, backendOrigin).toString();
  };

  const fetchReclamations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reclamations/');
      if (res.data && res.data.ok) {
        setReclamations(res.data.reclamations || []);
      }
    } catch (err) {
      console.error("Failed to fetch reclamations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReclamations();
  }, []);

  const handleReclamationCreated = () => {
    fetchReclamations();
  };

  const openEditModal = (reclamation) => {
    setEditingReclamation(reclamation);
    setEditForm({
      description: reclamation?.description || '',
      etat: reclamation?.etat || 'en_attente',
      file: null,
    });
    setEditError('');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingReclamation(null);
    setEditForm({ description: '', etat: 'en_attente', file: null });
    setEditError('');
    setEditLoading(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingReclamation) return;

    const trimmed = String(editForm.description || '').trim();
    if (!trimmed) {
      setEditError('La description est obligatoire.');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      const fd = new FormData();
      fd.append('description', trimmed);
      fd.append('etat', editForm.etat || 'en_attente');
      if (editForm.file) {
        fd.append('fichier', editForm.file);
      }

      await api.post(`/reclamations/${editingReclamation.id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      closeEditModal();
      fetchReclamations();
    } catch (err) {
      console.error('Failed to edit reclamation:', err);
      const apiError = err?.response?.data?.error;
      setEditError(apiError || 'La modification de la reclamation a echoue.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteReclamation = async (reclamation) => {
    const ok = window.confirm(`Supprimer la reclamation ${reclamation.numero || `#${reclamation.id}`} ?`);
    if (!ok) return;

    try {
      await api.delete(`/reclamations/${reclamation.id}/`);
      fetchReclamations();
    } catch (err) {
      console.error('Failed to delete reclamation:', err);
      window.alert('La suppression de la reclamation a echoue.');
    }
  };

  const openPreview = (fichierUrl) => {
    const fileUrl = resolveFichierUrl(fichierUrl);
    if (!fileUrl) return;

    setPreviewFileUrl(fileUrl);
    setPreviewHasError(false);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFileUrl(null);
    setPreviewHasError(false);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'payee':
        return <Badge variant="success">Payee</Badge>;
      case 'rejetee':
        return <Badge variant="urgence">Rejetee</Badge>;
      case 'en_attente':
      default:
        return <Badge variant="warning">En attente</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="max-w-[1200px] space-y-6 bg-[#f5f7ff]">
      <PageHeader
        title="Mes Reclamations"
        subtitle={`${reclamations.length} reclamations trouvees`}
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 shadow-card">
            <Plus className="w-5 h-5" />
            Ajouter Reclamation
          </Button>
        }
      />

      {/* Reclamations Table */}
      <Card padding="sm" className="rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f7ff] border-b border-surface-border">
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Numero</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-1/3">Description</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Etat</th>
                <th className="p-4 text-xs font-bold text-[#9ca3af] uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-600">Chargement des reclamations...</td>
                </tr>
              ) : reclamations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-600">Aucune reclamation trouvee.</td>
                </tr>
              ) : (
                reclamations.map(reclamation => (
                  <tr key={reclamation.id} className="hover:bg-[#f5f7ff] transition-colors">
                    <td className="p-4 text-sm font-semibold text-primary">{reclamation.numero}</td>
                    <td className="p-4 text-sm text-gray-600 truncate max-w-[250px]">
                      {reclamation.description}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{formatDate(reclamation.date)}</td>
                    <td className="p-4 text-center">
                      {getStatusBadge(reclamation.etat)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openEditModal(reclamation)}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="accent"
                          onClick={() => handleDeleteReclamation(reclamation)}
                        >
                          Supprimer
                        </Button>
                        <button
                          onClick={() => {
                            if (reclamation.fichier_url) {
                              openPreview(reclamation.fichier_url);
                            }
                          }}
                          disabled={!reclamation.fichier_url}
                          className={`p-2 rounded-lg transition-colors inline-block
                            ${reclamation.fichier_url
                              ? 'text-primary bg-primary-light hover:bg-[#dbe6fb] cursor-pointer'
                              : 'text-gray-300 bg-[#f5f7ff] cursor-not-allowed'}`}
                          title={reclamation.fichier_url ? 'Voir le fichier' : 'Aucun fichier joint'}
                        >
                          <FileText className="w-5 h-5" />
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

      <ReclamationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onReclamationCreated={handleReclamationCreated} 
      />

      {isEditOpen && editingReclamation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeEditModal}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#1a1f3c]">Modifier la reclamation</h3>
                <p className="text-xs text-slate-500 mt-1">Vous pouvez modifier la description et remplacer la capture jointe.</p>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5 px-6 py-5">
              {editError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[110px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1a2b6d] focus:ring-2 focus:ring-[#1a2b6d]/10"
                  placeholder="Description de la reclamation"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#1a1f3c]">Remplacer la capture</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#e8edf8] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1a2b6d]"
                  />
                </div>
              </div>

              {editingReclamation.fichier_url ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Capture actuelle disponible.
                  <button
                    type="button"
                    className="ml-2 font-semibold text-[#1a2b6d] hover:underline"
                    onClick={() => openPreview(editingReclamation.fichier_url)}
                  >
                    Voir
                  </button>
                </div>
              ) : null}

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
      ) : null}

      {isPreviewOpen && previewFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closePreview}>
          <div
            className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-[#1a1f3c]">Capture de la réclamation</h2>
              <button
                onClick={closePreview}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto p-4">
              {previewHasError ? (
                <div className="space-y-3 text-center text-sm text-slate-600">
                  <p>Impossible d&apos;afficher un aperçu de cette capture.</p>
                  <button
                    onClick={() => window.open(previewFileUrl, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir le fichier
                  </button>
                </div>
              ) : (
                <img
                  src={previewFileUrl}
                  alt="Capture réclamation"
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg border border-slate-100"
                  onError={() => setPreviewHasError(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
