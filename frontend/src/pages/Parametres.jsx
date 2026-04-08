import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Globe,
  Grid2X2,
  Shield,
  TriangleAlert,
  Eye,
  Save,
  RotateCcw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const DEFAULT_SETTINGS = {
  langue: 'fr',
  fuseau: 'tunis',
  formatDate: 'ddmmyyyy',
  autoInterpretation: true,
  graphiquesComparatifs: true,
  anonymisationMetadonnees: false,
  presetFenetrage: 'brain-t1',
  syncMpr: true,
  interpolationBilineaire: true,
  overlaySegmentation: true,
  modeleSegmentation: 'nnunet',
  seuilConfiance: '0.80',
  zscoreAuto: true,
  notifAnalyseTerminee: true,
  notifRapportPret: true,
  notifReclamation: false,
  notifSecurite: true,
  twoFactor: false,
  dureeSession: '8h',
  verrouillageTentatives: '5',
};

const TAB_META = {
  general: {
    title: 'Parametres generaux',
    subtitle: 'Localisation de l interface et structure des rapports PDF',
  },
  viewer: {
    title: 'Visionneuse MRI',
    subtitle: 'Reglages de rendu et de synchronisation clinique DICOM',
  },
  segmentation: {
    title: 'Segmentation IA',
    subtitle: 'Parametrage des options de pre-inference pour le pipeline deep learning',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Alertes operationnelles pour analyses, rapports et securite',
  },
  security: {
    title: 'Securite',
    subtitle: 'Controle d acces et politiques de session',
  },
  danger: {
    title: 'Zone de danger',
    subtitle: 'Actions irreversibles liees a la configuration de la plateforme',
  },
};

const NAV_GROUPS = [
  {
    label: 'Plateforme',
    items: [
      { key: 'general', label: 'General', icon: Globe },
      { key: 'viewer', label: 'Visionneuse MRI', icon: Eye },
      { key: 'segmentation', label: 'Segmentation IA', icon: Grid2X2 },
    ],
  },
  {
    label: 'Compte',
    items: [
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'security', label: 'Securite', icon: Shield },
      { key: 'danger', label: 'Zone de danger', icon: TriangleAlert },
    ],
  },
];

