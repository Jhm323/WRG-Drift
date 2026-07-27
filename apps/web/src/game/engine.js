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

const BACKGROUND_COLOR_NEAR = '#6B9B4F'; // grass, lighter near the track
const BACKGROUND_COLOR_FAR = '#4C7A3D'; // grass, darker toward canvas edges
const TRACK_SURFACE_COLOR = '#C08552'; // dirt
const TRACK_EDGE_COLOR = '#8B5E3C'; // boundary band — this is the actual crash edge (ribbonWidth/2 from centerline), needs to read clearly
const TRACK_EDGE_BAND_FRACTION = 0.15; // per edge, as a fraction of the full ribbon width
const CENTERLINE_COLOR = '#F5E6D3';

const MAX_CANVAS_DIMENSION_PX = 800;

// Derives a canvas size from this specific track's own shape — a tall
// narrow track (Switchback Canyon) gets a tall narrow canvas, a wide one
// (Figure-8) gets a wide canvas — instead of forcing every track into the
// same fixed box, which wastes most of the canvas on tracks whose natural
// aspect ratio doesn't match. Bounds include the ribbon's half-width on
// every side, since the drivable surface's actual edges (not just the
// centerline waypoints) are what needs to fit. The longer axis is capped
// at maxDimension; the other scales down with it to preserve aspect ratio.
export function computeTrackCanvasSize(track, maxDimension = MAX_CANVAS_DIMENSION_PX) {
  const xs = track.curve.map((p) => p.x);
  const ys = track.curve.map((p) => p.y);
  const halfRibbon = track.ribbonWidth / 2;
  const spanX = Math.max(...xs) - Math.min(...xs) + halfRibbon * 2 || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) + halfRibbon * 2 || 1;
  const scale = maxDimension / Math.max(spanX, spanY);

  return {
    width: Math.round(spanX * scale),
    height: Math.round(spanY * scale),
  };
}

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

  const bgCenterX = canvas.width / 2;
  const bgCenterY = canvas.height / 2;
  const bgRadius = Math.hypot(bgCenterX, bgCenterY);
  const backgroundGradient = ctx.createRadialGradient(
    bgCenterX,
    bgCenterY,
    0,
    bgCenterX,
    bgCenterY,
    bgRadius,
  );
  backgroundGradient.addColorStop(0, BACKGROUND_COLOR_NEAR);
  backgroundGradient.addColorStop(1, BACKGROUND_COLOR_FAR);
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  trackIndex.curve.forEach((point, i) => {
    const s = toScreen(point);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const ribbonWidthPx = Math.max(2, trackIndex.ribbonWidth * transform.scale);
  const edgeBandPx = ribbonWidthPx * TRACK_EDGE_BAND_FRACTION;
  const surfaceWidthPx = Math.max(1, ribbonWidthPx - edgeBandPx * 2);

  // Boundary band, drawn full ribbon width first so it peeks out on both
  // sides once the narrower surface stroke goes on top of it.
  ctx.strokeStyle = TRACK_EDGE_COLOR;
  ctx.lineWidth = ribbonWidthPx;
  ctx.stroke();

  ctx.strokeStyle = TRACK_SURFACE_COLOR;
  ctx.lineWidth = surfaceWidthPx;
  ctx.stroke();

  ctx.strokeStyle = CENTERLINE_COLOR;
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
  // Padding must clear the ribbon's own half-width, or a thick ribbon can
  // bleed past the fitted curve's edge and off the canvas.
  const fitPadding = Math.max(40, trackIndex.ribbonWidth / 2 + 10);
  const transform = computeFitTransform(track.curve, canvas.width, canvas.height, fitPadding);
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
