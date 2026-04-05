import { useState, useCallback } from "react";
import "./OrientationPanel.css";

const IconReset = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
const IconFlipH = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" /><path d="M12 20v2" /><path d="M12 14v2" /><path d="M12 8v2" /><path d="M12 2v2" /></svg>;
const IconFlipV = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" /><path d="M4 12H2" /><path d="M10 12H8" /><path d="M16 12h-2" /><path d="M22 12h-2" /></svg>;

function OrientCompass({ rotation }) {
  return (
    <div className="op-compass">
      <div className="op-compass-ring">
        <span className="op-compass-lbl op-compass-lbl--s">S</span>
        <span className="op-compass-lbl op-compass-lbl--i">I</span>
        <span className="op-compass-lbl op-compass-lbl--l">L</span>
        <span className="op-compass-lbl op-compass-lbl--r">R</span>
        <div className="op-compass-arrow" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }} />
        <div className="op-compass-dot" />
      </div>
    </div>
  );
}

export default function OrientationPanel({ onChange, onSave, patientId }) {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const emit = useCallback((rot, fh, fv) => {
    onChange?.({ rotation: rot, flipH: fh, flipV: fv });
  }, [onChange]);

  const handleSlider = (e) => {
    const val = parseInt(e.target.value, 10);
    setRotation(val);
    emit(val, flipH, flipV);
    setSaved(false);
  };

  const handlePreset = (val) => {
    setRotation(val);
    emit(val, flipH, flipV);
    setSaved(false);
  };

  const handleFlipH = () => {
    const next = !flipH;
    setFlipH(next);
    emit(rotation, next, flipV);
    setSaved(false);
  };

  const handleFlipV = () => {
    const next = !flipV;
    setFlipV(next);
    emit(rotation, flipH, next);
    setSaved(false);
  };

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    emit(0, false, false);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.({ rotation, flipH, flipV, patientId });
      setSaved(true);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const orientLabel = (() => {
    if (rotation === 0 && !flipH && !flipV) return "Axial standard";
    if (Math.abs(rotation) === 90) return "Rotation 90°";
    if (Math.abs(rotation) === 180) return "Retourne";
    if (flipH || flipV) return "Miroir actif";
    return "Personnalise";
  })();

  const presets = [
    { label: "0°", value: 0 },
    { label: "90°", value: 90 },
    { label: "180°", value: 180 },
    { label: "-90°", value: -90 },
  ];

  return (
    <div className="op-panel">
      <div className="op-header">
        <span className="op-title">⟳ Orientation</span>
        <button className="op-btn-reset" onClick={handleReset} title="Reinitialiser">
          <IconReset /> Reset
        </button>
      </div>

      <div className="op-section">
        <span className="op-label">Rotation axiale</span>
        <div className="op-angle-display">
          <span className="op-angle-value">{rotation}</span>
          <span className="op-angle-unit">°</span>
        </div>
        <input
          type="range"
          className="op-slider"
          min="-180"
          max="180"
          step="1"
          value={rotation}
          onChange={handleSlider}
        />
      </div>

      <div className="op-section">
        <span className="op-label">Prerelages</span>
        <div className="op-presets">
          {presets.map((p) => (
            <button
              key={p.value}
              className={`op-preset-btn ${rotation === p.value ? "op-preset-btn--active" : ""}`}
              onClick={() => handlePreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="op-section">
        <span className="op-label">Miroir</span>
        <div className="op-flip-row">
          <button className={`op-flip-btn ${flipH ? "op-flip-btn--active" : ""}`} onClick={handleFlipH}>
            <IconFlipH /> Horizontal
          </button>
          <button className={`op-flip-btn ${flipV ? "op-flip-btn--active" : ""}`} onClick={handleFlipV}>
            <IconFlipV /> Vertical
          </button>
        </div>
      </div>

      <div className="op-section op-section--center">
        <span className="op-label">Indicateur</span>
        <OrientCompass rotation={rotation} />
        <span className="op-orient-label">{orientLabel}</span>
      </div>

      <button className={`op-save-btn ${saved ? "op-save-btn--saved" : ""}`} onClick={handleSave} disabled={saving}>
        {saving ? "Enregistrement..." : saved ? "Enregistre" : "Enregistrer l orientation"}
      </button>
    </div>
  );
}
