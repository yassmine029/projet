import React, { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileText,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  MessageSquareWarning,
  Save,
  Shield,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  approveAdminAccount,
  approveAdminTestimonial,
  createAdminAccount,
  getAdminAccounts,
  getAdminAnalytics,
  getAdminHistory,
  getAdminOverview,
  getAdminTestimonials,
  rejectAdminAccount,
  rejectAdminTestimonial,
  getAdminSettings,
  updateAdminSettings,
  getReclamations,
  updateReclamation,
} from '../api';

const AFFILIATION_OPTIONS = [
  'CHU de Monastir',
  'CHU de Sfax',
  'CHU de Tunis',
  'CHU de Sousse',
  'Hôpital régional',
  'Clinique privée',
  'Université / Faculté de médecine',
  'Autre',
];

const GRADE_OPTIONS = [
  { value: 'interne', label: 'Interne' },
  { value: 'resident', label: 'Résident' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'praticien', label: 'Praticien' },
  { value: 'professeur', label: 'Professeur' },
];

const ORDER_NUMBER_REGEX = /^(?:\d{4,6}|T-\d{4,6})$/;
const PHONE_REGEX = /^[24579]\d{7}$/;

export default function Dashboard({ user, onLogout }) {
  const location = useLocation();
  const normalizedPath = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const isHome = normalizedPath === '/admin';
  const isAccounts = normalizedPath === '/admin/comptes';
  const isHistory = normalizedPath === '/admin/historique';
  const isSettings = normalizedPath === '/admin/parametres';
  const isReclamations = normalizedPath === '/admin/reclamations';
  const isTestimonials = normalizedPath === '/admin/temoignages';

  const [overviewData, setOverviewData] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [accountsError, setAccountsError] = useState('');
  const [historyData, setHistoryData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [testimonialsData, setTestimonialsData] = useState(null);
  const [reclamationsData, setReclamationsData] = useState([]);
  const [reclamationsLoading, setReclamationsLoading] = useState(false);
  const [reclamationsError, setReclamationsError] = useState('');
  
  // États pour les notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [reclamationDecisionError, setReclamationDecisionError] = useState('');
  const [reclamationConfirm, setReclamationConfirm] = useState({
    open: false,
    reclamationId: null,
    nextStatus: 'validee',
    actionLabel: 'valider',
  });
  const [rejectModal, setRejectModal] = useState({ open: false, userId: null, displayName: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [isProcessingTestimonialDecision, setIsProcessingTestimonialDecision] = useState(false);
  const [testimonialDecisionMessage, setTestimonialDecisionMessage] = useState('');
  const [testimonialDecisionError, setTestimonialDecisionError] = useState('');
  /** Si non vide, le GET témoignages a échoué (souvent 401/403 sans session staff). */
  const [testimonialsFetchError, setTestimonialsFetchError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [activationNotice, setActivationNotice] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [customAffiliation, setCustomAffiliation] = useState('');
  const [allowManualDoctorEmail, setAllowManualDoctorEmail] = useState(false);
  const [allowManualDoctorPhone, setAllowManualDoctorPhone] = useState(false);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState('');
  const [adminSettingsForm, setAdminSettingsForm] = useState({
    twoFactorRequired: true,
    forceStrongPassword: true,
    lockAfterInactivity: true,
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: false,
    criticalAlerts: true,
    manualAccountApproval: true,
    testimonialModeration: true,
    auditLogRetention: true,
  });
  const [createForm, setCreateForm] = useState({
    nom: '',
    prenom: '',
    orderNumber: '',
    email: '',
    affiliation: '',
    specialty: 'neuroradiologie',
    grade: 'praticien',
    telephone: '',
    password: '',
  });

  const focusCreateField = (field) => {
    const fieldIdMap = {
      nom: 'create-nom',
      prenom: 'create-prenom',
      orderNumber: 'create-order-number',
      telephone: 'create-telephone',
      email: 'create-email',
      affiliation: 'create-affiliation',
      customAffiliation: 'create-custom-affiliation',
    };
    const target = document.getElementById(fieldIdMap[field]);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
    if (typeof target.animate === 'function') {
      target.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 280, easing: 'ease-out' }
      );
    }
  };

  const reloadAccounts = async () => {
    try {
      const acc = await getAdminAccounts();
      setAccountsData(acc.data || null);
      setAccountsError('');
    } catch (e) {
      setAccountsError(`Erreur API (${e?.response?.status || 'réseau'}) — vérifiez que le backend Django est démarré.`);
    }
  };

  const reloadTestimonials = async () => {
    const res = await getAdminTestimonials();
    setTestimonialsData(res.data || null);
  };

  const reloadReclamations = async () => {
    setReclamationsLoading(true);
    setReclamationsError('');
    try {
      const res = await getReclamations();
      const list = Array.isArray(res?.data?.reclamations) ? res.data.reclamations : [];
      setReclamationsData(list);
    } catch (e) {
      console.error('Reclamations load failed:', e);
      setReclamationsError('Impossible de charger les reclamations.');
    } finally {
      setReclamationsLoading(false);
    }
  };

  const iconByType = {
    segmentation: Eye,
    rapport: FileText,
    fusion: Activity,
    analyse: ArrowUpRight,
  };

  const badgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('segmentation') || s.includes('actif')) return 'bg-emerald-100 text-emerald-700';
    if (s.includes('rapport') || s.includes('attente')) return 'bg-amber-100 text-amber-700';
    if (s.includes('fusion')) return 'bg-violet-100 text-violet-700';
    if (s.includes('analyse')) return 'bg-blue-100 text-blue-700';
    if (s.includes('inactif')) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  };

  const formatDate = (iso) => {
    if (!iso) return 'Jamais';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const initials = (fullName) => {
    const txt = String(fullName || '').trim();
    if (!txt) return 'NA';
    const parts = txt.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, acc, hist, setg, ana, tes, recs] = await Promise.allSettled([
          getAdminOverview(),
          getAdminAccounts(),
          getAdminHistory(),
          getAdminSettings(),
          getAdminAnalytics(),
          getAdminTestimonials(),
          getReclamations(),
        ]);
        const ovData = ov.status === 'fulfilled' ? (ov.value?.data || null) : null;
        const accData = acc.status === 'fulfilled' ? (acc.value?.data || null) : null;
        if (acc.status === 'rejected') setAccountsError(`Erreur API (${acc.reason?.response?.status || 'réseau'}) — vérifiez que le backend Django est démarré.`);
        else setAccountsError('');
        const histData = hist.status === 'fulfilled' ? (hist.value?.data || null) : null;
        const setData = setg.status === 'fulfilled' ? (setg.value?.data || null) : null;
        const anaData = ana.status === 'fulfilled' ? (ana.value?.data || null) : null;
        const tesData = tes.status === 'fulfilled' ? (tes.value?.data || null) : null;
        const recsData = recs.status === 'fulfilled' ? (recs.value?.data || null) : null;

        setOverviewData(ovData);
        setAccountsData(accData);
        setHistoryData(histData);
        setSettingsData(setData);
        setAnalyticsData(anaData);
        setTestimonialsData(tesData);
        setReclamationsData(Array.isArray(recsData?.reclamations) ? recsData.reclamations : []);
      } catch (e) {
        console.error('Admin dashboard load failed:', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!isTestimonials) return;
    void reloadTestimonials();
  }, [isTestimonials, reloadTestimonials]);

  useEffect(() => {
    if (!settingsData) return;
    setAdminSettingsForm((prev) => ({
      ...prev,
      twoFactorRequired: settingsData?.security?.two_factor_enabled ?? prev.twoFactorRequired,
      forceStrongPassword: settingsData?.security?.enforce_strong_password ?? prev.forceStrongPassword,
      lockAfterInactivity: settingsData?.security?.lock_after_inactivity ?? prev.lockAfterInactivity,
      emailNotifications: settingsData?.notifications?.email_enabled ?? prev.emailNotifications,
      pushNotifications: settingsData?.notifications?.push_enabled ?? prev.pushNotifications,
      weeklyDigest: settingsData?.notifications?.weekly_digest ?? prev.weeklyDigest,
      criticalAlerts: settingsData?.notifications?.critical_alerts ?? prev.criticalAlerts,
      manualAccountApproval: settingsData?.governance?.manual_account_approval ?? prev.manualAccountApproval,
      testimonialModeration: settingsData?.governance?.testimonial_moderation ?? prev.testimonialModeration,
      auditLogRetention: settingsData?.governance?.audit_log_retention ?? prev.auditLogRetention,
    }));
  }, [settingsData]);

  const updateSetting = (key) => {
    setAdminSettingsForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = async () => {
    try {
      await updateAdminSettings({
        security: {
          two_factor_enabled: adminSettingsForm.twoFactorRequired,
          enforce_strong_password: adminSettingsForm.forceStrongPassword,
          lock_after_inactivity: adminSettingsForm.lockAfterInactivity,
        },
        notifications: {
          email_enabled: adminSettingsForm.emailNotifications,
          push_enabled: adminSettingsForm.pushNotifications,
          weekly_digest: adminSettingsForm.weeklyDigest,
          critical_alerts: adminSettingsForm.criticalAlerts,
        },
        governance: {
          manual_account_approval: adminSettingsForm.manualAccountApproval,
          testimonial_moderation: adminSettingsForm.testimonialModeration,
          audit_log_retention: adminSettingsForm.auditLogRetention,
        },
      });
      setSettingsSavedNotice('Paramètres administrateur mis à jour.');
    } catch (e) {
      setSettingsSavedNotice('Erreur lors de la sauvegarde des paramètres.');
    }
    setTimeout(() => setSettingsSavedNotice(''), 3000);
  };

  const stats = useMemo(() => {
    const s = overviewData?.stats;
    const d = s?.deltas || {};
    const reclamationsList = Array.isArray(reclamationsData) ? reclamationsData : [];
    const openReclamations = reclamationsList.filter((r) => r.etat === 'en_attente').length;
    const reclamations = Number(s?.reclamations_ouvertes ?? openReclamations ?? 0);

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const recThisMonth = reclamationsList.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const recLastMonth = reclamationsList.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    }).length;
    const recDelta = recThisMonth - recLastMonth;
    const recDeltaLabel = recDelta > 0 ? `+${recDelta} ce mois` : recDelta < 0 ? `${recDelta} ce mois` : 'Stable ce mois';

    return [
      { label: 'Médecins actifs', value: (s?.patients_actifs ?? 0).toLocaleString('fr-FR'), delta: `+${d.patients_actifs ?? 0}% ce mois`, icon: Users, color: '#3b82f6', iconClass: 'text-blue-600 bg-blue-100' },
      { label: "Analyses effectuées", value: (s?.analyses_totales ?? 0).toLocaleString('fr-FR'), delta: `+${d.analyses_totales ?? 0} ce mois`, icon: Calendar, color: '#10b981', iconClass: 'text-emerald-600 bg-emerald-100' },
      { label: "Réclamations", value: reclamations.toLocaleString('fr-FR'), delta: recDeltaLabel, icon: MessageSquare, color: '#f59e0b', iconClass: 'text-amber-600 bg-amber-100' },
      { label: 'Disponibilité', value: `${s?.taux_precision ?? 94}%`, delta: `+${d.taux_precision ?? 0.3}% ce mois`, icon: TrendingUp, color: '#14b8a6', iconClass: 'text-teal-600 bg-teal-100' },
    ];
  }, [overviewData, historyData, reclamationsData]);

  const historyRows = useMemo(() => {
    const rows = overviewData?.activity || [];
    return rows.slice(0, 4).map((r, idx) => ({
      id: `${r.action || 'action'}-${idx}`,
      title: r.user || 'Utilisateur',
      subtitle: r.action || 'Action effectuée',
      time: formatDate(r.date),
      status: r.status || r.type || 'Info',
      statusClass: badgeClass(r.status || r.type),
      initials: initials(r.user),
    }));
  }, [overviewData]);

  const complaintsRows = useMemo(() => {
    const recList = Array.isArray(reclamationsData) ? reclamationsData : [];
    return recList.slice(0, 4).map((it, idx) => {
      const statusText = String(it?.priorite || 'normale');
      const lowered = statusText.toLowerCase();
      const severityClass = lowered.includes('critique') || lowered.includes('haute')
        ? 'bg-rose-100 text-rose-700 font-bold'
        : lowered.includes('basse')
          ? 'bg-emerald-100 text-emerald-700 font-medium'
          : 'bg-blue-100 text-blue-700 font-medium';

      return {
        id: `${it?.numero || 'reclamation'}-${idx}`,
        title: it?.categorie ? `Réclamation ${it.categorie}` : 'Réclamation',
        subtitle: it?.description || 'Détails indisponibles',
        date: formatDate(it?.date),
        severity: statusText,
        severityClass,
      };
    });
  }, [reclamationsData]);

  const unreadCount = useMemo(() => {
    const pendingAcc = Number(accountsData?.pending_count || 0);
    const recList = Array.isArray(reclamationsData) ? reclamationsData : [];
    const pendingRecs = recList.filter((r) => r.etat === 'en_attente').length;
    const testList = Array.isArray(testimonialsData?.items) ? testimonialsData.items : [];
    const pendingTes = testList.filter((t) => String(t?.status || '').toLowerCase() === 'pending').length;
    return pendingAcc + pendingRecs + pendingTes;
  }, [accountsData, reclamationsData, testimonialsData]);

  const handleReclamationDecision = (reclamationId, nextStatus) => {
    const actionLabel = nextStatus === 'validee' ? 'valider' : 'rejeter';
    setReclamationConfirm({ open: true, reclamationId, nextStatus, actionLabel });
  };

  const confirmReclamationDecision = async () => {
    const { reclamationId, nextStatus } = reclamationConfirm;
    if (!reclamationId) return;
    try {
      setReclamationDecisionError('');
      await updateReclamation(reclamationId, { etat: nextStatus });
      await reloadReclamations();
    } catch (e) {
      setReclamationDecisionError(e?.response?.data?.error || 'Erreur lors de la mise a jour de la reclamation.');
    } finally {
      setReclamationConfirm({ open: false, reclamationId: null, nextStatus: 'validee', actionLabel: 'valider' });
    }
  };

  const accounts = useMemo(() => {
    const rows = accountsData?.accounts || [];
    return rows.map((a) => [
      a.user_id || a.id, 
      a.full_name || a.username, 
      a.email, 
      a.role || 'Médecin', 
      a.order_number || '-', 
      a.status || 'Actif', 
      formatDate(a.last_login), 
      badgeClass(a.status || 'Actif')
    ]);
  }, [accountsData]);

  const pendingAccounts = useMemo(() => {
    const rows = accountsData?.accounts || [];
    return rows.filter((a) => String(a?.status || '').toLowerCase().startsWith('en attente') || a?.status === 'pending');
  }, [accountsData]);

  const testimonials = useMemo(() => {
    return Array.isArray(testimonialsData?.items) ? testimonialsData.items : [];
  }, [testimonialsData]);

  const pendingTestimonials = useMemo(() => {
    return testimonials.filter((t) => String(t?.status || '').toLowerCase() === 'pending');
  }, [testimonials]);

  const handleApprove = async (userId) => {
    try {
      setIsProcessingDecision(true);
      setDecisionError('');
      await approveAdminAccount(userId);
      setDecisionMessage('Compte accepté avec succès.');
      await reloadAccounts();
    } catch (e) {
      setDecisionError(e?.response?.data?.error || 'Erreur lors de l’acceptation du compte.');
    } finally {
      setIsProcessingDecision(false);
      setTimeout(() => setDecisionMessage(''), 3000);
    }
  };

  const openRejectModal = (userId, displayName) => {
    setRejectReason('');
    setDecisionError('');
    setRejectModal({ open: true, userId, displayName });
  };

  const openCreateModal = () => {
    setDecisionError('');
    setCreatedPassword('');
    setActivationNotice('');
    setCreateFieldErrors({});
    setCustomAffiliation('');
    setAllowManualDoctorEmail(false);
    setAllowManualDoctorPhone(false);
    setCreateForm({
      nom: '',
      prenom: '',
      orderNumber: '',
      email: '',
      affiliation: '',
      specialty: 'neuroradiologie',
      grade: 'praticien',
      telephone: '',
      password: '',
    });
    setCreateModalOpen(true);
  };

  const handleCreateAccount = async () => {
    const normalizedAffiliation =
      createForm.affiliation === 'Autre'
        ? customAffiliation.trim()
        : createForm.affiliation.trim();
    const normalizedOrderNumber = (createForm.orderNumber || '').trim().toUpperCase();
    const normalizedTelephone = (createForm.telephone || '').trim().replace(/\s+/g, '');

    const nextErrors = {};
    if (!createForm.nom.trim()) nextErrors.nom = 'Ce champ est obligatoire.';
    if (!createForm.prenom.trim()) nextErrors.prenom = 'Ce champ est obligatoire.';
    if (!normalizedOrderNumber) {
      nextErrors.orderNumber = 'Ce champ est obligatoire.';
    } else if (!ORDER_NUMBER_REGEX.test(normalizedOrderNumber)) {
      nextErrors.orderNumber = 'Format invalide: 12345 ou T-12345.';
    }
    if (!createForm.email.trim()) nextErrors.email = 'Ce champ est obligatoire.';
    if (!createForm.affiliation.trim()) {
      nextErrors.affiliation = 'Ce champ est obligatoire.';
    } else if (createForm.affiliation === 'Autre' && !customAffiliation.trim()) {
      nextErrors.customAffiliation = 'Ce champ est obligatoire.';
    }
    if (normalizedTelephone && !PHONE_REGEX.test(normalizedTelephone)) {
      nextErrors.telephone = 'Numéro tunisien invalide (ex: 22345678).';
    }

    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setDecisionError('Veuillez remplir les champs obligatoires en rouge.');
      const order = ['nom', 'prenom', 'orderNumber', 'telephone', 'email', 'affiliation', 'customAffiliation'];
      const firstInvalid = order.find((key) => nextErrors[key]);
      if (firstInvalid) focusCreateField(firstInvalid);
      return;
    }

    setDecisionError('');
    try {
      setIsProcessingDecision(true);
      setDecisionError('');
      const res = await createAdminAccount({
        nom: createForm.nom,
        prenom: createForm.prenom,
        order_number: normalizedOrderNumber,
        email: createForm.email,
        affiliation: normalizedAffiliation,
        specialty: createForm.specialty,
        grade: createForm.grade,
        telephone: normalizedTelephone,
        password: createForm.password,
      });
      setDecisionMessage(res?.data?.message || 'Compte médecin créé avec succès.');
      setCreatedPassword(res?.data?.generated_password || '');
      if (res?.data?.activation_required) {
        const expiresAt = res?.data?.activation_expires_at
          ? new Date(res.data.activation_expires_at).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          : null;
        setActivationNotice(
          expiresAt
            ? `Lien d'activation sécurisé envoyé au médecin. Expiration: ${expiresAt}.`
            : "Lien d'activation sécurisé envoyé au médecin."
        );
      } else {
        setActivationNotice('');
      }
      await reloadAccounts();
      setCreateModalOpen(false);
    } catch (e) {
      setDecisionError(e?.response?.data?.error || 'Erreur lors de la création du compte.');
    } finally {
      setIsProcessingDecision(false);
      setTimeout(() => setDecisionMessage(''), 5000);
      setTimeout(() => setActivationNotice(''), 5000);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setDecisionError('Le motif de refus est obligatoire.');
      return;
    }
    try {
      setIsProcessingDecision(true);
      setDecisionError('');
      await rejectAdminAccount(rejectModal.userId, rejectReason.trim());
      setDecisionMessage('Compte refusé avec succès.');
      setRejectModal({ open: false, userId: null, displayName: '' });
      setRejectReason('');
      await reloadAccounts();
    } catch (e) {
      setDecisionError(e?.response?.data?.error || 'Erreur lors du refus du compte.');
    } finally {
      setIsProcessingDecision(false);
      setTimeout(() => setDecisionMessage(''), 3000);
    }
  };

  const handleApproveTestimonial = async (testimonialId) => {
    try {
      setIsProcessingTestimonialDecision(true);
      setTestimonialDecisionError('');
      await approveAdminTestimonial(testimonialId);
      setTestimonialDecisionMessage('Témoignage approuvé avec succès.');
      await reloadTestimonials();
    } catch (e) {
      setTestimonialDecisionError(e?.response?.data?.error || 'Erreur lors de la validation du témoignage.');
    } finally {
      setIsProcessingTestimonialDecision(false);
      setTimeout(() => setTestimonialDecisionMessage(''), 3000);
    }
  };

  const handleRejectTestimonial = async (testimonialId) => {
    try {
      setIsProcessingTestimonialDecision(true);
      setTestimonialDecisionError('');
      await rejectAdminTestimonial(testimonialId);
      setTestimonialDecisionMessage('Témoignage rejeté.');
      await reloadTestimonials();
    } catch (e) {
      setTestimonialDecisionError(e?.response?.data?.error || 'Erreur lors du rejet du témoignage.');
    } finally {
      setIsProcessingTestimonialDecision(false);
      setTimeout(() => setTestimonialDecisionMessage(''), 3000);
    }
  };

  const timeline = useMemo(() => {
    const rows = historyData?.items || [];
    return rows.map((i) => {
      const key = String(i.status || i.type || '').toLowerCase();
      return [
        i.title,
        i.subtitle,
        i.type,
        formatDate(i.date),
        badgeClass(key),
        iconByType[key] || Activity,
      ];
    });
  }, [historyData]);

  const audienceSegments = useMemo(() => {
    if (Array.isArray(analyticsData?.audience) && analyticsData.audience.length > 0) {
      const colorByLabel = {
        neuroradiologie: 'bg-blue-600',
        'med. nucleaire': 'bg-emerald-500',
        'médecine nucléaire': 'bg-emerald-500',
        neurologie: 'bg-amber-500',
        autres: 'bg-slate-400',
      };
      return analyticsData.audience.map((item, idx) => ({
        label: item?.label || `Segment ${idx + 1}`,
        value: Number(item?.value || 0),
        percent: Number(item?.percent || 0),
        color: colorByLabel[String(item?.label || '').toLowerCase()] || ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-400'][idx % 4],
      }));
    }

    const rows = accountsData?.accounts || [];
    const buckets = {
      neuroradiologie: 0,
      medecine_nucleaire: 0,
      neurologie: 0,
      autres: 0,
    };

    rows.forEach((a) => {
      const role = String(a?.role || '').toLowerCase();
      if (role.includes('neuroradio') || role.includes('radiologue')) {
        buckets.neuroradiologie += 1;
      } else if (role.includes('nucleaire') || role.includes('nucl')) {
        buckets.medecine_nucleaire += 1;
      } else if (role.includes('neuro')) {
        buckets.neurologie += 1;
      } else {
        buckets.autres += 1;
      }
    });

    const total = rows.length || 20;
    const fallback = rows.length === 0;
    const base = fallback
      ? { neuroradiologie: 9, medecine_nucleaire: 6, neurologie: 4, autres: 1 }
      : buckets;

    return [
      {
        label: 'Neuroradiologie',
        value: base.neuroradiologie,
        percent: Math.round((base.neuroradiologie / total) * 100),
        color: 'bg-blue-600',
      },
      {
        label: 'Med. nucleaire',
        value: base.medecine_nucleaire,
        percent: Math.round((base.medecine_nucleaire / total) * 100),
        color: 'bg-emerald-500',
      },
      {
        label: 'Neurologie',
        value: base.neurologie,
        percent: Math.round((base.neurologie / total) * 100),
        color: 'bg-amber-500',
      },
      {
        label: 'Autres',
        value: base.autres,
        percent: Math.max(0, 100 - Math.round(((base.neuroradiologie + base.medecine_nucleaire + base.neurologie) / total) * 100)),
        color: 'bg-slate-400',
      },
    ];
  }, [analyticsData, accountsData]);

  const usageTrend = useMemo(() => {
    if (Array.isArray(analyticsData?.usage) && analyticsData.usage.length > 0) {
      return analyticsData.usage.map((item) => ({
        month: item?.month || '-',
        segmentation: Number(item?.segmentation || 0),
        recalage: Number(item?.recalage || 0),
      }));
    }

    const rows = historyData?.items || [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = Array.from({ length: 3 }, (_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (2 - idx));
      return monthNames[d.getMonth()];
    });
    const map = labels.map((m) => ({ month: m, segmentation: 0, recalage: 0 }));
    const monthIdx = Object.fromEntries(labels.map((m, i) => [m.toLowerCase(), i]));

    rows.forEach((it) => {
      const d = new Date(it?.date);
      if (Number.isNaN(d.getTime())) return;
      const short = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toLowerCase();
      const idx = monthIdx[short];
      if (idx === undefined) return;
      const txt = `${it?.title || ''} ${it?.subtitle || ''} ${it?.type || ''}`.toLowerCase();
      if (txt.includes('segmentation')) map[idx].segmentation += 1;
      if (txt.includes('recalage') || txt.includes('fusion')) map[idx].recalage += 1;
    });

    const hasData = map.some((m) => m.segmentation > 0 || m.recalage > 0);
    return hasData
      ? map
      : map;
  }, [analyticsData, historyData]);

  const usageWindowText = useMemo(() => {
    const months = Number(analyticsData?.usage_window_months || usageTrend.length || 1);
    if (months <= 1) return 'Ce mois';
    return `${months} derniers mois`;
  }, [analyticsData, usageTrend]);

  const systemHealth = useMemo(() => {
    if (analyticsData?.health) {
      const health = analyticsData.health;
      const healthyOpsValue = Number(health?.healthy_ops ?? health?.healthyOps ?? 98.0);
      return {
        availability: Number(health?.availability ?? 98.7),
        healthyOps: healthyOpsValue,
        incidents: Number(health?.incidents ?? 0),
        openComplaints: Number(health?.open_complaints ?? health?.openComplaints ?? 0),
        statusLabel: health?.status || (healthyOpsValue >= 97 ? 'Stable' : healthyOpsValue >= 94 ? 'Sous surveillance' : 'Action requise'),
        statusClass: healthyOpsValue >= 97 ? 'text-emerald-700 bg-emerald-100' : healthyOpsValue >= 94 ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100',
      };
    }

    const availability = Number(overviewData?.stats?.taux_precision ?? 98.7);
    const incidents = (historyData?.items || []).filter((it) => {
      const txt = `${it?.title || ''} ${it?.subtitle || ''} ${it?.type || ''}`.toLowerCase();
      return txt.includes('incident') || txt.includes('erreur') || txt.includes('echec');
    }).length;
    const openComplaints = complaintsRows.length;
    const healthyOps = Math.max(92, Math.min(99.9, 100 - incidents * 0.8 - openComplaints * 0.4));

    return {
      availability: Math.max(90, Math.min(99.9, availability)),
      healthyOps: Number(healthyOps.toFixed(1)),
      incidents,
      openComplaints,
      statusLabel: healthyOps >= 97 ? 'Stable' : healthyOps >= 94 ? 'Sous surveillance' : 'Action requise',
      statusClass: healthyOps >= 97 ? 'text-emerald-700 bg-emerald-100' : healthyOps >= 94 ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100',
    };
  }, [analyticsData, overviewData, historyData, complaintsRows]);

  const repartition = overviewData?.repartition || [
    { label: 'Segmentation IRM', percent: 42 },
    { label: 'PET-Scan', percent: 28 },
    { label: 'SPECT', percent: 18 },
    { label: 'Rapports', percent: 12 },
  ];

  const renderOverview = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      {/* 1. Header Overview Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const accent = s.iconClass.includes('blue') ? '#2563eb'
            : s.iconClass.includes('emerald') ? '#059669'
            : s.iconClass.includes('rose') ? '#e11d48'
            : '#7c3aed';
          const accentBg = s.iconClass.includes('blue') ? 'rgba(37,99,235,0.07)'
            : s.iconClass.includes('emerald') ? 'rgba(5,150,105,0.07)'
            : s.iconClass.includes('rose') ? 'rgba(225,29,72,0.07)'
            : 'rgba(124,58,237,0.07)';
          return (
            <div key={s.label}
              className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
              style={{ padding: '18px 20px' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center rounded-xl w-9 h-9 shrink-0"
                  style={{ background: accentBg }}>
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <span className="flex h-1.5 w-1.5 rounded-full mt-1" style={{ background: accent, opacity: 0.7 }} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</p>
              <p className="text-2xl font-black text-slate-900 leading-none mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: accent, background: accentBg }}>
                  ↑ {s.delta || '+12%'}
                </span>
                <span className="text-[10px] text-slate-400">vs mois dernier</span>
              </div>
              <div className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full rounded-full"
                style={{ background: accent }} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* 2. Professional Network Distribution */}
        <div className="xl:col-span-4 rounded-2xl bg-slate-900 p-5 shadow-lg text-white relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-blue-500/10 blur-[60px] pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.22em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Audience</p>
                <h3 className="text-[15px] font-bold text-white mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Réseau Praticiens</h3>
              </div>
              <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <div className="space-y-3">
              {audienceSegments.map((seg) => (
                <div key={seg.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-300">{seg.label}</span>
                    <span className="text-[11px] font-black text-blue-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{seg.percent}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${seg.color}`}
                      style={{ width: `${Math.max(seg.percent, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full py-2.5 rounded-xl bg-white/8 border border-white/10 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white/15 transition-all">
              Exporter le Mapping
            </button>
          </div>
        </div>

        {/* 3. Analytics Growth Chart */}
        <div className="xl:col-span-8 rounded-2xl bg-white p-5 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Performance</p>
                <h3 className="text-[15px] font-bold text-slate-900 mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Croissance des Analyses</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Segmentation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full border border-slate-300" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Recalage</span>
                </div>
              </div>
            </div>

            {(() => {
              const hasData = usageTrend.some((m) => m.segmentation > 0 || m.recalage > 0);
              const max = Math.max(...usageTrend.map((m) => Math.max(m.segmentation, m.recalage)), 1);
              const step = 700 / Math.max(usageTrend.length - 1, 1);
              const segPoints = usageTrend.map((m, i) => `${i * step},${200 - (m.segmentation / max) * 160}`).join(' ');
              const recPoints = usageTrend.map((m, i) => `${i * step},${200 - (m.recalage / max) * 160}`).join(' ');
              const areaPath = `0,200 ${segPoints} 700,200`;
              const gridVals = [0, Math.round(max * 0.33), Math.round(max * 0.66), max];

              return (
                <div className="relative">
                  <svg viewBox="0 0 700 230" className="h-52 w-full overflow-visible">
                    <defs>
                      <linearGradient id="chartGrad2" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[200, 147, 93, 40].map((y, i) => (
                      <g key={y}>
                        <line x1="40" y1={y} x2="700" y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 3 ? '0' : '4 4'} />
                        <text x="32" y={y + 4} textAnchor="end" style={{ fill: '#94a3b8', fontSize: 9, fontFamily: "'Space Grotesk', sans-serif" }}>
                          {gridVals[3 - i]}
                        </text>
                      </g>
                    ))}

                    {hasData ? (
                      <>
                        <polygon points={`40,200 ${segPoints} 700,200`} fill="url(#chartGrad2)" />
                        <polyline points={segPoints} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={recPoints} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
                        {usageTrend.map((m, i) => {
                          const x = i * step;
                          const ys = 200 - (m.segmentation / max) * 160;
                          return (
                            <g key={m.month}>
                              <circle cx={x} cy={ys} r="4" fill="white" stroke="#2563eb" strokeWidth="2" />
                              <text x={x} y="220" textAnchor="middle" style={{ fill: '#94a3b8', fontSize: 9, fontFamily: "'Space Grotesk', sans-serif" }}>{m.month}</text>
                            </g>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <line x1="40" y1="200" x2="700" y2="200" stroke="#e2e8f0" strokeWidth="1" />
                        {usageTrend.map((m, i) => (
                          <text key={m.month} x={i * step} y="220" textAnchor="middle" style={{ fill: '#94a3b8', fontSize: 9, fontFamily: "'Space Grotesk', sans-serif" }}>{m.month}</text>
                        ))}
                        <text x="350" y="120" textAnchor="middle" style={{ fill: '#cbd5e1', fontSize: 12, fontFamily: "'Noto Sans', sans-serif" }}>Aucune analyse enregistrée sur cette période</text>
                      </>
                    )}
                  </svg>
                </div>
              );
            })()}

            <div className="mt-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Optimisation IA active</p>
                  <p className="text-[10px] text-slate-400">Temps de traitement moyen : 4.2s</p>
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide hover:border-blue-300 hover:text-blue-600 transition-all">Détails</button>
            </div>
        </div>
      </div>
    </div>
  );

  const renderAccounts = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Habilitations Médicales</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">
            {accountsData?.count ?? accounts.length} praticiens répertoriés sur la plateforme
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-blue-600 transition-all uppercase tracking-wider"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Nouveau Praticien
        </button>
      </div>

      {/* Decision Notices */}
      <div className="space-y-3">
        {decisionMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in slide-in-from-top-2">
            <CheckCircle2 className="h-5 w-5" /> {decisionMessage}
          </div>
        )}
        {decisionError && !rejectModal.open && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-700 text-sm font-bold animate-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5" /> {decisionError}
          </div>
        )}
      </div>

      {/* Pending Validation Section */}
      {pendingAccounts.length > 0 && (
        <div className="rounded-2xl bg-amber-50/60 border border-dashed border-amber-300 p-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-[11px] font-black text-amber-800 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {pendingAccounts.length} Validation{pendingAccounts.length > 1 ? 's' : ''} en attente
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingAccounts.map((a) => (
              <div key={`pending-${a.user_id}`} className="bg-white rounded-xl border border-amber-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-sm shrink-0" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {(a.full_name || a.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{a.full_name || a.username}</p>
                    <p className="text-[11px] text-slate-400 truncate">{a.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Spécialité</p>
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{a.specialty || 'Non précisé'}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Matricule</p>
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{a.order_number || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(a.user_id)} disabled={isProcessingDecision}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all disabled:opacity-50">
                    Approuver
                  </button>
                  <button onClick={() => openRejectModal(a.user_id, a.full_name || a.username)} disabled={isProcessingDecision}
                    className="flex-1 py-2 rounded-lg bg-white border border-rose-200 text-rose-500 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-50 transition-all disabled:opacity-50">
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Accounts Table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {accountsError ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">{accountsError}</p>
            <button onClick={() => void reloadAccounts()} className="px-5 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-blue-600 transition-all">
              Réessayer
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <Users className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Aucun praticien enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Nom & Profil', 'Grade', 'Spécialité', 'Statut', 'Dernière Session', ''].map(col => (
                    <th key={col} className="px-5 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accounts.map((a) => (
                  <tr key={a[0]} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {String(a[1]).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900 leading-tight">{a[1]}</p>
                          <p className="text-[11px] text-slate-400">{a[2]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] text-slate-600">{a[3]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] text-slate-500">{a[4]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${a[7]}`}>
                        {a[5]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] text-slate-400">{a[6]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderTestimonials = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Voix des Praticiens</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">
            {testimonialsData?.count ?? testimonials.length} témoignages enregistrés sur BrainCore
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {testimonialDecisionMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in slide-in-from-top-2">
            <CheckCircle2 className="h-5 w-5" /> {testimonialDecisionMessage}
          </div>
        )}
        {testimonialDecisionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-700 text-sm font-bold animate-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5" /> {testimonialDecisionError}
          </div>
        )}
      </div>

      {pendingTestimonials.length > 0 && (
        <div className="rounded-2xl bg-amber-50/60 border border-dashed border-amber-300 p-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-[11px] font-black text-amber-800 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {pendingTestimonials.length} Témoignage{pendingTestimonials.length > 1 ? 's' : ''} à modérer
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTestimonials.map((t) => (
              <div key={`pending-testimonial-${t.id}`} className="bg-white rounded-xl border border-amber-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-slate-900">{t.name}</p>
                  {t.role && (
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {t.role}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100 italic text-[12px] text-slate-600 leading-relaxed line-clamp-3">
                  "{t.text}"
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Clock3 className="h-3 w-3" /> {formatDate(t.created_at)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveTestimonial(t.id)} disabled={isProcessingTestimonialDecision}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all disabled:opacity-50">
                    Approuver
                  </button>
                  <button onClick={() => handleRejectTestimonial(t.id)} disabled={isProcessingTestimonialDecision}
                    className="flex-1 py-2 rounded-lg bg-white border border-rose-200 text-rose-500 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-50 transition-all disabled:opacity-50">
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[13px] font-semibold text-slate-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Archives Témoignages</h3>
        </div>
        {testimonials.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <MessageSquare className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Aucune archive disponible</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Emetteur', 'Rôle', 'Message', 'Statut', 'Dates'].map(col => (
                    <th key={col} className="px-5 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {testimonials.map((t) => (
                  <tr key={`testimonial-${t.id}`} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-semibold text-slate-900">{t.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] text-slate-500">{t.role || 'Citoyen'}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-[12px] text-slate-500 italic line-clamp-1 group-hover:line-clamp-none transition-all">"{t.text}"</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${String(t.status) === 'approved' ? 'bg-emerald-50 text-emerald-700' : String(t.status) === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
                        {String(t.status) === 'approved' ? 'Publié' : String(t.status) === 'rejected' ? 'Refusé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[11px] text-slate-400">{formatDate(t.created_at)}</p>
                      {t.reviewed_at && <p className="text-[10px] text-blue-400 mt-0.5">{formatDate(t.reviewed_at)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Journal d'Audit</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">Hystorique de toutes les opérations de gouvernance BrainCore</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Live Audit Feed</span>
        </div>
        <div className="divide-y divide-slate-50">
          {(historyData?.items || []).length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <Database className="h-10 w-10 text-slate-200" />
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Aucune donnée dans le journal</p>
            </div>
          ) : (historyData?.items || []).map((t, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0">
                  <Database className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900 leading-tight">{t.title || 'Processus Système'}</p>
                  <p className="text-[11px] text-slate-500">{t.subtitle || 'Opération Trace'}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDate(t.date)}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">ID #{String(t.id || idx).slice(-4)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Configuration Globale</h2>
          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-blue-500" /> Gouvernance & Sécurité BrainCore
          </p>
        </div>
        <button onClick={handleSaveSettings}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-bold text-white uppercase tracking-wider hover:bg-blue-600 transition-all">
          <Save className="h-3.5 w-3.5" /> Sauvegarder
        </button>
      </div>

      {settingsSavedNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in slide-in-from-top-2 mb-8">
          <CheckCircle2 className="h-5 w-5" /> {settingsSavedNotice}
        </div>
      )}

      {/* KPI Row for Settings */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Niveau de risque', value: adminSettingsForm.twoFactorRequired && adminSettingsForm.forceStrongPassword ? 'Minimal' : 'Protégé', dot: 'bg-emerald-500', sub: 'Basé sur 2FA & mots de passe' },
          { label: 'Notifications', value: `${[adminSettingsForm.emailNotifications, adminSettingsForm.pushNotifications, adminSettingsForm.weeklyDigest].filter(Boolean).length}/3`, dot: 'bg-amber-500', sub: 'Canaux actifs' },
          { label: 'Conformité RGPD', value: adminSettingsForm.auditLogRetention && adminSettingsForm.manualAccountApproval ? 'Certifiée' : 'Intermédiaire', dot: 'bg-blue-500', sub: 'Rétention & validation' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
            <p className="text-[15px] font-bold text-slate-900 mb-1">{k.value}</p>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${k.dot}`} />
              <span className="text-[10px] text-slate-400">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sécurité Identité */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-slate-900">Durcissement Identité</h4>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Contrôles critiques</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { id: 'twoFactorRequired', label: 'Authentification 2FA', desc: 'Code OTP requis pour chaque session.', icon: Lock },
              { id: 'forceStrongPassword', label: 'Mots de passe complexes', desc: '8+ caractères, majuscules et symboles.', icon: Shield },
              { id: 'lockAfterInactivity', label: 'Verrouillage session', desc: "Déconnexion après 15 min d'inactivité.", icon: Clock3 }
            ].map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors group">
                <div className="flex items-start gap-3 flex-1 pr-4">
                  <s.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800">{s.label}</p>
                    <p className="text-[11px] text-slate-400">{s.desc}</p>
                  </div>
                </div>
                <label className="relative inline-flex h-6 w-11 items-center flex-shrink-0 cursor-pointer">
                  <input type="checkbox" checked={adminSettingsForm[s.id]} onChange={() => updateSetting(s.id)} className="peer hidden" />
                  <div className="h-full w-full rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications & Gouvernance */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="text-[13px] font-semibold text-slate-900">Flux de Signalement</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Alertes & Monitoring</p>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { id: 'emailNotifications', label: 'Alertes Email', desc: 'Notification pour les erreurs critiques.', icon: Mail },
                { id: 'manualAccountApproval', label: 'Modération Habilitations', desc: 'Validation manuelle des nouveaux comptes.', icon: UserCheck },
                { id: 'testimonialModeration', label: 'Filtrage Témoignages', desc: "Messages publics après validation admin.", icon: MessageSquare }
              ].map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors group">
                  <div className="flex items-start gap-3 flex-1 pr-4">
                    <s.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-slate-800">{s.label}</p>
                      <p className="text-[11px] text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex h-6 w-11 items-center flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={adminSettingsForm[s.id]} onChange={() => updateSetting(s.id)} className="peer hidden" />
                    <div className="h-full w-full rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 p-4 text-white flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Santé Système</p>
              <p className="text-[14px] font-bold">Infrastructure Stable</p>
            </div>
            <div className="h-9 w-9 rounded-full border border-emerald-500/30 flex items-center justify-center">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReclamations = () => {
    const recs = Array.isArray(reclamationsData) ? reclamationsData : [];
    
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Centre de Support</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">Gérez les incidents et retours techniques du corps médical</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {reclamationDecisionError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-700 text-sm font-bold animate-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5" /> {reclamationDecisionError}
            </div>
          )}

          {reclamationsLoading ? (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100">
              <div className="h-8 w-8 border-2 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Chargement...</p>
            </div>
          ) : reclamationsError ? (
            <div className="p-12 text-center flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100">
              <AlertTriangle className="h-8 w-8 text-rose-400" />
              <p className="text-sm text-slate-500">{reclamationsError}</p>
            </div>
          ) : recs.length > 0 ? recs.map((c) => {
            const statusLabel = c.etat === 'validee' ? 'Résolu' : c.etat === 'non_validee' ? 'Fermé' : 'Ouvert';
            const statusClass = c.etat === 'validee' ? 'bg-emerald-50 text-emerald-700' : c.etat === 'non_validee' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700';
            const prioriteClass = c.priorite === 'critique' || c.priorite === 'haute' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-100';
            const doctorName = c?.user_info?.first_name || c?.user_info?.last_name
              ? `${c.user_info?.first_name || ''} ${c.user_info?.last_name || ''}`.trim()
              : c?.user_info?.username || 'Praticien';
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex flex-col md:flex-row gap-5">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${prioriteClass}`}>{c.priorite || 'Normal'}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>{statusLabel}</span>
                      <span className="text-[10px] text-slate-300 ml-auto font-mono">REF: #{c.numero || c.id}</span>
                    </div>
                    <h4 className="text-[14px] font-semibold text-slate-900 mb-2">{c.categorie || 'Incident Technique'}</h4>
                    <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-[12px] text-slate-600 italic leading-relaxed mb-3">
                      "{c.description}"
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                          {doctorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-800">{doctorName}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Auteur</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar className="h-3.5 w-3.5" /> {formatDate(c.date)}
                      </div>
                      {c.fichier_url && (
                        <a href={c.fichier_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-semibold hover:bg-blue-600 hover:text-white transition-all">
                          <Eye className="h-3 w-3" /> Pièce jointe
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 justify-end shrink-0">
                    <button disabled={c.etat !== 'en_attente'} onClick={() => handleReclamationDecision(c.id, 'validee')}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-blue-600 disabled:opacity-25 transition-all">
                      Résoudre
                    </button>
                    <button disabled={c.etat !== 'en_attente'} onClick={() => handleReclamationDecision(c.id, 'non_validee')}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 disabled:opacity-25 transition-all">
                      Classer
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-200 gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-[13px] font-semibold text-slate-700">Boîte de réception vide</p>
              <p className="text-[11px] text-slate-400">Aucun incident en attente.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderModals = () => (
    <>
      {reclamationConfirm.open && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 mb-8 mx-auto">
                 <Shield className="h-8 w-8" />
              </div>
              <h4 className="text-2xl font-black text-center text-slate-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                {reclamationConfirm.actionLabel === 'valider' ? 'Valider la résolution' : 'Classer sans suite'}
              </h4>
              <p className="text-center text-sm text-slate-500 font-medium mb-10 leading-relaxed">
                Cette décision sera notifiée au praticien concerné et archivée dans le journal d'audit BrainCore.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setReclamationConfirm({ open: false, reclamationId: null, nextStatus: 'validee', actionLabel: 'valider' })}
                  className="py-4 rounded-2xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-['Space_Grotesk']"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmReclamationDecision}
                  className="py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-900/20 font-['Space_Grotesk']"
                >
                  Confirmer
                </button>
              </div>
           </div>
         </div>
      )}

      {rejectModal.open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-600 mb-8 mx-auto">
                 <AlertTriangle className="h-8 w-8" />
              </div>
              <h4 className="text-2xl font-black text-center text-slate-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                Refuser l'Habilitation
              </h4>
              <p className="text-center text-sm text-slate-500 font-medium mb-8">
                Indiquez le motif du refus pour <span className="font-black text-slate-900">{rejectModal.displayName}</span>.
              </p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 p-5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all mb-6"
                rows={4}
                placeholder="Ex: Document d'ordre non lisible ou expiré..."
              />

              {decisionError && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100 italic">
                  {decisionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setRejectModal({ open: false, userId: null, displayName: '' }); setDecisionError(''); }}
                  className="py-4 rounded-2xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-['Space_Grotesk']"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  disabled={isProcessingDecision}
                  className="py-4 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 font-['Space_Grotesk'] disabled:opacity-50"
                >
                  Confirmer le Refus
                </button>
              </div>
           </div>
        </div>
      )}

      {createModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
            <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 my-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Nouveau Praticien</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Onboarding BrainCore</p>
                </div>
                <button 
                  onClick={() => setCreateModalOpen(false)}
                  className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom Patronyme *</label>
                  <input
                    id="create-nom"
                    value={createForm.nom}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, nom: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, nom: '' }));
                    }}
                    className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${createFieldErrors.nom ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="Ben Ali"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prénom *</label>
                  <input
                    id="create-prenom"
                    value={createForm.prenom}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, prenom: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, prenom: '' }));
                    }}
                    className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${createFieldErrors.prenom ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="Ahmed"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Numéro d'Ordre National *</label>
                  <input
                    id="create-order-number"
                    value={createForm.orderNumber}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, orderNumber: e.target.value.toUpperCase() }));
                      setCreateFieldErrors((prev) => ({ ...prev, orderNumber: '' }));
                    }}
                    className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${createFieldErrors.orderNumber ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="Ex: 5678 ou T-5678"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Professionnel *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={createForm.email}
                      id="create-email"
                      onChange={(e) => {
                        setCreateForm((p) => ({ ...p, email: e.target.value }));
                        setCreateFieldErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      className={`w-full rounded-xl border pl-10 pr-3 py-3 text-sm font-bold transition-all ${createFieldErrors.email ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                      placeholder="medecin@braincore.tn"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Grade *</label>
                  <select
                    value={createForm.grade}
                    onChange={(e) => setCreateForm((p) => ({ ...p, grade: e.target.value }))}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                  >
                    {GRADE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Spécialité *</label>
                  <select
                    value={createForm.specialty}
                    onChange={(e) => setCreateForm((p) => ({ ...p, specialty: e.target.value }))}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                  >
                    <option value="neuroradiologie">Neuroradiologie</option>
                    <option value="neurologie">Neurologie</option>
                    <option value="medecine_nucleaire">Médecine Nucléaire</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Affiliation / Institution *</label>
                  <select
                    id="create-affiliation"
                    value={createForm.affiliation}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, affiliation: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, affiliation: '', customAffiliation: '' }));
                    }}
                    className={`w-full rounded-xl border p-3 text-sm font-bold outline-none transition-all ${createFieldErrors.affiliation ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                  >
                    <option value="">Sélectionner une institution...</option>
                    {AFFILIATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                {createForm.affiliation === 'Autre' && (
                  <div className="md:col-span-2 space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Précisez l'institution *</label>
                    <input
                      id="create-custom-affiliation"
                      value={customAffiliation}
                      onChange={(e) => {
                        setCustomAffiliation(e.target.value);
                        setCreateFieldErrors((prev) => ({ ...prev, customAffiliation: '' }));
                      }}
                      className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${createFieldErrors.customAffiliation ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                      placeholder="Nom de l'hôpital ou clinique"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-slate-400">Téléphone (Optionnel)</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    id="create-telephone"
                    name="admin-telephone"
                    autoComplete="off"
                    value={createForm.telephone}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, telephone: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, telephone: '' }));
                    }}
                    className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${createFieldErrors.telephone ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="ex: 22333444"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Activation Immédiate
                  </label>
                  <input
                    type="password"
                    name="admin-password"
                    autoComplete="new-password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-xl border border-slate-100 bg-blue-50/30 p-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all placeholder:text-blue-300"
                    placeholder="Définir un mot de passe initial"
                  />
                  <p className="text-[9px] text-slate-400 px-1">Laissez vide pour envoyer un lien d'activation par email.</p>
                </div>
              </div>

              {decisionError && (
                <div className="mt-8 p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100 italic">
                  {decisionError}
                </div>
              )}

              <div className="mt-10 flex gap-4">
                 <button
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 py-5 rounded-3xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-['Space_Grotesk']"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={handleCreateAccount}
                    disabled={isProcessingDecision}
                    className="flex-1 py-5 rounded-3xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl shadow-slate-900/20 font-['Space_Grotesk'] disabled:opacity-50"
                  >
                    Générer les Accès
                  </button>
              </div>
           </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 overflow-hidden relative" style={{ fontFamily: "'Noto Sans', system-ui, sans-serif" }}>
      {renderModals()}
      
      {activationNotice && (
        <div className="fixed right-8 top-8 z-[100] w-[92vw] max-w-md rounded-[2rem] border border-blue-100 bg-white/95 p-6 shadow-[0_32px_64px_rgba(30,64,175,0.15)] backdrop-blur-xl animate-in slide-in-from-right-8 duration-500">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-500 p-3 text-white shadow-lg shadow-blue-500/20">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-slate-900 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Habilitation Envoyée</p>
              <p className="mt-1 text-sm font-medium text-slate-500 leading-relaxed">{activationNotice}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivationNotice('')}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AdminSidebar user={user} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative no-scrollbar xl:ml-60">
        
        {/* Background Hero Section */}
        <div className="absolute top-0 left-0 right-0 h-[260px] z-0 overflow-hidden">
          <img 
            src="/images/dashbord.jpeg" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-1000 grayscale-[20%] blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/40 to-[#f8fafc]" />
        </div>

        <main className="relative z-10 flex-1 p-4 md:p-6 lg:p-8 pt-10">
          {/* Header Content */}
          <div className="mb-6 px-2">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md mb-6 shadow-xl shadow-blue-500/10">
                  <Shield className="h-3.5 w-3.5 text-blue-300" />
                  <span className="text-[10px] font-black text-blue-100 uppercase tracking-[0.2em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Console Administrateur</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.01em' }}>
                  Tableau de <span className="text-blue-400">Bord</span>
                </h1>
                <p className="text-slate-300 text-sm md:text-base font-medium leading-relaxed opacity-90">
                  Supervision globale de la plateforme BrainCore. Gérez les habilitations, les retours d'expérience et maintenez l'excellence opérationnelle.
                </p>
              </div>

              <div className="flex items-center gap-3">
                 <div className="relative group">
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 backdrop-blur-xl shadow-xl ${showNotifications ? 'bg-white border-white scale-95' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-slate-900/10 shadow-md shadow-rose-500/40">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 mt-4 w-80 origin-top-right rounded-[1.5rem] border border-slate-200/60 bg-white/95 backdrop-blur-2xl p-2 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] ring-1 ring-black/5 z-50 animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
                        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Notifications</span>
                          <button className="text-[9px] bg-slate-100 px-2.5 py-1 rounded-full text-slate-500 font-bold hover:bg-blue-600 hover:text-white transition-all uppercase tracking-wider">Tout effacer</button>
                        </div>
                        <div className="max-h-[350px] overflow-y-auto py-1 pr-1 no-scrollbar">
                           {[
                              { title: 'Comptes en attente', desc: `${pendingAccounts.length} médecin(s) attendent une validation immédiate.`, time: 'Maintenant', icon: UserPlus, color: 'text-blue-600 bg-blue-50', priority: 'High' },
                              { title: 'Témoignages récents', desc: `${pendingTestimonials.length} nouveaux messages à modérer dans le flux public.`, time: '12 min', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50', priority: 'Medium' },
                              { title: 'Alerte Système', desc: 'Maintenance hebdomadaire prévue ce dimanche à 02:00.', time: '2h', icon: Shield, color: 'text-purple-600 bg-purple-50', priority: 'Low' },
                           ].map((n, i) => (
                             <div key={i} className="px-4 py-3 hover:bg-slate-50/80 rounded-2xl cursor-pointer transition-all group/item border-b border-slate-50 last:border-0 flex gap-3 items-start">
                               <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/item:scale-110 ${n.color}`}>
                                 <n.icon className="h-4 w-4" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-0.5">
                                   <p className="text-[12px] font-bold text-slate-900">{n.title}</p>
                                   <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter">{n.priority}</span>
                                 </div>
                                 <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 pr-1">{n.desc}</p>
                                 <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Clock3 className="h-2.5 w-2.5" /> {n.time}</p>
                               </div>
                             </div>
                           ))}
                        </div>
                        <div className="p-2">
                          <button className="w-full py-3 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]">
                            Centre d'historique
                          </button>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>

          {/* Dynamic Content Area */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {isHome && renderOverview()}
            {isAccounts && renderAccounts()}
            {isTestimonials && renderTestimonials()}
            {isHistory && renderHistory()}
            {isReclamations && renderReclamations()}
            {isSettings && renderSettings()}
          </div>
        </main>

        {/* Footer info */}
        <footer className="px-10 py-8 mt-12 border-t border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            BrainCore Management System v4.2.0 • 2026
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Système Opérationnel
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
