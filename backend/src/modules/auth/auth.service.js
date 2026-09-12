const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const env = require('../../config/env');
const { hashToken, newJti } = require('../../utils/crypto');
const { resolvePermissions } = require('../../rbac/permissions');
const audit = require('../audit/audit.service');

const ALLOWED_ROLES = ['company_admin', 'employee', 'super_admin'];

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, companyId: user.company_id, role: user.role, type: 'access' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh', jti: newJti() },
    env.jwt.secret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );
}

function unauthorized(msg = 'Email ou mot de passe incorrect') {
  const err = new Error(msg);
  err.status = 401;
  return err;
}

function sessionExpired() {
  return unauthorized('Session expirée, reconnectez-vous');
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
  };
}

/** Crée une session : INSERT du hash (JAMAIS le token brut) + audit dans la même transaction. */
async function createSession(client, userId, meta = {}) {
  const userRes = await client.query(
    `SELECT id, company_id, role FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) throw sessionExpired();
  const refreshToken = signRefreshToken(user);
  const { exp } = jwt.decode(refreshToken);
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address, last_used_at)
     VALUES ($1, $2, to_timestamp($3), $4, $5, NOW())`,
    [userId, hashToken(refreshToken), exp, meta.userAgent || null, meta.ip || null]
  );
  return { user, accessToken: signAccessToken(user), refreshToken };
}

async function revokeAllSessions(client, userId) {
  const r = await client.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return r.rowCount;
}

