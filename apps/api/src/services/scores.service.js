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
// only supplies the track it played and the raw ArrowLeft/ArrowRight
// press/release log; this replays that input through the exact same
// shared scoring function the client used for live feedback, and persists
// *that* result — the client-reported score (if any) is only used as a
// tamper check.
//
// `stopAtMs` bounds that replay to the same instant the client's own run
// ended (crash or voluntary "End run" — engine.js's finish() sends this
// alongside keyEvents for both). Without it, a run that ended voluntarily
// (not via a crash) would replay unbounded here, continuing to drive the
// last held key forward well past the moment the player actually stopped —
// producing a different score than what they saw and submitted, and very
// likely failing the tolerance check below. For a crash, bounding at
// `stopAtMs` changes nothing: the crash already happened at or before that
// point, so the replay still halts at the exact same instant.
export async function submitRun({ userId, trackId, keyEvents, clientScore, stopAtMs }) {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) {
    throw new HttpError(404, 'Unknown track');
  }

  const trackForScoring = {
    pointsMultiplier: track.pointsMultiplier,
    curve: track.config.curve,
    ribbonWidth: track.config.ribbonWidth,
    wrapAtEnd: track.config.wrapAtEnd,
  };

  const authoritative = computeScore(
    trackForScoring,
    keyEvents,
    typeof stopAtMs === 'number' ? { stopAtMs } : {},
  );

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

  // Personal-best check, against this user's prior runs on this track only
  // (any outcome, not just clean ones — a higher score is a higher score
  // regardless of how the run ended). Queried before the insert below so
  // the just-created run itself is never compared against; a tie doesn't
  // count as a new best, only strictly exceeding the prior max does.
  const priorBest = await prisma.run.aggregate({
    where: { userId, trackId },
    _max: { score: true },
  });
  const isPersonalBest =
    priorBest._max.score == null || authoritative.score > priorBest._max.score;

  const run = await prisma.run.create({
    data: {
      userId,
      trackId,
      score: authoritative.score,
      crashed: authoritative.crashed,
      durationMs: authoritative.durationMs,
      serverChecksum,
    },
  });

  return { run, isPersonalBest };
}
