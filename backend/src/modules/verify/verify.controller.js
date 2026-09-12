const service = require('./verify.service');

async function verifyInvoice(req, res, next) {
  try {
    res.json({ data: await service.verifyByToken(req.params.token) });
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyInvoice };
