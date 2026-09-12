const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser, requireTenant, requirePermission } = require('../../middlewares/rbac');
const { idParamSchema, listQuerySchema, productBodySchema, productPatchSchema } = require('./products.validation');
const { singleImageUpload } = require('../uploads/imageUpload');
const controller = require('./products.controller');

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

router.get('/', requirePermission('products.view'), validateQuery(listQuerySchema), controller.list);
router.post('/', requirePermission('products.create'), validate(productBodySchema), controller.create);
router.get('/:id/stats', requirePermission('products.view'), validateParams(idParamSchema), controller.stats);
router.get('/:id', requirePermission('products.view'), validateParams(idParamSchema), controller.getById);
router.patch('/:id', requirePermission('products.update'), validateParams(idParamSchema), validate(productPatchSchema), controller.patch);
router.delete('/:id', requirePermission('products.delete'), validateParams(idParamSchema), controller.remove);
router.patch('/:id/image', requirePermission('products.update'), validateParams(idParamSchema), singleImageUpload('image'), controller.setImage);
router.delete('/:id/image', requirePermission('products.update'), validateParams(idParamSchema), controller.removeImage);

module.exports = router;
