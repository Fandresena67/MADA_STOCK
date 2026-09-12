const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser } = require('../../middlewares/rbac');
const { loginLimiter, registerLimiter } = require('../../middlewares/rateLimit');
const { registerSchema, loginSchema, refreshSchema, logoutAllSchema, changePasswordSchema, sessionIdParamSchema } = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return res.status(400).json({ error: 'Paramètre invalide' });
    req.params = result.data;
    return next();
  };
}

router.post('/register', registerLimiter, validate(registerSchema), controller.register);
router.post('/login', loginLimiter, validate(loginSchema), controller.login);
// Le refresh transite prioritairement par cookie HttpOnly (body accepté en compat).
router.post('/refresh', loginLimiter, validate(refreshSchema), controller.refresh);
router.post('/logout', authenticateJWT, attachFreshUser, controller.logout);
router.post('/logout-all', loginLimiter, authenticateJWT, attachFreshUser, validate(logoutAllSchema), controller.logoutAll);
router.get('/me', authenticateJWT, controller.me);
// Mot de passe : limiter strict anti brute-force du mot de passe actuel.
router.patch('/password', loginLimiter, authenticateJWT, attachFreshUser, validate(changePasswordSchema), controller.changePassword);
router.get('/sessions', authenticateJWT, attachFreshUser, controller.listSessions);
router.delete('/sessions/:id', authenticateJWT, attachFreshUser, validateParams(sessionIdParamSchema), controller.revokeSession);

module.exports = router;
