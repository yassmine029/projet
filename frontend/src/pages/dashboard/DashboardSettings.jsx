import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  Eye,
  Globe,
  Lock,
  MonitorCog,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import { getUserSettings, updateUserSettings } from '../../api';

const defaultSettings = {
  general: {
    language: 'Francais',
    timezone: 'Africa/Tunis (UTC+1)',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'fr-TN',
  },
  viewer: {
    defaultPreset: 'Brain - T1',
    interpolationEnabled: true,
    autoMprSync: true,
    showOrientationLabels: true,
    enableAiOverlayByDefault: true,
    cineLoopFps: 18,
  },
  workflow: {
    autoAssignUrgentCases: true,
    enableDoubleReadForCritical: false,
    autoOpenLastStudyContext: true,
    reportTemplate: 'Neuro MRI Standard',
    defaultPriority: 'Normale',
  },
  notifications: {
    studyCompleted: true,
    aiAnomaly: true,
    pendingReports: true,
    reclamationUpdates: true,
    weeklyDigest: false,
  },
  security: {
    sessionTimeoutMinutes: 30,
    requireTwoFactor: false,
    maskPatientNameInLists: false,
    auditTrailEmail: 'nadine.hammami@braincore.tn',
  },
  integrations: {
    pacsAeTitle: 'BRAINCORE_AE',
    pacsHost: '127.0.0.1',
    pacsPort: 104,
    risEndpoint: '',
    modalityWorklistEnabled: false,
    dicomTlsEnabled: false,
  },
};

function mergeSettings(defaults, incoming = {}) {
  return {
    ...defaults,
    ...incoming,
    general: { ...defaults.general, ...(incoming.general || {}) },
    viewer: { ...defaults.viewer, ...(incoming.viewer || {}) },
    workflow: { ...defaults.workflow, ...(incoming.workflow || {}) },
    notifications: { ...defaults.notifications, ...(incoming.notifications || {}) },
    security: { ...defaults.security, ...(incoming.security || {}) },
    integrations: { ...defaults.integrations, ...(incoming.integrations || {}) },
  };
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 lg:gap-4 items-center border border-slate-100 rounded-xl p-4">
      <div>
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
      <div className="w-full lg:w-auto">{children}</div>
    </div>
  );
}

