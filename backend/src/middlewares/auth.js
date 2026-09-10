const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Vérifie le JWT d'accès et expose le tenant :
 * req.user = { id, companyId, role }
 * Le companyId vient UNIQUEMENT du token, jamais du frontend.
 */
function authenticateJWT(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    if (payload.type && payload.type !== 'access') {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    req.user = {
      id: payload.sub,
      companyId: payload.companyId ?? null,
      role: payload.role,
    };
    if (!req.user.id || !req.user.role) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return next();
  } catch (err) {
    // Message générique : ne jamais exposer les détails JWT au client.
    return res.status(401).json({ error: 'Non authentifié' });
  }
}

module.exports = { authenticateJWT };
