const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { idParamSchema, entrySchema, exitSchema, adjustmentSchema, historyQuerySchema } = require('./stock.validation');
const controller = require('./stock.controller');

const router = express.Router();

// Historique immuable : lecture seule (aucune route PUT/DELETE par conception).
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

router.post('/entries', requirePermission('stock.in'), validate(entrySchema), controller.createEntry);
router.post('/exits', requirePermission('stock.out'), validate(exitSchema), controller.createExit);
router.post('/adjustments', requirePermission('stock.adjust'), validate(adjustmentSchema), controller.createAdjustment);
router.get('/movements', requirePermission('stock.view'), validateQuery(historyQuerySchema), controller.list);
router.get('/movements/:id', requirePermission('stock.view'), validateParams(idParamSchema), controller.getById);

module.exports = router;
