const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { idParamSchema, paginationSchema, categoryBodySchema, categoryPatchSchema } = require('./categories.validation');
const controller = require('./categories.controller');

const router = express.Router();

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
    if (!result.success) return res.status(400).json({ error: 'Paramètres de recherche invalides' });
    req.query = result.data;
    return next();
  };
}

router.get('/', requirePermission('categories.view'), validateQuery(paginationSchema), controller.list);
router.post('/', requirePermission('categories.create'), validate(categoryBodySchema), controller.create);
router.get('/:id', requirePermission('categories.view'), validateParams(idParamSchema), controller.getById);
router.patch('/:id', requirePermission('categories.update'), validateParams(idParamSchema), validate(categoryPatchSchema), controller.patch);
router.delete('/:id', requirePermission('categories.delete'), validateParams(idParamSchema), controller.remove);

module.exports = router;
