import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

// Parametric helpers — generate a denser curve for rendering plus the
// track's ribbon width. Mirrors apps/web/src/game/tracks/geometry.js,
// which the game engine actually plays against — the DB and the client
// must agree on curve + ribbon shape.

function ovalTrack() {
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

function figureEightTrack() {
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

  // Two ellipses, traced as one continuous figure-8: t in [0, 2π), first
  // half the left loop, second half the right, each starting and ending at
  // the shared crossing point (cx, cy).
  const pointAt = (t) => {
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

function switchbackCanyonTrack() {
  const startX = 120;
  const startY = 500;
  const legLength = 90;
  const switchbackCount = 8;

  // Zigzag hairpin path climbing up a canyon wall.
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

  // Non-looping path — mirrors apps/web/src/game/tracks/switchback-canyon.js's
  // wrapAtEnd flag, so the server's anti-cheat replay wraps to the start
  // instead of crashing at the same point the client does.
  return { curve, ribbonWidth: 105, wrapAtEnd: true };
}

const tracks = [
  {
    id: 'oval-loop',
    name: 'Oval Loop',
    difficulty: 'easy',
    pointsMultiplier: 1.0,
    config: ovalTrack(),
  },
  {
    id: 'figure-8',
    name: 'Figure-8',
    difficulty: 'medium',
    pointsMultiplier: 1.5,
    config: figureEightTrack(),
  },
  {
    id: 'switchback-canyon',
    name: 'Switchback Canyon',
    difficulty: 'hard',
    pointsMultiplier: 2.0,
    config: switchbackCanyonTrack(),
  },
];

async function main() {
  for (const track of tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: track,
      create: track,
    });
  }
  console.log(`Seeded ${tracks.length} tracks.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
