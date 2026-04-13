import React from 'react';

const palettes = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    glow: 'shadow-blue-500/15',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-100',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    glow: 'shadow-emerald-500/15',
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-100',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    glow: 'shadow-violet-500/15',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-100',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    glow: 'shadow-amber-500/15',
  },
};

export default function StatCard({ icon: Icon, value, label, sub, color = 'blue', dark = false }) {
  if (dark) {
    return (
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20">
        {Icon && <Icon className="w-5 h-5 text-blue-200 mb-2" />}
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-blue-200 font-medium mt-1">{label}</p>
      </div>
    );
  }

  const c = palettes[color] || palettes.blue;

  return (
    <div className={`group relative bg-white border ${c.border} rounded-2xl p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center shadow-lg ${c.glow}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      <p className="text-[26px] font-black text-slate-900 tracking-tight leading-none">{value}</p>
      <p className="text-[12px] font-semibold text-slate-500 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{sub}</p>}
    </div>
  );
}
