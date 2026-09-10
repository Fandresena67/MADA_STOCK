const crypto = require('crypto');

/** SHA-256 hex d'un refresh token brut. Seul ce hash est stocké en base. */
function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function newJti() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { hashToken, newJti };
