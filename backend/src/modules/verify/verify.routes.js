const express = require('express');
const { loginLimiter } = require('../../middlewares/rateLimit');
const controller = require('./verify.controller');

const router = express.Router();

// Route PUBLIQUE (sans JWT) : token non prédictible + rate-limit anti-énumération.
// Le token invalide/malformé retourne 404 générique (aucune distinction).
router.get('/invoice/:token', loginLimiter, controller.verifyInvoice);

module.exports = router;
