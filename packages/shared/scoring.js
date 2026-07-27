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
// the run to its natural end (crash) by default. Pass `{ stopAtMs }` to
// freeze the replay at a specific instant instead — used for a voluntary
// "End run": without it, replaying the log unbounded would keep driving
// the car forward on the last held key past the moment the player clicked
// stop, and could crash (or rack up more score) *after* the point they
// asked to end at.
export function computeScore(track, keyEvents, options = {}) {
  const trackIndex = buildTrackIndex(track);
  const result = simulateRun(track, trackIndex, keyEvents, options);

  return {
    score: scoreFromSurvivalMs(track, result.survivalMs),
    crashed: result.crashed,
    durationMs: result.survivalMs,
  };
}
