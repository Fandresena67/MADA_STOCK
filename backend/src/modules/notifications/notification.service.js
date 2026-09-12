const db = require('../../config/db');
const audit = require('../audit/audit.service');

const NOTIFICATION_TYPES = [
  'STOCK_LOW', 'STOCK_OUT', 'SALE_CREATED', 'SALE_CONFIRMED',
  'PURCHASE_CONFIRMED', 'INVOICE_CREATED', 'INVOICE_PAID',
  'USER_ACTIVITY', 'SECURITY', 'SYSTEM',
];

const NOTIFICATION_COLS = 'id, company_id, user_id, type, title, message, entity_type, entity_id, metadata, read_at, created_at';

function toPublic(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function notFound() {
  // Convention sécurité : 404 anti-énumération cross-tenant (comme users).
  const err = new Error('Notification introuvable');
  err.status = 404;
  return err;
}

/**
 * Portée de lecture : membre d'entreprise → notifs société + personnelles ;
 * super_admin (companyId null) → personnelles à company NULL uniquement.
 * company_id/user_id viennent TOUJOURS du JWT rechargé, jamais du client.
 * Retourne { where, params } avec placeholders $n explicites.
 */
function scopeWhere(companyId, userId, alias = 'n') {
  if (companyId === null || companyId === undefined) {
    return { where: `${alias}.company_id IS NULL AND ${alias}.user_id = $1`, params: [userId] };
  }
  return {
    where: `${alias}.company_id = $1 AND (${alias}.user_id IS NULL OR ${alias}.user_id = $2)`,
    params: [companyId, userId],
  };
}

/** Décale les placeholders $n d'un fragment SQL de `offset`. */
function shiftPlaceholders(fragment, offset) {
  return fragment.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
}

/**
 * Émission best-effort APRÈS commit : une notification manquée ne doit jamais
 * faire échouer l'opération métier (vente, achat, facture…).
 */
async function notifyEvent(payload) {
  try {
    await createNotification(payload);
  } catch (e) {
    console.error('[notifications] émission impossible:', e.message);
  }
}

/** Montant sobre pour les messages (ex. « 850 000 Ar »). */
function formatAr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(n)} Ar`;
}

/**
 * Crée une notification. `client` optionnel : écriture DANS la transaction
 * appelante (ex. mouvement de stock) ou via le pool sinon.
 */
async function createNotification({ client, companyId, userId = null, type, title, message = '', entityType = null, entityId = null, metadata = null }) {
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new Error(`Type de notification inconnu: ${type}`);
  }
  if (companyId === null || companyId === undefined) {
    if (userId === null || userId === undefined) throw new Error('Notification sans destinataire');
  }
  const runner = client ? client.query.bind(client) : db.query;
  const r = await runner(
    `INSERT INTO notifications (company_id, user_id, type, title, message, entity_type, entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING ${NOTIFICATION_COLS}`,
    [companyId, userId, type, title, message, entityType, entityId, metadata ? JSON.stringify(metadata) : null]
  );
  return toPublic(r.rows[0]);
}

async function list(companyId, userId, { page, limit, unread, type, dateFrom, dateTo }) {
  const scope = scopeWhere(companyId, userId);
  const conds = [scope.where];
  const params = [...scope.params];
  if (unread) conds.push('n.read_at IS NULL');
  if (type) {
    params.push(type);
    conds.push(`n.type = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom.toISOString());
    conds.push(`n.created_at >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo.toISOString());
    conds.push(`n.created_at <= $${params.length}`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const [countRes, dataRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM notifications n ${where}`, params),
    db.query(
      `SELECT ${NOTIFICATION_COLS.split(', ').map((c) => `n.${c}`).join(', ')} FROM notifications n ${where}
       ORDER BY n.created_at DESC, n.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    ),
  ]);
  const total = countRes.rows[0].total;
  return { data: dataRes.rows.map(toPublic), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function countUnread(companyId, userId) {
  const scope = scopeWhere(companyId, userId);
  const r = await db.query(
    `SELECT COUNT(*)::int AS count FROM notifications n WHERE ${scope.where} AND n.read_at IS NULL`,
    scope.params
  );
  return { count: r.rows[0].count };
}

async function markAsRead(companyId, userId, id) {
  const scope = scopeWhere(companyId, userId);
  const r = await db.query(
    `UPDATE notifications AS n SET read_at = NOW() WHERE n.id = $1
     AND ${shiftPlaceholders(scope.where, 1)} AND n.read_at IS NULL
     RETURNING ${NOTIFICATION_COLS}`,
    [id, ...scope.params]
  );
  if (!r.rows[0]) throw notFound();
  return toPublic(r.rows[0]);
}

async function markAllAsRead(companyId, userId) {
  const scope = scopeWhere(companyId, userId);
  const r = await db.query(
    `UPDATE notifications AS n SET read_at = NOW() WHERE ${scope.where} AND n.read_at IS NULL`,
    scope.params
  );
  return { updated: r.rowCount };
}

/**
 * Suppression réservée aux notifications PERSONNELLES (user_id = soi).
 * Une notif société supprimée par un membre disparaîtrait pour tous : interdit.
 */
async function removeNotification(actor, id, meta = {}) {
  const r = await db.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, actor.id]
  );
  if (r.rowCount === 0) throw notFound();
  await audit.log({
    userId: actor.id, companyId: actor.companyId ?? null, action: 'NOTIFICATION_DELETED',
    entityType: 'notification', entityId: id, metadata: {},
    ip: meta.ip, userAgent: meta.userAgent,
  });
  return { ok: true };
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  notifyEvent,
  formatAr,
  list,
  countUnread,
  markAsRead,
  markAllAsRead,
  removeNotification,
};
