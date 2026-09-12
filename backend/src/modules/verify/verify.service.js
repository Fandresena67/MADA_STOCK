const db = require('../../config/db');

/**
 * Vérification publique d'authenticité : AUCUNE authentification requise,
 * mais seules les données strictement nécessaires sont exposées
 * (jamais d'adresse/téléphone/email client, jamais d'item détaillé).
 * Token 64 hex non prédictible + rate-limit : pas d'énumération.
 */
async function verifyByToken(token) {
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    const err = new Error('Facture introuvable ou invalide.');
    err.status = 404;
    throw err;
  }
  const r = await db.query(
    `SELECT i.invoice_number, i.status, i.total, i.created_at,
            COALESCE(i.company_snapshot->>'trade_name', i.company_snapshot->>'name', c.name) AS company_name,
            cust.name AS customer_name
     FROM invoices i
     JOIN companies c ON c.id = i.company_id AND c.is_active = TRUE
     JOIN customers cust ON cust.id = i.customer_id AND cust.company_id = i.company_id
     WHERE i.verify_token = $1 LIMIT 1`,
    [token.toLowerCase()]
  );
  if (!r.rows[0]) {
    const err = new Error('Facture introuvable ou invalide.');
    err.status = 404;
    throw err;
  }
  const row = r.rows[0];
  return {
    invoiceNumber: row.invoice_number,
    companyName: row.company_name,
    customerName: row.customer_name,
    date: row.created_at,
    total: row.total,
    status: row.status,
  };
}

module.exports = { verifyByToken };
