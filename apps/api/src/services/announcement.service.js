// Podium announcements, fired by the leaderboard rollover job (build plan
// §6). Slack is real (or dev-logged); the intraweb post is a stub until
// there's a target CMS/API to push to; WhatsApp is intentionally not
// implemented — see the note below.

const TOP_N = 3;

function periodLabel(period) {
  return period === 'weekly' ? 'Weekly' : 'Monthly';
}

function formatDateRange(periodStart, periodEnd) {
  return `${periodStart.toDateString()} – ${periodEnd.toDateString()}`;
}

async function sendSlackAnnouncement({ period, periodStart, periodEnd, standings }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const winners = standings.slice(0, TOP_N);
  const text = [
    `🏁 *${periodLabel(period)} DirtCar Drift podium* (${formatDateRange(periodStart, periodEnd)})`,
    ...winners.map((entry, i) => `${i + 1}. ${entry.displayName} — ${entry.bestScore}`),
  ].join('\n');

  if (!webhookUrl) {
    console.log(`[slack:dev] SLACK_WEBHOOK_URL not set — logging instead of posting.\n${text}`);
    return;
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

function logIntranetAnnouncement({ period, periodStart, periodEnd, standings }) {
  const winners = standings.slice(0, TOP_N);
  const post = [
    `# ${periodLabel(period)} DirtCar Drift Podium`,
    formatDateRange(periodStart, periodEnd),
    '',
    ...winners.map((entry, i) => `${i + 1}. ${entry.displayName} — ${entry.bestScore}`),
  ].join('\n');

  // Stub until the intraweb platform (SharePoint? a custom CMS?) and its
  // content API are known — see build plan §6 Podium announcements.
  console.log(`[intranet:stub] No content API configured — paste this manually:\n${post}`);
}

// Deliberately unimplemented. WhatsApp needs either the WhatsApp Business
// Platform (Meta app review) or a wrapper like Twilio, plus a pre-approved
// outbound message template — a provider decision outside this codebase's
// control (build plan §6 Podium announcements). Wire this up once that
// decision is made; until then it's a documented no-op, not a silent gap.
function sendWhatsAppAnnouncement() {
  // TODO(whatsapp): implement once a provider + approved template exist.
}

export async function announceWinners(board) {
  await sendSlackAnnouncement(board);
  logIntranetAnnouncement(board);
  sendWhatsAppAnnouncement(board);
}
