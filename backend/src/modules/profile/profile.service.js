const path = require('path');
const db = require('../../config/db');
const audit = require('../audit/audit.service');
const { makeImageStore, MAX_IMAGE_SIZE } = require('../uploads/imageUpload');

// Photo de profil : l'utilisateur authentifié uniquement (jamais de userId client).
// La base ne stocke que la référence publique, jamais le binaire.

const AVATAR_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars');
const AVATAR_URL_PREFIX = '/uploads/avatars/';
const avatars = makeImageStore({ dir: AVATAR_DIR, urlPrefix: AVATAR_URL_PREFIX });

function notFound() {
  const err = new Error('Utilisateur introuvable');
  err.status = 404;
  return err;
}

async function loadSelf(userId) {
  const r = await db.query(
    `SELECT id, company_id, is_active, avatar_url FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

/**
 * Remplace la photo de l'utilisateur authentifié.
 * `file` vient de multer (memoryStorage) : { buffer, size, mimetype }.
 */
async function updateAvatar(userId, file, meta = {}) {
  const saved = await avatars.save(file); // valide taille, magic bytes, MIME

  const self = await loadSelf(userId);
  if (!self || !self.is_active) {
    await avatars.removeForUrl(saved.url); // pas de fichier orphelin
    throw notFound();
  }

  let updated;
  try {
    const r = await db.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url`,
      [saved.url, userId]
    );
    updated = r.rows[0];
    if (!updated) throw notFound();
  } catch (e) {
    // Pas de fichier orphelin si la DB échoue.
    await avatars.removeForUrl(saved.url);
    throw e;
  }

  // L'ancien fichier n'est supprimé qu'après succès — et ce n'est jamais le nouveau (UUID unique).
  if (self.avatar_url && self.avatar_url !== saved.url) await avatars.removeForUrl(self.avatar_url);

  audit.log({
    userId: self.id, companyId: self.company_id, action: 'AVATAR_UPDATED',
    entityType: 'user', entityId: self.id, metadata: {},
    ip: meta.ip, userAgent: meta.userAgent,
  }).catch(() => { /* best-effort */ });

  return { avatarUrl: updated.avatar_url };
}

/** Supprime la photo de l'utilisateur authentifié (retour aux initiales). Idempotent. */
async function removeAvatar(userId, meta = {}) {
  const self = await loadSelf(userId);
  if (!self || !self.is_active) throw notFound();
  if (!self.avatar_url) return { avatarUrl: null };
  await db.query(`UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`, [userId]);
  await avatars.removeForUrl(self.avatar_url);

  audit.log({
    userId: self.id, companyId: self.company_id, action: 'AVATAR_REMOVED',
    entityType: 'user', entityId: self.id, metadata: {},
    ip: meta.ip, userAgent: meta.userAgent,
  }).catch(() => { /* best-effort */ });

  return { avatarUrl: null };
}

/** Modifie le nom de l'utilisateur authentifié (trim + longueur validés par zod). */
async function updateName(userId, name, meta = {}) {
  const r = await db.query(
    `UPDATE users SET name = $1, updated_at = NOW()
     WHERE id = $2 AND is_active = TRUE
     RETURNING id, name`,
    [name, userId]
  );
  const row = r.rows[0];
  if (!row) throw notFound();
  const u = await db.query(`SELECT company_id FROM users WHERE id = $1`, [userId]);
  audit.log({
    userId, companyId: u.rows[0]?.company_id ?? null, action: 'USER_PROFILE_UPDATED',
    entityType: 'user', entityId: userId, metadata: {},
    ip: meta.ip, userAgent: meta.userAgent,
  }).catch(() => { /* best-effort */ });
  return { id: row.id, name: row.name };
}

// Compat : taille max réexportée (routes).
const MAX_SIZE = MAX_IMAGE_SIZE;

module.exports = { updateAvatar, removeAvatar, updateName, MAX_SIZE, AVATAR_DIR, AVATAR_URL_PREFIX };