export default function DashboardSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [savedAt, setSavedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const response = await getUserSettings();
        if (!isMounted) return;
        setSettings(mergeSettings(defaultSettings, response.data));
      } catch (error) {
        if (!isMounted) return;
        setFeedback('Impossible de charger vos parametres serveur. Valeurs locales affichees.');
        setSettings(defaultSettings);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const complianceScore = useMemo(() => {
    let score = 55;
    if (settings.security.requireTwoFactor) score += 15;
    if (settings.security.maskPatientNameInLists) score += 10;
    if (settings.security.sessionTimeoutMinutes <= 30) score += 10;
    if (settings.notifications.aiAnomaly) score += 5;
    if (settings.workflow.enableDoubleReadForCritical) score += 5;
    return Math.min(100, score);
  }, [settings]);

  const update = (group, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback('');
    try {
      const response = await updateUserSettings(settings);
      setSettings(mergeSettings(defaultSettings, response.data));
      setSavedAt(new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }));
      setFeedback('Parametres synchronises avec succes.');
    } catch (error) {
      setFeedback('Echec de sauvegarde serveur. Verifiez votre session.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setSavedAt('');
    setFeedback('Valeurs remises par defaut. Cliquez sur Enregistrer pour synchroniser.');
  };

  if (isLoading) {
    return (
      <div className="max-w-[1200px]">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-slate-900 font-semibold">Chargement des parametres utilisateur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] space-y-6 pb-10">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Parametres de la plateforme</h1>
            <p className="text-slate-500 mt-1">
              Configurez votre environnement clinique, votre visionneuse MRI et vos regles de securite.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold">
              Score de conformite: {complianceScore}%
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-slate-100 text-[#334155] font-semibold hover:bg-slate-200 transition-colors"
            >
              Reinitialiser
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
        {savedAt ? <p className="text-xs text-slate-500 mt-3">Derniere sauvegarde: {savedAt}</p> : null}
        {feedback ? <p className="text-xs text-[#334155] mt-2">{feedback}</p> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard
          icon={Globe}
          title="General"
          subtitle="Langue, format d'affichage, fuseau horaire"
        >
          <Row label="Langue" hint="Langue principale de l'interface et des labels cliniques.">
            <select
              value={settings.general.language}
              onChange={(e) => update('general', 'language', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>Francais</option>
              <option>English</option>
              <option>Arabe</option>
            </select>
          </Row>

          <Row label="Fuseau horaire" hint="Utilise pour les horodatages des analyses et rapports.">
            <select
              value={settings.general.timezone}
              onChange={(e) => update('general', 'timezone', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>Africa/Tunis (UTC+1)</option>
              <option>Europe/Paris (UTC+1/+2)</option>
              <option>UTC</option>
            </select>
          </Row>

          <Row label="Format de date" hint="Format des dates dans les fiches patients et export PDF.">
            <select
              value={settings.general.dateFormat}
              onChange={(e) => update('general', 'dateFormat', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
              <option>MM/DD/YYYY</option>
            </select>
          </Row>
        </SectionCard>

        <SectionCard
          icon={Eye}
          title="Visionneuse MRI / DICOM"
          subtitle="Parametres inspires des viewers radiologiques modernes"
        >
          <Row label="Preset fenetrage par defaut" hint="Applique automatiquement a l'ouverture d'une serie.">
            <select
              value={settings.viewer.defaultPreset}
              onChange={(e) => update('viewer', 'defaultPreset', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>Brain - T1</option>
              <option>Brain - T2</option>
              <option>FLAIR Focus</option>
              <option>DWI Contrast</option>
            </select>
          </Row>

          <Row label="Synchronisation MPR" hint="Lie axial, coronal et sagittal pour la navigation croisee.">
            <Toggle checked={settings.viewer.autoMprSync} onChange={() => update('viewer', 'autoMprSync', !settings.viewer.autoMprSync)} />
          </Row>

          <Row label="Interpolation" hint="Lissage d'image pendant zoom/panoramique.">
            <Toggle checked={settings.viewer.interpolationEnabled} onChange={() => update('viewer', 'interpolationEnabled', !settings.viewer.interpolationEnabled)} />
          </Row>

          <Row label="Overlay IA par defaut" hint="Affiche automatiquement les masques de prediction si disponibles.">
            <Toggle checked={settings.viewer.enableAiOverlayByDefault} onChange={() => update('viewer', 'enableAiOverlayByDefault', !settings.viewer.enableAiOverlayByDefault)} />
          </Row>

          <Row label="Vitesse cine-loop" hint="Lecture de series dynamiques en images/seconde.">
            <input
              type="number"
              min="5"
              max="60"
              value={settings.viewer.cineLoopFps}
              onChange={(e) => update('viewer', 'cineLoopFps', Number(e.target.value) || 5)}
              className="w-full lg:w-[120px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>
        </SectionCard>

        <SectionCard
          icon={SlidersHorizontal}
          title="Workflow Clinique"
          subtitle="Organisation des cas, priorites et compte-rendus"
        >
          <Row label="Priorite par defaut" hint="Niveau applique aux nouveaux examens.">
            <select
              value={settings.workflow.defaultPriority}
              onChange={(e) => update('workflow', 'defaultPriority', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>Normale</option>
              <option>Urgente</option>
              <option>Critique</option>
            </select>
          </Row>

          <Row label="Auto-assignation cas urgents" hint="Assigne les cas urgents au radiologue de garde.">
            <Toggle checked={settings.workflow.autoAssignUrgentCases} onChange={() => update('workflow', 'autoAssignUrgentCases', !settings.workflow.autoAssignUrgentCases)} />
          </Row>

          <Row label="Double lecture cas critiques" hint="Impose une seconde validation avant cloture du rapport.">
            <Toggle checked={settings.workflow.enableDoubleReadForCritical} onChange={() => update('workflow', 'enableDoubleReadForCritical', !settings.workflow.enableDoubleReadForCritical)} />
          </Row>

          <Row label="Modele de compte-rendu" hint="Template principal pour les examens neurologiques.">
            <select
              value={settings.workflow.reportTemplate}
              onChange={(e) => update('workflow', 'reportTemplate', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            >
              <option>Neuro MRI Standard</option>
              <option>Stroke Fast Track</option>
              <option>Epilepsy Focused</option>
            </select>
          </Row>
        </SectionCard>

        <SectionCard
          icon={Bell}
          title="Notifications"
          subtitle="Alertes operationnelles et suivi activite"
        >
          <Row label="Etudes terminees" hint="Alerte quand le pipeline IA termine une etude.">
            <Toggle checked={settings.notifications.studyCompleted} onChange={() => update('notifications', 'studyCompleted', !settings.notifications.studyCompleted)} />
          </Row>

          <Row label="Anomalie IA detectee" hint="Notification immediate sur resultat suspect.">
            <Toggle checked={settings.notifications.aiAnomaly} onChange={() => update('notifications', 'aiAnomaly', !settings.notifications.aiAnomaly)} />
          </Row>

          <Row label="Rapports en attente" hint="Rappel pour les dossiers non signes apres 24h.">
            <Toggle checked={settings.notifications.pendingReports} onChange={() => update('notifications', 'pendingReports', !settings.notifications.pendingReports)} />
          </Row>

          <Row label="Mises a jour reclamations" hint="Suivi des retours utilisateurs et incidents.">
            <Toggle checked={settings.notifications.reclamationUpdates} onChange={() => update('notifications', 'reclamationUpdates', !settings.notifications.reclamationUpdates)} />
          </Row>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Confidentialite & Securite"
          subtitle="Mesures de protection des donnees patients"
        >
          <Row label="Timeout de session" hint="Fermeture automatique apres inactivite.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="180"
                value={settings.security.sessionTimeoutMinutes}
                onChange={(e) => update('security', 'sessionTimeoutMinutes', Number(e.target.value) || 5)}
                className="w-[100px] p-2.5 rounded-lg border border-slate-200 text-sm"
              />
              <span className="text-sm text-slate-500">minutes</span>
            </div>
          </Row>

          <Row label="Authentification a deux facteurs" hint="Demande une verification additionnelle a la connexion.">
            <Toggle checked={settings.security.requireTwoFactor} onChange={() => update('security', 'requireTwoFactor', !settings.security.requireTwoFactor)} />
          </Row>

          <Row label="Masquer les noms en liste" hint="Affiche des identifiants reduits dans les vues communes.">
            <Toggle checked={settings.security.maskPatientNameInLists} onChange={() => update('security', 'maskPatientNameInLists', !settings.security.maskPatientNameInLists)} />
          </Row>

          <Row label="Email audit trail" hint="Adresse recevant les journaux de securite.">
            <input
              type="email"
              value={settings.security.auditTrailEmail}
              onChange={(e) => update('security', 'auditTrailEmail', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>
        </SectionCard>

        <SectionCard
          icon={MonitorCog}
          title="Integrations PACS / RIS"
          subtitle="Connecteurs techniques pour l'ecosysteme d'imagerie"
        >
          <Row label="PACS AE Title" hint="Identifiant DICOM de cette station applicative.">
            <input
              type="text"
              value={settings.integrations.pacsAeTitle}
              onChange={(e) => update('integrations', 'pacsAeTitle', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>

          <Row label="PACS Host" hint="Adresse IP ou nom DNS du serveur PACS.">
            <input
              type="text"
              value={settings.integrations.pacsHost}
              onChange={(e) => update('integrations', 'pacsHost', e.target.value)}
              className="w-full lg:w-[230px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>

          <Row label="PACS Port" hint="Port TCP DICOM (souvent 104 ou 11112).">
            <input
              type="number"
              min="1"
              max="65535"
              value={settings.integrations.pacsPort}
              onChange={(e) => update('integrations', 'pacsPort', Number(e.target.value) || 104)}
              className="w-full lg:w-[120px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>

          <Row label="RIS Endpoint" hint="URL API RIS pour ordonnance, patient, planning et comptes-rendus.">
            <input
              type="text"
              value={settings.integrations.risEndpoint}
              onChange={(e) => update('integrations', 'risEndpoint', e.target.value)}
              className="w-full lg:w-[280px] p-2.5 rounded-lg border border-slate-200 text-sm"
            />
          </Row>

          <Row label="Modality Worklist (MWL)" hint="Active la synchronisation des worklists modalites.">
            <Toggle checked={settings.integrations.modalityWorklistEnabled} onChange={() => update('integrations', 'modalityWorklistEnabled', !settings.integrations.modalityWorklistEnabled)} />
          </Row>

          <Row label="DICOM TLS" hint="Chiffrement des echanges DICOM avec le PACS.">
            <Toggle checked={settings.integrations.dicomTlsEnabled} onChange={() => update('integrations', 'dicomTlsEnabled', !settings.integrations.dicomTlsEnabled)} />
          </Row>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3">
          <MonitorCog className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-xs text-[#94a3b8] uppercase font-bold">Integrations</p>
            <p className="text-sm font-semibold text-slate-900">PACS / RIS: pret a connecter</p>
          </div>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-xs text-[#94a3b8] uppercase font-bold">IA Clinique</p>
            <p className="text-sm font-semibold text-slate-900">Overlay + tri automatique actifs</p>
          </div>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3">
          <Timer className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-xs text-[#94a3b8] uppercase font-bold">Session</p>
            <p className="text-sm font-semibold text-slate-900">Timeout a {settings.security.sessionTimeoutMinutes} min</p>
          </div>
        </div>
      </div>

      <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 text-sm text-[#475569] flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Ces parametres sont synchronises par utilisateur via l'API et reutilisables sur plusieurs postes.
      </div>
    </div>
  );
}
