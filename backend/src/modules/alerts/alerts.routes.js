const express = require('express');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { alertsQuerySchema } = require('../dashboard/dashboard.validation');
const dashboardController = require('../dashboard/dashboard.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant, requirePermission('alerts.view'));

router.get('/', (req, res, next) => {
  const result = alertsQuerySchema.safeParse(req.query);
  if (!result.success) return res.status(400).json({ error: 'Paramètres invalides' });
  req.query = result.data;
  return dashboardController.alerts(req, res, next);
});

module.exports = router;
