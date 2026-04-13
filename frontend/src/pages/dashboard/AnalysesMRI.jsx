import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileImage, Plus, Brain, Clock, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import api from '../../api';

const statusConfig = {
  done: { label: 'Terminee', variant: 'success', icon: CheckCircle2 },
  running: { label: 'En cours', variant: 'info', icon: Loader2 },
  failed: { label: 'Echec', variant: 'urgence', icon: XCircle },
  pending: { label: 'En attente', variant: 'warning', icon: Clock },
};

export default function AnalysesMRI() {
  const navigate = useNavigate();
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState('');
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    const fetchRuns = async () => {
      setRunsLoading(true);
      setRunsError('');
      try {
        const token = localStorage.getItem('access');
        const response = await api.get('/segmentation-runs/', {
          params: { limit: 50 },
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        setRuns(Array.isArray(response?.data?.runs) ? response.data.runs : []);
      } catch {
        setRunsError('Impossible de charger les analyses MRI.');
        setRuns([]);
      } finally {
        setRunsLoading(false);
      }
    };
    fetchRuns();
  }, []);

  const formatDateTime = (value) => {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeAgo = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const diff = Math.floor((Date.now() - d) / 60000);
    if (diff < 1) return "A l'instant";
    if (diff < 60) return `Il y a ${diff} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`;
    return formatDateTime(value);
  };

  return (
    <div className="max-w-[1200px] space-y-6 animate-fade-in">
      <PageHeader
        icon={FileImage}
        title="Analyses MRI"
        subtitle="Historique des segmentations sauvegardees et resultats cliniques."
        actions={
          <Button variant="primary" onClick={() => navigate('/segmentation/nouvelle')}>
            <Plus className="w-4 h-4" />
            Nouvelle segmentation
          </Button>
        }
      />

      {/* Stats summary */}
      {!runsLoading && !runsError && runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total analyses', value: runs.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Terminees', value: runs.filter(r => r.status === 'done').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'En cours', value: runs.filter(r => r.status === 'running').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Echouees', value: runs.filter(r => r.status === 'failed').length, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} rounded-xl px-4 py-3 border border-slate-200/40`}>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {runsLoading && (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Chargement des analyses...</p>
          </div>
        )}

        {!runsLoading && runsError && (
          <div className="p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 font-medium">{runsError}</p>
          </div>
        )}

        {!runsLoading && !runsError && runs.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Aucune analyse enregistree</p>
            <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto leading-relaxed">
              Lancez votre premiere segmentation volumetrique pour voir apparaitre vos resultats ici.
            </p>
            <Button variant="primary" onClick={() => navigate('/segmentation/nouvelle')}>
              <Plus className="w-4 h-4" />
              Premiere segmentation
            </Button>
          </div>
        )}

        {!runsLoading && !runsError && runs.length > 0 && (
          <div className="divide-y divide-slate-100">
            {runs.map((run) => {
              const status = String(run?.status || 'pending');
              const cfg = statusConfig[status] || statusConfig.pending;
              const StatusIcon = cfg.icon;

              return (
                <div
                  key={run.id}
                  onClick={() => navigate(`/segmentation/nouvelle?run=${run.id}`)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    status === 'done' ? 'bg-emerald-50 text-emerald-600' :
                    status === 'running' ? 'bg-blue-50 text-blue-600' :
                    status === 'failed' ? 'bg-red-50 text-red-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    <StatusIcon className={`w-5 h-5 ${status === 'running' ? 'animate-spin' : ''}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {run.patient_name || `Analyse #${run.id}`}
                      </p>
                      <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {run.model_version || run.model_key || 'U-Net++ ONNX'} · {run.processed_count || 0}/{run.selected_count || 0} coupes · {formatDateTime(run.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:block">{formatTimeAgo(run.created_at)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
