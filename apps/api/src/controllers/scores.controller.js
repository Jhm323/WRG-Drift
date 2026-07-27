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
  // Client's own elapsed-time bound at the moment the run ended (crash or
  // voluntary "End run") — see scores.service.js for why the server needs
  // this to replay a voluntary end correctly instead of continuing the
  // recorded input past the point the player actually stopped.
  stopAtMs: z.number().nonnegative().optional(),
});

export async function submitRun(req, res) {
  const { trackId, keyEvents, score, stopAtMs } = req.body;
  const run = await scoresService.submitRun({
    userId: req.user.id,
    trackId,
    keyEvents,
    clientScore: score,
    stopAtMs,
  });
  res.status(201).json({ run });
}
