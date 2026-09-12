const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('../../config/db');
const { isKnownPermission, PERMISSION_CODES } = require('../../rbac/permissions');
const audit = require('../audit/audit.service');
const { makeImageStore } = require('../uploads/imageUpload');

const PUBLIC_COLS = 'id, company_id, name, email, role, is_active, avatar_url, created_at, updated_at';

// Avatars administrés (employés) : même store sécurisé que le profil (UUID, magic bytes, 5 Mo).
const AVATAR_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars');
const AVATAR_URL_PREFIX = '/uploads/avatars/';
const avatars = makeImageStore({ dir: AVATAR_DIR, urlPrefix: AVATAR_URL_PREFIX });

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    isActive: row.is_active,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.last_login_at !== undefined ? { lastLoginAt: row.last_login_at } : {}),
    ...(row.sessions_count !== undefined ? { sessionsCount: Number(row.sessions_count) } : {}),
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

/** Permissions explicites d'un utilisateur (codes triés). */
async function fetchPermissions(userId) {
  const r = await db.query(
    `SELECT p.code FROM user_permissions up JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = $1 ORDER BY p.code ASC`,
    [userId]
  );
  return r.rows.map((x) => x.code);
}

/** Dernière activité honnête : max(login session, audit) — NULL si jamais actif. */
async function fetchActivity(userId) {
  const r = await db.query(
    `SELECT (SELECT MAX(created_at) FROM refresh_tokens WHERE user_id = $1) AS last_login_at,
            (SELECT MAX(created_at) FROM activity_logs WHERE user_id = $1) AS last_activity_at,
            (SELECT COUNT(*)::int FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()) AS sessions_count`,
    [userId]
  );
  return r.rows[0];
}

/** Charge globale (super_admin uniquement, via /superadmin/*). */
async function loadGlobalUser(id) {
  const r = await db.query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return r.rows[0] || null;
}

function isGlobalAdmin(actor) {
  return actor.role === 'super_admin' && (actor.companyId === null || actor.companyId === undefined);
}

