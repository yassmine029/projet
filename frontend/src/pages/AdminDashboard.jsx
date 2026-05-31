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
  Search,
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
  
  // États pour la recherche et les notifications
  const [searchQuery, setSearchQuery] = useState('');
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
    specialty: '',
    grade: '',
    telephone: '',
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
      specialty: '',
      grade: '',
      telephone: '',
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/40 border border-slate-100/50 hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-1">
              {/* Glossy Overlay */}
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-slate-50 transition-transform duration-700 group-hover:scale-[3]" />
              
              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-between">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.iconClass.replace('text-', 'bg-').replace('blue-600', 'blue-50').replace('emerald-600', 'emerald-50').replace('rose-600', 'rose-50').replace('purple-600', 'purple-50')} ${s.iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>BrainCore</span>
                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                </div>

                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</p>
                <h3 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</h3>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                     ↑ {s.delta || '+12%'}
                   </div>
                   <span className="text-[10px] text-slate-400">vs mois dernier</span>
                </div>
              </div>

              {/* Decorative line */}
              <div className="absolute bottom-0 left-0 h-1 w-0 bg-blue-600 transition-all duration-500 group-hover:w-full" />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* 2. Professional Network Distribution */}
        <div className="xl:col-span-4 rounded-2xl bg-slate-900 p-6 shadow-xl shadow-slate-900/10 text-white relative overflow-hidden group">
          <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-blue-600/10 blur-[80px]" />
          
          <div className="relative z-10">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-[0.25em] mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Audience</p>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Réseau Praticiens</h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                 <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>

            <div className="space-y-5">
              {audienceSegments.map((seg) => (
                <div key={seg.label} className="group/item">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300 group-hover/item:text-white transition-colors">{seg.label}</span>
                    <span className="text-sm font-black text-blue-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{seg.percent}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(37,99,235,0.3)] ${seg.color.replace('bg-', 'bg-')}`} 
                      style={{ width: `${Math.max(seg.percent, 3)}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <button className="mt-12 w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
               Exporter le Mapping
            </button>
          </div>
        </div>

        {/* 3. Analytics Growth Chart */}
        <div className="xl:col-span-8 rounded-[3rem] bg-white p-10 shadow-2xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Performance</p>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Croissance des Analyses</h3>
              </div>
              <div className="flex gap-4">
                 <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                       <span className="h-3 w-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Segmentation</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="h-3 w-3 rounded-full border-2 border-slate-300" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Recalage</span>
                    </div>
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

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                      <Zap className="h-4 w-4" />
                   </div>
                   <div>
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Optimisation IA active</p>
                      <p className="text-[10px] text-slate-400">Temps de traitement moyen : 4.2s</p>
                   </div>
                </div>
                <button className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 uppercase tracking-wider hover:border-blue-400 hover:text-blue-600 transition-all" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Détails</button>
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
          className="group flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-xs font-black text-white hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 hover:shadow-blue-500/20 active:scale-95 uppercase tracking-widest"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <UserPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
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
        <div className="rounded-[2.5rem] bg-amber-50/50 border-2 border-dashed border-amber-200 p-6 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {pendingAccounts.length} Validation{pendingAccounts.length > 1 ? 's' : ''} en attente
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAccounts.map((a) => (
              <div key={`pending-${a.user_id}`} className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-lg shadow-inner" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                     {(a.full_name || a.username || '?').charAt(0).toUpperCase()}
                   </div>
                   <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 leading-tight truncate">{a.full_name || a.username}</p>
                      <p className="text-[11px] text-slate-400 font-bold truncate mt-0.5">{a.email}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Spécialité</p>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{a.specialty || 'Non précisé'}</p>
                   </div>
                   <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Matricule</p>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{a.order_number || 'En attente'}</p>
                   </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleApprove(a.user_id)}
                    disabled={isProcessingDecision}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => openRejectModal(a.user_id, a.full_name || a.username)}
                    disabled={isProcessingDecision}
                    className="flex-1 py-3 px-4 rounded-xl bg-white border border-rose-200 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Accounts Table */}
      <div className="rounded-[3rem] bg-white shadow-2xl shadow-slate-200/50 border border-slate-100/60 overflow-hidden">
        {accountsError ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <h4 className="text-lg font-black text-slate-900 mb-2">Erreur de chargement</h4>
            <p className="text-sm text-slate-400 max-w-sm font-medium mb-8">{accountsError}</p>
            <button onClick={() => void reloadAccounts()} className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
              Tenter une reconnexion
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <Users className="h-16 w-16 text-slate-100 mb-6" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Aucun praticien enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['Nom & Profil', 'Grade', 'Spécialité', 'Statut', 'Dernière Session', 'Actions'].map(col => (
                    <th key={col} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accounts.map((a) => (
                  <tr key={a[0]} className="hover:bg-blue-50/30 transition-all duration-300 group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-base shadow-inner group-hover:bg-blue-100 group-hover:text-blue-600 transition-all" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {String(a[1]).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-slate-900 leading-tight">{a[1]}</p>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">{a[2]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-xs font-bold text-slate-600" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{a[3]}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-xs font-bold text-slate-400">{a[4]}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${a[7]}`}>
                        {a[5]}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{a[6]}</p>
                    </td>
                    <td className="px-8 py-6">
                       <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all group-hover:shadow-lg">
                          <Eye className="h-4 w-4" />
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
        <div className="rounded-[2.5rem] bg-amber-50/50 border-2 border-dashed border-amber-200 p-8 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {pendingTestimonials.length} Témoignage{pendingTestimonials.length > 1 ? 's' : ''} à modérer
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingTestimonials.map((t) => (
              <div key={`pending-testimonial-${t.id}`} className="bg-white p-6 rounded-[2rem] border border-amber-100 shadow-xl shadow-amber-900/5 flex flex-col gap-6 relative group overflow-hidden">
                <div className="flex-1 relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-[13px] font-black text-slate-900">{t.name}</p>
                    {t.role && (
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {t.role}
                      </span>
                    )}
                  </div>
                  <div className="relative p-5 rounded-2xl bg-slate-50/50 border border-slate-50 italic text-sm text-slate-600 line-clamp-4 leading-relaxed group-hover:bg-white transition-all">
                    "{t.text}"
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                       <MessageSquare className="h-8 w-8 text-slate-900 rotate-12" />
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock3 className="h-3 w-3" /> {formatDate(t.created_at)}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                  <button
                    onClick={() => handleApproveTestimonial(t.id)}
                    disabled={isProcessingTestimonialDecision}
                    className="flex-1 py-4 px-6 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => handleRejectTestimonial(t.id)}
                    disabled={isProcessingTestimonialDecision}
                    className="flex-1 py-4 px-6 rounded-2xl bg-white border border-rose-200 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-50 transition-all disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
                
                <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-amber-500/10 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[3rem] bg-white shadow-2xl shadow-slate-200/50 border border-slate-100/60 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
           <h3 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Archives Témoignages</h3>
        </div>
        
        {testimonials.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <MessageSquare className="h-16 w-16 text-slate-100 mb-6" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Aucune archive disponible</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['Emetteur', 'Rôle', 'Message Statut', 'Dates Actions'].map(col => (
                    <th key={col} className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {testimonials.map((t) => (
                  <tr key={`testimonial-${t.id}`} className="hover:bg-blue-50/30 transition-all duration-300 group">
                    <td className="px-8 py-6">
                      <p className="text-[13px] font-black text-slate-900 leading-tight">{t.name}</p>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t.role || 'Citoyen'}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest self-start ${String(t.status) === 'approved' ? 'bg-emerald-100 text-emerald-700' : String(t.status) === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {String(t.status) === 'approved' ? 'Diffusion Publique' : String(t.status) === 'rejected' ? 'Refusé' : 'Modération'}
                        </span>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1 italic max-w-xs pr-4 group-hover:line-clamp-none transition-all">"{t.text}"</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soumis: {formatDate(t.created_at)}</p>
                        {t.reviewed_at && <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Traité: {formatDate(t.reviewed_at)}</p>}
                      </div>
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

      <div className="rounded-[3rem] bg-white shadow-2xl shadow-slate-200/50 border border-slate-100/60 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Audit Feed</span>
           </div>
        </div>
        
        <div className="divide-y divide-slate-50">
          {(historyData?.items || []).length === 0 ? (
            <div className="p-40 text-center flex flex-col items-center">
               <Database className="h-16 w-16 text-slate-100 mb-6" />
               <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Aucune donnée dans le journal</p>
            </div>
          ) : (historyData?.items || []).map((t, idx) => {
            const Icon = t.icon || Clock3;
            return (
              <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-10 py-8 hover:bg-slate-50/80 transition-all duration-300 group">
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16 rounded-[2rem] bg-white shadow-xl shadow-slate-900/5 flex items-center justify-center text-slate-900 border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:rotate-6">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-black text-slate-900 leading-tight mb-1">{t.user || 'Processus Système'}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t.action || 'Opération Trace'}</p>
                    <div className="mt-3 flex items-center gap-3">
                       <span className="text-[10px] text-slate-400 font-black tracking-widest flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> {formatDate(t.date)}</span>
                       <span className="h-1 w-1 rounded-full bg-slate-200" />
                       <span className="text-[10px] text-slate-400 font-black tracking-widest flex items-center gap-1.5"><Shield className="h-3 w-3" /> ID: #{String(t.id || idx).slice(-4)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8 self-end md:self-center">
                  <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm transform group-hover:scale-105 transition-transform ${badgeClass(t.status || 'Info')}`}>
                    {t.status || 'Success'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div>
          <h2 className="text-4xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Configuration Globale</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-500" /> Gouvernance & Sécurité BrainCore
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          className="group relative flex items-center gap-4 overflow-hidden rounded-[1.8rem] bg-slate-900 px-10 py-5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 hover:shadow-2xl hover:shadow-blue-500/20 active:scale-[0.98]"
        >
          <div className="absolute inset-x-0 bottom-0 h-1 w-full bg-blue-400/30 transition-all duration-300 group-hover:h-2" />
          <Save className="h-4 w-4 transition-transform group-hover:scale-110" />
          Sauvegarder les Protocoles
        </button>
      </div>

      {settingsSavedNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in slide-in-from-top-2 mb-8">
          <CheckCircle2 className="h-5 w-5" /> {settingsSavedNotice}
        </div>
      )}

      {/* KPI Row for Settings */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-10">
        <div className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200/40 border border-slate-100/50 group hover:border-blue-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Niveau de Risque</p>
          <p className="text-xl font-bold text-slate-900 mb-2 truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
            {adminSettingsForm.twoFactorRequired && adminSettingsForm.forceStrongPassword ? 'Minimal' : 'ProtÃ©gÃ©'}
          </p>
          <div className="flex items-center gap-2">
             <span className="h-2 w-2 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-medium text-slate-400">BasÃ© sur 2FA & Mots de passe</span>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200/40 border border-slate-100/50 group hover:border-amber-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Communication Admin</p>
          <p className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {[adminSettingsForm.emailNotifications, adminSettingsForm.pushNotifications, adminSettingsForm.weeklyDigest].filter(Boolean).length}/3
          </p>
          <div className="flex items-center gap-2">
             <span className="h-2 w-2 rounded-full bg-amber-500" />
             <span className="text-[10px] font-medium text-slate-400">Canaux de notification actifs</span>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-200/40 border border-slate-100/50 group hover:border-blue-200 transition-all">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ConformitÃ© RGPD</p>
          <p className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {adminSettingsForm.auditLogRetention && adminSettingsForm.manualAccountApproval ? 'CertifiÃ©e' : 'IntermÃ©diaire'}
          </p>
          <div className="flex items-center gap-2">
             <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
             <span className="text-[10px] font-medium text-slate-400">Rétention & Validation active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Hardware & Identity */}
        <div className="space-y-10">
          <div className="rounded-[3rem] bg-white p-10 shadow-2xl shadow-slate-200/40 border border-slate-100/50">
             <div className="flex items-center gap-4 mb-10">
                <div className="h-14 w-14 rounded-3xl bg-blue-50 flex items-center justify-center">
                   <ShieldAlert className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                   <h4 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Durcissement IdentitÃ©</h4>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ContrÃ´les Critiques</p>
                </div>
             </div>

             <div className="space-y-6">
                {[
                  { id: 'twoFactorRequired', label: 'Authentification Ã  deux facteurs (2FA)', desc: 'Exiger un code OTP pour chaque session administrative.', icon: Lock },
                  { id: 'forceStrongPassword', label: 'Mots de passe complexes', desc: 'Obligatoire: 8+ caractÃ¨res, majuscules et symboles.', icon: Shield },
                  { id: 'lockAfterInactivity', label: 'Verrouillage Session', desc: 'DÃ©connexion automatique aprÃ¨s 15 min d\'inactivitÃ©.', icon: Clock3 }
                ].map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 group">
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <p className="text-sm font-black text-slate-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    </div>
                    <label className="relative inline-flex h-8 w-14 items-center flex-shrink-0 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={adminSettingsForm[s.id]} 
                        onChange={() => updateSetting(s.id)}
                        className="peer hidden" 
                      />
                      <div className="h-full w-full rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-all peer-checked:after:translate-x-6" />
                    </label>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Communications & Governance */}
        <div className="space-y-10">
          <div className="rounded-[3rem] bg-white p-10 shadow-2xl shadow-slate-200/40 border border-slate-100/50">
             <div className="flex items-center gap-4 mb-10">
                <div className="h-14 w-14 rounded-3xl bg-slate-900 flex items-center justify-center">
                   <Bell className="h-7 w-7 text-white" />
                </div>
                <div>
                   <h4 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Flux de Signalement</h4>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Alertes & Monitoring</p>
                </div>
             </div>

             <div className="space-y-6">
                {[
                  { id: 'emailNotifications', label: 'Alertes Email High-Priority', desc: 'Notification immÃ©diate pour les erreurs critiques serveurs.', icon: Mail },
                  { id: 'manualAccountApproval', label: 'ModÃ©ration Habilitations', desc: 'Validation manuelle obligatoire pour tout nouveau compte.', icon: UserCheck },
                  { id: 'testimonialModeration', label: 'Filtrage TÃ©moignages', desc: 'Les messages ne sont publics qu\'aprÃ¨s validation admin.', icon: MessageSquare }
                ].map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 group">
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <p className="text-sm font-black text-slate-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    </div>
                    <label className="relative inline-flex h-8 w-14 items-center flex-shrink-0 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={adminSettingsForm[s.id]} 
                        onChange={() => updateSetting(s.id)}
                        className="peer hidden" 
                      />
                      <div className="h-full w-full rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-all peer-checked:after:translate-x-6" />
                    </label>
                  </div>
                ))}
             </div>
          </div>

          <div className="rounded-[3rem] bg-slate-900 p-10 shadow-2xl shadow-slate-900/50 text-white overflow-hidden relative group">
             <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-blue-600/20 blur-[60px]" />
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">SantÃ© SystÃ¨me</h4>
                   <p className="text-xl font-black" style={{ fontFamily: "'Playfair Display', serif" }}>Infrastructure Stable</p>
                </div>
                <div className="h-12 w-12 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
                   <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
                </div>
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
            <div className="p-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
              <div className="h-12 w-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronisation Support...</p>
            </div>
          ) : reclamationsError ? (
            <div className="p-20 text-center flex flex-col items-center bg-white rounded-[3rem] border border-slate-100">
               <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center mb-6">
                 <AlertTriangle className="h-8 w-8 text-rose-500" />
               </div>
               <h4 className="text-lg font-black text-slate-900 mb-2">Service Indisponible</h4>
               <p className="text-sm text-slate-400 max-w-sm font-medium">{reclamationsError}</p>
            </div>
          ) : recs.length > 0 ? recs.map((c) => {
            const statusLabel = c.etat === 'validee' ? 'Résolu' : c.etat === 'non_validee' ? 'Fermé' : 'Ouvert';
            const statusClass = c.etat === 'validee'
              ? 'bg-emerald-500 text-white'
              : c.etat === 'non_validee'
                ? 'bg-rose-500 text-white'
                : 'bg-amber-500 text-white';
            
            const prioriteClass = c.priorite === 'critique' || c.priorite === 'haute'
              ? 'bg-rose-50 text-rose-700 border-rose-100'
              : 'bg-slate-50 text-slate-600 border-slate-100';

            const doctorName = c?.user_info?.first_name || c?.user_info?.last_name
              ? `${c.user_info?.first_name || ''} ${c.user_info?.last_name || ''}`.trim()
              : c?.user_info?.username || 'Praticien';

            return (
              <div key={c.id} className="group relative bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40 hover:shadow-blue-900/5 transition-all duration-500 overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8 relative z-10">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                      <div className={`px-4 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${prioriteClass}`}>
                        {c.priorite || 'Priorité Normale'}
                      </div>
                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${statusClass}`}>
                        {statusLabel}
                      </div>
                      <span className="text-[10px] font-black text-slate-300 ml-auto tracking-tighter" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        REF: #{c.numero || c.id}
                      </span>
                    </div>

                    <h4 className="text-xl font-black text-slate-900 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {c.categorie || 'Incident Technique'}
                    </h4>
                    
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-50 text-sm text-slate-600 leading-relaxed mb-6 italic">
                      "{c.description}"
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                          {doctorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <p className="text-xs font-black text-slate-900">{doctorName}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auteur</p>
                        </div>
                      </div>
                      
                      <div className="h-8 w-px bg-slate-100 hidden md:block" />

                      <div className="flex items-center gap-2 text-slate-400 uppercase tracking-tighter font-black text-[10px]">
                        <Calendar className="h-4 w-4" /> {formatDate(c.date)}
                      </div>

                      {c.fichier_url && (
                        <a href={c.fichier_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                          <Eye className="h-3 w-3" /> Pièce Jointe
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-3 justify-end items-end">
                    <button
                      disabled={c.etat !== 'en_attente'}
                      onClick={() => handleReclamationDecision(c.id, 'validee')}
                      className="w-full md:w-32 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-20 transition-all shadow-xl shadow-slate-900/10"
                    >
                      Résoudre
                    </button>
                    <button
                      disabled={c.etat !== 'en_attente'}
                      onClick={() => handleReclamationDecision(c.id, 'non_validee')}
                      className="w-full md:w-32 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 disabled:opacity-20 transition-all"
                    >
                      Classer
                    </button>
                  </div>
                </div>
                
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-slate-50/50 to-transparent pointer-events-none" />
              </div>
            );
          }) : (
            <div className="p-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
               <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-8">
                 <CheckCircle2 className="h-10 w-10 text-emerald-500" />
               </div>
               <h4 className="text-xl font-black text-slate-900 mb-2">Boîte de réception vide</h4>
               <p className="text-sm text-slate-400 font-medium">Félicitations, aucun incident n'est actuellement en attente.</p>
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
           <div className="w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 my-8">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h4 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Nouveau Praticien</h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Onboarding Direct BrainCore</p>
                </div>
                <button 
                  onClick={() => setCreateModalOpen(false)}
                  className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom Patronyme *</label>
                  <input
                    value={createForm.nom}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, nom: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, nom: '' }));
                    }}
                    className={`w-full rounded-2xl border p-4 text-sm font-bold transition-all ${createFieldErrors.nom ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="ex: Ben Ali"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prénom *</label>
                  <input
                    value={createForm.prenom}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, prenom: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, prenom: '' }));
                    }}
                    className={`w-full rounded-2xl border p-4 text-sm font-bold transition-all ${createFieldErrors.prenom ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="ex: Ahmed"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Numéro d'Ordre National *</label>
                  <input
                    value={createForm.orderNumber}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, orderNumber: e.target.value.toUpperCase() }));
                      setCreateFieldErrors((prev) => ({ ...prev, orderNumber: '' }));
                    }}
                    className={`w-full rounded-2xl border p-4 text-sm font-bold transition-all ${createFieldErrors.orderNumber ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="Ex: 5678 ou T-5678"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Professionnel *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, email: e.target.value }));
                      setCreateFieldErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    className={`w-full rounded-2xl border p-4 text-sm font-bold transition-all ${createFieldErrors.email ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-400'}`}
                    placeholder="medecin@visionmed.tn"
                  />
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
                      className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 backdrop-blur-xl shadow-2xl ${showNotifications ? 'bg-white border-white scale-95' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                    >
                      <Bell className="h-6 w-6" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-4 ring-slate-900/10 shadow-lg shadow-rose-500/40">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 mt-6 w-96 origin-top-right rounded-[2.5rem] border border-slate-200/60 bg-white/95 backdrop-blur-2xl p-3 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] ring-1 ring-black/5 z-50 animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Notifications</span>
                          <button className="text-[10px] bg-slate-100 px-3 py-1.5 rounded-full text-slate-500 font-bold hover:bg-blue-600 hover:text-white transition-all uppercase tracking-wider">Tout effacer</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto py-2 pr-1 no-scrollbar">
                           {[
                              { title: 'Comptes en attente', desc: `${pendingAccounts.length} médecin(s) attendent une validation immédiate.`, time: 'Maintenant', icon: UserPlus, color: 'text-blue-600 bg-blue-50', priority: 'High' },
                              { title: 'Témoignages récents', desc: `${pendingTestimonials.length} nouveaux messages à modérer dans le flux public.`, time: '12 min', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50', priority: 'Medium' },
                              { title: 'Alerte Système', desc: 'Maintenance hebdomadaire prévue ce dimanche à 02:00.', time: '2h', icon: Shield, color: 'text-purple-600 bg-purple-50', priority: 'Low' },
                           ].map((n, i) => (
                             <div key={i} className="px-5 py-4 hover:bg-slate-50/80 rounded-[1.8rem] cursor-pointer transition-all group/item border-b border-slate-50 last:border-0 flex gap-4 items-start">
                               <div className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/item:scale-110 ${n.color}`}>
                                 <n.icon className="h-5 w-5" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-0.5">
                                   <p className="text-[13px] font-bold text-slate-900">{n.title}</p>
                                   <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md tracking-tighter">{n.priority}</span>
                                 </div>
                                 <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 pr-2">{n.desc}</p>
                                 <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> {n.time}</p>
                               </div>
                             </div>
                           ))}
                        </div>
                        <div className="p-3">
                          <button className="w-full py-4 rounded-[1.5rem] bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]">
                            Accéder au centre historique
                          </button>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>

          {/* Navigation & Search Sub-Header */}
          <div className="mb-10 rounded-[2.5rem] bg-white/70 backdrop-blur-2xl border border-white/50 p-3 shadow-2xl shadow-slate-200/50 flex flex-col xl:flex-row items-center justify-between gap-6 transition-all hover:bg-white/90">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto px-2">
              {[
                { to: '/admin', icon: Database, label: 'Général', end: true },
                { to: '/admin/comptes', icon: Users, label: 'Comptes' },
                { to: '/admin/temoignages', icon: MessageSquare, label: 'Témoignages' },
                { to: '/admin/reclamations', icon: MessageSquareWarning, label: 'Réclamations' },
                { to: '/admin/historique', icon: Clock3, label: 'Audit Log' },
                { to: '/admin/parametres', icon: Lock, label: 'Sécurité' },
              ].map((link) => (
                <NavLink 
                  key={link.to}
                  to={link.to} 
                  end={link.end}
                  className={({ isActive }) => `flex items-center gap-3 px-6 py-4 rounded-[1.8rem] text-sm font-bold transition-all duration-300 relative group shrink-0 ${isActive ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  <link.icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110`} />
                  <span className="tracking-tight">{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="w-full xl:w-96 px-2">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-white/50 border border-slate-200/60 rounded-[1.8rem] text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all font-medium placeholder:text-slate-400"
                />
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
