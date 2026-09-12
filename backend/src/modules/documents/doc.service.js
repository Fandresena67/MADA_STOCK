const db = require('../../config/db');
const audit = require('../audit/audit.service');
const notifications = require('../notifications/notification.service');
const { applyMovement } = require('../stock/stock.service');
const { calcTotals } = require('../../utils/money');

/**
 * Moteur documentaire mutualisé achats/ventes.
 * config: { table, itemsTable, tierTable, tierKey, tierLabel, refSeq, refPrefix,
 *           movementType, movementReason, auditPrefix }
 * Règles : draft modifiable (lignes remplacées + recalcul serveur), confirmed
 * immuable, cancel = draft uniquement. Confirmation atomique + mouvements E5.
 */
function makeDocService(config) {
  const { table, tierTable, tierKey, tierLabel, refSeq, refPrefix, movementType, movementReason, auditPrefix, snapshotCost } = config;
  const itemsTable = table === 'purchases' ? 'purchase_items' : 'sale_items';
  const itemKey = table === 'purchases' ? 'purchase_id' : 'sale_id';
  const DOC_COLS = `d.id, d.company_id, d.${tierKey}, d.user_id, d.status, d.reference, d.subtotal, d.discount, d.tax, d.total, d.notes, d.created_at, d.updated_at`;

  function notFound() {
    const err = new Error(table === 'purchases' ? 'Achat introuvable' : 'Vente introuvable');
    err.status = 404;
    return err;
  }

  function locked() {
    const err = new Error('Document confirmé : il ne peut plus être modifié');
    err.status = 409;
    return err;
  }

  async function genReference(client) {
    const year = new Date().getFullYear();
    const r = await client.query(`SELECT nextval('${refSeq}') AS n`);
    return `${refPrefix}-${year}-${String(r.rows[0].n).padStart(6, '0')}`;
  }

  async function assertTier(client, tierId, companyId) {
    const r = await client.query(`SELECT id, is_active FROM ${tierTable} WHERE id = $1 AND company_id = $2 LIMIT 1`, [tierId, companyId]);
    if (!r.rows[0]) {
      const err = new Error(tierLabel === 'supplier' ? 'Fournisseur introuvable' : 'Client introuvable');
      err.status = 404;
      throw err;
    }
    if (!r.rows[0].is_active) {
      const err = new Error(tierLabel === 'supplier' ? 'Fournisseur désactivé' : 'Client désactivé');
      err.status = 422;
      throw err;
    }
  }

  async function assertProducts(client, items, companyId) {
    for (const it of items) {
      const r = await client.query('SELECT id, is_active FROM products WHERE id = $1 AND company_id = $2 LIMIT 1', [it.product_id, companyId]);
      if (!r.rows[0]) {
        const err = new Error('Produit introuvable');
        err.status = 404;
        throw err;
      }
      if (!r.rows[0].is_active) {
        const err = new Error('Produit désactivé');
        err.status = 422;
        throw err;
      }
    }
  }

  async function insertItems(client, docId, lines) {
    for (const l of lines) {
      await client.query(
        `INSERT INTO ${itemsTable} (${itemKey}, product_id, quantity, unit_price, discount, tax, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [docId, l.product_id, l.quantity, l.unit_price, l.discount ?? 0, l.tax ?? 0, l.line_total]
      );
    }
  }

  async function fetchFull(clientOrDb, docId, companyId) {
    const runner = clientOrDb.query ? clientOrDb.query.bind(clientOrDb) : clientOrDb;
    const d = await runner(
      `SELECT ${DOC_COLS}, t.name AS tier_name FROM ${table} d JOIN ${tierTable} t ON t.id = d.${tierKey} AND t.company_id = d.company_id
       WHERE d.id = $1 AND d.company_id = $2 LIMIT 1`,
      [docId, companyId]
    );
    if (!d.rows[0]) throw notFound();
    const items = await runner(
      `SELECT i.*, p.name AS product_name, p.sku AS product_sku FROM ${itemsTable} i
       JOIN products p ON p.id = i.product_id WHERE i.${itemKey} = $1 ORDER BY i.id ASC`,
      [docId]
    );
    return { ...d.rows[0], items: items.rows };
  }

  async function list(companyId, q, tierFilterKey) {
    const params = [companyId];
    const conds = ['d.company_id = $1'];
    if (q.status) {
      params.push(q.status);
      conds.push(`d.status = $${params.length}`);
    }
    if (q[tierFilterKey]) {
      params.push(q[tierFilterKey]);
      conds.push(`d.${tierKey} = $${params.length}`);
    }
    if (q.date_from) {
      params.push(q.date_from.toISOString());
      conds.push(`d.created_at >= $${params.length}`);
    }
    if (q.date_to) {
      params.push(q.date_to.toISOString());
      conds.push(`d.created_at <= $${params.length}`);
    }
    if (q.search) {
      params.push(`%${q.search}%`);
      conds.push(`(d.reference ILIKE $${params.length} OR t.name ILIKE $${params.length})`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const join = `FROM ${table} d JOIN ${tierTable} t ON t.id = d.${tierKey} AND t.company_id = d.company_id`;
    const countRes = await db.query(`SELECT COUNT(*)::int AS total ${join} ${where}`, params);
    const dataRes = await db.query(
      `SELECT ${DOC_COLS}, t.name AS tier_name ${join} ${where} ORDER BY d.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
      await assertTier(client, body[tierKey], actor.companyId);
      await assertProducts(client, body.items, actor.companyId);
      const totals = calcTotals(body.items, body.discount ?? 0, body.tax ?? 0);
      const reference = await genReference(client);
      const r = await client.query(
        `INSERT INTO ${table} (company_id, ${tierKey}, user_id, status, reference, subtotal, discount, tax, total, notes)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9) RETURNING id`,
        [actor.companyId, body[tierKey], actor.id, reference, totals.subtotal, totals.discount, totals.tax, totals.total, body.notes ?? '']
      );
      await insertItems(client, r.rows[0].id, totals.lines);
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_CREATED`,
        entityType: table.slice(0, -1), entityId: r.rows[0].id, metadata: { reference, total: totals.total },
        ip: meta.ip, userAgent: meta.userAgent,
      });
      await client.query('COMMIT');
      const doc = await fetchFull(db, r.rows[0].id, actor.companyId);
      if (auditPrefix === 'SALE') {
        // Best-effort après commit : ne jamais faire échouer la vente.
        notifications.notifyEvent({
          companyId: actor.companyId,
          type: 'SALE_CREATED',
          title: 'Nouvelle vente',
          message: `Une nouvelle vente de ${notifications.formatAr(doc.total)} a été enregistrée (${doc.reference}).`,
          entityType: 'sale',
          entityId: doc.id,
          metadata: { reference: doc.reference, total: doc.total, tier_name: doc.tier_name },
        });
      }
      return doc;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async function patchDraft(actor, id, changes, meta = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM ${table} WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE`, [id, actor.companyId]);
      if (!cur.rows[0]) throw notFound();
      if (cur.rows[0].status !== 'draft') throw locked();
      // Annulation brouillon : draft → cancelled (aucun impact stock).
      if (changes.status === 'cancelled') {
        await client.query(`UPDATE ${table} SET status = 'cancelled' WHERE id = $1`, [id]);
        await db.setTenantContext(client, actor.companyId);
        await audit.log({
          client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_CANCELLED`,
          entityType: table.slice(0, -1), entityId: id, metadata: { reference: cur.rows[0].reference },
          ip: meta.ip, userAgent: meta.userAgent,
        });
        await client.query('COMMIT');
        return fetchFull(db, id, actor.companyId);
      }
      const tierId = changes[tierKey] ?? cur.rows[0][tierKey];
      await assertTier(client, tierId, actor.companyId);
      let lines = null;
      let totals = null;
      if (changes.items) {
        await assertProducts(client, changes.items, actor.companyId);
        totals = calcTotals(changes.items, changes.discount ?? cur.rows[0].discount, changes.tax ?? cur.rows[0].tax);
        lines = totals.lines;
        await client.query(`DELETE FROM ${itemsTable} WHERE ${itemKey} = $1`, [id]);
        await insertItems(client, id, lines);
      }
      const sets = [];
      const params = [];
      const push = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
      if (changes[tierKey] !== undefined) push(tierKey, tierId);
      if (changes.notes !== undefined) push('notes', changes.notes);
      if (totals) {
        push('subtotal', totals.subtotal);
        push('discount', changes.discount ?? cur.rows[0].discount);
        push('tax', changes.tax ?? cur.rows[0].tax);
        push('total', totals.total);
      } else {
        // Recalcul si remise/taxe document changées sans nouvelles lignes.
        if (changes.discount !== undefined || changes.tax !== undefined) {
          const ex = await client.query(`SELECT product_id, quantity, unit_price, discount, tax FROM ${itemsTable} WHERE ${itemKey} = $1`, [id]);
          totals = calcTotals(ex.rows, changes.discount ?? cur.rows[0].discount, changes.tax ?? cur.rows[0].tax);
          push('subtotal', totals.subtotal);
          push('discount', changes.discount ?? cur.rows[0].discount);
          push('tax', changes.tax ?? cur.rows[0].tax);
          push('total', totals.total);
        }
      }
      if (sets.length > 0) {
        params.push(id);
        await client.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      }
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_UPDATED`,
        entityType: table.slice(0, -1), entityId: id, metadata: { reference: cur.rows[0].reference },
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

  async function confirm(actor, id, meta = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM ${table} WHERE id = $1 AND company_id = $2 LIMIT 1 FOR UPDATE`, [id, actor.companyId]);
      if (!cur.rows[0]) throw notFound();
      if (cur.rows[0].status === 'confirmed') {
        // Double confirmation : retourne l'état actuel, SANS nouveau mouvement.
        await client.query('COMMIT');
        return { ...(await fetchFull(db, id, actor.companyId)), alreadyConfirmed: true };
      }
      if (cur.rows[0].status !== 'draft') {
        const err = new Error('Document annulé : il ne peut plus être confirmé');
        err.status = 409;
        throw err;
      }
      await assertTier(client, cur.rows[0][tierKey], actor.companyId);
      const items = await client.query(`SELECT * FROM ${itemsTable} WHERE ${itemKey} = $1 ORDER BY id ASC`, [id]);
      if (items.rows.length === 0) {
        const err = new Error('Document sans lignes');
        err.status = 422;
        throw err;
      }
      for (const it of items.rows) {
        await applyMovement(client, {
          companyId: actor.companyId, userId: actor.id, productId: it.product_id,
          type: movementType, quantity: it.quantity,
          reason: `${movementReason} ${cur.rows[0].reference}`,
          reference: cur.rows[0].reference, notes: '', meta,
        });
        if (snapshotCost) {
          // Snapshot du coût d'achat au moment de la confirmation (bénéfice historique exact).
          await client.query(
            `UPDATE ${itemsTable} SET unit_cost = (SELECT purchase_price FROM products WHERE id = $1) WHERE id = $2`,
            [it.product_id, it.id]
          );
        }
      }
      await client.query(`UPDATE ${table} SET status = 'confirmed' WHERE id = $1`, [id]);
      await db.setTenantContext(client, actor.companyId);
      await audit.log({
        client, userId: actor.id, companyId: actor.companyId, action: `${auditPrefix}_CONFIRMED`,
        entityType: table.slice(0, -1), entityId: id,
        metadata: { reference: cur.rows[0].reference, total: cur.rows[0].total, lines: items.rows.length },
        ip: meta.ip, userAgent: meta.userAgent,
      });
      await client.query('COMMIT');
      const confirmed = await fetchFull(db, id, actor.companyId);
      // Best-effort après commit (alreadyConfirmed sort avant : pas de doublon).
      notifications.notifyEvent({
        companyId: actor.companyId,
        type: auditPrefix === 'SALE' ? 'SALE_CONFIRMED' : 'PURCHASE_CONFIRMED',
        title: auditPrefix === 'SALE' ? 'Vente confirmée' : 'Achat confirmé',
        message:
          auditPrefix === 'SALE'
            ? `La vente ${confirmed.reference} (${notifications.formatAr(confirmed.total)}) a été confirmée.`
            : `Le bon d'achat ${confirmed.reference} a été confirmé.`,
        entityType: auditPrefix === 'SALE' ? 'sale' : 'purchase',
        entityId: confirmed.id,
        metadata: { reference: confirmed.reference, total: confirmed.total, tier_name: confirmed.tier_name },
      });
      return confirmed;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return { list, getById, create, patchDraft, confirm };
}

module.exports = { makeDocService };
