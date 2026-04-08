import React, { useState } from 'react';
import SegmentationModal from './SegmentationModal';
import SliceSelector from './SliceSelector';
import SegmentationProgress from './SegmentationProgress';

export default function SegmentationFlow({ onClose }) {
  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedSlices, setSelectedSlices] = useState([]);

  const handleClose = () => {
    setStep(1);
    setSelectedPatient(null);
    setSelectedSlices([]);
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  if (step === 1) {
    return (
      <SegmentationModal
        onClose={handleClose}
        onPatientSelected={(patient) => {
          setSelectedPatient(patient);
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4 py-6 backdrop-blur-sm">
        <SliceSelector
          patient={selectedPatient}
          onBack={() => setStep(1)}
          onConfirm={(slices) => {
            setSelectedSlices(slices);
            setStep(3);
          }}
        />
      </div>
    );
  }

  return (
    <SegmentationProgress
      patient={selectedPatient}
      selectedSlices={selectedSlices}
      onClose={handleClose}
    />
  );
}
