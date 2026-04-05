const BASE =
  import.meta.env?.VITE_API_BASE_URL ||
  (typeof process !== "undefined" ? process.env.REACT_APP_API_BASE_URL : "") ||
  "";

function getCsrfToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

const defaultHeaders = () => ({
  "Content-Type": "application/json",
  "X-CSRFToken": getCsrfToken(),
});

export async function saveOrientation({ patientId, rotation, flipH, flipV }) {
  const res = await fetch(`${BASE}/api/viewer/orientation/save/`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({
      patient_id: patientId,
      rotation,
      flip_h: flipH,
      flip_v: flipV,
    }),
  });
  if (!res.ok) throw new Error(`Save orientation failed: ${res.status}`);
  return res.json();
}

export async function loadOrientation(patientId) {
  const res = await fetch(`${BASE}/api/viewer/orientation/${patientId}/`, {
    credentials: "include",
    headers: { "X-CSRFToken": getCsrfToken() },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Load orientation failed: ${res.status}`);
  return res.json();
}

export async function uploadImage({ file, patientId }) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("patient_id", String(patientId));

  const res = await fetch(`${BASE}/api/viewer/upload/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCsrfToken() },
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
