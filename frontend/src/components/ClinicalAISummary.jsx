import React, { useMemo } from 'react';
import { Brain, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';

// Plages normatives hippocampiques (mm³) — adulte 50-70 ans
const NORMS = {
  left:  { min: 2100, max: 2700 },
  right: { min: 2100, max: 2700 },
  total: { min: 4200, max: 5400 },
};

function classifyVolume(val, side) {
  const norm = NORMS[side];
  if (!val || !norm) return 'unknown';
  const pct = (val - norm.min) / (norm.max - norm.min);
  if (val >= norm.min)                          return 'normal';
  if (val >= norm.min * 0.9)                    return 'mild';
  if (val >= norm.min * 0.8)                    return 'moderate';
  return 'severe';
}

function computeVelocity(history) {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first  = sorted[0];
  const last   = sorted[sorted.length - 1];
  const months = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 1) return null;
  const deltaTotal = (last.total_volume_mm3 || 0) - (first.total_volume_mm3 || 0);
  return { mmPerMonth: deltaTotal / months, months, n: sorted.length };
}

function computeTrend(history) {
  if (history.length < 3) return 'stable';
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const mid    = Math.floor(sorted.length / 2);
  const firstHalf  = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  const avgFirst  = firstHalf.reduce((s, r) => s + (r.total_volume_mm3 || 0), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, r) => s + (r.total_volume_mm3 || 0), 0) / secondHalf.length;
  const rate = (avgSecond - avgFirst) / avgFirst;
  if (rate < -0.05) return 'declining';
  if (rate < -0.02) return 'mild_decline';
  return 'stable';
}

function generateSummary(history, patient) {
  if (!history || history.length === 0) {
    return {
      level: 'info',
      text: "Aucune donnée volumétrique disponible pour ce patient. Générez un rapport PDF après chaque segmentation pour alimenter le suivi longitudinal.",
      short: "Données insuffisantes",
    };
  }

  if (history.length === 1) {
    const r = history[0];
    const cls = classifyVolume(r.total_volume_mm3, 'total');
    return {
      level: cls === 'normal' ? 'good' : 'warning',
      text: `Un seul examen disponible (${r.date_display}). Le volume hippocampique total est de ${r.total_volume_mm3?.toFixed(0)} mm³${cls === 'normal' ? ', dans les limites normales pour l\'âge' : ', en dessous des valeurs normatives'}. Un second examen est nécessaire pour établir une trajectoire longitudinale.`,
      short: "1 examen — suivi insuffisant",
    };
  }

  const sorted   = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest   = sorted[sorted.length - 1];
  const velocity = computeVelocity(history);
  const trend    = computeTrend(history);
  const cls      = classifyVolume(latest.total_volume_mm3, 'total');
  const asym     = Math.abs(latest.asymmetry_index || 0);
  const n        = history.length;
  const span     = velocity ? `${Math.round(velocity.months)} mois` : 'période analysée';
  const rate     = velocity ? Math.abs(velocity.mmPerMonth).toFixed(1) : null;
  const pct      = latest.total_volume_mm3 && sorted[0].total_volume_mm3
    ? Math.abs(((latest.total_volume_mm3 - sorted[0].total_volume_mm3) / sorted[0].total_volume_mm3) * 100).toFixed(1)
    : null;

  let level = 'good';
  let text  = '';

  if (trend === 'declining' || cls === 'severe' || cls === 'moderate') {
    level = 'critical';
    text  = `Le patient présente une diminution progressive du volume hippocampique sur les ${n} derniers examens`;
    if (pct) text += ` (−${pct}% sur ${span})`;
    text += ', compatible avec une évolution neurodégénérative';
    if (cls === 'severe')   text += ' de stade avancé';
    else if (cls === 'moderate') text += ' de stade modéré';
    else text += ' de stade léger';
    text += '.';
    if (asym > 10) text += ` Une asymétrie significative de ${asym.toFixed(1)}% entre hippocampe gauche et droit est observée, pouvant indiquer un processus latéralisé.`;
    if (rate) text += ` Le taux d'atrophie est estimé à −${rate} mm³/mois.`;
    text += ' Une consultation spécialisée et un suivi rapproché à 3 mois sont recommandés.';

  } else if (trend === 'mild_decline' || cls === 'mild') {
    level = 'warning';
    text  = `Le suivi sur ${n} examens (${span}) révèle une atrophie légère du volume hippocampique`;
    if (pct) text += ` (−${pct}% au total)`;
    text += '.';
    if (asym > 7) text += ` Une asymétrie de ${asym.toFixed(1)}% est notée entre les deux structures.`;
    text += ' Ces valeurs se situent en dehors des plages normatives pour l\'âge. Un contrôle à 6 mois est conseillé.';

  } else {
    level = 'good';
    text  = `Le volume hippocampique se maintient dans des limites acceptables sur l'ensemble des ${n} examens réalisés sur ${span}`;
    if (pct && parseFloat(pct) < 2) text += `, avec une variation de ${pct}% jugée non significative`;
    text += '.';
    if (asym > 5) text += ` Une légère asymétrie de ${asym.toFixed(1)}% est observée mais reste dans les limites normales.`;
    text += ' Aucune intervention urgente n\'est indiquée. Poursuite du suivi annuel recommandée.';
  }

  return { level, text, short: level === 'critical' ? 'Déclin progressif détecté' : level === 'warning' ? 'Atrophie légère — surveillance' : 'Volume stable' };
}

