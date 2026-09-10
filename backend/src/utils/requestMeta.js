/** IP + user-agent tronqués pour audit/cookies. Aucun secret. */
function getRequestMeta(req) {
  const ip = (req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64) || null;
  const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 512) || null;
  return { ip, userAgent };
}

module.exports = { getRequestMeta };
