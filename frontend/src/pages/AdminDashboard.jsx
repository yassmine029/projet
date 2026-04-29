import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import {
  Activity,
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
  TrendingUp,
  UserPlus,
  Users
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

export default function Dashboard() {
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
  const [historyData, setHistoryData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [testimonialsData, setTestimonialsData] = useState(null);
  
  // États pour la recherche et les notifications
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionError, setDecisionError] = useState('');
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
    const acc = await getAdminAccounts();
    setAccountsData(acc.data || null);
    setUnreadCount(Number(acc?.data?.pending_count || 0));
  };

  const reloadTestimonials = useCallback(async () => {
    setTestimonialsFetchError('');
    try {
      const res = await getAdminTestimonials();
      setTestimonialsData(res.data || null);
    } catch (e) {
      const st = e?.response?.status;
      const msg =
        st === 401 || st === 403
          ? 'Session administrateur requise. Utilisez la connexion « administrateur » sur la page de connexion (portail avec cookie Django), pas le mode ?adminBypass seul.'
          : (e?.response?.data?.error || e?.message || 'Impossible de charger les témoignages.');
      setTestimonialsFetchError(msg);
      console.error('getAdminTestimonials failed', e);
    }
  }, []);

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
        const [ov, acc, hist, setg, ana, tes] = await Promise.allSettled([
          getAdminOverview(),
          getAdminAccounts(),
          getAdminHistory(),
          getAdminSettings(),
          getAdminAnalytics(),
          getAdminTestimonials(),
        ]);
        const ovData = ov.status === 'fulfilled' ? (ov.value?.data || null) : null;
        const accData = acc.status === 'fulfilled' ? (acc.value?.data || null) : null;
        const histData = hist.status === 'fulfilled' ? (hist.value?.data || null) : null;
        const setData = setg.status === 'fulfilled' ? (setg.value?.data || null) : null;
        const anaData = ana.status === 'fulfilled' ? (ana.value?.data || null) : null;
        const tesData = tes.status === 'fulfilled' ? (tes.value?.data || null) : null;
        if (tes.status === 'rejected') {
          const st = tes.reason?.response?.status;
          setTestimonialsFetchError(
            st === 401 || st === 403
              ? 'Session administrateur requise pour les témoignages (connectez-vous via le portail admin).'
              : (tes.reason?.response?.data?.error || tes.reason?.message || 'Impossible de charger les témoignages.')
          );
        } else {
          setTestimonialsFetchError('');
        }

        setOverviewData(ovData);
        setAccountsData(accData);
        setHistoryData(histData);
        setSettingsData(setData);
        setAnalyticsData(anaData);
        setTestimonialsData(tesData);
        setUnreadCount(Number(accData?.pending_count || 0));
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

  const handleSaveSettings = () => {
    setSettingsSavedNotice('Paramètres administrateur mis à jour localement.');
    setTimeout(() => setSettingsSavedNotice(''), 3000);
  };

  const stats = useMemo(() => {
    const s = overviewData?.stats;
    const d = s?.deltas || {};
    const reclamations = Number(s?.reclamations_ouvertes ?? (historyData?.items || []).filter((it) => String(it?.type || '').toLowerCase().includes('reclamation')).length ?? 0);
    return [
      { label: 'Médecins actifs', value: (s?.patients_actifs ?? 0).toLocaleString('fr-FR'), delta: `+${d.patients_actifs ?? 0}% ce mois`, icon: Users, iconClass: 'text-blue-600 bg-blue-100' },
      { label: "Analyses effectuées ce mois", value: (s?.analyses_totales ?? 0).toLocaleString('fr-FR'), delta: `+${d.analyses_totales ?? 0} ce mois`, icon: Calendar, iconClass: 'text-emerald-600 bg-emerald-100' },
      { label: "Demandes d'accès en attente", value: reclamations.toLocaleString('fr-FR'), delta: '-2 ce mois', icon: MessageSquare, iconClass: 'text-amber-600 bg-amber-100' },
      { label: 'Taux de disponibilité système', value: `${s?.taux_precision ?? 94}%`, delta: `+${d.taux_precision ?? 0.3}% ce mois`, icon: TrendingUp, iconClass: 'text-teal-600 bg-teal-100' },
    ];
  }, [overviewData, historyData]);

  const historyRows = useMemo(() => {
    const rows = overviewData?.activity || [];
    return rows.map((r, idx) => ({
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
    const rows = historyData?.items || [];
    const extracted = rows.filter((it) => {
      const txt = `${it?.title || ''} ${it?.subtitle || ''} ${it?.type || ''}`.toLowerCase();
      return txt.includes('reclamation') || txt.includes('incident') || txt.includes('erreur') || txt.includes('acces') || txt.includes('attente');
    }).slice(0, 4);

    return extracted.map((it, idx) => {
      const statusText = String(it?.status || it?.type || 'Moyenne');
      const lowered = statusText.toLowerCase();
      const severityClass = lowered.includes('haute')
        ? 'bg-rose-100 text-rose-700'
        : lowered.includes('basse')
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-teal-100 text-teal-700';

      return {
        id: `${it?.title || 'reclamation'}-${idx}`,
        title: it?.title || 'Réclamation',
        subtitle: it?.subtitle || 'Détails indisponibles',
        date: formatDate(it?.date),
        severity: statusText,
        severityClass,
      };
    });
  }, [historyData]);

  const accounts = useMemo(() => {
    const rows = accountsData?.accounts || [];
    return rows.map((a) => [a.id, a.full_name || a.username, a.email, a.role, a.order_number || '-', a.status, formatDate(a.last_login), badgeClass(a.status)]);
  }, [accountsData]);

  const pendingAccounts = useMemo(() => {
    const rows = accountsData?.accounts || [];
    return rows.filter((a) => String(a?.status || '').toLowerCase().startsWith('en attente'));
  }, [accountsData]);

  const testimonials = useMemo(() => {
    const rows = testimonialsData?.items || [];
    return rows;
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between">
                <p className="max-w-[170px] text-[12px] font-semibold leading-tight text-slate-500">{s.label}</p>
                <span className={`rounded-xl p-2 ${s.iconClass}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.delta || 'Données en temps réel'}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.05)] xl:col-span-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Profils des médecins actifs</h3>
              <p className="text-sm text-slate-500">Répartition par spécialité</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Cible</span>
          </div>
          <div className="space-y-3">
            {audienceSegments.map((seg) => (
              <div key={seg.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{seg.label}</span>
                  <span className="font-semibold text-slate-900">{seg.percent}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100">
                  <div className={`h-2.5 rounded-full ${seg.color}`} style={{ width: `${Math.max(seg.percent, 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.05)] xl:col-span-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Évolution des analyses</h3>
              <p className="text-sm text-slate-500">Segmentation vs Recalage </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Usage</span>
          </div>
          <div className="h-40 w-full">
            <svg viewBox="0 0 360 140" className="h-full w-full">
              <defs>
                <linearGradient id="segFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[20, 45, 70, 95, 120].map((y) => (
                <line key={y} x1="24" y1={y} x2="340" y2={y} stroke="#e2e8f0" strokeWidth="1" />
              ))}
              {(() => {
                const max = Math.max(...usageTrend.map((m) => Math.max(m.segmentation, m.recalage)), 1);
                const step = 316 / Math.max(usageTrend.length - 1, 1);
                const segPoints = usageTrend
                  .map((m, i) => `${24 + i * step},${120 - (m.segmentation / max) * 90}`)
                  .join(' ');
                const recPoints = usageTrend
                  .map((m, i) => `${24 + i * step},${120 - (m.recalage / max) * 90}`)
                  .join(' ');
                const area = `${segPoints} 340,120 24,120`;
                return (
                  <>
                    <polyline points={area} fill="url(#segFill)" stroke="none" />
                    <polyline points={segPoints} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={recPoints} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
                    {usageTrend.map((m, i) => {
                      const x = 24 + i * step;
                      const ys = 120 - (m.segmentation / max) * 90;
                      const yr = 120 - (m.recalage / max) * 90;
                      return (
                        <g key={m.month}>
                          <circle cx={x} cy={ys} r="3.5" fill="#2563eb" />
                          <circle cx={x} cy={yr} r="3" fill="#0d9488" />
                          <text x={x} y="136" textAnchor="middle" className="fill-slate-500 text-[9px]">{m.month}</text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />Segmentation</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />Recalage</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.05)] xl:col-span-3">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">État de la plateforme</h3>
              <p className="text-sm text-slate-500">Supervision en temps réel</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${systemHealth.statusClass}`}>{systemHealth.statusLabel}</span>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disponibilité</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{systemHealth.availability.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ANALYSES SANS ERREUR</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{systemHealth.healthyOps.toFixed(1)}%</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-center">
                <p className="text-[11px] font-semibold text-rose-700">Incidents</p>
                <p className="text-lg font-semibold text-rose-800">{systemHealth.incidents}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-center">
                <p className="text-[11px] font-semibold text-amber-700">Réclamations</p>
                <p className="text-lg font-semibold text-amber-800">{systemHealth.openComplaints}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
          <h3 className="mb-3 text-2xl font-semibold text-slate-900">Activité récente</h3>
          <div className="space-y-3">
            {historyRows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{row.initials}</span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{row.title}</p>
                    <p className="text-[13px] text-slate-500">{row.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.statusClass}`}>{row.status}</span>
                  <p className="mt-1 text-[12px] text-slate-500">{row.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
          <h3 className="mb-3 text-2xl font-semibold text-slate-900">Réclamations récentes</h3>
          <div className="space-y-3">
            {(complaintsRows.length ? complaintsRows : historyRows.slice(0, 4).map((r) => ({
              id: `fallback-${r.id}`,
              title: r.subtitle,
              subtitle: r.title,
              date: r.time,
              severity: 'Moyenne',
              severityClass: 'bg-teal-100 text-teal-700',
            }))).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">{item.title}</p>
                  <p className="text-[13px] text-slate-500">{item.subtitle} - {item.date}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.severityClass}`}>{item.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccounts = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Gestion des comptes</h3>
          <p className="text-sm text-slate-500">{accountsData?.count ?? accounts.length} utilisateurs enregistrés</p>
          <p className="text-xs font-semibold text-amber-700">{pendingAccounts.length} compte(s) en attente de validation</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition-transform hover:-translate-y-0.5"><UserPlus className="h-4 w-4" />+ Nouveau compte</button>
      </div>

      {decisionMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{decisionMessage}</div>
      )}
      {activationNotice && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{activationNotice}</div>
      )}
      {createdPassword && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          Mot de passe provisoire généré: <span className="font-bold">{createdPassword}</span>
        </div>
      )}
      {decisionError && !rejectModal.open && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{decisionError}</div>
      )}

      <div className="mb-5 overflow-x-auto rounded-2xl border border-amber-100">
        <table className="w-full text-left">
          <thead className="bg-amber-50 text-amber-700 text-xs uppercase tracking-[0.12em]">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Email</th>
              <th className="p-3">N° ordre</th>
              <th className="p-3">Spécialité</th>
              <th className="p-3">Affiliation</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 bg-white">
            {pendingAccounts.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={6}>Aucun compte en attente.</td>
              </tr>
            )}
            {pendingAccounts.map((a) => (
              <tr key={`pending-${a.user_id}`}>
                <td className="p-3 font-semibold text-slate-900">{a.full_name || a.username}</td>
                <td className="p-3 text-slate-600">{a.email}</td>
                <td className="p-3 text-slate-600">{a.order_number || '-'}</td>
                <td className="p-3 text-slate-600">{a.specialty || '-'}</td>
                <td className="p-3 text-slate-600">{a.affiliation || '-'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(a.user_id)}
                      disabled={isProcessingDecision}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => openRejectModal(a.user_id, a.full_name || a.username)}
                      disabled={isProcessingDecision}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Refuser
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-[0.12em]">
            <tr><th className="p-3">ID</th><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th><th className="p-3">N° ordre</th><th className="p-3">Statut</th><th className="p-3">Dernière connexion</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((a) => (
              <tr key={a[0]}>
                <td className="p-3 text-slate-500">{a[0]}</td>
                <td className="p-3 font-bold text-slate-900">{a[1]}</td>
                <td className="p-3 text-slate-600">{a[2]}</td>
                <td className="p-3 text-slate-900">{a[3]}</td>
                <td className="p-3 text-slate-700 font-medium">{a[4]}</td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${a[7].replace('400/20','100').replace('300','700')}`}>{a[5]}</span></td>
                <td className="p-3 text-slate-500">{a[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h4 className="text-lg font-semibold text-slate-900">Refuser le compte</h4>
            <p className="mt-1 text-sm text-slate-600">Compte: {rejectModal.displayName}</p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Motif (obligatoire)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              rows={4}
              placeholder="Précisez le motif du refus..."
            />
            {decisionError && (
              <p className="mt-2 text-sm font-semibold text-rose-700">{decisionError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejectModal({ open: false, userId: null, displayName: '' }); setDecisionError(''); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessingDecision}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <h4 className="text-lg font-semibold text-slate-900">Créer un nouveau compte médecin</h4>
            <p className="mt-1 text-sm text-slate-600">Onboarding direct par l’administrateur</p>
            <p className="mt-2 text-xs font-semibold text-rose-600">* Champs obligatoires</p>

            <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
            <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} aria-hidden="true" />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Nom <span className="text-rose-600">*</span></label>
                <input
                  id="create-nom"
                  value={createForm.nom}
                  onChange={(e) => {
                    setCreateForm((p) => ({ ...p, nom: e.target.value }));
                    setCreateFieldErrors((prev) => ({ ...prev, nom: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.nom ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                  placeholder="Nom"
                />
                {createFieldErrors.nom && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.nom}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Prénom <span className="text-rose-600">*</span></label>
                <input
                  id="create-prenom"
                  value={createForm.prenom}
                  onChange={(e) => {
                    setCreateForm((p) => ({ ...p, prenom: e.target.value }));
                    setCreateFieldErrors((prev) => ({ ...prev, prenom: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.prenom ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                  placeholder="Prénom"
                />
                {createFieldErrors.prenom && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.prenom}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Numéro d'ordre tunisien <span className="text-rose-600">*</span></label>
                <input
                  id="create-order-number"
                  value={createForm.orderNumber}
                  onChange={(e) => {
                    setCreateForm((p) => ({ ...p, orderNumber: e.target.value.toUpperCase() }));
                    setCreateFieldErrors((prev) => ({ ...prev, orderNumber: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.orderNumber ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                  placeholder="Ex: 12345 ou T-12345"
                />
                {createFieldErrors.orderNumber && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.orderNumber}</p>}
                <p className="mt-1 text-xs text-slate-500">Format autorisé: 4 à 6 chiffres, avec ou sans préfixe T-.</p>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Email professionnel <span className="text-rose-600">*</span></label>
                <input
                  id="create-email"
                  type="email"
                  name="doctor_email"
                  readOnly={!allowManualDoctorEmail}
                  onFocus={() => setAllowManualDoctorEmail(true)}
                  autoComplete="new-password"
                  value={createForm.email}
                  onChange={(e) => {
                    setCreateForm((p) => ({ ...p, email: e.target.value }));
                    setCreateFieldErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.email ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                  placeholder="medecin@hopital.com"
                />
                {createFieldErrors.email && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.email}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Affiliation <span className="text-rose-600">*</span></label>
                <select
                  id="create-affiliation"
                  value={createForm.affiliation}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCreateForm((p) => ({ ...p, affiliation: value }));
                    setCreateFieldErrors((prev) => ({ ...prev, affiliation: '', customAffiliation: '' }));
                    if (value !== 'Autre') {
                      setCustomAffiliation('');
                    }
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.affiliation ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                >
                  <option value="">Sélectionner</option>
                  {AFFILIATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {createFieldErrors.affiliation && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.affiliation}</p>}
              </div>
              {createForm.affiliation === 'Autre' && (
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">Préciser l'affiliation <span className="text-rose-600">*</span></label>
                  <input
                    id="create-custom-affiliation"
                    value={customAffiliation}
                    onChange={(e) => {
                      setCustomAffiliation(e.target.value);
                      setCreateFieldErrors((prev) => ({ ...prev, customAffiliation: '' }));
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.customAffiliation ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                    placeholder="Nom de l'établissement"
                  />
                  {createFieldErrors.customAffiliation && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.customAffiliation}</p>}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Spécialité (optionnel)</label>
                <select value={createForm.specialty} onChange={(e) => setCreateForm((p) => ({ ...p, specialty: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Sélectionner</option>
                  <option value="neuroradiologie">Neuroradiologie</option>
                  <option value="neurologie">Neurologie</option>
                  <option value="medecine_nucleaire">Médecine nucléaire</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Grade (optionnel)</label>
                <select
                  value={createForm.grade}
                  onChange={(e) => setCreateForm((p) => ({ ...p, grade: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner</option>
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Téléphone (optionnel)</label>
                <input
                  id="create-telephone"
                  type="tel"
                  name="doctor_phone"
                  readOnly={!allowManualDoctorPhone}
                  onFocus={() => setAllowManualDoctorPhone(true)}
                  autoComplete="new-password"
                  value={createForm.telephone}
                  onChange={(e) => {
                    setCreateForm((p) => ({ ...p, telephone: e.target.value }));
                    setCreateFieldErrors((prev) => ({ ...prev, telephone: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${createFieldErrors.telephone ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'}`}
                  placeholder="22345678"
                />
                {createFieldErrors.telephone && <p className="mt-1 text-xs font-semibold text-rose-700">{createFieldErrors.telephone}</p>}
                <p className="mt-1 text-xs text-slate-500">Format tunisien: 8 chiffres, commence par 2, 4, 5, 7 ou 9.</p>
              </div>
            </div>

            {decisionError && (
              <p className="mt-3 text-sm font-semibold text-rose-700">{decisionError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setCreateModalOpen(false); setDecisionError(''); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={isProcessingDecision}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Créer le compte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTestimonials = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Modération des témoignages</h3>
          <p className="text-sm text-slate-500">{testimonialsData?.count ?? testimonials.length} témoignage(s) enregistrés</p>
          <p className="text-xs font-semibold text-amber-700">{pendingTestimonials.length} témoignage(s) en attente de validation</p>
        </div>
      </div>

      {testimonialDecisionMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{testimonialDecisionMessage}</div>
      )}
      {testimonialDecisionError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{testimonialDecisionError}</div>
      )}
      {testimonialsFetchError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {testimonialsFetchError}
          <button
            type="button"
            onClick={() => void reloadTestimonials()}
            className="ml-3 text-blue-600 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="mb-5 overflow-x-auto rounded-2xl border border-amber-100">
        <table className="w-full text-left">
          <thead className="bg-amber-50 text-amber-700 text-xs uppercase tracking-[0.12em]">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Spécialité / Établissement</th>
              <th className="p-3">Témoignage</th>
              <th className="p-3">Date</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 bg-white">
            {pendingTestimonials.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={5}>Aucun témoignage en attente.</td>
              </tr>
            )}
            {pendingTestimonials.map((t) => (
              <tr key={`pending-testimonial-${t.id}`}>
                <td className="p-3 font-semibold text-slate-900">{t.name}</td>
                <td className="p-3 text-slate-600">{t.role}</td>
                <td className="p-3 text-slate-600 max-w-[420px]">{t.text}</td>
                <td className="p-3 text-slate-500">{formatDate(t.created_at)}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveTestimonial(t.id)}
                      disabled={isProcessingTestimonialDecision}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approuver
                    </button>
                    <button
                      onClick={() => handleRejectTestimonial(t.id)}
                      disabled={isProcessingTestimonialDecision}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Rejeter
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-[0.12em]">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Rôle</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Soumis le</th>
              <th className="p-3">Traité le</th>
              <th className="p-3">Traité par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {testimonials.map((t) => (
              <tr key={`testimonial-${t.id}`}>
                <td className="p-3 font-bold text-slate-900">{t.name}</td>
                <td className="p-3 text-slate-600">{t.role}</td>
                <td className="p-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${String(t.status) === 'approved' ? 'bg-emerald-100 text-emerald-700' : String(t.status) === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {String(t.status) === 'approved' ? 'Approuvé' : String(t.status) === 'rejected' ? 'Rejeté' : 'En attente'}
                  </span>
                </td>
                <td className="p-3 text-slate-500">{formatDate(t.created_at)}</td>
                <td className="p-3 text-slate-500">{formatDate(t.reviewed_at)}</td>
                <td className="p-3 text-slate-700">{t.reviewed_by || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Historique des activités</h3>
          <p className="text-sm text-slate-500">Suivi complet des actions sur la plateforme</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-500 flex gap-1">
          <button className="rounded-xl bg-white px-4 py-2 text-slate-900 shadow-sm">Tout</button>
          <button className="rounded-xl px-4 py-2">Analyses</button>
          <button className="rounded-xl px-4 py-2">Rapports</button>
        </div>
      </div>
      {timeline.map((t) => {
        const Icon = t[5];
        return (
          <div key={t[0]} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon className="h-4 w-4" /></span>
              <div>
                <p className="text-base font-semibold text-slate-900">{t[0]}</p>
                <p className="text-sm text-slate-500">{t[1]}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${String(t[4]).replace('400/20','100').replace('300','700')}`}>{t[2]}</span>
              <span className="text-slate-500">{t[3]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Paramètres</h3>
          <p className="text-sm text-slate-500">Configuration générale de la plateforme</p>
        </div>
        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.26)] transition-transform hover:-translate-y-0.5"
        >
          <Save className="h-4 w-4" />Sauvegarder
        </button>
      </div>

      {settingsSavedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {settingsSavedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Risque sécurité</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">
            {adminSettingsForm.twoFactorRequired && adminSettingsForm.forceStrongPassword ? 'Faible' : 'Moyen'}
          </p>
          <p className="mt-1 text-xs text-blue-700">Basé sur 2FA et robustesse des mots de passe.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Canaux actifs</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {[adminSettingsForm.emailNotifications, adminSettingsForm.pushNotifications, adminSettingsForm.weeklyDigest].filter(Boolean).length}/3
          </p>
          <p className="mt-1 text-xs text-amber-700">Notifications activées pour l'équipe admin.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Conformité</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {adminSettingsForm.auditLogRetention && adminSettingsForm.manualAccountApproval ? 'Élevée' : 'Partielle'}
          </p>
          <p className="mt-1 text-xs text-emerald-700">Pilotée par rétention des logs et validation manuelle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Users className="h-4 w-4 text-blue-600" />Profil administrateur</h4>
          <div className="flex justify-between text-slate-600"><span>Nom complet</span><span className="font-bold text-slate-900">{settingsData?.profile?.full_name || 'Admin'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Email</span><span className="font-bold text-slate-900">{settingsData?.profile?.email || '-'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Rôle</span><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{settingsData?.profile?.role || 'Admin'}</span></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Shield className="h-4 w-4 text-blue-600" />Sécurité</h4>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-slate-500" />Authentification à deux facteurs (2FA)</span>
            <input type="checkbox" checked={adminSettingsForm.twoFactorRequired} onChange={() => updateSetting('twoFactorRequired')} className="h-4 w-4 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-slate-500" />Forcer des mots de passe robustes</span>
            <input type="checkbox" checked={adminSettingsForm.forceStrongPassword} onChange={() => updateSetting('forceStrongPassword')} className="h-4 w-4 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" />Verrouillage après inactivité</span>
            <input type="checkbox" checked={adminSettingsForm.lockAfterInactivity} onChange={() => updateSetting('lockAfterInactivity')} className="h-4 w-4 accent-blue-600" />
          </label>
          <div className="flex justify-between text-slate-600"><span>Expiration de session</span><span className="font-bold text-slate-900">{settingsData?.security?.session_expiration || '30 min'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Forcer changement mot de passe</span><span className="font-bold text-slate-900">{settingsData?.security?.password_rotation || '90 jours'}</span></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Bell className="h-4 w-4 text-blue-600" />Notifications</h4>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />Notifications par email</span>
            <input type="checkbox" checked={adminSettingsForm.emailNotifications} onChange={() => updateSetting('emailNotifications')} className="h-4 w-4 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-slate-500" />Notifications push</span>
            <input type="checkbox" checked={adminSettingsForm.pushNotifications} onChange={() => updateSetting('pushNotifications')} className="h-4 w-4 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-500" />Digest hebdomadaire</span>
            <input type="checkbox" checked={adminSettingsForm.weeklyDigest} onChange={() => updateSetting('weeklyDigest')} className="h-4 w-4 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
            <span className="inline-flex items-center gap-2"><MessageSquareWarning className="h-4 w-4 text-slate-500" />Alertes critiques immédiates</span>
            <input type="checkbox" checked={adminSettingsForm.criticalAlerts} onChange={() => updateSetting('criticalAlerts')} className="h-4 w-4 accent-blue-600" />
          </label>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Globe className="h-4 w-4 text-blue-600" />Plateforme</h4>
          <div className="flex justify-between text-slate-600"><span>Langue</span><span className="font-bold text-slate-900">{settingsData?.platform?.language || 'Français'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Fuseau horaire</span><span className="font-bold text-slate-900">{settingsData?.platform?.timezone || 'Europe/Paris (UTC+2)'}</span></div>
          <div className="flex justify-between text-slate-600"><span>Format de date</span><span className="font-bold text-slate-900">{settingsData?.platform?.date_format || 'DD/MM/YYYY'}</span></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.06)] xl:col-span-2">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Database className="h-4 w-4 text-blue-600" />Gouvernance et traçabilité</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
              <span>Validation manuelle des comptes médecins</span>
              <input type="checkbox" checked={adminSettingsForm.manualAccountApproval} onChange={() => updateSetting('manualAccountApproval')} className="h-4 w-4 accent-blue-600" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700">
              <span>Modération obligatoire des témoignages</span>
              <input type="checkbox" checked={adminSettingsForm.testimonialModeration} onChange={() => updateSetting('testimonialModeration')} className="h-4 w-4 accent-blue-600" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-slate-700 md:col-span-2">
              <span>Conserver les journaux d'audit (90 jours minimum)</span>
              <input type="checkbox" checked={adminSettingsForm.auditLogRetention} onChange={() => updateSetting('auditLogRetention')} className="h-4 w-4 accent-blue-600" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReclamations = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Module de Gestion des Réclamations</h3>
          <p className="text-sm text-slate-500">Gérez les retours et incidents signalés par le personnel médical</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors">
            <FileText className="h-4 w-4" /> Exporter PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {complaintsRows.length > 0 ? complaintsRows.map((c) => (
          <div key={c.id} className="group relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <MessageSquareWarning className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-bold text-slate-900">{c.title}</h4>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.severityClass}`}>
                    {c.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{c.subtitle}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.date}</span>
                  <span className="flex items-center gap-1 font-medium text-blue-600">ID: #{c.id.split('-')[1] || '001'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 border-t border-slate-50 pt-3 md:border-none md:pt-0">
              <button className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 md:flex-none">
                Ignorer
              </button>
              <button className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 md:flex-none">
                Prendre en charge
              </button>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <MessageSquareWarning className="h-8 w-8 text-slate-400" />
            </div>
            <h4 className="text-lg font-semibold text-slate-900">Aucune réclamation</h4>
            <p className="mx-auto max-w-sm text-sm text-slate-500">Toutes les réclamations des médecins ont été traitées ou aucune n'a été soumise pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0f9ff] font-sans text-slate-900">
      {/* Fond Médical Pur Bleu ... */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Image de fond avec une teinte de bleu médical pur */}
        <div 
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'url("/assets/images/doctor1.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(50px) saturate(0.8) sepia(1) hue-rotate(160deg) saturate(3)' 
          }}
        />
        
        {/* Overlay Bleu Clair Médical (Cyan-Blue) */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f0f9ff]/80 to-sky-100/40" />
      </div>
      
      {/* Halos de Lumière Bleue (Code Couleur Médical #0ea5e9 / #38bdf8) */}
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] z-0 h-[600px] w-[600px] rounded-full bg-sky-400/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-5%] z-0 h-[500px] w-[500px] rounded-full bg-blue-300/10 blur-[100px]" />

      {/* Icônes médicales en bleu ciel / bleu clinique */}
      <div className="pointer-events-none absolute right-[10%] top-[10%] z-0 opacity-[0.12]">
        <Activity size={240} strokeWidth={0.2} className="text-sky-500" />
      </div>
      <div className="pointer-events-none absolute left-[12%] bottom-[12%] z-0 opacity-[0.1]">
        <Search size={190} strokeWidth={0.2} className="text-sky-400" />
      </div>
      <div className="pointer-events-none absolute right-[35%] bottom-[25%] z-0 opacity-[0.06]">
        <Bell size={150} strokeWidth={0.2} className="text-sky-300" />
      </div>

      {activationNotice && (
        <div className="fixed right-4 top-4 z-[90] w-[92vw] max-w-md rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-[0_18px_40px_rgba(30,64,175,0.18)] backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-blue-100 p-2 text-blue-700">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900">Activation envoyée</p>
              <p className="mt-0.5 text-sm font-medium text-blue-700">{activationNotice}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivationNotice('')}
              className="rounded-lg px-2 py-1 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fermer la notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex relative z-10">
      <AdminSidebar />
      <main className="relative z-10 flex-1 xl:ml-64">
        <div className="sticky top-0 z-10 border-b border-slate-200/90 bg-white px-4 py-2.5 md:px-6 md:py-2.5">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {isHome ? 'Tableau de bord' : isAccounts ? 'Comptes' : isHistory ? 'Historique' : isReclamations ? 'Réclamations' : isTestimonials ? 'Témoignages' : 'Paramètres'}
              </h1>
              <p className="text-sm text-slate-500">{isHome ? "Bienvenue sur le portail administrateur NeuroScan" : 'Gestion et supervision'}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-blue-100 bg-slate-50 px-3 py-1.5 transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-sm md:min-w-[320px]">
                <Search className="h-4 w-4 text-blue-500" />
                <input 
                  type="text"
                  placeholder="Rechercher un patient, un rapport ou un compte..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                   <button 
                     onClick={() => setSearchQuery('')}
                     className="text-slate-400 hover:text-slate-600"
                   >
                     ×
                   </button>
                )}
              </div>

              <div className="relative">
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications) setUnreadCount(0);
                  }}
                  className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 transition-all hover:bg-blue-50 ${showNotifications ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-500'}`}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown de notifications */}
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-900">Notifications</span>
                      <button className="text-[11px] text-blue-600 font-semibold hover:underline">Tout marquer comme lu</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                      {[
                        { title: 'Comptes en attente', desc: `${pendingAccounts.length} médecin(s) attendent une validation admin.`, time: 'Maintenant' },
                        { title: 'Témoignages en attente', desc: `${pendingTestimonials.length} témoignage(s) à modérer.`, time: 'Maintenant' },
                        { title: 'Réclamation urgente', desc: 'Incident signalé sur l\'analyse #042.', time: 'Il y a 15 min' },
                        { title: 'Rapport généré', desc: "L'analyse IRM de 'Patient X' est prête.", time: 'Il y a 1h' },
                      ].map((n, i) => (
                        <div key={i} className="px-3 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-b border-slate-50 last:border-0 text-left">
                          <p className="text-[13px] font-semibold text-slate-900 leading-tight">{n.title}</p>
                          <p className="mt-0.5 text-[12px] text-slate-500 line-clamp-1">{n.desc}</p>
                          <p className="mt-1 text-[10px] text-slate-400 font-medium">{n.time}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 text-center border-t border-slate-100">
                      <button className="text-[12px] text-slate-500 font-semibold hover:text-blue-600 transition-colors">Voir tout l'historique</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 xl:hidden">
            <NavLink to="/admin" end className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Vue globale</NavLink>
            <NavLink to="/admin/comptes" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Comptes</NavLink>
            <NavLink to="/admin/temoignages" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Témoignages</NavLink>
            <NavLink to="/admin/historique" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Historique</NavLink>
            <NavLink to="/admin/parametres" className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Paramètres</NavLink>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1500px] p-3 md:p-4">
          <div className="rounded-2xl border border-slate-200 bg-transparent p-0 shadow-none md:p-0">
            {isHome && renderOverview()}
            {isAccounts && renderAccounts()}
            {isTestimonials && renderTestimonials()}
            {isHistory && renderHistory()}
            {isReclamations && renderReclamations()}
            {isSettings && renderSettings()}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
