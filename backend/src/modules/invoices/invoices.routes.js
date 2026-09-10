const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { idParamSchema, invoiceListQuerySchema, invoiceBodySchema, invoiceStatusSchema } = require('./invoices.validation');
const controller = require('./invoices.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant);

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return res.status(400).json({ error: 'Paramètre invalide' });
    req.params = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ error: 'Paramètres invalides' });
    req.query = result.data;
    return next();
  };
}

router.get('/', requirePermission('invoices.view'), validateQuery(invoiceListQuerySchema), controller.list);
router.post('/', requirePermission('invoices.create'), validate(invoiceBodySchema), controller.create);
router.get('/:id', requirePermission('invoices.view'), validateParams(idParamSchema), controller.getById);
router.patch('/:id/status', requirePermission('invoices.update'), validateParams(idParamSchema), validate(invoiceStatusSchema), controller.setStatus);

module.exports = router;
