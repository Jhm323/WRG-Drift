// Pure scoring: given a track and the raw click timestamps for a run,
// deterministically replay it (via drift.js) and return the point value.
// No canvas, no DOM, no wall-clock reads — safe to run identically on the
// client (live feedback, apps/web/src/game/engine.js) and on the server
// (authoritative anti-cheat recomputation, apps/api's scores service —
// see build plan §7).

import { buildTrackIndex, simulateRun } from './drift.js';

const BASE_POINTS_PER_GATE = 100;
const ANGLE_BONUS_MAX = 50;
const IDEAL_DRIFT_ANGLE_DEG = 25; // a stylish, not head-on, pass through the gate
const DRIFT_ANGLE_TOLERANCE_DEG = 35;
const COMBO_STEP = 0.1;
const COMBO_CAP = 2.0;

function angleBonusFor(driftAngleDeg) {
  const error = Math.abs(Math.abs(driftAngleDeg) - IDEAL_DRIFT_ANGLE_DEG);
  const fraction = Math.max(0, 1 - error / DRIFT_ANGLE_TOLERANCE_DEG);
  return ANGLE_BONUS_MAX * fraction;
}

// Turns a simulation's gate events into a score. Split out from
// computeScore() so the live in-game HUD can re-score the gates cleared
// so far every frame without re-running the whole simulation's scoring math
// by hand.
export function scoreFromGateEvents(track, gateEvents) {
  let score = 0;
  let combo = 1;
  let gatesCleared = 0;

  for (const event of gateEvents) {
    if (event.cleared) {
      gatesCleared += 1;
      const base = BASE_POINTS_PER_GATE + angleBonusFor(event.driftAngleDeg);
      score += base * combo * track.pointsMultiplier;
      combo = Math.min(COMBO_CAP, combo + COMBO_STEP);
    } else {
      combo = 1;
    }
  }

  return { score: Math.round(score), gatesCleared };
}

// The pure function: (track config, click timestamps) -> final result.
// Replays the run to its natural end (crash or finish), not bounded to "now".
export function computeScore(track, clickTimestampsMs) {
  const trackIndex = buildTrackIndex(track);
  const result = simulateRun(track, trackIndex, clickTimestampsMs);
  const { score, gatesCleared } = scoreFromGateEvents(track, result.gateEvents);

  return {
    score,
    gatesCleared,
    gatesTotal: result.gatesTotal,
    crashed: result.crashed,
    durationMs: result.crashedAtMs ?? result.finishedAtMs ?? result.elapsedMs,
  };
}
