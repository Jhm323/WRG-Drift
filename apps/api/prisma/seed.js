import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { TRACKS } from '@dirtcar-drift/shared';

// Track curve/ribbonWidth/wrapAtEnd/pointsMultiplier/difficulty all live in
// packages/shared/tracks.js now — the single source this seed script and
// the client's game engine both import, so they can't drift out of sync the
// way they used to (ribbonWidth, wrapAtEnd, and the Figure-8 geometry all
// went out of sync between here and the client at least once this session).
// This script's only remaining job is reshaping that flat client-side track
// shape into the DB row shape: `pointsMultiplier`/`difficulty` stay top-level
// columns; everything else (curve, ribbonWidth, wrapAtEnd when present)
// nests under the `config` JSON column that scores.service.js's anti-cheat
// replay reads from.
const tracks = TRACKS.map(({ id, name, difficulty, pointsMultiplier, ...config }) => ({
  id,
  name,
  difficulty,
  pointsMultiplier,
  config,
}));

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