async function list(companyId, { page, limit, search, role, status }) {
  const offset = (page - 1) * limit;
  const conds = ['u.company_id = $1'];
  const params = [companyId];
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conds.push(`u.role = $${params.length}`);
  }
  if (status === 'active') conds.push('u.is_active = TRUE');
  if (status === 'inactive') conds.push('u.is_active = FALSE');
  const where = `WHERE ${conds.join(' AND ')}`;
  const [rows, count] = await Promise.all([
    db.query(
      `SELECT u.${PUBLIC_COLS.split(', ').join(', u.')},
              (SELECT MAX(created_at) FROM refresh_tokens rt WHERE rt.user_id = u.id) AS last_login_at,
              (SELECT COUNT(*)::int FROM refresh_tokens rt WHERE rt.user_id = u.id AND rt.revoked_at IS NULL AND rt.expires_at > NOW()) AS sessions_count
       FROM users u ${where} ORDER BY u.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params),
  ]);
  const total = count.rows[0].total;
  return { data: rows.rows.map(toPublicUser), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

async function getById(id, companyId) {
  const row = await loadScopedUser(id, companyId);
  if (!row) throw notFound();
  const [permissions, activity] = await Promise.all([fetchPermissions(id), fetchActivity(id)]);
  return {
    ...toPublicUser(row),
    permissions,
    implicitPermissions: row.role !== 'employee' ? [...PERMISSION_CODES] : undefined,
    lastLoginAt: activity.last_login_at,
    lastActivityAt: activity.last_activity_at,
    sessionsCount: Number(activity.sessions_count),
  };
}

/** Permissions explicites d'un employé (company_admin = implicite total, jamais dupliqué). */
async function getPermissions(id, companyId) {
  const row = await loadScopedUser(id, companyId);
  if (!row) throw notFound();
  if (row.role !== 'employee') return { role: row.role, implicit: true, permissions: [...PERMISSION_CODES] };
  return { role: row.role, implicit: false, permissions: await fetchPermissions(id) };
}

/**
 * Création : company_admin → 'employee' uniquement (rôle forcé).
 * super_admin → 'employee' | 'company_admin' (jamais 'super_admin' via API).
 */
async function create(actor, { name, email, password, role, permissions }, meta = {}) {
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
  const initialPermissions = permissions || [];
  for (const code of initialPermissions) {
    if (!isKnownPermission(code)) {
      const err = new Error('Permission inconnue');
      err.status = 400;
      throw err;
    }
  }
  if (initialPermissions.length > 0 && finalRole !== 'employee') {
    const err = new Error('Permissions explicites réservées aux employés');
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
    const createdId = r.rows[0].id;
    if (initialPermissions.length > 0) {
      for (const code of initialPermissions) {
        await client.query(
          `INSERT INTO user_permissions (user_id, permission_id)
           SELECT $1, p.id FROM permissions p WHERE p.code = $2
           ON CONFLICT (user_id, permission_id) DO NOTHING`,
          [createdId, code]
        );
      }
    }
    await db.setTenantContext(client, companyId);
    await audit.log({
      client, userId: actor.id, companyId, action: 'USER_CREATED',
      entityType: 'user', entityId: createdId,
      metadata: { email, role: finalRole, permissions: initialPermissions },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    const created = toPublicUser(r.rows[0]);
    if (initialPermissions.length > 0) created.permissions = [...initialPermissions].sort();
    const notifications = require('../notifications/notification.service');
    notifications.notifyEvent({
      companyId,
      type: 'USER_ACTIVITY',
      title: 'Nouvel employé',
      message: `${name} a rejoint l\u2019équipe.`,
      entityType: 'user',
      entityId: createdId,
      metadata: { email, role: finalRole },
    });
    return created;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Modification : company_admin → employés de SON entreprise (nom, email, is_active).
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
  if (changes.email !== undefined && changes.email.toLowerCase() !== String(target.email).toLowerCase()) {
    params.push(changes.email);
    sets.push(`email = $${params.length}`);
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
    // Email globalement unique (login simple) : 409 sans révéler le propriétaire.
    if (changes.email !== undefined && changes.email.toLowerCase() !== String(target.email).toLowerCase()) {
      const dup = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
        [changes.email, id]
      );
      if (dup.rowCount > 0) {
        const err = new Error('Cet email est déjà utilisé');
        err.status = 409;
        throw err;
      }
    }
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

/** Sessions actives d'un employé (admin même entreprise) — jamais de token exposé. */
async function listEmployeeSessions(actor, id) {
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  const r = await db.query(
    `SELECT id, user_agent, ip_address, created_at, last_used_at, expires_at
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 50`,
    [id]
  );
  return r.rows.map((s) => ({
    id: s.id,
    userAgent: s.user_agent,
    ipAddress: s.ip_address,
    createdAt: s.created_at,
    lastUsedAt: s.last_used_at,
    expiresAt: s.expires_at,
  }));
}

/**
 * Reset administratif : company_admin → employé de SON entreprise (jamais soi-même :
 * utiliser /auth/password). Hash immédiat, sessions révoquées, audit + notification.
 */
async function adminResetPassword(actor, id, { newPassword }, meta = {}) {
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  if (target.role !== 'employee') {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  if (actor.id === target.id) {
    const err = new Error('Utilisez la page profil pour changer votre propre mot de passe');
    err.status = 403;
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    await client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`, [passwordHash, id, actor.companyId]);
    const revoked = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [id]
    );
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'USER_PASSWORD_CHANGED',
      entityType: 'user', entityId: id,
      metadata: { by_admin: true, revoked_sessions: revoked.rowCount },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    const notifications = require('../notifications/notification.service');
    notifications.notifyEvent({
      companyId: actor.companyId,
      userId: id,
      type: 'SECURITY',
      title: 'Mot de passe réinitialisé',
      message: 'Votre mot de passe a été réinitialisé par un administrateur. Reconnectez-vous avec le nouveau mot de passe.',
      metadata: { revoked_sessions: revoked.rowCount },
    });
    return { ok: true, revokedSessions: revoked.rowCount };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Remplacement complet des permissions explicites d'un employé (diff audité).
 * company_admin : implicite total → 403 (jamais de doublons en base).
 */
async function setPermissions(actor, id, codes, meta = {}) {
  for (const code of codes) {
    if (!isKnownPermission(code)) {
      const err = new Error('Permission inconnue');
      err.status = 400;
      throw err;
    }
  }
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  if (target.role !== 'employee') {
    const err = new Error('Permissions explicites réservées aux employés');
    err.status = 403;
    throw err;
  }
  const before = await fetchPermissions(id);
  const wanted = new Set(codes);
  const added = codes.filter((c) => !before.includes(c));
  const removed = before.filter((c) => !wanted.has(c));
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    if (removed.length > 0) {
      await client.query(
        `DELETE FROM user_permissions WHERE user_id = $1 AND permission_id IN (SELECT id FROM permissions WHERE code = ANY($2))`,
        [id, removed]
      );
    }
    for (const code of added) {
      await client.query(
        `INSERT INTO user_permissions (user_id, permission_id)
         SELECT $1, p.id FROM permissions p WHERE p.code = $2
         ON CONFLICT (user_id, permission_id) DO NOTHING`,
        [id, code]
      );
    }
    for (const code of added) {
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: 'PERMISSION_GRANTED',
        entityType: 'user', entityId: id, metadata: { permission: code },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    for (const code of removed) {
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: 'PERMISSION_REVOKED',
        entityType: 'user', entityId: id, metadata: { permission: code },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    if (added.length === 0 && removed.length === 0) {
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: 'USER_UPDATED',
        entityType: 'user', entityId: id, metadata: { permissions: 'unchanged' },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    await client.query('COMMIT');
    return { ok: true, permissions: [...codes].sort(), added, removed };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Avatar d'un employé posé par l'admin (même helper sécurisé que le profil). */
async function setEmployeeAvatar(actor, id, file, meta = {}) {
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  if (target.role !== 'employee') {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  const saved = await avatars.save(file);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    const r = await client.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING avatar_url`,
      [saved.url, id, actor.companyId]
    );
    if (r.rowCount === 0) throw notFound();
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'AVATAR_UPDATED',
      entityType: 'user', entityId: id, metadata: {},
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* déjà */ }
    await avatars.removeForUrl(saved.url);
    client.release();
    throw e;
  }
  client.release();
  if (target.avatar_url && target.avatar_url !== saved.url) await avatars.removeForUrl(target.avatar_url);
  return { avatarUrl: saved.url };
}

/** Retire l'avatar d'un employé (retour aux initiales). Idempotent. */
async function removeEmployeeAvatar(actor, id, meta = {}) {
  const target = await loadScopedUser(id, actor.companyId);
  if (!target) throw notFound();
  if (target.role !== 'employee') {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  if (!target.avatar_url) return { avatarUrl: null };
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, actor.companyId);
    await client.query(`UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1 AND company_id = $2`, [id, actor.companyId]);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'AVATAR_REMOVED',
      entityType: 'user', entityId: id, metadata: {},
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await avatars.removeForUrl(target.avatar_url);
  return { avatarUrl: null };
}

module.exports = { list, getById, getPermissions, create, patch, remove, grantPermission, revokePermission, setPermissions, adminResetPassword, listEmployeeSessions, setEmployeeAvatar, removeEmployeeAvatar };
