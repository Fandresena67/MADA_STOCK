const service = require('./inventory.service');

async function summary(req, res, next) {
  try {
    res.json({ data: await service.summary(req.authUser.companyId) });
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

async function alerts(req, res, next) {
  try {
    res.json(await service.alerts(req.authUser.companyId, req.query));
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, list, alerts };
