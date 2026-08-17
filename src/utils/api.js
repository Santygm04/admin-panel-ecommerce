export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const apiUrl = (path = '') => `${API_URL}/${String(path).replace(/^\/+/, '')}`;

export const authHeaders = (extra = {}) => {
  const token = localStorage.getItem('aesthetic:token') || '';
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};
