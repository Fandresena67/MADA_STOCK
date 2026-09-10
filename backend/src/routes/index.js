const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const superadminRoutes = require('../modules/superadmin/superadmin.routes');
const categoriesRoutes = require('../modules/categories/categories.routes');
const productsRoutes = require('../modules/products/products.routes');
const inventoryRoutes = require('../modules/inventory/inventory.routes');
const stockRoutes = require('../modules/stock/stock.routes');
const { suppliersRoutes, customersRoutes } = require('../modules/tiers/tier.routes');
const purchasesRoutes = require('../modules/purchases/purchases.routes');
const salesRoutes = require('../modules/sales/sales.routes');
const invoicesRoutes = require('../modules/invoices/invoices.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const alertsRoutes = require('../modules/alerts/alerts.routes');
const settingsRoutes = require('../modules/settings/settings.routes');
const db = require('../config/db');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/categories', categoriesRoutes);
router.use('/products', productsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/stock', stockRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/customers', customersRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/sales', salesRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
