import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

// Parametric helpers — generate gate positions + a denser curve for rendering.
// Actual game-engine consumption of this shape happens in Phase 4; this just
// needs to satisfy the Track.config contract: gate positions, curve data, par time.

function ovalTrack() {
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

  const gates = Array.from({ length: gateCount }, (_, i) => ({
    ...pointAt((i / gateCount) * Math.PI * 2),
    radius: 55,
  }));

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { gates, curve, parTimeMs: 28000 };
}

function figureEightTrack() {
  const cx = 400;
  const cy = 300;
  const a = 260;
  const gateCount = 14;
  const curvePoints = 80;

  // Lemniscate of Bernoulli, traced as a single closed loop.
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
    return {
      ...pointAt(t),
      radius: nearCrossover ? 28 : 40,
    };
  });

  const curve = Array.from({ length: curvePoints }, (_, i) =>
    pointAt((i / curvePoints) * Math.PI * 2),
  );

  return { gates, curve, parTimeMs: 40000 };
}

function switchbackCanyonTrack() {
  const startX = 120;
  const startY = 500;
  const legLength = 90;
  const switchbackCount = 8;
  const gateCount = 18;

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

  const gates = Array.from({ length: gateCount }, (_, i) => ({
    ...pointAtFraction(i / (gateCount - 1)),
    radius: 22,
  }));

  const curve = Array.from({ length: 80 }, (_, i) => pointAtFraction(i / 79));

  return { gates, curve, parTimeMs: 52000 };
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
