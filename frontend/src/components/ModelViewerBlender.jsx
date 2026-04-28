import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

async function fetchModelBuffer(url) {
  if (!url) return null;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access') : null;
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Chargement 3D: ${res.status}`);
  return res.arrayBuffer();
}

function disposeSubtree(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
}

function hexToColor(hex) {
  const c = String(hex || '').replace('#', '').trim();
  if (c.length !== 6) return new THREE.Color(0x3b82f6);
  return new THREE.Color(Number.parseInt(c, 16));
}

/**
 * Fusionne les sous-maillages d'un OBJ (ex. hippocampe G/D) en un seul mesh pour la scène.
 */
function objGroupToSingleMesh(group, colorHex) {
  const geometries = [];
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const g = child.geometry.clone();
      g.applyMatrix4(child.matrixWorld);
      geometries.push(g);
    }
  });
  if (geometries.length === 0) return null;

  let geom;
  if (geometries.length === 1) {
    geom = geometries[0];
  } else {
    try {
      geom = mergeGeometries(geometries, false);
    } catch {
      geom = null;
    }
    geometries.forEach((g) => {
      if (g !== geom) g.dispose();
    });
  }
  if (!geom) return null;

  const mat = new THREE.MeshPhysicalMaterial({
    color: hexToColor(colorHex),
    metalness: 0.1,
    roughness: 0.42,
    clearcoat: 0.22,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.isHippocampusMesh = true;
  return mesh;
}

/**
 * Viewer 3D style viewport (Blender / outil pro) : fond sombre, grille, axes, PBR.
 * @param {string|null} brainObjUrl — si défini, 2e maillage translucide (contexte cerveau).
 */
export default function ModelViewerBlender({
  objUrl,
  stlUrl,
  brainObjUrl = null,
  variant = 'full',
  className,
  meshColor = '#3b82f6',
  brainOpacity = 0.2,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [error, setError] = useState('');
  const [wireframe, setWireframe] = useState(false);
  /** Pas de 90° sur place (axe X) : incline le volume sans le déplacer — bas → droite → haut → gauche selon le maillage. */
  const [modelQuarterTurns, setModelQuarterTurns] = useState(0);
  const [color, setColor] = useState(meshColor);
  const [opacity, setOpacity] = useState(brainOpacity);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  /** Enveloppe cerveau (contexte IRM) : affichage, teinte et opacité. */
  const [showBrain, setShowBrain] = useState(true);
  const [brainColor, setBrainColor] = useState('#8a96a8');

  useEffect(() => {
    setColor(meshColor);
  }, [meshColor]);

  useEffect(() => {
    setOpacity(brainOpacity);
  }, [brainOpacity]);

  const buildScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return null;

    const w = Math.max(mount.clientWidth, variant === 'mini' ? 260 : 320);
    const h = Math.max(mount.clientHeight, variant === 'mini' ? 220 : 400);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = variant === 'mini' ? 1.0 : 1.05;
    renderer.setClearColor(0x8b939e, 1);
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x8b939e, 22, 95);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 5000);
    camera.position.set(2.4, 1.8, 2.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 0.35;
    controls.maxDistance = 24;
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;

    const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x94a3b8, 0.62);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(4.5, 8, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb8c8e8, 0.35);
    fill.position.set(-5, 2, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.22);
    rim.position.set(-2, -1, 6);
    scene.add(rim);

    const grid = new THREE.GridHelper(24, 48, 0xb8c0cc, 0x9aa5b5);
    grid.position.y = -0.001;
    scene.add(grid);

    const axes = new THREE.AxesHelper(1.35);
    axes.renderOrder = 1;
    scene.add(axes);

    const root = new THREE.Group();
    scene.add(root);

    return { renderer, scene, camera, controls, root, grid, axes, hemi, key, fill, rim };
  }, [variant]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    setError('');
    const s = buildScene();
    if (!s) return undefined;
    stateRef.current = s;

    let raf = 0;
    const tick = () => {
      if (!stateRef.current) return;
      const st = stateRef.current;
      st.controls.update();
      st.renderer.render(st.scene, st.camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      const st = stateRef.current;
      if (!st || !mountRef.current) return;
      const rw = mountRef.current.clientWidth;
      const rh = mountRef.current.clientHeight;
      if (rw < 2 || rh < 2) return;
      st.camera.aspect = rw / rh;
      st.camera.updateProjectionMatrix();
      st.renderer.setSize(rw, rh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    window.addEventListener('resize', onResize);

    let cancelled = false;

    (async () => {
      try {
        s.brainObject = null;
        const hasContext = Boolean(brainObjUrl);
        let objBuf = null;
        let stlBuf = null;
        if (objUrl) objBuf = await fetchModelBuffer(objUrl);
        if (!objBuf && stlUrl) stlBuf = await fetchModelBuffer(stlUrl);
        if (cancelled || (!objBuf && !stlBuf)) {
          setError('Aucun maillage disponible.');
          return;
        }

        let mainObject;
        if (objBuf) {
          const text = new TextDecoder('utf-8').decode(objBuf);
          const loaded = new OBJLoader().parse(text);
          const merged = objGroupToSingleMesh(loaded, color);
          if (merged) {
            disposeSubtree(loaded);
            mainObject = merged;
          } else {
            mainObject = loaded;
            mainObject.traverse((child) => {
              if (child.isMesh) {
                child.userData.isHippocampusMesh = true;
                const prev = child.material;
                child.material = new THREE.MeshPhysicalMaterial({
                  color: child.material?.color || hexToColor(color),
                  metalness: 0.1,
                  roughness: 0.42,
                  clearcoat: 0.22,
                  clearcoatRoughness: 0.4,
                  side: THREE.DoubleSide,
                });
                if (prev && prev.map) child.material.map = prev.map;
                if (prev && prev.dispose) prev.dispose();
              }
            });
          }
        } else {
          const geom = new STLLoader().parse(stlBuf);
          if (geom && !geom.attributes.normal) geom.computeVertexNormals();
          const mat = new THREE.MeshPhysicalMaterial({
            color: hexToColor(color),
            metalness: 0.12,
            roughness: 0.38,
            clearcoat: 0.18,
            clearcoatRoughness: 0.45,
            side: THREE.DoubleSide,
          });
          mainObject = new THREE.Mesh(geom, mat);
          mainObject.userData.isHippocampusMesh = true;
        }

        if (hasContext) {
          const brainBuf = await fetchModelBuffer(brainObjUrl);
          if (cancelled || !brainBuf) {
            setError('Maillage contexte indisponible.');
            return;
          }
          const btext = new TextDecoder('utf-8').decode(brainBuf);
          const brainObj = new OBJLoader().parse(btext);
          brainObj.traverse((child) => {
            if (child.isMesh) {
              child.userData.isBrainMesh = true;
              const prev = child.material;
              child.material = new THREE.MeshPhysicalMaterial({
                color: hexToColor(brainColor),
                metalness: 0.06,
                roughness: 0.32,
                transparent: true,
                opacity,
                transmission: 0.42,
                thickness: 0.65,
                ior: 1.35,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              if (prev && prev.dispose) prev.dispose();
            }
          });
          brainObj.renderOrder = 0;
          brainObj.visible = showBrain;
          s.brainObject = brainObj;
          s.root.add(brainObj);
        }

        mainObject.renderOrder = 1;
        s.root.add(mainObject);

        const box = new THREE.Box3().setFromObject(s.root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
        const target = 2.15;
        const sc = target / maxDim;
        s.root.scale.setScalar(sc);
        const box2 = new THREE.Box3().setFromObject(s.root);
        const c = new THREE.Vector3();
        box2.getCenter(c);
        s.root.position.sub(c);

        const sz2 = new THREE.Vector3();
        box2.getSize(sz2);
        const r = Math.max(sz2.x, sz2.y, sz2.z) * 0.55;
        s.camera.near = Math.max(0.02, r * 0.02);
        s.camera.far = Math.max(500, r * 80);
        s.camera.updateProjectionMatrix();
        const dist = r * 2.8;
        s.camera.position.set(dist * 0.75, dist * 0.55, dist * 0.9);
        s.controls.target.set(0, 0, 0);
        s.controls.update();
        s.viewDistance = Math.max(0.6, s.camera.position.distanceTo(s.controls.target));
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur chargement 3D.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      const st = stateRef.current;
      stateRef.current = null;
      if (st) {
        try {
          disposeSubtree(st.root);
          st.root.clear();
          if (st.grid?.geometry) st.grid.geometry.dispose();
          if (st.grid?.material) {
            const gm = Array.isArray(st.grid.material) ? st.grid.material : [st.grid.material];
            gm.forEach((m) => m?.dispose?.());
          }
          if (st.axes?.geometry) st.axes.geometry.dispose();
          if (st.axes?.material) {
            const am = Array.isArray(st.axes.material) ? st.axes.material : [st.axes.material];
            am.forEach((m) => m?.dispose?.());
          }
          st.controls.dispose();
          st.renderer.dispose();
          if (st.renderer.domElement.parentNode === mount) {
            mount.removeChild(st.renderer.domElement);
          }
        } catch {
          /* ignore */
        }
      }
    };
  }, [objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.grid) st.grid.visible = showGrid;
    if (st.axes) st.axes.visible = showAxes;
  }, [showGrid, showAxes, objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st?.root) return;
    st.root.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (child.userData.isBrainMesh) return;
      const m = child.material;
      if (m.color) m.color.copy(hexToColor(color));
      m.wireframe = wireframe;
      m.needsUpdate = true;
    });
  }, [color, wireframe, objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st?.brainObject) return;
    st.brainObject.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const m = child.material;
      if (m.transmission !== undefined && m.transmission > 0.1) {
        m.opacity = opacity;
        m.needsUpdate = true;
      }
    });
  }, [opacity, objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st?.brainObject) return;
    st.brainObject.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const m = child.material;
      if (m.color) m.color.copy(hexToColor(brainColor));
      m.needsUpdate = true;
    });
  }, [brainColor, objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (st?.brainObject) st.brainObject.visible = showBrain;
  }, [showBrain, objUrl, stlUrl, brainObjUrl, buildScene]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st?.root) return;
    const x = THREE.MathUtils.degToRad(modelQuarterTurns * 90);
    st.root.rotation.set(x, 0, 0);
  }, [modelQuarterTurns, objUrl, stlUrl, brainObjUrl, buildScene]);

  const stepModelRotation90 = () => setModelQuarterTurns((q) => (q + 1) % 4);

  const resetCamera = () => {
    const st = stateRef.current;
    if (!st) return;
    st.camera.position.set(2.4, 1.8, 2.8);
    st.controls.target.set(0, 0, 0);
    st.controls.update();
    st.viewDistance = Math.max(0.6, st.camera.position.distanceTo(st.controls.target));
  };

  const setCameraPreset = useCallback((preset) => {
    const st = stateRef.current;
    if (!st?.camera || !st.controls) return;
    const d = st.viewDistance || Math.max(0.6, st.camera.position.distanceTo(st.controls.target));
    const tx = st.controls.target.x;
    const ty = st.controls.target.y;
    const tz = st.controls.target.z;
    const presets = {
      front: [0, 0, d],
      back: [0, 0, -d],
      left: [-d, 0, 0],
      right: [d, 0, 0],
      top: [0, d, 0],
      bottom: [0, -d, 0],
    };
    const p = presets[preset];
    if (!p) return;
    st.camera.position.set(tx + p[0], ty + p[1], tz + p[2]);
    st.camera.lookAt(tx, ty, tz);
    st.controls.update();
  }, []);

  const viewportClass =
    className ||
    (variant === 'mini'
      ? 'h-[250px] w-full bg-[#8b939e]'
      : 'h-[min(520px,70vh)] min-h-[400px] w-full bg-[#8b939e]');

  const shellClass =
    variant === 'mini'
      ? 'flex min-h-[250px] overflow-hidden rounded-xl border border-slate-400/70 bg-[#8b939e]'
      : 'flex min-h-[400px] overflow-hidden rounded-xl border border-slate-400/60 bg-[#8b939e] shadow-inner';

  const navBtn = (active, label, onClick, narrow = false) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg py-2 text-[10px] font-bold uppercase tracking-wide transition-all ${narrow ? 'px-1.5' : 'px-3'} w-full text-center ${
        active
          ? 'bg-blue-500 text-white shadow-md shadow-blue-900/40'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  const SectionLabel = ({ children }) => (
    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{children}</p>
  );

  const Divider = () => <div className="h-px bg-slate-600/50" />;

  const toolbarAside = (
    <aside
      className={`flex min-h-0 shrink-0 flex-col border-slate-600/50 bg-gradient-to-b from-slate-800 to-slate-900 ${
        variant === 'mini' ? 'w-[5.25rem] border-l px-2 py-2 gap-2' : 'w-52 border-l px-3 py-4 gap-3'
      }`}
    >
      {variant === 'full' ? (
        <>
          <SectionLabel>Outils</SectionLabel>
          {navBtn(wireframe, wireframe ? 'Fil de fer' : 'Surface', () => setWireframe((p) => !p))}
          <button
            type="button"
            onClick={stepModelRotation90}
            title="Pivoter le modèle de 90°"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-300 transition-all hover:bg-slate-600 hover:text-white"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Rotation 90°
          </button>

          <Divider />
          <SectionLabel>Affichage</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {navBtn(showGrid, showGrid ? 'Grille ●' : 'Grille ○', () => setShowGrid((p) => !p), true)}
            {navBtn(showAxes, showAxes ? 'Axes ●' : 'Axes ○', () => setShowAxes((p) => !p), true)}
          </div>

          <Divider />
          <SectionLabel>Vues rapides</SectionLabel>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'Face',    preset: 'front' },
              { label: 'Arrière', preset: 'back' },
              { label: 'Haut',    preset: 'top' },
              { label: 'Bas',     preset: 'bottom' },
              { label: 'Gauche',  preset: 'left' },
              { label: 'Droite',  preset: 'right' },
            ].map(({ label, preset }) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCameraPreset(preset)}
                className="rounded-lg bg-slate-800 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-300 transition-all hover:bg-blue-600 hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>

          <Divider />
          <SectionLabel>Hippocampe</SectionLabel>
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold text-slate-400">Couleur du maillage</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-600 bg-slate-800 p-1"
              title="Couleur du maillage hippocampe"
            />
          </div>

          {brainObjUrl ? (
            <>
              <Divider />
              <SectionLabel>Cerveau (contexte)</SectionLabel>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-600/60 bg-slate-800 px-3 py-2 text-[10px] font-semibold text-slate-200 transition-all hover:bg-slate-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 rounded accent-blue-500"
                  checked={showBrain}
                  onChange={(e) => setShowBrain(e.target.checked)}
                />
                Enveloppe cerveau (IRM)
              </label>
              {showBrain ? (
                <div className="space-y-3">
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold text-slate-400">Couleur du cerveau</span>
                    <input
                      type="color"
                      value={brainColor}
                      onChange={(e) => setBrainColor(e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-lg border border-slate-600 bg-slate-800 p-1"
                      title="Teinte du volume contexte"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">Opacité</span>
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-300">{Math.round(opacity * 100)} %</span>
                    </div>
                    <input
                      type="range"
                      min={0.02}
                      max={0.75}
                      step={0.02}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="mt-auto">
            <Divider />
            <button
              type="button"
              onClick={resetCamera}
              className="mt-3 w-full rounded-lg border border-slate-600/50 bg-slate-800 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-300 transition-all hover:bg-slate-600 hover:text-white"
            >
              Réinitialiser caméra
            </button>
          </div>
        </>
      ) : null}
      {variant === 'mini' ? (
        <button
          type="button"
          onClick={resetCamera}
          className="mt-auto w-full rounded-md bg-slate-800/90 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-200 hover:bg-slate-600"
        >
          Reset
        </button>
      ) : null}
    </aside>
  );

  return (
    <div className={variant === 'full' ? 'space-y-2' : ''}>
      <div className={shellClass}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={mountRef} className={`${viewportClass} min-h-0 flex-1`} />
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded border border-slate-500/60 bg-white/80 px-2 py-1 font-mono text-[9px] leading-relaxed text-slate-700 shadow-sm backdrop-blur-sm">
            <div>
              <span className="text-red-600">X</span> · <span className="text-emerald-600">Y</span> ·{' '}
              <span className="text-blue-600">Z</span>
            </div>
            <div className="text-slate-500">Viewport 3D</div>
          </div>
        </div>
        {toolbarAside}
      </div>

      {variant === 'full' && error ? (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">{error}</div>
      ) : null}
    </div>
  );
}
