import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const API_BASE_URL = "http://localhost:8000/api/";

const tabs = [
  { id: "personal", label: "Informations personnelles" },
  { id: "professional", label: "Informations professionnelles" },
  { id: "security", label: "Securite & Acces" },
  { id: "preferences", label: "Preferences & Notifications" },
];

const initialFormData = {
  firstName: "Nadine",
  lastName: "Hammami",
  email: "nadine.hammami@visionmed.tn",
  phone: "+216 98 123 456",
  birthDate: "1989-06-14",
  gender: "Femme",
  nationality: "Tunisienne",
  cin: "MED-459287-TN",
  specialty: "Neurologue",
  subSpecialty: "Epileptologie",
  institution: "CHU Monastir",
  department: "Service de Neurologie",
  orderNumber: "ONM-2025-18876",
  experienceYears: 9,
  languages: ["Francais", "Arabe", "Anglais"],
  bio: "Neurologue specialisee en pathologies epileptiques et en interpretation de segmentation hippocampique pour l'aide au diagnostic.",
};

const initialPasswordData = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const initialNotifications = {
  mriDone: true,
  reportReady: true,
  complaintUpdated: true,
  securityAlerts: true,
  newsletter: false,
};

function getPasswordStrength(password) {
  if (!password) {
    return { label: "Faible", score: 0, color: "bg-gray-200" };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { label: "Faible", score: 1, color: "bg-red-500" };
  }
  if (score <= 4) {
    return { label: "Moyen", score: 2, color: "bg-amber-500" };
  }
  return { label: "Fort", score: 3, color: "bg-emerald-500" };
}

