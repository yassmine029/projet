import React from 'react';

/**
 * Affiche la comparaison somme d'intensités Brodmann : patient (volume MNI) vs référence (ex. sujet1).
 * Les données sont fournies par le parent après appel à GET /api/brodmann/intensity/
 */
export default function BrodmannIntensityPanel({
  zoneName,
  zoneNumber,
  stats,
  loading,
  error,
  referenceLabel = 'Référence (sujet1)',
  analyseAvailable = true,
}) {
  const fmt = (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
      : '—';

  const diff = stats?.difference;
  const diffColor =
    typeof diff === 'number'
      ? diff < 0
        ? 'text-red-600'
        : diff > 0
          ? 'text-emerald-600'
          : 'text-slate-600'
      : 'text-slate-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        Intensités Brodmann (MNI152)
      </p>
      <h3 className="mt-1 text-sm font-bold text-slate-800">
        {zoneName ? (
          <>
            {zoneName}
            {zoneNumber != null && (
              <span className="ml-2 font-mono text-xs font-semibold text-slate-500">BA {zoneNumber}</span>
            )}
          </>
        ) : (
          <span className="text-slate-500">Cliquez sur une zone pour comparer</span>
        )}
      </h3>

      {!analyseAvailable && (
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Les mesures comparatives ne s’affichent pas encore : il faut une session de recalage
          encore ouverte (après validation du recalage), ou avoir enregistré l’IRM recalée dans
          le dossier patient. Si vous voyez déjà les images, recliquez sur une zone après avoir
          validé le recalage ; sinon enregistrez le volume puis rechargez l’écran.
        </p>
      )}

      {analyseAvailable && loading && (
        <p className="mt-3 text-xs text-slate-500">Chargement des sommes d'intensité…</p>
      )}
      {analyseAvailable && error && !loading && (
        <p className="mt-3 text-xs font-medium text-amber-700">{error}</p>
      )}

      {analyseAvailable && stats && !loading && (
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">
              Ratio comparable
              <span className="mt-0.5 block font-normal normal-case text-[10px] text-slate-400">
                Contraste zone / reste du cerveau (corrige les échelles d&apos;affichage différentes)
              </span>
            </dt>
            <dd className="shrink-0 font-mono font-semibold text-slate-800 text-right">
              {stats.ratio_relative_percent == null || stats.reference_relative_index == null
                ? '—'
                : `${fmt(stats.ratio_relative_percent)} % du sujet de référence`}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Moyenne dans la zone — Patient</dt>
            <dd className="font-mono font-semibold text-slate-800">{fmt(stats.patient_zone_mean)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Moyenne cerveau (atlas) — Patient</dt>
            <dd className="font-mono font-semibold text-slate-800">{fmt(stats.patient_brain_mean)}</dd>
          </div>
          {stats.reference_zone_mean != null && (
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Moyenne zone — {referenceLabel}</dt>
              <dd className="font-mono font-semibold text-slate-800">{fmt(stats.reference_zone_mean)}</dd>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-slate-400 pt-1">
            Les sommes brutes ci-dessous additionnent tous les voxels de la zone : elles dépendent fortement
            du réglage logiciel et ne sont en général pas comparables entre le patient recalé et l&apos;archive
            « sujet1 », d&apos;où l&apos;écart énorme si vous ne regardez que ces lignes.
          </p>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Somme intensités — Patient</dt>
            <dd className="font-mono font-semibold text-slate-800">{fmt(stats.somme_patient)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Somme intensités — {referenceLabel}</dt>
            <dd className="font-mono font-semibold text-slate-800">{fmt(stats.somme_reference)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Différence (sommes brutes)</dt>
            <dd className={`font-mono font-semibold ${diffColor}`}>{fmt(stats.difference)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Ratio sommes brutes</dt>
            <dd className="font-mono font-semibold text-slate-800">
              {stats.ratio_percent == null
                ? '— (réf. nulle)'
                : `${fmt(stats.ratio_percent)} %`}
            </dd>
          </div>
          {stats.n_voxels != null && (
            <p className="text-[10px] text-slate-400">Voxels dans la zone (patient) : {stats.n_voxels.toLocaleString('fr-FR')}</p>
          )}
        </dl>
      )}
    </div>
  );
}
