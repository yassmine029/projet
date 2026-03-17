// frontend/src/pages/Prediction.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function PredictionPage() {
  const [averages, setAverages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sliceUrls, setSliceUrls] = useState([]); // objectURLs for slice blobs
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);

  const mountRef = useRef(null); // container for three canvas
  const threeStateRef = useRef({ renderer: null, scene: null, camera: null, controls: null, meshGroup: null });

  useEffect(() => {
    fetchAverages();
    // cleanup on unmount
    return () => {
      sliceUrls.forEach(u => URL.revokeObjectURL(u));
      disposeThree();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FONCTION DÉSACTIVÉE TEMPORAIREMENT (routes averages supprimées du backend)
  const fetchAverages = async () => {
    setLoading(false);
    setAverages([]);
    setMsg("⚠️ Fonctionnalité 'Averages' temporairement désactivée. Cette page sera réactivée plus tard si nécessaire.");
    
    /* CODE ORIGINAL COMMENTÉ :
    setLoading(true);
    try {
      const res = await getAverages();
      setAverages(res.data || []);
    } catch (err) {
      console.error("getAverages error:", err);
      setAverages([]);
      setMsg("Erreur en récupérant les averages (voir console).");
    } finally {
      setLoading(false);
    }
    */
  };

  const loadAverageSlices = async (avg) => {
    setSelected(avg);
    // revoke old urls
    sliceUrls.forEach(u => URL.revokeObjectURL(u));
    setSliceUrls([]);
    setMsg("Chargement des coupes...");
    try {
      const files = avg.files || [];
      // limit to first 80 images
      const toLoad = files.slice(0, 80);
      const urls = [];
      for (let f of toLoad) {
        try {
          const res = await api.get(`/average/${encodeURIComponent(avg.id)}/file`, {
            params: { relpath: f },
            responseType: "blob"
          });
          const blob = res.data;
          const u = URL.createObjectURL(blob);
          urls.push(u);
        } catch (err) {
          console.warn("unable to fetch slice", f, err);
        }
      }
      setSliceUrls(urls);
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("Erreur lors du chargement des coupes.");
    }
  };

  // handle generation (cleanFlag = false => original behavior; true => ?clean=1)
  const handleTo3D = async (avg, cleanFlag = false) => {
    setGenerating(true);
    setMsg((cleanFlag ? "Génération 3D (clean) en cours..." : "Génération 3D en cours..."));
    try {
      // request generation
      const path = `/average/${encodeURIComponent(avg.id)}/to3d` + (cleanFlag ? "?clean=1" : "");
      const res = await api.post(path);
      if (!res.data || !res.data.model_url) {
        setMsg("Erreur : réponse invalide du serveur.");
        setGenerating(false);
        return;
      }
      const modelUrl = res.data.model_url; // e.g. /api/average/<id>/model?format=obj
      // Now download model as blob. note: our api wrapper baseURL probably already points to /api
      // The original code used modelUrl.replace('/api/', '') — keep compatible:
      const modelPath = modelUrl.startsWith("/api/") ? modelUrl.replace("/api/", "") : modelUrl;
      const modelRes = await api.get(modelPath, { responseType: "blob" });
      const blob = modelRes.data;
      // determine format
      let fmt = "obj";
      const contentType = modelRes.headers && (modelRes.headers["content-type"] || modelRes.headers["Content-Type"] || "");
      if (contentType.includes("stl") || modelUrl.endsWith(".stl") || modelPath.includes("format=stl")) fmt = "stl";
      if (modelUrl.endsWith(".obj") || modelPath.includes("format=obj")) fmt = "obj";
      // parse and display
      await loadModelToThree(blob, fmt, cleanFlag);
      setMsg("Modèle 3D affiché.");
    } catch (err) {
      console.error("3D generation/display error:", err);
      setMsg("Erreur lors de la génération / affichage 3D (voir console).");
    } finally {
      setGenerating(false);
    }
  };

  // --- THREE.js helpers ---
  const initThree = () => {
    if (!mountRef.current) return;
    disposeThree(); // recreate clean scene

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.display = "block";
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
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

    threeStateRef.current = { renderer, scene, camera, controls, meshGroup };

    let rafId = null;
    const animate = () => {
      const s = threeStateRef.current;
      if (!s || !s.renderer) return;
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    // handle resize
    window.addEventListener("resize", onWindowResize);

    // store raf id so we can cancel on dispose
    threeStateRef.current._rafId = rafId;
  };

  const disposeThree = () => {
    const s = threeStateRef.current;
    if (!s) return;
    try {
      window.removeEventListener("resize", onWindowResize);
      if (s._rafId) {
        cancelAnimationFrame(s._rafId);
      }
      if (s.renderer && s.renderer.domElement && s.renderer.domElement.parentNode) {
        s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
      }
      if (s.scene) {
        s.scene.traverse((obj) => {
          if (obj.geometry) {
            try { obj.geometry.dispose(); } catch (e) {}
          }
          if (obj.material) {
            try {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m && m.dispose && m.dispose());
              } else {
                obj.material && obj.material.dispose && obj.material.dispose();
              }
            } catch (e) {}
          }
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
    if (!s || !s.renderer) return;
    const w = mountRef.current.clientWidth || 800;
    const h = mountRef.current.clientHeight || 600;
    s.renderer.setSize(w, h);
    s.camera.aspect = w / h;
    s.camera.updateProjectionMatrix();
  };

  // load model blob into three scene
  const loadModelToThree = async (blob, format = "obj", isClean = false) => {
    // init three if needed
    if (!threeStateRef.current || !threeStateRef.current.renderer) {
      initThree();
    }
    const s = threeStateRef.current;
    // clear previous group children (but keep camera/controls)
    while (s.meshGroup.children.length) {
      const c = s.meshGroup.children[0];
      s.meshGroup.remove(c);
      try {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m && m.dispose && m.dispose());
          else c.material.dispose && c.material.dispose();
        }
      } catch (e) { /* swallow */ }
    }

    if (format === "stl") {
      // STLLoader expects ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const loader = new STLLoader();
      const geom = loader.parse(arrayBuffer);
      // ensure normals
      if (geom && geom.attributes && !geom.attributes.normal) {
        geom.computeVertexNormals && geom.computeVertexNormals();
      }
      const mat = new THREE.MeshStandardMaterial({ color: 0x9999ff, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      s.meshGroup.add(mesh);
      centerAndScaleMesh(s, mesh);
    } else {
      // OBJ
      const text = await blob.text();
      const loader = new OBJLoader();
      let obj;
      try {
        obj = loader.parse(text);
      } catch (e) {
        // some OBJ files may require loading as geometry via parsing lines — fallback not implemented
        console.error("OBJ parse failed", e);
        setMsg("Impossible d'analyser le fichier OBJ (voir console).");
        return;
      }
      // ensure meshes have material
      obj.traverse(child => {
        if (child.isMesh) {
          if (!child.material || child.material === undefined) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
          } else {
            // ensure side and standard material compatibility
            try { child.material.side = THREE.DoubleSide; } catch (e) {}
          }
          child.castShadow = child.receiveShadow = true;
        }
      });
      s.meshGroup.add(obj);
      centerAndScaleMesh(s, obj);
    }

    // if this was the "clean" request, optionally add a small highlight or message
    if (isClean) {
      // no-op: kept for future enhancements (e.g. different material)
    }
  };

  const centerAndScaleMesh = (s, meshOrGroup) => {
    // compute bounding box and center
    const box = new THREE.Box3().setFromObject(meshOrGroup);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 180 / maxDim;
      meshOrGroup.scale.set(scale, scale, scale);
      // recompute box after scaling
      const box2 = new THREE.Box3().setFromObject(meshOrGroup);
      const size2 = new THREE.Vector3();
      box2.getSize(size2);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      meshOrGroup.position.sub(center); // center at origin
      // position camera to see object comfortably
      const distance = 3 * Math.max(size2.x, size2.y, size2.z);
      s.camera.position.set(distance, distance * 0.3, distance * 0.6);
      s.camera.lookAt(0, 0, 0);
      s.controls.target.set(0, 0, 0);
      s.controls.update();
    } else {
      // fallback camera placement
      s.camera.position.set(0, 0, 300);
      s.camera.lookAt(0, 0, 0);
      s.controls.update();
    }
  };

  // Render
  return (
    <div style={{ padding: 20 }}>
      <h1>Prédiction / Averages</h1>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 340 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={fetchAverages} disabled={loading}>Rafraîchir</button>
            <div style={{ marginLeft: "auto", color: "#666" }}>{averages.length} averages</div>
          </div>

          {msg && (
            <div style={{ 
              padding: 12, 
              marginBottom: 12, 
              backgroundColor: "#fff3cd", 
              border: "1px solid #ffc107",
              borderRadius: 6,
              color: "#856404"
            }}>
              {msg}
            </div>
          )}

          {loading ? (
            <div>Chargement...</div>
          ) : averages.length === 0 ? (
            <div style={{ padding: 12, color: "#666" }}>Aucune average disponible.</div>
          ) : (
            <ul style={{ paddingLeft: 0 }}>
              {averages.map((a) => (
                <li key={a.id} style={{
                  listStyle: "none",
                  padding: 8,
                  borderRadius: 6,
                  marginBottom: 8,
                  border: selected && selected.id === a.id ? "2px solid #3b82f6" : "1px solid #eee"
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <strong>{a.name || `average-${a.id.substring(0,6)}`}</strong>
                    <div style={{ fontSize: 12, color: "#666" }}>{a.files?.length || 0} coupes</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => loadAverageSlices(a)}>Voir coupes</button>
                      <button onClick={() => handleTo3D(a)} disabled={generating} style={{ marginLeft: 8 }}>Transformer en 3D</button>
                      <button onClick={() => handleTo3D(a, true)} disabled={generating} style={{ marginLeft: 8 }}>Clean</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3>Coupes (prévisualisation)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {sliceUrls.map((u, i) => (
              <img key={i} src={u} alt={`slice-${i}`} style={{ width: 120, height: 120, objectFit: "cover", border: "1px solid #ddd" }} />
            ))}
          </div>

          <h3>Visualisation 3D</h3>
          <div ref={mountRef} style={{ width: "100%", height: 520, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
            {/* three.js canvas will be injected here */}
            {!threeStateRef.current.renderer && <div style={{ padding: 12, color: "#777" }}>Le modèle 3D s'affichera ici après génération.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}