const db = require('../../config/db');
const audit = require('../audit/audit.service');
const { applyMovement } = require('../stock/stock.service');
const { STOCK_STATUS_CASE, stockStatus } = require('../../utils/stockStatus');

const BASE_COLS = `p.id, p.company_id, p.category_id, p.name, p.sku, p.description,
  p.purchase_price, p.sale_price, p.quantity, p.min_stock, p.unit, p.barcode,
  p.is_active, p.created_at, p.updated_at`;

// RETURNING n'a pas d'alias de table : mêmes colonnes sans préfixe.
const RETURNING_COLS = `id, company_id, category_id, name, sku, description,
  purchase_price, sale_price, quantity, min_stock, unit, barcode,
  is_active, created_at, updated_at`;

const WITH_COMPUTED = `${BASE_COLS},
  (p.sale_price - p.purchase_price) AS margin,
  (${STOCK_STATUS_CASE}) AS stock_status,
  cat.name AS category_name`;

const FROM_ACTIVE = 'FROM products p LEFT JOIN categories cat ON cat.id = p.category_id';

function notFound() {
  const err = new Error('Produit introuvable');
  err.status = 404;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

/** Vérifie qu'une catégorie appartient au tenant (NULL autorisé). */
async function assertCategoryOwned(client, categoryId, companyId) {
  if (categoryId === null || categoryId === undefined) return;
  const r = await client.query('SELECT id, is_active FROM categories WHERE id = $1 AND company_id = $2 LIMIT 1', [categoryId, companyId]);
  if (!r.rows[0]) {
    const err = new Error('Catégorie introuvable');
    err.status = 404; // 404 : ne révèle pas les catégories d'autres tenants
    throw err;
  }
  if (!r.rows[0].is_active) {
    const err = new Error('Catégorie désactivée');
    err.status = 422;
    throw err;
  }
}

async function assertSkuFree(client, sku, companyId, excludeId = null) {
  const params = [companyId, sku];
  let sql = 'SELECT id FROM products WHERE company_id = $1 AND sku = $2';
  if (excludeId) {
    params.push(excludeId);
    sql += ' AND id <> $3';
  }
  const r = await client.query(sql + ' LIMIT 1', params);
  if (r.rowCount > 0) throw conflict('Ce SKU existe déjà dans votre entreprise');
}

async function assertBarcodeFree(client, barcode, companyId, excludeId = null) {
  if (!barcode) return;
  const params = [companyId, barcode];
  let sql = 'SELECT id FROM products WHERE company_id = $1 AND barcode = $2';
  if (excludeId) {
    params.push(excludeId);
    sql += ' AND id <> $3';
  }
  const r = await client.query(sql + ' LIMIT 1', params);
  if (r.rowCount > 0) throw conflict('Ce code-barres existe déjà dans votre entreprise');
}

/** SKU auto : P-{companyId}-{seq global} → unicité tenant garantie par construction. */
async function generateSku(client, companyId) {
  const r = await client.query(`SELECT nextval('product_sku_seq') AS n`);
  return `P-${companyId}-${String(r.rows[0].n).padStart(6, '0')}`;
}

async function list(companyId, q) {
  const params = [companyId];
  const conds = ['p.company_id = $1'];
  if (!q.includeInactive || q.includeInactive === 'false') conds.push('p.is_active = TRUE');
  if (q.categoryId) {
    params.push(q.categoryId);
    conds.push(`p.category_id = $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    conds.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR COALESCE(p.barcode,'') ILIKE $${params.length})`);
  }
  if (q.outOfStock === 'true') conds.push('p.quantity = 0');
  if (q.lowStock === 'true') conds.push('p.quantity > 0 AND p.quantity <= p.min_stock');
  if (q.normalOnly === 'true') conds.push('p.quantity > p.min_stock');
  const where = `WHERE ${conds.join(' AND ')}`;
  const orderCol = { id: 'p.id', name: 'p.name', quantity: 'p.quantity', purchase_price: 'p.purchase_price', sale_price: 'p.sale_price', created_at: 'p.created_at' }[q.sort];
  const orderDir = q.order === 'desc' ? 'DESC' : 'ASC';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${FROM_ACTIVE} ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${WITH_COMPUTED} ${FROM_ACTIVE} ${where} ORDER BY ${orderCol} ${orderDir}, p.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function getById(id, companyId) {
  const r = await db.query(
    `SELECT ${WITH_COMPUTED} ${FROM_ACTIVE} WHERE p.id = $1 AND p.company_id = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!r.rows[0]) throw notFound();
  return r.rows[0];
}

async function create(actor, body, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await assertCategoryOwned(client, body.category_id ?? null, actor.companyId);
    const sku = body.sku || (await generateSku(client, actor.companyId));
    await assertSkuFree(client, sku, actor.companyId);
    await assertBarcodeFree(client, body.barcode ?? null, actor.companyId);
    // Le stock passe par un mouvement 'initial' (même transaction) — jamais de
    // quantité posée hors journal. Si initial = 0, aucun mouvement.
    const initialQty = body.quantity ?? 0;
    const r = await client.query(
      `INSERT INTO products (company_id, category_id, name, sku, description, purchase_price, sale_price, quantity, min_stock, unit, barcode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10)
       RETURNING ${RETURNING_COLS}`,
      [actor.companyId, body.category_id ?? null, body.name, sku, body.description ?? '',
        body.purchase_price ?? 0, body.sale_price ?? 0, body.min_stock ?? 0,
        body.unit ?? 'unité', body.barcode ?? null]
    );
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'PRODUCT_CREATED',
      entityType: 'product', entityId: r.rows[0].id,
      metadata: { name: body.name, sku, quantity: initialQty },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    let finalQty = 0;
    if (initialQty > 0) {
      const { movement } = await applyMovement(client, {
        companyId: actor.companyId, userId: actor.id, productId: r.rows[0].id,
        type: 'initial', quantity: initialQty, reason: 'Stock initial',
        reference: '', notes: '', meta,
      });
      finalQty = movement.quantity_after;
    }
    await client.query('COMMIT');
    const row = { ...r.rows[0], quantity: finalQty };
    return { ...row, margin: String(BigInt(row.sale_price) - BigInt(row.purchase_price)), stock_status: stockStatus(row.quantity, row.min_stock) };
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
    const cur = await client.query(`SELECT * FROM products WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE`, [id, actor.companyId]);
    if (!cur.rows[0]) throw notFound();
    if (changes.category_id !== undefined) await assertCategoryOwned(client, changes.category_id, actor.companyId);
    if (changes.sku !== undefined) await assertSkuFree(client, changes.sku, actor.companyId, id);
    if (changes.barcode !== undefined) await assertBarcodeFree(client, changes.barcode, actor.companyId, id);
    // Défense en profondeur : quantity exclu (verrouillé par la validation Zod).
    const allowed = ['name', 'sku', 'description', 'category_id', 'purchase_price', 'sale_price', 'min_stock', 'unit', 'barcode', 'is_active'];
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
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING ${RETURNING_COLS}`,
      params
    );
    await db.setTenantContext(client, actor.companyId);
    const wasActive = cur.rows[0].is_active;
    let action = 'PRODUCT_UPDATED';
    if (changes.is_active === false && wasActive) action = 'PRODUCT_DEACTIVATED';
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action,
      entityType: 'product', entityId: id, metadata: { name: r.rows[0].name, sku: r.rows[0].sku },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    const row = r.rows[0];
    return { ...row, margin: String(BigInt(row.sale_price) - BigInt(row.purchase_price)), stock_status: stockStatus(row.quantity, row.min_stock) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Suppression LOGIQUE (soft delete) : is_active=false.
 * Choix documenté : les produits seront liés aux ventes/achats/mouvements (étapes 5+),
 * un DELETE physique compliquerait ces relations. Idempotent.
 */
async function remove(actor, id, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, name, sku, is_active FROM products WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE', [id, actor.companyId]);
    if (!cur.rows[0]) throw notFound();
    await db.setTenantContext(client, actor.companyId);
    if (cur.rows[0].is_active) {
      await client.query('UPDATE products SET is_active = FALSE WHERE id = $1', [id]);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: 'PRODUCT_DEACTIVATED',
        entityType: 'product', entityId: id, metadata: { name: cur.rows[0].name, sku: cur.rows[0].sku },
        ip: meta.ip, userAgent: meta.userAgent,
      });
    }
    await client.query('COMMIT');
    return { ok: true, deactivated: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, patch, remove };
