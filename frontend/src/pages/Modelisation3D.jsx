import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, ArrowLeft } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import api from '../api';

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

function AIGauge({ value }) {
  const v = Math.abs(Number(value || 0));
  const status = getAiStatus(v);
  const marker = (clamp(v, 0, 100) / 100) * 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xl font-semibold text-[#213a63]">AI - Asymetrie Index</p>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      <p className="mt-2 text-5xl font-bold text-[#213a63]">{v.toFixed(2)}%</p>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
        <div className="h-full bg-emerald-500" style={{ width: '10%' }} />
        <div className="absolute top-0 h-full bg-red-500" style={{ left: '10%', width: '90%' }} />
        <ThresholdLine leftPercent={10} colorClass="bg-slate-600" />

        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${marker}%` }}
          title={`AI=${v.toFixed(2)}%`}
        >
          <span className="block h-8 w-4 rounded-md border-2 border-white bg-[#1f3357] shadow-[0_4px_14px_rgba(15,23,42,0.45)] ring-2 ring-[#1f3357]/25" />
        </span>
      </div>

      <div className="relative mt-2 h-5 text-sm text-slate-500">
        <span className="absolute left-0">0%</span>
        <span className="absolute" style={{ left: '10%', transform: 'translateX(-50%)' }}>10%</span>
        <span className="absolute right-0">100%</span>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
        <p><span className="font-semibold">Seuil clinique:</span> 10%</p>
        <p className="mt-1">&lt; 10%: asymetrie non significative</p>
        <p>&gt;= 10%: asymetrie significative</p>
      </div>
    </div>
  );
}

function NIGauge({ value }) {
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
        <p className="text-2xl font-semibold text-[#213a63]">NI - Normalisation Index</p>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      <p className="mt-2 text-5xl font-bold text-[#213a63]">{v.toFixed(2)}%</p>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        <div className="absolute left-0 top-0 h-full bg-red-500/75" style={{ width: `${p60}%` }} />
        <div className="absolute top-0 h-full bg-amber-500/80" style={{ left: `${p60}%`, width: `${p80 - p60}%` }} />
        <div className="absolute top-0 h-full bg-yellow-400/85" style={{ left: `${p80}%`, width: `${p90 - p80}%` }} />
        <div className="absolute top-0 h-full bg-green-500/70" style={{ left: `${p90}%`, width: `${p110 - p90}%` }} />
        <div className="absolute top-0 h-full bg-blue-500/70" style={{ left: `${p110}%`, width: `${100 - p110}%` }} />

        <ThresholdLine leftPercent={p60} colorClass="bg-slate-700" />
        <ThresholdLine leftPercent={p80} colorClass="bg-slate-700" />
        <ThresholdLine leftPercent={p90} colorClass="bg-orange-700" />
        <ThresholdLine leftPercent={p110} colorClass="bg-slate-700" />

        <span
          className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-md border-2 border-white bg-slate-800 shadow"
          style={{ left: `calc(${marker}% - 12px)` }}
          title={`NI=${v.toFixed(2)}%`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
        <span>0%</span>
        <span>&lt;60</span>
        <span>80</span>
        <span>90</span>
        <span>110</span>
        <span>150%</span>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
        <p><span className="font-semibold">Seuils:</span> 60 / 80 / 90 / 110</p>
        <p className="mt-1">&gt;= 90%: normal</p>
        <p>80-90%: reduction legere</p>
        <p>60-80%: reduction moderee</p>
        <p>&lt; 60%: reduction severe</p>
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
  const mtleMeaning = modelingResult?.clinical_interpretation?.mtle_message || '-';
  const globalConclusion = modelingResult?.clinical_interpretation?.summary || '-';

  return (
    <div className="min-h-screen bg-[#f5f7ff] p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
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
                      <h4 className="text-3xl font-semibold">Synthese clinique - Hippocampe</h4>
                      <p className="mt-1 text-sm text-slate-200">
                        Reference normative: moyenne {Number(modelingResult?.reference_values_mm3?.normative_total_mean || 0).toFixed(0)} mm3,
                        sigma {Number(modelingResult?.reference_values_mm3?.normative_total_std || 0).toFixed(0)} mm3
                      </p>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xl font-semibold text-[#213a63]">Volumes hippocampiques</p>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-white text-sm text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Structure</th>
                            <th className="px-4 py-3 font-semibold">Volume</th>
                            <th className="px-4 py-3 font-semibold">Norme</th>
                          </tr>
                        </thead>
                        <tbody className="text-base text-slate-700">
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
                      <AIGauge value={aiValue} />
                      <NIGauge value={niValue} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:h-36">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Lecture rapide</p>
                        <p className="mt-2 text-base leading-6 text-slate-800">AI : <span className="font-semibold">{getAiStatus(aiValue).label}</span></p>
                        <p className="text-base leading-6 text-slate-800">NI : <span className="font-semibold">{getNiStatus(niValue).label}</span></p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:h-36">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">MTLE (epilepsie)</p>
                        <div className="mt-2 max-h-20 overflow-y-auto pr-1">
                          <p className="text-base leading-6 text-slate-800">{mtleMeaning}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 md:h-36">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">Conclusion</p>
                        <div className="mt-2 max-h-20 overflow-y-auto pr-1">
                          <p className="text-base leading-6 font-semibold text-[#1e3256]">{globalConclusion}</p>
                        </div>
                      </div>
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
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Le modele 3D est deja visualise ci-dessus dans la plateforme. Les boutons OBJ/STL servent a exporter les fichiers pour Blender, MeshLab ou 3D Slicer.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
