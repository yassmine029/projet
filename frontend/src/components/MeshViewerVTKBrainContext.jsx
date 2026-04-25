import React, { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js';
import { attachSceneAxesAndGrid, detachSceneAxesAndGrid } from './vtkOrientationAxes.js';

const vtk = typeof window !== 'undefined' ? window.vtk : null;

const BG_FULL = [0.972549, 0.980392, 0.988235];

function hexToRgb01(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length !== 6) return [0.88, 0.15, 0.35];
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return [0.88, 0.15, 0.35];
  return [r / 255, g / 255, b / 255];
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
 * Volume IRM (maillage enveloppe) + hippocampe colore, meme repere que la modelisation.
 */
export default function MeshViewerVTKBrainContext({
  brainObjUrl,
  hippObjUrl,
  hippStlUrl,
  className,
}) {
  const mountRef = useRef(null);
  const brainActorRef = useRef(null);
  const hippActorRef = useRef(null);
  const renderWindowRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraDistanceRef = useRef(120);
  const [viewerError, setViewerError] = useState('');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hippColor, setHippColor] = useState('#e11d48');
  const [brainOpacity, setBrainOpacity] = useState(0.22);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl || !vtk) {
      if (!vtk) setViewerError('VTK.js indisponible (window.vtk).');
      return undefined;
    }

    setViewerError('');
    const width = Math.max(mountEl.clientWidth, 320);
    const height = Math.max(mountEl.clientHeight, 300);

    const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
      rootContainer: mountEl,
      background: BG_FULL,
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

    const brainMapper = vtk.Rendering.Core.vtkMapper.newInstance({ scalarVisibility: false });
    const brainActor = vtk.Rendering.Core.vtkActor.newInstance();
    brainActor.setMapper(brainMapper);
    brainActor.getProperty().setColor(0.55, 0.58, 0.62);
    brainActor.getProperty().setOpacity(brainOpacity);
    brainActor.getProperty().setAmbient(0.45);
    brainActor.getProperty().setDiffuse(0.4);
    brainActor.getProperty().setSpecular(0.08);
    brainActor.getProperty().setBackfaceCulling(false);
    brainActorRef.current = brainActor;

    const hippMapper = vtk.Rendering.Core.vtkMapper.newInstance({ scalarVisibility: false });
    const hippActor = vtk.Rendering.Core.vtkActor.newInstance();
    hippActor.setMapper(hippMapper);
    hippActor.getProperty().setColor(...hexToRgb01(hippColor));
    hippActor.getProperty().setOpacity(1.0);
    hippActor.getProperty().setSpecular(0.25);
    hippActor.getProperty().setSpecularPower(20);
    hippActor.getProperty().setAmbient(0.35);
    hippActor.getProperty().setDiffuse(0.65);
    hippActor.getProperty().setBackfaceCulling(false);
    hippActorRef.current = hippActor;

    const disposables = [fullScreenRenderer, brainMapper, brainActor, hippMapper, hippActor, istyle];

    let cancelled = false;
    let orientationBundle = null;

    (async () => {
      try {
        const brainReader = await loadMeshReader(brainObjUrl, null);
        const hippReader = await loadMeshReader(hippObjUrl, hippStlUrl);
        if (cancelled) {
          brainReader?.delete?.();
          hippReader?.delete?.();
          return;
        }
        if (!brainReader || !hippReader) {
          brainReader?.delete?.();
          hippReader?.delete?.();
          setViewerError('Fichiers maillage contexte ou hippocampe manquants.');
          return;
        }
        disposables.push(brainReader, hippReader);
        connectReaderToMapper(brainReader, brainMapper).forEach((x) => disposables.push(x));
        connectReaderToMapper(hippReader, hippMapper).forEach((x) => disposables.push(x));

        renderer.addActor(brainActor);
        renderer.addActor(hippActor);
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

        if (!cancelled) {
          orientationBundle = attachSceneAxesAndGrid(vtk, {
            renderer,
            renderWindow,
          });
        }
      } catch {
        if (!cancelled) setViewerError('Impossible de charger le modele contexte (VTK).');
      }
    })();

    const handleResize = () => {
      if (!mountRef.current) return;
      fullScreenRenderer.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      detachSceneAxesAndGrid(orientationBundle);
      orientationBundle = null;
      window.removeEventListener('resize', handleResize);
      brainActorRef.current = null;
      hippActorRef.current = null;
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
  }, [brainObjUrl, hippObjUrl, hippStlUrl]);

  useEffect(() => {
    const ba = brainActorRef.current;
    const rw = renderWindowRef.current;
    if (!ba || !rw) return;
    ba.getProperty().setOpacity(brainOpacity);
    rw.render();
  }, [brainOpacity]);

  useEffect(() => {
    const ha = hippActorRef.current;
    const rw = renderWindowRef.current;
    if (!ha || !rw) return;
    ha.getProperty().setColor(...hexToRgb01(hippColor));
    rw.render();
  }, [hippColor]);

  useEffect(() => {
    const ba = brainActorRef.current;
    const ha = hippActorRef.current;
    const rw = renderWindowRef.current;
    if (!ba || !ha || !rw) return;
    if (wireframe) {
      ba.getProperty().setRepresentationToWireframe();
      ha.getProperty().setRepresentationToWireframe();
    } else {
      ba.getProperty().setRepresentationToSurface();
      ha.getProperty().setRepresentationToSurface();
    }
    rw.render();
  }, [wireframe]);

  useEffect(() => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const rw = renderWindowRef.current;
    if (!camera || !renderer || !rw) return;
    if (!autoRotate) return undefined;
    let raf = 0;
    const loop = () => {
      camera.azimuth(0.22);
      renderer.resetCameraClippingRange();
      rw.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [autoRotate, brainObjUrl, hippObjUrl, hippStlUrl]);

  const setAnatomicalView = (view) => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const rw = renderWindowRef.current;
    if (!camera || !renderer || !rw) return;
    applyAnatomicalView(camera, renderer, rw, view);
  };

  const navBtn = (active, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${active ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  );

  const containerClass =
    className || 'h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50 to-white shadow-inner';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50/70 p-2.5">
        <span className="px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Contexte</span>
        {navBtn(false, 'Axial', () => setAnatomicalView('axial'))}
        {navBtn(false, 'Coronal', () => setAnatomicalView('coronal'))}
        {navBtn(false, 'Sagittal', () => setAnatomicalView('sagittal'))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <label className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-500 border border-slate-200">
          Hippocampe
          <input
            type="color"
            value={hippColor}
            onChange={(e) => setHippColor(e.target.value)}
            className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            title="Couleur hippocampe"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-500 border border-slate-200">
          Opacite cerveau
          <input
            type="range"
            min={0.05}
            max={0.55}
            step={0.02}
            value={brainOpacity}
            onChange={(e) => setBrainOpacity(Number(e.target.value))}
            className="w-24"
          />
        </label>
        {navBtn(wireframe, wireframe ? 'Fil ON' : 'Fil de fer', () => setWireframe((p) => !p))}
        {navBtn(autoRotate, autoRotate ? 'Rotation ON' : 'Rotation', () => setAutoRotate((p) => !p))}
        {navBtn(false, 'Reset', () => setAnatomicalView('axial'))}
      </div>
      <p className="text-[10px] text-slate-500 px-0.5">
        Enveloppe estimee a partir des coupes IRM du run ; hippocampe aligne sur la meme grille que la modelisation ci-dessus. Axes au centre, grille au sol.
      </p>
      <div className="relative w-full">
        <div ref={mountRef} className={containerClass} />
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border border-slate-200/90 bg-white/90 px-2 py-1.5 text-[10px] font-semibold leading-tight text-slate-700 shadow-sm backdrop-blur-sm">
          <div>
            <span className="text-red-600">X</span> (R → L)
          </div>
          <div>
            <span className="text-emerald-600">Y</span>
          </div>
          <div>
            <span className="text-blue-600">Z</span> (Sup.)
          </div>
        </div>
      </div>
      {viewerError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          {viewerError}
        </div>
      ) : null}
    </div>
  );
}
