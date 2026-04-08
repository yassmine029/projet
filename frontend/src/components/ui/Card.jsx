import React from 'react';

const paddingClasses = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export default function Card({ children, className = '', padding = 'md' }) {
  return (
    <div
      className={`bg-white border border-surface-border rounded-lg shadow-card ${
        paddingClasses[padding] || paddingClasses.md
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
