const authService = require('./auth.service');
const { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } = require('../../utils/cookies');
const { getRequestMeta } = require('../../utils/requestMeta');

function metaOf(req) {
  return getRequestMeta(req);
}

function refreshRawOf(req) {
  return req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken || null;
}

async function register(req, res, next) {
  try {
    const { companyName, name, email, password } = req.body;
    const result = await authService.register({ companyName, name, email, password }, metaOf(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password }, metaOf(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(refreshRawOf(req), metaOf(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const result = await authService.logout(refreshRawOf(req), req.authUser?.id ?? req.user?.id, metaOf(req));
    clearRefreshCookie(res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    const targetId = req.body?.userId ?? req.authUser.id;
    const result = await authService.logoutAll(targetId, req.authUser, metaOf(req));
    if (targetId === req.authUser.id) clearRefreshCookie(res);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await authService.me(req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, logoutAll, me };
