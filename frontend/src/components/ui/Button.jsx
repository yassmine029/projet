import React from 'react';

const variantClasses = {
  primary:
    'bg-[#1a2b6d] text-white font-semibold rounded-md hover:bg-[#0f1f5c] transition-colors px-5 py-2.5 text-sm',
  accent:
    'bg-[#e85d7a] text-white font-semibold rounded-md hover:bg-[#d44d6a] transition-colors px-5 py-2.5 text-sm',
  outline:
    'bg-white text-[#1a2b6d] border border-[#e2e6f0] font-medium rounded-md hover:bg-[#e8edf8] px-5 py-2.5 text-sm',
  ghost:
    'bg-transparent text-[#1a2b6d] hover:bg-[#e8edf8] px-4 py-2 text-sm rounded-md',
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
  const fallbackStyle =
    variant === 'primary'
      ? { backgroundColor: '#1a2b6d', color: '#ffffff', border: '1px solid #1a2b6d' }
      : variant === 'accent'
        ? { backgroundColor: '#e85d7a', color: '#ffffff', border: '1px solid #e85d7a' }
        : variant === 'outline'
          ? { backgroundColor: '#ffffff', color: '#1a2b6d', border: '1px solid #e2e6f0' }
          : { color: '#1a2b6d' };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...fallbackStyle, ...style }}
      className={`${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || ''} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
