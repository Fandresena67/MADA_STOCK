const db = require('../../config/db');
const audit = require('../audit/audit.service');

/**
 * Fabrique CRUD tenant-scopé pour suppliers/customers (même structure).
 * Pas de DELETE physique : désactivation via PATCH is_active=false.
 * table: 'suppliers' | 'customers', auditPrefix: 'SUPPLIER' | 'CUSTOMER'
 */
function makeTierService(table, auditPrefix) {
  const COLS = 'id, company_id, name, email, phone, address, notes, is_active, created_at, updated_at';

  function notFound() {
    const err = new Error(table === 'suppliers' ? 'Fournisseur introuvable' : 'Client introuvable');
    err.status = 404;
    return err;
  }

  async function list(companyId, q) {
    const params = [companyId];
    const conds = ['company_id = $1'];
    if (q.is_active === 'true') conds.push('is_active = TRUE');
    if (q.is_active === 'false') conds.push('is_active = FALSE');
    if (q.search) {
      params.push(`%${q.search}%`);
      conds.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM ${table} ${where}`, params);
    const dataRes = await db.query(
      `SELECT ${COLS} FROM ${table} ${where} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, (q.page - 1) * q.limit]
    );
    const total = countRes.rows[0].total;
    return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
  }

  async function getById(id, companyId) {
    const r = await db.query(`SELECT ${COLS} FROM ${table} WHERE id = $1 AND company_id = $2 LIMIT 1`, [id, companyId]);
    if (!r.rows[0]) throw notFound();
    return r.rows[0];
  }

  async function create(actor, body, meta = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO ${table} (company_id, name, email, phone, address, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
        [actor.companyId, body.name, body.email ?? '', body.phone ?? '', body.address ?? '', body.notes ?? '']
      );
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_CREATED`,
        entityType: table.slice(0, -1), entityId: r.rows[0].id, metadata: { name: body.name },
        ip: meta.ip, userAgent: meta.userAgent,
      });
      await client.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async function patch(actor, id, changes, meta = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM ${table} WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE`, [id, actor.companyId]);
      if (!cur.rows[0]) throw notFound();
      const allowed = ['name', 'email', 'phone', 'address', 'notes', 'is_active'];
      const sets = [];
      const params = [];
      for (const key of allowed) {
        if (changes[key] !== undefined) {
          params.push(changes[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      params.push(id, actor.companyId);
      const r = await client.query(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING ${COLS}`,
        params
      );
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_UPDATED`,
        entityType: table.slice(0, -1), entityId: id, metadata: { name: r.rows[0].name },
        ip: meta.ip, userAgent: meta.userAgent,
      });
      await client.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return { list, getById, create, patch };
}

module.exports = { makeTierService };
