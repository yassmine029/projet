import React, { useEffect, useMemo, useState } from 'react';

const CHECKLIST_STEPS = [
  'Préparation des données',
  'Chargement du modèle',
  'Inférence Deep Learning',
  'Calcul volumétrique',
  'Génération du rapport',
];

const SegmentationProgress = ({ patient, selectedSlices = [], onClose }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      setProgress(current);

      if (current >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const selectedCount = useMemo(() => {
    if (!Array.isArray(selectedSlices)) return 0;
    return selectedSlices.length;
  }, [selectedSlices]);

  const patientName = useMemo(() => {
    if (!patient) return 'Patient inconnu';
    const firstName = patient.first_name || '';
    const lastName = patient.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Patient inconnu';
  }, [patient]);

  const completedSteps = Math.min(5, Math.floor(progress / 20));
  const isDone = progress >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Étape 3/3 : Segmentation en cours</h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            <span className="font-medium text-slate-800">{patientName}</span> · {selectedCount} coupe
            {selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>Progression</span>
            <span className="font-medium text-slate-800">{progress}%</span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#3b6fd4] transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mb-6 space-y-2">
          {CHECKLIST_STEPS.map((step, index) => {
            const done = index < completedSteps;
            return (
              <div
                key={step}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  done
                    ? 'border-blue-200 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    done ? 'bg-[#3b6fd4] text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : '•'}
                </span>
                <span className="text-sm md:text-base">{step}</span>
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-5">
            <h3 className="text-lg font-semibold text-slate-900">Segmentation terminée ✓</h3>
            <p className="mt-1 text-sm text-slate-700 md:text-base">
              Les résultats seront disponibles dans Analyses MRI
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex items-center rounded-lg bg-[#3b6fd4] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Voir les résultats
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SegmentationProgress;
