const db = require('../../config/db');

/**
 * Dashboard : 100 % agrégations PostgreSQL, tenant-scopé, SQL paramétré.
 * Montants BIGINT renvoyés en strings (précision exacte) ; le frontend convertit
 * pour les graphiques (même politique que l'inventaire Étape 4).
 */

async function summary(companyId, { from, to }) {
  const [stock, sales, purchases, profit] = await Promise.all([
    db.query(
      `SELECT COUNT(*) FILTER (WHERE is_active)::int AS products_total,
              COALESCE(SUM(quantity * purchase_price) FILTER (WHERE is_active), 0)::text AS stock_value_cost,
              COALESCE(SUM(quantity * sale_price) FILTER (WHERE is_active), 0)::text AS stock_value_sale,
              COUNT(*) FILTER (WHERE is_active AND quantity = 0)::int AS out_of_stock,
              COUNT(*) FILTER (WHERE is_active AND quantity > 0 AND quantity <= min_stock)::int AS low_stock
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS sales_count, COALESCE(SUM(s.total), 0)::text AS revenue
       FROM sales s WHERE s.company_id = $1 AND s.status = 'confirmed' AND s.created_at >= $2 AND s.created_at <= $3`,
      [companyId, from, to]
    ),
    db.query(
      `SELECT COUNT(*)::int AS purchases_count, COALESCE(SUM(p.total), 0)::text AS purchases_total
       FROM purchases p WHERE p.company_id = $1 AND p.status = 'confirmed' AND p.created_at >= $2 AND p.created_at <= $3`,
      [companyId, from, to]
    ),
    db.query(
      `SELECT COALESCE(SUM(si.quantity * si.unit_cost), 0)::text AS cogs,
              COALESCE(SUM(si.quantity * (si.unit_price - si.unit_cost)), 0)::text AS profit
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.company_id = $1 AND s.status = 'confirmed' AND s.created_at >= $2 AND s.created_at <= $3`,
      [companyId, from, to]
    ),
  ]);
  return {
    ...stock.rows[0],
    sales_count: sales.rows[0].sales_count,
    revenue: sales.rows[0].revenue,
    purchases_count: purchases.rows[0].purchases_count,
    purchases_total: purchases.rows[0].purchases_total,
    cogs: profit.rows[0].cogs,
    profit: profit.rows[0].profit,
    currency: 'MGA',
    from,
    to,
  };
}

/** Granularité : jour si ≤ 62 jours, sinon mois. Séries complètes (generate_series). */
async function trends(companyId, { from, to }) {
  const days = (new Date(to) - new Date(from)) / 86400000;
  const monthly = days > 62;
  const trunc = monthly ? 'month' : 'day';
  const step = monthly ? '1 month' : '1 day';
  const r = await db.query(
    `WITH buckets AS (
       SELECT generate_series(date_trunc('${trunc}', $2::timestamptz), date_trunc('${trunc}', $3::timestamptz), '${step}'::interval) AS b
     ),
     s AS (
       SELECT date_trunc('${trunc}', s.created_at) AS d, SUM(s.total) AS revenue,
              SUM((SELECT SUM(si.quantity * (si.unit_price - si.unit_cost)) FROM sale_items si WHERE si.sale_id = s.id)) AS profit,
              SUM((SELECT SUM(si.quantity * si.unit_cost) FROM sale_items si WHERE si.sale_id = s.id)) AS cogs
       FROM sales s WHERE s.company_id = $1 AND s.status = 'confirmed' AND s.created_at >= $2 AND s.created_at <= $3
       GROUP BY 1
     ),
     p AS (
       SELECT date_trunc('${trunc}', p.created_at) AS d, SUM(p.total) AS total
       FROM purchases p WHERE p.company_id = $1 AND p.status = 'confirmed' AND p.created_at >= $2 AND p.created_at <= $3
       GROUP BY 1
     )
     SELECT to_char(b.b, ${monthly ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS period,
            COALESCE(s.revenue, 0)::text AS sales,
            COALESCE(p.total, 0)::text AS purchases,
            COALESCE(s.profit, 0)::text AS profit,
            COALESCE(s.cogs, 0)::text AS cogs
     FROM buckets b LEFT JOIN s ON s.d = b.b LEFT JOIN p ON p.d = b.b
     ORDER BY b.b ASC`,
    [companyId, from, to]
  );
  return { granularity: monthly ? 'month' : 'day', data: r.rows, from, to };
}

async function stockDistribution(companyId) {
  const r = await db.query(
    `SELECT COUNT(*) FILTER (WHERE quantity > min_stock)::int AS normal,
            COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= min_stock)::int AS low,
            COUNT(*) FILTER (WHERE quantity = 0)::int AS out
     FROM products WHERE company_id = $1 AND is_active = TRUE`,
    [companyId]
  );
  return r.rows[0];
}

async function topProducts(companyId, { from, to, limit }) {
  const r = await db.query(
    `SELECT p.id, p.name, p.sku,
            SUM(si.quantity)::int AS quantity_sold,
            SUM(si.quantity * si.unit_price)::text AS revenue,
            SUM(si.quantity * si.unit_cost)::text AS cogs,
            SUM(si.quantity * (si.unit_price - si.unit_cost))::text AS profit
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.company_id = $1 AND s.status = 'confirmed' AND s.created_at >= $2 AND s.created_at <= $3
     GROUP BY p.id, p.name, p.sku
     ORDER BY quantity_sold DESC, revenue DESC LIMIT $4`,
    [companyId, from, to, limit]
  );
  return r.rows;
}

async function recentActivity(companyId, limit) {
  const r = await db.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
            u.name AS user_name, u.email AS user_email
     FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
     WHERE (a.company_id = $1 OR (a.company_id IS NULL AND a.user_id IN (SELECT id FROM users WHERE company_id = $1)))
     ORDER BY a.id DESC LIMIT $2`,
    [companyId, limit]
  );
  return r.rows;
}

async function alerts(companyId, limit) {
  const r = await db.query(
    `SELECT p.id, p.name, p.sku, p.quantity, p.min_stock, p.category_id, c.name AS category_name,
            CASE WHEN p.quantity = 0 THEN 'RUPTURE' ELSE 'FAIBLE' END AS level,
            p.updated_at AS checked_at
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.company_id = $1 AND p.is_active = TRUE AND (p.quantity = 0 OR (p.quantity > 0 AND p.quantity <= p.min_stock))
     ORDER BY p.quantity ASC, p.id ASC LIMIT $2`,
    [companyId, limit]
  );
  return r.rows;
}

module.exports = { summary, trends, stockDistribution, topProducts, recentActivity, alerts };
