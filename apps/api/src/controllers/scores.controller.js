import { z } from 'zod';
import * as scoresService from '../services/scores.service.js';

export const submitRunSchema = z.object({
  trackId: z.string().min(1),
  keyEvents: z
    .array(
      z.object({
        type: z.enum(['down', 'up']),
        key: z.enum(['ArrowLeft', 'ArrowRight']),
        atMs: z.number().nonnegative(),
      }),
    )
    .max(2000),
  score: z.number().int().nonnegative().optional(),
});

export async function submitRun(req, res) {
  const { trackId, keyEvents, score } = req.body;
  const run = await scoresService.submitRun({
    userId: req.user.id,
    trackId,
    keyEvents,
    clientScore: score,
  });
  res.status(201).json({ run });
}
