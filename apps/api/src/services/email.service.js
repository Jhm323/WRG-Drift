import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
console.log(`[email:init] RESEND_API_KEY present: ${!!process.env.RESEND_API_KEY}`);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'DirtCar Drift <onboarding@resend.dev>';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:5173';

async function send({ to, subject, html }) {
  if (!resend) {
    console.log(
      `[email:dev] RESEND_API_KEY not set — logging instead of sending.\nTo: ${to}\nSubject: ${subject}\n${html}`,
    );
    return;
  }
  let response;
  try {
    response = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.log(`[email:failed] to=${to} error=${error.message}`, error);
    throw error;
  }

  if (response?.error) {
    console.log(`[email:failed] to=${to} error=${response.error.message}`, response.error);
    throw new Error(response.error.message);
  }

  console.log(`[email:sent] to=${to} subject=${subject} id=${response?.data?.id}`);
}

export async function sendVerificationEmail({ to, token }) {
  const link = `${API_BASE_URL}/auth/verify?token=${token}`;
  await send({
    to,
    subject: 'Verify your DirtCar Drift account',
    html: `<p>Welcome to DirtCar Drift! Click below to verify your email:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const link = `${WEB_BASE_URL}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your DirtCar Drift password',
    html: `<p>Click below to reset your password. This link expires in 1 hour.</p><p><a href="${link}">${link}</a></p>`,
  });
}