async function register({ companyName, name, email, password }, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rowCount > 0) {
      const err = new Error('Cet email est déjà utilisé');
      err.status = 409;
      throw err;
    }
    const companyRes = await client.query(
      `INSERT INTO companies (name, currency) VALUES ($1, 'MGA') RETURNING id, name, currency, is_active, created_at`,
      [companyName]
    );
    const company = companyRes.rows[0];
    const passwordHash = await bcrypt.hash(password, 12);
    const userRes = await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'company_admin')
       RETURNING id, company_id, name, email, role, is_active, created_at`,
      [company.id, name, email, passwordHash]
    );
    const user = userRes.rows[0];
    await db.setTenantContext(client, company.id);
    const session = await createSession(client, user.id, meta);
    await audit.log({
      client, userId: user.id, companyId: company.id, action: 'AUTH_REGISTER',
      entityType: 'company', entityId: company.id,
      metadata: { companyName: company.name }, ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    const notifications = require('../notifications/notification.service');
    notifications.notifyEvent({
      companyId: company.id,
      userId: user.id,
      type: 'SYSTEM',
      title: 'Bienvenue sur MADA STOCK',
      message: `Votre entreprise ${company.name} est prête. Retrouvez vos alertes dans le centre de notifications.`,
      metadata: { company_name: company.name },
    });
    return {
      company: { id: company.id, name: company.name, currency: company.currency },
      user: toPublicUser(user),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken, // compat : transport principal = cookie HttpOnly
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function login({ email, password }, meta = {}) {
  const res = await db.query(
    `SELECT u.id, u.company_id, u.name, u.email, u.password_hash, u.role, u.is_active,
            c.is_active AS company_active
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const user = res.rows[0];
  const failMeta = { ip: meta.ip, userAgent: meta.userAgent };
  if (!user || !user.is_active) {
    await audit.log({ ...failMeta, action: 'AUTH_LOGIN_FAILED', metadata: { email }, companyId: user?.company_id ?? null, userId: user?.id ?? null });
    throw unauthorized();
  }
  // Entreprise désactivée : connexion refusée (message générique anti-énumération).
  if (user.company_id !== null && user.company_active === false) {
    await audit.log({ ...failMeta, action: 'AUTH_LOGIN_FAILED', metadata: { email, reason: 'company_disabled' }, companyId: user.company_id, userId: user.id });
    throw unauthorized();
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await audit.log({ ...failMeta, action: 'AUTH_LOGIN_FAILED', metadata: { email }, companyId: user.company_id, userId: user.id });
    throw unauthorized();
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, user.company_id);
    const session = await createSession(client, user.id, meta);
    await audit.log({
      client, userId: user.id, companyId: user.company_id, action: 'AUTH_LOGIN_SUCCESS',
      metadata: {}, ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return { user: toPublicUser(user), accessToken: session.accessToken, refreshToken: session.refreshToken };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Rotation : 1 refresh présenté → 1 seul nouveau. Réutilisation d'un token
 * révoqué = compromission potentielle → révocation de toute la famille + audit.
 */
async function refresh(rawToken, meta = {}) {
  if (!rawToken) throw sessionExpired();
  let payload;
  try {
    payload = jwt.verify(rawToken, env.jwt.secret);
  } catch {
    throw sessionExpired();
  }
  if (payload.type !== 'refresh' || !payload.sub) throw sessionExpired();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const digest = hashToken(rawToken);
    // FOR UPDATE OF rt : verrouille la ligne de session (rotation atomique) sans
    // toucher au côté nullable du LEFT JOIN (interdit par PostgreSQL).
    const rowRes = await client.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
              u.company_id, u.role, u.is_active, u.name, u.email,
              c.is_active AS company_active
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE rt.token_hash = $1 LIMIT 1 FOR UPDATE OF rt`,
      [digest]
    );
    const row = rowRes.rows[0];
    if (!row) {
      await audit.log({ client, userId: Number(payload.sub) || null, companyId: null, action: 'AUTH_REFRESH', metadata: { result: 'unknown_token' }, ip: meta.ip, userAgent: meta.userAgent });
      await client.query('COMMIT');
      throw sessionExpired();
    }
    await db.setTenantContext(client, row.company_id);

    if (row.revoked_at) {
      // REUSE DETECTED — compromission potentielle : on tue toute la famille.
      const revokedCount = await revokeAllSessions(client, row.user_id);
      await audit.log({
        client, userId: row.user_id, companyId: row.company_id,
        action: 'AUTH_REFRESH_REUSE_DETECTED',
        entityType: 'refresh_token', entityId: row.id,
        metadata: { revoked_sessions: revokedCount }, ip: meta.ip, userAgent: meta.userAgent,
      });
      await client.query('COMMIT');
      throw sessionExpired();
    }
    if (new Date(row.expires_at).getTime() < Date.now() || !row.is_active) {
      await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
      await audit.log({ client, userId: row.user_id, companyId: row.company_id, action: 'AUTH_REFRESH', metadata: { result: 'expired_or_inactive' }, ip: meta.ip, userAgent: meta.userAgent });
      await client.query('COMMIT');
      throw sessionExpired();
    }
    // Entreprise désactivée : refresh refusé + session révoquée (défense immédiate).
    if (row.company_id !== null && row.company_active === false) {
      await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
      await audit.log({ client, userId: row.user_id, companyId: row.company_id, action: 'AUTH_REFRESH', metadata: { result: 'company_disabled' }, ip: meta.ip, userAgent: meta.userAgent });
      await client.query('COMMIT');
      throw sessionExpired();
    }

    // Rotation : révoque l'ancien, crée le nouveau, chaîne replaced_by.
    await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
    const session = await createSession(client, row.user_id, meta);
    const newIdRes = await client.query(`SELECT id FROM refresh_tokens WHERE token_hash = $1`, [hashToken(session.refreshToken)]);
    await client.query(`UPDATE refresh_tokens SET replaced_by_token_id = $1 WHERE id = $2`, [newIdRes.rows[0].id, row.id]);
    await audit.log({ client, userId: row.user_id, companyId: row.company_id, action: 'AUTH_REFRESH', metadata: {}, ip: meta.ip, userAgent: meta.userAgent });
    await client.query('COMMIT');
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: { id: row.user_id, name: row.name, email: row.email, role: row.role, companyId: row.company_id },
    };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* déjà commit/rollback */ }
    throw e;
  } finally {
    client.release();
  }
}

async function logout(rawToken, callerId, meta = {}) {
  if (rawToken) {
    const r = await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(rawToken)]
    );
    if (r.rowCount > 0) {
      const u = await db.query(`SELECT company_id FROM users WHERE id = $1`, [callerId]);
      await audit.log({ userId: callerId, companyId: u.rows[0]?.company_id ?? null, action: 'AUTH_LOGOUT', metadata: {}, ip: meta.ip, userAgent: meta.userAgent });
    }
  }
  return { ok: true };
}

/**
 * Révoque toutes les sessions d'un utilisateur.
 * - soi-même : toujours autorisé ;
 * - company_admin : employés de SON entreprise uniquement ;
 * - super_admin : global.
 */
async function logoutAll(targetUserId, actor, meta = {}) {
  const t = await db.query(`SELECT id, company_id, role FROM users WHERE id = $1 LIMIT 1`, [targetUserId]);
  const target = t.rows[0];
  if (!target) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const self = actor.id === target.id;
  if (!self) {
    if (actor.role === 'super_admin') { /* global, ok */ }
    else if (actor.role === 'company_admin' && target.company_id === actor.companyId && target.role === 'employee') { /* ok */ }
    else {
      // Anti-énumération inter-tenant : 404 si autre entreprise.
      const err = new Error(target.company_id === actor.companyId ? 'Accès refusé' : 'Utilisateur introuvable');
      err.status = target.company_id === actor.companyId ? 403 : 404;
      throw err;
    }
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const count = await revokeAllSessions(client, target.id);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'AUTH_LOGOUT_ALL',
      entityType: 'user', entityId: target.id, metadata: { revoked_sessions: count },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return { ok: true, revokedSessions: count };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function me(userId) {
  const res = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.company_id, u.is_active, u.avatar_url,
            c.name AS company_name, c.currency AS company_currency, c.is_active AS company_active
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row || !row.is_active) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  if (row.company_id !== null && row.company_active === false) {
    const err = new Error('Non authentifié');
    err.status = 401;
    throw err;
  }
  let codes = [];
  if (row.role === 'employee') {
    const p = await db.query(
      `SELECT p.code FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = $1`,
      [row.id]
    );
    codes = p.rows.map((r) => r.code);
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    avatarUrl: row.avatar_url || null,
    company: row.company_id ? { id: row.company_id, name: row.company_name, currency: row.company_currency } : null,
    permissions: resolvePermissions(row.role, codes),
  };
}

/**
 * Changement de mot de passe self-service : compte issu du JWT uniquement.
 * Politique sessions : la session courante est conservée, les autres révoquées.
 */
async function changePassword(userId, { currentPassword, newPassword }, meta = {}, keepTokenHash = null) {
  const r = await db.query(
    `SELECT id, company_id, is_active, password_hash FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row || !row.is_active) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) {
    const err = new Error('Mot de passe actuel incorrect');
    err.status = 401;
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await db.setTenantContext(client, row.company_id);
    await client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, userId]);
    const revoked = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL AND ($2::text IS NULL OR token_hash != $2)`,
      [userId, keepTokenHash]
    );
    await audit.log({
      client, userId, companyId: row.company_id, action: 'USER_PASSWORD_CHANGED',
      entityType: 'user', entityId: userId, metadata: { revoked_sessions: revoked.rowCount },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    const notifications = require('../notifications/notification.service');
    notifications.notifyEvent({
      companyId: row.company_id,
      userId,
      type: 'SECURITY',
      title: 'Mot de passe modifié',
      message:
        revoked.rowCount > 0
          ? 'Votre mot de passe a été modifié. Les autres appareils ont été déconnectés.'
          : 'Votre mot de passe a été modifié.',
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

/** Sessions actives de l'utilisateur authentifié (jamais de token exposé). */
async function listSessions(userId, currentTokenHash = null) {
  const r = await db.query(
    `SELECT id, user_agent, ip_address, created_at, last_used_at, expires_at, token_hash
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return r.rows.map((s) => ({
    id: s.id,
    userAgent: s.user_agent,
    ipAddress: s.ip_address,
    createdAt: s.created_at,
    lastUsedAt: s.last_used_at,
    expiresAt: s.expires_at,
    current: currentTokenHash ? s.token_hash === currentTokenHash : false,
  }));
}

/** Révoque UNE session de l'utilisateur authentifié (scopée par user_id). */
async function revokeSession(userId, sessionId, meta = {}) {
  const r = await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );
  if (r.rowCount === 0) {
    const err = new Error('Session introuvable');
    err.status = 404;
    throw err;
  }
  const u = await db.query(`SELECT company_id FROM users WHERE id = $1`, [userId]);
  await audit.log({
    userId, companyId: u.rows[0]?.company_id ?? null, action: 'USER_SESSION_REVOKED',
    entityType: 'refresh_token', entityId: sessionId, metadata: {},
    ip: meta.ip, userAgent: meta.userAgent,
  });
  return { ok: true };
}

module.exports = { register, login, refresh, logout, logoutAll, me, changePassword, listSessions, revokeSession, ALLOWED_ROLES };
