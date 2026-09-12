const usersService = require('./users.service');
const { getRequestMeta } = require('../../utils/requestMeta');

function metaOf(req) {
  return getRequestMeta(req);
}

async function list(req, res, next) {
  try {
    const result = await usersService.list(req.authUser.companyId, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      role: req.query.role,
      status: req.query.status,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await usersService.getById(req.params.id, req.authUser.companyId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await usersService.create(req.authUser, req.body, metaOf(req));
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    const result = await usersService.patch(req.authUser, req.params.id, req.body, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await usersService.remove(req.authUser, req.params.id, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function grantPermission(req, res, next) {
  try {
    const result = await usersService.grantPermission(req.authUser, req.params.id, req.body.permission, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function revokePermission(req, res, next) {
  try {
    const result = await usersService.revokePermission(req.authUser, req.params.id, req.params.code, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function getPermissions(req, res, next) {
  try {
    const result = await usersService.getPermissions(req.params.id, req.authUser.companyId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function setPermissions(req, res, next) {
  try {
    const result = await usersService.setPermissions(req.authUser, req.params.id, req.body.permissions, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function setStatus(req, res, next) {
  try {
    const result = await usersService.patch(req.authUser, req.params.id, { is_active: req.body.is_active }, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function adminResetPassword(req, res, next) {
  try {
    const result = await usersService.adminResetPassword(req.authUser, req.params.id, req.body, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const result = await usersService.listEmployeeSessions(req.authUser, req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function setAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune photo fournie.' });
    const result = await usersService.setEmployeeAvatar(req.authUser, req.params.id, req.file, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function removeAvatar(req, res, next) {
  try {
    const result = await usersService.removeEmployeeAvatar(req.authUser, req.params.id, metaOf(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, patch, remove, grantPermission, revokePermission, getPermissions, setPermissions, setStatus, adminResetPassword, listSessions, setAvatar, removeAvatar };
