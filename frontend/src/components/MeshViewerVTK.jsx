import React, { useEffect, useRef, useState } from 'react';
// Le paquet n'exporte pas l'objet racine : il attache les namespaces sur window.vtk
import '@kitware/vtk.js';

const vtk = typeof window !== 'undefined' ? window.vtk : null;

/** Fond #f8fafc */
const BG_FULL = [0.972549, 0.980392, 0.988235];
/** Fond #0f172a (mini preview) */
const BG_MINI = [0.058824, 0.090196, 0.164706];
const MESH_COLOR = [0.145, 0.388, 0.922];

function hexToRgb01(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length !== 6) return MESH_COLOR;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return MESH_COLOR;
  return [r / 255, g / 255, b / 255];
}

function connectReaderToMapper(reader, mapper) {
  const n =
    typeof reader.getNumberOfOutputPorts === 'function'
      ? reader.getNumberOfOutputPorts()
      : 1;
  const extra = [];
  if (n <= 1) {
    mapper.setInputConnection(reader.getOutputPort(0));
    return extra;
  }
  const append = vtk.Filters.General.vtkAppendPolyData.newInstance();
  for (let i = 0; i < n; i += 1) {
    append.addInputConnection(reader.getOutputPort(i));
  }
  mapper.setInputConnection(append.getOutputPort());
  extra.push(append);
  return extra;
}

async function loadMeshReader(objUrl, stlUrl) {
  if (objUrl) {
    const reader = vtk.IO.Misc.vtkOBJReader.newInstance();
    await reader.setUrl(objUrl, {});
    return reader;
  }
  if (stlUrl) {
    const reader = vtk.IO.Geometry.vtkSTLReader.newInstance();
    await reader.setUrl(stlUrl, { binary: true });
    return reader;
  }
  return null;
}

