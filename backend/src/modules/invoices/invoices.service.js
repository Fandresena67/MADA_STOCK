const db = require('../../config/db');
const audit = require('../audit/audit.service');
const { calcTotals } = require('../../utils/money');

const COLS = `i.id, i.company_id, i.sale_id, i.customer_id, i.user_id, i.invoice_number, i.status,
  i.subtotal, i.discount, i.tax, i.total, i.issued_at, i.due_at, i.notes, i.created_at, i.updated_at`;

function notFound() {
  const err = new Error('Facture introuvable');
  err.status = 404;
  return err;
}

async function genNumber(client) {
  const year = new Date().getFullYear();
  const r = await client.query(`SELECT nextval('invoice_ref_seq') AS n`);
  return `FAC-${year}-${String(r.rows[0].n).padStart(6, '0')}`;
}

async function fetchFull(clientOrDb, id, companyId) {
  const runner = clientOrDb.query ? clientOrDb.query.bind(clientOrDb) : clientOrDb;
  const d = await runner(
    `SELECT ${COLS}, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.address AS customer_address
     FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id
     WHERE i.id = $1 AND i.company_id = $2 LIMIT 1`,
    [id, companyId]
  );
  if (!d.rows[0]) throw notFound();
  const items = await runner('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
  return { ...d.rows[0], items: items.rows };
}

async function list(companyId, q) {
  const params = [companyId];
  const conds = ['i.company_id = $1'];
  if (q.status) {
    params.push(q.status);
    conds.push(`i.status = $${params.length}`);
  }
  if (q.date_from) {
    params.push(q.date_from.toISOString());
    conds.push(`i.created_at >= $${params.length}`);
  }
  if (q.date_to) {
    params.push(q.date_to.toISOString());
    conds.push(`i.created_at <= $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    conds.push(`(i.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const join = 'FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id';
  const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
  const dataRes = await db.query(
    `SELECT ${COLS}, c.name AS customer_name ${join} ${where} ORDER BY i.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit]
  );
  const total = countRes.rows[0].total;
  return { data: dataRes.rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
}

async function getById(id, companyId) {
  return fetchFull(db, id, companyId);
}

async function create(actor, body, meta = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let customerId;
    let saleId = null;
    let lines;
    let totals;
    if (body.sale_id) {
      // Facture liée : vente confirmée du tenant, UNE seule facture par vente.
      const s = await client.query(
        `SELECT s.*, c.name AS customer_name FROM sales s JOIN customers c ON c.id = s.customer_id AND c.company_id = s.company_id
         WHERE s.id = $1 AND s.company_id = $2 LIMIT 1 FOR UPDATE`,
        [body.sale_id, actor.companyId]
      );
      if (!s.rows[0]) {
        const err = new Error('Vente introuvable');
        err.status = 404;
        throw err;
      }
      if (s.rows[0].status !== 'confirmed') {
        const err = new Error('Seule une vente confirmée peut être facturée');
        err.status = 409;
        throw err;
      }
      const dup = await client.query('SELECT id FROM invoices WHERE sale_id = $1 AND company_id = $2 LIMIT 1', [body.sale_id, actor.companyId]);
      if (dup.rowCount > 0) {
        const err = new Error('Cette vente est déjà facturée');
        err.status = 409;
        throw err;
      }
      saleId = body.sale_id;
      customerId = s.rows[0].customer_id;
      const sItems = await client.query(
        `SELECT si.*, p.name AS product_name FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1 ORDER BY si.id ASC`,
        [body.sale_id]
      );
      // Totaux recalculés depuis les lignes (jamais copiés aveuglément).
      const snap = sItems.rows.map((r) => ({ product_id: r.product_id, product_name: r.product_name, quantity: r.quantity, unit_price: String(r.unit_price), discount: String(r.discount), tax: String(r.tax) }));
      totals = calcTotals(snap, body.discount ?? 0, body.tax ?? 0);
      lines = totals.lines;
    } else {
      customerId = body.customer_id;
      const c = await client.query('SELECT id, is_active FROM customers WHERE id = $1 AND company_id = $2 LIMIT 1', [customerId, actor.companyId]);
      if (!c.rows[0]) {
        const err = new Error('Client introuvable');
        err.status = 404;
        throw err;
      }
      if (!c.rows[0].is_active) {
        const err = new Error('Client désactivé');
        err.status = 422;
        throw err;
      }
      // Lignes autonomes : produits vérifiés tenant + actifs, nom snapshoté.
      const norm = [];
      for (const it of body.items) {
        let pname = it.product_name || '';
        if (it.product_id) {
          const p = await client.query('SELECT id, name, is_active FROM products WHERE id = $1 AND company_id = $2 LIMIT 1', [it.product_id, actor.companyId]);
          if (!p.rows[0]) {
            const err = new Error('Produit introuvable');
            err.status = 404;
            throw err;
          }
          if (!p.rows[0].is_active) {
            const err = new Error('Produit désactivé');
            err.status = 422;
            throw err;
          }
          pname = p.rows[0].name;
        }
        norm.push({ ...it, product_name: pname });
      }
      totals = calcTotals(norm, body.discount ?? 0, body.tax ?? 0);
      lines = totals.lines;
    }
    const number = await genNumber(client);
    const r = await client.query(
      `INSERT INTO invoices (company_id, sale_id, customer_id, user_id, invoice_number, status, subtotal, discount, tax, total, due_at, notes)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11) RETURNING id`,
      [actor.companyId, saleId, customerId, actor.id, number, totals.subtotal, totals.discount, totals.tax, totals.total,
        body.due_at ? body.due_at.toISOString() : null, body.notes ?? '']
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, discount, tax, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.rows[0].id, l.product_id ?? null, l.product_name || '', l.quantity, l.unit_price, l.discount ?? 0, l.tax ?? 0, l.line_total]
      );
    }
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'INVOICE_CREATED',
      entityType: 'invoice', entityId: r.rows[0].id, metadata: { invoice_number: number, total: totals.total, sale_id: saleId },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return fetchFull(db, r.rows[0].id, actor.companyId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// draft → issued → paid ; draft/issued → cancelled ; paid final.
async function setStatus(actor, id, status, meta = {}) {
  const allowed = { draft: ['issued', 'cancelled'], issued: ['paid', 'cancelled'], paid: [], cancelled: [] };
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, status, invoice_number FROM invoices WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE', [id, actor.companyId]);
    if (!cur.rows[0]) throw notFound();
    if (!allowed[cur.rows[0].status].includes(status)) {
      const err = new Error(`Transition ${cur.rows[0].status} → ${status} interdite`);
      err.status = 409;
      throw err;
    }
    const sets = ['status = $1'];
    const params = [status];
    if (status === 'issued') {
      sets.push('issued_at = NOW()');
    }
    params.push(id);
    await client.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    await db.setTenantContext(client, actor.companyId);
    await audit.log({
      client, userId: actor.id, companyId: actor.companyId, action: 'INVOICE_UPDATED',
      entityType: 'invoice', entityId: id,
      metadata: { invoice_number: cur.rows[0].invoice_number, from: cur.rows[0].status, to: status },
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await client.query('COMMIT');
    return fetchFull(db, id, actor.companyId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, setStatus };
