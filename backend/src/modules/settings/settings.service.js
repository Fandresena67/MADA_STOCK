const db = require('../../config/db');
const audit = require('../audit/audit.service');
const path = require('path');
const { makeImageStore } = require('../uploads/imageUpload');

const LOGO_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'logos');
const LOGO_URL_PREFIX = '/uploads/logos/';
const logos = makeImageStore({ dir: LOGO_DIR, urlPrefix: LOGO_URL_PREFIX });

const COLS = 'id, name, trade_name, email, phone, address, city, country, currency, logo_url, owner_name, website, tax_id, stat_number, rcs_number, payment_info, payment_terms, is_active, created_at, updated_at';

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
    const allowed = ['name', 'trade_name', 'email', 'phone', 'address', 'city', 'country', 'owner_name', 'website', 'tax_id', 'stat_number', 'rcs_number', 'payment_info', 'payment_terms'];
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

module.exports = { get, patch, setLogo, removeLogo };

/**
 * Logo entreprise : company du JWT uniquement, image validée AVANT écriture.
 * Dossier dédié /uploads/logos (jamais mélangé aux avatars/produits).
 * Audit : COMPANY_UPDATED (convention existante).
 */
async function setLogo(actor, file, meta = {}) {
  const saved = await logos.save(file);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, logo_url FROM companies WHERE id = $1 LIMIT 1 FOR UPDATE', [actor.companyId]);
    if (!cur.rows[0]) throw new Error('Entreprise introuvable');
    const r = await client.query(
      `UPDATE companies SET logo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING ${COLS}`,
      [saved.url, actor.companyId]
    );
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'COMPANY_UPDATED',
      entityType: 'company', entityId: actor.companyId, metadata: { fields: ['logo_url'] },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    if (cur.rows[0].logo_url && cur.rows[0].logo_url !== saved.url) {
      await logos.removeForUrl(cur.rows[0].logo_url);
    }
    return r.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    await logos.removeForUrl(saved.url); // pas de fichier orphelin
    if (e.message === 'Entreprise introuvable') e.status = 404;
    throw e;
  } finally {
    client.release();
  }
}

/** Retire le logo de l'entreprise. Idempotent. */
async function removeLogo(actor, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, logo_url FROM companies WHERE id = $1 LIMIT 1 FOR UPDATE', [actor.companyId]);
    if (!cur.rows[0]) {
      const err = new Error('Entreprise introuvable');
      err.status = 404;
      throw err;
    }
    let row = cur.rows[0];
    if (row.logo_url) {
      const r = await client.query(
        `UPDATE companies SET logo_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING ${COLS}`,
        [actor.companyId]
      );
      row = r.rows[0];
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: 'COMPANY_UPDATED',
        entityType: 'company', entityId: actor.companyId, metadata: { fields: ['logo_url_removed'] },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    await client.query('COMMIT');
    if (cur.rows[0].logo_url) await logos.removeForUrl(cur.rows[0].logo_url);
    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
