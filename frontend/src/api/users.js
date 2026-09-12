import api from './client';
import { resolveAssetUrl } from './client';

/** URL affichable de l'avatar d'un membre (null si aucun → initiales). */
export function userAvatarSrc(avatarUrl) {
  return resolveAssetUrl(avatarUrl);
}

export async function listUsers(params = {}) {
  const { data } = await api.get('/users', { params });
  return data; // { data: [...], meta: { page, limit, total, totalPages } }
}

export async function getUser(id) {
  const { data } = await api.get(`/users/${id}`);
  return data.data;
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload);
  return data.data;
}

export async function patchUser(id, payload) {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data.data;
}

export async function setUserStatus(id, isActive) {
  const { data } = await api.patch(`/users/${id}/status`, { is_active: isActive });
  return data.data;
}

export async function getUserPermissions(id) {
  const { data } = await api.get(`/users/${id}/permissions`);
  return data.data; // { role, implicit, permissions }
}

export async function setUserPermissions(id, permissions) {
  const { data } = await api.put(`/users/${id}/permissions`, { permissions });
  return data.data; // { ok, permissions, added, removed }
}

export async function adminResetPassword(id, payload) {
  const { data } = await api.patch(`/users/${id}/password`, payload);
  return data.data; // { ok, revokedSessions }
}

export async function listUserSessions(id) {
  const { data } = await api.get(`/users/${id}/sessions`);
  return data.data; // [{ id, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt }]
}

/** Révoque TOUTES les sessions d'un employé (réutilise POST /auth/logout-all existant). */
export async function revokeUserSessions(id) {
  const { data } = await api.post('/auth/logout-all', { userId: id });
  return data.data; // { ok, revokedSessions }
}

export async function uploadUserAvatar(id, file) {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await api.patch(`/users/${id}/avatar`, form);
  return data.data; // { avatarUrl }
}

export async function deleteUserAvatar(id) {
  const { data } = await api.delete(`/users/${id}/avatar`);
  return data.data; // { avatarUrl: null }
}
