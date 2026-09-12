const notificationService = require('./notification.service');
const { getRequestMeta } = require('../../utils/requestMeta');

function actorOf(req) {
  // Identité serveur uniquement (JWT rechargé) : company_id/user_id jamais lus du client.
  return { id: req.authUser.id, companyId: req.authUser.companyId ?? null };
}

async function list(req, res, next) {
  try {
    const a = actorOf(req);
    const result = await notificationService.list(a.companyId, a.id, {
      page: req.query.page,
      limit: req.query.limit,
      unread: req.query.unread,
      type: req.query.type,
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const a = actorOf(req);
    res.json({ data: await notificationService.countUnread(a.companyId, a.id) });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const a = actorOf(req);
    res.json({ data: await notificationService.markAsRead(a.companyId, a.id, Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const a = actorOf(req);
    res.json({ data: await notificationService.markAllAsRead(a.companyId, a.id) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await notificationService.removeNotification(actorOf(req), Number(req.params.id), getRequestMeta(req));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, unreadCount, markAsRead, markAllAsRead, remove };
