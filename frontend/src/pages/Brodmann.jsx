// frontend/src/pages/Brodmann.jsx
import React, { useEffect, useRef, useState } from "react";
import { getPatientSeries } from "../api";
import { useNavigate } from "react-router-dom";

/**
 * Brodmann.jsx - lecture du patientId depuis sessionStorage au chargement
 * - Attendu: Patients.jsx stocke sessionStorage.setItem("patientId", patientId) avant navigate("/brodmann")
 */

const ATLAS_PATIENT_ID = "brodmann";
const PLACEHOLDER = "/placeholder.png";

function ThumbImage({ url, alt, width = 80, height = 80, onClick, selected, onNotFound }) {
  const [src, setSrc] = useState(PLACEHOLDER);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();
    async function check() {
      if (!url) {
        setSrc(PLACEHOLDER);
        if (onNotFound) onNotFound(url);
        return;
      }
      try {
        const res = await fetch(url, { method: "HEAD", signal: ac.signal });
        if (!mountedRef.current) return;
        if (res.ok) setSrc(url);
        else {
          setSrc(PLACEHOLDER);
          if (onNotFound) onNotFound(url);
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        setSrc(PLACEHOLDER);
        if (onNotFound) onNotFound(url);
      }
    }
    check();
    return () => {
      mountedRef.current = false;
      ac.abort();
    };
  }, [url, onNotFound]);

  return (
    <img
      src={src}
      alt={alt || ""}
      style={{
        width,
        height,
        objectFit: "cover",
        border: selected ? "2px solid #3b82f6" : "1px solid #eee",
        cursor: src === PLACEHOLDER ? "default" : "pointer",
      }}
      onClick={() => src !== PLACEHOLDER && onClick && onClick()}
    />
  );
}

