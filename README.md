# DirtCar Drift Challenge

Company-culture drifting game — see `dirtcar-drift-game-build-plan.md` for
the full design and phased build plan.

## Structure

npm workspaces monorepo:

- `apps/web` — React + Vite frontend (scaffolded in Phase 3)
- `apps/api` — Node + Express backend (scaffolded in Phase 1)
- `packages/shared` — code shared between web and api (e.g. the scoring
  function, so client-side feedback and server-side validation never
  drift apart)

## Status

Phase 0 (repo scaffold), Phase 1 (backend skeleton + DB), Phase 2 (auth),
Phase 3 (frontend skeleton + auth UI), Phase 4 (game engine), Phase 5
(GameCanvas + track select), Phase 6 (server-authoritative scoring), and
Phase 7 (leaderboards) done. Remaining: Phase 8 (polish/QA) and Phase 9
(deploy).

## apps/api setup

Requires a local PostgreSQL server (e.g. `brew install postgresql@16 && brew services start postgresql@16`).

```bash
cd apps/api
cp .env.example .env    # then set DATABASE_URL to your local Postgres, and JWT_SECRET to a random string
npm run prisma:migrate  # applies prisma/migrations, generates the client
npm run prisma:seed     # loads the 3 sample tracks (oval-loop, figure-8, switchback-canyon)
npm run dev              # starts the API on http://localhost:4000 (nodemon)
```

`GET /health` returns `{ "status": "ok" }` once the server is running.

### Auth (Phase 2)

- `POST /auth/signup` — `{ email, password, displayName, avatarUrl }`; email
  must end in `@dirtcar.com`, one account per email.
- `GET /auth/verify?token=...` — verification link sent on signup.
- `POST /auth/login` — rejected with 403 until the email is verified; sets
  an httpOnly, 30-day JWT cookie on success.
- `POST /auth/logout`
- `POST /auth/forgot-password` — `{ email }`, always responds the same way
  regardless of whether the account exists.
- `POST /auth/reset-password` — `{ token, newPassword }`, single-use,
  1-hour expiry.
- `GET /auth/me` — protected, returns the logged-in user.

`RESEND_API_KEY` is left blank in `.env.example` — with no key set, the
verification/reset emails are logged to the server console instead of
actually sent, so the whole flow is testable locally without a real Resend
account. Set `RESEND_API_KEY` to send real email.

## apps/web setup (Phase 3)

```bash
cd apps/web
npm run dev   # starts Vite on http://localhost:5173
```

The Vite dev server proxies `/auth` and `/api` to `http://localhost:4000`
(see `vite.config.js`), so the API must also be running — no CORS
juggling needed in dev, cookies are same-origin through the proxy.

Routes: `/login`, `/signup` are public. `/tracks`, `/play/:trackId`, and
`/leaderboard` require a session — `ProtectedRoute` redirects to `/login`
otherwise. `AuthContext`/`useAuth` (`src/context`, `src/hooks`) hold the
session, backed by `GET /auth/me` on load.

## Game engine (Phase 4)

`apps/web/src/game` is a framework-agnostic canvas engine — no React import
anywhere in it:

- `tracks/` — the 3 tracks (`oval-loop`, `figure-8`, `switchback-canyon`),
  generated with the same parametric math as `apps/api/prisma/seed.js` so
  the client-rendered shape matches what's in the DB under the same `id`.
- `input.js` — click capture, `engine.js` — the `requestAnimationFrame`
  loop tying simulation + rendering + input together.

`drift.js` (pure, deterministic simulation) and `scoring.js`
(`computeScore(track, clickTimestampsMs)`, returns `{ score, gatesCleared,
gatesTotal, crashed, durationMs }`) originally lived here too, but moved to
`packages/shared` in Phase 6 — see below.

Gates sit off the track centerline in an alternating slalom pattern —
clicking is what steers the car toward each one. (The original Phase 1
seed data placed gates exactly on the centerline, which meant a run with
zero clicks auto-cleared everything; fixed in both `geometry.js` and
`apps/api/prisma/seed.js`, then re-seeded.)

Test it standalone, no React, no build step:

