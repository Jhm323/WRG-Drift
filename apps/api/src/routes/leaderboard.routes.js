import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateQuery } from '../middleware/validate.middleware.js';
import * as leaderboardController from '../controllers/leaderboard.controller.js';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  requireAuth,
  validateQuery(leaderboardController.leaderboardQuerySchema),
  leaderboardController.getLeaderboard,
);
