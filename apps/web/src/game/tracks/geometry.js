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
  // Deliberately unequal (an elliptical loop, not a circular one) — holding
  // one direction key the whole run settles into a fixed-radius circle
  // (~102px, from BASE_SPEED_PX_PER_S / MAX_TURN_RATE_RAD_PER_S in
  // packages/shared/drift.js). A circular loop has constant curvature
  // everywhere, so that fixed circle can ride the ribbon forever — a
  // skill-free infinite loop. An ellipse's curvature instead sweeps
  // continuously across the loop (~43px at the tightest, near the minor-axis
  // ends, up to ~280px at the loosest, near the major-axis ends), so the
  // fixed-radius circle only ever grazes a matching curvature at isolated
  // points, not a sustained stretch, and drifts off the ribbon shortly after.
  const loopSemiMajor = 150; // half-width of each loop, along x
  const loopSemiMinor = 80; // half-height of each loop, along y
  const curvePoints = 80;

  const pointAt = (t) => {
    // t in [0, 2π): first half traces the left loop, second half the right,
    // each a full ellipse starting and ending at the shared crossing point
    // (cx, cy) so the two loops join into one continuous figure-8 curve.
    if (t < Math.PI) {
      const angle = t * 2;
      return {
        x: cx - loopSemiMajor + loopSemiMajor * Math.cos(angle),
        y: cy + loopSemiMinor * Math.sin(angle),
      };
    }
    const angle = Math.PI - (t - Math.PI) * 2;
    return {
      x: cx + loopSemiMajor + loopSemiMajor * Math.cos(angle),
      y: cy + loopSemiMinor * Math.sin(angle),
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
