import { z } from 'zod';
import * as leaderboardService from '../services/leaderboard.service.js';

export const leaderboardQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly']),
  trackId: z.string().min(1).optional(),
});

export async function getLeaderboard(req, res) {
  const { period, trackId } = req.validatedQuery;
  const board = await leaderboardService.computeStandings({ period, trackId });
  res.json(board);
}
