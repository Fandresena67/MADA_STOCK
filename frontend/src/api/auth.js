import api from './client';

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data.data;
}

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data.data;
}

export async function refresh() {
  // Le refresh transite par cookie HttpOnly (withCredentials). Pas de body.
  const { data } = await api.post('/auth/refresh');
  return data.data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data.data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data.data;
}
