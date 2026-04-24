import React from 'react';
import { MousePointer2, BrainCircuit, HelpCircle } from 'lucide-react';

interface RegistrationModeSelectorProps {
  selectedMode: 'manual' | 'mine';
  onModeChange: (mode: 'manual' | 'mine') => void;
  disabled?: boolean;
  onShowManualGuide?: () => void;
  onShowAutoGuide?: () => void;
}

const RegistrationModeSelector: React.FC<RegistrationModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  disabled = false,
  onShowManualGuide,
  onShowAutoGuide,
}) => {
  const modes = [
    {
      id: 'manual' as const,
      icon: <MousePointer2 className="w-5 h-5" />,
      title: 'Manuel',
      description: 'Précis • Points de contrôle',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderSelected: 'border-emerald-500 ring-emerald-500/20',
      dot: 'bg-emerald-500',
      onGuide: onShowManualGuide,
    },
    {
      id: 'mine' as const,
      icon: <BrainCircuit className="w-5 h-5" />,
      title: 'Automatique',
      description: 'Transformations affines globales',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      borderSelected: 'border-purple-500 ring-purple-500/20',
      dot: 'bg-purple-500',
      onGuide: onShowAutoGuide,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mode de Recalage</h3>

      {modes.map((mode) => (
        <div key={mode.id} className="relative">
          <button
            onClick={() => !disabled && onModeChange(mode.id)}
            disabled={disabled}
            className={`
              relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group
              ${selectedMode === mode.id
                ? `${mode.borderSelected} bg-white shadow-md ring-1`
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 bg-white'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
            `}
          >
            {/* Icon */}
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
              ${selectedMode === mode.id
                ? `${mode.bg} ${mode.color}`
                : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
              }
            `}>
              {mode.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-6">
              <p className={`text-sm font-bold ${selectedMode === mode.id ? 'text-slate-900' : 'text-slate-800'}`}>
                {mode.title}
              </p>
              <p className="text-[10px] text-slate-600 font-semibold group-hover:text-slate-700 transition-colors">
                {mode.description}
              </p>
            </div>

            {/* Selected dot */}
            {selectedMode === mode.id && (
              <div className={`absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 ${mode.dot}`} />
            )}
          </button>

          {/* HelpCircle guide button */}
          {mode.onGuide && (
            <button
              onClick={(e) => { e.stopPropagation(); mode.onGuide!(); }}
              title="Guide d'utilisation"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 text-blue-400 hover:text-blue-600 transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default RegistrationModeSelector;
