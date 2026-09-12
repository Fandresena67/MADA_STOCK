const db = require('../../config/db');
const audit = require('../audit/audit.service');
const notifications = require('../notifications/notification.service');

const MOVEMENT_TYPES = ['initial', 'in', 'out', 'adjustment'];

const AUDIT_BY_TYPE = {
  initial: 'STOCK_INITIALIZED',
  in: 'STOCK_ENTRY_CREATED',
  out: 'STOCK_EXIT_CREATED',
  adjustment: 'STOCK_ADJUSTMENT_CREATED',
};

const ROW = `m.id, m.company_id, m.product_id, m.user_id, m.movement_type, m.quantity,
  m.quantity_before, m.quantity_after, m.reason, m.reference, m.notes, m.created_at,
  p.name AS product_name, p.sku AS product_sku,
  u.name AS author_name, u.email AS author_email`;
const FROM = `FROM stock_movements m
  JOIN products p ON p.id = m.product_id AND p.company_id = m.company_id
  LEFT JOIN users u ON u.id = m.user_id`;

function notFound() {
  const err = new Error('Mouvement introuvable');
  err.status = 404;
  return err;
}

function insufficient(available) {
  const err = new Error(`Stock insuffisant (disponible : ${available})`);
  err.status = 409;
  return err;
}

/**
 * Seuils de stock : notification UNIQUEMENT au franchissement vers le bas
 * (jamais à la lecture, jamais sur réassort ni stock initial, jamais en replay
 * idempotent qui sort avant). Écriture DANS la transaction du mouvement.
 */
async function notifyStockThreshold(client, { companyId, productId, name, minStock, before, after, type }) {
  if (type === 'initial' || type === 'in') return;
  const min = Number(minStock ?? 0);
  const base = { client, companyId, entityType: 'product', entityId: productId };
  if (after === 0 && before > 0) {
    await notifications.createNotification({
      ...base,
      type: 'STOCK_OUT',
      title: 'Rupture de stock',
      message: `Le produit ${name} est actuellement en rupture.`,
      metadata: { product_name: name, quantity: after },
    });
  } else if (after > 0 && after <= min && before > min) {
    await notifications.createNotification({
      ...base,
      type: 'STOCK_LOW',
      title: 'Stock faible',
      message: `Le produit ${name} est presque épuisé (${after} restant${after > 1 ? 's' : ''}).`,
      metadata: { product_name: name, quantity: after, min_stock: min },
    });
  }
}

/**
 * Cœur métier : applique UN mouvement DANS la transaction de l'appelant.
 * Verrouille le produit (FOR UPDATE), calcule before/after, met à jour
 * products.quantity, insère le mouvement + audit. Jamais de COMMIT ici.
 */
