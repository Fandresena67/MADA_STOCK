const service = require('./products.service');
const { getRequestMeta } = require('../../utils/requestMeta');

function metaOf(req) {
  return getRequestMeta(req);
}

async function list(req, res, next) {
  try {
    res.json(await service.list(req.authUser.companyId, req.query));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    res.json({ data: await service.getById(req.params.id, req.authUser.companyId) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    res.status(201).json({ data: await service.create(req.authUser, req.body, metaOf(req)) });
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    res.json({ data: await service.patch(req.authUser, req.params.id, req.body, metaOf(req)) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    res.json({ data: await service.remove(req.authUser, req.params.id, metaOf(req)) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, patch, remove };
