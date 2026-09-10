const db = require('../../config/db');
const { STOCK_STATUS_CASE } = require('../../utils/stockStatus');
const dashboard = require('../dashboard/dashboard.service');
const stock = require('../stock/stock.service');

const CSV_LIMIT = 5000;

function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(';'), ...rows.map((r) => columns.map((c) => esc(r[c])).join(';'))].join('\n');
}

/** Rapport de stock : réutilise la logique produits (statuts identiques). */
async function stockReport(companyId, q) {
  const products = require('../products/products.service');
  const params = { page: q.page, limit: q.format === 'csv' ? CSV_LIMIT : q.limit };
  if (q.search) params.search = q.search;
  if (q.categoryId) params.categoryId = q.categoryId;
  if (q.status === 'FAIBLE') params.lowStock = 'true';
  if (q.status === 'RUPTURE') params.outOfStock = 'true';
  if (q.status === 'NORMAL') params.normalOnly = 'true';
  const list = await products.list(companyId, { sort: 'name', order: 'asc', ...params });
  return list;
}

/** Ruptures : quantité = 0 (actifs). */
async function stockoutsReport(companyId, q) {
  const params = [companyId];
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM products WHERE company_id = $1 AND is_active = TRUE AND quantity = 0`, params);
  const dataRes = await db.query(
    `SELECT p.id, p.name, p.sku, p.quantity, p.min_stock, p.purchase_price, p.sale_price, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.company_id = $1 AND p.is_active = TRUE AND quantity = 0
     ORDER BY p.name ASC LIMIT $2 OFFSET $3`,
    [companyId, q.format === 'csv' ? CSV_LIMIT : q.limit, (q.page - 1) * q.limit]);
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function salesReport(companyId, q) {
  const params = [companyId];
  const conds = ['s.company_id = $1'];
  if (q.status) {
    params.push(q.status);
    conds.push(`s.status = $${params.length}`);
  }
  if (q.date_from) {
    params.push(q.date_from.toISOString());
    conds.push(`s.created_at >= $${params.length}`);
  }
  if (q.date_to) {
    params.push(q.date_to.toISOString());
    conds.push(`s.created_at <= $${params.length}`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const join = 'FROM sales s JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.user_id';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
  const lim = q.format === 'csv' ? CSV_LIMIT : q.limit;
  const dataRes = await db.query(
    `SELECT s.id, s.reference, s.status, s.subtotal, s.discount, s.tax, s.total, s.created_at,
            c.name AS customer_name, u.name AS user_name ${join} ${where}
     ORDER BY s.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, lim, (q.page - 1) * q.limit]);
  const sumRes = await db.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(s.total) FILTER (WHERE s.status = 'confirmed'), 0)::text AS revenue,
            COALESCE(SUM((SELECT SUM(si.quantity * (si.unit_price - si.unit_cost)) FROM sale_items si WHERE si.sale_id = s.id)) FILTER (WHERE s.status = 'confirmed'), 0)::text AS profit
     FROM sales s ${where}`, params);
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, summary: sumRes.rows[0], meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function purchasesReport(companyId, q) {
  const params = [companyId];
  const conds = ['p.company_id = $1'];
  if (q.status) {
    params.push(q.status);
    conds.push(`p.status = $${params.length}`);
  }
  if (q.date_from) {
    params.push(q.date_from.toISOString());
    conds.push(`p.created_at >= $${params.length}`);
  }
  if (q.date_to) {
    params.push(q.date_to.toISOString());
    conds.push(`p.created_at <= $${params.length}`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const join = 'FROM purchases p JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN users u ON u.id = p.user_id';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
  const lim = q.format === 'csv' ? CSV_LIMIT : q.limit;
  const dataRes = await db.query(
    `SELECT p.id, p.reference, p.status, p.subtotal, p.discount, p.tax, p.total, p.created_at,
            s.name AS supplier_name, u.name AS user_name ${join} ${where}
     ORDER BY p.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, lim, (q.page - 1) * q.limit]);
  const sumRes = await db.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(p.total) FILTER (WHERE p.status = 'confirmed'), 0)::text AS total
     FROM purchases p ${where}`, params);
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, summary: sumRes.rows[0], meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

/** Bénéfices : CA − coût snapshoté, marge affichée (calculée, documentée). */
async function profitReport(companyId, { date_from, date_to }) {
  const { normalizePeriod } = require('../dashboard/dashboard.validation');
  const { from, to } = normalizePeriod({ from: date_from, to: date_to });
  const r = await db.query(
    `SELECT COALESCE(SUM(s.total) FILTER (WHERE s.status = 'confirmed'), 0)::text AS revenue,
            COALESCE(SUM((SELECT SUM(si.quantity * si.unit_cost) FROM sale_items si WHERE si.sale_id = s.id)) FILTER (WHERE s.status = 'confirmed'), 0)::text AS cogs,
            COALESCE(SUM((SELECT SUM(si.quantity * (si.unit_price - si.unit_cost)) FROM sale_items si WHERE si.sale_id = s.id)) FILTER (WHERE s.status = 'confirmed'), 0)::text AS profit,
            COUNT(*) FILTER (WHERE s.status = 'confirmed')::int AS sales_count
     FROM sales s WHERE s.company_id = $1 AND s.created_at >= $2 AND s.created_at <= $3`,
    [companyId, from, to]
  );
  const row = r.rows[0];
  const revenue = BigInt(row.revenue);
  const profit = BigInt(row.profit);
  const margin = revenue > 0n ? Number((profit * 10000n) / revenue) / 100 : 0;
  const buckets = await dashboard.trends(companyId, { from, to });
  return { ...row, margin_percent: margin, buckets: buckets.data, granularity: buckets.granularity, from, to, currency: 'MGA' };
}

async function movementsReport(companyId, q) {
  return stock.list(companyId, {
    page: q.page, limit: q.format === 'csv' ? CSV_LIMIT : q.limit,
    product_id: q.product_id, movement_type: q.movement_type, user_id: q.user_id,
    date_from: q.date_from, date_to: q.date_to, search: q.search, sort: 'created_at', order: 'desc',
  });
}

const CSV_COLUMNS = {
  stock: ['id', 'name', 'sku', 'category_name', 'quantity', 'min_stock', 'purchase_price', 'sale_price', 'stock_status'],
  stockouts: ['id', 'name', 'sku', 'quantity', 'min_stock', 'category_name'],
  sales: ['id', 'reference', 'status', 'customer_name', 'user_name', 'total', 'created_at'],
  purchases: ['id', 'reference', 'status', 'supplier_name', 'user_name', 'total', 'created_at'],
  movements: ['id', 'created_at', 'product_name', 'product_sku', 'movement_type', 'quantity', 'quantity_before', 'quantity_after', 'reason', 'reference', 'author_name'],
};

module.exports = { stockReport, stockoutsReport, salesReport, purchasesReport, profitReport, movementsReport, toCSV, CSV_COLUMNS };
