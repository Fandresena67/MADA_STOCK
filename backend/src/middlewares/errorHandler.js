// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Log serveur uniquement (sans secrets).
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  let status = err.status || 500;
  if (err.message === 'Origine CORS non autorisée') status = 403;
  // Réponse générique : jamais de stack, SQL ou secret au client.
  res.status(status).json({ error: status >= 500 ? 'Erreur interne du serveur' : err.message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Ressource introuvable' });
}

module.exports = { errorHandler, notFound };
