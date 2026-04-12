import React from 'react';

const variantClasses = {
  urgence: 'bg-red-50 text-red-600 border border-red-200/60 px-3 py-1 rounded-lg text-xs font-bold',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200/60 px-3 py-1 rounded-lg text-xs font-bold',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1 rounded-lg text-xs font-bold',
  info: 'bg-blue-50 text-blue-600 border border-blue-200/60 px-3 py-1 rounded-lg text-xs font-bold',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200/60 px-3 py-1 rounded-lg text-xs font-bold',
};

export default function Badge({ variant = 'info', children, className = '', dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${variantClasses[variant] || variantClasses.info} ${className}`.trim()}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${
        variant === 'success' ? 'bg-emerald-500' :
        variant === 'urgence' ? 'bg-red-500' :
        variant === 'warning' ? 'bg-amber-500' :
        'bg-blue-500'
      }`} />}
      {children}
    </span>
  );
}
