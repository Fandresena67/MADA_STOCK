import api from './client';

export async function listNotifications(params = {}) {
  const { data } = await api.get('/notifications', { params });
  return data; // { data, meta }
}

export async function unreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.data; // { count }
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data.data; // { updated }
}

export async function deleteNotification(id) {
  const { data } = await api.delete(`/notifications/${id}`);
  return data.data; // { ok }
}
