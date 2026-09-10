const express = require('express');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { stockReportQuery, docsReportQuery, profitReportQuery, movementsReportQuery } = require('./reports.validation');
const controller = require('./reports.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant, requirePermission('reports.view'));

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json({ error: 'Paramètres invalides' });
    req.query = result.data;
    return next();
  };
}

router.get('/stock', validateQuery(stockReportQuery), controller.stock);
router.get('/stockouts', validateQuery(stockReportQuery), controller.stockouts);
router.get('/sales', validateQuery(docsReportQuery), controller.sales);
router.get('/purchases', validateQuery(docsReportQuery), controller.purchases);
router.get('/profit', validateQuery(profitReportQuery), controller.profit);
router.get('/movements', validateQuery(movementsReportQuery), controller.movements);

module.exports = router;
