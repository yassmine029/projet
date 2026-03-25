import React, { useEffect, useRef } from "react";
import * as vtk from "@kitware/vtk.js";

export default function VolumeViewer3D({ imageUrls }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const renderWindow = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
      rootContainer: container,
      background: [0, 0, 0],
      containerStyle: { height: "80vh", width: "100%" },
    });

    const renderer = renderWindow.getRenderer();
    const renWin = renderWindow.getRenderWindow();

    Promise.all(imageUrls.map((url) => fetch(url).then((r) => r.arrayBuffer()))).then((buffers) => {
      const first = new Uint8Array(buffers[0]);
      const dims = [256, 256, imageUrls.length]; // adapte selon la taille de tes images
      const pixelData = new Uint8Array(dims[0] * dims[1] * dims[2]);

      for (let i = 0; i < buffers.length; i++) {
        pixelData.set(new Uint8Array(buffers[i]), i * dims[0] * dims[1]);
      }

      const imageData = vtk.Common.DataModel.vtkImageData.newInstance();
      imageData.setDimensions(dims);
      imageData.getPointData().setScalars(
        vtk.Common.Core.vtkDataArray.newInstance({
          name: "Scalars",
          values: pixelData,
          numberOfComponents: 1,
        })
      );

      const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
      mapper.setInputData(imageData);

      const actor = vtk.Rendering.Core.vtkVolume.newInstance();
      actor.setMapper(mapper);

      const rgbTransferFunction = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
      const opacityTransferFunction = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

      rgbTransferFunction.addRGBPoint(0, 0.0, 0.0, 0.0);
      rgbTransferFunction.addRGBPoint(255, 1.0, 1.0, 1.0);
      opacityTransferFunction.addPoint(0, 0.0);
      opacityTransferFunction.addPoint(255, 0.9);

      actor.getProperty().setRGBTransferFunction(0, rgbTransferFunction);
      actor.getProperty().setScalarOpacity(0, opacityTransferFunction);
      actor.getProperty().setInterpolationTypeToLinear();

      renderer.addVolume(actor);
      renderer.resetCamera();
      renWin.render();
    });

    return () => {
      container.innerHTML = "";
    };
  }, [imageUrls]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "80vh",
        border: "1px solid #ccc",
        borderRadius: 8,
        overflow: "hidden",
      }}
    />
  );
}
