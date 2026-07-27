// Deterministic keyboard-drift physics + simulation. Pure functions only —
// no wall-clock reads, no randomness — so a run can be replayed exactly
// from (track, keyEvents) alone. That's what makes scoring.js's
// computeScore() safe to run server-side as the anti-cheat authority: same
// inputs, same output, every time.

export const BASE_SPEED_PX_PER_S = 160;
// Turning has drag, not an instant snap: angular velocity ramps toward
// MAX_TURN_RATE_RAD_PER_S while a direction key is held (both held cancels
// out, targeting 0) and bleeds off toward 0 at TURN_DECAY_RAD_PER_S2 once
// released — so the car keeps drifting briefly after letting go instead of
// immediately going straight. Retune these three per playtest.
export const MAX_TURN_RATE_RAD_PER_S = Math.PI / 2; // ceiling on angular velocity — 90deg/s, same top-end as the old instant-turn version
export const TURN_RAMP_UP_RAD_PER_S2 = Math.PI * 2.5; // ~0.2s from 0 to max while held
export const TURN_DECAY_RAD_PER_S2 = Math.PI * 1.25; // ~0.4s to bleed off residual angular velocity after release
export const FIXED_DT_MS = 10;
const MAX_STEPS = 30000; // ~5 min of simulated time — safety cap, not a game limit

// Shortest distance from `point` to the track's centerline polyline.
function distanceToCurve(curve, point) {
  let best = Infinity;
  for (let i = 0; i < curve.length - 1; i += 1) {
    const p0 = curve[i];
    const p1 = curve[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((point.x - p0.x) * dx + (point.y - p0.y) * dy) / lenSq;
    t = Math.min(Math.max(t, 0), 1);
    const projX = p0.x + dx * t;
    const projY = p0.y + dy * t;
    const dist = Math.hypot(point.x - projX, point.y - projY);
    if (dist < best) best = dist;
  }
  return best;
}

// Precomputed once per track (cheap to cache — the curve never changes;
// kept as its own step so engine.js's contract stays "index once, simulate
// every frame" regardless of how heavy indexing gets per track shape).
export function buildTrackIndex(track) {
  return { curve: track.curve, ribbonWidth: track.ribbonWidth };
}

// Replays keyEvents — chronological { type: 'down' | 'up', key: 'ArrowLeft'
// | 'ArrowRight', atMs } transitions — from a standing start at the track's
// first curve point. The car sits still (timer included) until the first
// event, then drives forward forever at a constant speed. Turning has drag:
// angular velocity ramps toward the max rate while a direction key is held
// (both held targets 0, i.e. cancels out) and decays back toward 0 once
// released, rather than snapping straight to a fixed rate. Ends the instant
// the car strays outside the track ribbon, or at `stopAtMs`, whichever
// comes first.
export function simulateRun(track, trackIndex, keyEvents, options = {}) {
  const stopAtMs = options.stopAtMs ?? Infinity;
  const { curve, ribbonWidth } = trackIndex;
  const events = [...keyEvents].sort((a, b) => a.atMs - b.atMs);

  const p0 = curve[0];
  const p1 = curve[1] ?? curve[0];
  let heading = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  let x = p0.x;
  let y = p0.y;

  let leftHeld = false;
  let rightHeld = false;
  let angularVelocity = 0; // rad/s, signed — positive turns right
  let started = false;
  let startedAtMs = null;
  let eventCursor = 0;
  let crashed = false;
  let crashedAtMs = null;

  let tMs = 0;
  let steps = 0;

  while (tMs <= stopAtMs && !crashed && steps < MAX_STEPS) {
    steps += 1;

    while (eventCursor < events.length && events[eventCursor].atMs <= tMs) {
      const event = events[eventCursor];
      eventCursor += 1;
      if (!started) {
        started = true;
        startedAtMs = event.atMs;
      }
      const held = event.type === 'down';
      if (event.key === 'ArrowLeft') leftHeld = held;
      else if (event.key === 'ArrowRight') rightHeld = held;
    }

    if (!started) {
      tMs += FIXED_DT_MS;
      continue;
    }

    const dtSec = FIXED_DT_MS / 1000;
    const turnInput = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    if (turnInput !== 0) {
      const targetRate = turnInput * MAX_TURN_RATE_RAD_PER_S;
      if (angularVelocity < targetRate) {
        angularVelocity = Math.min(targetRate, angularVelocity + TURN_RAMP_UP_RAD_PER_S2 * dtSec);
      } else if (angularVelocity > targetRate) {
        angularVelocity = Math.max(targetRate, angularVelocity - TURN_RAMP_UP_RAD_PER_S2 * dtSec);
      }
    } else if (angularVelocity > 0) {
      angularVelocity = Math.max(0, angularVelocity - TURN_DECAY_RAD_PER_S2 * dtSec);
    } else if (angularVelocity < 0) {
      angularVelocity = Math.min(0, angularVelocity + TURN_DECAY_RAD_PER_S2 * dtSec);
    }
    heading += angularVelocity * dtSec;
    x += Math.cos(heading) * BASE_SPEED_PX_PER_S * dtSec;
    y += Math.sin(heading) * BASE_SPEED_PX_PER_S * dtSec;

    if (distanceToCurve(curve, { x, y }) > ribbonWidth / 2) {
      crashed = true;
      crashedAtMs = tMs;
      break;
    }

    tMs += FIXED_DT_MS;
  }

  const rawElapsedMs = Math.min(tMs, Number.isFinite(stopAtMs) ? stopAtMs : tMs);
  // Rounded to a whole ms here (not just at the score/DB boundary) so every
  // consumer — live HUD, final score, durationMs persisted to the Int
  // column — agrees on the exact same number instead of each rounding a
  // sub-ms float differently.
  const survivalMs = started
    ? Math.max(0, Math.round((crashed ? crashedAtMs : rawElapsedMs) - startedAtMs))
    : 0;

  return {
    car: { x, y, heading },
    started,
    crashed,
    crashedAtMs,
    survivalMs,
  };
}