function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function MonProfil() {
  const [activeTab, setActiveTab] = useState("personal");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [savedFormData, setSavedFormData] = useState(initialFormData);
  const [passwordData, setPasswordData] = useState(initialPasswordData);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferences, setPreferences] = useState({
    language: "Francais",
    timezone: "Africa/Tunis (UTC+1)",
    dateFormat: "JJ/MM/AAAA",
    twoFactorEnabled: false,
  });
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Profil mis a jour avec succes ✓");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  const validatePersonalForm = (data) => {
    const errors = {};

    if (!data.firstName.trim()) errors.firstName = "Le prenom est obligatoire.";
    if (!data.lastName.trim()) errors.lastName = "Le nom est obligatoire.";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.email = "Veuillez saisir un email professionnel valide.";
    }

    const phoneRegex = /^\+?[0-9\s-]{8,20}$/;
    if (!phoneRegex.test(data.phone.trim())) {
      errors.phone = "Veuillez saisir un numero de telephone valide.";
    }

    if (!data.birthDate) {
      errors.birthDate = "La date de naissance est obligatoire.";
    } else {
      const birth = new Date(data.birthDate);
      const now = new Date();
      if (Number.isNaN(birth.getTime()) || birth > now) {
        errors.birthDate = "La date de naissance est invalide.";
      }
    }

    if (!["Homme", "Femme"].includes(data.gender)) {
      errors.gender = "Veuillez selectionner un sexe valide.";
    }

    if (!data.nationality.trim()) {
      errors.nationality = "La nationalite est obligatoire.";
    }

    return errors;
  };

  const validateProfessionalForm = (data) => {
    const errors = {};
    const validSpecialties = [
      "Neurologue",
      "Radiologue",
      "Neurochirurgien",
      "Medecin generaliste",
    ];

    if (!validSpecialties.includes(data.specialty)) {
      errors.specialty = "Veuillez selectionner une specialite valide.";
    }

    if (!data.subSpecialty.trim()) errors.subSpecialty = "La sous-specialite est obligatoire.";
    if (!data.institution.trim()) errors.institution = "L'etablissement est obligatoire.";
    if (!data.department.trim()) errors.department = "Le service est obligatoire.";

    if (!Number.isFinite(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 80) {
      errors.experienceYears = "Les annees d'experience doivent etre comprises entre 0 et 80.";
    }

    if (!Array.isArray(data.languages) || data.languages.length === 0) {
      errors.languages = "Veuillez selectionner au moins une langue.";
    }

    if (!data.bio.trim()) {
      errors.bio = "La bio professionnelle est obligatoire.";
    } else if (data.bio.length > 300) {
      errors.bio = "La bio professionnelle ne doit pas depasser 300 caracteres.";
    }

    return errors;
  };

  const validatePasswordForm = (data) => {
    const errors = {};

    if (!data.currentPassword) errors.currentPassword = "Le mot de passe actuel est obligatoire.";
    if (!data.newPassword) errors.newPassword = "Le nouveau mot de passe est obligatoire.";
    if (!data.confirmPassword) {
      errors.confirmPassword = "Veuillez confirmer le nouveau mot de passe.";
    }

    if (data.newPassword && data.newPassword === data.currentPassword) {
      errors.newPassword = "Le nouveau mot de passe doit etre different de l'actuel.";
    }

    if (data.newPassword && getPasswordStrength(data.newPassword).score < 2) {
      errors.newPassword = "Le mot de passe est trop faible. Ajoutez majuscule, chiffre ou symbole.";
    }

    if (data.newPassword && data.confirmPassword && data.newPassword !== data.confirmPassword) {
      errors.confirmPassword = "La confirmation du mot de passe ne correspond pas.";
    }

    return errors;
  };

  const fullName = `${formData.firstName} ${formData.lastName}`;
  const initials = useMemo(() => {
    const first = formData.firstName?.trim()?.[0] || "";
    const last = formData.lastName?.trim()?.[0] || "";
    return `${first} ${last}`.trim().toUpperCase();
  }, [formData.firstName, formData.lastName]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordData.newPassword),
    [passwordData.newPassword]
  );

  useEffect(() => {
    if (!showSuccessToast) return undefined;
    const timeout = setTimeout(() => setShowSuccessToast(false), 2500);
    return () => clearTimeout(timeout);
  }, [showSuccessToast]);

  useEffect(() => {
    if (activeTab !== "personal" && activeTab !== "professional") {
      setEditMode(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const loadProfile = async () => {
      setErrorMessage("");
      setIsLoadingProfile(true);

      try {
        const token = localStorage.getItem("access");
        const response = await fetch(`${API_BASE_URL}profile/`, {
          method: "GET",
          credentials: "include",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });

        if (!response.ok) {
          throw new Error("Impossible de charger le profil.");
        }

        const data = await response.json();
        const merged = {
          ...initialFormData,
          ...data,
          languages: Array.isArray(data.languages)
            ? data.languages
            : initialFormData.languages,
          experienceYears:
            typeof data.experienceYears === "number"
              ? data.experienceYears
              : initialFormData.experienceYears,
        };

        setFormData(merged);
        setSavedFormData(merged);
      } catch (error) {
        setErrorMessage(error.message || "Erreur de chargement du profil.");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (field, value) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLanguage = (language) => {
    if (!editMode) return;
    setFieldErrors((prev) => {
      if (!prev.languages) return prev;
      const next = { ...prev };
      delete next.languages;
      return next;
    });
    setFormData((prev) => {
      const exists = prev.languages.includes(language);
      const nextLanguages = exists
        ? prev.languages.filter((lng) => lng !== language)
        : [...prev.languages, language];
      return { ...prev, languages: nextLanguages };
    });
  };

  const startEdit = () => {
    setSavedFormData(formData);
    setFieldErrors({});
    setEditMode(true);
  };

  const cancelEdit = () => {
    setFormData(savedFormData);
    setFieldErrors({});
    setEditMode(false);
  };

  const saveEdit = async () => {
    const validationErrors =
      activeTab === "personal"
        ? validatePersonalForm(formData)
        : validateProfessionalForm(formData);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setErrorMessage("Veuillez corriger les champs invalides avant d'enregistrer.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setFieldErrors({});

    try {
      const token = localStorage.getItem("access");
      const response = await fetch(`${API_BASE_URL}profile/`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Impossible de sauvegarder le profil.");
      }

      const data = await response.json();
      const merged = {
        ...formData,
        ...data,
        languages: Array.isArray(data.languages) ? data.languages : formData.languages,
      };

      setFormData(merged);
      setSavedFormData(merged);
      setEditMode(false);
      setFieldErrors({});
      setToastMessage("Profil mis a jour avec succes ✓");
      setShowSuccessToast(true);
    } catch (error) {
      setErrorMessage(error.message || "Erreur lors de l'enregistrement du profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const validationErrors = validatePasswordForm(passwordData);
    if (Object.keys(validationErrors).length > 0) {
      setPasswordErrors(validationErrors);
      setErrorMessage("Veuillez verifier les informations de mot de passe.");
      return;
    }

    setIsChangingPassword(true);
    setErrorMessage("");
    setPasswordErrors({});

    try {
      const token = localStorage.getItem("access");
      const response = await fetch(`${API_BASE_URL}profile/change-password/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(passwordData),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Impossible de mettre a jour le mot de passe.");
      }

      setPasswordData(initialPasswordData);
      setPasswordErrors({});
      setToastMessage("Mot de passe mis a jour avec succes ✓");
      setShowSuccessToast(true);
    } catch (error) {
      setErrorMessage(error.message || "Erreur lors du changement de mot de passe.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {showSuccessToast && (
        <div className="fixed right-6 top-6 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-700 shadow-card-lg flex items-center gap-2 animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {toastMessage}
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Mon Profil"
          subtitle="Gerez vos informations personnelles et preferences"
        />

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {isLoadingProfile && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Chargement du profil...
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1" padding="lg">
            <div className="flex flex-col items-center text-center">
              <div
                className="group relative"
                onMouseEnter={() => setHoverAvatar(true)}
                onMouseLeave={() => setHoverAvatar(false)}
              >
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-3xl font-bold text-white shadow-lg shadow-blue-500/25 ring-4 ring-white">
                  {initials || "N H"}
                </div>
                <button
                  type="button"
                  className={`absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow transition-opacity ${
                    hoverAvatar ? "opacity-100" : "opacity-0"
                  }`}
                  title="Changer la photo"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
                    <path
                      fillRule="evenodd"
                      d="M9.344 3.071A1.5 1.5 0 0110.733 2h2.534a1.5 1.5 0 011.39 1.071L15.114 4.5H17.5A2.5 2.5 0 0120 7v9.5A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5V7a2.5 2.5 0 012.5-2.5h2.387l.457-1.429zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">{fullName}</h2>
              <span className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-bold text-blue-600">
                {formData.specialty}
              </span>
              <p className="mt-3 text-sm text-gray-500">{formData.institution}</p>
              <p className="mt-1 text-sm text-gray-500">Membre depuis Mars 2025</p>
            </div>

            <hr className="my-5 border-surface-border" />

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-blue-50/60 border border-blue-100/60 px-2 py-3 text-center">
                <p className="text-lg font-bold text-blue-600">48</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">Patients</p>
              </div>
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100/60 px-2 py-3 text-center">
                <p className="text-lg font-bold text-emerald-600">127</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">Analyses</p>
              </div>
              <div className="rounded-xl bg-violet-50/60 border border-violet-100/60 px-2 py-3 text-center">
                <p className="text-lg font-bold text-violet-600">89</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">Rapports</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2 text-sm font-medium text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Compte actif
            </div>

            <Button type="button" variant="outline" className="mt-5 w-full">
              Telecharger mon CV medical
            </Button>
          </Card>

          <Card className="lg:col-span-2" padding="lg">
            <div className="border-b border-slate-200/60">
              <nav className="-mb-px flex flex-wrap gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 pb-3 pt-1 text-sm font-semibold transition-all relative ${
                      activeTab === tab.id
                        ? "text-blue-600"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-6">
              {(activeTab === "personal" || activeTab === "professional") && (
                <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
                  {!editMode ? (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-blue-50/50"
                    >
                      ✏️ Modifier
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={isSaving}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
                      >
                        {isSaving ? "Enregistrement..." : "💾 Enregistrer"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-blue-50/50"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              )}

              {activeTab === "personal" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Prenom</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.firstName && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.lastName && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email professionnel</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Telephone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Date de naissance</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleChange("birthDate", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.birthDate && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.birthDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Sexe</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleChange("gender", e.target.value)}
                      disabled={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <option value="Homme">Homme</option>
                      <option value="Femme">Femme</option>
                    </select>
                    {fieldErrors.gender && <p className="mt-1 text-xs text-red-600">{fieldErrors.gender}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nationalite</label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => handleChange("nationality", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.nationality && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.nationality}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">CIN / Numero medecin</label>
                    <input
                      type="text"
                      value={formData.cin}
                      readOnly
                      className="w-full rounded-lg border border-surface-border bg-gray-100 px-3 py-2 text-sm text-gray-500"
                    />
                  </div>
                </div>
              )}

              {activeTab === "professional" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Specialite medicale</label>
                    <select
                      value={formData.specialty}
                      onChange={(e) => handleChange("specialty", e.target.value)}
                      disabled={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <option value="Neurologue">Neurologue</option>
                      <option value="Radiologue">Radiologue</option>
                      <option value="Neurochirurgien">Neurochirurgien</option>
                      <option value="Medecin generaliste">Medecin generaliste</option>
                    </select>
                    {fieldErrors.specialty && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.specialty}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Sous-specialite</label>
                    <input
                      type="text"
                      value={formData.subSpecialty}
                      onChange={(e) => handleChange("subSpecialty", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.subSpecialty && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.subSpecialty}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Etablissement / Hopital</label>
                    <input
                      type="text"
                      value={formData.institution}
                      onChange={(e) => handleChange("institution", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.institution && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.institution}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Service / Departement</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => handleChange("department", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.department && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.department}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Numero d'ordre national des medecins
                    </label>
                    <input
                      type="text"
                      value={formData.orderNumber}
                      readOnly
                      className="w-full rounded-lg border border-surface-border bg-gray-100 px-3 py-2 text-sm text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Annees d'experience</label>
                    <input
                      type="number"
                      value={formData.experienceYears}
                      onChange={(e) => handleChange("experienceYears", Number(e.target.value) || 0)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.experienceYears && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.experienceYears}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Langues parlees</label>
                    <div className="flex flex-wrap gap-2">
                      {["Francais", "Arabe", "Anglais"].map((lang) => {
                        const selected = formData.languages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={`rounded-full border px-3 py-1 text-sm transition ${
                              selected
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-surface-border bg-white text-gray-600"
                            } ${editMode ? "cursor-pointer" : "cursor-default"}`}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.languages && (
                      <p className="mt-2 text-xs text-red-600">{fieldErrors.languages}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Bio professionnelle</label>
                      <span className="text-xs text-gray-500">{formData.bio.length}/300</span>
                    </div>
                    <textarea
                      rows={4}
                      maxLength={300}
                      value={formData.bio}
                      onChange={(e) => handleChange("bio", e.target.value)}
                      readOnly={!editMode}
                      className={`w-full rounded-lg border border-surface-border px-3 py-2 text-sm ${
                        editMode ? "bg-white" : "bg-slate-50"
                      }`}
                    />
                    {fieldErrors.bio && <p className="mt-1 text-xs text-red-600">{fieldErrors.bio}</p>}
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Changer le mot de passe</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe actuel</label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                        />
                        {passwordErrors.currentPassword && (
                          <p className="mt-1 text-xs text-red-600">{passwordErrors.currentPassword}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => {
                            setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }));
                            setPasswordErrors((prev) => {
                              if (!prev.newPassword) return prev;
                              const next = { ...prev };
                              delete next.newPassword;
                              return next;
                            });
                          }}
                          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                        />
                        {passwordErrors.newPassword && (
                          <p className="mt-1 text-xs text-red-600">{passwordErrors.newPassword}</p>
                        )}
                        <div className="mt-2">
                          <div className="h-2 w-full rounded-full bg-gray-100">
                            <div
                              className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                              style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">Force: {passwordStrength.label}</p>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Confirmer le nouveau mot de passe
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => {
                            setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                            setPasswordErrors((prev) => {
                              if (!prev.confirmPassword) return prev;
                              const next = { ...prev };
                              delete next.confirmPassword;
                              return next;
                            });
                          }}
                          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                        />
                        {passwordErrors.confirmPassword && (
                          <p className="mt-1 text-xs text-red-600">{passwordErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                      {isChangingPassword
                        ? "Mise a jour..."
                        : "Mettre a jour le mot de passe"}
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Sessions actives</h3>
                    <div className="mt-3 overflow-hidden rounded-xl border border-surface-border">
                      <div className="flex flex-col divide-y divide-gray-100">
                        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3 text-sm text-gray-700">
                            <span className="mt-0.5 text-lg">🌐</span>
                            <div>
                              <p className="font-medium">Chrome · Windows · Sfax, Tunisie · Aujourd'hui 09:42</p>
                              <p className="mt-1 flex items-center gap-2 text-emerald-600">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Session actuelle
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3 text-sm text-gray-700">
                            <span className="mt-0.5 text-lg">🌐</span>
                            <p className="font-medium">Firefox · Mobile · Tunis, Tunisie · 29/03/2026</p>
                          </div>
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Revoquer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Authentification a deux facteurs</h3>
                    <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-surface-border bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Activer l'authentification a deux facteurs
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Renforcez la securite de votre compte avec un code envoye par email a chaque
                          connexion.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={preferences.twoFactorEnabled}
                        onChange={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            twoFactorEnabled: !prev.twoFactorEnabled,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "preferences" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Preferences d'affichage</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Langue de l'interface
                        </label>
                        <select
                          value={preferences.language}
                          onChange={(e) =>
                            setPreferences((prev) => ({ ...prev, language: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                        >
                          <option value="Francais">Francais</option>
                          <option value="English">English</option>
                          <option value="العربية">العربية</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Fuseau horaire</label>
                        <select
                          value={preferences.timezone}
                          onChange={(e) =>
                            setPreferences((prev) => ({ ...prev, timezone: e.target.value }))
                          }
                          className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                        >
                          <option value="Africa/Tunis (UTC+1)">Africa/Tunis UTC+1</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Format de date</label>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="dateFormat"
                            value="JJ/MM/AAAA"
                            checked={preferences.dateFormat === "JJ/MM/AAAA"}
                            onChange={(e) =>
                              setPreferences((prev) => ({ ...prev, dateFormat: e.target.value }))
                            }
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          JJ/MM/AAAA
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="dateFormat"
                            value="MM/DD/YYYY"
                            checked={preferences.dateFormat === "MM/DD/YYYY"}
                            onChange={(e) =>
                              setPreferences((prev) => ({ ...prev, dateFormat: e.target.value }))
                            }
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          MM/DD/YYYY
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
                    <div className="mt-4 space-y-3 rounded-xl border border-surface-border p-4">
                      {[
                        { key: "mriDone", label: "Nouvelle analyse MRI terminee" },
                        { key: "reportReady", label: "Rapport PDF pret au telechargement" },
                        { key: "complaintUpdated", label: "Reclamation mise a jour" },
                        { key: "securityAlerts", label: "Alertes de securite (compte)" },
                        { key: "newsletter", label: "Newsletter et mises a jour NeuroScan" },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm text-gray-700">{item.label}</p>
                          <ToggleSwitch
                            checked={notifications[item.key]}
                            onChange={() =>
                              setNotifications((prev) => ({
                                ...prev,
                                [item.key]: !prev[item.key],
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MonProfil;