```bash
cd apps/web && npm run dev
# open http://localhost:5173/test.html
```

## GameCanvas + track select (Phase 5)

- `components/GameCanvas/` — thin React wrapper (`useRef` + `useEffect`)
  around `createEngine()`. All game logic still lives in `src/game`; this
  component only owns the `<canvas>` element's lifecycle.
- `components/TrackSelect/` — the `/tracks` grid, `track-card` BEM markup,
  with an SVG thumbnail traced from each track's actual curve data. Reads
  track data straight from `src/game/tracks` (not an API call — there's no
  `GET /tracks` endpoint in the plan, and the client already has the full
  track config it needs to render and play).
- `pages/PlayPage.jsx` — looks up the track by the `:trackId` route param,
  renders `GameCanvas` with a live score/gates/time HUD, and on
  crash/finish shows the result with "Play again" (remounts `GameCanvas`
  via a `key` bump) and "Back to tracks." Also POSTs the run to
  `/api/v1/scores` (Phase 6); a failure there is shown as a small "could
  not save this run" note but never hides the player's own result.

## Server-authoritative scoring (Phase 6)

`drift.js` and `scoring.js` moved from `apps/web/src/game` into
`packages/shared` (`@dirtcar-drift/shared`, linked via npm workspaces —
`npm install` at the repo root symlinks it into both apps'
`node_modules`) so the client and server run the exact same deterministic
simulation.

`POST /api/v1/scores` (`apps/api/src/routes/scores.routes.js`, requires
auth) takes `{ trackId, clickTimestamps, score }`:

1. Loads the `Track` row and recomputes the score server-side from
   `clickTimestamps` via `computeScore()` — the authoritative result,
   never the client's.
2. If the client's `score` differs from the recomputed one by more than a
   small tolerance, rejects with 400 (tampering or a client/server logic
   mismatch — either way, don't persist it).
3. Rate-limited to 1 submission per 3 seconds per user
   (`middleware/rateLimit.middleware.js`, in-memory — fine at this scale).
4. Persists the `Run` with a `serverChecksum` (HMAC via `SCORE_HMAC_SECRET`,
   a separate secret from `JWT_SECRET` so rotating one doesn't invalidate
   the other).

## Leaderboards (Phase 7)

`GET /api/v1/leaderboard?period=weekly|monthly&trackId=optional` (requires
auth) — best score per user in the current ISO week (Mon–Sun, UTC) or
calendar month, ranked, joined with `displayName`/`avatarUrl`. Rank change
(`up`/`down`/`same`/`new`) compares against the most recent
`LeaderboardSnapshot` for the _previous_ period — only computed on the
all-tracks board, since snapshots aren't tracked per-track. Logic lives in
`apps/api/src/services/leaderboard.service.js`, date-boundary math in
`src/lib/period.js`.

`apps/web/src/components/Leaderboard/` — Weekly/Monthly tabs, a
`leaderboard__row--highlighted` row for the current user, and a rank-change
badge per row.

`apps/api/src/jobs/leaderboardRollover.job.js` — `node-cron` fires
`runRollover('weekly')` every Monday 00:00 UTC and `runRollover('monthly')`
on the 1st, each freezing the period that just ended into
`LeaderboardSnapshot` (so the podium doesn't shift after the fact) and
calling `announceWinners()`:

- **Slack** — posts to `SLACK_WEBHOOK_URL`; unset in dev, so it logs the
  message instead (same pattern as the email/dev-log fallback from Phase 2).
- **Intraweb site** — stubbed: logs a generated announcement post to paste
  in manually, until the target CMS/API is known.
- **WhatsApp** — intentionally not implemented; needs a provider decision
  (WhatsApp Business Platform vs. Twilio) and a pre-approved template,
  outside this codebase's control (build plan §6).

`runRollover(period, referenceDate?)` is exported standalone, so it can be
run manually without waiting for a real cron tick — useful for verifying
this job in dev.

## Dev commands

```bash
npm install          # install all workspaces
npm run dev:web       # start the Vite dev server
npm run dev:api       # start the Express dev server
npm run lint           # eslint across the monorepo
npm run format          # prettier --write across the monorepo
```
