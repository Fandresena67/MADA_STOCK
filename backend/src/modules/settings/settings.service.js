const db = require('../../config/db');
const audit = require('../audit/audit.service');

const COLS = 'id, name, email, phone, address, city, country, currency, is_active, created_at, updated_at';

async function get(companyId) {
  const r = await db.query(`SELECT ${COLS} FROM companies WHERE id = $1 LIMIT 1`, [companyId]);
  if (!r.rows[0]) {
    const err = new Error('Entreprise introuvable');
    err.status = 404;
    throw err;
  }
  return r.rows[0];
}

async function patch(actor, changes, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const allowed = ['name', 'email', 'phone', 'address', 'city', 'country'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (changes[key] !== undefined) {
        params.push(changes[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    params.push(actor.companyId);
    const r = await client.query(
      `UPDATE companies SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLS}`,
      params
    );
    if (r.rowCount === 0) {
      const err = new Error('Entreprise introuvable');
      err.status = 404;
      throw err;
    }
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'COMPANY_UPDATED',
      entityType: 'company', entityId: actor.companyId, metadata: { fields: Object.keys(changes) },
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

module.exports = { get, patch };
