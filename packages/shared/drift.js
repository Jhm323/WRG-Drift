// Deterministic drift physics + simulation. Pure functions only — no
// wall-clock reads, no randomness — so a run can be replayed exactly from
// (track, clickTimestampsMs) alone. That's what makes scoring.js's
// computeScore() safe to run server-side as the anti-cheat authority (see
// build plan §7): same inputs, same output, every time.

export const BASE_SPEED_PX_PER_S = 160;
export const DRIFT_IMPULSE_PX = 75;
export const DRIFT_DECAY_PER_S = 0.05; // offset is multiplied by this every 1s of no input
export const TRACK_HALF_WIDTH_PX = 170; // exceed this and you've hit the curb
export const FIXED_DT_MS = 10;
const MAX_STEPS = 30000; // ~5 min of simulated time — safety cap, not a game limit

function buildCurveIndex(curve) {
  const cumulative = [0];
  for (let i = 1; i < curve.length; i += 1) {
    const dx = curve[i].x - curve[i - 1].x;
    const dy = curve[i].y - curve[i - 1].y;
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  return { points: curve, cumulative, total: cumulative[cumulative.length - 1] };
}

// Nearest point to `point` on the curve polyline, restricted to segments
// whose arc length falls in [minArcLength, maxArcLength]. That restriction
// matters for self-intersecting curves (figure-8): an unrestricted
// nearest-point search can snap a gate to a point on a *different* loop of
// the curve that happens to pass close by — even just requiring "forward of
// the previous gate" isn't enough, since the correct nearby crossing and a
// wrong one a full loop later can both be "forward." Windowing to a local
// neighborhood ahead of the previous gate picks the intended crossing.
function nearestArcLength(curveIndex, point, minArcLength = 0, maxArcLength = Infinity) {
  const { points, cumulative } = curveIndex;
  let best = { distSq: Infinity, arcLength: minArcLength };
  for (let i = 0; i < points.length - 1; i += 1) {
    if (cumulative[i + 1] < minArcLength || cumulative[i] > maxArcLength) continue;
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((point.x - p0.x) * dx + (point.y - p0.y) * dy) / lenSq;
    t = Math.min(Math.max(t, 0), 1);
    const projX = p0.x + dx * t;
    const projY = p0.y + dy * t;
    const distSq = (point.x - projX) ** 2 + (point.y - projY) ** 2;
    if (distSq < best.distSq) {
      best = { distSq, arcLength: Math.max(minArcLength, cumulative[i] + Math.hypot(dx, dy) * t) };
    }
  }
  return best;
}

// Position + tangent angle at a given distance along the track curve.
// `hint` is the last segment index found — since arc length only increases
// during a run, passing it back in avoids re-scanning from the start.
function poseAtArcLength(curveIndex, arcLength, hint = 0) {
  const { points, cumulative, total } = curveIndex;
  const clamped = Math.min(Math.max(arcLength, 0), total);
  let i = Math.min(Math.max(hint, 0), points.length - 2);
  while (i < points.length - 2 && cumulative[i + 1] < clamped) i += 1;
  while (i > 0 && cumulative[i] > clamped) i -= 1;

  const segStart = cumulative[i];
  const segEnd = cumulative[i + 1];
  const t = (clamped - segStart) / (segEnd - segStart || 1);
  const p0 = points[i];
  const p1 = points[i + 1];

  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    tangentAngle: Math.atan2(p1.y - p0.y, p1.x - p0.x),
    segmentIndex: i,
  };
}

// Precomputed once per track (cheap to cache — the curve/gates never change).
export function buildTrackIndex(track) {
  const curveIndex = buildCurveIndex(track.curve);
  const averageGap = curveIndex.total / track.gates.length;
  const searchWindow = averageGap * 4;

  let searchFrom = 0;
  const gateArcLengths = track.gates.map((gate) => {
    let match = nearestArcLength(curveIndex, gate, searchFrom, searchFrom + searchWindow);
    if (!(match.distSq < (searchWindow * 0.5) ** 2)) {
      // No plausible match in the local window (unevenly spaced gates) —
      // fall back to an unbounded forward search rather than accepting a
      // clearly-wrong one.
      match = nearestArcLength(curveIndex, gate, searchFrom);
    }
    searchFrom = match.arcLength;
    return match.arcLength;
  });
  return { curveIndex, gateArcLengths, totalLength: curveIndex.total };
}

