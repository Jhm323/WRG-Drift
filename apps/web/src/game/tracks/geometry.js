// Parametric generators for the 3 track shapes. Mirrors the math in
// apps/api/prisma/seed.js so the client-rendered track matches the shape
// stored server-side under the same trackId — same formulas, same output.

export function ovalGeometry() {
  const cx = 400;
  const cy = 300;
  const rx = 300;
  const ry = 180;
  const curvePoints = 60;

  const pointAt = (t) => ({
    x: cx + rx * Math.cos(t),
    y: cy + ry * Math.sin(t),
  });

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { curve, ribbonWidth: 70 };
}

export function figureEightGeometry() {
  const cx = 400;
  const cy = 300;
  const a = 260;
  const curvePoints = 80;

  const pointAt = (t) => {
    const denom = 1 + Math.sin(t) ** 2;
    return {
      x: cx + (a * Math.cos(t)) / denom,
      y: cy + (a * Math.sin(t) * Math.cos(t)) / denom,
    };
  };

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { curve, ribbonWidth: 110 };
}

export function switchbackCanyonGeometry() {
  const startX = 120;
  const startY = 500;
  const legLength = 90;
  const switchbackCount = 8;

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

  const curve = Array.from({ length: 80 }, (_, i) => pointAtFraction(i / 79));

  return { curve, ribbonWidth: 105 };
}
