// Framework-agnostic canvas game loop. Takes a canvas + track, renders the
// live simulation every frame, and reports crash/tick events via
// callbacks. No React dependency — see test.html for a bare-HTML harness.

import { buildTrackIndex, simulateRun, computeScore, scoreFromSurvivalMs } from '@dirtcar-drift/shared';
import { attachKeyboardInput } from './input.js';

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
  trackIndex.curve.forEach((point, i) => {
    const s = toScreen(point);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.strokeStyle = '#2a2d33';
  ctx.lineWidth = Math.max(2, trackIndex.ribbonWidth * transform.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

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

export function createEngine({ canvas, track, onTick, onCrash }) {
  const ctx = canvas.getContext('2d');
  const trackIndex = buildTrackIndex(track);
  const transform = computeFitTransform(track.curve, canvas.width, canvas.height);

  let keyEvents = [];
  let startTime = null;
  let rafId = null;
  let ended = false;
  let detachInput = null;

  function tick(now) {
    if (ended) return;
    const elapsedMs = now - startTime;
    const result = simulateRun(track, trackIndex, keyEvents, { stopAtMs: elapsedMs });
    render(ctx, canvas, track, trackIndex, transform, result);

    onTick?.({
      score: scoreFromSurvivalMs(track, result.survivalMs),
      elapsedMs: result.survivalMs,
      started: result.started,
    });

    if (result.crashed) {
      ended = true;
      detachInput?.();
      const final = computeScore(track, keyEvents);
      // keyEvents ships alongside the client-computed score because that's
      // the actual anti-cheat payload: the server recomputes the
      // authoritative score from these, not from `final`.
      onCrash?.({ ...final, keyEvents: [...keyEvents] });
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      ended = false;
      keyEvents = [];
      startTime = performance.now();
      detachInput = attachKeyboardInput((event) => {
        if (!ended) keyEvents.push({ ...event, atMs: performance.now() - startTime });
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
