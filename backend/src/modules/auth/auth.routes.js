const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser } = require('../../middlewares/rbac');
const { loginLimiter, registerLimiter } = require('../../middlewares/rateLimit');
const { registerSchema, loginSchema, refreshSchema, logoutAllSchema } = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', registerLimiter, validate(registerSchema), controller.register);
router.post('/login', loginLimiter, validate(loginSchema), controller.login);
// Le refresh transite prioritairement par cookie HttpOnly (body accepté en compat).
router.post('/refresh', loginLimiter, validate(refreshSchema), controller.refresh);
router.post('/logout', authenticateJWT, attachFreshUser, controller.logout);
router.post('/logout-all', loginLimiter, authenticateJWT, attachFreshUser, validate(logoutAllSchema), controller.logoutAll);
router.get('/me', authenticateJWT, controller.me);

module.exports = router;
