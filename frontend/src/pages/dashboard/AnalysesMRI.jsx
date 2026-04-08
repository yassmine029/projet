import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import api from '../../api';

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
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const list = Array.isArray(response?.data?.runs) ? response.data.runs : [];
        setRuns(list);
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
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel = useMemo(() => ({
    done: 'Terminee',
    running: 'En cours',
    failed: 'Echec',
    pending: 'En attente',
  }), []);

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Analyses MRI"
        subtitle="Historique des segmentations sauvegardees du medecin."
        actions={(
          <Button variant="primary" onClick={() => navigate('/segmentation/nouvelle')}>
            Nouvelle segmentation
          </Button>
        )}
      />

      <Card padding="lg">
        {runsLoading && (
          <div className="h-36 flex items-center justify-center">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!runsLoading && runsError && (
          <p className="text-sm text-red-600">{runsError}</p>
        )}

        {!runsLoading && !runsError && runs.length === 0 && (
          <p className="text-sm text-gray-500">Aucune segmentation enregistree pour le moment.</p>
        )}

        {!runsLoading && !runsError && runs.length > 0 && (
          <div className="space-y-2">
            {runs.map((run) => {
              const status = String(run?.status || 'pending');
              const badgeClass =
                status === 'done'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : status === 'failed'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';

              return (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3 hover:bg-[#f5f7ff] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{run.patient_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(run.created_at)} · modele {run.model_version || run.model_key || 'U-Net++ ONNX'} · {run.processed_count || 0}/{run.selected_count || 0} coupes
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
                      {statusLabel[status] || 'En attente'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/segmentation/nouvelle?run=${run.id}`)}
                    >
                      Consulter resultat
                    </Button>
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
