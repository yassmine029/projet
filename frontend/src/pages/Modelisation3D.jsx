import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, ArrowLeft, X, FileText, Download, UserRound, Hash, CalendarDays, Brain, Activity, BarChart3 } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import api, { downloadSegmentationReportPdf } from '../api';

function MeshViewer({ objUrl, stlUrl }) {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRootRef = useRef(null);
  const cameraDistanceRef = useRef(120);
  const initializedViewRef = useRef(false);
  const [viewerError, setViewerError] = useState('');
  const [interactionMode, setInteractionMode] = useState('rotate');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const applyMaterialMode = (root, asWireframe) => {
    if (!root) return;
    root.traverse?.((child) => {
      if (child?.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            if (mat) mat.wireframe = asWireframe;
          });
        } else {
          child.material.wireframe = asWireframe;
        }
      }
    });
  };

  const setAnatomicalView = (view) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const d = cameraDistanceRef.current || 120;
    if (view === 'axial') {
      camera.position.set(0, 0, d);
      camera.up.set(0, 1, 0);
    } else if (view === 'coronal') {
      camera.position.set(0, d, 0);
      camera.up.set(0, 0, 1);
    } else if (view === 'sagittal') {
      camera.position.set(d, 0, 0);
      camera.up.set(0, 0, 1);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const resetView = () => {
    setAnatomicalView('axial');
  };

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return undefined;

    setViewerError('');

    const width = Math.max(mountEl.clientWidth, 320);
    const height = Math.max(mountEl.clientHeight, 300);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8fafc');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 0, 220);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    mountEl.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    cameraRef.current = camera;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = autoRotate;
    controls.target.set(0, 0, 0);
    controls.update();

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(60, 80, 100);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-50, -30, -70);
    scene.add(fill);

    let rafId = 0;
    let loadedRoot = null;

    const fitCameraToObject = (object3D) => {
      const box = new THREE.Box3().setFromObject(object3D);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object3D.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fov = (camera.fov * Math.PI) / 180;
      const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.8;
      cameraDistanceRef.current = Math.max(distance, 80);
      camera.position.set(0, 0, Math.max(distance, 80));
      camera.near = Math.max(0.01, distance / 1000);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
    };

    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(renderLoop);
    };

    const onLoadError = () => {
      setViewerError('Impossible de charger le modele 3D.');
    };

    if (objUrl) {
      const loader = new OBJLoader();
      loader.load(
        objUrl,
        (object) => {
          object.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: '#1a2b6d',
                metalness: 0.15,
                roughness: 0.45,
                side: THREE.DoubleSide,
              });
            }
          });
          loadedRoot = object;
          meshRootRef.current = object;
          scene.add(object);
          applyMaterialMode(object, wireframe);
          fitCameraToObject(object);
          if (!initializedViewRef.current) {
            initializedViewRef.current = true;
            setAnatomicalView('axial');
          }
          renderLoop();
        },
        undefined,
        onLoadError
      );
    } else if (stlUrl) {
      const loader = new STLLoader();
      loader.load(
        stlUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: '#1a2b6d',
            metalness: 0.1,
            roughness: 0.5,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          loadedRoot = mesh;
          meshRootRef.current = mesh;
          scene.add(mesh);
          applyMaterialMode(mesh, wireframe);
          fitCameraToObject(mesh);
          if (!initializedViewRef.current) {
            initializedViewRef.current = true;
            setAnatomicalView('axial');
          }
          renderLoop();
        },
        undefined,
        onLoadError
      );
    } else {
      setViewerError('Aucun fichier OBJ/STL disponible pour affichage.');
    }

    const handleResize = () => {
      if (!mountRef.current) return;
      const nextW = Math.max(mountRef.current.clientWidth, 320);
      const nextH = Math.max(mountRef.current.clientHeight, 300);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      meshRootRef.current = null;
      initializedViewRef.current = false;

      if (loadedRoot) {
        loadedRoot.traverse?.((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose?.());
            } else {
              child.material.dispose?.();
            }
          }
        });
        scene.remove(loadedRoot);
      }

      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, [objUrl, stlUrl]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (interactionMode === 'pan') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    } else if (interactionMode === 'zoom') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.DOLLY,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }, [interactionMode]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    applyMaterialMode(meshRootRef.current, wireframe);
  }, [wireframe]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <span className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Navigation</span>
        <button
          type="button"
          onClick={() => setInteractionMode('rotate')}
          className={`rounded-md px-3 py-1 text-xs font-medium ${interactionMode === 'rotate' ? 'bg-[#1a2b6d] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Rotation
        </button>
        <button
          type="button"
          onClick={() => setInteractionMode('pan')}
          className={`rounded-md px-3 py-1 text-xs font-medium ${interactionMode === 'pan' ? 'bg-[#1a2b6d] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Deplacement
        </button>
        <button
          type="button"
          onClick={() => setInteractionMode('zoom')}
          className={`rounded-md px-3 py-1 text-xs font-medium ${interactionMode === 'zoom' ? 'bg-[#1a2b6d] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Zoom
        </button>

        <span className="ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vues</span>
        <button
          type="button"
          onClick={() => setAnatomicalView('axial')}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Axial
        </button>
        <button
          type="button"
          onClick={() => setAnatomicalView('coronal')}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Coronal
        </button>
        <button
          type="button"
          onClick={() => setAnatomicalView('sagittal')}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Sagittal
        </button>

        <button
          type="button"
          onClick={() => setWireframe((prev) => !prev)}
          className={`ml-auto rounded-md px-3 py-1 text-xs font-medium ${wireframe ? 'bg-[#1a2b6d] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          {wireframe ? 'Wireframe ON' : 'Wireframe OFF'}
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`rounded-md px-3 py-1 text-xs font-medium ${autoRotate ? 'bg-[#1a2b6d] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          {autoRotate ? 'Auto-rotation ON' : 'Auto-rotation OFF'}
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Reset vue
        </button>
      </div>

      <div className="h-96 w-full overflow-hidden rounded-xl border border-slate-200 bg-white" ref={mountRef} />
      {viewerError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {viewerError}
        </div>
      ) : null}
      <p className="text-xs text-slate-500">Astuce: mode Rotation (gauche), Deplacement (pan), Zoom, vues anatomiques, wireframe et auto-rotation.</p>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ThresholdLine({ leftPercent, colorClass }) {
  return (
    <span
      className={`absolute top-1/2 h-5 w-[2px] -translate-y-1/2 ${colorClass}`}
      style={{ left: `calc(${clamp(leftPercent, 0, 100)}% - 1px)` }}
    />
  );
}

function StatusBadge({ tone, label }) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-sky-200 bg-sky-50 text-sky-700';

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

function getAiStatus(value) {
  const v = Math.abs(Number(value || 0));
  if (v <= 10) return { label: 'Normal', tone: 'ok', shortRule: '<= 10%' };
  if (v <= 20) return { label: 'Alerte', tone: 'warn', shortRule: '10-20%' };
  return { label: 'Eleve', tone: 'danger', shortRule: '> 20%' };
}

function getNiStatus(value) {
  const v = Number(value || 0);
  if (v < 60) return { label: 'Severe', tone: 'danger', shortRule: '< 60%' };
  if (v < 90) return { label: 'Alerte', tone: 'warn', shortRule: '60-90%' };
  if (v <= 110) return { label: 'Normal', tone: 'ok', shortRule: '90-110%' };
  return { label: 'Haut', tone: 'info', shortRule: '> 110%' };
}

function LegendDot({ colorClass }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorClass}`} />;
}

function AIGauge({ value, interpretation }) {
  const v = Math.abs(Number(value || 0));
  const status = getAiStatus(v);
  const marker = (clamp(v, 0, 100) / 100) * 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.14em] text-slate-400">IA - Indice d'asymetrie</p>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      <h5 className="mt-1 text-2xl font-medium text-[#1e3563]">Asymetrie hippocampique</h5>
      <p className="text-sm text-slate-400">Marqueur de l'epilepsie du lobe temporal mesial (MTLE)</p>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-[#4f6292]">
        IA = |D - G| / ((D + G) / 2) - D = vol. droit - G = vol. gauche
      </div>

      <p className="mt-4 text-5xl font-semibold text-[#1e3563]">{v.toFixed(2)} <span className="text-3xl font-medium text-[#7b8eb8]">%</span></p>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
        <div className="h-full bg-emerald-400" style={{ width: '10%' }} />
        <div className="absolute top-0 h-full bg-amber-400" style={{ left: '10%', width: '10%' }} />
        <div className="absolute top-0 h-full bg-orange-500" style={{ left: '20%', width: '10%' }} />
        <div className="absolute top-0 h-full bg-red-400" style={{ left: '30%', width: '70%' }} />
        <span className="absolute top-1/2 h-8 w-[2px] -translate-y-1/2 bg-[#234986]" style={{ left: '10%' }} />

        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${marker}%` }}
          title={`AI=${v.toFixed(2)}%`}
        >
          <span className="block h-8 w-1.5 rounded bg-[#244a89] shadow" />
        </span>
      </div>

      <div className="relative mt-2 h-5 text-sm text-slate-500">
        <span className="absolute left-0">0%</span>
        <span className="absolute" style={{ left: '10%', transform: 'translateX(-50%)' }}>10%</span>
        <span className="absolute" style={{ left: '20%', transform: 'translateX(-50%)' }}>20%</span>
        <span className="absolute" style={{ left: '30%', transform: 'translateX(-50%)' }}>30%</span>
        <span className="absolute right-0">100%</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#5e73a0]">
        <span><LegendDot colorClass="bg-emerald-500" /> <span className="ml-1">0-10 % : Asymetrie non significative</span></span>
        <span><LegendDot colorClass="bg-amber-400" /> <span className="ml-1">10-20 % : Asymetrie moderee</span></span>
        <span><LegendDot colorClass="bg-orange-500" /> <span className="ml-1">20-30 % : Asymetrie marquee</span></span>
        <span><LegendDot colorClass="bg-red-400" /> <span className="ml-1">&gt; 30 % : Asymetrie severe</span></span>
      </div>

      <div className="mt-3 rounded-lg border-l-2 border-emerald-400 bg-emerald-50 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[#77a89f]">Interpretation clinique - Epilepsie (MTLE)</p>
        <p className="mt-1 text-sm text-[#38527b]">{interpretation || `IA = ${v.toFixed(2)} % - interpretation indisponible.`}</p>
      </div>
    </div>
  );
}

function NIGauge({ value, interpretation }) {
  const v = Number(value || 0);
  const status = getNiStatus(v);
  const min = 0;
  const max = 150;
  const marker = ((clamp(v, min, max) - min) / (max - min)) * 100;

  const p60 = ((60 - min) / (max - min)) * 100;
  const p80 = ((80 - min) / (max - min)) * 100;
  const p90 = ((90 - min) / (max - min)) * 100;
  const p110 = ((110 - min) / (max - min)) * 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.14em] text-slate-400">IN - Indice de normalisation</p>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      <h5 className="mt-1 text-2xl font-medium text-[#1e3563]">Normalisation volumetrique hippocampique</h5>
      <p className="text-sm text-slate-400">Quantification de l'atrophie dans la maladie d'Alzheimer (MA)</p>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-[#4f6292]">
        IN = (V_total patient / V_moy. sains) x 100
      </div>

      <p className="mt-4 text-5xl font-semibold text-[#1e3563]">{v.toFixed(2)} <span className="text-3xl font-medium text-[#7b8eb8]">%</span></p>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        <div className="absolute left-0 top-0 h-full bg-red-400" style={{ width: `${p60}%` }} />
        <div className="absolute top-0 h-full bg-orange-400" style={{ left: `${p60}%`, width: `${p80 - p60}%` }} />
        <div className="absolute top-0 h-full bg-yellow-400" style={{ left: `${p80}%`, width: `${p90 - p80}%` }} />
        <div className="absolute top-0 h-full bg-emerald-400" style={{ left: `${p90}%`, width: `${p110 - p90}%` }} />
        <div className="absolute top-0 h-full bg-blue-400" style={{ left: `${p110}%`, width: `${100 - p110}%` }} />
        <span className="absolute top-1/2 h-8 w-[2px] -translate-y-1/2 bg-[#234986]" style={{ left: `${p110}%` }} />

        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${marker}%` }}
          title={`NI=${v.toFixed(2)}%`}
        >
          <span className="block h-8 w-1.5 rounded bg-[#244a89] shadow" />
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
        <span>0%</span>
        <span>60</span>
        <span>80</span>
        <span>90</span>
        <span>110</span>
        <span>150%</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#5e73a0]">
        <span><LegendDot colorClass="bg-red-400" /> <span className="ml-1">IN &lt; 60 % : Reduction severe</span></span>
        <span><LegendDot colorClass="bg-orange-400" /> <span className="ml-1">60-80 % : Reduction moderee</span></span>
        <span><LegendDot colorClass="bg-yellow-400" /> <span className="ml-1">80-90 % : Reduction legere</span></span>
        <span><LegendDot colorClass="bg-emerald-400" /> <span className="ml-1">&gt;= 90 % : Volume normal</span></span>
        <span><LegendDot colorClass="bg-blue-400" /> <span className="ml-1">&gt; 110 % : Volume superieur a la moyenne</span></span>
      </div>

      <div className="mt-3 rounded-lg border-l-2 border-emerald-400 bg-emerald-50 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[#77a89f]">Interpretation clinique - Alzheimer (MA)</p>
        <p className="mt-1 text-sm text-[#38527b]">{interpretation || `IN = ${v.toFixed(2)} % - interpretation indisponible.`}</p>
      </div>
    </div>
  );
}

