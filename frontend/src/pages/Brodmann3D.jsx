// frontend/src/pages/Brodmann3D.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../api"; // axios instance with baseURL '/api' or 'http://localhost:5000/api'
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function Brodmann3D() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [series, setSeries] = useState([]);
  const [sliceUrls, setSliceUrls] = useState([]);
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);

  const mountRef = useRef(null);
  const threeStateRef = useRef({ renderer: null, scene: null, camera: null, controls: null, meshGroup: null });

  useEffect(() => {
    fetchPatients();
    return () => {
      sliceUrls.forEach((u) => URL.revokeObjectURL(u));
      disposeThree();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPatients() {
    setMsg("Chargement patients...");
    try {
      const res = await api.get("/patients");
      const raw = res?.data ?? [];
      const normalized = (Array.isArray(raw) ? raw : []).map((it) => ({
        patient_id: it.patient_id ?? it.patientId ?? it.id ?? it._id,
        job_ids: Array.isArray(it.job_ids) ? it.job_ids : it.job_id ? [it.job_id] : [],
        files: Array.isArray(it.files) ? it.files : [],
        raw: it,
      }));
      const byId = {};
      for (const p of normalized) {
        if (!p.patient_id) continue;
        if (!byId[p.patient_id]) byId[p.patient_id] = { ...p };
        else {
          byId[p.patient_id].job_ids = Array.from(new Set([...(byId[p.patient_id].job_ids || []), ...(p.job_ids || [])]));
          byId[p.patient_id].files = Array.from(new Set([...(byId[p.patient_id].files || []), ...(p.files || [])]));
        }
      }
      setPatients(Object.values(byId));
      setMsg("");
    } catch (e) {
      console.error("fetchPatients error:", e);
      setPatients([]);
      setMsg("Erreur récupération patients (voir console).");
    }
  }

  async function handleSelectPatient(p) {
    if (!p || !p.patient_id) {
      setMsg("Patient invalide.");
      return;
    }
    setSelectedPatient(p);
    setMsg("Chargement séries...");
    try {
      const res = await api.get(`/patient/${encodeURIComponent(p.patient_id)}/series`);
      const raw = res?.data ?? [];
      const normalized = (Array.isArray(raw) ? raw : []).map((it, idx) => ({
        job_id: it.job_id ?? it.jobId ?? it.job ?? null,
        relpath: it.relpath ?? it.filename ?? it.rel ?? (Array.isArray(it.files) && it.files.length ? it.files[0] : null),
        files: Array.isArray(it.files) ? it.files : [],
        raw: it,
        _idx: idx,
      }));
      const seen = new Set();
      const dedup = [];
      for (const s of normalized) {
        const key = s.job_id ?? s.relpath ?? s._idx;
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(s);
      }
      setSeries(dedup);
      setSliceUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
      setMsg("");
    } catch (e) {
      console.error("handleSelectPatient error:", e);
      setSeries([]);
      setMsg("Erreur chargement séries (voir console).");
    }
  }

  async function loadSeriesPreview(entry) {
    if (!entry || !entry.job_id) {
      setMsg("Cette série n'a pas de job_id.");
      return;
    }
    setMsg("Chargement coupes (preview)...");
    sliceUrls.forEach((u) => URL.revokeObjectURL(u));
    setSliceUrls([]);
    const urls = [];
    const toLoad = entry.files && entry.files.length ? entry.files.slice(0, 60) : entry.relpath ? [entry.relpath] : [];
    for (const f of toLoad) {
      try {
        const resp = await api.get("/patient_file", { params: { jobId: entry.job_id, relpath: f }, responseType: "blob" });
        const blob = resp.data;
        const u = URL.createObjectURL(blob);
        urls.push(u);
      } catch (e) {
        console.warn("getPatientFile failed", entry.job_id, f, e);
      }
    }
    setSliceUrls(urls);
    setMsg("");
  }

  async function handleTo3D(entryOrJobOrPatient, clean = false) {
    let jobId = null;
    let patientId = null;
    if (typeof entryOrJobOrPatient === "string") jobId = entryOrJobOrPatient;
    else if (entryOrJobOrPatient && entryOrJobOrPatient.job_id) jobId = entryOrJobOrPatient.job_id;
    else if (entryOrJobOrPatient && entryOrJobOrPatient.patient_id) patientId = entryOrJobOrPatient.patient_id;
    else if (selectedPatient && selectedPatient.patient_id) patientId = selectedPatient.patient_id;

    if (!jobId && !patientId) {
      setMsg("Aucun jobId trouvé — sélectionne une série ou vérifie la BD.");
      return;
    }

    setGenerating(true);
    setMsg(clean ? "Génération 3D (clean)..." : "Génération 3D...");
    try {
      let res;
      if (jobId) {
        const path = `/job/${encodeURIComponent(jobId)}/to3d` + (clean ? "?clean=1" : "");
        res = await api.post(path);
      } else {
        const path = `/patient/${encodeURIComponent(patientId)}/to3d` + (clean ? "?clean=1" : "");
        res = await api.post(path);
      }
      const model_url = (res?.data && (res.data.model_url || res.data.modelUrl)) || null;
      const format = (res?.data && (res.data.format || "obj")) || "obj";

      if (!model_url) {
        const pollPath = jobId ? `/job/${encodeURIComponent(jobId)}/model?format=${format}` : `/patient/${encodeURIComponent(patientId)}/model?format=${format}`;
        try {
          await api.head(pollPath);
          const mp = pollPath.startsWith("/api/") ? pollPath.replace("/api/", "") : pollPath.replace(/^\//, "");
          const modelResp = await api.get(mp, { responseType: "blob" });
          await displayModelBlob(modelResp.data, format);
          setMsg("Modèle 3D affiché.");
        } catch (headErr) {
          console.warn("model not ready yet", headErr);
          setMsg("Génération lancée — le modèle n'est pas encore disponible. Ré-essaye dans quelques secondes.");
        } finally {
          setGenerating(false);
        }
        return;
      }

      let modelPath = model_url;
      if (modelPath.startsWith("/api/")) modelPath = modelPath.replace("/api/", "");
      else if (modelPath.startsWith("/")) modelPath = modelPath.substring(1);
      const modelResp = await api.get(modelPath, { responseType: "blob" });
      await displayModelBlob(modelResp.data, format);
      setMsg("Modèle 3D affiché.");
    } catch (err) {
      console.error("patient to3d error", err);
      setMsg("Erreur génération / affichage 3D (voir console).");
    } finally {
      setGenerating(false);
    }
  }

  async function displayModelBlob(blob, fmt = "obj") {
    await loadModelToThree(blob, fmt);
  }

  // ---- three helpers ----
  const initThree = () => {
    if (!mountRef.current) return;
    disposeThree();
    const w = mountRef.current.clientWidth || 800;
    const h = mountRef.current.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.display = "block";
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    camera.position.set(0, 0, 300);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);

    threeStateRef.current = { renderer, scene, camera, controls, meshGroup, _rafId: null };

    const animate = () => {
      const s = threeStateRef.current;
      if (!s || !s.renderer) return;
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
      s._rafId = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener("resize", onWindowResize);
  };

  const disposeThree = () => {
    const s = threeStateRef.current;
    if (!s) return;
    try {
      window.removeEventListener("resize", onWindowResize);
      if (s._rafId) cancelAnimationFrame(s._rafId);
      if (s.renderer && s.renderer.domElement && s.renderer.domElement.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
      if (s.scene) {
        s.scene.traverse((obj) => {
          if (obj.geometry) try { obj.geometry.dispose(); } catch (e) {}
          if (obj.material) try {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m && m.dispose && m.dispose());
            else obj.material.dispose && obj.material.dispose();
          } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("disposeThree error", e);
    } finally {
      threeStateRef.current = { renderer: null, scene: null, camera: null, controls: null, meshGroup: null };
    }
  };

  const onWindowResize = () => {
    const s = threeStateRef.current;
    if (!s || !s.renderer || !mountRef.current) return;
    const w = mountRef.current.clientWidth || 800;
    const h = mountRef.current.clientHeight || 600;
    s.renderer.setSize(w, h);
    s.camera.aspect = w / h;
    s.camera.updateProjectionMatrix();
  };

  const loadModelToThree = async (blob, format = "obj") => {
    if (!threeStateRef.current || !threeStateRef.current.renderer) initThree();
    const s = threeStateRef.current;
    while (s.meshGroup.children.length) {
      const c = s.meshGroup.children[0];
      s.meshGroup.remove(c);
      try { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m && m.dispose && m.dispose()); else c.material.dispose && c.material.dispose(); } } catch (e) {}
    }

    if (format === "stl") {
      const arrayBuffer = await blob.arrayBuffer();
      const loader = new STLLoader();
      const geom = loader.parse(arrayBuffer);
      const mat = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      s.meshGroup.add(mesh);
      centerAndScaleMesh(s, mesh);
    } else {
      const text = await blob.text();
      const loader = new OBJLoader();
      let obj;
      try {
        obj = loader.parse(text);
      } catch (e) {
        console.error("OBJ parse failed", e);
        setMsg("Impossible d'analyser l'OBJ (voir console).");
        return;
      }
      obj.traverse((child) => {
        if (child.isMesh) {
          if (!child.material) child.material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
          child.castShadow = child.receiveShadow = true;
        }
      });
      s.meshGroup.add(obj);
      centerAndScaleMesh(s, obj);
    }
  };

  const centerAndScaleMesh = (s, meshOrGroup) => {
    const box = new THREE.Box3().setFromObject(meshOrGroup);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 180 / maxDim;
      meshOrGroup.scale.set(scale, scale, scale);
      const box2 = new THREE.Box3().setFromObject(meshOrGroup);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      meshOrGroup.position.sub(center);
      const size2 = new THREE.Vector3();
      box2.getSize(size2);
      const distance = 3 * Math.max(size2.x, size2.y, size2.z);
      s.camera.position.set(distance, distance * 0.3, distance * 0.6);
      s.camera.lookAt(0, 0, 0);
      s.controls.target.set(0, 0, 0);
      s.controls.update();
    } else {
      s.camera.position.set(0, 0, 300);
      s.camera.lookAt(0, 0, 0);
      s.controls.update();
    }
  };

  // ---- render ----
  return (
    <div style={{ padding: 20 }}>
      <h1>Brodmann 3D — Viewer</h1>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 360 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={fetchPatients}>Rafraîchir patients</button>
            <div style={{ marginLeft: "auto", color: "#666" }}>{patients.length} patients</div>
          </div>

          {patients.length === 0 ? (
            <div>Aucun patient trouvé.</div>
          ) : (
            <ul style={{ paddingLeft: 0 }}>
              {patients.map((p, i) => (
                <li key={`${p.patient_id}-${i}`} style={{ listStyle: "none", padding: 8, borderRadius: 6, marginBottom: 8, border: selectedPatient && selectedPatient.patient_id === p.patient_id ? "2px solid #3b82f6" : "1px solid #eee" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div><strong>{p.patient_id}</strong></div>
                      <div style={{ fontSize: 12, color: "#666" }}>jobs: {(p.job_ids || []).join(", ") || "(aucun)"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{(p.files || []).length} coupes totales</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => handleSelectPatient(p)}>Sélectionner</button>
                      <button onClick={() => handleTo3D(p.job_ids && p.job_ids[0] ? p.job_ids[0] : p.patient_id)} disabled={generating} style={{ marginTop: 6 }}>Transformer en 3D</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3>Séries du patient (aperçu)</h3>
          <div style={{ marginBottom: 8, color: "#666" }}>{selectedPatient ? `Patient: ${selectedPatient.patient_id} — jobs: ${(selectedPatient.job_ids || []).join(", ")}` : "Aucun patient sélectionné."}</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {series.length === 0 ? <div style={{ color: "#666" }}>Aucune coupe listée pour ce patient.</div> : series.map((s, idx) => (
              <div key={`${s.job_id || s.relpath || idx}`} style={{ border: "1px solid #ddd", padding: 8 }}>
                <div style={{ fontSize: 13 }}>{s.relpath || "(relpath)"}</div>
                <div style={{ fontSize: 12, color: "#666" }}>jobId: {s.job_id || "(aucun)"} | {Array.isArray(s.files) ? s.files.length : 0} coupes</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => loadSeriesPreview(s)}>Voir coupes</button>
                  <button onClick={() => handleTo3D(s.job_id, false)} disabled={generating}>3D</button>
                  <button onClick={() => handleTo3D(s.job_id, true)} disabled={generating}>Clean</button>
                </div>
              </div>
            ))}
          </div>

          <h3>Coupe preview</h3>
          {msg && <div style={{ marginBottom: 8, color: "#444" }}>{msg}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sliceUrls.map((u, i) => <img key={i} src={u} alt={`slice-${i}`} style={{ width: 120, height: 120, objectFit: "cover", border: "1px solid #ddd" }} />)}
          </div>

          <h3>Visualisation 3D</h3>
          <div ref={mountRef} style={{ width: "100%", height: 520, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
            {!threeStateRef.current.renderer && <div style={{ padding: 12, color: "#777" }}>Le modèle 3D s'affichera ici après génération.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
