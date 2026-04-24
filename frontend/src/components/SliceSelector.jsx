import React, { useMemo, useState } from 'react';

const TOTAL_SLICES = 12;

export default function SliceSelector({ patient, onBack, onConfirm }) {
  const slices = useMemo(
    () =>
      Array.from({ length: TOTAL_SLICES }, (_, i) => ({
        index: i + 1,
        name: `Coupe ${i + 1}/${TOTAL_SLICES}`,
      })),
    []
  );

  const [selectedSlices, setSelectedSlices] = useState([]);

  const patientName = patient
    ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
    : 'Patient non sélectionné';

  const toggleSlice = (sliceIndex) => {
    setSelectedSlices((prev) =>
      prev.includes(sliceIndex)
        ? prev.filter((index) => index !== sliceIndex)
        : [...prev, sliceIndex].sort((a, b) => a - b)
    );
  };

  const selectAll = () => {
    setSelectedSlices(slices.map((slice) => slice.index));
  };

  const clearAll = () => {
    setSelectedSlices([]);
  };

  const handleConfirm = () => {
    if (selectedSlices.length === 0) return;
    onConfirm(selectedSlices);
  };

  return (
    <div className="w-full max-w-5xl rounded-xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-slate-900">Étape 2/3 : Sélection des coupes</h2>
        <p className="mt-1 text-sm text-slate-600">Patient : {patientName}</p>
      </div>

      <div className="px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-lg border border-[#3b6fd4] px-4 py-2 text-sm font-medium text-[#3b6fd4] transition hover:bg-blue-50"
          >
            Tout sélectionner
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Tout désélectionner
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slices.map((slice) => {
            const isSelected = selectedSlices.includes(slice.index);

            return (
              <button
                key={slice.index}
                type="button"
                onClick={() => toggleSlice(slice.index)}
                className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-[#3b6fd4] bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                aria-pressed={isSelected}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSlice(slice.index)}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-3 top-3 h-4 w-4 rounded border-slate-300 text-[#3b6fd4] focus:ring-[#3b6fd4]"
                  aria-label={`Sélectionner ${slice.name}`}
                />

                <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-slate-200 text-sm font-medium text-slate-700">
                  {slice.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-700">{selectedSlices.length} coupes sélectionnées</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← Retour
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedSlices.length === 0}
            className="rounded-lg bg-[#3b6fd4] px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Confirmer →
          </button>
        </div>
      </div>
    </div>
  );
}
