// frontend/src/pages/Upload.jsx
import React, { useState, useEffect, useRef } from "react";
import { uploadTwo, alignJob, getJobTform, applyTform, uploadSeries } from "../api";
import ImagePointSelector from "../components/ImagePointSelector";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const navigate = useNavigate();

  const [patientId, setPatientId] = useState("patient001");
  const [refFile, setRefFile] = useState(null);
  const [patFile, setPatFile] = useState(null);
  const [ctPreview, setCtPreview] = useState("");
  const [patPreview, setPatPreview] = useState("");
  const [jobId, setJobId] = useState(null);
  const [ctPts, setCtPts] = useState([]);
  const [patPts, setPatPts] = useState([]);
  const [resultUrl, setResultUrl] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [tform, setTform] = useState(null);
  const [affineMat, setAffineMat] = useState(null);

  const lastBlobRef = useRef(null);
  const lastOverlayRef = useRef(null);

  // series selection (FILES) - we store files but we DO NOT auto-upload them
  const [seriesFiles, setSeriesFiles] = useState([]); // Array<File>
  const [seriesBusy, setSeriesBusy] = useState(false);
  const [seriesResult, setSeriesResult] = useState(null); // backend response for upload_series

  // Pré-remplir patientId si on vient de la page Patients (sessionStorage)
  useEffect(() => {
    const pid = sessionStorage.getItem("patientId");
    if (pid) {
      setPatientId(pid);
      sessionStorage.removeItem("patientId");
    }
    const jid = sessionStorage.getItem("jobId");
    if (jid) {
      setJobId(jid);
    }
  }, []);

  // === Upload two images (CT + patient) ===
  const doUpload = async () => {
    if (!refFile || !patFile) {
      alert("Choisis les deux images (CT et Patient)");
      return;
    }
    setBusy(true);
    setMsg("Upload en cours...");
    try {
      const res = await uploadTwo(patientId, refFile, patFile);
      const data = res.data || {};
      const id = data.jobId || data.job_id;
      if (id) {
        setJobId(id);
        sessionStorage.setItem("jobId", id);
      }
      if (data.refPreview) setCtPreview(`data:image/png;base64,${data.refPreview}`);
      if (data.patPreview) setPatPreview(`data:image/png;base64,${data.patPreview}`);
      setMsg("Upload réussi ✅ — Sélectionne les points ou applique un prétraitement.");
      // reset previous result/overlay
      if (lastBlobRef.current) { URL.revokeObjectURL(lastBlobRef.current); lastBlobRef.current = null; }
      if (lastOverlayRef.current) { lastOverlayRef.current = null; setOverlayUrl(null); }
      setResultUrl(null);
      setTform(null); setAffineMat(null);
    } catch (err) {
      console.error("doUpload error:", err);
      setMsg("❌ Erreur pendant l’upload (voir console).");
    } finally {
      setBusy(false);
    }
  };

  // === Points callback ===
  const onPointsChange = (ct, pat) => {
    setCtPts(ct);
    setPatPts(pat);
  };

  // overlay builder (identique à ton code)
  const buildOverlayFromRefAndWarp = async (refDataUrl, warpedBlob) => {
    return new Promise((resolve, reject) => {
      try {
        const imgRef = new Image();
        const imgWarp = new Image();
        imgRef.crossOrigin = "anonymous";
        imgWarp.crossOrigin = "anonymous";

        imgRef.onload = () => {
          imgWarp.onload = () => {
            const w = 512, h = 512;
            const cRef = document.createElement("canvas"); cRef.width = w; cRef.height = h;
            const ctxRef = cRef.getContext("2d"); ctxRef.drawImage(imgRef, 0, 0, w, h);
            const refData = ctxRef.getImageData(0, 0, w, h).data;

            const cWarp = document.createElement("canvas"); cWarp.width = w; cWarp.height = h;
            const ctxWarp = cWarp.getContext("2d"); ctxWarp.drawImage(imgWarp, 0, 0, w, h);
            const warpData = ctxWarp.getImageData(0, 0, w, h).data;

            const cOut = document.createElement("canvas"); cOut.width = w; cOut.height = h;
            const ctxOut = cOut.getContext("2d");
            const outImg = ctxOut.createImageData(w, h);
            const outData = outImg.data;

            for (let i = 0, j = 0; i < outData.length; i += 4, j += 4) {
              const refR = refData[j];
              const warpR = warpData[j];
              outData[i + 0] = warpR;
              outData[i + 1] = refR;
              outData[i + 2] = refR;
              outData[i + 3] = 255;
            }
            ctxOut.putImageData(outImg, 0, 0);
            const dataUrl = cOut.toDataURL("image/png");
            resolve(dataUrl);
          };
          imgWarp.src = URL.createObjectURL(warpedBlob);
        };
        imgRef.src = refDataUrl;
      } catch (e) {
        reject(e);
      }
    });
  };

  // === Align (single result) ===
  const doAlign = async () => {
    if (!jobId) return alert("Fais d'abord un upload.");
    if (ctPts.length < 3 || ctPts.length !== patPts.length)
      return alert("Au moins 3 paires de points identiques nécessaires.");

    setBusy(true);
    setMsg("Alignement en cours...");
    try {
      const res = await alignJob(jobId, ctPts, patPts); // responseType blob
      const blob = res.data;

      if (lastBlobRef.current) { URL.revokeObjectURL(lastBlobRef.current); lastBlobRef.current = null; }
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      lastBlobRef.current = url;

      if (ctPreview) {
        try {
          const overlayDataUrl = await buildOverlayFromRefAndWarp(ctPreview, blob);
          setOverlayUrl(overlayDataUrl);
          lastOverlayRef.current = overlayDataUrl;
        } catch (err) {
          console.warn("Impossible de créer l'overlay:", err);
        }
      }
      setMsg("✅ Alignement terminé.");
    } catch (err) {
      console.error(err);
      setMsg("❌ Erreur pendant l'alignement (voir console).");
    } finally {
      setBusy(false);
    }
  };

  // === Fetch tform matrix ===
  const fetchTform = async () => {
    if (!jobId) return alert("Fais d'abord un upload / crée un job.");
    setBusy(true);
    setMsg("Récupération de la transformation...");
    try {
      const res = await getJobTform(jobId);
      const data = res.data;
      const tf = data.tform || data;
      if (!tf || !tf.rotation) {
        setMsg("Le serveur n'a pas renvoyé de tform valide.");
        setTform(null); setAffineMat(null);
      } else {
        setTform(tf);
        const T = tf.rotation;
        const b = Number(tf.scale);
        const c = tf.translation;
        const M = [
          [b * T[0][0], b * T[1][0], c[0]],
          [b * T[0][1], b * T[1][1], c[1]],
        ];
        setAffineMat(M);
        setMsg("Transformation récupérée ✅");
      }
    } catch (err) {
      console.error("Erreur fetch tform:", err);
      setMsg("❌ Erreur lors de la récupération du tform (voir console).");
    } finally {
      setBusy(false);
    }
  };

  // === Handle folder select: store files but do NOT upload automatically ===
  const handleSeriesFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      setSeriesFiles([]);
      return;
    }
    setSeriesFiles(files);
    setSeriesResult(null);
    setMsg(`${files.length} fichiers sélectionnés — clique sur "Aligner la série" pour envoyer et appliquer la transformation.`);
    // reset input so same folder can be reselected later
    e.target.value = null;
  };

  // === Align / upload series button handler ===
  const handleAlignAndUploadSeries = async () => {
    const job = jobId || sessionStorage.getItem("jobId");
    if (!job) {
      alert("Job manquant — fais d'abord l'upload (CT + patient) pour créer un job.");
      return;
    }
    if (!seriesFiles || seriesFiles.length === 0) {
      alert("Sélectionne un dossier de la série d'abord.");
      return;
    }

    setSeriesBusy(true);
    setMsg("Vérification transformation (tform) et upload de la série...");
    try {
      // 1) Vérifier que le serveur a un tform pour ce job
      try {
        const tfRes = await getJobTform(job);
        if (!tfRes.data || !tfRes.data.tform) {
          alert("Aucune transformation disponible pour ce job. Fais l'alignement d'abord.");
          setSeriesBusy(false);
          return;
        }
      } catch (err) {
        // si erreur 404 -> pas de tform, on avertit
        console.error("getJobTform error:", err);
        alert("Impossible de récupérer la transformation pour ce job. Vérifie que l'alignement a été effectué.");
        setSeriesBusy(false);
        return;
      }

      // 2) Construire FormData
      const fd = new FormData();
      fd.append('jobId', job);
      fd.append('patient_id', patientId || "");
      seriesFiles.forEach(f => fd.append('files', f, f.webkitRelativePath || f.name));

      // 3) Appel uploadSeries
      const res = await uploadSeries(fd);
      const data = res.data || {};
      setSeriesResult(data);
      setMsg(`Série stockée pour patient ${data.patient_id} — ${data.produced} fichiers. (series_id: ${data.series_id})`);
    } catch (err) {
      console.error("Erreur uploadSeries:", err);
      setMsg("❌ Erreur lors de l'upload de la série (voir console).");
      alert("Erreur uploadSeries: regarde la console pour plus de détails.");
    } finally {
      setSeriesBusy(false);
      // on peut garder les fichiers sélectionnés pour réessayer si besoin
    }
  };

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (lastBlobRef.current) { URL.revokeObjectURL(lastBlobRef.current); lastBlobRef.current = null; }
    };
  }, []);

  // helper: go to patients page
  const goToPatients = () => {
    // utilise react-router navigation
    navigate("/Patients");
  };

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 16, maxWidth: 1400, margin: "auto" }}>
        <h1>Recalage</h1>

        <div style={{ marginBottom: 8 }}>
          <button onClick={goToPatients}>Voir patients</button>
        </div>

        <div style={{ marginBottom: 12, color: "#666" }}>{msg || "Prêt"}</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input type="file" onChange={(e) => setRefFile(e.target.files?.[0] || null)} />
          <input type="file" onChange={(e) => setPatFile(e.target.files?.[0] || null)} />
          <button onClick={doUpload} disabled={busy}>Upload</button>
        </div>

        {ctPreview && patPreview && (
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <h4>CT (Référence)</h4>
              <ImagePointSelector ctSrc={ctPreview} patSrc={patPreview} onPointsChange={onPointsChange} />
            </div>

            <div style={{ width: 420 }}>
              <h4>Aperçu résultat</h4>
              <div style={{ background: "#f9fafb", padding: 8, borderRadius: 8, border: "1px dashed #e5e7eb" }}>
                {resultUrl ? (
                  <>
                    <img src={resultUrl} alt="result" style={{ width: "100%", marginBottom: 8 }} />
                    <a href={resultUrl} download="result.png"><button>Télécharger résultat</button></a>
                  </>
                ) : (
                  <div style={{ color: "#6b7280", marginBottom: 8 }}>Le résultat apparaîtra ici après alignement.</div>
                )}

                <div style={{ marginTop: 12 }}>
                  <button onClick={doAlign} disabled={!jobId || busy}>Aligner</button>
                  <button onClick={fetchTform} disabled={!jobId || busy} style={{ marginLeft: 8 }}>Récupérer la matrice (tform)</button>
                </div>

                {overlayUrl && (
                  <>
                    <h5 style={{ marginTop: 12 }}>Superposition (rouge = recalée, vert/bleu = réf)</h5>
                    <img src={overlayUrl} alt="overlay" style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6 }} />
                  </>
                )}

                {tform && (
                  <div style={{ marginTop: 12, background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #eee" }}>
                    <strong>tform (Procrustes)</strong>
                    <div style={{ fontFamily: "monospace", fontSize: 13, marginTop: 6 }}>
                      <div>rotation:</div>
                      <div>{JSON.stringify(tform.rotation)}</div>
                      <div>scale: {Number(tform.scale).toFixed(6)}</div>
                      <div>translation: [{tform.translation[0].toFixed(2)}, {tform.translation[1].toFixed(2)}]</div>
                    </div>
                    {affineMat && (
                      <>
                        <div style={{ marginTop: 8 }}><strong>M (2×3) utilisée pour warpAffine :</strong></div>
                        <table style={{ width: "100%", fontFamily: "monospace", marginTop: 6, borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[0][0].toFixed(6)}</td>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[0][1].toFixed(6)}</td>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[0][2].toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[1][0].toFixed(6)}</td>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[1][1].toFixed(6)}</td>
                              <td style={{ padding: 4, border: "1px solid #eee" }}>{affineMat[1][2].toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}

                {/* ----- Choisir dossier local de la série (ne lance plus l'upload automatiquement) ----- */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Choisir un dossier de la série (depuis ton PC)</strong></div>

                  <label style={{ display: "block", marginBottom: 8 }}>
                    Patient ID pour cette série :
                    <input
                      type="text"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      style={{ width: "100%", marginTop: 6 }}
                      placeholder="Entrez un patient_id (ex: patient001)"
                    />
                  </label>

                  <input
                    type="file"
                    webkitdirectory="true"
                    directory=""
                    multiple
                    onChange={handleSeriesFolderSelect}
                    disabled={!jobId || seriesBusy || busy}
                    style={{ marginTop: 6 }}
                  />

                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button onClick={handleAlignAndUploadSeries} disabled={!jobId || seriesBusy || busy}>Aligner la série</button>
                    <button onClick={() => { setSeriesFiles([]); setSeriesResult(null); setMsg("Sélection de série réinitialisée."); }}>Réinitialiser sélection</button>
                  </div>

                  <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                    Sélectionne un dossier local : le navigateur enverra récursivement les fichiers lorsque tu cliques sur "Aligner la série".
                    Le serveur appliquera la transformation (doit avoir été calculée via "Aligner") et stockera la série côté serveur (DB).
                  </div>

                  {/* message & result (sous le sélecteur) */}
                  {seriesFiles && seriesFiles.length > 0 && (
                    <div style={{ marginTop: 8, background: "#fff", padding: 8, border: "1px solid #eee" }}>
                      <strong>Fichiers sélectionnés :</strong> {seriesFiles.length}
                    </div>
                  )}

                  {seriesResult && (
                    <div style={{ marginTop: 8, background: "#e6ffed", padding: 8, border: "1px solid #cfe9d6" }}>
                      Série stockée pour patient <strong>{seriesResult.patient_id}</strong> — {seriesResult.produced} fichiers.
                      {seriesResult.series_id && <div>id série: {seriesResult.series_id}</div>}
                      {seriesResult.removed_old_series !== undefined && <div>Anciennes séries supprimées: {seriesResult.removed_old_series}</div>}
                    </div>
                  )}

                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
