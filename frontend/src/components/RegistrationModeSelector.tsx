import React from 'react';
import { MousePointer2, BrainCircuit, Lightbulb, Lock, ShieldCheck } from 'lucide-react';

const GuideIcon = () => (
  <img src="/assets/images/creative.png" alt="guide" className="h-10 w-10 object-contain" />
);

interface RegistrationModeSelectorProps {
  selectedMode: 'manual' | 'mine';
  onModeChange: (mode: 'manual' | 'mine') => void;
  disabled?: boolean;
  isEmergencySession?: boolean;
  onShowManualGuide?: () => void;
  onShowAutoGuide?: () => void;
  onShowAssistant?: () => void;
}

const RegistrationModeSelector: React.FC<RegistrationModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  disabled = false,
  isEmergencySession = false,
  onShowManualGuide,
  onShowAutoGuide,
  onShowAssistant,
}) => {
  const modes = [
    {
      id: 'manual' as const,
      icon: <MousePointer2 className="w-5 h-5" />,
      title: 'Recalage manuel',
      description: 'Vous guidez point par point · Contrôle total',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderSelected: 'border-emerald-500 ring-emerald-500/20',
      dot: 'bg-emerald-500',
      onGuide: onShowManualGuide,
      emergencyLocked: true,
    },
    {
      id: 'mine' as const,
      icon: <BrainCircuit className="w-5 h-5" />,
      title: 'Recalage affine',
      description: 'Transformations affines globales · ⚡ Rapide',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      borderSelected: 'border-purple-500 ring-purple-500/20',
      dot: 'bg-purple-500',
      onGuide: onShowAutoGuide,
      emergencyLocked: false,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mode de Recalage</h3>

      {modes.map((mode) => {
        const isLocked = isEmergencySession && mode.emergencyLocked;
        const isDisabled = disabled || isLocked;

        return (
          <div key={mode.id} className="relative">
            <button
              onClick={() => !isDisabled && onModeChange(mode.id)}
              disabled={isDisabled}
              title={isLocked ? 'Disponible après validation de votre compte par l\'administrateur' : undefined}
              className={`
                relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group
                ${selectedMode === mode.id && !isLocked
                  ? `${mode.borderSelected} bg-white shadow-md ring-1`
                  : isLocked
                    ? 'border-slate-200 bg-slate-50/60 cursor-not-allowed'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 bg-white'
                }
                ${disabled && !isLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
            >
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                ${isLocked
                  ? 'bg-slate-100 text-slate-300'
                  : selectedMode === mode.id
                    ? `${mode.bg} ${mode.color}`
                    : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                }
              `}>
                {isLocked ? <Lock className="w-5 h-5" /> : mode.icon}
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <p className={`text-sm font-bold ${isLocked ? 'text-slate-300' : selectedMode === mode.id ? 'text-slate-900' : 'text-slate-800'}`}>
                  {mode.title}
                </p>
                <p className={`text-[10px] font-semibold transition-colors ${isLocked ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-700'}`}>
                  {isLocked ? 'Compte complet requis' : mode.description}
                </p>
              </div>

              {selectedMode === mode.id && !isLocked && (
                <div className={`absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 ${mode.dot}`} />
              )}

              {isLocked && (
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              )}
            </button>

            {mode.onGuide && !isLocked && (
              <button
                onClick={(e) => { e.stopPropagation(); mode.onGuide!(); }}
                title="Guide d'utilisation"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 text-blue-400 hover:text-blue-600 transition-colors"
              >
                <GuideIcon />
              </button>
            )}
          </div>
        );
      })}

      {/* Bandeau d'information mode urgence */}
      {isEmergencySession && (
        <div className="mt-1 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-semibold text-amber-700 leading-relaxed">
            Le recalage manuel sera disponible après validation de votre compte par l'administrateur.
          </p>
        </div>
      )}

      {/* Aide au choix */}
      {onShowAssistant && !isEmergencySession && (
        <button
          onClick={onShowAssistant}
          disabled={disabled}
          className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Aide au choix de mode
        </button>
      )}
    </div>
  );
};

export default RegistrationModeSelector;