export default function BrodmannPage() {
  const [atlasSeries, setAtlasSeries] = useState([]);
  const [patientSeries, setPatientSeries] = useState([]);
  const [selectedAtlasRel, setSelectedAtlasRel] = useState(null);
  const [selectedAtlasJob, setSelectedAtlasJob] = useState(null);
  const [selectedPatientRel, setSelectedPatientRel] = useState(null);
  const [selectedPatientJob, setSelectedPatientJob] = useState(null);
  const [msg, setMsg] = useState("");
  const [tolerance, setTolerance] = useState(8);
  const navigate = useNavigate();

  const atlasImgRef = useRef(null);
  const patientImgRef = useRef(null);
  const atlasOverlayRef = useRef(null);
  const patientOverlayRef = useRef(null);
  const atlasOffRef = useRef(null);
  const patientOffRef = useRef(null);

  // NOTE: we DO NOT read sessionStorage here globally — we read it inside useEffect when loading
  useEffect(() => {
    async function load() {
      setMsg("Chargement des séries...");
      // read current value from sessionStorage at load time
      const sessionPatientId = sessionStorage.getItem("patientId") || null;
      console.debug("Brodmann: sessionPatientId =", sessionPatientId);

      try {
        // atlas
        try {
          const resAtlas = await getPatientSeries(ATLAS_PATIENT_ID);
          console.debug("atlasSeries raw:", resAtlas.data);
          setAtlasSeries(resAtlas.data || []);
        } catch (e) {
          console.warn("Impossible de charger la série atlas:", e);
          setAtlasSeries([]);
        }

        // patient (from sessionStorage)
        if (sessionPatientId) {
          try {
            const resPat = await getPatientSeries(sessionPatientId);
            console.debug("patientSeries raw:", resPat.data);
            setPatientSeries(resPat.data || []);
          } catch (e) {
            console.warn("Impossible de charger les séries du patient:", e);
            setPatientSeries([]);
            setMsg("Impossible de charger les coupes du patient (voir console).");
          }
        } else {
          setPatientSeries([]);
          setMsg("Patient non défini (définir via la page Patients).");
        }

      } catch (e) {
        console.error(e);
        setMsg("Erreur chargement séries (voir console).");
      } finally {
        // clear message if everything OK
        if (!atlasSeries.length && !patientSeries.length && !msg) {
          // keep any existing msg
        } else {
          setMsg("");
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const makeThumbUrl = (item) => {
    const jobId = item.job_id || item.jobId || item.job;
    const rel = item.relpath || item.filename || item.rel || "";
    if (!jobId || !rel) return null;
    return `/api/patient_file?jobId=${encodeURIComponent(jobId)}&relpath=${encodeURIComponent(rel)}`;
  };

  function syncOverlayToImage(imgEl, overlayCanvas) {
    if (!imgEl || !overlayCanvas) return;
    const rect = imgEl.getBoundingClientRect();
    const displayW = imgEl.clientWidth || rect.width || 1;
    const displayH = imgEl.clientHeight || rect.height || 1;
    overlayCanvas.style.position = "absolute";
    overlayCanvas.style.left = "0px";
    overlayCanvas.style.top = "0px";
    overlayCanvas.style.width = `${displayW}px`;
    overlayCanvas.style.height = `${displayH}px`;
    overlayCanvas.width = Math.max(1, Math.round(displayW));
    overlayCanvas.height = Math.max(1, Math.round(displayH));
    overlayCanvas.style.pointerEvents = "none";
    try {
      const cs = window.getComputedStyle(imgEl);
      overlayCanvas.style.transform = cs.transform || "none";
      overlayCanvas.style.transformOrigin = cs.transformOrigin || "50% 50%";
    } catch (e) { }
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  // When full image selected, prepare offscreen canvas
  useEffect(() => {
    if (!selectedAtlasRel || !selectedAtlasJob) {
      atlasOffRef.current = null;
      if (atlasOverlayRef.current) atlasOverlayRef.current.getContext("2d").clearRect(0, 0, atlasOverlayRef.current.width || 1, atlasOverlayRef.current.height || 1);
      return;
    }
    const img = atlasImgRef.current;
    const off = atlasOffRef.current || document.createElement("canvas");
    atlasOffRef.current = off;
    const onLoad = () => {
      const natW = img.naturalWidth || img.width || 1;
      const natH = img.naturalHeight || img.height || 1;
      off.width = natW;
      off.height = natH;
      const ctx = off.getContext("2d");
      ctx.clearRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0, off.width, off.height);
      if (atlasOverlayRef.current) syncOverlayToImage(img, atlasOverlayRef.current);
    };
    if (img) {
      if (img.complete) onLoad();
      else img.addEventListener("load", onLoad);
      return () => img.removeEventListener("load", onLoad);
    }
  }, [selectedAtlasRel, selectedAtlasJob]);

  useEffect(() => {
    if (!selectedPatientRel || !selectedPatientJob) {
      patientOffRef.current = null;
      if (patientOverlayRef.current) patientOverlayRef.current.getContext("2d").clearRect(0, 0, patientOverlayRef.current.width || 1, patientOverlayRef.current.height || 1);
      return;
    }
    const img = patientImgRef.current;
    const off = patientOffRef.current || document.createElement("canvas");
    patientOffRef.current = off;
    const onLoad = () => {
      const natW = img.naturalWidth || img.width || 1;
      const natH = img.naturalHeight || img.height || 1;
      off.width = natW;
      off.height = natH;
      const ctx = off.getContext("2d");
      ctx.clearRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0, off.width, off.height);
      if (patientOverlayRef.current) syncOverlayToImage(img, patientOverlayRef.current);
    };
    if (img) {
      if (img.complete) onLoad();
      else img.addEventListener("load", onLoad);
      return () => img.removeEventListener("load", onLoad);
    }
  }, [selectedPatientRel, selectedPatientJob]);

  useEffect(() => {
    const onResize = () => {
      if (atlasImgRef.current && atlasOverlayRef.current) syncOverlayToImage(atlasImgRef.current, atlasOverlayRef.current);
      if (patientImgRef.current && patientOverlayRef.current) syncOverlayToImage(patientImgRef.current, patientOverlayRef.current);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, []);

  function clientToImageNaturalCoords(imgEl, clientX, clientY) {
    if (!imgEl) return { x: 0, y: 0 };
    const rect = imgEl.getBoundingClientRect();
    const displayW = rect.width || 1;
    const displayH = rect.height || 1;
    const natW = imgEl.naturalWidth || imgEl.width || 1;
    const natH = imgEl.naturalHeight || imgEl.height || 1;
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;
    const nx = Math.round(Math.max(0, Math.min(natW - 1, (xRel / displayW) * natW)));
    const ny = Math.round(Math.max(0, Math.min(natH - 1, (yRel / displayH) * natH)));
    return { x: nx, y: ny };
  }

  function computeMaskFromClick(offcanvas, clickX, clickY, tol) {
    if (!offcanvas) return null;
    const w = offcanvas.width;
    const h = offcanvas.height;
    if (clickX < 0 || clickX >= w || clickY < 0 || clickY >= h) return { width: w, height: h, data: new Uint8Array(w * h) };
    const ctx = offcanvas.getContext("2d");
    const imgd = ctx.getImageData(0, 0, w, h);
    const data = imgd.data;
    const idx0 = (clickY * w + clickX) * 4;
    const target = Math.round((data[idx0] + data[idx0 + 1] + data[idx0 + 2]) / 3);
    const mask = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      mask[y * w + x] = 1;
      stack.push((y << 16) | x);
    };
    push(clickX, clickY);
    while (stack.length) {
      const code = stack.pop();
      const x = code & 0xffff;
      const y = code >>> 16;
      const nbs = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of nbs) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const pos = ny * w + nx;
        if (mask[pos]) continue;
        const di = pos * 4;
        const gi = Math.round((data[di] + data[di + 1] + data[di + 2]) / 3);
        if (Math.abs(gi - target) <= tol) {
          mask[pos] = 1;
          stack.push((ny << 16) | nx);
        }
      }
    }
    return { width: w, height: h, data: mask };
  }

  function drawMaskOnOverlay(mask, overlayCanvas, fillRGBA = "rgba(255,60,60,0.28)", strokeRGBA = "rgba(200,0,0,0.95)") {
    if (!mask || !overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const tmp = document.createElement("canvas");
    tmp.width = mask.width;
    tmp.height = mask.height;
    const tctx = tmp.getContext("2d");
    const id = tctx.createImageData(tmp.width, tmp.height);
    for (let i = 0, p = 0; i < mask.data.length; ++i, p += 4) {
      const m = mask.data[i] ? 255 : 0;
      id.data[p] = 255;
      id.data[p + 1] = 255;
      id.data[p + 2] = 255;
      id.data[p + 3] = m;
    }
    tctx.putImageData(id, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(tmp, 0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = fillRGBA;
    ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.globalCompositeOperation = "source-over";
    try {
      const small = document.createElement("canvas");
      small.width = Math.max(64, Math.min(256, mask.width));
      small.height = Math.max(64, Math.min(256, mask.height));
      const sctx = small.getContext("2d");
      sctx.clearRect(0, 0, small.width, small.height);
      sctx.drawImage(tmp, 0, 0, small.width, small.height);
      const sm = sctx.getImageData(0, 0, small.width, small.height);
      ctx.strokeStyle = strokeRGBA;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 1; y < small.height - 1; y++) {
        for (let x = 1; x < small.width - 1; x++) {
          const alpha = sm.data[(y * small.width + x) * 4 + 3];
          if (alpha > 10) {
            const nIdx = (a, b) => sm.data[(a * small.width + b) * 4 + 3];
            if (
              nIdx(y - 1, x) <= 10 ||
              nIdx(y + 1, x) <= 10 ||
              nIdx(y, x - 1) <= 10 ||
              nIdx(y, x + 1) <= 10
            ) {
              const ox = (x / small.width) * overlayCanvas.width;
              const oy = (y / small.height) * overlayCanvas.height;
              ctx.moveTo(ox, oy);
              ctx.arc(ox, oy, 1.2, 0, Math.PI * 2);
            }
          }
        }
      }
      ctx.stroke();
    } catch (e) {
      console.warn("stroke failed", e);
    }
    ctx.restore();
  }

  const onAtlasClick = (ev) => {
    if (!atlasImgRef.current || !atlasOffRef.current) {
      setMsg("Image atlas non prête.");
      return;
    }
    const pt = clientToImageNaturalCoords(atlasImgRef.current, ev.clientX, ev.clientY);
    const mask = computeMaskFromClick(atlasOffRef.current, pt.x, pt.y, parseInt(tolerance, 10));
    if (atlasOverlayRef.current) syncOverlayToImage(atlasImgRef.current, atlasOverlayRef.current);
    if (patientImgRef.current && patientOverlayRef.current) syncOverlayToImage(patientImgRef.current, patientOverlayRef.current);
    drawMaskOnOverlay(mask, atlasOverlayRef.current, "rgba(255,60,60,0.28)", "rgba(200,0,0,0.95)");
    if (patientOverlayRef.current) drawMaskOnOverlay(mask, patientOverlayRef.current, "rgba(60,255,120,0.26)", "rgba(0,160,0,0.9)");
    setMsg("Sélection appliquée.");
  };

  const handleNotFound = (url) => {
    if (!url) return;
    console.warn("Resource not found (HEAD):", url);
    setMsg(`Ressource introuvable: ${url} — vérifie le job_id / relpath côté serveur.`);
  };

  // markup (identique à ta version, on s'assure que les img src utilisent selectedJob + selectedRel)
  return (
    <div style={{ padding: 20 }}>
      <h1>Aperçu & sélection Brodmann</h1>
      <button
        onClick={() => {
          const pid = sessionStorage.getItem("patientId");
          if (!pid) { alert("Patient non défini."); return; }
          if (!selectedAtlasRel || !selectedAtlasJob) { alert("Sélectionne d'abord une coupe atlas."); return; }
          navigate("/brodmann3d", {
            state: {
              atlasId: ATLAS_PATIENT_ID,
              atlasRel: selectedAtlasRel,
              atlasJob: selectedAtlasJob,
              patientId: pid,
              patientRel: selectedPatientRel || null,
              patientJob: selectedPatientJob || null
            }
          });
        }}
      >
        Identifier sur 3D
      </button>



      <div style={{ marginBottom: 12, color: "#444" }}>
        <strong>Atlas:</strong> {ATLAS_PATIENT_ID}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 300 }}>
          <h3>Coupe atlas</h3>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {atlasSeries.length === 0 ? (
              <div style={{ color: "#666" }}>Aucune coupe atlas disponible.</div>
            ) : (
              atlasSeries.map((it, idx) => {
                const url = makeThumbUrl(it);
                const jobId = it.job_id || it.jobId || it.job || null;
                const rel = it.relpath || it.filename || it.rel || "";
                return (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <ThumbImage
                      url={url}
                      alt={rel}
                      selected={selectedAtlasRel === rel && selectedAtlasJob === jobId}
                      onClick={() => {
                        if (!jobId || !rel) { setMsg("Atlas : job_id ou relpath manquant."); return; }
                        setSelectedAtlasRel(rel);
                        setSelectedAtlasJob(jobId);
                        setMsg("");
                        if (atlasOverlayRef.current) atlasOverlayRef.current.getContext("2d").clearRect(0, 0, atlasOverlayRef.current.width || 1, atlasOverlayRef.current.height || 1);
                      }}
                      onNotFound={handleNotFound}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 12, maxWidth: 160, wordBreak: "break-word" }}>{rel}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { if (!jobId || !rel) { setMsg("Atlas : job_id ou relpath manquant."); return; } setSelectedAtlasRel(rel); setSelectedAtlasJob(jobId); }}>Sélectionner</button>
                        {url && <a href={url} target="_blank" rel="noreferrer"><button>Ouvrir</button></a>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ width: 300 }}>
          <h3>Coupe patient</h3>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {patientSeries.length === 0 ? (
              <div style={{ color: "#666" }}>Aucune coupe patient disponible (définis patient sur la page Patients).</div>
            ) : (
              patientSeries.map((it, idx) => {
                const url = makeThumbUrl(it);
                const jobId = it.job_id || it.jobId || it.job || null;
                const rel = it.relpath || it.filename || it.rel || "";
                return (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <ThumbImage
                      url={url}
                      alt={rel}
                      selected={selectedPatientRel === rel && selectedPatientJob === jobId}
                      onClick={() => {
                        if (!jobId || !rel) { setMsg("Patient : job_id ou relpath manquant."); return; }
                        setSelectedPatientRel(rel);
                        setSelectedPatientJob(jobId);
                        setMsg("");
                        if (patientOverlayRef.current) patientOverlayRef.current.getContext("2d").clearRect(0, 0, patientOverlayRef.current.width || 1, patientOverlayRef.current.height || 1);
                      }}
                      onNotFound={handleNotFound}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 12, maxWidth: 160, wordBreak: "break-word" }}>{rel}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { if (!jobId || !rel) { setMsg("Patient : job_id ou relpath manquant."); return; } setSelectedPatientRel(rel); setSelectedPatientJob(jobId); }}>Sélectionner</button>
                        {url && <a href={url} target="_blank" rel="noreferrer"><button>Ouvrir</button></a>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Aperçu & action</h3>
          <div style={{ marginBottom: 8, color: "#666" }}>{msg}</div>

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: "50%", position: "relative", border: "1px solid #ddd", padding: 8 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Atlas (cliquez pour choisir une aire)</div>
              <div style={{ position: "relative", width: "100%", paddingTop: "100%", background: "#fff" }}>
                {selectedAtlasRel && selectedAtlasJob ? (
                  <>
                    <img
                      ref={atlasImgRef}
                      src={`/api/patient_file?jobId=${encodeURIComponent(selectedAtlasJob)}&relpath=${encodeURIComponent(selectedAtlasRel)}`}
                      alt="atlas"
                      onClick={onAtlasClick}
                      onError={() => handleNotFound(`/api/patient_file?jobId=${encodeURIComponent(selectedAtlasJob)}&relpath=${encodeURIComponent(selectedAtlasRel)}`)}
                      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "contain", cursor: "crosshair" }}
                    />
                    <canvas ref={atlasOverlayRef} style={{ position: "absolute", left: 0, top: 0 }} />
                  </>
                ) : (
                  <div style={{ position: "absolute", left: 8, top: 8, color: "#666" }}>Aucune coupe atlas sélectionnée</div>
                )}
              </div>
            </div>

            <div style={{ width: "50%", position: "relative", border: "1px solid #ddd", padding: 8 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Patient (zone projetée)</div>
              <div style={{ position: "relative", width: "100%", paddingTop: "100%", background: "#fff" }}>
                {selectedPatientRel && selectedPatientJob ? (
                  <>
                    <img
                      ref={patientImgRef}
                      src={`/api/patient_file?jobId=${encodeURIComponent(selectedPatientJob)}&relpath=${encodeURIComponent(selectedPatientRel)}`}
                      alt="patient"
                      onError={() => handleNotFound(`/api/patient_file?jobId=${encodeURIComponent(selectedPatientJob)}&relpath=${encodeURIComponent(selectedPatientRel)}`)}
                      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "contain" }}
                    />
                    <canvas ref={patientOverlayRef} style={{ position: "absolute", left: 0, top: 0 }} />
                  </>
                ) : (
                  <div style={{ position: "absolute", left: 8, top: 8, color: "#666" }}>
                    Patient non défini ou aucune coupe sélectionnée.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <label>Tolérance (gris) :</label>
            <input type="range" min={0} max={60} value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value, 10))} />
            <div style={{ width: 40, textAlign: "center" }}>{tolerance}</div>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => {
                if (atlasOverlayRef.current) atlasOverlayRef.current.getContext("2d").clearRect(0, 0, atlasOverlayRef.current.width || 1, atlasOverlayRef.current.height || 1);
                if (patientOverlayRef.current) patientOverlayRef.current.getContext("2d").clearRect(0, 0, patientOverlayRef.current.width || 1, patientOverlayRef.current.height || 1);
                setMsg("Overlays effacés");
              }}>Effacer sélection</button>
            </div>
          </div>

          <div style={{ marginTop: 8, color: "#666" }}>
            Cliquez sur l'atlas pour choisir une aire — le même masque sera projeté sur l'image du patient si celui-ci est sélectionné.
          </div>
        </div>
      </div>
    </div>
  );
}
