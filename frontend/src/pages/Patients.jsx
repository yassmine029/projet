// frontend/src/pages/Patients.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getPatients, getPatientSeries } from "../api";

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [series, setSeries] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [creatingDB, setCreatingDB] = useState(false);
  const [error, setError] = useState(null);

  const normalizePatients = (raw) => {
    // raw can be: array of strings, array of objects with patient_id or _id, or unexpected -> normalize to { patient_id, _id?, meta? }
    if (!Array.isArray(raw)) return [];
    return raw.map((p, idx) => {
      if (typeof p === "string") {
        return { patient_id: p, _id: `str-${idx}` };
      }
      if (p && typeof p === "object") {
        // prefer explicit patient_id, then fallback to _id or name
        const pid = p.patient_id || p.patient || p.name || (p._id ? String(p._id) : `patient-${idx}`);
        return { ...p, patient_id: pid, _id: p._id ? String(p._id) : `obj-${idx}` };
      }
      return { patient_id: `patient-${idx}`, _id: `unk-${idx}` };
    });
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setError(null);
    try {
      const res = await getPatients();
      // debug: console.debug("getPatients raw:", res.data);
      const parsed = normalizePatients(res.data || []);
      setPatients(parsed);
    } catch (err) {
      console.error("getPatients error:", err);
      setError("Erreur lors de la récupération des patients (voir console).");
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSeries = async (patientId) => {
    setSelected(patientId);
    setSeries([]);
    setLoadingSeries(true);
    try {
      const res = await getPatientSeries(patientId);
      setSeries(res.data || []);
    } catch (err) {
      console.error("getPatientSeries error:", err);
      setSeries([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const downloadPatient = (patientId) => {
    if (!patientId) {
      alert("Patient non spécifié.");
      return;
    }
    window.location.href = `/api/patient/${encodeURIComponent(patientId)}/download`;
  };

  const deletePatient = async (patientId) => {
    if (!patientId) {
      alert("Patient non spécifié.");
      return;
    }
    if (!window.confirm(`Confirmer la suppression de toutes les séries pour "${patientId}" ?`)) return;
    try {
      await api.delete(`/patient/${encodeURIComponent(patientId)}`);
      // rafraîchir la liste des patients
      await fetchPatients();
      if (selected === patientId) {
        setSelected(null);
        setSeries([]);
      }
    } catch (err) {
      console.error("deletePatient error:", err);
      alert("Erreur lors de la suppression (voir console).");
    }
  };

  /** Création base tunisienne (moyenne) **/
  const createTunisianDB = async () => {
    if (patients.length === 0) {
      alert("Aucun patient disponible pour créer la base de données tunisienne.");
      return;
    }
    if (!window.confirm("Créer la base de données tunisienne à partir des patients existants ?")) return;

    setCreatingDB(true);
    setError(null);
    try {
      const res = await api.post("/create_tunisian_db");
      console.debug("create_tunisian_db:", res.data);
      alert("✅ Base de données tunisienne créée avec succès !");
      // rafraîchir patients / averages si besoin
      await fetchPatients();
      if (window.confirm("Souhaitez-vous accéder à la page Prediction ?")) {
        navigate("/prediction");
      }
    } catch (err) {
      console.error("Erreur lors de la création de la base tunisienne :", err);
      setError("Erreur lors de la création de la base tunisienne. Voir console pour détails.");
      alert("❌ Erreur lors de la création de la base tunisienne. Voir la console.");
    } finally {
      setCreatingDB(false);
    }
  };

  // Navigate to Brodmann page for a given patient
  const goToBrodmann = (patientId) => {
    if (!patientId) {
      alert("Patient non spécifié.");
      return;
    }
    // Pass patientId in location.state so the Brodmann page can read it
    navigate("/brodmann", { state: { patientId } });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Patients</h1>

      {/* TOP CONTROLS */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <button onClick={() => navigate("/upload")}>Recaler un nouveau patient</button>
        <button onClick={fetchPatients} disabled={loadingPatients}>
          Rafraîchir
        </button>

        <button
          onClick={createTunisianDB}
          disabled={creatingDB || loadingPatients}
          style={{
            backgroundColor: "#008080",
            color: "white",
            borderRadius: 6,
            padding: "6px 10px",
            border: "none",
            cursor: "pointer",
          }}
          title="Crée une série moyenne (base tunisienne) à partir de toutes les séries existantes"
        >
          {creatingDB ? "Création en cours..." : "Créer une base de données tunisienne"}
        </button>

        <div style={{ marginLeft: "auto", color: "#666" }}>
          {loadingPatients ? "Chargement des patients..." : `${patients.length} patients`}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: "crimson", background: "#fff6f6", padding: 8, borderRadius: 6 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 20 }}>
        {/* LISTE DES PATIENTS */}
        <div style={{ width: 340, maxHeight: "70vh", overflowY: "auto" }}>
          <h3>Liste</h3>
          <ul style={{ paddingLeft: 0, margin: 0 }}>
            {patients.length === 0 ? (
              <li style={{ listStyle: "none", color: "#666" }}>Aucun patient trouvé.</li>
            ) : (
              patients.map((p, idx) => {
                const key = p._id || p.patient_id || `p-${idx}`;
                const label = p.patient_id || p.name || p._id || `patient-${idx}`;
                return (
                  <li
                    key={key}
                    style={{
                      marginBottom: 8,
                      listStyle: "none",
                      padding: 8,
                      borderRadius: 6,
                      background: selected === label ? "#f0f9ff" : "transparent",
                      border: selected === label ? "1px solid #cfe8ff" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => loadSeries(label)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <strong>{label}</strong>

                        {/* NEW: Identifier les zones Brodmann */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sessionStorage.setItem("patientId", label);
                            //sessionStorage.setItem("jobId", jobId);
                            //navigate("/brodmann3d", { state: { patientId: label, jobId } });
                            goToBrodmann(label);
                          }}
                          title="Identifier les zones de Brodmann pour ce patient"
                          style={{
                            backgroundColor: "#2b7a78",
                            color: "white",
                            border: "none",
                            padding: "6px 8px",
                            borderRadius: 4,
                            cursor: "pointer"
                          }}
                        >
                          Identifier les zones Brodmann
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); loadSeries(label); }}
                        >
                          Voir
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sessionStorage.setItem("patientId", label);
                            navigate("/upload");
                          }}
                        >
                          Recaler
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={(e) => { e.stopPropagation(); downloadPatient(label); }}>Télécharger</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePatient(label); }}
                          style={{ color: "crimson", borderColor: "rgba(220,0,0,0.2)" }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* AFFICHAGE DE LA SÉRIE */}
        <div style={{ flex: 1 }}>
          <h3>Série pour : {selected || "—"}</h3>

          {loadingSeries ? (
            <div style={{ color: "#666" }}>Chargement de la série...</div>
          ) : series.length === 0 ? (
            <div style={{ color: "#666" }}>Aucune série chargée.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 160px)", gap: 12 }}>
              {series.map((item, idx) => {
                const rel = item.relpath || item.filename || "";
                const jobId = item.jobId || item.job_id || item.job || "";
                const key = `${item.series_id || item._id || idx}:${rel || idx}`;
                const thumbUrl = jobId
                  ? `/api/patient_file?jobId=${encodeURIComponent(jobId)}&relpath=${encodeURIComponent(rel)}`
                  : null;

                return (
                  <div
                    key={key}
                    style={{ border: "1px solid #eee", padding: 6, borderRadius: 4, background: "#fff" }}
                  >
                    {thumbUrl ? (
                      <a href={thumbUrl} target="_blank" rel="noreferrer">
                        <img
                          src={thumbUrl}
                          alt={rel || `img-${idx}`}
                          style={{
                            width: "100%",
                            height: 100,
                            objectFit: "cover",
                            display: "block",
                            marginBottom: 6,
                          }}
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.png";
                          }}
                        />
                      </a>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: 100,
                          background: "#f3f3f3",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                      >
                        <small style={{ color: "#777" }}>Aperçu indisponible</small>
                      </div>
                    )}

                    <div style={{ fontSize: 12, marginBottom: 6, wordBreak: "break-word" }}>
                      {rel || "(ref)"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
