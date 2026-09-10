const db = require('../../config/db');
const audit = require('../audit/audit.service');

/** Socle Super Admin (global, hors tenant). */
async function dashboard() {
  const [co, us, prod, sales] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total,
                     COUNT(*) FILTER (WHERE is_active)::int AS active,
                     COUNT(*) FILTER (WHERE NOT is_active)::int AS disabled
              FROM companies`),
    db.query(`SELECT COUNT(*)::int AS total,
                     COUNT(*) FILTER (WHERE is_active)::int AS active,
                     COUNT(*) FILTER (WHERE role = 'super_admin')::int AS super_admins
              FROM users`),
    db.query(`SELECT COUNT(*)::int AS total_products,
                     COALESCE(SUM(quantity * purchase_price), 0)::text AS stock_value_cost
              FROM products`),
    db.query(`SELECT COUNT(*) FILTER (WHERE status = 'confirmed')::int AS sales_count,
                     COALESCE(SUM(total) FILTER (WHERE status = 'confirmed'), 0)::text AS revenue
              FROM sales`),
  ]);
  return {
    companies: co.rows[0],
    users: us.rows[0],
    products_total: prod.rows[0].total_products,
    stock_value_cost: prod.rows[0].stock_value_cost,
    sales_count: sales.rows[0].sales_count,
    revenue: sales.rows[0].revenue,
    currency: 'MGA',
  };
}

/** Utilisateurs globaux : recherche, filtres entreprise/rôle/statut, pagination. */
async function listUsers({ search, company_id, role, is_active, page, limit }) {
  const params = [];
  const conds = [];
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (company_id) {
    params.push(company_id);
    conds.push(`u.company_id = $${params.length}`);
  }
  if (role) {
    params.push(role);
    conds.push(`u.role = $${params.length}`);
  }
  if (is_active === 'true') conds.push('u.is_active = TRUE');
  if (is_active === 'false') conds.push('u.is_active = FALSE');
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const join = 'FROM users u LEFT JOIN companies c ON c.id = u.company_id';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
  const dataRes = await db.query(
    `SELECT u.id, u.company_id, u.name, u.email, u.role, u.is_active, u.created_at, c.name AS company_name
     ${join} ${where} ORDER BY u.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getUser(id) {
  const r = await db.query(
    `SELECT u.id, u.company_id, u.name, u.email, u.role, u.is_active, u.created_at, u.updated_at, c.name AS company_name
     FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = $1 LIMIT 1`,
    [id]
  );
  if (!r.rows[0]) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  return r.rows[0];
}

/** Audit global : filtres action/entreprise/utilisateur/dates, jamais de secret (scrub). */
async function listAudit({ action, company_id, user_id, date_from, date_to, page, limit }) {
  const params = [];
  const conds = [];
  if (action) {
    params.push(action);
    conds.push(`a.action = $${params.length}`);
  }
  if (company_id) {
    params.push(company_id);
    conds.push(`a.company_id = $${params.length}`);
  }
  if (user_id) {
    params.push(user_id);
    conds.push(`a.user_id = $${params.length}`);
  }
  if (date_from) {
    params.push(date_from.toISOString());
    conds.push(`a.created_at >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to.toISOString());
    conds.push(`a.created_at <= $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const join = 'FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN companies c ON c.id = a.company_id';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
  const dataRes = await db.query(
    `SELECT a.id, a.company_id, a.user_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
            u.name AS user_name, c.name AS company_name
     ${join} ${where} ORDER BY a.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function listCompanies({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE c.name ILIKE $${params.length}`;
  }
  const [rows, count] = await Promise.all([
    db.query(
      `SELECT c.id, c.name, c.currency, c.is_active, c.created_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) AS users_count,
              (SELECT COUNT(*)::int FROM products p WHERE p.company_id = c.id AND p.is_active = TRUE) AS products_count
       FROM companies c ${where} ORDER BY c.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM companies c ${where}`, params),
  ]);
  return { data: rows.rows, meta: { page, limit, total: count.rows[0].total } };
}

async function getCompany(id) {
  const r = await db.query(
    `SELECT c.id, c.name, c.currency, c.is_active, c.created_at,
            (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) AS users_count
     FROM companies c WHERE c.id = $1 LIMIT 1`,
    [id]
  );
  if (!r.rows[0]) {
    const err = new Error('Entreprise introuvable');
    err.status = 404;
    throw err;
  }
  return r.rows[0];
}

async function setCompanyActive(actor, id, isActive, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`UPDATE companies SET is_active = $1 WHERE id = $2 RETURNING id, name`, [isActive, id]);
    if (r.rowCount === 0) {
      const err = new Error('Entreprise introuvable');
      err.status = 404;
      throw err;
    }
    await audit.log({
      client, userId: actor.id, companyId: null, action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
      entityType: 'company', entityId: id, metadata: { name: r.rows[0].name },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    if (!isActive) {
      // Défense immédiate : toutes les sessions de l'entreprise sont révoquées
      // (anciens refresh tokens inutilisables, même avant expiration).
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE company_id = $1)`,
        [id]
      );
    }
    await client.query('COMMIT');
    return getCompany(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { listCompanies, getCompany, setCompanyActive, dashboard, listUsers, getUser, listAudit };
