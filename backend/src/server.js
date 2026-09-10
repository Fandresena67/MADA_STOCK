const app = require('./app');
const env = require('./config/env');

if (!env.jwt.secret || env.jwt.secret.length < 32) {
  console.error('[fatal] JWT_SECRET manquant ou trop court (>= 32 caractères requis). Voir backend/.env.example');
  process.exit(1);
}

const server = app.listen(env.port, () => {
  console.log(`[api] MADA STOCK socle démarré sur http://localhost:${env.port} (env=${env.nodeEnv})`);
});

process.on('unhandledRejection', (err) => {
  console.error('[fatal] unhandledRejection:', err.message);
});

module.exports = server;
