const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { makeDocController } = require('../documents/doc.controller');

function buildDocRouter({ service, validation, perms, tierFilterKey }) {
  const router = express.Router();
  const controller = makeDocController(service);
  router.use(authenticateJWT, attachFreshUser, requireTenant);
  // Transmet la clé de filtre tenant au controller (supplier_id / customer_id).
  router.use((req, res, next) => {
    req.tierFilterKey = tierFilterKey;
    next();
  });

  const validateParams = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return res.status(400).json({ error: 'Paramètre invalide' });
    req.params = result.data;
    return next();
  };
  const validateQuery = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ error: 'Paramètres invalides' });
    req.query = result.data;
    return next();
  };

  router.get('/', requirePermission(perms.view), validateQuery(validation.listQuery), controller.list);
  router.post('/', requirePermission(perms.create), validate(validation.body), controller.create);
  router.get('/:id', requirePermission(perms.view), validateParams(validation.idParam), controller.getById);
  router.patch('/:id', requirePermission(perms.update), validateParams(validation.idParam), validate(validation.patch), controller.patch);
  router.post('/:id/confirm', requirePermission(perms.confirm), validateParams(validation.idParam), controller.confirm);
  // Pas de DELETE : draft → cancelled (historique préservé), confirmed immuable.
  return router;
}

module.exports = { buildDocRouter };
