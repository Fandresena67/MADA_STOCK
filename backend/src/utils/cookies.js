const env = require('../config/env');

const REFRESH_COOKIE = 'madastock_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7j, aligné sur JWT_REFRESH_EXPIRES_IN

function cookieOptions() {
  return {
    httpOnly: true, // jamais accessible en JS : protection XSS
    secure: env.isProd, // HTTPS uniquement en production (localhost dev = http)
    sameSite: 'lax', // même-site (ports ignorés) : envoyé en XHR credentialed
    path: '/api/v1/auth', // cookie limité aux routes d'auth
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_COOKIE, rawToken, cookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie };
