import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true,
});

// Auth
export const register = ({ username, password, fullName, specialty } = {}) =>
  api.post("/register", { username, password, fullName, specialty });
export const login = (username, password) => api.post("/login", { username, password });
export const emergencyLogin = (email) => api.post("/emergency_login", { email });
export const checkEmergencyLimit = (email) => api.post("/emergency_check", { email });
export const logout = () => api.post("/logout");
export const checkSession = () => api.get("/check_session");

// Uploads
export const uploadTwo = (patientId, refFile, patFile) => {
  const fd = new FormData();
  fd.append("patient_id", patientId);
  fd.append("ref_image", refFile);
  fd.append("patient_image", patFile);
  return api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
};
export const uploadSeries = (formData) => api.post("/upload_series", formData, { headers: { "Content-Type": "multipart/form-data" } });

// Preprocess / align / tform
export const preprocessImage = (jobId, target, method, intensity = 1.0) =>
  api.post("/preprocess", { jobId, target, method, intensity });
export const alignJob = (ct_points, pat_points, jobId) =>
  api.post("/align", { jobId, ct_points, pat_points }, { responseType: "blob" });
export const getJobTform = (jobId) => api.get(`/job/${encodeURIComponent(jobId)}/tform`);
export const applyTform = (jobId, sourceDir, pattern = "*.*") =>
  api.post("/apply_tform", { jobId, source_dir: sourceDir, pattern }, { responseType: "blob" });

// Patients (recalage)
export const getPatients = () => api.get("/patients");
export const getPatientSeries = (patientId) => api.get(`/patient/${encodeURIComponent(patientId)}/series`);
export const getPatientFile = (jobId, relpath) =>
  api.get("/patient_file", { params: { jobId, relpath }, responseType: "blob" });
export const downloadSeries = (seriesId) => api.get(`/series/${encodeURIComponent(seriesId)}/download`, { responseType: "blob" });
export const downloadPatient = (patientId) => api.get(`/patient/${encodeURIComponent(patientId)}/download`, { responseType: "blob" });
export const deleteSeries = (seriesId) => api.post("/delete_series", { series_id: seriesId });
export const deletePatient = (patientId) => api.delete(`/patient/${encodeURIComponent(patientId)}`);

// Generic helpers
export const fetchHistory = () => api.get("/history");

// Brain transform
export const getBrainTransform = (jobId, relpath) =>
  api.get("/brain_transform", { params: { jobId, relpath } });

// Project Brodmann
export const projectBrodmann = (atlasJobId, atlasRelpath, patientJobId, patientRelpath, x, y, tolerance = 8) =>
  api.post("/project_brodmann", {
    atlasJobId, atlasRelpath, patientJobId, patientRelpath, x, y, tolerance
  }, { responseType: "blob" });

// Dashboard Patients
export const getDashboardPatients = (params) => api.get("/patients/", { params });
export const createPatient = (data) => api.post("/patients/", data);
export const getDashboardPatientDetail = (id) => api.get(`/patients/${id}/`);

// Dashboard Réclamations
export const getReclamations = () => api.get("/reclamations/");
export const createReclamation = (formData) => api.post("/reclamations/", formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export default api;