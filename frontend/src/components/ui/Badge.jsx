import React from 'react';

const variantClasses = {
  urgence: 'bg-accent-light text-accent border border-accent/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide',
  warning: 'bg-[#fff8e6] text-[#b07a00] border border-[#f5d98a] px-3 py-2 rounded-lg text-xs',
  success: 'bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-medium',
  info: 'bg-primary-light text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-medium',
};

export default function Badge({ variant = 'info', children, className = '' }) {
  return <span className={`${variantClasses[variant] || variantClasses.info} ${className}`.trim()}>{children}</span>;
}
