import api from './client';

function qs(params = {}) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.append(k, v);
  }
  const str = s.toString();
  return str ? `?${str}` : '';
}

export async function superDashboard() {
  const { data } = await api.get('/superadmin/dashboard');
  return data.data;
}
export async function superCompanies(params) {
  const { data } = await api.get(`/superadmin/companies${qs(params)}`);
  return data;
}
export async function superCompany(id) {
  const { data } = await api.get(`/superadmin/companies/${id}`);
  return data.data;
}
export async function setCompanyActive(id, isActive) {
  const { data } = await api.patch(`/superadmin/companies/${id}`, { is_active: isActive });
  return data.data;
}
export async function superUsers(params) {
  const { data } = await api.get(`/superadmin/users${qs(params)}`);
  return data;
}
export async function superUser(id) {
  const { data } = await api.get(`/superadmin/users/${id}`);
  return data.data;
}
export async function patchSuperUser(id, payload) {
  const { data } = await api.patch(`/superadmin/users/${id}`, payload);
  return data.data;
}
export async function superAudit(params) {
  const { data } = await api.get(`/superadmin/audit${qs(params)}`);
  return data;
}

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data.data;
}
export async function updateSettings(payload) {
  const { data } = await api.patch('/settings', payload);
  return data.data;
}
