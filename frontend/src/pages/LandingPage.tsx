import React from 'react';
import { createContactRequest, getApprovedTestimonials, submitTestimonial } from '../api';
import {
  Brain,
  Layers,
  FileText,
  GitMerge,
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  CheckCircle2,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Activity,
  History,
  Workflow,
  Search,
  Eye,
  Download,
  CheckCircle,
  Cpu,
  Mail,
  Award,
  TrendingUp,
  Clock,
  Users,
  Star,
  Quote,
  Plus,
  Send,
  Lock
} from 'lucide-react';

interface User {
  username: string;
  fullName?: string;
  full_name?: string;
  speciality?: string;
  specialty?: string;
  is_staff?: boolean;
}

interface LandingPageProps {
  user?: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function LandingPage({ user, onNavigate, onLogout }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);
  const [contactSuccess, setContactSuccess] = React.useState('');
  const [contactError, setContactError] = React.useState('');
  const [isContactSending, setIsContactSending] = React.useState(false);
  const [featureAccessHint, setFeatureAccessHint] = React.useState('');
  const [formData, setFormData] = React.useState({ name: '', role: '', text: '' });
  const [testimonialSuccess, setTestimonialSuccess] = React.useState('');
  const [testimonialError, setTestimonialError] = React.useState('');
  const [testimonialSubmitting, setTestimonialSubmitting] = React.useState(false);
  const [contactForm, setContactForm] = React.useState({
    fullName: '',
    email: '',
    institution: '',
    subject: 'Demande de démonstration',
    message: ''
  });
  const [testimonials, setTestimonials] = React.useState([
    {
      name: "Dr. SM",
      role: "Neuroradiologue — CHU de Sfax",
      text: "La segmentation hippocampique est d'une précision remarquable. Cet outil a transformé notre protocole de suivi des patients Alzheimer. Le gain de temps est considérable.",
      initials: "SM",
      status: 'approved'
    },
    {
      name: "Dr. KM",
      role: "Médecin Nucléaire — Hôpital de Sahloul",
      text: "Le recalage PET/IRM est enfin fiable et rapide. L'interface est intuitive, mes internes l'ont prise en main en moins d'une heure. Un vrai game-changer.",
      initials: "KB",
      status: 'approved'
    },
    {
      name: "Dr. ER",
      role: "Neurologue — Hopital Fatouma Bourguiba Monastir",
      text: "Les rapports automatiques sont d'une clarté exemplaire. Ils nous aident à mieux communiquer les résultats aux patients et à objectiver nos décisions thérapeutiques.",
      initials: "ER",
      status: 'approved'
    }
  ]);

  React.useEffect(() => {
    const loadApprovedTestimonials = async () => {
      try {
        const res = await getApprovedTestimonials();
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (items.length > 0) {
          setTestimonials(items);
        }
      } catch (err) {
        console.error('Testimonials load failed:', err);
      }
    };
    void loadApprovedTestimonials();
  }, []);

