import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/signup', validateBody(authController.signupSchema), authController.signup);
authRouter.get('/verify', authController.verify);
authRouter.post('/login', validateBody(authController.loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.post(
  '/forgot-password',
  validateBody(authController.forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  validateBody(authController.resetPasswordSchema),
  authController.resetPassword,
);
authRouter.get('/me', requireAuth, authController.me);
