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

export function companyLogoSrc(logoUrl) {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  return `${base.replace(/\/api\/v1\/?$/, '')}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`;
}

export async function uploadCompanyLogo(file) {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await api.patch('/settings/logo', form);
  return data.data;
}

export async function deleteCompanyLogo() {
  const { data } = await api.delete('/settings/logo');
  return data.data;
}
