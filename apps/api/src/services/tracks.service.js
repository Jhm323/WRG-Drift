import { prisma } from '../lib/prisma.js';

export async function listTracks() {
  return prisma.track.findMany({
    select: {
      id: true,
      name: true,
      difficulty: true,
      pointsMultiplier: true,
      config: true,
    },
    orderBy: { pointsMultiplier: 'asc' },
  });
}
