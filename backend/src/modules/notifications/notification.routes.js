const express = require('express');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser } = require('../../middlewares/rbac');
const controller = require('./notification.controller');
const { idParamSchema, listQuerySchema } = require('./notification.validation');

const router = express.Router();

// Espace connecté : pas de requireTenant (super_admin → personnelles uniquement, via portée NULL).
router.use(authenticateJWT, attachFreshUser);

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

// Ordre : routes fixes AVANT /:id.
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.get('/', validateQuery(listQuerySchema), controller.list);
router.patch('/:id/read', validateParams(idParamSchema), controller.markAsRead);
router.delete('/:id', validateParams(idParamSchema), controller.remove);

module.exports = router;
