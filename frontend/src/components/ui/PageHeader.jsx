import React from 'react';

export default function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="flex items-start justify-between mb-8 gap-4">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 flex-shrink-0">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}
