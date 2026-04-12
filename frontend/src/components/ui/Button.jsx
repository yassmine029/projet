import React from 'react';

const variantClasses = {
  primary:
    'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/20 hover:shadow-blue-700/25 transition-all px-5 py-2.5 text-sm active:scale-[0.98]',
  accent:
    'bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/15 transition-all px-5 py-2.5 text-sm active:scale-[0.98]',
  outline:
    'bg-white text-slate-700 border border-slate-200 font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 px-5 py-2.5 text-sm transition-all',
  ghost:
    'bg-transparent text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 text-sm rounded-xl transition-all',
  soft:
    'bg-blue-50 text-blue-600 font-semibold rounded-xl hover:bg-blue-100 px-5 py-2.5 text-sm transition-all border border-blue-100',
};

const sizeClasses = {
  sm: 'text-xs px-3 py-1.5',
  md: '',
  lg: 'text-sm px-6 py-3',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  style,
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`inline-flex items-center justify-center gap-2 ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || ''} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
