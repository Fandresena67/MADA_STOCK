const service = require('./superadmin.service');
const { getRequestMeta } = require('../../utils/requestMeta');

function metaOf(req) {
  return getRequestMeta(req);
}

async function dashboard(req, res, next) {
  try {
    res.json({ data: await service.dashboard() });
  } catch (err) {
    next(err);
  }
}

async function listCompanies(req, res, next) {
  try {
    res.json(await service.listCompanies({ page: req.query.page, limit: req.query.limit, search: req.query.search }));
  } catch (err) {
    next(err);
  }
}

async function getCompany(req, res, next) {
  try {
    res.json({ data: await service.getCompany(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function setCompanyActive(req, res, next) {
  try {
    const meta = getRequestMeta(req);
    res.json({ data: await service.setCompanyActive(req.authUser, req.params.id, req.body.is_active, meta) });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    res.json(await service.listUsers(req.query));
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    res.json({ data: await service.getUser(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function listAudit(req, res, next) {
  try {
    res.json(await service.listAudit(req.query));
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, listCompanies, getCompany, setCompanyActive, listUsers, getUser, listAudit };