function ageFromBirthDate(value) {
  if (!value) return null;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}

function formatDateFr(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('fr-FR');
}

function statusDotClass(status) {
  if (status === 'ok' || status === 'Normal') return 'bg-emerald-500';
  if (status === 'Alerte') return 'bg-amber-500';
  return 'bg-red-500';
}

function formatMm3(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function niceCeil(value, step) {
  const safe = Math.max(1, Number(value || 0));
  return Math.ceil(safe / step) * step;
}

function ComparativeGroupedChart({ title, unit, yTicks, yMax, series, categories }) {
  const safeMax = Math.max(1, Number(yMax || 1));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-[#1f3566]">{title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#2b3f72]">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[72px_1fr] gap-3">
        <div className="relative h-72">
          {yTicks.map((tick) => {
            const p = (tick / safeMax) * 100;
            return (
              <span
                key={tick}
                className="absolute -translate-y-1/2 text-right text-[12px] text-slate-500"
                style={{ bottom: `${p}%`, right: 0, width: '100%' }}
              >
                {`${Number(tick).toLocaleString('fr-FR')} ${unit}`}
              </span>
            );
          })}
        </div>

        <div className="relative h-72 rounded-xl border border-slate-200 bg-slate-50 px-4 pb-8 pt-3">
          {yTicks.map((tick) => {
            const p = (tick / safeMax) * 100;
            return (
              <span
                key={`line-${tick}`}
                className="absolute left-0 right-0 border-t border-slate-200"
                style={{ bottom: `${p}%` }}
              />
            );
          })}

          <div className="relative z-10 flex h-full items-end justify-around gap-5">
            {categories.map((cat) => (
              <div key={cat.label} className="flex h-full min-w-[90px] flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-1.5">
                  {series.map((s) => {
                    const v = Number(cat.values?.[s.key] || 0);
                    const h = (v / safeMax) * 100;
                    return (
                      <span
                        key={`${cat.label}-${s.key}`}
                        className="w-7 rounded-t-md"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          backgroundColor: s.color,
                          border: s.borderColor ? `2px solid ${s.borderColor}` : 'none',
                        }}
                        title={`${cat.label} - ${s.label}: ${v.toFixed(2)} ${unit}`}
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[13px] font-medium leading-5 text-slate-600">{cat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini3DPreview({ objUrl, stlUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const w = Math.max(mount.clientWidth, 260);
    const h = Math.max(mount.clientHeight, 220);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f1d3d');

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 4000);
    camera.position.set(0, 0, 180);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const a = new THREE.AmbientLight(0xffffff, 0.85);
    const d = new THREE.DirectionalLight(0xffffff, 0.7);
    d.position.set(40, 80, 120);
    scene.add(a);
    scene.add(d);

    let root = null;
    let frame = 0;

    const fit = (obj) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fov = (camera.fov * Math.PI) / 180;
      const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 2.0;
      camera.position.set(0, 0, Math.max(dist, 120));
      camera.near = Math.max(0.01, dist / 1000);
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
    };

    const materialize = (obj) => {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#6aa9ff',
            metalness: 0.15,
            roughness: 0.45,
            side: THREE.DoubleSide,
          });
        }
      });
    };

    const animate = () => {
      if (root) root.rotation.y += 0.006;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    const failFallback = () => {
      const geo = new THREE.IcosahedronGeometry(36, 2);
      const mat = new THREE.MeshStandardMaterial({ color: '#6aa9ff', roughness: 0.55, metalness: 0.1 });
      root = new THREE.Mesh(geo, mat);
      scene.add(root);
      fit(root);
      animate();
    };

    if (objUrl) {
      new OBJLoader().load(
        objUrl,
        (obj) => {
          materialize(obj);
          root = obj;
          scene.add(obj);
          fit(obj);
          animate();
        },
        undefined,
        failFallback,
      );
    } else if (stlUrl) {
      new STLLoader().load(
        stlUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          root = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: '#6aa9ff', roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide }),
          );
          scene.add(root);
          fit(root);
          animate();
        },
        undefined,
        failFallback,
      );
    } else {
      failFallback();
    }

    const onResize = () => {
      if (!mountRef.current) return;
      const nw = Math.max(mountRef.current.clientWidth, 260);
      const nh = Math.max(mountRef.current.clientHeight, 220);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose?.();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
          else child.material.dispose?.();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [objUrl, stlUrl]);

  return <div ref={mountRef} className="h-[250px] w-full overflow-hidden rounded-xl border border-slate-200" />;
}

