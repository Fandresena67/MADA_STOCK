/* Migration runner minimal : applique les .sql de backend/migrations dans l'ordre. */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');

async function main() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('[migrate] aucune migration trouvée');
    return;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`);
  const done = new Set((await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));
  for (const f of files) {
    if (done.has(f)) {
      console.log(`[migrate] skip ${f} (déjà appliquée)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`[migrate] apply ${f}...`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await pool.query('COMMIT');
      console.log(`[migrate] OK ${f}`);
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error(`[migrate] FAIL ${f}:`, e.message);
      process.exitCode = 1;
      break;
    }
  }
  await pool.end();
}

main().catch((e) => { console.error('[migrate] fatal:', e.message); process.exit(1); });
