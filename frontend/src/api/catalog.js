import api, { resolveAssetUrl } from './client';

function qs(params = {}) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.append(k, v);
  }
  const str = s.toString();
  return str ? `?${str}` : '';
}

export async function listCategories(params) {
  const { data } = await api.get(`/categories${qs(params)}`);
  return data;
}
export async function createCategory(payload) {
  const { data } = await api.post('/categories', payload);
  return data.data;
}
export async function updateCategory(id, payload) {
  const { data } = await api.patch(`/categories/${id}`, payload);
  return data.data;
}
export async function deleteCategory(id) {
  const { data } = await api.delete(`/categories/${id}`);
  return data.data;
}

export async function listProducts(params) {
  const { data } = await api.get(`/products${qs(params)}`);
  return data;
}
export async function createProduct(payload) {
  const { data } = await api.post('/products', payload);
  return data.data;
}
export async function updateProduct(id, payload) {
  const { data } = await api.patch(`/products/${id}`, payload);
  return data.data;
}
export async function deleteProduct(id) {
  const { data } = await api.delete(`/products/${id}`);
  return data.data;
}
export async function getProduct(id) {
  const { data } = await api.get(`/products/${id}`);
  return data.data;
}
export async function getProductStats(id) {
  const { data } = await api.get(`/products/${id}/stats`);
  return data.data;
}
/** URL affichable de la photo produit (null si aucune). */
export function productImageSrc(imageUrl) {
  return resolveAssetUrl(imageUrl);
}
/** Envoie la photo du produit (FormData, champ `image`). */
export async function uploadProductImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.patch(`/products/${id}/image`, form);
  return data.data;
}
/** Retire la photo du produit. */
export async function deleteProductImage(id) {
  const { data } = await api.delete(`/products/${id}/image`);
  return data.data;
}

export async function inventorySummary() {
  const { data } = await api.get('/inventory/summary');
  return data.data;
}
export async function inventoryList(params) {
  const { data } = await api.get(`/inventory${qs(params)}`);
  return data;
}
export async function inventoryAlerts(params) {
  const { data } = await api.get(`/inventory/alerts${qs(params)}`);
  return data.data;
}

export async function createEntry(payload) {
  const { data } = await api.post('/stock/entries', payload);
  return data.data;
}
export async function createExit(payload) {
  const { data } = await api.post('/stock/exits', payload);
  return data.data;
}
export async function createAdjustment(payload) {
  const { data } = await api.post('/stock/adjustments', payload);
  return data.data;
}
export async function listMovements(params) {
  const { data } = await api.get(`/stock/movements${qs(params)}`);
  return data;
}
export async function getMovement(id) {
  const { data } = await api.get(`/stock/movements/${id}`);
  return data.data;
}

export async function listSuppliers(params) {
  const { data } = await api.get(`/suppliers${qs(params)}`);
  return data;
}
export async function createSupplier(payload) {
  const { data } = await api.post('/suppliers', payload);
  return data.data;
}
export async function updateSupplier(id, payload) {
  const { data } = await api.patch(`/suppliers/${id}`, payload);
  return data.data;
}

export async function listCustomers(params) {
  const { data } = await api.get(`/customers${qs(params)}`);
  return data;
}
export async function createCustomer(payload) {
  const { data } = await api.post('/customers', payload);
  return data.data;
}
export async function updateCustomer(id, payload) {
  const { data } = await api.patch(`/customers/${id}`, payload);
  return data.data;
}

export async function listPurchases(params) {
  const { data } = await api.get(`/purchases${qs(params)}`);
  return data;
}
export async function getPurchase(id) {
  const { data } = await api.get(`/purchases/${id}`);
  return data.data;
}
export async function createPurchase(payload) {
  const { data } = await api.post('/purchases', payload);
  return data.data;
}
export async function updatePurchase(id, payload) {
  const { data } = await api.patch(`/purchases/${id}`, payload);
  return data.data;
}
export async function confirmPurchase(id) {
  const { data } = await api.post(`/purchases/${id}/confirm`);
  return data.data;
}

export async function listSales(params) {
  const { data } = await api.get(`/sales${qs(params)}`);
  return data;
}
export async function getSale(id) {
  const { data } = await api.get(`/sales/${id}`);
  return data.data;
}
export async function createSale(payload) {
  const { data } = await api.post('/sales', payload);
  return data.data;
}
export async function updateSale(id, payload) {
  const { data } = await api.patch(`/sales/${id}`, payload);
  return data.data;
}
export async function confirmSale(id) {
  const { data } = await api.post(`/sales/${id}/confirm`);
  return data.data;
}

export async function listInvoices(params) {
  const { data } = await api.get(`/invoices${qs(params)}`);
  return data;
}
export async function getInvoice(id) {
  const { data } = await api.get(`/invoices/${id}`);
  return data.data;
}
export async function createInvoice(payload) {
  const { data } = await api.post('/invoices', payload);
  return data.data;
}
export async function setInvoiceStatus(id, status) {
  const { data } = await api.patch(`/invoices/${id}/status`, { status });
  return data.data;
}

/** Vérification publique d'authenticité (sans JWT). */
export async function verifyInvoice(token) {
  const { data } = await api.get(`/verify/invoice/${token}`);
  return data.data;
}

/**
 * URL encodée dans le QR de vérification.
 * - `VITE_PUBLIC_APP_URL` (ex. http://192.168.1.239:5174) : scannable depuis
 *   un téléphone sur le même Wi-Fi ;
 * - repli : origine courante (fonctionnement localhost PC inchangé).
 * Jamais de localhost construit en dur ici.
 */
export function verifyInvoiceUrl(token) {
  const base = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
    || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/verify/invoice/${token}`;
}
