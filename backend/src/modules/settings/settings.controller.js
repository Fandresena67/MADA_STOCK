const service = require('./settings.service');
const { getRequestMeta } = require('../../utils/requestMeta');

async function get(req, res, next) {
  try {
    res.json({ data: await service.get(req.authUser.companyId) });
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    res.json({ data: await service.patch(req.authUser, req.body, getRequestMeta(req)) });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, patch };