function ReportPreviewModal({
  open,
  onClose,
  onExport,
  exportLoading,
  runInfo,
  modelingResult,
  patientDetail,
  toAbsoluteMediaUrl,
}) {
  if (!open || !modelingResult) return null;

  const ci = modelingResult?.clinical_indices || {};
  const vols = modelingResult?.volumes_mm3 || {};
  const ref = modelingResult?.reference_values_mm3 || {};
  const interp = modelingResult?.clinical_interpretation || {};

  const sex = patientDetail?.sexe === 'F' ? 'Feminin' : patientDetail?.sexe === 'M' ? 'Masculin' : '-';
  const age = ageFromBirthDate(patientDetail?.date_naissance);
  const examDate = formatDateFr(runInfo?.completed_at || runInfo?.created_at);

  const allSlices = Array.isArray(runInfo?.results)
    ? [...runInfo.results].sort((a, b) => (a.slice_index || 0) - (b.slice_index || 0))
    : [];

  const measures = [
    {
      name: 'Volume hippocampe gauche',
      value: `${Number(vols.left || 0).toFixed(0)} mm3`,
      norm: '2200 - 2600',
      status: Number(vols.left || 0) >= 2200 && Number(vols.left || 0) <= 2600 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Volume hippocampe droit',
      value: `${Number(vols.right || 0).toFixed(0)} mm3`,
      norm: '2200 - 2600',
      status: Number(vols.right || 0) >= 2200 && Number(vols.right || 0) <= 2600 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Volume total',
      value: `${Number(vols.total || 0).toFixed(0)} mm3`,
      norm: '4500 - 5300',
      status: Number(vols.total || 0) >= 4500 && Number(vols.total || 0) <= 5300 ? 'Normal' : 'Alerte',
    },
    {
      name: "Indice d'asymetrie (IA)",
      value: `${Number(ci.asymmetry_index_percent || 0).toFixed(2)} %`,
      norm: '< 10 %',
      status: Math.abs(Number(ci.asymmetry_index_percent || 0)) < 10 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Indice de normalisation (IN)',
      value: `${Number(ci.normality_index_percent || 0).toFixed(2)} %`,
      norm: '90 - 110 %',
      status: Number(ci.normality_index_percent || 0) >= 90 && Number(ci.normality_index_percent || 0) <= 110 ? 'Normal' : 'Alerte',
    },
    {
      name: 'Z-Score',
      value: `${Number(ci.z_score || 0).toFixed(2)}`,
      norm: '-1.5 a +1.5',
      status: Number(ci.z_score || 0) >= -1.5 && Number(ci.z_score || 0) <= 1.5 ? 'Normal' : 'Alerte',
    },
  ];

  const bars = [
    { label: 'Hippocampe gauche', patient: Number(vols.left || 0), norm: 2430 },
    { label: 'Hippocampe droit', patient: Number(vols.right || 0), norm: 2430 },
    { label: 'Volume total', patient: Number(vols.total || 0), norm: Number(ref.normative_total_mean || 4860) },
  ];
  const barMax = Math.max(1, ...bars.map((b) => Math.max(b.patient, b.norm)));

  const volumeCategories = [
    {
      label: 'Hippocampe gauche',
      values: {
        patient: Number(vols.left || 0),
        minNorm: Number(ref.left_min_mm3 || 2200),
        maxNorm: Number(ref.left_max_mm3 || 2600),
      },
    },
    {
      label: 'Hippocampe droit',
      values: {
        patient: Number(vols.right || 0),
        minNorm: Number(ref.right_min_mm3 || 2200),
        maxNorm: Number(ref.right_max_mm3 || 2600),
      },
    },
    {
      label: 'Volume total',
      values: {
        patient: Number(vols.total || 0),
        minNorm: Number(ref.total_min_mm3 || 4500),
        maxNorm: Number(ref.total_max_mm3 || 5300),
      },
    },
  ];

  const volumeMaxValue = niceCeil(
    Math.max(
      5300,
      ...volumeCategories.flatMap((c) => [
        Number(c.values.patient || 0),
        Number(c.values.minNorm || 0),
        Number(c.values.maxNorm || 0),
      ]),
    ) * 1.03,
    500,
  );
  const volumeTicks = [1500, 2500, 3500, 4500, volumeMaxValue].filter((v, i, arr) => v <= volumeMaxValue && arr.indexOf(v) === i);

  const iaValue = Math.abs(Number(ci.asymmetry_index_percent || 0));
  const inValue = Number(ci.normality_index_percent || 0);
  const indicesCategories = [
    {
      label: 'IA - Asymetrie (%)',
      values: {
        patient: iaValue,
        seuil: 10,
      },
    },
    {
      label: 'IN - Normalisation (%)',
      values: {
        patient: inValue,
        seuil: 90,
      },
    },
  ];
  const indicesMaxValue = niceCeil(
    Math.max(120, ...indicesCategories.flatMap((c) => [Number(c.values.patient || 0), Number(c.values.seuil || 0)])) * 1.08,
    10,
  );
  const indexTicks = [0, 20, 40, 60, 80, 100, 120, indicesMaxValue]
    .filter((v, i, arr) => v <= indicesMaxValue && arr.indexOf(v) === i)
    .sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px]">
      <div className="mx-auto mt-8 w-[96vw] max-w-[1180px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-xl font-semibold text-[#1f3566]">Apercu du rapport</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExport}
              disabled={exportLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1f3a78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173062] disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              {exportLoading ? 'Generation...' : 'Exporter PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-[#2a3f72] hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
              Fermer
            </button>
          </div>
        </div>

        <div className="max-h-[82vh] overflow-y-auto px-8 py-6">
          <div className="flex items-start justify-between border-b-2 border-[#263e82] pb-4">
            <div>
              <p className="text-3xl font-bold text-[#1b3368]">VisionMed</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#8b9fc9]">Rapport de volumetrie hippocampique</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Genere le</p>
              <p className="text-xl font-semibold text-[#1c366b]">{examDate}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[#8ea0c9]">Informations patient</p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-white p-3">
                <UserRound className="h-5 w-5 text-[#8ea0c9]" />
                <div>
                  <p className="text-[11px] uppercase text-slate-400">Sexe</p>
                  <p className="text-base font-semibold text-[#1f3566]">{sex}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white p-3">
                <Hash className="h-5 w-5 text-[#8ea0c9]" />
                <div>
                  <p className="text-[11px] uppercase text-slate-400">Age</p>
                  <p className="text-base font-semibold text-[#1f3566]">{age != null ? `${age} ans` : '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white p-3">
                <CalendarDays className="h-5 w-5 text-[#8ea0c9]" />
                <div>
                  <p className="text-[11px] uppercase text-slate-400">Date d'examen</p>
                  <p className="text-base font-semibold text-[#1f3566]">{examDate}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#8ea0c9]"><Brain className="h-4 w-4" />Images cles - IRM segmentation</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Coupes du patient ({allSlices.length})</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {allSlices.map((slice, idx) => (
                    <div key={slice.id || idx} className="overflow-hidden rounded-lg border border-slate-200 bg-[#0e1b3e]">
                      <div className="relative aspect-[4/3]">
                        {slice?.source_url ? (
                          <>
                            <img
                              src={toAbsoluteMediaUrl(slice.source_url)}
                              alt={`slice-${slice.slice_index || idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {slice?.mask_url ? (
                              <img
                                src={toAbsoluteMediaUrl(slice.mask_url)}
                                alt={`mask-${slice.slice_index || idx + 1}`}
                                className="absolute inset-0 h-full w-full object-cover mix-blend-screen opacity-70"
                              />
                            ) : null}
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center text-[#f06b86]"><Brain className="h-5 w-5" /></div>
                        )}
                      </div>
                      <p className="border-t border-white/10 px-2 py-1 text-center text-[10px] text-[#d4def6]">Slice {slice?.slice_index ?? idx + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Visualisation 3D claire</p>
                <Mini3DPreview
                  objUrl={toAbsoluteMediaUrl(modelingResult?.obj_url)}
                  stlUrl={toAbsoluteMediaUrl(modelingResult?.stl_url)}
                />
                <p className="mt-2 text-xs text-slate-500">Reconstruction 3D des hippocampes (rotation automatique).</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#8ea0c9]"><FileText className="h-4 w-4" />Tableau des mesures volumetriques</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-[#233a83] text-xs uppercase tracking-[0.08em] text-white">
                  <tr>
                    <th className="px-4 py-3">Mesure</th>
                    <th className="px-4 py-3">Valeur</th>
                    <th className="px-4 py-3">Norme</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#2a3e72]">
                  {measures.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 font-semibold">{row.value}</td>
                      <td className="px-4 py-3 text-slate-500">{row.norm}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass(row.status)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#8ea0c9]"><Activity className="h-4 w-4" />Interpretation clinique automatique</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#6a9f90]">Epilepsie (MTLE) - IA</p>
                <p className="mt-1 text-sm leading-7 text-[#2d5772]">{interp.mtle_message || interp.ai_message || '-'}</p>
              </div>
              <div className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#6a9f90]">Alzheimer (MA) - IN</p>
                <p className="mt-1 text-sm leading-7 text-[#2d5772]">{interp.ni_message || '-'}</p>
              </div>
              <div className="rounded-xl border-l-4 border-blue-400 bg-blue-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#6b86b6]">Deviation statistique - Z-score</p>
                <p className="mt-1 text-sm leading-7 text-[#2d4f96]">{interp.z_message || '-'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#8ea0c9]"><BarChart3 className="h-4 w-4" />Graphiques personnalises du patient</p>
            <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ComparativeGroupedChart
                title="Volumes hippocampiques (mm3)"
                unit="mm3"
                yTicks={volumeTicks}
                yMax={volumeMaxValue}
                series={[
                  { key: 'patient', label: 'Patient', color: '#1f2f77' },
                  { key: 'minNorm', label: 'Norme minimale', color: '#a8c5e6' },
                  { key: 'maxNorm', label: 'Norme maximale', color: '#d7dfc8' },
                ]}
                categories={volumeCategories}
              />

              <ComparativeGroupedChart
                title="Indices cliniques IA et IN (%)"
                unit="%"
                yTicks={indexTicks}
                yMax={indicesMaxValue}
                series={[
                  { key: 'patient', label: 'Valeur patient', color: '#de5b79' },
                  { key: 'seuil', label: 'Seuil clinique', color: '#c4cad8', borderColor: '#1f4ea0' },
                ]}
                categories={indicesCategories}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Donnees patient: G={formatMm3(vols.left)} mm3, D={formatMm3(vols.right)} mm3, Total={formatMm3(vols.total)} mm3, IA={iaValue.toFixed(2)} %, IN={inValue.toFixed(2)} %.
            </p>
          </div>

          <div className="mt-6 rounded-2xl bg-[#20357d] px-6 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.12em] text-[#b6c7f5]">Conclusion synthetique</p>
            <p className="mt-2 text-base leading-8 font-medium">{interp.summary || '-'}</p>
            <p className="mt-3 border-t border-white/20 pt-3 text-xs text-[#94a8dc]">
              Volumes: G={Number(vols.left || 0).toFixed(0)} mm3 - D={Number(vols.right || 0).toFixed(0)} mm3 - Total={Number(vols.total || 0).toFixed(0)} mm3 - IA={Number(ci.asymmetry_index_percent || 0).toFixed(2)}% - IN={Number(ci.normality_index_percent || 0).toFixed(2)}% - Z={Number(ci.z_score || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Modelisation3D() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runId = Number(searchParams.get('run'));

  const [loadingRun, setLoadingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [runInfo, setRunInfo] = useState(null);
  const [modelingLoading, setModelingLoading] = useState(false);
  const [modelingError, setModelingError] = useState('');
  const [modelingResult, setModelingResult] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportPatientDetail, setReportPatientDetail] = useState(null);

  const [standardMode, setStandardMode] = useState({
    structure: 'both',
    quality: 'standard',
    smoothing: 'low',
    threshold: '0.25',
    knowsSpacing: false,
    spacingZ: '1.0',
    spacingY: '1.0',
    spacingX: '1.0',
    useCustomReference: false,
    normativeTotalMeanMm3: '4860.14',
    normativeTotalStdMm3: '201.16',
  });

  useEffect(() => {
    if (!Number.isFinite(runId) || runId <= 0) {
      setRunError('Run de segmentation invalide.');
      return;
    }

    const fetchRun = async () => {
      setLoadingRun(true);
      setRunError('');
      try {
        const token = localStorage.getItem('access');
        const response = await api.get(`/segmentation-runs/${runId}/`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const run = response?.data?.run;
        if (!run) {
          setRunError('Impossible de recuperer ce run de segmentation.');
          return;
        }

        setRunInfo(run);
        if (run?.threshold != null) {
          setStandardMode((prev) => ({ ...prev, threshold: String(run.threshold) }));
        }
      } catch {
        setRunError('Impossible de charger le run de segmentation.');
      } finally {
        setLoadingRun(false);
      }
    };

    fetchRun();
  }, [runId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setStandardMode((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLaunchModeling = () => {
    if (!Number.isFinite(runId) || runId <= 0) return;

    const payload = {
      structure: standardMode.structure,
      quality: standardMode.quality,
      smoothing: standardMode.smoothing,
      spacing_z: standardMode.knowsSpacing ? standardMode.spacingZ : 1.0,
      spacing_y: standardMode.knowsSpacing ? standardMode.spacingY : 1.0,
      spacing_x: standardMode.knowsSpacing ? standardMode.spacingX : 1.0,
      ...(standardMode.useCustomReference
        ? {
            normative_total_mean_mm3: standardMode.normativeTotalMeanMm3,
            normative_total_std_mm3: standardMode.normativeTotalStdMm3,
          }
        : {}),
    };

    const run = async () => {
      setModelingLoading(true);
      setModelingError('');
      setModelingResult(null);
      try {
        const token = localStorage.getItem('access');
        const response = await api.post(`/segmentation-runs/${runId}/modelisation-3d/`, payload, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const result = response?.data?.modelisation;
        if (!result) {
          setModelingError('Aucun resultat de modelisation 3D retourne par le serveur.');
          return;
        }
        setModelingResult(result);
      } catch (err) {
        const apiMessage =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.response?.data?.message;
        setModelingError(apiMessage || 'Echec de la modelisation 3D.');
      } finally {
        setModelingLoading(false);
      }
    };

    run();
  };

  const handleDownloadReportPdf = async () => {
    if (!Number.isFinite(runId) || runId <= 0) return;
    setReportLoading(true);
    setReportError('');

    try {
      const payload = {
        structure: standardMode.structure,
        quality: standardMode.quality,
        smoothing: standardMode.smoothing,
        spacing_z: standardMode.knowsSpacing ? standardMode.spacingZ : 1.0,
        spacing_y: standardMode.knowsSpacing ? standardMode.spacingY : 1.0,
        spacing_x: standardMode.knowsSpacing ? standardMode.spacingX : 1.0,
        ...(standardMode.useCustomReference
          ? {
              normative_total_mean_mm3: standardMode.normativeTotalMeanMm3,
              normative_total_std_mm3: standardMode.normativeTotalStdMm3,
            }
          : {}),
      };

      const token = localStorage.getItem('access');
      const response = await downloadSegmentationReportPdf(runId, payload, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_segmentation_run_${runId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const apiMessage = err?.response?.data?.error || err?.response?.data?.detail;
      setReportError(apiMessage || 'Echec generation du rapport PDF.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenReportPreview = async () => {
    setReportPreviewOpen(true);
    setReportError('');

    if (!runInfo?.patient) return;
    try {
      const token = localStorage.getItem('access');
      const response = await api.get(`/patients/${runInfo.patient}/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const patient = response?.data?.patient || response?.data;
      setReportPatientDetail(patient || null);
    } catch {
      setReportPatientDetail(null);
    }
  };

  const toAbsoluteMediaUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
    const origin = base.replace(/\/api$/i, '');
    return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
  };

  const aiValue = Number(modelingResult?.clinical_indices?.asymmetry_index_percent || 0);
  const niValue = Number(modelingResult?.clinical_indices?.normality_index_percent || 0);
  const aiMeaning = modelingResult?.clinical_interpretation?.ai_message || '';
  const niMeaning = modelingResult?.clinical_interpretation?.ni_message || '';
  const mtleMeaning = modelingResult?.clinical_interpretation?.mtle_message || '-';
  const globalConclusion = modelingResult?.clinical_interpretation?.summary || '-';
  const aiStatus = getAiStatus(aiValue).label;
  const niStatus = getNiStatus(niValue).label;
  const conciseConclusion =
    niStatus === 'Severe'
      ? 'Atrophie hippocampique probable. Correlation clinique recommandee.'
      : niStatus === 'Alerte'
        ? 'Profil borderline. Surveillance clinique et comparaison evolutive conseillees.'
        : niStatus === 'Haut'
          ? 'Profil d\'hyperplasie. A interpreter avec le contexte clinique.'
          : aiStatus === 'Normal'
            ? 'Profil volumetrique dans la norme, sans lateralisation nette.'
            : 'Profil global stable avec asymetrie a surveiller.';

  return (
    <div className="min-h-screen bg-[#f5f7ff] p-6 md:p-10">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/segmentation/nouvelle?run=${runId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux resultats
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/analysesMRI')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Aller a Analyses MRI
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8edf8] text-[#1a2b6d]">
              <Box className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#1a2b6d]">Modelisation 3D - Mode standard</h1>
              <p className="text-sm text-slate-500">Configurez 4-5 options cliniques avant la reconstruction 3D.</p>
            </div>
          </div>

          {loadingRun && (
            <div className="mt-6 h-24 flex items-center justify-center">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1a2b6d] border-t-transparent" />
            </div>
          )}

          {!loadingRun && runError && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {runError}
            </div>
          )}

          {!loadingRun && !runError && runInfo && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Run ID</p>
                  <p className="text-sm font-semibold text-[#1a2b6d]">#{runInfo.id}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Modele segmentation</p>
                  <p className="text-sm font-semibold text-[#1a2b6d]">{runInfo.model_key || 'unetpp'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coupes traitees</p>
                  <p className="text-sm font-semibold text-[#1a2b6d]">{runInfo.processed_count || 0}/{runInfo.selected_count || 0}</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-5">
                <h2 className="text-base font-semibold text-[#1a2b6d]">Parametres medicaux (mode standard)</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a2b6d]">Structure a reconstruire</label>
                    <select name="structure" value={standardMode.structure} onChange={handleChange} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="both">Hippocampe gauche + droit</option>
                      <option value="left">Hippocampe gauche</option>
                      <option value="right">Hippocampe droit</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a2b6d]">Qualite maillage</label>
                    <select name="quality" value={standardMode.quality} onChange={handleChange} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="fast">Rapide</option>
                      <option value="standard">Standard</option>
                      <option value="high">Haute</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a2b6d]">Lissage surface</label>
                    <select name="smoothing" value={standardMode.smoothing} onChange={handleChange} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="none">Aucun</option>
                      <option value="low">Faible</option>
                      <option value="medium">Moyen</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a2b6d]">Seuil segmentation</label>
                    <input
                      name="threshold"
                      value={standardMode.threshold}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="0.25"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-[#1a2b6d]">
                    <input
                      type="checkbox"
                      name="knowsSpacing"
                      checked={standardMode.knowsSpacing}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Je connais le spacing voxel
                  </label>

                  {standardMode.knowsSpacing && (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Spacing Z (mm)</label>
                        <input name="spacingZ" value={standardMode.spacingZ} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Spacing Y (mm)</label>
                        <input name="spacingY" value={standardMode.spacingY} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Spacing X (mm)</label>
                        <input name="spacingX" value={standardMode.spacingX} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-[#1a2b6d]">
                    <input
                      type="checkbox"
                      name="useCustomReference"
                      checked={standardMode.useCustomReference}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Utiliser une reference normative personnalisee (NI/Z)
                  </label>

                  {standardMode.useCustomReference && (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Volume moyen reference (mm3)</label>
                        <input
                          name="normativeTotalMeanMm3"
                          value={standardMode.normativeTotalMeanMm3}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Ecart-type reference (mm3)</label>
                        <input
                          name="normativeTotalStdMm3"
                          value={standardMode.normativeTotalStdMm3}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/analysesMRI')}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Enregistrer et revenir aux analyses
                </button>
                <button
                  type="button"
                  onClick={handleLaunchModeling}
                  disabled={modelingLoading}
                  className="rounded-lg bg-[#1a2b6d] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f1f5c] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modelingLoading ? 'Modelisation en cours...' : 'Lancer la modelisation 3D'}
                </button>
              </div>

              {modelingError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {modelingError}
                </div>
              ) : null}

              {modelingResult ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-[#1a2b6d]">Resultat de modelisation 3D</h3>

                  <div className="mt-4">
                    <MeshViewer
                      objUrl={toAbsoluteMediaUrl(modelingResult.obj_url)}
                      stlUrl={toAbsoluteMediaUrl(modelingResult.stl_url)}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Volume voxel</p>
                      <p className="text-sm font-semibold text-[#1a2b6d]">
                        {Number(modelingResult.volume_voxel_mm3 || 0).toFixed(2)} mm3 ({Number(modelingResult.volume_voxel_ml || 0).toFixed(3)} mL)
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Volume mesh</p>
                      <p className="text-sm font-semibold text-[#1a2b6d]">
                        {modelingResult.volume_mesh_mm3 != null
                          ? `${Number(modelingResult.volume_mesh_mm3).toFixed(2)} mm3 (${Number(modelingResult.volume_mesh_ml || 0).toFixed(3)} mL)`
                          : 'Non disponible (mesh non watertight)'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Vertices / Faces</p>
                      <p className="text-sm font-semibold text-[#1a2b6d]">{modelingResult.mesh_vertices} / {modelingResult.mesh_faces}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Coupes utilisees</p>
                      <p className="text-sm font-semibold text-[#1a2b6d]">{modelingResult.slices_used}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="rounded-xl bg-[#1f3a63] px-5 py-4 text-white">
                      <h4 className="text-xl font-medium">Synthese clinique - Hippocampe</h4>
                      <p className="mt-1 text-sm text-slate-200">
                        Reference normative: moyenne {Number(modelingResult?.reference_values_mm3?.normative_total_mean || 0).toFixed(0)} mm3,
                        sigma {Number(modelingResult?.reference_values_mm3?.normative_total_std || 0).toFixed(0)} mm3
                      </p>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-lg font-medium text-[#213a63]">Volumes hippocampiques</p>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-white text-sm text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Structure</th>
                            <th className="px-4 py-3 font-semibold">Volume</th>
                            <th className="px-4 py-3 font-semibold">Norme</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700">
                          <tr className="border-t border-slate-200">
                            <td className="px-4 py-3">Hippocampe gauche</td>
                            <td className="px-4 py-3 font-semibold text-[#213a63]">{Number(modelingResult?.volumes_mm3?.left || 0).toFixed(0)} mm3</td>
                            <td className="px-4 py-3 text-slate-500">2300 - 2700</td>
                          </tr>
                          <tr className="border-t border-slate-200">
                            <td className="px-4 py-3">Hippocampe droit</td>
                            <td className="px-4 py-3 font-semibold text-[#213a63]">{Number(modelingResult?.volumes_mm3?.right || 0).toFixed(0)} mm3</td>
                            <td className="px-4 py-3 text-slate-500">2200 - 2600</td>
                          </tr>
                          <tr className="border-t border-slate-200 bg-slate-50">
                            <td className="px-4 py-3 font-semibold">Volume total</td>
                            <td className="px-4 py-3 font-semibold text-[#213a63]">{Number(modelingResult?.volumes_mm3?.total || 0).toFixed(0)} mm3</td>
                            <td className="px-4 py-3 text-slate-500">4500 - 5300</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                        AI = (D - G) / ((D + G) / 2) = <span className="font-semibold text-[#213a63]">{Math.abs(aiValue).toFixed(2)}%</span>
                      </p>
                    </div>

                    <div className="mt-4 space-y-4">
                      <AIGauge value={aiValue} interpretation={mtleMeaning || aiMeaning} />
                      <NIGauge value={niValue} interpretation={niMeaning} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-[#4c66ab] bg-[#2e4f9e] p-4 md:h-32">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d3def8]">Lecture rapide</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-[#e5ecff]">IA : <span className="font-semibold text-[#f2f6ff]">{aiValue.toFixed(2)} %</span> - <span className="text-[#c8f3df]">{aiStatus}</span></p>
                        <p className="text-sm font-medium leading-6 text-[#e5ecff]">IN : <span className="font-semibold text-[#f2f6ff]">{niValue.toFixed(2)} %</span> - <span className="text-[#c8f3df]">{niStatus}</span></p>
                      </div>
                      <div className="rounded-xl border border-[#4c66ab] bg-[#2e4f9e] p-4 md:h-32">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d3def8]">Epilepsie (MTLE)</p>
                        <div className="mt-2 max-h-16 overflow-y-auto pr-1">
                          <p className="text-sm font-medium leading-6 text-[#e5ecff]">{mtleMeaning}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#4c66ab] bg-[#2e4f9e] p-4 md:h-32">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d3def8]">Alzheimer (MA)</p>
                        <div className="mt-2 max-h-16 overflow-y-auto pr-1">
                          <p className="text-sm font-medium leading-6 text-[#e5ecff]">{niMeaning || 'Interpretation MA indisponible.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-[#4c66ab] bg-[#29468f] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d3def8]">Conclusion synthetique</p>
                      <p className="mt-2 text-base leading-7 font-semibold text-[#f0f5ff]">{conciseConclusion}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      href={toAbsoluteMediaUrl(modelingResult.obj_url)}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Telecharger OBJ
                    </a>
                    <a
                      href={toAbsoluteMediaUrl(modelingResult.stl_url)}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Telecharger STL
                    </a>
                    <button
                      type="button"
                      onClick={handleOpenReportPreview}
                      disabled={reportLoading || !modelingResult}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Apercu rapport
                    </button>
                  </div>
                  {reportError ? (
                    <p className="mt-2 text-xs text-red-600">{reportError}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Le modele 3D est deja visualise ci-dessus dans la plateforme. Les boutons OBJ/STL servent a exporter les fichiers pour Blender, MeshLab ou 3D Slicer.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ReportPreviewModal
        open={reportPreviewOpen}
        onClose={() => setReportPreviewOpen(false)}
        onExport={handleDownloadReportPdf}
        exportLoading={reportLoading}
        runInfo={runInfo}
        modelingResult={modelingResult}
        patientDetail={reportPatientDetail}
        toAbsoluteMediaUrl={toAbsoluteMediaUrl}
      />
    </div>
  );
}
