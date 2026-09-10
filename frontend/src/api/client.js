import axios from 'axios';

const ACCESS_KEY = 'madastock_access';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 15000,
  withCredentials: true, // envoie le cookie HttpOnly du refresh token
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token) {
  if (token) localStorage.setItem(ACCESS_KEY, token);
  else localStorage.removeItem(ACCESS_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh automatique : 1 seul vol simultané, pas de boucle sur les routes d'auth.
let refreshPromise = null;

function isAuthPath(url = '') {
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status !== 401 || !original || original._retry || isAuthPath(original.url)) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
      }
      const { data } = await refreshPromise;
      setAccessToken(data.data.accessToken);
      original.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return api(original);
    } catch (e) {
      setAccessToken(null);
      if (window.location.pathname !== '/login') window.location.href = '/login';
      return Promise.reject(e);
    }
  }
);

export default api;
