const { getRequestMeta } = require('../../utils/requestMeta');

function makeDocController(service) {
  function metaOf(req) {
    return getRequestMeta(req);
  }
  return {
    async list(req, res, next) {
      try {
        res.json(await service.list(req.authUser.companyId, req.query, req.tierFilterKey));
      } catch (err) {
        next(err);
      }
    },
    async getById(req, res, next) {
      try {
        res.json({ data: await service.getById(req.params.id, req.authUser.companyId) });
      } catch (err) {
        next(err);
      }
    },
    async create(req, res, next) {
      try {
        res.status(201).json({ data: await service.create(req.authUser, req.body, metaOf(req)) });
      } catch (err) {
        next(err);
      }
    },
    async patch(req, res, next) {
      try {
        res.json({ data: await service.patchDraft(req.authUser, req.params.id, req.body, metaOf(req)) });
      } catch (err) {
        next(err);
      }
    },
    async confirm(req, res, next) {
      try {
        res.json({ data: await service.confirm(req.authUser, req.params.id, metaOf(req)) });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { makeDocController };