async function applyMovement(client, { companyId, userId, productId, type, quantity, reason = '', reference = '', notes = '', idempotencyKey = null, meta = {} }) {
  if (!MOVEMENT_TYPES.includes(type)) {
    const err = new Error('Type de mouvement invalide');
    err.status = 400;
    throw err;
  }
  const lock = await client.query(
    `SELECT id, name, quantity, min_stock, is_active FROM products WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE`,
    [productId, companyId]
  );
  const product = lock.rows[0];
  if (!product) throw notFound(); // 404 : produit inexistant ou autre tenant
  if (!product.is_active) {
    const err = new Error('Produit désactivé');
    err.status = 422;
    throw err;
  }
  const before = product.quantity;
  let after;
  let storedQty;
  if (type === 'in' || type === 'initial') {
    after = before + quantity;
    storedQty = quantity;
  } else if (type === 'out') {
    after = before - quantity;
    if (after < 0) throw insufficient(before);
    storedQty = quantity;
  } else {
    // adjustment : quantity = stock CIBLE.
    after = quantity;
    storedQty = Math.abs(after - before);
    if (storedQty === 0) {
      const err = new Error('Aucune variation : le stock cible égale le stock actuel');
      err.status = 422;
      throw err;
    }
  }

  await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [after, productId]);
  let row;
  try {
    const ins = await client.query(
      `INSERT INTO stock_movements (company_id, product_id, user_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, notes, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [companyId, productId, userId, type, storedQty, before, after, reason, reference, notes, idempotencyKey]
    );
    row = ins.rows[0];
  } catch (e) {
    // Idempotence : même clé → rejoue le mouvement existant, sans toucher au stock.
    if (idempotencyKey && e.code === '23505' && e.constraint === 'stock_movements_idempotency_unique') {
      await client.query('ROLLBACK TO SAVEPOINT mada_idem');
      const existing = await client.query(
        `SELECT ${ROW} ${FROM} WHERE m.company_id = $1 AND m.idempotency_key = $2 LIMIT 1`,
        [companyId, idempotencyKey]
      );
      if (!existing.rows[0]) throw e;
      return { movement: existing.rows[0], deduplicated: true };
    }
    throw e;
  }
  await db.setTenantContext(client, companyId);
  await audit.log({
    client, userId, companyId, action: AUDIT_BY_TYPE[type],
    entityType: 'stock_movement', entityId: row.id,
    metadata: { product_id: productId, movement_type: type, quantity: storedQty, before, after, reference },
    ip: meta.ip, userAgent: meta.userAgent,
  });
  const full = await client.query(`SELECT ${ROW} ${FROM} WHERE m.id = $1 LIMIT 1`, [row.id]);
  await notifyStockThreshold(client, {
    companyId, productId, name: product.name, minStock: product.min_stock,
    before, after, type,
  });
  return { movement: full.rows[0], deduplicated: false };
}

/** Enveloppe transactionnelle : 1 connexion, BEGIN/COMMIT/ROLLBACK/release. */
async function runInTransaction(actor, input, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (input.idempotencyKey) await client.query('SAVEPOINT mada_idem');
    const result = await applyMovement(client, {
      companyId: actor.companyId,
      userId: actor.id,
      productId: input.product_id,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? '',
      reference: input.reference ?? '',
      notes: input.notes ?? '',
      idempotencyKey: input.idempotencyKey ?? null,
      meta,
    });
    await client.query('COMMIT');
    return { ...result.movement, deduplicated: result.deduplicated };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function createEntry(actor, body, meta) {
  return runInTransaction(actor, { ...body, type: 'in', idempotencyKey: body.idempotency_key }, meta);
}

async function createExit(actor, body, meta) {
  return runInTransaction(actor, { ...body, type: 'out', idempotencyKey: body.idempotency_key }, meta);
}

async function createAdjustment(actor, body, meta) {
  return runInTransaction(actor, { ...body, type: 'adjustment', idempotencyKey: body.idempotency_key }, meta);
}

async function list(companyId, q) {
  const params = [companyId];
  const conds = ['m.company_id = $1'];
  if (q.product_id) {
    params.push(q.product_id);
    conds.push(`m.product_id = $${params.length}`);
  }
  if (q.movement_type) {
    params.push(q.movement_type);
    conds.push(`m.movement_type = $${params.length}`);
  }
  if (q.user_id) {
    params.push(q.user_id);
    conds.push(`m.user_id = $${params.length}`);
  }
  if (q.date_from) {
    params.push(q.date_from.toISOString());
    conds.push(`m.created_at >= $${params.length}`);
  }
  if (q.date_to) {
    params.push(q.date_to.toISOString());
    conds.push(`m.created_at <= $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    conds.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR m.reference ILIKE $${params.length} OR m.reason ILIKE $${params.length})`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const orderCol = q.sort === 'id' ? 'm.id' : 'm.created_at';
  const orderDir = q.order === 'asc' ? 'ASC' : 'DESC';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${FROM} ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${ROW} ${FROM} ${where} ORDER BY ${orderCol} ${orderDir}, m.id ${orderDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function getById(id, companyId) {
  const r = await db.query(`SELECT ${ROW} ${FROM} WHERE m.id = $1 AND m.company_id = $2 LIMIT 1`, [id, companyId]);
  if (!r.rows[0]) throw notFound();
  return r.rows[0];
}

module.exports = { applyMovement, createEntry, createExit, createAdjustment, list, getById, MOVEMENT_TYPES };
