import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const DIRTCAR_DOMAIN = '@dirtcar.com';
const PASSWORD_HASH_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// TEMP: email verification disabled — blocked on dirtcar.com DNS access, see [ticket/note].
// Remove when SKIP_EMAIL_VERIFICATION is no longer needed.
const SKIP_EMAIL_VERIFICATION = process.env.SKIP_EMAIL_VERIFICATION === 'true';

export const JWT_COOKIE_NAME = 'token';
export const JWT_EXPIRY = '30d';
export const JWT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function assertDirtcarEmail(email) {
  if (!email.toLowerCase().endsWith(DIRTCAR_DOMAIN)) {
    throw new HttpError(400, `Email must be a ${DIRTCAR_DOMAIN} address`);
  }
}

export async function signup({ email, password, displayName, avatarUrl }) {
  assertDirtcarEmail(email);

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName,
        avatarUrl,
        verificationToken,
        // TEMP: email verification disabled — blocked on dirtcar.com DNS access, see [ticket/note].
        // Remove when SKIP_EMAIL_VERIFICATION is no longer needed.
        emailVerified: SKIP_EMAIL_VERIFICATION,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'An account with that email already exists');
    }
    throw error;
  }

  // The account already exists at this point regardless of what happens
  // next. Letting a send failure here throw would produce a bare 500 that
  // misrepresents a partially-successful signup as a total failure — the
  // account is real, but the client would have no way to know that: a retry
  // 409s ("already exists"), and without /auth/resend-verification below,
  // there'd be no way to ever get a working link. Report the failure via the
  // response instead, so the client can point the user at the resend flow.
  let emailSendFailed = false;
  try {
    await sendVerificationEmail({ to: user.email, token: verificationToken });
  } catch (error) {
    console.error(`[signup] verification email failed to send for ${user.email}`, error);
    emailSendFailed = true;
  }

  return { id: user.id, email: user.email, displayName: user.displayName, emailSendFailed };
}

// Never reveal whether an email has an account, or whether that account is
// already verified — same non-leaking pattern as requestPasswordReset below.
// Rotates the token (rather than reusing whatever was generated at signup)
// so an old link that already failed to send, or was never opened, isn't
// the only one that will ever work.
export async function resendVerificationEmail(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.emailVerified) return;

  const verificationToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({ where: { id: user.id }, data: { verificationToken } });

  await sendVerificationEmail({ to: user.email, token: verificationToken });
}

export async function verifyEmail(token) {
  const user = token ? await prisma.user.findUnique({ where: { verificationToken: token } }) : null;
  if (!user) {
    throw new HttpError(400, 'Invalid or expired verification link');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  });
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  // TEMP: email verification disabled — blocked on dirtcar.com DNS access, see [ticket/note].
  // Remove when SKIP_EMAIL_VERIFICATION is no longer needed.
  if (!SKIP_EMAIL_VERIFICATION && !user.emailVerified) {
    throw new HttpError(403, 'Please verify your email before logging in');
  }

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      toneLevel: user.toneLevel,
    },
  };
}

// displayName/avatarUrl/toneLevel only — email is never accepted here (see
// updateProfileSchema), so there's no lookup/uniqueness concern like signup
// has. Returns the same shape requireAuth puts on req.user, since that's
// what the frontend replaces its cached user with on save.
export async function updateProfile(userId, { displayName, avatarUrl, toneLevel }) {
  const data = {};
  if (displayName !== undefined) data.displayName = displayName;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
  if (toneLevel !== undefined) data.toneLevel = toneLevel;

  const user = await prisma.user.update({ where: { id: userId }, data });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    toneLevel: user.toneLevel,
  };
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Resolve silently either way so this endpoint can't be used to test which emails have accounts.
  if (!user) return;

  const passwordResetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken, passwordResetExpiresAt },
  });

  await sendPasswordResetEmail({ to: user.email, token: passwordResetToken });
}

export async function resetPassword({ token, newPassword }) {
  const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw new HttpError(400, 'Invalid or expired reset link');
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
  });
}
