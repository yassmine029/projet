import React from 'react';
import { MousePointer2, Zap, BrainCircuit } from 'lucide-react';

interface RegistrationModeSelectorProps {
  selectedMode: 'manual' | 'mine';
  onModeChange: (mode: 'manual' | 'mine') => void;
  disabled?: boolean;
}

const RegistrationModeSelector: React.FC<RegistrationModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  disabled = false
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
    },
    {
      id: 'mine' as const,
      icon: <BrainCircuit className="w-5 h-5" />,
      title: 'Automatique',
      description: 'Automatique • Modèle MINE/AI',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      borderSelected: 'border-purple-500 ring-purple-500/20',
      dot: 'bg-purple-500',
      recommended: true,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mode de Recalage</h3>

      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => !disabled && onModeChange(mode.id)}
          disabled={disabled}
          className={`
            relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group
            ${selectedMode === mode.id
              ? `${mode.borderSelected} bg-white shadow-md ring-1`
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
          `}
        >
          {/* Icon */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
            ${selectedMode === mode.id
              ? `${mode.bg} ${mode.color}`
              : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
            }
          `}>
            {mode.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-sm font-bold ${selectedMode === mode.id ? 'text-slate-900' : 'text-slate-600'}`}>
                {mode.title}
              </span>
              {mode.recommended && (
                <span className="text-[10px] font-bold text-white bg-gradient-to-r from-orange-400 to-pink-500 px-1.5 py-0.5 rounded-full shadow-sm">
                  TOP
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium group-hover:text-slate-500 transition-colors">{mode.description}</p>
          </div>
 
          {/* Selected dot */}
          {selectedMode === mode.id && (
            <div className={`absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 ${mode.dot}`}></div>
          )}
        </button>
      ))}
    </div>
  );
};

export default RegistrationModeSelector;