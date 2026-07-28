import { z } from 'zod';
import * as authService from '../services/auth.service.js';

// Shared with updateProfileSchema below so profile edits enforce the exact
// same constraints as signup, rather than a second, possibly-drifting rule.
const displayNameSchema = z.string().min(1).max(50);
const avatarUrlSchema = z.string().min(1);
// Mirrors apps/web/src/content/messages.js's TONE_LEVELS and the Prisma
// ToneLevel enum — kept in sync by hand across the workspace boundary.
const toneLevelSchema = z.enum(['professional', 'knightly', 'hypeMan', 'heckler', 'outlaw']);

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: displayNameSchema,
  avatarUrl: avatarUrlSchema,
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

// No email field on purpose — email stays fixed to what was verified at
// signup (the @dirtcar.com + one-account-per-email design). All fields
// are optional individually (PATCH semantics), but at least one must be
// present, or there's nothing to update.
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    avatarUrl: avatarUrlSchema.optional(),
    toneLevel: toneLevelSchema.optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined || data.avatarUrl !== undefined || data.toneLevel !== undefined,
    { message: 'At least one of displayName, avatarUrl, or toneLevel is required' },
  );

// Dev: frontend and API are same-site (Vite proxies /auth to the API), so
// Lax + non-Secure works over plain HTTP. Production: Vercel (frontend) and
// Render (API) are genuinely cross-origin — Lax cookies are never sent on
// cross-site fetch/XHR, only top-level navigation, which would silently
// break every authenticated request after login. None + Secure is required
// for a cross-origin cookie to be sent at all, and None requires Secure
// (HTTPS, which both platforms provide).
function authCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  };
}

function setAuthCookie(res, token) {
  res.cookie(authService.JWT_COOKIE_NAME, token, {
    ...authCookieOptions(),
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
  // clearCookie must be called with matching attributes to the cookie that
  // was set, or some browsers won't recognize it as the same cookie.
  res.clearCookie(authService.JWT_COOKIE_NAME, authCookieOptions());
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

export async function updateProfile(req, res) {
  const user = await authService.updateProfile(req.user.id, req.body);
  res.json({ user });
}
