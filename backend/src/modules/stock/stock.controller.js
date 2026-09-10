const service = require('./stock.service');
const { getRequestMeta } = require('../../utils/requestMeta');

function metaOf(req) {
  return getRequestMeta(req);
}

async function createEntry(req, res, next) {
  try {
    const result = await service.createEntry(req.authUser, req.body, metaOf(req));
    res.status(result.deduplicated ? 200 : 201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function createExit(req, res, next) {
  try {
    const result = await service.createExit(req.authUser, req.body, metaOf(req));
    res.status(result.deduplicated ? 200 : 201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function createAdjustment(req, res, next) {
  try {
    const result = await service.createAdjustment(req.authUser, req.body, metaOf(req));
    res.status(result.deduplicated ? 200 : 201).json({ data: result });
  } catch (err) {
    next(err);
  }
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

module.exports = { createEntry, createExit, createAdjustment, list, getById };
