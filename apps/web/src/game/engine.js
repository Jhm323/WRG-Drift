// Framework-agnostic canvas game loop. Takes a canvas + track, renders the
// live simulation every frame, and reports crash/tick events via
// callbacks. No React dependency — see test.html for a bare-HTML harness.

import { buildTrackIndex, simulateRun, computeScore, scoreFromSurvivalMs } from '@dirtcar-drift/shared';
import { attachKeyboardInput } from './input.js';
import carIconUrl from '../assets/car-icon.svg';

// car-icon.svg's 100x208 viewBox has a lot of transparent padding above and
// below the artwork itself (measured empirically) — the visible car only
// occupies this sub-rect. Source-cropping to it means the draw size below
// maps onto the actual visible car, not onto the padded viewBox.
const CAR_ICON_SOURCE_X = 0;
const CAR_ICON_SOURCE_Y = 52;
const CAR_ICON_SOURCE_WIDTH = 100;
const CAR_ICON_SOURCE_HEIGHT = 99;

// Drawn length (nose-to-tail) roughly matches the old arrow's ~18px
// point-to-tail footprint; width follows the cropped artwork's own aspect
// ratio so it isn't stretched.
const CAR_ICON_LENGTH_PX = 18;
const CAR_ICON_WIDTH_PX = CAR_ICON_LENGTH_PX * (CAR_ICON_SOURCE_WIDTH / CAR_ICON_SOURCE_HEIGHT);

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

function render(ctx, canvas, track, trackIndex, transform, result, carImage) {
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
  // car-icon.svg's nose points "up" (its own -y) rather than along +x like
  // heading=0 does, so rotate an extra 90deg to line the nose up with the
  // heading direction the same way the old arrow (drawn pointing along +x)
  // did with a bare ctx.rotate(heading).
  ctx.rotate(result.car.heading + Math.PI / 2);
  ctx.drawImage(
    carImage,
    CAR_ICON_SOURCE_X,
    CAR_ICON_SOURCE_Y,
    CAR_ICON_SOURCE_WIDTH,
    CAR_ICON_SOURCE_HEIGHT,
    -CAR_ICON_WIDTH_PX / 2,
    -CAR_ICON_LENGTH_PX / 2,
    CAR_ICON_WIDTH_PX,
    CAR_ICON_LENGTH_PX,
  );
  ctx.restore();
}

export function createEngine({ canvas, track, onTick, onCrash }) {
  const ctx = canvas.getContext('2d');
  const trackIndex = buildTrackIndex(track);
  const transform = computeFitTransform(track.curve, canvas.width, canvas.height);
  const carImage = new Image();
  carImage.src = carIconUrl;

  let keyEvents = [];
  let startTime = null;
  let rafId = null;
  let ended = false;
  let detachInput = null;

  function tick(now) {
    if (ended) return;
    const elapsedMs = now - startTime;
    const result = simulateRun(track, trackIndex, keyEvents, { stopAtMs: elapsedMs });
    render(ctx, canvas, track, trackIndex, transform, result, carImage);

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
