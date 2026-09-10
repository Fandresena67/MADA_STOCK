const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requireRole, requirePermission } = require('../../middlewares/rbac');
const {
  idParamSchema, paginationSchema, createUserSchema, patchUserSchema, grantPermissionSchema,
} = require('./users.validation');
const controller = require('./users.controller');

const router = express.Router();

// Toutes les routes users : authentifiées + utilisateur frais + tenant.
// Le super_admin est rejeté ici (403) : il utilise /superadmin/* (hors tenant).
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
    if (!result.success) return res.status(400).json({ error: 'Pagination invalide' });
    req.query = result.data;
    return next();
  };
}

router.get('/', requirePermission('users.view'), validateQuery(paginationSchema), controller.list);
router.post('/', requireRole('company_admin', 'super_admin'), requirePermission('users.create'), validate(createUserSchema), controller.create);
router.get('/:id', requirePermission('users.view'), validateParams(idParamSchema), controller.getById);
router.patch('/:id', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), validate(patchUserSchema), controller.patch);
router.delete('/:id', requireRole('company_admin', 'super_admin'), requirePermission('users.delete'), validateParams(idParamSchema), controller.remove);
router.post('/:id/permissions', requireRole('company_admin', 'super_admin'), requirePermission('roles.manage'), validateParams(idParamSchema), validate(grantPermissionSchema), controller.grantPermission);
router.delete('/:id/permissions/:code', requireRole('company_admin', 'super_admin'), requirePermission('roles.manage'), controller.revokePermission);

module.exports = router;
