/**
 * Axes 3D au centre du volume + grille au sol (style VisionMed).
 * Ne plus utiliser le petit widget d'orientation en coin.
 */

export function attachSceneAxesAndGrid(vtk, { renderer, renderWindow }) {
  const vtkAxesActor = vtk?.Rendering?.Core?.vtkAxesActor;
  const vtkPlaneSource = vtk?.Filters?.Sources?.vtkPlaneSource;
  const vtkMapper = vtk?.Rendering?.Core?.vtkMapper;
  const vtkActor = vtk?.Rendering?.Core?.vtkActor;
  if (!vtkAxesActor || !vtkPlaneSource || !vtkMapper || !vtkActor || !renderer || !renderWindow) {
    return null;
  }

  const b = renderer.computeVisiblePropBounds();
  const [xmin, xmax, ymin, ymax, zmin, zmax] = b;
  if (!Number.isFinite(xmin) || (xmax <= xmin && ymax <= ymin && zmax <= zmin)) {
    return null;
  }

  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  const cz = (zmin + zmax) / 2;
  const dx = xmax - xmin;
  const dy = ymax - ymin;
  const dz = zmax - zmin;
  const maxDim = Math.max(dx, dy, dz, 1e-6);
  const axisScale = maxDim * 0.32;

  const axes = vtkAxesActor.newInstance({
    config: {
      recenter: true,
      tipResolution: 28,
      tipRadius: 0.12,
      tipLength: 0.26,
      shaftResolution: 20,
      shaftRadius: 0.028,
      invert: false,
    },
    xConfig: { color: [255, 55, 55], invert: false },
    yConfig: { color: [35, 195, 75], invert: false },
    zConfig: { color: [45, 115, 255], invert: false },
  });
  axes.setPosition(cx, cy, cz);
  axes.setScale(axisScale, axisScale, axisScale);
  if (typeof axes.setPickable === 'function') axes.setPickable(false);

  const pad = maxDim * 0.95;
  const zGrid = zmin - maxDim * 0.07;
  const plane = vtkPlaneSource.newInstance({
    xResolution: 28,
    yResolution: 28,
    origin: [cx - pad, cy - pad, zGrid],
    point1: [cx + pad, cy - pad, zGrid],
    point2: [cx - pad, cy + pad, zGrid],
  });
  const gridMapper = vtkMapper.newInstance({ scalarVisibility: false });
  gridMapper.setInputConnection(plane.getOutputPort());
  const gridActor = vtkActor.newInstance();
  gridActor.setMapper(gridMapper);
  gridActor.getProperty().setRepresentationToWireframe();
  gridActor.getProperty().setColor(0.95, 0.96, 0.98);
  gridActor.getProperty().setOpacity(0.45);
  gridActor.getProperty().setAmbient(1);
  gridActor.getProperty().setDiffuse(0);
  gridActor.getProperty().setLighting(false);
  if (typeof gridActor.setPickable === 'function') gridActor.setPickable(false);

  renderer.addActor(gridActor);
  renderer.addActor(axes);

  renderWindow.render();

  return {
    renderer,
    axesActor: axes,
    gridActor,
    gridMapper,
    planeSource: plane,
  };
}

export function detachSceneAxesAndGrid(bundle) {
  if (!bundle || !bundle.renderer) return;
  const { renderer, axesActor, gridActor, gridMapper, planeSource } = bundle;
  try {
    if (axesActor) renderer.removeActor(axesActor);
  } catch {
    /* ignore */
  }
  try {
    if (gridActor) renderer.removeActor(gridActor);
  } catch {
    /* ignore */
  }
  try {
    axesActor?.delete?.();
  } catch {
    /* ignore */
  }
  try {
    gridActor?.delete?.();
  } catch {
    /* ignore */
  }
  try {
    gridMapper?.delete?.();
  } catch {
    /* ignore */
  }
  try {
    planeSource?.delete?.();
  } catch {
    /* ignore */
  }
}
