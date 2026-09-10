const express = require('express');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { trendsQuerySchema, summaryQuerySchema, topQuerySchema, activityQuerySchema, alertsQuerySchema } = require('./dashboard.validation');
const controller = require('./dashboard.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant, requirePermission('dashboard.view'));

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.') || 'query', message: i.message }));
      return res.status(400).json({ error: 'Paramètres invalides', details });
    }
    req.query = result.data;
    return next();
  };
}

router.get('/summary', validateQuery(summaryQuerySchema), controller.summary);
router.get('/sales-trend', validateQuery(trendsQuerySchema), controller.trends);
router.get('/purchases-trend', validateQuery(trendsQuerySchema), controller.trends);
router.get('/revenue-trend', validateQuery(trendsQuerySchema), controller.trends);
router.get('/profit-trend', validateQuery(trendsQuerySchema), controller.trends);
router.get('/stock-distribution', controller.distribution);
router.get('/top-products', validateQuery(topQuerySchema), controller.topProducts);
router.get('/recent-activity', validateQuery(activityQuerySchema), controller.recentActivity);
router.get('/alerts', validateQuery(alertsQuerySchema), controller.alerts);

module.exports = router;
