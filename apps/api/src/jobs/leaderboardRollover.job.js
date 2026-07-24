import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { computeStandingsForRollover } from '../services/leaderboard.service.js';
import { announceWinners } from '../services/announcement.service.js';

// Freezes the period that just ended into LeaderboardSnapshot (so the
// podium doesn't shift after the fact — build plan §6) and fires the
// winner announcements. Exported standalone so it can be run manually
// (ops, or verifying this job without waiting for a real cron tick).
export async function runRollover(period, reference = new Date()) {
  const board = await computeStandingsForRollover({ period, reference });

  if (board.standings.length > 0) {
    await prisma.$transaction(
      board.standings.map((entry) =>
        prisma.leaderboardSnapshot.upsert({
          where: {
            period_periodStart_userId: {
              period: board.period,
              periodStart: board.periodStart,
              userId: entry.userId,
            },
          },
          update: { bestScore: entry.bestScore, rank: entry.rank, periodEnd: board.periodEnd },
          create: {
            period: board.period,
            periodStart: board.periodStart,
            periodEnd: board.periodEnd,
            userId: entry.userId,
            bestScore: entry.bestScore,
            rank: entry.rank,
          },
        }),
      ),
    );
  }

  await announceWinners(board);
  return board;
}

// Weekly fires Monday 00:00 UTC (snapshotting the week that just ended);
// monthly fires the 1st of the month 00:00 UTC. UTC to match period.js's
// boundaries, which are also UTC-based.
export function scheduleLeaderboardRollovers() {
  cron.schedule(
    '0 0 * * 1',
    () => {
      runRollover('weekly').catch((err) =>
        console.error('Weekly leaderboard rollover failed', err),
      );
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 0 1 * *',
    () => {
      runRollover('monthly').catch((err) =>
        console.error('Monthly leaderboard rollover failed', err),
      );
    },
    { timezone: 'UTC' },
  );
}
