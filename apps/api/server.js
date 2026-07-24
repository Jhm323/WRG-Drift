import 'dotenv/config';
import { app } from './src/app.js';
import { scheduleLeaderboardRollovers } from './src/jobs/leaderboardRollover.job.js';

const port = process.env.PORT ?? 4000;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

scheduleLeaderboardRollovers();
