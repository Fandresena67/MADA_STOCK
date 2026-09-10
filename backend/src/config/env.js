require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return v;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5435', 10),
    database: process.env.DB_NAME || 'madastock',
    user: process.env.DB_USER || 'madastock',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    // En production, JWT_SECRET doit faire >= 32 caractères (64 hex recommandé)
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};
