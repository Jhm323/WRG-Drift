import { z } from 'zod';
import * as scoresService from '../services/scores.service.js';

export const submitRunSchema = z.object({
  trackId: z.string().min(1),
  clickTimestamps: z.array(z.number().nonnegative()).max(2000),
  score: z.number().int().nonnegative().optional(),
});

export async function submitRun(req, res) {
  const { trackId, clickTimestamps, score } = req.body;
  const run = await scoresService.submitRun({
    userId: req.user.id,
    trackId,
    clickTimestamps,
    clientScore: score,
  });
  res.status(201).json({ run });
}
