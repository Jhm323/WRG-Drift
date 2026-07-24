// Parametric generators for the 3 track shapes. Mirrors the math in
// apps/api/prisma/seed.js so the client-rendered track matches the shape
// stored server-side under the same trackId — same formulas, same output.

// Gates sit off the centerline, alternating left/right, at slightly more
// than their own radius — so a car sitting dead-center (i.e. never
// clicked) always just misses. Without this, gates placed exactly on the
// curve the car defaults to are auto-cleared with zero input, and
// "click-to-drift through gates" stops meaning anything.
const SLALOM_FACTOR = 1.25;

function slalomOffset(pointAt, t, index, radius, epsilon = 1e-3) {
  const p0 = pointAt(t);
  const p1 = pointAt(t + epsilon);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = index % 2 === 0 ? 1 : -1;
  const magnitude = radius * SLALOM_FACTOR * side;
  return { x: p0.x + nx * magnitude, y: p0.y + ny * magnitude, radius };
}

export function ovalGeometry() {
  const cx = 400;
  const cy = 300;
  const rx = 300;
  const ry = 180;
  const gateCount = 10;
  const curvePoints = 60;

  const pointAt = (t) => ({
    x: cx + rx * Math.cos(t),
    y: cy + ry * Math.sin(t),
  });

  const gates = Array.from({ length: gateCount }, (_, i) =>
    slalomOffset(pointAt, (i / gateCount) * Math.PI * 2, i, 55),
  );

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { gates, curve, parTimeMs: 28000 };
}

export function figureEightGeometry() {
  const cx = 400;
  const cy = 300;
  const a = 260;
  const gateCount = 14;
  const curvePoints = 80;

  const pointAt = (t) => {
    const denom = 1 + Math.sin(t) ** 2;
    return {
      x: cx + (a * Math.cos(t)) / denom,
      y: cy + (a * Math.sin(t) * Math.cos(t)) / denom,
    };
  };

  const gates = Array.from({ length: gateCount }, (_, i) => {
    const t = (i / gateCount) * Math.PI * 2;
    const nearCrossover = Math.abs(Math.sin(t)) < 0.35;
    return slalomOffset(pointAt, t, i, nearCrossover ? 28 : 40);
  });

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { gates, curve, parTimeMs: 40000 };
}

export function switchbackCanyonGeometry() {
  const startX = 120;
  const startY = 500;
  const legLength = 90;
  const switchbackCount = 8;
  const gateCount = 18;

  const anchors = [{ x: startX, y: startY }];
  let direction = 1;
  for (let i = 0; i < switchbackCount; i += 1) {
    const prev = anchors[anchors.length - 1];
    anchors.push({ x: prev.x + direction * legLength, y: prev.y - 60 });
    anchors.push({ x: prev.x + direction * legLength, y: prev.y - 110 });
    direction *= -1;
  }

  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const pointAtFraction = (f) => {
    const scaled = f * (anchors.length - 1);
    const i = Math.min(Math.floor(scaled), anchors.length - 2);
    return lerp(anchors[i], anchors[i + 1], scaled - i);
  };

  const gates = Array.from({ length: gateCount }, (_, i) =>
    slalomOffset(pointAtFraction, i / (gateCount - 1), i, 22),
  );

  const curve = Array.from({ length: 80 }, (_, i) => pointAtFraction(i / 79));

  return { gates, curve, parTimeMs: 52000 };
}
