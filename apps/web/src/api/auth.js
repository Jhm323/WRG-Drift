import { apiFetch } from './client.js';

export function signup({ email, password, displayName, avatarUrl }) {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, avatarUrl }),
  });
}

export function login({ email, password }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export function fetchCurrentUser() {
  return apiFetch('/auth/me');
}

export function forgotPassword({ email }) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword({ token, newPassword }) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
