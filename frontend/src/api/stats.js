import api from './client';

function qs(params = {}) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.append(k, v);
  }
  const str = s.toString();
  return str ? `?${str}` : '';
}

export async function dashboardSummary(params) {
  const { data } = await api.get(`/dashboard/summary${qs(params)}`);
  return data.data;
}
export async function dashboardTrends(kind, params) {
  const { data } = await api.get(`/dashboard/${kind}${qs(params)}`);
  return data.data;
}
export async function stockDistribution() {
  const { data } = await api.get('/dashboard/stock-distribution');
  return data.data;
}
export async function topProducts(params) {
  const { data } = await api.get(`/dashboard/top-products${qs(params)}`);
  return data.data;
}
export async function recentActivity(params) {
  const { data } = await api.get(`/dashboard/recent-activity${qs(params)}`);
  return data.data;
}
export async function dashboardAlerts(params) {
  const { data } = await api.get(`/dashboard/alerts${qs(params)}`);
  return data.data;
}
export async function alertsList(params) {
  const { data } = await api.get(`/alerts${qs(params)}`);
  return data.data;
}

export async function reportStock(params) {
  const { data } = await api.get(`/reports/stock${qs(params)}`);
  return data;
}
export async function reportStockouts(params) {
  const { data } = await api.get(`/reports/stockouts${qs(params)}`);
  return data;
}
export async function reportSales(params) {
  const { data } = await api.get(`/reports/sales${qs(params)}`);
  return data;
}
export async function reportPurchases(params) {
  const { data } = await api.get(`/reports/purchases${qs(params)}`);
  return data;
}
export async function reportProfit(params) {
  const { data } = await api.get(`/reports/profit${qs(params)}`);
  return data.data;
}
export async function reportMovements(params) {
  const { data } = await api.get(`/reports/movements${qs(params)}`);
  return data;
}

export function downloadCSV(path, params, filename) {
  const url = `${api.defaults.baseURL}${path}${qs({ ...params, format: 'csv' })}`;
  const token = localStorage.getItem('madastock_access');
  return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(async (r) => {
    if (!r.ok) throw new Error('Export impossible');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/** Convertit les BIGINT-strings API en nombres pour les graphiques. */
export function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
