import React, { useState, useEffect } from "react";
import axios from "axios";

export default function PreprocessPanel({ jobId }) {
  const [method, setMethod] = useState("none");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [intensity, setIntensity] = useState(1.0); // 🆕 intensité de l'effet

  const preprocess = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await axios.post("/api/preprocess", {
        jobId,
        method,
        intensity, // 🆕 envoyer au backend
      });
      setPreview("data:image/png;base64," + res.data.preview);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du prétraitement !");
    }
    setLoading(false);
  };

  // ⚡ Mettre à jour automatiquement le preview quand l’intensité change
  useEffect(() => {
    if (method !== "none") preprocess();
  }, [intensity]);

  return (
    <div className="p-4 bg-gray-900 text-white rounded-2xl shadow-md">
      <h2 className="text-lg font-bold mb-3">🧠 Prétraitement d'image</h2>

      {/* Choix du filtre */}
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="bg-gray-800 p-2 rounded-md mb-3"
      >
        <option value="none">Aucun</option>
        <option value="gaussian">Flou gaussien</option>
        <option value="sharpen">Netteté</option>
        <option value="edge">Contours</option>
      </select>

      {/* Slider d’intensité */}
      {method !== "none" && (
        <div className="mt-3">
          <label className="block text-sm mb-1">
            Intensité : <span className="font-bold">{intensity.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={intensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Bouton de prétraitement */}
      <button
        onClick={preprocess}
        disabled={loading || !jobId}
        className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? "Traitement..." : "Appliquer"}
      </button>

      {/* Image prétraitée */}
      {preview && (
        <div className="mt-4">
          <h3 className="text-sm mb-1">Aperçu :</h3>
          <img
            src={preview}
            alt="Prétraitée"
            className="rounded-md border border-gray-700"
          />
        </div>
      )}
    </div>
  );
}
