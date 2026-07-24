import { z } from 'zod';
import * as authService from '../services/auth.service.js';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

function setAuthCookie(res, token) {
  res.cookie(authService.JWT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: authService.JWT_MAX_AGE_MS,
  });
}

export async function signup(req, res) {
  const user = await authService.signup(req.body);
  res.status(201).json({ user });
}

export async function verify(req, res) {
  await authService.verifyEmail(String(req.query.token ?? ''));
  res.json({ message: 'Email verified — you can log in now.' });
}

export async function login(req, res) {
  const { token, user } = await authService.login(req.body);
  setAuthCookie(res, token);
  res.json({ user });
}

export function logout(req, res) {
  res.clearCookie(authService.JWT_COOKIE_NAME);
  res.status(204).end();
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}

export async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  res.json({ message: 'Password updated — you can log in now.' });
}

export function me(req, res) {
  res.json({ user: req.user });
}
