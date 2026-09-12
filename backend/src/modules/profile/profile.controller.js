const profileService = require('./profile.service');
const { getRequestMeta } = require('../../utils/requestMeta');

async function updateAvatar(req, res, next) {
  try {
    // Toujours l'utilisateur authentifié (req.authUser, rechargé en DB) : aucun userId client.
    const result = await profileService.updateAvatar(req.authUser.id, req.file, getRequestMeta(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function removeAvatar(req, res, next) {
  try {
    const result = await profileService.removeAvatar(req.authUser.id, getRequestMeta(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function updateName(req, res, next) {
  try {
    // Toujours l'utilisateur authentifié : aucun userId client.
    const result = await profileService.updateName(req.authUser.id, req.body.name, getRequestMeta(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { updateAvatar, removeAvatar, updateName };
