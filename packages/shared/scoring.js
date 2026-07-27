// Pure scoring: given a track and the key-event log for a run,
// deterministically replay it (via drift.js) and return the point value.
// No canvas, no DOM, no wall-clock reads — safe to run identically on the
// client (live feedback, apps/web/src/game/engine.js) and on the server
// (authoritative anti-cheat recomputation, apps/api's scores service).

import { buildTrackIndex, simulateRun } from './drift.js';

// Score is just elapsed survival time, scaled by the track's difficulty
// multiplier. Shared by the live HUD (fed a running survivalMs each frame)
// and computeScore() below (fed the final survivalMs from a full replay).
export function scoreFromSurvivalMs(track, survivalMs) {
  return Math.round(survivalMs * track.pointsMultiplier);
}

// The pure function: (track config, key events) -> final result. Replays
// the run to its natural end (crash), not bounded to "now".
export function computeScore(track, keyEvents) {
  const trackIndex = buildTrackIndex(track);
  const result = simulateRun(track, trackIndex, keyEvents);

  return {
    score: scoreFromSurvivalMs(track, result.survivalMs),
    crashed: result.crashed,
    durationMs: result.survivalMs,
  };
}
