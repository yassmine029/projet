import React, { useState, useEffect } from 'react';
import { Plus, FileText, X, ExternalLink, HelpCircle, MessageSquare, ChevronRight } from 'lucide-react';
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
  const [editForm, setEditForm] = useState({ description: '', categorie: 'autre', priorite: 'normale', file: null });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const resolveFichierUrl = (fichierUrl) => {
    if (!fichierUrl) return null;
    if (/^https?:\/\//i.test(fichierUrl)) return fichierUrl;
    const apiBase = api.defaults?.baseURL || window.location.origin;
    const backendOrigin = new URL(apiBase, window.location.origin).origin;
    return new URL(fichierUrl, backendOrigin).toString();
  };

  const fetchReclamations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reclamations/');
      if (res.data && res.data.ok) setReclamations(res.data.reclamations || []);
    } catch (err) {
      console.error("Failed to fetch reclamations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReclamations(); }, []);

  const openEditModal = (reclamation) => {
    setEditingReclamation(reclamation);
    setEditForm({
      description: reclamation?.description || '',
      categorie: reclamation?.categorie || 'autre',
      priorite: reclamation?.priorite || 'normale',
      file: null,
    });
    setEditError('');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingReclamation(null);
    setEditForm({ description: '', categorie: 'autre', priorite: 'normale', file: null });
    setEditError('');
    setEditLoading(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingReclamation) return;
    const trimmed = String(editForm.description || '').trim();
    if (!trimmed) { setEditError('La description est obligatoire.'); return; }
    setEditLoading(true);
    setEditError('');
    try {
      const fd = new FormData();
      fd.append('description', trimmed);
      fd.append('categorie', editForm.categorie || 'autre');
      fd.append('priorite', editForm.priorite || 'normale');
      if (editForm.file) fd.append('fichier', editForm.file);
      await api.post(`/reclamations/${editingReclamation.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      closeEditModal();
      fetchReclamations();
    } catch (err) {
      console.error('Failed to edit reclamation:', err);
      setEditError(err?.response?.data?.error || 'La modification de la reclamation a echoue.');
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

  const closePreview = () => { setIsPreviewOpen(false); setPreviewFileUrl(null); setPreviewHasError(false); };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'validee': return <Badge variant="success" dot>Validee</Badge>;
      case 'non_validee': return <Badge variant="urgence" dot>Non validee</Badge>;
      default: return <Badge variant="warning" dot>En attente</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  const formatCategorie = (value) => {
    const labels = {
      compte: 'Compte & acces',
      segmentation: 'Segmentation IA',
      viewer: 'Visualisation',
      performance: 'Performance',
      facturation: 'Facturation',
      autre: 'Autre',
    };
    return labels[value] || value || '-';
  };

  const formatPriorite = (value) => {
    const labels = {
      basse: 'Basse',
      normale: 'Normale',
      haute: 'Haute',
      critique: 'Critique',
    };
    return labels[value] || value || '-';
  };

  return (
    <div className="max-w-[1200px] space-y-6 animate-fade-in">
      <PageHeader
        icon={HelpCircle}
        title="Mes Reclamations"
        subtitle={`${reclamations.length} reclamation${reclamations.length !== 1 ? 's' : ''} soumise${reclamations.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Nouvelle Reclamation
          </Button>
        }
      />

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numero</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/3">Description</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categorie</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priorite</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Etat</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-16 text-center">
                    <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
                    <p className="text-sm text-slate-500 mt-3">Chargement des reclamations...</p>
                  </td>
                </tr>
              ) : reclamations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-16 text-center">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500 mb-1">Aucune reclamation</p>
                    <p className="text-xs text-slate-400 mb-4">Soumettez une reclamation si necessaire.</p>
                  </td>
                </tr>
              ) : (
                reclamations.map(reclamation => (
                  <tr key={reclamation.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-blue-600">{reclamation.numero}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 truncate max-w-[250px]">
                      {reclamation.description}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {formatCategorie(reclamation.categorie)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {formatPriorite(reclamation.priorite)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(reclamation.date)}</td>
                    <td className="px-5 py-3.5 text-center">{getStatusBadge(reclamation.etat)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(reclamation)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                          Modifier
                        </button>
                        <button onClick={() => handleDeleteReclamation(reclamation)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          Supprimer
                        </button>
                        <button
                          onClick={() => reclamation.fichier_url && openPreview(reclamation.fichier_url)}
                          disabled={!reclamation.fichier_url}
                          className={`p-1.5 rounded-lg transition-colors ${reclamation.fichier_url ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-slate-300 cursor-not-allowed'}`}
                          title={reclamation.fichier_url ? 'Voir le fichier' : 'Aucun fichier joint'}
                        >
                          <FileText className="w-4 h-4" />
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

      <ReclamationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onReclamationCreated={fetchReclamations} />

      {/* Edit Modal */}
      {isEditOpen && editingReclamation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 backdrop-blur-sm p-4" onClick={closeEditModal}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-glass animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Modifier la reclamation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modifiez la description ou remplacez la capture.</p>
              </div>
              <button onClick={closeEditModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5 px-6 py-5">
              {editError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 font-medium">{editError}</div>}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Categorie</label>
                  <select
                    value={editForm.categorie}
                    onChange={(e) => setEditForm(prev => ({ ...prev, categorie: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                  >
                    <option value="compte">Compte & acces</option>
                    <option value="segmentation">Segmentation IA</option>
                    <option value="viewer">Visualisation</option>
                    <option value="performance">Performance</option>
                    <option value="facturation">Facturation</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Priorite</label>
                  <select
                    value={editForm.priorite}
                    onChange={(e) => setEditForm(prev => ({ ...prev, priorite: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                  >
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
                  placeholder="Description de la reclamation"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Remplacer la capture</label>
                <input type="file" accept="image/*,.pdf"
                  onChange={(e) => setEditForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-600"
                />
              </div>

              {editingReclamation.fichier_url && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Capture actuelle disponible.
                  <button type="button" className="font-semibold text-blue-600 hover:underline" onClick={() => openPreview(editingReclamation.fichier_url)}>
                    Voir
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="outline" onClick={closeEditModal}>Annuler</Button>
                <Button type="submit" variant="primary" disabled={editLoading}>
                  {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && previewFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 backdrop-blur-sm p-4" onClick={closePreview}>
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-glass" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">Apercu de la capture</h2>
              <button onClick={closePreview} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-5">
              {previewHasError ? (
                <div className="space-y-3 text-center text-sm text-slate-600">
                  <p>Impossible d&apos;afficher un apercu de cette capture.</p>
                  <Button variant="primary" onClick={() => window.open(previewFileUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" /> Ouvrir le fichier
                  </Button>
                </div>
              ) : (
                <img src={previewFileUrl} alt="Capture reclamation"
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-slate-100"
                  onError={() => setPreviewHasError(true)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
