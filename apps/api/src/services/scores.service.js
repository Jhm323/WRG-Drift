import crypto from 'node:crypto';
import { computeScore } from '@dirtcar-drift/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';

// How far a client-reported score may drift from the server's own
// recomputation before it's treated as tampering (or a client/server logic
// mismatch) rather than rounding noise. The simulation is fully
// deterministic, so a legitimate client should land on exactly the same
// number — this is a safety margin, not an expected gap.
const SCORE_TOLERANCE = 5;

function serverChecksumFor({ userId, trackId, score, durationMs }) {
  return crypto
    .createHmac('sha256', process.env.SCORE_HMAC_SECRET)
    .update(`${userId}:${trackId}:${score}:${durationMs}`)
    .digest('hex');
}

// Never trust a score sent raw from the client (build plan §7). The client
// only supplies the track it played and the raw click timestamps; this
// replays that input through the exact same shared scoring function the
// client used for live feedback, and persists *that* result — the
// client-reported score (if any) is only used as a tamper check.
export async function submitRun({ userId, trackId, clickTimestamps, clientScore }) {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) {
    throw new HttpError(404, 'Unknown track');
  }

  const trackForScoring = {
    pointsMultiplier: track.pointsMultiplier,
    gates: track.config.gates,
    curve: track.config.curve,
  };

  const authoritative = computeScore(trackForScoring, clickTimestamps);

  if (
    typeof clientScore === 'number' &&
    Math.abs(authoritative.score - clientScore) > SCORE_TOLERANCE
  ) {
    throw new HttpError(400, 'Submitted score does not match the recomputed result');
  }

  const serverChecksum = serverChecksumFor({
    userId,
    trackId,
    score: authoritative.score,
    durationMs: authoritative.durationMs,
  });

  return prisma.run.create({
    data: {
      userId,
      trackId,
      score: authoritative.score,
      gatesCleared: authoritative.gatesCleared,
      crashed: authoritative.crashed,
      durationMs: authoritative.durationMs,
      serverChecksum,
    },
  });
}
