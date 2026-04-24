import { useEffect, useRef, useState, useCallback } from 'react';
import { Brain, RotateCcw, Pause, Play, Eye, EyeOff } from 'lucide-react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import api from '../api';

// ── Couleur déterministe par zone BA ──────────────────────────────────────────
const ZONE_COLORS: Record<number, string> = {
  1: '#06b6d4', 2: '#06b6d4', 3: '#06b6d4',
  4: '#f43f5e', 5: '#8b5cf6', 6: '#f97316',
  7: '#10b981', 8: '#3b82f6', 9: '#6366f1',
  10: '#ec4899', 11: '#14b8a6',
  17: '#a855f7', 18: '#7c3aed', 19: '#8b5cf6',
  21: '#0ea5e9', 22: '#22c55e', 24: '#fb923c',
  37: '#e879f9', 39: '#38bdf8', 40: '#4ade80',
  41: '#fbbf24', 42: '#f59e0b',
  44: '#ef4444', 45: '#dc2626',
  46: '#2563eb', 47: '#7c3aed',
};
function zoneColor(labelId: number): string {
  return ZONE_COLORS[labelId] ?? '#22d3ee';
}

const COLOR_PRESETS = [
  { label: 'Auto',   value: null },
  { label: 'Cyan',   value: '#06b6d4' },
  { label: 'Rouge',  value: '#f43f5e' },
  { label: 'Violet', value: '#a855f7' },
  { label: 'Vert',   value: '#10b981' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Blanc',  value: '#e2e8f0' },
  { label: 'Or',     value: '#fbbf24' },
];

interface BrodmannZone3DProps {
  labelId: number | null;
  zoneName?: string;
  className?: string;
}

export default function BrodmannZone3D({ labelId, zoneName, className = '' }: BrodmannZone3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: InstanceType<typeof OrbitControls>;
    meshGroup: THREE.Group;
    rafId: number;
  } | null>(null);

  // Tous les matériaux sont MeshBasicMaterial — indépendants de l'éclairage
  const mainMatsRef   = useRef<THREE.MeshBasicMaterial[]>([]);
  const glowMatsRef   = useRef<THREE.MeshBasicMaterial[]>([]);
  const sphereMatRef  = useRef<THREE.MeshBasicMaterial | null>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [meshInfo, setMeshInfo] = useState<{ vertices: number; faces: number } | null>(null);

  const [autoRotate, setAutoRotate]   = useState(false);
  const [rotateSpeed, setRotateSpeed] = useState(1.8);
  const [opacity, setOpacity]         = useState(0.92);
  const [wireframe, setWireframe]     = useState(false);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [ghostBrain, setGhostBrain]   = useState(false);

  // ── Helpers d'application directe ────────────────────────────────────────────
  const applyColor = useCallback((hex: string) => {
    const c = new THREE.Color(hex);
    mainMatsRef.current.forEach(m => { m.color.set(c); m.needsUpdate = true; });
    glowMatsRef.current.forEach(m => { m.color.set(c); m.needsUpdate = true; });
  }, []);

  const applyOpacity = useCallback((val: number) => {
    mainMatsRef.current.forEach(m => { m.opacity = val; m.needsUpdate = true; });
    glowMatsRef.current.forEach(m => { m.opacity = val * 0.09; m.needsUpdate = true; });
  }, []);

  const applyWireframe = useCallback((val: boolean) => {
    mainMatsRef.current.forEach(m => { m.wireframe = val; m.needsUpdate = true; });
  }, []);

  const applyGhost = useCallback((val: boolean) => {
    if (sphereMatRef.current) {
      sphereMatRef.current.opacity = val ? 0.12 : 0;
      sphereMatRef.current.needsUpdate = true;
    }
  }, []);

  // ── Propagation des changements de paramètres ─────────────────────────────────
  useEffect(() => {
    const s = threeRef.current;
    if (!s) return;
    s.controls.autoRotate      = autoRotate;
    s.controls.autoRotateSpeed = rotateSpeed;
  }, [autoRotate, rotateSpeed]);

  useEffect(() => {
    if (labelId) applyColor(customColor ?? zoneColor(labelId));
  }, [customColor, labelId, applyColor]);

  useEffect(() => { applyOpacity(opacity); },   [opacity, applyOpacity]);
  useEffect(() => { applyWireframe(wireframe); }, [wireframe, applyWireframe]);
  useEffect(() => { applyGhost(ghostBrain); },   [ghostBrain, applyGhost]);

  // ── Init Three.js ─────────────────────────────────────────────────────────────
  const initThree = useCallback(() => {
    if (!mountRef.current) return;
    disposeThree();

    const w = mountRef.current.clientWidth  || 400;
    const h = mountRef.current.clientHeight || 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    camera.position.set(0, 0, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.06;
    controls.autoRotate      = autoRotate;
    controls.autoRotateSpeed = rotateSpeed;
    controls.enableZoom      = true;
    controls.minDistance     = 1.2;
    controls.maxDistance     = 8;

    // Lumière ambiante forte pour éviter les zones noires
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    // Hémisphérique (ciel/sol) pour un éclairage doux uniforme
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x443322, 0.6);
    scene.add(hemi);

    // 6 lumières directionnelles couvrant toutes les faces
    const dirLights: [number, number, number, number][] = [
      [ 3,  4,  5, 0.7],  // avant-haut-droit
      [-3, -2, -4, 0.5],  // arrière-bas-gauche
      [-3,  2,  1, 0.4],  // gauche
      [ 3, -2,  1, 0.4],  // droite-bas
      [ 0,  5,  0, 0.3],  // dessus
      [ 0, -5,  0, 0.3],  // dessous
    ];
    dirLights.forEach(([x, y, z, intensity]) => {
      const l = new THREE.DirectionalLight(0xffffff, intensity);
      l.position.set(x, y, z);
      scene.add(l);
    });

    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x4a5568, transparent: true,
      opacity: ghostBrain ? 0.12 : 0, side: THREE.BackSide,
    });
    sphereMatRef.current = sphereMat;
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), sphereMat));

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);

    const rafId = requestAnimationFrame(function animate() {
      const s = threeRef.current;
      if (!s) return;
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
      s.rafId = requestAnimationFrame(animate);
    });

    threeRef.current = { renderer, scene, camera, controls, meshGroup, rafId };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disposeThree = () => {
    const s = threeRef.current;
    if (!s) return;
    cancelAnimationFrame(s.rafId);
    s.scene.traverse(obj => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach(x => x.dispose());
        else mat.dispose();
      }
    });
    s.renderer.dispose();
    s.renderer.domElement.parentNode?.removeChild(s.renderer.domElement);
    threeRef.current = null;
    mainMatsRef.current = [];
    glowMatsRef.current = [];
    sphereMatRef.current = null;
  };

  const resetCamera = () => {
    const s = threeRef.current;
    if (!s) return;
    s.camera.position.set(0, 0, 3.5);
    s.controls.reset();
  };

  useEffect(() => {
    const onResize = () => {
      const s = threeRef.current;
      if (!s || !mountRef.current) return;
      const w = mountRef.current.clientWidth  || 400;
      const h = mountRef.current.clientHeight || 300;
      s.renderer.setSize(w, h);
      s.camera.aspect = w / h;
      s.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => () => disposeThree(), []);

  // ── Load mesh ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!labelId) {
      if (threeRef.current) {
        while (threeRef.current.meshGroup.children.length)
          threeRef.current.meshGroup.remove(threeRef.current.meshGroup.children[0]);
      }
      mainMatsRef.current = [];
      glowMatsRef.current = [];
      setMeshInfo(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true); setError(''); setMeshInfo(null);
      if (!threeRef.current) initThree();

      try {
        const res = await api.get('/volume/brodmann-zone-3d', { params: { labelId, quality: 'fast' } });
        if (cancelled) return;
        const data = res.data ?? {};
        if (!data.obj_data) { setError('Mesh vide'); setLoading(false); return; }

        const objText    = atob(data.obj_data);
        const loader     = new OBJLoader();
        const activeHex  = customColor ?? zoneColor(labelId);
        const threeColor = new THREE.Color(activeHex);

        // Mesh principal — MeshBasicMaterial : couleur uniforme, indépendant de la lumière
        const obj = loader.parse(objText);
        const newMainMats: THREE.MeshBasicMaterial[] = [];
        obj.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = new THREE.MeshBasicMaterial({
              color: threeColor,
              transparent: true,
              opacity,
              side: THREE.DoubleSide,
              wireframe,
            });
            (child as THREE.Mesh).material = mat;
            newMainMats.push(mat);
          }
        });
        mainMatsRef.current = newMainMats;

        glowMatsRef.current = [];

        const s = threeRef.current;
        if (!s || cancelled) return;
        while (s.meshGroup.children.length) s.meshGroup.remove(s.meshGroup.children[0]);
        s.meshGroup.add(obj);

        const box = new THREE.Box3().setFromObject(s.meshGroup);
        const cnt = new THREE.Vector3();
        box.getCenter(cnt);
        s.meshGroup.position.sub(cnt);

        setMeshInfo({ vertices: data.mesh_vertices ?? 0, faces: data.mesh_faces ?? 0 });
      } catch {
        if (!cancelled) setError('Impossible de charger le mesh 3D');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [labelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeColor = labelId ? (customColor ?? zoneColor(labelId)) : '#22d3ee';

  return (
    <div className={`flex flex-col overflow-hidden bg-[#0a101f] ${className}`}>

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div ref={mountRef} className="absolute inset-0 overflow-hidden" />

        {!labelId && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/10 bg-white/5">
              <Brain className="h-7 w-7 text-white/10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
              Aucune zone sélectionnée
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a101f]/90 z-10">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${activeColor}80`, borderTopColor: 'transparent' }}
            />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">
              Reconstruction…
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-500/10 z-10">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {meshInfo && !loading && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="px-2 py-1 rounded-lg bg-black/50 border border-white/10 backdrop-blur-sm">
              <p className="text-[8px] font-mono text-slate-400">
                {meshInfo.vertices.toLocaleString()} vtx · {meshInfo.faces.toLocaleString()} faces
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Barre de paramètres ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/10 bg-[#0d1526]">

        {/* Ligne 1 — Contrôles vue (rotation auto supprimée — manipulation manuelle) */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-wrap">
          <span className="text-[9px] text-slate-500 italic">Cliquez et faites glisser pour faire tourner</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setGhostBrain(v => !v)}
              title={ghostBrain ? 'Masquer fantôme' : 'Afficher fantôme'}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition border ${
                ghostBrain
                  ? 'bg-slate-700/60 border-white/10 text-slate-300'
                  : 'bg-white/5 border-white/5 text-slate-600 hover:text-slate-300'
              }`}
            >
              {ghostBrain ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>Fantôme</span>
            </button>

            <button
              onClick={() => setWireframe(v => !v)}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold transition border ${
                wireframe
                  ? 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                  : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
              }`}
            >
              Filaire
            </button>

            <button
              onClick={resetCamera}
              title="Réinitialiser vue"
              className="rounded-lg p-1.5 bg-white/5 border border-white/5 text-slate-500 hover:text-slate-200 hover:bg-white/10 transition"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Ligne 2 — Opacité + couleur */}
        <div className="flex items-center gap-3 px-3 py-2">

          <div className="flex items-center gap-1.5" style={{ minWidth: 130 }}>
            <span className="text-[9px] text-slate-500 shrink-0">Opacité</span>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="flex-1 h-1 accent-violet-400 cursor-pointer"
              style={{ width: 70 }}
            />
            <span className="text-[9px] font-mono text-violet-400 w-8">
              {Math.round(opacity * 100)}%
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 shrink-0" />

          <div className="flex items-center gap-2 flex-1">
            <span className="text-[9px] text-slate-500 shrink-0">Couleur</span>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_PRESETS.map(preset => {
                const isActive = preset.value === null ? customColor === null : customColor === preset.value;
                const bg = preset.value ?? (labelId ? zoneColor(labelId) : '#22d3ee');
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      const next = preset.value;
                      setCustomColor(next);
                      // Appliquer immédiatement
                      const hex = next ?? (labelId ? zoneColor(labelId) : '#22d3ee');
                      const c = new THREE.Color(hex);
                      mainMatsRef.current.forEach(m => { m.color.set(c); m.needsUpdate = true; });
                      glowMatsRef.current.forEach(m => { m.color.set(c); m.needsUpdate = true; });
                    }}
                    title={preset.label}
                    className={`h-5 w-5 rounded-full transition-all hover:scale-125 ${
                      isActive ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0d1526] scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