// Replays the run from t=0 using fixed 10ms steps: auto-advance along the
// track, apply a lateral impulse toward the next gate on each click, let it
// decay, and stop on crash/finish/`stopAtMs`. Same trackIndex + clicks always
// produces the same result — that determinism is the point.
export function simulateRun(track, trackIndex, clickTimestampsMs, options = {}) {
  const stopAtMs = options.stopAtMs ?? Infinity;
  const { curveIndex, gateArcLengths, totalLength } = trackIndex;
  const clicks = [...clickTimestampsMs].sort((a, b) => a - b);

  let progress = 0;
  let lateralOffset = 0;
  let nextGateIndex = 0;
  let clickCursor = 0;
  let segmentHint = 0;
  let crashed = false;
  let crashedAtMs = null;
  let finished = false;
  let finishedAtMs = null;
  const gateEvents = [];

  let pose = poseAtArcLength(curveIndex, 0, 0);
  let car = { x: pose.x, y: pose.y, heading: pose.tangentAngle };

  let tMs = 0;
  let steps = 0;

  while (tMs <= stopAtMs && !crashed && !finished && steps < MAX_STEPS) {
    steps += 1;

    while (clickCursor < clicks.length && clicks[clickCursor] <= tMs) {
      clickCursor += 1;
      if (nextGateIndex < track.gates.length) {
        const gate = track.gates[nextGateIndex];
        const toGateX = gate.x - pose.x;
        const toGateY = gate.y - pose.y;
        const side =
          Math.sign(
            Math.cos(pose.tangentAngle) * toGateY - Math.sin(pose.tangentAngle) * toGateX,
          ) || 1;
        lateralOffset += side * DRIFT_IMPULSE_PX;
      }
    }

    const dtSec = FIXED_DT_MS / 1000;
    const prevLateralOffset = lateralOffset;
    progress += BASE_SPEED_PX_PER_S * dtSec;
    lateralOffset *= DRIFT_DECAY_PER_S ** dtSec;

    pose = poseAtArcLength(curveIndex, progress, segmentHint);
    segmentHint = pose.segmentIndex;
    const carX = pose.x - Math.sin(pose.tangentAngle) * lateralOffset;
    const carY = pose.y + Math.cos(pose.tangentAngle) * lateralOffset;
    const driftRate = (lateralOffset - prevLateralOffset) / dtSec;
    const heading = pose.tangentAngle + Math.atan2(driftRate, BASE_SPEED_PX_PER_S) * 0.5;
    car = { x: carX, y: carY, heading };

    if (Math.abs(lateralOffset) > TRACK_HALF_WIDTH_PX) {
      crashed = true;
      crashedAtMs = tMs;
      break;
    }

    while (nextGateIndex < gateArcLengths.length && progress >= gateArcLengths[nextGateIndex]) {
      const gate = track.gates[nextGateIndex];
      const distance = Math.hypot(carX - gate.x, carY - gate.y);
      const driftAngleDeg = (Math.atan2(driftRate, BASE_SPEED_PX_PER_S) * 180) / Math.PI;
      gateEvents.push({
        gateIndex: nextGateIndex,
        atMs: tMs,
        cleared: distance <= gate.radius,
        distance,
        driftAngleDeg,
      });
      nextGateIndex += 1;
    }

    if (progress >= totalLength) {
      finished = true;
      finishedAtMs = tMs;
      break;
    }

    tMs += FIXED_DT_MS;
  }

  return {
    car,
    progress,
    lateralOffset,
    gateEvents,
    gatesTotal: track.gates.length,
    crashed,
    crashedAtMs,
    finished,
    finishedAtMs,
    elapsedMs: Math.min(tMs, Number.isFinite(stopAtMs) ? stopAtMs : tMs),
  };
}
