const db = require('../../config/db');
const audit = require('../audit/audit.service');

const PUBLIC_COLS = 'c.id, c.company_id, c.name, c.description, c.is_active, c.created_at, c.updated_at';

function notFound() {
  const err = new Error('Catégorie introuvable');
  err.status = 404; // anti-IDOR : 404 si hors tenant
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

async function list(companyId, { page, limit, search }) {
  const params = [companyId];
  let where = 'c.company_id = $1';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND c.name ILIKE $${params.length}`;
  }
  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM categories c WHERE ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${PUBLIC_COLS}, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS products_count
     FROM categories c WHERE ${where} ORDER BY c.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id, companyId) {
  const r = await db.query(
    `SELECT ${PUBLIC_COLS}, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS products_count
     FROM categories c WHERE c.id = $1 AND c.company_id = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!r.rows[0]) throw notFound();
  return r.rows[0];
}

async function create(actor, { name, description }, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query(
      'SELECT id FROM categories WHERE company_id = $1 AND lower(name) = lower($2) LIMIT 1',
      [actor.companyId, name]
    );
    if (dup.rowCount > 0) throw conflict('Une catégorie portant ce nom existe déjà');
    const r = await client.query(
      `INSERT INTO categories (company_id, name, description) VALUES ($1, $2, $3)
       RETURNING id, company_id, name, description, is_active, created_at, updated_at`,
      [actor.companyId, name, description ?? '']
    );
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'CATEGORY_CREATED',
      entityType: 'category', entityId: r.rows[0].id, metadata: { name },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return { ...r.rows[0], products_count: 0 };
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
    const cur = await client.query('SELECT * FROM categories WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE', [id, actor.companyId]);
    if (!cur.rows[0]) throw notFound();
    if (changes.name !== undefined) {
      const dup = await client.query(
        'SELECT id FROM categories WHERE company_id = $1 AND lower(name) = lower($2) AND id <> $3 LIMIT 1',
        [actor.companyId, changes.name, id]
      );
      if (dup.rowCount > 0) throw conflict('Une catégorie portant ce nom existe déjà');
    }
    const sets = [];
    const params = [];
    for (const key of ['name', 'description', 'is_active']) {
      if (changes[key] !== undefined) {
        params.push(changes[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    params.push(id, actor.companyId);
    const r = await client.query(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND company_id = $${params.length}
       RETURNING id, company_id, name, description, is_active, created_at, updated_at`,
      params
    );
    await db.setTenantContext(client, actor.companyId);
    const wasActive = cur.rows[0].is_active;
    const action = changes.is_active === false && wasActive ? 'CATEGORY_DEACTIVATED' : 'CATEGORY_UPDATED';
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action,
      entityType: 'category', entityId: id, metadata: { name: r.rows[0].name },
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

/** Suppression physique si inutilisée, sinon 409. Jamais de suppression en cascade. */
async function remove(actor, id, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, name FROM categories WHERE id = $1 AND company_id = $2 LIMIT 1', [id, actor.companyId]);
    if (!cur.rows[0]) throw notFound();
    const used = await client.query('SELECT COUNT(*)::int AS n FROM products WHERE category_id = $1', [id]);
    if (used.rows[0].n > 0) {
      throw conflict('Cette catégorie est utilisée par un ou plusieurs produits');
    }
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'CATEGORY_DELETED',
      entityType: 'category', entityId: id, metadata: { name: cur.rows[0].name },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('DELETE FROM categories WHERE id = $1 AND company_id = $2', [id, actor.companyId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, patch, remove };
