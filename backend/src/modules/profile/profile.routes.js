const express = require('express');
const { validate } = require('../../middlewares/validate');
const { authenticateJWT } = require('../../middlewares/auth');
const { attachFreshUser } = require('../../middlewares/rbac');
const { updateNameSchema } = require('./profile.validation');
const controller = require('./profile.controller');
const { singleImageUpload } = require('../uploads/imageUpload');

const router = express.Router();

// Profil propre : tout utilisateur actif authentifié (y compris super_admin, sans tenant requis).
router.use(authenticateJWT, attachFreshUser);
router.patch('/', validate(updateNameSchema), controller.updateName);
router.patch('/avatar', singleImageUpload('avatar'), controller.updateAvatar);
router.delete('/avatar', controller.removeAvatar);

module.exports = router;
