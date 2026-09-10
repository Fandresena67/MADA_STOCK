const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { isKnownPermission } = require('../../rbac/permissions');
const audit = require('../audit/audit.service');

const PUBLIC_COLS = 'id, company_id, name, email, role, is_active, created_at, updated_at';

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function notFound() {
  const err = new Error('Utilisateur introuvable');
  err.status = 404; // IDOR : ne jamais révéler l'existence hors tenant
  return err;
}

/** Charge un utilisateur SCOPÉ au tenant de l'acteur. 404 si hors tenant. */
async function loadScopedUser(id, companyId) {
  const r = await db.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [id, companyId]
  );
  return r.rows[0] || null;
}

/** Charge globale (super_admin uniquement, via /superadmin/*). */
async function loadGlobalUser(id) {
  const r = await db.query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return r.rows[0] || null;
}

function isGlobalAdmin(actor) {
  return actor.role === 'super_admin' && (actor.companyId === null || actor.companyId === undefined);
}

async function list(companyId, { page, limit }) {
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    db.query(
      `SELECT ${PUBLIC_COLS} FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM users WHERE company_id = $1`, [companyId]),
  ]);
  return { data: rows.rows.map(toPublicUser), meta: { page, limit, total: count.rows[0].total } };
}

async function getById(id, companyId) {
  const row = await loadScopedUser(id, companyId);
  if (!row) throw notFound();
  return toPublicUser(row);
}

/**
 * Création : company_admin → 'employee' uniquement (rôle forcé).
 * super_admin → 'employee' | 'company_admin' (jamais 'super_admin' via API).
 */
async function create(actor, { name, email, password, role }, meta = {}) {
  let finalRole = 'employee';
  if (actor.role === 'super_admin') {
    finalRole = role || 'employee';
    if (finalRole === 'super_admin') {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
  } else if (role && role !== 'employee') {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  const companyId = actor.companyId; // super_admin sur route tenant : bloqué par requireTenant en amont
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rowCount > 0) {
      const err = new Error('Cet email est déjà utilisé');
      err.status = 409;
      throw err;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const r = await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${PUBLIC_COLS}`,
      [companyId, name, email, passwordHash, finalRole]
    );
    await db.setTenantContext(client, companyId);
    await audit.log({
      client, userId: actor.id, companyId, action: 'USER_CREATED',
      entityType: 'user', entityId: r.rows[0].id, metadata: { email, role: finalRole },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return toPublicUser(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Modification : company_admin → employés de SON entreprise (nom, is_active).
 * Changement de rôle → super_admin uniquement. 404 si hors tenant.
 */
async function patch(actor, id, changes, meta = {}) {
  const global = isGlobalAdmin(actor);
  const target = global ? await loadGlobalUser(id) : await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  const scopeCompany = global ? target.company_id : actor.companyId;

  if (global && actor.id === target.id && changes.is_active === false) {
    const err = new Error('Impossible de désactiver votre propre compte');
    err.status = 403;
    throw err;
  }

  if (!global) {
    if (target.role !== 'employee') {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
    if (changes.role !== undefined) {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
    if (actor.id === target.id && changes.is_active === false) {
      const err = new Error('Impossible de désactiver votre propre compte');
      err.status = 403;
      throw err;
    }
  }

  const sets = [];
  const params = [];
  if (changes.name !== undefined) {
    params.push(changes.name);
    sets.push(`name = $${params.length}`);
  }
  if (changes.is_active !== undefined) {
    params.push(changes.is_active);
    sets.push(`is_active = $${params.length}`);
  }
  if (changes.role !== undefined && actor.role === 'super_admin') {
    if (changes.role === 'super_admin') {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
    params.push(changes.role);
    sets.push(`role = $${params.length}`);
  }
  if (sets.length === 0) {
    const err = new Error('Aucune modification autorisée');
    err.status = 403;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    params.push(id, scopeCompany);
    const r = await client.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING ${PUBLIC_COLS}`,
      params
    );
    if (r.rowCount === 0) throw notFound();
    const updated = r.rows[0];
    await db.setTenantContext(client, scopeCompany);
    const events = [];
    if (changes.role !== undefined && changes.role !== target.role) events.push('ROLE_CHANGED');
    if (changes.is_active === false && target.is_active) events.push('USER_DEACTIVATED');
    if (changes.is_active === true && !target.is_active) events.push('USER_ACTIVATED');
    if (events.length === 0) events.push('USER_UPDATED');
    for (const action of events) {
      await audit.log({
        client, userId: actor.id, companyId: scopeCompany, action,
        entityType: 'user', entityId: id,
        metadata: action === 'ROLE_CHANGED' ? { from: target.role, to: changes.role } : { email: target.email },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    if (changes.is_active === false) {
      await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    }
    await client.query('COMMIT');
    return toPublicUser(updated);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function remove(actor, id, meta = {}) {
  const global = isGlobalAdmin(actor);
  const target = global ? await loadGlobalUser(id) : await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  const scopeCompany = global ? target.company_id : actor.companyId;
  if (actor.role !== 'super_admin') {
    if (target.role !== 'employee') {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
    if (actor.id === target.id) {
      const err = new Error('Impossible de supprimer votre propre compte');
      err.status = 403;
      throw err;
    }
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, scopeCompany);
    await audit.log({
      client, userId: actor.id, companyId: scopeCompany, action: 'USER_DELETED',
      entityType: 'user', entityId: id, metadata: { email: target.email, role: target.role },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    const r = await client.query(`DELETE FROM users WHERE id = $1 AND company_id = $2`, [id, scopeCompany]);
    if (r.rowCount === 0) throw notFound();
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function grantPermission(actor, id, permission, meta = {}) {
  if (!isKnownPermission(permission)) {
    const err = new Error('Permission inconnue');
    err.status = 400;
    throw err;
  }
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  if (target.role !== 'employee') {
    const err = new Error('Permissions explicites réservées aux employés');
    err.status = 403;
    throw err;
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    await client.query(
      `INSERT INTO user_permissions (user_id, permission_id)
       SELECT $1, p.id FROM permissions p WHERE p.code = $2
       ON CONFLICT (user_id, permission_id) DO NOTHING`,
      [id, permission]
    );
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'PERMISSION_GRANTED',
      entityType: 'user', entityId: id, metadata: { permission }, ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return { ok: true, permission };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function revokePermission(actor, id, permission, meta = {}) {
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    await client.query(
      `DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = (SELECT id FROM permissions WHERE code = $2)`,
      [id, permission]
    );
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'PERMISSION_REVOKED',
      entityType: 'user', entityId: id, metadata: { permission }, ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return { ok: true, permission };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, patch, remove, grantPermission, revokePermission };
