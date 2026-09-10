const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { idParamSchema, listQuerySchema, tierBodySchema, tierPatchSchema } = require('./tier.validation');
const { makeTierController } = require('./tier.controller');
const { suppliers, customers } = require('./index');

function buildRouter(service, perms) {
  const router = express.Router();
  const controller = makeTierController(service);
  router.use(authenticateJWT, attachFreshUser, requireTenant);

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

  router.get('/', requirePermission(perms.view), validateQuery(listQuerySchema), controller.list);
  router.post('/', requirePermission(perms.manage), validate(tierBodySchema), controller.create);
  router.get('/:id', requirePermission(perms.view), validateParams(idParamSchema), controller.getById);
  router.patch('/:id', requirePermission(perms.manage), validateParams(idParamSchema), validate(tierPatchSchema), controller.patch);
  // Pas de DELETE : désactivation via PATCH is_active=false (documents historiques préservés).
  return router;
}

module.exports = {
  suppliersRoutes: buildRouter(suppliers, { view: 'suppliers.view', manage: 'suppliers.manage' }),
  customersRoutes: buildRouter(customers, { view: 'customers.view', manage: 'customers.manage' }),
};
