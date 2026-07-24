import { prisma } from '../lib/prisma.js';
import { periodBounds, previousPeriodBounds } from '../lib/period.js';

async function rankedStandingsForRange({ start, end, trackId }) {
  const grouped = await prisma.run.groupBy({
    by: ['userId'],
    where: {
      playedAt: { gte: start, lt: end },
      ...(trackId ? { trackId } : {}),
    },
    _max: { score: true },
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return grouped
    .map((g) => ({
      userId: g.userId,
      displayName: userById.get(g.userId)?.displayName ?? 'Unknown',
      avatarUrl: userById.get(g.userId)?.avatarUrl ?? null,
      bestScore: g._max.score,
    }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// Rank movement vs. the last frozen snapshot. Snapshots (see rollover job)
// aren't tracked per-track, so this is only meaningful for the all-tracks
// board — a trackId-filtered query gets `rankChange: null` for every row.
async function withRankChange(standings, { period, reference }) {
  const { start: previousStart } = previousPeriodBounds(period, reference);
  const previousSnapshots = await prisma.leaderboardSnapshot.findMany({
    where: { period, periodStart: previousStart },
    select: { userId: true, rank: true },
  });
  const previousRankByUser = new Map(previousSnapshots.map((s) => [s.userId, s.rank]));

  return standings.map((entry) => {
    const previousRank = previousRankByUser.get(entry.userId) ?? null;
    let rankChange = 'new';
    if (previousRank != null) {
      if (entry.rank < previousRank) rankChange = 'up';
      else if (entry.rank > previousRank) rankChange = 'down';
      else rankChange = 'same';
    }
    return { ...entry, previousRank, rankChange };
  });
}

// GET /api/v1/leaderboard: standings for the *current*, still-open period.
export async function computeStandings({ period, trackId, reference = new Date() }) {
  const { start, end } = periodBounds(period, reference);
  const ranked = await rankedStandingsForRange({ start, end, trackId });
  const standings = trackId
    ? ranked.map((entry) => ({ ...entry, previousRank: null, rankChange: null }))
    : await withRankChange(ranked, { period, reference });

  return { period, periodStart: start, periodEnd: end, standings };
}

// Rollover job: standings for the period that just *ended* at `reference`,
// frozen into LeaderboardSnapshot — see build plan §6.
export async function computeStandingsForRollover({ period, reference = new Date() }) {
  const { start, end } = previousPeriodBounds(period, reference);
  const standings = await rankedStandingsForRange({ start, end, trackId: undefined });
  return { period, periodStart: start, periodEnd: end, standings };
}
