const service = require('./dashboard.service');
const { normalizePeriod } = require('./dashboard.validation');

async function summary(req, res, next) {
  try {
    res.json({ data: await service.summary(req.authUser.companyId, normalizePeriod(req.query)) });
  } catch (err) {
    next(err);
  }
}

async function trends(req, res, next) {
  try {
    res.json({ data: await service.trends(req.authUser.companyId, normalizePeriod(req.query)) });
  } catch (err) {
    next(err);
  }
}

async function distribution(req, res, next) {
  try {
    res.json({ data: await service.stockDistribution(req.authUser.companyId) });
  } catch (err) {
    next(err);
  }
}

async function topProducts(req, res, next) {
  try {
    res.json({ data: await service.topProducts(req.authUser.companyId, { ...normalizePeriod(req.query), limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
}

async function recentActivity(req, res, next) {
  try {
    res.json({ data: await service.recentActivity(req.authUser.companyId, req.query.limit) });
  } catch (err) {
    next(err);
  }
}

async function alerts(req, res, next) {
  try {
    res.json({ data: await service.alerts(req.authUser.companyId, req.query.limit) });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, trends, distribution, topProducts, recentActivity, alerts };