  React.useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const elements = document.querySelectorAll('.reveal');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role || !formData.text) return;

    setTestimonialError('');
    setTestimonialSuccess('');
    setTestimonialSubmitting(true);
    try {
      await submitTestimonial({
        name: formData.name,
        role: formData.role,
        text: formData.text,
      });
      setTestimonialSuccess('Merci. Votre témoignage a été envoyé et sera affiché après validation admin.');
      setFormData({ name: '', role: '', text: '' });
      setTimeout(() => {
        setIsModalOpen(false);
        setTestimonialSuccess('');
      }, 1400);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error;
      const statusCode = err?.response?.status;
      const networkMessage = err?.message;
      setTestimonialError(apiMessage || (statusCode ? `Impossible d'envoyer le témoignage (HTTP ${statusCode}).` : `Impossible d'envoyer le témoignage: ${networkMessage || 'erreur réseau'}.`));
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const handleAccessRequest = () => {
    if (!user) {
      onNavigate('login');
      return;
    }
    onNavigate('dashboard');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.fullName || !contactForm.email || !contactForm.subject || !contactForm.message) return;

    setContactError('');
    setContactSuccess('');
    setIsContactSending(true);

    try {
      await createContactRequest({
        full_name: contactForm.fullName,
        email: contactForm.email,
        institution: contactForm.institution,
        subject: contactForm.subject,
        message: contactForm.message,
      });

      setContactSuccess('Votre demande a été envoyée. Notre équipe vous contactera rapidement.');
      setContactForm({
        fullName: '',
        email: '',
        institution: '',
        subject: 'Demande de démonstration',
        message: ''
      });

      setTimeout(() => {
        setIsContactModalOpen(false);
        setContactSuccess('');
      }, 1800);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error;
      setContactError(apiMessage || 'Impossible d\'envoyer la demande pour le moment. Réessayez.');
    } finally {
      setIsContactSending(false);
    }
  };

  const features = [
    {
      title: "Segmentation Volumétrique",
      description: "Segmentation automatique de l'hippocampe gauche et droit par deep learning ; avec calcul des volumes et index d'asymétrie pour la détection de l'atrophie et de la sclérose hippocampique.",
      icon: <Brain className="w-6 h-6 text-blue-600" />,
      target: 'dashboard'
    },
    {
      title: "Reconstruction 3D",
      description: "Visualisation 3D interactive de l'hippocampe segmenté ; explorez la structure sous tous les angles pour une interprétation anatomique intuitive.",
      icon: <Layers className="w-6 h-6 text-blue-600" />,
      target: 'dashboard'
    },
    {
      title: "Rapports Cliniques",
      description: "Génération automatique de rapports personnalisés par patient ; mesures volumétriques, comparaisons aux normes de référence et suivi longitudinal intégré.",
      icon: <FileText className="w-6 h-6 text-blue-600" />,
      target: 'dashboard'
    },
    {
      title: "Recalage d'Images",
      description: "Recalage 2D et 3D d'images multimodales (IRM/IRM, TEP/IRM) avec identification automatique des zones corticales pour une interprétation fonctionnelle précise.",
      icon: <GitMerge className="w-6 h-6 text-blue-600" />,
      target: 'registration'
    }
  ];

  const handleFeatureAccess = (target: string) => {
    if (!user) {
      setFeatureAccessHint('Accès restreint: créez un compte ou connectez-vous pour ouvrir les modules Segmentation, Reconstruction, Rapports et Recalage.');
      return;
    }
    setFeatureAccessHint('');
    onNavigate(target);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 hero-nav-reveal">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">NeuroScan</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-5">
            <div className="flex items-center gap-5 pr-5 border-r border-slate-100">
              <button onClick={() => scrollToSection('features')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Services</button>
              <button onClick={() => scrollToSection('workflow')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Workflow</button>
            </div>

            <div className="flex items-center gap-5 pr-5 border-r border-slate-100">
              <button onClick={() => scrollToSection('axe1')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Segmentation</button>
              <button onClick={() => scrollToSection('axe2')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Nucléaire</button>
              <button onClick={() => scrollToSection('rapports')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Rapports</button>
            </div>

            <div className="flex items-center gap-5">
              <button onClick={() => scrollToSection('why-us')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Pourquoi</button>
              <button onClick={() => scrollToSection('testimonials')} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Avis</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden xl:flex flex-col items-end pr-3 border-r border-slate-100">
                  <span className="text-[11px] font-bold text-slate-900 leading-tight">Dr. {user.fullName || user.full_name || user.username}</span>
                  <span className="text-[9px] text-blue-600 font-bold uppercase tracking-widest opacity-80">{user.speciality || user.specialty || 'Neurologie'}</span>
                </div>
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
                >
                  Votre Dashboard
                </button>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Déconnexion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[13px] font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
              >
                Accès
              </button>
            )}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 text-slate-600">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-white">
        <div className="pointer-events-none absolute left-8 top-24 h-44 w-44 rounded-full bg-cyan-100/60 blur-3xl hero-orb"></div>
        <div className="pointer-events-none absolute right-12 bottom-12 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl hero-orb hero-orb-delay"></div>
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-blue-50/30 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center lg:text-left">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider hero-badge">
                NEUROIMAGERIE CLINIQUE ASSISTÉE PAR IA
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight hero-title">
                L'intelligence au service du <span className="text-blue-600">cerveau</span>
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0 hero-subtitle">
                De la segmentation volumétrique de l'hippocampe à l'identification des zones corticales ; une plateforme unifiée pour objectiver vos diagnostics en neurologie et médecine nucléaire.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center lg:justify-start hero-actions">
                <button
                  onClick={() => scrollToSection('features')}
                  className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all font-sans hero-cta-primary"
                >
                  Lancer une analyse
                </button>
                <button className="px-8 py-3.5 bg-white text-slate-900 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 hero-cta-secondary">
                  <Play className="w-4 h-4 text-blue-600 fill-blue-600" />
                  Découvrir la plateforme
                </button>
              </div>
            </div>

            <div className="relative group reveal reveal-right transition-all hero-visual-float">
              <div className="absolute -inset-4 bg-blue-400 opacity-10 blur-3xl group-hover:opacity-20 transition-opacity"></div>
              <img
                src="/images/axe1_brain.png"
                alt="Segmentation 3D Detail"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50/50 border-y border-slate-100 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-100/30 blur-[120px] rounded-full -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-20 space-y-4">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px] block">SERVICES NUMÉRIQUES</span>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">Une suite clinique <span className="text-blue-600">spécialisée</span></h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">4 outils fondamentaux pour une neurologie de précision.</p>
            {!user && (
              <p className="mx-auto mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                Modules protégés: Segmentation, Reconstruction 3D, Rapports et Recalage nécessitent un compte actif.
              </p>
            )}
            {featureAccessHint && (
              <p className="mx-auto mt-2 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                {featureAccessHint}
              </p>
            )}
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 reveal reveal-up">
            {features.map((feature: any, i) => (
              <div 
                key={i} 
                onClick={() => handleFeatureAccess(feature.target)}
                className={`relative p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group feature-card-pop cursor-pointer ${!user ? 'opacity-95' : ''}`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {!user && (
                  <div className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    <Lock className="h-3 w-3" /> Compte requis
                  </div>
                )}
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500 shadow-inner">
                  {React.cloneElement(feature.icon as React.ReactElement, { className: "w-8 h-8" })}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 text-base leading-relaxed font-medium">{feature.description}</p>
                <div className="mt-8 flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-500">
                  {user ? 'Ouvrir le module' : 'Connexion requise'} <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Axe 1 - Neuroimagerie */}
      <section id="axe1" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 relative reveal reveal-left">
              <div className="absolute -inset-10 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
              <img
                src="/images/hero_brain.png"
                alt="3D Brain Visualization"
                className="rounded-3xl shadow-xl border border-slate-100"
              />
            </div>

            <div className="order-1 lg:order-2 space-y-8 reveal reveal-up">
              <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">AXE 1 : NEUROIMAGERIE</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">Segmentation Volumétrique de l'hippocampe</h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Quantifiez avec précision les structures hippocampiques gauche et droite à partir d'IRM cérébrales ; pour une détection objective de l'atrophie liée à la maladie d'Alzheimer et de la sclérose hippocampique dans l'épilepsie.
              </p>
              <div className="space-y-4">
                {[
                  "Calcul automatique du volume hippocampique gauche et droit",
                  "Comparaison avec les bases normatives",
                  "Reconstruction 3D interactive haute définition",
                  "Génération automatique du rapport de segmentation par patient"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Axe 2 - Médecine Nucléaire */}
      <section id="axe2" className="py-20 lg:py-24 bg-blue-50/50 border-y border-blue-100 rounded-[2.5rem] mx-4 md:mx-8 mb-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-100/20 to-transparent -z-0"></div>
        <div className="max-w-7xl mx-auto px-8 lg:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8 reveal reveal-up">
              <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">AXE 2 : MÉDECINE NUCLÉAIRE</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">Recalage Multimodal</h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Alignez avec précision vos images IRM/IRM et TEP/IRM en 2D et 3D ; pour une localisation fiable des zones corticales et une interprétation fonctionnelle rigoureuse.
              </p>
              <div className="space-y-4">
                {[
                  "Recalage automatique et manuel IRM/IRM et TEP/IRM en 2D et 3D",
                  "Identification automatique des zones corticales d'intérêt",
                  "Superposition précise des données fonctionnelles sur l'anatomie du patient"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative group reveal reveal-right">
              <div className="absolute -inset-10 bg-blue-200/20 rounded-full blur-3xl opacity-50"></div>
              <img
                src="/images/axe2_brain.png"
                alt="Multimodal Registration Detail"
                className="rounded-[2rem] w-full border border-blue-100 shadow-2xl relative z-10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Rapports */}
      <section id="rapports" className="py-24 bg-blue-50/20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-20 space-y-4">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">REPORTING</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Rapports Cliniques Personnalisés</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center reveal reveal-up">
            <div className="relative group overflow-hidden rounded-3xl shadow-2xl border border-blue-100">
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent z-10"></div>
              <img
                src="/images/report.svg"
                alt="Medical Report Visualization"
                className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute bottom-8 left-8 right-8 z-20">
                <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-white" />
                    <span className="text-white font-bold tracking-wide">RAPPORT CLINIQUE IA</span>
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed">
                    Visualisation synchronisée des données volumétriques et des coupes IRM pour un diagnostic précis.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {[
                {
                  title: "Rapports Détaillés",
                  icon: <FileText />,
                  desc: "Volumes hippocampiques, index d'asymétrie, percentiles et comparaisons normatives ; regroupés dans un rapport PDF structuré et prêt à intégrer au dossier patient."
                },
                {
                  title: "Suivi Longitudinal",
                  icon: <Activity />,
                  desc: "Comparez les mesures dans le temps pour détecter l'évolution de l'atrophie hippocampique ou d'une sclérose ; et objectiver la progression clinique du patient."
                },
                {
                  title: "Export Multi-Format",
                  icon: <Download />,
                  desc: "Export en PDF clinique, données CSV et modèles 3D STL/OBJ ; pour une utilisation flexible dans tous vos environnements de travail."
                },
                {
                  title: "Génération Instantanée",
                  icon: <Zap />,
                  desc: "Rapport généré automatiquement en moins de 30 secondes après l'analyse ; aucune saisie manuelle requise."
                }
              ].map((card, i) => (
                <div key={i} className="p-6 bg-white border border-blue-50 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                    {card.icon}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-2">{card.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Workflow */}
      <section id="workflow" className="py-24 lg:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center relative z-10">
          <div className="space-y-4 mb-20">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">WORKFLOW</span>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
              De l'image au diagnostic  <span className="text-blue-500">en 4 étapes</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-3xl mx-auto font-medium">
              Importez vos images, lancez l'analyse ; la plateforme gère le reste.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative mt-20">
            {/* Connection Line (Desktop) */}
            <div className="hidden lg:block absolute top-[55px] left-[15%] right-[15%] h-[1px] bg-slate-200 pointer-events-none"></div>

            {[
              {
                title: "Import",
                icon: <Download />,
                desc: "Importez vos fichiers NIfTI depuis votre système d'archivage hospitalier (PACS) ou directement depuis votre poste de travail."
              },
              {
                title: "Traitement IA",
                icon: <Cpu />,
                desc: "Segmentation hippocampique et recalage d'images lancés automatiquement ; aucune intervention manuelle requise."
              },
              {
                title: "Visualisation",
                icon: <Eye />,
                desc: "Explorez la reconstruction 3D de l'hippocampe et les images recalées dans le viewer interactif intégré."
              },
              {
                title: "Rapport",
                icon: <FileText />,
                desc: "Téléchargez le rapport clinique personnalisé ; volumes, asymétries et résultats de recalage prêts pour le dossier patient."
              }
            ].map((step, i) => (
              <div
                key={i}
                className="relative space-y-8 z-10 px-4 group reveal reveal-up"
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="mx-auto w-[110px] h-[110px] bg-slate-900/5 backdrop-blur-sm border border-slate-200 rounded-[2rem] flex items-center justify-center text-blue-600 transition-all duration-300 group-hover:scale-105 group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-xl group-hover:shadow-blue-600/5">
                  {/* Badge 0X */}
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                    0{i + 1}
                  </div>
                  {React.cloneElement(step.icon as React.ReactElement, { size: 36, strokeWidth: 1.5 })}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xl font-bold text-slate-900 tracking-tight">{step.title}</h4>
                  <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Ce qui nous distingue */}
      <section id="why-us" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.03),transparent)] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="text-center mb-20 space-y-4">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px] block">NOTRE EXPERTISE</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Ce qui nous <span className="text-blue-600">distingue</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-3xl mx-auto font-medium">
              Une plateforme conçue par des professionnels de santé, pour des professionnels de santé.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 reveal reveal-up">
            {[
              {
                title: "Expertise Reconnue",
                desc: "Conçu avec des neuroradiologues et chercheurs universitaires ; pour un outil ancré dans la réalité clinique et adapté aux exigences du diagnostic médical.",
                icon: <Award className="w-6 h-6 text-blue-600" />
              },
              {
                title: "Précision Supérieure",
                desc: "Notre modèle de segmentation produit des résultats fiables et reproductibles, avec un taux d'erreur minimal sur la délimitation de l'hippocampe ; pour une aide au diagnostic de qualité.",
                icon: <TrendingUp className="w-6 h-6 text-blue-600" />
              },
              {
                title: "Gain de Temps",
                desc: "Obtenez vos résultats de segmentation en quelques minutes ; pour un flux de travail clinique fluide et sans interruption.",
                icon: <Clock className="w-6 h-6 text-blue-600" />
              },
              {
                title: "Sécurité Maximale",
                desc: "Infrastructure certifiée HDS avec chiffrement de bout en bout. Vos données patients ne quittent jamais le périmètre sécurisé.",
                icon: <ShieldCheck className="w-6 h-6 text-blue-600" />
              },
              {
                title: "Support Dédié",
                desc: "Une équipe technique disponible pour vous accompagner à chaque étape ; de la prise en main jusqu'à l'intégration dans vos protocoles cliniques.",
                icon: <Users className="w-6 h-6 text-blue-600" />
              },
              {
                title: "Impact Clinique",
                desc: "Une interface intuitive et ergonomique, pensée pour le médecin ; aucune formation technique approfondie requise pour prendre en main la plateforme.",
                icon: <Activity className="w-6 h-6 text-blue-600" />
              }
            ].map((item, i) => (
              <div key={i} className="p-10 bg-white border border-slate-100 rounded-[2rem] hover:border-blue-200 hover:shadow-xl hover:shadow-blue-600/5 transition-all group">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 border border-blue-100/50 shadow-inner transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Témoignages */}
      <section id="testimonials" className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="text-center mb-16 space-y-4">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mb-4 block">Validation clinique</span>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Une plateforme <span className="text-blue-600">en cours</span> d'évaluation clinique
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
              Notre plateforme est actuellement testée avec des équipes médicales partenaires. Les premiers retours confirment le gain de temps et la fiabilité des résultats de segmentation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 reveal reveal-up">
            {testimonials.map((t, i) => (
              <div key={i} className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group">
                <Quote className="absolute top-6 right-8 w-12 h-12 text-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-8 relative z-10">
                  "{t.text}"
                </p>

                <div className="flex items-center gap-4 border-t border-slate-50 pt-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm shadow-inner">
                    {t.initials}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Ajouter votre témoignage
            </button>
          </div>
        </div>

        {/* Modal: Ajouter un témoignage */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
              <div className="p-8 md:p-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-slate-900">Partagez votre avis</h3>
                    <p className="text-sm text-slate-500 font-medium">Votre retour aide la communauté médicale.</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitTestimonial} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nom complet</label>
                    <input
                      type="text"
                      required
                      placeholder="Dr. Jean Dupont"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Spécialité & Établissement</label>
                    <input
                      type="text"
                      required
                      placeholder="Neurologue — CHU Paris"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Témoignage</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Partagez votre expérience clinique avec NeuroScan..."
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300 resize-none"
                    ></textarea>
                  </div>

                  {testimonialSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      {testimonialSuccess}
                    </div>
                  )}
                  {testimonialError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                      {testimonialError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={testimonialSubmitting}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    {testimonialSubmitting ? 'Envoi en cours...' : 'Soumettre le témoignage'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="py-28 md:py-32 bg-[#edf3ff] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-200/40 via-blue-200/50 to-indigo-200/40 blur-3xl"></div>
          <div className="absolute bottom-0 left-1/2 h-56 w-[58rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-100/70 via-white/80 to-blue-100/70 blur-2xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="rounded-[2.2rem] border border-blue-100/80 bg-white/55 backdrop-blur-md shadow-[0_28px_70px_rgba(29,78,216,0.10)] p-8 md:p-12">
            <div className="text-center max-w-4xl mx-auto">
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                Décision Clinique Accélérée
              </p>
              <h2 className="mt-5 text-2xl md:text-4xl font-black text-slate-900 leading-[1.12] tracking-tight">
                Prêt à transformer votre analyse neurologique ?
              </h2>
              <p className="mt-4 text-base md:text-lg text-slate-600 font-medium">
                Activez votre espace NeuroScan et démarrez une évaluation clinique assistée, structurée et sécurisée.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-5">
                <button
                  onClick={handleAccessRequest}
                  className="group min-w-[240px] px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black rounded-2xl shadow-[0_14px_36px_rgba(37,99,235,0.32)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(37,99,235,0.38)]"
                >
                  <span className="inline-flex items-center gap-2">
                    Demander un accès
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
                <button
                  onClick={() => setIsContactModalOpen(true)}
                  className="min-w-[240px] px-8 py-4 bg-white text-slate-900 font-black rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-blue-600" />
                  Nous contacter
                </button>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {[
                { value: "2 axes cliniques", label: "Neuroimagerie & médecine nucléaire" },
                { value: "2D & 3D", label: "Modes de recalage" },
                { value: "< 30 sec", label: "Temps d'analyse" },
                { value: "100%", label: "Données chiffrées et sécurisées" }
              ].map((stat, i) => (
                <div key={i} className="kpi-pop rounded-2xl border border-blue-100 bg-white px-4 py-5 text-center shadow-[0_6px_18px_rgba(59,130,246,0.07)]" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="text-[24px] leading-none font-black text-blue-600 tracking-tight">{stat.value}</div>
                  <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .hero-nav-reveal {
          animation: navSlideIn 600ms ease-out both;
        }

        .hero-orb {
          animation: orbFloat 8s ease-in-out infinite;
        }

        .hero-orb-delay {
          animation-delay: 1.6s;
        }

        .hero-badge {
          animation: fadeUp 650ms ease-out 120ms both;
        }

        .hero-title {
          animation: fadeUp 700ms cubic-bezier(0.22, 1, 0.36, 1) 220ms both;
        }

        .hero-subtitle {
          animation: fadeUp 700ms ease-out 320ms both;
        }

        .hero-actions {
          animation: fadeUp 700ms ease-out 420ms both;
        }

        .hero-cta-primary,
        .hero-cta-secondary {
          transform: translateZ(0);
        }

        .hero-cta-primary:hover,
        .hero-cta-secondary:hover {
          transform: translateY(-2px) scale(1.01);
        }

        .hero-visual-float {
          animation: fadeUp 800ms ease-out 260ms both, visualFloat 6.5s ease-in-out 1.1s infinite;
        }

        .feature-card-pop {
          opacity: 0;
          animation: cardIn 700ms ease-out forwards;
        }

        .kpi-pop {
          opacity: 0;
          animation: fadeUp 650ms ease-out forwards;
        }

        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 700ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .reveal.reveal-left {
          transform: translateX(-28px);
        }

        .reveal.reveal-right {
          transform: translateX(28px);
        }

        .reveal.is-visible {
          opacity: 1;
          transform: translateX(0) translateY(0);
        }

        @keyframes navSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes visualFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-10px) translateX(6px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-nav-reveal,
          .hero-orb,
          .hero-badge,
          .hero-title,
          .hero-subtitle,
          .hero-actions,
          .hero-visual-float,
          .feature-card-pop,
          .kpi-pop,
          .reveal {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Modal: Nous contacter */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsContactModalOpen(false)}></div>
          <div className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
            <div className="p-8 md:p-10 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-slate-900">Envoyer un message</h3>
                  <p className="text-sm text-slate-500 font-medium">Notre équipe vous accompagne pour la démonstration et l'intégration clinique.</p>
                </div>
                <button onClick={() => setIsContactModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                  <p className="mt-1 text-sm font-black text-slate-900">contact@neuroscan</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</p>
                  <p className="mt-1 text-sm font-black text-slate-900">+216 73 215 340</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adresse</p>
                  <p className="mt-1 text-sm font-black text-slate-900">5000 Monastir</p>
                </div>
              </div>

              {contactSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {contactSuccess}
                </div>
              )}

              {contactError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {contactError}
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nom complet *</label>
                    <input
                      required
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                      placeholder="Dr. Jean Dupont"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="jean.dupont@chu.fr"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Établissement</label>
                    <input
                      value={contactForm.institution}
                      onChange={(e) => setContactForm({ ...contactForm, institution: e.target.value })}
                      placeholder="CHU de Paris"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sujet *</label>
                    <select
                      required
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                    >
                      <option>Demande de démonstration</option>
                      <option>Intégration clinique</option>
                      <option>Support technique</option>
                      <option>Partenariat</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Décrivez votre demande..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isContactSending}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  {isContactSending ? 'Envoi en cours...' : 'Envoyer le message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Simple Footer */}
      <footer className="bg-white py-12 px-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">NeuroScan</span>
          </div>
          <div className="flex gap-8">
            {["Légal", "Confidentialité", "Contact"].map((link) => (
              <a key={link} href="#" className="text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest">{link}</a>
            ))}
          </div>
          <p className="text-[10px] font-bold text-slate-300 uppercase">© 2026 NeuroScan Platform.</p>
        </div>
      </footer>
    </div>
  );
}
