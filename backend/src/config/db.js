const { Pool } = require('pg');
const env = require('./env');

// Pool singleton réutilisable — ne jamais créer un Pool par requête.
const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Log serveur uniquement, sans exposer de secrets.
  console.error('[db] pool error:', err.message);
});

/**
 * Pose le contexte tenant PostgreSQL DANS une transaction explicite.
 * Utiliser uniquement entre BEGIN et COMMIT/ROLLBACK : SET LOCAL est
 * automatiquement nettoyé en fin de transaction → aucun résidu dans le pool.
 * Ne JAMAIS utiliser SET (permanent) sur une connexion poolée.
 */
async function setTenantContext(client, companyId) {
  if (companyId === null || companyId === undefined) {
    await client.query(`RESET app.company_id`);
    return;
  }
  await client.query(`SET LOCAL app.company_id = '${Number(companyId)}'`);
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  setTenantContext,
};
