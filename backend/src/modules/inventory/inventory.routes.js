const express = require('express');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { inventoryQuerySchema, alertsQuerySchema } = require('./inventory.validation');
const controller = require('./inventory.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant);

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ error: 'Paramètres invalides' });
    req.query = result.data;
    return next();
  };
}

// Préparation dashboard Étape 7 (produits + valorisation).
router.get('/summary', requirePermission('products.view'), controller.summary);
// Vue stock tenant-scopée + alertes rupture/faible.
router.get('/', requirePermission('stock.view'), validateQuery(inventoryQuerySchema), controller.list);
router.get('/alerts', requirePermission('stock.view'), validateQuery(alertsQuerySchema), controller.alerts);

module.exports = router;
