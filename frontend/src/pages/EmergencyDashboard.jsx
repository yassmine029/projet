import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, LogOut, Lock, ArrowRight, Activity, GitMerge, Clock, ShieldCheck, Hourglass, Sparkles, Zap } from 'lucide-react'

export default function EmergencyDashboard({ user, onLogout }) {
  const navigate = useNavigate()

  const clean = (s) => (s || '').trim().replace(/\d+$/, '').trim()
  const capitalize = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : ''
  const firstName = capitalize(clean(user?.first_name || user?.prenom || ''))
  const lastName  = capitalize(clean(user?.last_name  || user?.nom   || ''))
  const doctorName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : clean(user?.fullName || user?.full_name) || 'Médecin'

  const sessionMax   = parseInt(sessionStorage.getItem('emergency_max') || '10', 10)
  const sessionUsed  = parseInt(sessionStorage.getItem('emergency_count') || '1', 10)
  const sessionBarPct = Math.min(100, Math.round((sessionUsed / sessionMax) * 100))

  const tools = [
    {
      id: 'segmentation',
      axis: 'AXE CLINIQUE 1',
      title: 'Segmentation hippocampique',
      description: 'Détection automatique gauche/droite par apprentissage profond. Volumes, asymétrie et visualisation sur IRM cérébrales.',
      stats: [
        { value: '94%',          label: 'Précision'    },
        { value: '<2 min',       label: 'Traitement'   },
        { value: 'DICOM / NIfTI',label: 'Format'       },
      ],
      icon: Activity,
      iconBg: 'bg-blue-600',
      iconShadow: 'shadow-blue-400/40',
      axisBg: 'bg-blue-50 text-blue-700 border-blue-100',
      topBar: 'from-blue-500 to-cyan-400',
      action: () => navigate('/segmentation/nouvelle'),
    },
    {
      id: 'recalage',
      axis: 'AXE CLINIQUE 2',
      title: "Recalage d'images multimodal",
      description: "Fusion intelligente IRM/PET et alignement en espace MNI152. Superposition des modalités pour un diagnostic précis.",
      stats: [
        { value: 'IRM/PET',  label: 'Modalités' },
        { value: 'MNI152',   label: 'Espace'    },
        { value: 'MINE 3D',  label: 'Méthode'   },
      ],
      icon: GitMerge,
      iconBg: 'bg-teal-600',
      iconShadow: 'shadow-teal-400/40',
      axisBg: 'bg-teal-50 text-teal-700 border-teal-100',
      topBar: 'from-teal-500 to-emerald-400',
      action: () => navigate('/registration'),
    },
  ]

  const locked = [
    'Tableau de bord patients',
    'Historique des analyses',
    'Téléchargement résultats',
    'Rapports PDF signés',
    'Dossiers patients',
    'Reconstruction 3D',
  ]

  return (
    <div className="min-h-screen bg-[#eef2f9] font-sans">

      {/* Ligne rouge urgence */}
      <div className="h-[3px] w-full bg-gradient-to-r from-red-600 via-red-400 to-orange-400" />

      {/* ── HEADER ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/70 px-8 h-[58px] flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-md shadow-red-600/30">
            <Brain className="w-[17px] h-[17px] text-white" />
          </div>
          <span className="text-[16px] font-extrabold text-slate-900 tracking-tight">NeuroScan</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="text-[13px] font-semibold text-slate-400">Console Urgence</span>
          <div className="ml-1 flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
            <Zap className="w-3 h-3 text-red-500 fill-red-500" />
            <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.18em]">Accès urgence</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-semibold text-slate-600">Dr. {doctorName.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 rounded-full px-3.5 py-1.5 hover:border-slate-300 hover:bg-slate-50"
          >
            <Clock className="w-3.5 h-3.5" />
            Terminer la session
          </button>
        </div>
      </header>

      {/* ── LAYOUT ── */}
      <div className="flex min-h-[calc(100vh-58px)]">

        {/* ── SIDEBAR ── */}
        <aside className="w-[300px] flex-shrink-0 p-5 space-y-4">

          {/* Statut */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Statut du compte</span>
              </div>
              <h3 className="text-[17px] font-extrabold text-slate-900 mb-2">En attente de validation</h3>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                L'administrateur examine votre dossier. Pendant ce temps, vous pouvez explorer librement les modules cliniques en mode démo.
              </p>
            </div>

            <div className="px-5 pb-5 space-y-3">
              {/* Sessions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Sessions démo</span>
                  <span className="text-[12px] font-black text-slate-900">{sessionUsed} / {sessionMax}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all" style={{ width: `${sessionBarPct}%` }} />
                </div>
              </div>
              {/* Validation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Validation admin</span>
                  <span className="text-[11px] font-bold text-amber-600">En cours</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-[40%] rounded-full bg-gradient-to-r from-amber-400 to-orange-300 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="mx-4 mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-medium text-emerald-700">Vos données démo sont supprimées à la fin de la session.</span>
            </div>
          </div>

          {/* Verrouillés */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Fonctionnalités verrouillées</span>
            </div>
            <div className="space-y-1">
              {locked.map((f) => (
                <div key={f} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-slate-500">{f}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Verrouillé</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── CONTENU ── */}
        <main className="flex-1 px-8 py-8 overflow-y-auto">

          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-red-500" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.22em]">Mode urgence</span>
            </div>
            <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-3">
              Bienvenue,{' '}
              <span className="text-red-600">Dr. {doctorName}.</span>
            </h1>
            <p className="text-[15px] text-slate-500 max-w-2xl leading-relaxed">
              Explorez les deux axes cliniques de NeuroScan en avant-première. Ces outils fonctionnent en
              mode démo complet — vos résultats sont temporaires jusqu'à l'activation de votre compte.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <div
                  key={tool.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-[0_12px_40px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer"
                  onClick={tool.action}
                >
                  {/* Top gradient bar */}
                  <div className={`h-[3px] bg-gradient-to-r ${tool.topBar}`} />

                  <div className="p-6">
                    {/* Header card */}
                    <div className="flex items-start justify-between mb-5">
                      <span className={`text-[9px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border ${tool.axisBg}`}>
                        {tool.axis}
                      </span>
                      <div className={`w-11 h-11 rounded-2xl ${tool.iconBg} flex items-center justify-center shadow-lg ${tool.iconShadow} group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight mb-2">{tool.title}</h2>
                    <p className="text-[13px] text-slate-500 leading-relaxed mb-5">{tool.description}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      {tool.stats.map((s) => (
                        <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-2 text-center">
                          <p className="text-[13px] font-extrabold text-slate-800 leading-tight">{s.value}</p>
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer card */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[12px] font-bold text-emerald-600">Disponible en démo</span>
                      </div>
                      <button className="flex items-center gap-2 bg-slate-900 hover:bg-blue-600 text-white text-[12px] font-bold px-4 py-2 rounded-full transition-all group-hover:gap-2.5">
                        Tester maintenant
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </main>
      </div>
    </div>
  )
}
