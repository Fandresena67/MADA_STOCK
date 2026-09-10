const db = require('../../config/db');

const AUDIT_ACTIONS = [
  'AUTH_REGISTER',
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_REFRESH',
  'AUTH_REFRESH_REUSE_DETECTED',
  'AUTH_LOGOUT',
  'AUTH_LOGOUT_ALL',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'ROLE_CHANGED',
  'COMPANY_ACTIVATED',
  'COMPANY_DEACTIVATED',
  'COMPANY_UPDATED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DEACTIVATED',
  'CATEGORY_DELETED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DEACTIVATED',
  'STOCK_INITIALIZED',
  'STOCK_ENTRY_CREATED',
  'STOCK_EXIT_CREATED',
  'STOCK_ADJUSTMENT_CREATED',
  'SUPPLIER_CREATED',
  'SUPPLIER_UPDATED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'PURCHASE_CREATED',
  'PURCHASE_UPDATED',
  'PURCHASE_CONFIRMED',
  'PURCHASE_CANCELLED',
  'SALE_CREATED',
  'SALE_UPDATED',
  'SALE_CONFIRMED',
  'SALE_CANCELLED',
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
];

// Clés interdites dans les métadonnées d'audit (banni toute fuite de secret).
const FORBIDDEN_KEYS = new Set([
  'password', 'password_hash', 'passwordhash',
  'token', 'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
  'secret', 'jwt_secret', 'authorization', 'cookie', 'cookies', 'set-cookie',
]);

function scrubMetadata(value) {
  if (Array.isArray(value)) return value.map(scrubMetadata);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase().replace(/[^a-z]/g, ''))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubMetadata(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Écriture d'audit centralisée.
 * - Si `client` fourni : écrit DANS la transaction appelante (garantie atomique :
 *   un échec d'audit fait échouer l'opération, jamais de perte silencieuse).
 * - Sinon : best-effort via le pool (ex. login échoué), erreur loggée serveur.
 */
async function log({ client, userId = null, companyId = null, action, entityType = null, entityId = null, metadata = null, ip = null, userAgent = null }) {
  if (!AUDIT_ACTIONS.includes(action)) {
    throw new Error(`Action d'audit inconnue: ${action}`);
  }
  const runner = client ? client.query.bind(client) : db.query;
  const safeMetadata = metadata ? JSON.stringify(scrubMetadata(metadata)) : null;
  try {
    await runner(
      `INSERT INTO activity_logs (company_id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [companyId, userId, action, entityType, entityId !== null ? String(entityId) : null, safeMetadata, ip, userAgent]
    );
  } catch (err) {
    console.error(`[audit] ÉCHEC écriture ${action}:`, err.message);
    if (client) throw err; // transactionnel : propage → ROLLBACK (pas de perte silencieuse)
  }
}

module.exports = { AUDIT_ACTIONS, log, scrubMetadata };
