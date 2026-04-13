import React from 'react';

export default function Input({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  icon,
  error,
  className = '',
  readOnly = false,
  disabled = false,
  name,
}) {
  return (
    <div className={className}>
      {label && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          className={`w-full border border-slate-200 rounded-xl ${
            icon ? 'pl-10' : 'px-4'
          } py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 transition-all ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''
          } ${readOnly ? 'bg-slate-50 cursor-default' : ''} ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
    </div>
  );
}
