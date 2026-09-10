const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireRole } = require('../../middlewares/rbac');
const { idParamSchema, patchCompanySchema, companiesQuerySchema, usersQuerySchema, auditQuerySchema } = require('./superadmin.validation');
const { patchUserSchema } = require('../users/users.validation');
const controller = require('./superadmin.controller');
const usersController = require('../users/users.controller');

const router = express.Router();

// Contexte GLOBAL : super_admin uniquement (rôle rechargé en base à chaque requête).
// Aucun scoping tenant ici — par conception, jamais de requireTenant.
router.use(authenticateJWT, attachFreshUser, requireRole('super_admin'));

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

router.get('/dashboard', controller.dashboard);
router.get('/companies', validateQuery(companiesQuerySchema), controller.listCompanies);
router.get('/companies/:id', validateParams(idParamSchema), controller.getCompany);
router.patch('/companies/:id', validateParams(idParamSchema), validate(patchCompanySchema), controller.setCompanyActive);
router.get('/users', validateQuery(usersQuerySchema), controller.listUsers);
router.get('/users/:id', validateParams(idParamSchema), controller.getUser);
// Gestion globale des utilisateurs (rôles, activation) — jamais de super_admin via API.
router.patch('/users/:id', validateParams(idParamSchema), validate(patchUserSchema), usersController.patch);
router.get('/audit', validateQuery(auditQuerySchema), controller.listAudit);

module.exports = router;
