import React from 'react';

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export default function Card({ children, className = '', padding = 'md', hover = false }) {
  return (
    <div
      className={`bg-white border border-slate-200/60 rounded-2xl shadow-card ${
        paddingClasses[padding] || paddingClasses.md
      } ${
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
