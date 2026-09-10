const db = require('../../config/db');
const { STOCK_STATUS_CASE } = require('../../utils/stockStatus');

/** Préparation dashboard (Étape 7) : agrégations 100 % PostgreSQL, BIGINT exacts. */
async function summary(companyId) {
  const [prod, cat] = await Promise.all([
    db.query(
      `SELECT COUNT(*) FILTER (WHERE is_active)::int AS products_total,
              COALESCE(SUM(quantity * purchase_price) FILTER (WHERE is_active), 0)::text AS stock_value_cost,
              COALESCE(SUM(quantity * sale_price) FILTER (WHERE is_active), 0)::text AS stock_value_sale,
              COUNT(*) FILTER (WHERE is_active AND quantity = 0)::int AS out_of_stock,
              COUNT(*) FILTER (WHERE is_active AND quantity > 0 AND quantity <= min_stock)::int AS low_stock
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM categories WHERE company_id = $1 AND is_active = TRUE`, [companyId]),
  ]);
  return { ...prod.rows[0], categories_total: cat.rows[0].total, currency: 'MGA' };
}

const ROW = `p.id, p.name, p.sku, p.quantity, p.min_stock, p.purchase_price, p.sale_price, p.unit,
  (p.quantity * p.purchase_price)::text AS value_cost,
  (p.quantity * p.sale_price)::text AS value_sale,
  (${STOCK_STATUS_CASE}) AS stock_status, cat.name AS category_name`;
const FROM = 'FROM products p LEFT JOIN categories cat ON cat.id = p.category_id';

async function list(companyId, q) {
  const params = [companyId];
  const conds = ['p.company_id = $1', 'p.is_active = TRUE'];
  if (q.categoryId) {
    params.push(q.categoryId);
    conds.push(`p.category_id = $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    conds.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (q.status === 'RUPTURE') conds.push('p.quantity = 0');
  if (q.status === 'FAIBLE') conds.push('p.quantity > 0 AND p.quantity <= p.min_stock');
  if (q.status === 'NORMAL') conds.push('p.quantity > p.min_stock');
  const where = `WHERE ${conds.join(' AND ')}`;
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${FROM} ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${ROW} ${FROM} ${where} ORDER BY p.quantity ASC, p.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function alerts(companyId, q) {
  const params = [companyId];
  const where = 'WHERE p.company_id = $1 AND p.is_active = TRUE AND (p.quantity = 0 OR (p.quantity > 0 AND p.quantity <= p.min_stock))';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${FROM} ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${ROW} ${FROM} ${where} ORDER BY p.quantity ASC, p.id ASC LIMIT $2 OFFSET $3`,
    [...params, q.limit, (q.page - 1) * q.limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

module.exports = { summary, list, alerts };
