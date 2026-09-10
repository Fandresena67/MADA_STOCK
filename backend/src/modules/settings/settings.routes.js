const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requireRole, requirePermission } = require('../../middlewares/rbac');
const { settingsPatchSchema } = require('./settings.validation');
const controller = require('./settings.controller');

const router = express.Router();

router.use(authenticateJWT, attachFreshUser, requireTenant);

// Lecture : employé avec settings.view (affichage interface si nécessaire).
router.get('/', requirePermission('settings.view'), controller.get);
// Modification : company_admin uniquement (+ permission).
router.patch('/', requireRole('company_admin'), requirePermission('settings.update'), validate(settingsPatchSchema), controller.patch);

module.exports = router;
