/**
 * BrainVolume3D — Rendu 3D surface cérébrale complète
 * Charge un mesh OBJ depuis /volume/brain-surface-3d et l'affiche en Three.js
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Brain, Pause, Play, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import api from '../api';

const TYPE_COLORS: Record<string, string> = {
  original:   '#38bdf8',  // bleu clair — patient original
  registered: '#34d399',  // vert       — patient recalé
  atlas:      '#a78bfa',  // violet     — atlas référence
};

interface BrainVolume3DProps {
  jobId?: string;
  type: 'original' | 'registered' | 'atlas';
  label?: string;
  autoRotate?: boolean;
  className?: string;
  opacity?: number;
}

export default function BrainVolume3D({
  jobId,
  type,
  label,
  autoRotate = true,
  className = '',
  opacity = 0.88,
}: BrainVolume3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: InstanceType<typeof OrbitControls>;
    rafId: number;
  } | null>(null);

  const mainMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState<{ verts: number; faces: number } | null>(null);
  const [rotating, setRotating] = useState(autoRotate);

  const color = TYPE_COLORS[type] ?? '#38bdf8';

  useEffect(() => {
    if (threeRef.current) {
      threeRef.current.controls.autoRotate = rotating;
    }
  }, [rotating]);

  const initThree = useCallback(() => {
    if (!mountRef.current) return;
    // dispose previous
    if (threeRef.current) {
      cancelAnimationFrame(threeRef.current.rafId);
      threeRef.current.renderer.dispose();
      threeRef.current.renderer.domElement.parentNode?.removeChild(threeRef.current.renderer.domElement);
      threeRef.current = null;
    }

    const w = mountRef.current.clientWidth  || 400;
    const h = mountRef.current.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050a14, 1);
    mountRef.current.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 100);
    camera.position.set(0, 0, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.06;
    controls.autoRotate      = rotating;
    controls.autoRotateSpeed = 1.4;
    controls.enableZoom      = true;
    controls.minDistance     = 1.5;
    controls.maxDistance     = 7;

    // Éclairage — 6 directions + ambiant fort pour éviter zones noires
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x221100, 0.5));
    const dirs: [number, number, number, number][] = [
      [3, 4, 5, 0.6], [-3, -2, -4, 0.4],
      [-3, 2, 1, 0.35], [3, -2, 1, 0.35],
      [0, 5, 0, 0.3],  [0, -5, 0, 0.25],
    ];
    dirs.forEach(([x, y, z, i]) => {
      const l = new THREE.DirectionalLight(0xffffff, i);
      l.position.set(x, y, z);
      scene.add(l);
    });

    const rafId = requestAnimationFrame(function animate() {
      const s = threeRef.current;
      if (!s) return;
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
      s.rafId = requestAnimationFrame(animate);
    });

    threeRef.current = { renderer, scene, camera, controls, rafId };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize
  useEffect(() => {
    const onResize = () => {
      const s = threeRef.current;
      if (!s || !mountRef.current) return;
      const w = mountRef.current.clientWidth || 400;
      const h = mountRef.current.clientHeight || 400;
      s.renderer.setSize(w, h);
      s.camera.aspect = w / h;
      s.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => () => {
    const s = threeRef.current;
    if (!s) return;
    cancelAnimationFrame(s.rafId);
    s.renderer.dispose();
    s.renderer.domElement.parentNode?.removeChild(s.renderer.domElement);
    threeRef.current = null;
  }, []);

  // Charger le mesh
  useEffect(() => {
    if (type !== 'atlas' && !jobId) return;

    let cancelled = false;
    setLoading(true); setError(''); setInfo(null);
    mainMatsRef.current = [];

    if (!threeRef.current) initThree();

    const load = async () => {
      try {
        const res = await api.get('/volume/brain-surface-3d', {
          params: { jobId: type !== 'atlas' ? jobId : undefined, type, quality: 'fast' },
        });
        if (cancelled) return;
        const data = res.data ?? {};
        if (!data.obj_data) { setError('Mesh vide'); setLoading(false); return; }

        const objText = atob(data.obj_data);
        const loader  = new OBJLoader();
        const obj     = loader.parse(objText);
        const c       = new THREE.Color(color);

        const newMats: THREE.MeshStandardMaterial[] = [];
        obj.traverse(child => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mat = new THREE.MeshStandardMaterial({
            color: c, emissive: c, emissiveIntensity: 0.3,
            roughness: 0.6, metalness: 0,
            transparent: true, opacity,
            side: THREE.DoubleSide,
          });
          (child as THREE.Mesh).material = mat;
          newMats.push(mat);
        });
        mainMatsRef.current = newMats;

        // Halo glow
        const glowObj = loader.parse(objText);
        glowObj.traverse(child => {
          if (!(child as THREE.Mesh).isMesh) return;
          (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: c, emissive: c, emissiveIntensity: 0.15,
            roughness: 1, metalness: 0,
            transparent: true, opacity: opacity * 0.07,
            side: THREE.BackSide,
          });
        });
        glowObj.scale.setScalar(1.04);

        const s = threeRef.current;
        if (!s || cancelled) return;

        // Vider la scène des anciens meshes (garder lumières)
        const toRemove = s.scene.children.filter(c => c instanceof THREE.Group || (c as THREE.Mesh).isMesh);
        toRemove.forEach(c => s.scene.remove(c));

        const group = new THREE.Group();
        group.add(obj);
        group.add(glowObj);
        s.scene.add(group);

        // Centrage
        const box = new THREE.Box3().setFromObject(group);
        const cnt = new THREE.Vector3();
        box.getCenter(cnt);
        group.position.sub(cnt);

        setInfo({ verts: data.mesh_vertices ?? 0, faces: data.mesh_faces ?? 0 });
      } catch {
        if (!cancelled) setError('Chargement échoué');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [jobId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetCamera = () => {
    const s = threeRef.current;
    if (!s) return;
    s.camera.position.set(0, 0, 3.2);
    s.controls.reset();
  };

  return (
    <div className={`flex flex-col overflow-hidden bg-[#050a14] ${className}`}>

      {/* Canvas */}
      <div className="relative flex-1 min-h-0">
        <div ref={mountRef} className="absolute inset-0" />

        {/* Idle */}
        {!jobId && type !== 'atlas' && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Brain className="h-10 w-10 opacity-10" style={{ color }} />
            <p className="text-[10px] uppercase tracking-widest text-slate-600">Volume non chargé</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050a14]/90 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${color}60`, borderTopColor: 'transparent' }} />
            <p className="text-[10px] uppercase tracking-widest animate-pulse" style={{ color }}>
              Reconstruction 3D…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-900/20 z-10">
            <p className="text-[10px] text-rose-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {/* Info badge */}
        {info && !loading && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="px-2 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-sm">
              <p className="text-[8px] font-mono" style={{ color }}>
                {info.verts.toLocaleString()} vtx
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mini barre de contrôle */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#0a101f] border-t border-white/5">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>
          {label ?? type}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRotating(v => !v)}
            className="rounded p-1 hover:bg-white/10 transition"
            title={rotating ? 'Pause rotation' : 'Lancer rotation'}
          >
            {rotating
              ? <Pause className="h-3 w-3 text-slate-400" />
              : <Play  className="h-3 w-3 text-slate-400" />}
          </button>
          <button onClick={resetCamera} className="rounded p-1 hover:bg-white/10 transition" title="Reset vue">
            <RotateCcw className="h-3 w-3 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