export default function ClinicalAISummary({ history, patient, allSameSource }) {
  const summary = useMemo(() => {
    // Même IRM analysé plusieurs fois : afficher uniquement le dernier résultat enregistré
    if (allSameSource) {
      const sorted = [...(history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sorted[0];
      if (!latest) return { level: 'info', text: "Aucune donnée volumétrique disponible.", short: "Données insuffisantes" };
      const cls = classifyVolume(latest.total_volume_mm3, 'total');
      return {
        level: cls === 'normal' ? 'good' : cls === 'mild' ? 'warning' : 'critical',
        text: `Résultat de la dernière analyse enregistrée (${latest.date_display}) : volume hippocampique total de ${latest.total_volume_mm3?.toFixed(0) ?? '—'} mm³`
          + (cls === 'normal' ? ', dans les limites normales.' : ', en dessous des valeurs normatives.')
          + " Pour obtenir un suivi longitudinal, importez un IRM d'une date différente et effectuez une nouvelle segmentation.",
        short: "Un seul IRM source — suivi temporel indisponible",
        singleSource: true,
      };
    }
    return generateSummary(history, patient);
  }, [history, patient, allSameSource]);

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const palette = {
    good:     { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700', badgeDot: 'bg-emerald-500', label: 'Évolution favorable' },
    warning:  { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200',   icon: AlertTriangle, iconColor: 'text-amber-600', iconBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', badgeDot: 'bg-amber-500', label: 'Surveillance recommandée' },
    critical: { bg: 'from-rose-50 to-red-50',     border: 'border-rose-200',    icon: TrendingDown,  iconColor: 'text-rose-600',  iconBg: 'bg-rose-100',  badge: 'bg-rose-100 text-rose-700',   badgeDot: 'bg-rose-500',   label: 'Attention clinique requise' },
    info:     { bg: 'from-slate-50 to-blue-50',   border: 'border-slate-200',   icon: Brain,         iconColor: 'text-slate-500', iconBg: 'bg-slate-100', badge: 'bg-slate-100 text-slate-600', badgeDot: 'bg-slate-400',  label: 'En attente de données' },
  };
  const p = palette[summary.level] || palette.info;
  const Icon = p.icon;

  return (
    <div className={`rounded-3xl border ${p.border} bg-gradient-to-br ${p.bg} p-6 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl ${p.iconBg} flex items-center justify-center shrink-0`}>
            <Brain className={`w-6 h-6 ${p.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Analyse longitudinale</p>
              <span className="text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-violet-600 text-white px-2 py-0.5 rounded-full">IA Clinique</span>
            </div>
            <h3 className="text-base font-black text-slate-900">Résumé automatique</h3>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${p.badge} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.badgeDot}`} />
          {p.label}
        </span>
      </div>

      {/* Séparateur */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-4" />

      {/* Texte clinique */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-slate-300 to-transparent" />
        <p className="pl-4 text-[13px] leading-relaxed text-slate-700 font-medium italic">
          "{summary.text}"
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/60">
        <p className="text-[10px] text-slate-400 font-semibold">
          Généré le {today} · Basé sur {history?.length || 0} examen{(history?.length || 0) > 1 ? 's' : ''}
        </p>
        <p className="text-[9px] text-slate-400 italic">Basé sur des règles cliniques validées — non substituable à un avis médical</p>
      </div>
    </div>
  );
}
