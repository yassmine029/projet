import React from 'react';

export default function StatCard({ value, label, dark = false }) {
  if (dark) {
    return (
      <div className="bg-primary rounded-lg p-4 text-white">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-blue-200 mt-1">{label}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-surface-border rounded-lg p-4">
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