function ToggleSwitch({ checked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[#185FA5]' : 'bg-slate-300'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function SectionCard({ icon: Icon, title, subtitle, iconClassName, children, danger = false }) {
  return (
    <section className={`${danger ? 'border border-red-200 rounded-xl overflow-hidden' : 'bg-white border border-surface-border rounded-xl overflow-hidden mb-4'}`}>
      <header className={`flex items-center gap-3 px-5 py-3.5 border-b ${danger ? 'border-red-100' : 'border-surface-border'}`}>
        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${iconClassName}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className={`text-sm font-medium ${danger ? 'text-red-700' : 'text-[#0f2346]'}`}>{title}</h3>
          <p className="text-[11px] text-gray-500">{subtitle}</p>
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 gap-4">
      <div>
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        <p className="text-[11px] leading-[1.4] text-gray-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SelectControl({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="border border-surface-border rounded-lg px-3 py-1.5 text-sm bg-white min-w-[160px] text-primary"
    >
      {children}
    </select>
  );
}

function normalizeIncoming(data) {
  if (!data || typeof data !== 'object') {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...data,
  };
}

export default function Parametres() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLocalFallback, setShowLocalFallback] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access');
        const response = await fetch('/api/settings/', {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error('settings load failed');
        }

        const data = await response.json();
        if (!mounted) return;

        setSettings(normalizeIncoming(data));
        setShowLocalFallback(false);
      } catch (_) {
        if (!mounted) return;
        setSettings(DEFAULT_SETTINGS);
        setShowLocalFallback(true);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatusMessage('');
      const token = localStorage.getItem('access');
      const response = await fetch('/api/settings/', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('settings save failed');
      }

      const data = await response.json();
      setSettings(normalizeIncoming(data));
      setStatusMessage('Parametres enregistres avec succes.');
    } catch (_) {
      setStatusMessage('Echec de sauvegarde. Veuillez reessayer.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setStatusMessage('Valeurs par defaut restaurees localement.');
  };

  const tabInfo = useMemo(() => TAB_META[activeTab] || TAB_META.general, [activeTab]);

  const renderTabContent = () => {
    if (activeTab === 'general') {
      return (
        <>
          <SectionCard
            icon={Globe}
            title="Localisation"
            subtitle="Langue, fuseau horaire et format de date"
            iconClassName="bg-blue-50 text-blue-700"
          >
            <SettingRow label="Langue de l interface" description="Langue principale affichee dans la plateforme.">
              <SelectControl value={settings.langue} onChange={(e) => updateSetting('langue', e.target.value)}>
                <option value="fr">Francais</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </SelectControl>
            </SettingRow>
            <SettingRow label="Fuseau horaire" description="Utilise pour les horodatages cliniques et les rapports.">
              <SelectControl value={settings.fuseau} onChange={(e) => updateSetting('fuseau', e.target.value)}>
                <option value="tunis">Africa/Tunis (UTC+1)</option>
                <option value="paris">Europe/Paris</option>
                <option value="utc">UTC</option>
              </SelectControl>
            </SettingRow>
            <SettingRow label="Format de date" description="Format applique a toutes les dates dans VisionMed.">
              <SelectControl value={settings.formatDate} onChange={(e) => updateSetting('formatDate', e.target.value)}>
                <option value="ddmmyyyy">JJ/MM/AAAA</option>
                <option value="mmddyyyy">MM/DD/YYYY</option>
                <option value="yyyymmdd">AAAA-MM-JJ</option>
              </SelectControl>
            </SettingRow>
          </SectionCard>

          <SectionCard
            icon={Save}
            title="Rapports PDF"
            subtitle="Options de rendu et de confidentialite"
            iconClassName="bg-emerald-50 text-emerald-700"
          >
            <SettingRow label="Interpretation textuelle automatique" description="Ajoute une section de synthese au rapport PDF.">
              <ToggleSwitch checked={settings.autoInterpretation} onToggle={() => updateSetting('autoInterpretation', !settings.autoInterpretation)} />
            </SettingRow>
            <SettingRow label="Graphiques comparatifs" description="Inclut les graphes de comparaison volumetrique.">
              <ToggleSwitch checked={settings.graphiquesComparatifs} onToggle={() => updateSetting('graphiquesComparatifs', !settings.graphiquesComparatifs)} />
            </SettingRow>
            <SettingRow label="Anonymisation des metadonnees" description="Masque automatiquement les donnees identifiantes.">
              <ToggleSwitch checked={settings.anonymisationMetadonnees} onToggle={() => updateSetting('anonymisationMetadonnees', !settings.anonymisationMetadonnees)} />
            </SettingRow>
          </SectionCard>
        </>
      );
    }

    if (activeTab === 'viewer') {
      return (
        <SectionCard
          icon={Eye}
          title="Visionneuse DICOM"
          subtitle="Reglages d affichage multiplanaire"
          iconClassName="bg-violet-50 text-violet-700"
        >
          <SettingRow label="Preset de fenetrage" description="Preset applique a l ouverture de la serie.">
            <SelectControl value={settings.presetFenetrage} onChange={(e) => updateSetting('presetFenetrage', e.target.value)}>
              <option value="brain-t1">Brain-T1</option>
              <option value="brain-t2">Brain-T2</option>
              <option value="abdomen">Abdomen</option>
              <option value="poumons">Poumons</option>
            </SelectControl>
          </SettingRow>
          <SettingRow label="Synchronisation MPR" description="Synchronise axial, coronal et sagittal.">
            <ToggleSwitch checked={settings.syncMpr} onToggle={() => updateSetting('syncMpr', !settings.syncMpr)} />
          </SettingRow>
          <SettingRow label="Interpolation bilineaire" description="Lissage des images pendant navigation et zoom.">
            <ToggleSwitch checked={settings.interpolationBilineaire} onToggle={() => updateSetting('interpolationBilineaire', !settings.interpolationBilineaire)} />
          </SettingRow>
          <SettingRow label="Superposition masque de segmentation" description="Affiche automatiquement le masque sur l image.">
            <ToggleSwitch checked={settings.overlaySegmentation} onToggle={() => updateSetting('overlaySegmentation', !settings.overlaySegmentation)} />
          </SettingRow>
        </SectionCard>
      );
    }

    if (activeTab === 'segmentation') {
      return (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800 mb-4">
            Le modele deep learning n est pas encore integre. Ces parametres s appliqueront lors de l integration ONNX.
          </div>
          <SectionCard
            icon={Grid2X2}
            title="Modele IA"
            subtitle="Parametres appliques au module de segmentation"
            iconClassName="bg-blue-50 text-blue-700"
          >
            <SettingRow label="Modele de segmentation" description="Architecture employee pour le traitement hippocampique.">
              <SelectControl value={settings.modeleSegmentation} onChange={(e) => updateSetting('modeleSegmentation', e.target.value)}>
                <option value="nnunet">nnU-Net (defaut)</option>
                <option value="swinunetr">SwinUNETR</option>
                <option value="unetpp">U-Net++</option>
              </SelectControl>
            </SettingRow>
            <SettingRow label="Seuil de confiance minimal" description="Seuil de probabilite pour valider les voxels predit.">
              <SelectControl value={settings.seuilConfiance} onChange={(e) => updateSetting('seuilConfiance', e.target.value)}>
                <option value="0.80">0.80</option>
                <option value="0.70">0.70</option>
                <option value="0.90">0.90</option>
              </SelectControl>
            </SettingRow>
            <SettingRow label="Calcul du Z-score automatique" description="Calcule automatiquement le score compare aux valeurs normatives.">
              <ToggleSwitch checked={settings.zscoreAuto} onToggle={() => updateSetting('zscoreAuto', !settings.zscoreAuto)} />
            </SettingRow>
          </SectionCard>
        </>
      );
    }

    if (activeTab === 'notifications') {
      return (
        <SectionCard
          icon={Bell}
          title="Notifications cliniques"
          subtitle="Reglages des alertes utilisateur"
          iconClassName="bg-amber-50 text-amber-700"
        >
          <SettingRow label="Analyse MRI terminee" description="Alerte lorsque la segmentation est finalisee.">
            <ToggleSwitch checked={settings.notifAnalyseTerminee} onToggle={() => updateSetting('notifAnalyseTerminee', !settings.notifAnalyseTerminee)} />
          </SettingRow>
          <SettingRow label="Rapport PDF pret" description="Notifie quand le rapport final est genere.">
            <ToggleSwitch checked={settings.notifRapportPret} onToggle={() => updateSetting('notifRapportPret', !settings.notifRapportPret)} />
          </SettingRow>
          <SettingRow label="Mise a jour d une reclamation" description="Alerte sur changements de statut des reclamations.">
            <ToggleSwitch checked={settings.notifReclamation} onToggle={() => updateSetting('notifReclamation', !settings.notifReclamation)} />
          </SettingRow>
          <SettingRow label="Alertes de securite" description="Notifie les evenements de connexion sensibles.">
            <ToggleSwitch checked={settings.notifSecurite} onToggle={() => updateSetting('notifSecurite', !settings.notifSecurite)} />
          </SettingRow>
        </SectionCard>
      );
    }

    if (activeTab === 'security') {
      return (
        <SectionCard
          icon={Shield}
          title="Acces et authentification"
          subtitle="Politiques de protection des comptes"
          iconClassName="bg-emerald-50 text-emerald-700"
        >
          <SettingRow label="Authentification 2FA" description="Demande un second facteur apres mot de passe.">
            <ToggleSwitch checked={settings.twoFactor} onToggle={() => updateSetting('twoFactor', !settings.twoFactor)} />
          </SettingRow>
          <SettingRow label="Duree de session" description="Temps maximum avant expiration automatique.">
            <SelectControl value={settings.dureeSession} onChange={(e) => updateSetting('dureeSession', e.target.value)}>
              <option value="4h">4h</option>
              <option value="8h">8h</option>
              <option value="24h">24h</option>
            </SelectControl>
          </SettingRow>
          <SettingRow label="Verrouillage apres tentatives" description="Nombre d essais avant blocage temporaire.">
            <SelectControl value={settings.verrouillageTentatives} onChange={(e) => updateSetting('verrouillageTentatives', e.target.value)}>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="10">10</option>
            </SelectControl>
          </SettingRow>
        </SectionCard>
      );
    }

    return (
      <SectionCard
        icon={TriangleAlert}
        title="Zone de danger"
        subtitle="Actions irreversibles"
        iconClassName="bg-red-50 text-red-700"
        danger
      >
        <SettingRow
          label="Reinitialiser les preferences"
          description="Revient aux parametres par defaut pour tous les onglets."
        >
          <button
            type="button"
            onClick={handleReset}
            className="border border-red-300 text-red-700 text-sm px-4 py-2 rounded-lg hover:bg-red-50"
          >
            Reinitialiser
          </button>
        </SettingRow>
        <SettingRow
          label="Supprimer la configuration distante"
          description="Supprime la configuration stockee cote serveur."
        >
          <button
            type="button"
            className="border border-red-300 text-red-700 text-sm px-4 py-2 rounded-lg hover:bg-red-50"
          >
            Supprimer
          </button>
        </SettingRow>
      </SectionCard>
    );
  };

  return (
    <div className="bg-[#f5f7ff] rounded-2xl border border-surface-border overflow-hidden min-h-[calc(100vh-10rem)]">
      <div className="flex min-h-[calc(100vh-10rem)]">
        <aside className="w-[200px] shrink-0 bg-white border-r border-surface-border">
          <nav className="px-2 py-4">
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex > 0 ? 'mt-4 pt-4 border-t border-surface-border' : ''}>
                <p className="px-3 mb-2 text-[11px] tracking-[0.06em] uppercase text-gray-400">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.key;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setActiveTab(item.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm border-l-2 transition-colors ${
                          active
                            ? 'border-l-2 border-blue-600 bg-blue-50 text-blue-600 font-medium'
                            : 'border-transparent text-gray-500 hover:bg-[#f5f7ff] hover:text-gray-800'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <section className="flex-1 overflow-y-auto px-8 py-7">
          <PageHeader
            title={tabInfo.title}
            subtitle={tabInfo.subtitle}
            actions={
              <>
                <Badge variant="info" className="text-sm font-medium">Conformite RGPD · 70%</Badge>
                <Button variant="outline" onClick={handleReset} className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reinitialiser
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </>
            }
          />
          {showLocalFallback ? (
            <p className="-mt-4 mb-4 text-xs text-gray-400">Valeurs locales affichees</p>
          ) : null}
          {statusMessage ? (
            <p className="-mt-4 mb-4 text-xs text-gray-500">{statusMessage}</p>
          ) : null}

          <div className="pt-5">
            {loading ? (
              <Card padding="lg" className="rounded-[14px]">
                <p className="text-sm text-gray-500">Chargement des parametres...</p>
              </Card>
            ) : (
              renderTabContent()
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
