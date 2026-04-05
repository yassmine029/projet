import { useState, useCallback } from "react";
import OrientationPanel from "./OrientationPanel";
import { saveOrientation, uploadImage } from "../../api/orientationApi";
import "./PatientViewer.css";

/**
 * PatientViewer
 *
 * Usage:
 *   <PatientViewer patientId={42} />
 *
 * The viewer works with OR without a loaded image.
 * Orientation state is always active.
 */
export default function PatientViewer({ patientId }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [transform, setTransform] = useState({
    rotation: 0,
    flipH: false,
    flipV: false,
  });

  const buildTransform = ({ rotation, flipH, flipV }) =>
    `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

  const handleOrientationChange = useCallback((state) => {
    setTransform(state);
  }, []);

  const handleSave = useCallback(
    async (state) => {
      await saveOrientation({ patientId, ...state });
    },
    [patientId]
  );

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadImage({ file, patientId });
      setImageUrl(data.image_url || null);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pv-root">
      <div className="pv-topbar">
        <div className="pv-badge">
          <span className="pv-badge-dot" />
          PATIENT
        </div>
        <button className="pv-topbar-btn" onClick={() => setImageUrl(null)}>
          ↺ Reset
        </button>
        <label className="pv-topbar-btn pv-topbar-btn--upload">
          {uploading ? "Chargement..." : "⬆ Importer patient"}
          <input
            type="file"
            accept="image/*,.dcm"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </label>
        <button className="pv-topbar-btn pv-topbar-btn--3d">⚕ Patient test 3D</button>
      </div>

      <div className="pv-body">
        <div className="pv-canvas">
          <div className="pv-grid" />
          <div className="pv-crosshair-h" />
          <div className="pv-crosshair-v" />

          <div className="pv-image-wrapper" style={{ transform: buildTransform(transform) }}>
            {imageUrl ? (
              <img src={imageUrl} alt="Scan patient" className="pv-image" />
            ) : (
              <div className="pv-placeholder">
                <svg viewBox="0 0 130 160" width="120" height="148">
                  <ellipse cx="65" cy="75" rx="52" ry="62" fill="none" stroke="#555" strokeWidth="1.5" />
                  <ellipse cx="45" cy="65" rx="22" ry="28" fill="none" stroke="#666" strokeWidth="1" />
                  <ellipse cx="85" cy="65" rx="22" ry="28" fill="none" stroke="#666" strokeWidth="1" />
                  <path d="M40 50 Q55 40 65 50 Q75 40 90 50" fill="none" stroke="#888" strokeWidth="1.2" />
                  <path d="M35 70 Q50 62 65 70 Q80 62 95 70" fill="none" stroke="#888" strokeWidth="1.2" />
                  <path d="M38 85 Q55 78 65 85 Q75 78 92 85" fill="none" stroke="#888" strokeWidth="1.2" />
                  <path d="M42 100 Q55 93 65 100 Q75 93 88 100" fill="none" stroke="#777" strokeWidth="1" />
                  <line x1="65" y1="40" x2="65" y2="120" stroke="#444" strokeWidth="0.8" strokeDasharray="4,3" />
                </svg>
              </div>
            )}
          </div>

          {!imageUrl && <p className="pv-no-image">Aucune image - orientation active</p>}
        </div>

        <OrientationPanel onChange={handleOrientationChange} onSave={handleSave} patientId={patientId} />
      </div>
    </div>
  );
}
