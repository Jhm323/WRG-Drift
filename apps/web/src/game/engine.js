// Framework-agnostic canvas game loop. Takes a canvas + track, renders the
// live simulation every frame, and reports gate/crash/finish events via
// callbacks. No React dependency — see test.html for a bare-HTML harness.

import { buildTrackIndex, simulateRun } from './drift.js';
import { scoreFromGateEvents, computeScore } from './scoring.js';
import { attachClickInput } from './input.js';

// Deliberately independent of drift.js's TRACK_HALF_WIDTH_PX (the crash
// boundary) — that constant got wider to fit the slalom gates, but drawing
// the road that wide made it self-overlap on tighter curves. This is purely
// cosmetic: how wide the road *looks*, not how far you can drift before crashing.
const ROAD_VISUAL_WIDTH_PX = 50;

function computeFitTransform(points, width, height, padding = 40) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

  return {
    scale,
    offsetX: (width - spanX * scale) / 2 - minX * scale,
    offsetY: (height - spanY * scale) / 2 - minY * scale,
  };
}

function render(ctx, canvas, track, trackIndex, transform, result) {
  const toScreen = (p) => ({
    x: p.x * transform.scale + transform.offsetX,
    y: p.y * transform.scale + transform.offsetY,
  });

  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  trackIndex.curveIndex.points.forEach((point, i) => {
    const s = toScreen(point);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.strokeStyle = '#2a2d33';
  ctx.lineWidth = Math.max(2, ROAD_VISUAL_WIDTH_PX * transform.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  track.gates.forEach((gate, i) => {
    const event = result.gateEvents.find((e) => e.gateIndex === i);
    const s = toScreen(gate);
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(3, gate.radius * transform.scale), 0, Math.PI * 2);
    ctx.strokeStyle = event ? (event.cleared ? '#2a9d8f' : '#e63946') : '#6d597a';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const carScreen = toScreen(result.car);
  ctx.save();
  ctx.translate(carScreen.x, carScreen.y);
  ctx.rotate(result.car.heading);
  ctx.fillStyle = '#3a86ff';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, 6);
  ctx.lineTo(-8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createEngine({ canvas, track, onTick, onCrash, onFinish }) {
  const ctx = canvas.getContext('2d');
  const trackIndex = buildTrackIndex(track);
  const transform = computeFitTransform(track.curve, canvas.width, canvas.height);

  let clickTimestamps = [];
  let startTime = null;
  let rafId = null;
  let ended = false;
  let detachInput = null;

  function tick(now) {
    if (ended) return;
    const elapsedMs = now - startTime;
    const result = simulateRun(track, trackIndex, clickTimestamps, { stopAtMs: elapsedMs });
    render(ctx, canvas, track, trackIndex, transform, result);

    const live = scoreFromGateEvents(track, result.gateEvents);
    onTick?.({ ...live, gatesTotal: result.gatesTotal, elapsedMs: result.elapsedMs });

    if (result.crashed || result.finished) {
      ended = true;
      const final = computeScore(track, clickTimestamps);
      (result.crashed ? onCrash : onFinish)?.(final);
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      ended = false;
      clickTimestamps = [];
      startTime = performance.now();
      detachInput = attachClickInput(canvas, () => {
        if (!ended) clickTimestamps.push(performance.now() - startTime);
      });
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      ended = true;
      if (rafId) cancelAnimationFrame(rafId);
      detachInput?.();
    },
  };
}
