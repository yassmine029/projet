import React from 'react';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6 pb-5 border-b border-surface-border gap-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
