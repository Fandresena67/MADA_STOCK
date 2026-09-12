const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requireRole, requirePermission } = require('../../middlewares/rbac');
const {
  idParamSchema, usersQuerySchema, createUserSchema, patchUserSchema, statusSchema,
  grantPermissionSchema, setPermissionsSchema, adminPasswordSchema,
} = require('./users.validation');
const { singleImageUpload } = require('../uploads/imageUpload');
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

router.get('/', requirePermission('users.view'), validateQuery(usersQuerySchema), controller.list);
router.post('/', requireRole('company_admin', 'super_admin'), requirePermission('users.create'), validate(createUserSchema), controller.create);
router.get('/:id', requirePermission('users.view'), validateParams(idParamSchema), controller.getById);
router.patch('/:id', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), validate(patchUserSchema), controller.patch);
// Alias explicite activation / désactivation (mêmes garde-fous, dont anti auto-désactivation).
router.patch('/:id/status', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), validate(statusSchema), controller.setStatus);
// Reset administratif : jamais l'ancien mot de passe, sessions révoquées.
router.patch('/:id/password', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), validate(adminPasswordSchema), controller.adminResetPassword);
// Permissions : lecture + remplacement complet (bulk). Unitaires conservées (non-régression).
router.get('/:id/permissions', requirePermission('roles.view'), validateParams(idParamSchema), controller.getPermissions);
router.put('/:id/permissions', requireRole('company_admin', 'super_admin'), requirePermission('roles.manage'), validateParams(idParamSchema), validate(setPermissionsSchema), controller.setPermissions);
router.delete('/:id', requireRole('company_admin', 'super_admin'), requirePermission('users.delete'), validateParams(idParamSchema), controller.remove);
router.post('/:id/permissions', requireRole('company_admin', 'super_admin'), requirePermission('roles.manage'), validateParams(idParamSchema), validate(grantPermissionSchema), controller.grantPermission);
router.delete('/:id/permissions/:code', requireRole('company_admin', 'super_admin'), requirePermission('roles.manage'), controller.revokePermission);
// Sessions d'un employé vues par l'admin (révocation via POST /auth/logout-all { userId } existant).
router.get('/:id/sessions', requireRole('company_admin', 'super_admin'), requirePermission('users.view'), validateParams(idParamSchema), controller.listSessions);
// Avatar d'un employé posé par l'admin (même helper sécurisé que le profil).
router.patch('/:id/avatar', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), singleImageUpload('avatar'), controller.setAvatar);
router.delete('/:id/avatar', requireRole('company_admin', 'super_admin'), requirePermission('users.update'), validateParams(idParamSchema), controller.removeAvatar);

module.exports = router;
