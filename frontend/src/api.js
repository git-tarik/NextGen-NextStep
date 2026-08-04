import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const createCandidate = (data) => axios.post(`${API_URL}/candidates/`, data);
export const getCandidateByEmail = (email) => axios.get(`${API_URL}/candidates/by-email/${email}`);
export const getCandidates = () => axios.get(`${API_URL}/candidates/`);
export const getCandidate = (id) => axios.get(`${API_URL}/candidates/${id}`);

export const uploadDocument = (id, file, docType) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", docType);
    return axios.post(`${API_URL}/candidates/${id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const chatWithAssistant = (query) => axios.post(`${API_URL}/chat/`, { query });

// New API endpoints
export const getCandidateTimeline = (id) => axios.get(`${API_URL}/candidates/${id}/timeline`);
export const getNotifications = (candidateId) => axios.get(`${API_URL}/notifications/${candidateId}`);
export const markNotificationRead = (notifId) => axios.put(`${API_URL}/notifications/${notifId}/read`);
export const getAuditLogs = (limit = 50) => axios.get(`${API_URL}/audit-logs/?limit=${limit}`);
export const getMetrics = () => axios.get(`${API_URL}/metrics/`);
export const approveCandidate = (id) => axios.post(`${API_URL}/candidates/${id}/approve`);
export const reseedFaq = () => axios.post(`${API_URL}/admin/reseed-faq`);

// Payroll
export const submitBankDetails = (id, data) => axios.post(`${API_URL}/candidates/${id}/bank-details`, data);
export const getPayslipDownloadUrl = (id) => `${API_URL}/candidates/${id}/payslip`;
