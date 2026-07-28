import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { JWT_COOKIE_NAME } from '../services/auth.service.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[JWT_COOKIE_NAME];
    if (!token) throw new HttpError(401, 'Not authenticated');

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, 'Not authenticated');

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      toneLevel: user.toneLevel,
    };
    next();
  } catch {
    next(new HttpError(401, 'Not authenticated'));
  }
}
