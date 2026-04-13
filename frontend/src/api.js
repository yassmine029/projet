import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
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
export const getUserSettings = () => api.get('/user-settings/');
export const updateUserSettings = (data) => api.put('/user-settings/', data);
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

export const downloadSegmentationReportPdf = (runId, payload = {}, config = {}) =>
  api.post(`/segmentation-runs/${runId}/report-pdf/`, payload, {
    responseType: 'blob',
    ...config,
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
