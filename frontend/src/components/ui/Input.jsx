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
      {label ? <label className="text-sm font-medium text-primary mb-1.5 block">{label}</label> : null}
      <div className="relative">
        {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span> : null}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          className={`w-full border border-surface-border rounded-md ${icon ? 'pl-10' : 'px-4'} py-2.5 text-sm text-primary bg-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors`}
        />
      </div>
      {error ? <p className="text-accent text-xs mt-1">{error}</p> : null}
    </div>
  );
}
