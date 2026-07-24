import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimitScoreSubmission } from '../middleware/rateLimit.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import * as scoresController from '../controllers/scores.controller.js';

export const scoresRouter = Router();

scoresRouter.post(
  '/',
  requireAuth,
  rateLimitScoreSubmission,
  validateBody(scoresController.submitRunSchema),
  scoresController.submitRun,
);