function applyAnatomicalView(camera, renderer, renderWindow, view) {
  const fp = camera.getFocalPoint();
  const pos = camera.getPosition();
  const dx = pos[0] - fp[0];
  const dy = pos[1] - fp[1];
  const dz = pos[2] - fp[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 200;

  if (view === 'axial') {
    camera.setPosition(fp[0], fp[1], fp[2] + dist);
    camera.setViewUp(0, 1, 0);
  } else if (view === 'coronal') {
    camera.setPosition(fp[0], fp[1] + dist, fp[2]);
    camera.setViewUp(0, 0, 1);
  } else if (view === 'sagittal') {
    camera.setPosition(fp[0] + dist, fp[1], fp[2]);
    camera.setViewUp(0, 0, 1);
  }
  camera.modified();
  renderer.resetCameraClippingRange();
  renderWindow.render();
}

/**
 * Visualisation maillage hippocampe (OBJ/STL) avec VTK.js (WebGL).
 * @param {'full'|'mini'} variant — full: barre d'outils ; mini: aperçu sombre + rotation auto
 */
export default function MeshViewerVTK({ objUrl, stlUrl, variant = 'full', className }) {
  const mountRef = useRef(null);
  const actorRef = useRef(null);
  const renderWindowRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraDistanceRef = useRef(120);
  const rafRotateRef = useRef(0);
  const [viewerError, setViewerError] = useState('');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(variant === 'mini');
  const [meshColor, setMeshColor] = useState('#2563eb');

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl || !vtk) {
      if (!vtk) setViewerError('VTK.js indisponible (window.vtk).');
      return undefined;
    }

    setViewerError('');
    const width = Math.max(mountEl.clientWidth, variant === 'mini' ? 260 : 320);
    const height = Math.max(mountEl.clientHeight, variant === 'mini' ? 220 : 300);
    const bg = variant === 'mini' ? BG_MINI : BG_FULL;

    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
      rootContainer: mountEl,
      background: bg,
      containerStyle: { width: '100%', height: '100%', position: 'relative' },
    });

    const renderer = fullScreenRenderer.getRenderer();
    const renderWindow = fullScreenRenderer.getRenderWindow();
    const interactor = fullScreenRenderer.getInteractor();
    const istyle = vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
    interactor.setInteractorStyle(istyle);

    const camera = renderer.getActiveCamera();
    renderWindowRef.current = renderWindow;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    const mapper = vtk.Rendering.Core.vtkMapper.newInstance({ scalarVisibility: false });
    const actor = vtk.Rendering.Core.vtkActor.newInstance();
    actor.setMapper(mapper);
    actor.getProperty().setColor(...hexToRgb01(meshColor));
    actor.getProperty().setSpecular(0.25);
    actor.getProperty().setSpecularPower(20);
    actor.getProperty().setAmbient(0.35);
    actor.getProperty().setDiffuse(0.65);
    actorRef.current = actor;

    const disposables = [fullScreenRenderer, mapper, actor, istyle];

    let cancelled = false;

    (async () => {
      try {
        const reader = await loadMeshReader(objUrl, stlUrl);
        if (cancelled || !reader) {
          reader?.delete?.();
          if (!reader && !cancelled) setViewerError('Aucun fichier OBJ/STL disponible pour affichage.');
          return;
        }
        disposables.push(reader);
        const extra = connectReaderToMapper(reader, mapper);
        extra.forEach((f) => disposables.push(f));

        renderer.addActor(actor);
        renderer.resetCamera();
        const bounds = renderer.computeVisiblePropBounds();
        const cx = (bounds[0] + bounds[1]) / 2;
        const cy = (bounds[2] + bounds[3]) / 2;
        const cz = (bounds[4] + bounds[5]) / 2;
        const dx = bounds[1] - bounds[0];
        const dy = bounds[3] - bounds[2];
        const dz = bounds[5] - bounds[4];
        const maxDim = Math.max(dx, dy, dz) || 1;
        const fov = (camera.getViewAngle() * Math.PI) / 180;
        const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.85;
        cameraDistanceRef.current = Math.max(dist, 80);
        camera.setFocalPoint(cx, cy, cz);
        camera.setPosition(cx, cy, cz + cameraDistanceRef.current);
        camera.setViewUp(0, 1, 0);
        camera.modified();
        renderer.resetCameraClippingRange();
        renderWindow.render();
      } catch {
        if (!cancelled) setViewerError('Impossible de charger le modele 3D (VTK).');
      }
    })();

    const handleResize = () => {
      if (!mountRef.current) return;
      fullScreenRenderer.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (rafRotateRef.current) {
        cancelAnimationFrame(rafRotateRef.current);
        rafRotateRef.current = 0;
      }
      actorRef.current = null;
      renderWindowRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      disposables.forEach((d) => {
        try {
          d.delete?.();
        } catch {
          /* ignore */
        }
      });
      mountEl.innerHTML = '';
    };
  }, [objUrl, stlUrl, variant]);

  useEffect(() => {
    const actor = actorRef.current;
    const rw = renderWindowRef.current;
    if (!actor || !rw) return;
    if (wireframe) {
      actor.getProperty().setRepresentationToWireframe();
    } else {
      actor.getProperty().setRepresentationToSurface();
    }
    rw.render();
  }, [wireframe]);

  useEffect(() => {
    const actor = actorRef.current;
    const rw = renderWindowRef.current;
    if (!actor || !rw) return;
    actor.getProperty().setColor(...hexToRgb01(meshColor));
    rw.render();
  }, [meshColor]);

  useEffect(() => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const rw = renderWindowRef.current;
    if (!camera || !renderer || !rw) return;

    const spin = variant === 'mini' ? true : autoRotate;
    if (!spin) {
      if (rafRotateRef.current) {
        cancelAnimationFrame(rafRotateRef.current);
        rafRotateRef.current = 0;
      }
      return undefined;
    }

    const loop = () => {
      camera.azimuth(variant === 'mini' ? 0.35 : 0.25);
      renderer.resetCameraClippingRange();
      rw.render();
      rafRotateRef.current = requestAnimationFrame(loop);
    };
    rafRotateRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRotateRef.current) {
        cancelAnimationFrame(rafRotateRef.current);
        rafRotateRef.current = 0;
      }
    };
  }, [autoRotate, variant, objUrl, stlUrl]);

  const setAnatomicalView = (view) => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const rw = renderWindowRef.current;
    if (!camera || !renderer || !rw) return;
    applyAnatomicalView(camera, renderer, rw, view);
  };

  const resetView = () => setAnatomicalView('axial');

  const navBtn = (active, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  );

  const containerClass =
    className ||
    (variant === 'mini'
      ? 'h-[250px] w-full overflow-hidden rounded-xl border border-slate-200'
      : 'h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50 to-white shadow-inner');

  return (
    <div className={variant === 'full' ? 'space-y-3' : ''}>
      {variant === 'full' && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50/70 p-2.5">
            <span className="px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">VTK.js</span>
            {navBtn(false, 'Axial', () => setAnatomicalView('axial'))}
            {navBtn(false, 'Coronal', () => setAnatomicalView('coronal'))}
            {navBtn(false, 'Sagittal', () => setAnatomicalView('sagittal'))}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-500 border border-slate-200">
              Couleur
              <input
                type="color"
                value={meshColor}
                onChange={(e) => setMeshColor(e.target.value)}
                className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Changer la couleur de l'hippocampe"
              />
            </label>
            {navBtn(wireframe, wireframe ? 'Fil de fer ON' : 'Fil de fer', () => setWireframe((p) => !p))}
            {navBtn(autoRotate, autoRotate ? 'Rotation auto ON' : 'Rotation auto', () => setAutoRotate((p) => !p))}
            {navBtn(false, 'Reset', resetView)}
          </div>
          <p className="text-[10px] text-slate-500 px-0.5">
            Clic gauche : tourner · Molette : zoom · Clic droit : déplacer
          </p>
        </>
      )}

      <div ref={mountRef} className={containerClass} />

      {variant === 'full' && viewerError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          {viewerError}
        </div>
      ) : null}
    </div>
  );
}
