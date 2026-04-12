// frontend/src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",  // ← CHANGÉ : de 5173 à 8000
  withCredentials: true,
});

// Auth
export const register = (payload = {}) =>
  api.post("/register", payload);
export const login = (username, password) => api.post("/login", { username, password });
export const emergencyLogin = (email, orderNumber) => api.post("/emergency_login", { email, order_number: orderNumber });
export const checkEmergencyLimit = (email, orderNumber) => api.post("/emergency_check", { email, order_number: orderNumber });
export const logout = () => api.post("/logout");
export const checkSession = () => api.get("/check_session");
export const forgotPassword = (email) => api.post("/forgot_password", { email });
export const validateResetToken = (token) => api.post("/validate_reset_token", { token });
export const resetPassword = (token, newPassword) => api.post("/reset_password", { token, new_password: newPassword });
export const validateActivationToken = (token) => api.post("/validate_activation_token", { token });
export const activateAccount = (token, newPassword) => api.post("/activate_account", { token, new_password: newPassword });

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
// ⚠️ ATTENTION : ces routes n'existent PAS dans Django, il faudra les créer ou les supprimer
export const preprocessImage = (jobId, target, method, intensity = 1.0) =>
  api.post("/preprocess", { jobId, target, method, intensity });

export const alignJob = (ct_points, pat_points, jobId) =>
  api.post("/align", { jobId, ct_points, pat_points }, { responseType: "blob" });

export const getJobTform = (jobId) => api.get(`/job/${encodeURIComponent(jobId)}/tform`);

// ⚠️ ATTENTION : cette route n'existe PAS dans Django
export const applyTform = (jobId, sourceDir, pattern = "*.*") =>
  api.post("/apply_tform", { jobId, source_dir: sourceDir, pattern }, { responseType: "blob" });

// Patients
export const getPatients = () => api.get("/patients");
export const getPatientSeries = (patientId) => api.get(`/patient/${encodeURIComponent(patientId)}/series`);

// fetch a patient file image as blob
export const getPatientFile = (jobId, relpath) =>
  api.get("/patient_file", { params: { jobId, relpath }, responseType: "blob" });

// download series / patient
// ⚠️ ATTENTION : ces routes n'existent PAS dans Django
export const downloadSeries = (seriesId) => api.get(`/series/${encodeURIComponent(seriesId)}/download`, { responseType: "blob" });
export const downloadPatient = (patientId) => api.get(`/patient/${encodeURIComponent(patientId)}/download`, { responseType: "blob" });

// delete
export const deleteSeries = (seriesId) => api.post("/delete_series", { series_id: seriesId });  // ← CHANGÉ : format JSON au lieu de DELETE
// ⚠️ ATTENTION : cette route n'existe PAS dans Django
export const deletePatient = (patientId) => api.delete(`/patient/${encodeURIComponent(patientId)}`);

// generic helpers
export const fetchHistory = () => api.get("/history");

// Brain transform (nouvelle route)
export const getBrainTransform = (jobId, relpath) =>
  api.get("/brain_transform", { params: { jobId, relpath } });

// Project Brodmann (nouvelle route)
export const projectBrodmann = (atlasJobId, atlasRelpath, patientJobId, patientRelpath, x, y, tolerance = 8) =>
  api.post("/project_brodmann", {
    atlasJobId,
    atlasRelpath,
    patientJobId,
    patientRelpath,
    x,
    y,
    tolerance
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

// Contact requests (landing popup)
export const createContactRequest = (data) => api.post('/contact_requests/', data);
export const getApprovedTestimonials = () => api.get('/testimonials/');
export const submitTestimonial = (payload) => api.post('/testimonials/submit/', payload);

// Admin dashboard
export const getAdminOverview = () => api.get('/admin/dashboard/overview');
export const getAdminAccounts = () => api.get('/admin/dashboard/accounts');
export const createAdminAccount = (payload) => api.post('/admin/dashboard/accounts/create', payload);
export const getAdminHistory = () => api.get('/admin/dashboard/history');
export const getAdminSettings = () => api.get('/admin/dashboard/settings');
export const getAdminAnalytics = () => api.get('/admin/dashboard/analytics');
export const getAdminTestimonials = () => api.get('/admin/dashboard/testimonials');
export const approveAdminAccount = (userId) => api.post(`/admin/dashboard/accounts/${userId}/approve`);
export const rejectAdminAccount = (userId, reason) => api.post(`/admin/dashboard/accounts/${userId}/reject`, { reason });
export const approveAdminTestimonial = (testimonialId) => api.post(`/admin/dashboard/testimonials/${testimonialId}/approve`);
export const rejectAdminTestimonial = (testimonialId) => api.post(`/admin/dashboard/testimonials/${testimonialId}/reject`);

export default api;