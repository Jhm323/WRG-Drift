---
name: run-dirtcar-drift
description: Build, run, and drive DirtCar Drift Challenge (apps/api + apps/web together, or the game engine standalone). Use when asked to start the app, run the dev servers, take a screenshot of the UI or the game canvas, verify the signup/login/leaderboard flow end-to-end, or test apps/web/src/game changes.
---

Full-stack app: Express API (`apps/api`) + Vite/React frontend (`apps/web`),
sharing one Postgres database and cookie-based auth. The two are driven
**together** — the browser flow (signup → verify → login → protected
routes) is the thing worth proving works, and it needs both up. Drive it
via `.claude/skills/run-dirtcar-drift/driver.mjs`, a headless-Chromium
script (no `chromium-cli` available in this environment, so this is a
one-shot Playwright driver instead) that boots both servers, runs the
flow, and screenshots each step.

All paths below are relative to the repo root.

## Prerequisites

Local Postgres (Homebrew, not Docker — `npx prisma dev`, Prisma's own
bundled local DB, errors out under this Node version):

```bash
brew install postgresql@16
brew services start postgresql@16
createdb dirtcar_drift_dev
```

Node v22.6+ is required — the API's Prisma client is generated as
TypeScript (`apps/api/generated/prisma/client.ts`) and is loaded via
Node's native type-stripping, no build step. This repo was verified on
Node v26.

## Setup

```bash
npm install                       # installs all workspaces + Playwright (root devDependency)
npx playwright install chromium   # no-op if already cached

cd apps/api
cp .env.example .env
# .env needs real values for:
#   DATABASE_URL  -> postgresql://<your-os-user>@localhost:5432/dirtcar_drift_dev?schema=public
#   JWT_SECRET    -> any long random string, e.g.: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# RESEND_API_KEY can stay blank — see Gotchas.
npm run prisma:migrate
npm run prisma:seed
cd ../..
```

## Run (agent path)

```bash
node .claude/skills/run-dirtcar-drift/driver.mjs
```

This boots `apps/api` (port 4000) and `apps/web` (port 5173), waits for
both to actually respond, then drives one full user flow in headless
Chromium: unauthenticated `/tracks` → redirected to `/login`; sign up
with an avatar pick; pull the verification link out of the API's console
log; verify; log in; confirm the header shows the session; navigate to
`/leaderboard`; log out; confirm the route guard re-fires. It prints a
`[PASS]`/`[FAIL]` line per step, kills both servers on exit (success or
failure), and exits non-zero if anything failed.

Screenshots → `/tmp/dirtcar-drift-shots/` (`1-login.png`,
`2-signup-filled.png`, `3-tracks-loggedin.png`, `4-leaderboard.png`, plus
`error.png` if a step throws). Server logs → `/tmp/dirtcar-drift-api.log`
and `/tmp/dirtcar-drift-web.log`.

The driver creates a fresh timestamped `@dirtcar.com` account each run,
so it's safe to re-run without cleaning the DB between runs.

## Direct invocation (API-only changes)

For backend-only work, skip the browser and hit the API directly —
faster, and this is how Phases 1–2 were actually verified:

```bash
cd apps/api && node server.js &
curl -s http://localhost:4000/health
curl -s -X POST http://localhost:4000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@dirtcar.com","password":"password123","displayName":"Test","avatarUrl":"/avatars/avatar-1.svg"}'
# verification link is logged to stdout when RESEND_API_KEY is unset
```

## Game-engine-only testing (no API, no auth needed)

For changes confined to `apps/web/src/game` (Phase 4+), skip the API and
auth flow entirely — `apps/web/test.html` is a bare-HTML harness with no
React and no login gate. Drive it with:

```bash
node .claude/skills/run-dirtcar-drift/driver-engine.mjs
```

Boots just the Vite dev server (port 5173), then in headless Chromium:
confirms an idle (zero-key) run never starts the timer (the car waits for
the first ArrowLeft/ArrowRight keydown), confirms steered play (alternating
left/right taps) survives and scores points, confirms driving dead straight
off a curving track crashes the run, and confirms the track dropdown
switches and restarts on a new track. `[PASS]`/`[FAIL]` per check,
non-zero exit on failure, kills the server on exit either way.

Screenshots → `/tmp/dirtcar-drift-engine-shots/`. Log →
`/tmp/dirtcar-drift-web.log`.

To play it by hand instead: `cd apps/web && npm run dev`, then open
`http://localhost:5173/test.html` — track dropdown, canvas, live
score/time HUD, hold ← or → to drift (press either to start).

## Run (human path)

```bash
npm run dev:api    # terminal 1 — http://localhost:4000
npm run dev:web    # terminal 2 — http://localhost:5173
```

## Test

```bash
npm run lint     # eslint across the monorepo
npm run format    # prettier --write
```

There's no automated test suite yet (Phase 9's testing strategy —
Vitest/Supertest for the API, Playwright e2e — hasn't been built out).

## Gotchas

- **`npx prisma dev` (Prisma's bundled local Postgres) throws `Dynamic
require of "assert" is not supported`** under this Node version. Use
  Homebrew Postgres (see Prerequisites) instead — don't debug this path.
- **`apps/web/src/game/tracks/geometry.js` and `apps/api/prisma/seed.js`
  must stay in sync** — both generate the same centerline curve + ribbon
  width per track from identical formulas. The client plays against
  `geometry.js`; the server's anti-cheat replay (`apps/api/src/services/scores.service.js`)
  replays against whatever's stored in the `tracks.config` column, which
  `seed.js` populates. If you change a track's curve or `ribbonWidth`,
  update both files and re-seed (`npm run prisma:seed` in `apps/api`), or
  the client and server will disagree on where the track edge is.
- **Prisma 7 requires a driver adapter.** There's no bare
  `DATABASE_URL` client anymore — `apps/api/src/lib/prisma.js` wires
  `@prisma/adapter-pg` explicitly. If you ever regenerate the Prisma
  client and it stops working, check that file first.
- **`RESEND_API_KEY` unset is the intended dev state, not a broken
  config.** `apps/api/src/services/email.service.js` logs the
  verification/reset link to stdout instead of sending real email. The
  driver reads that log to complete signup — if you swap in a real key,
  the driver's log-scraping step will stop finding a link.
- **The Vite dev proxy (`apps/web/vite.config.js`) forwards `/auth` and
  `/api` to port 4000**, so the frontend can call relative paths and
  cookies stay same-origin in dev. If you change the API port, update
  the proxy too or auth cookies won't be set.
- **`react/prop-types` is off** in the root `.eslintrc.cjs` override for
  `apps/web/**` — this codebase has no PropTypes/TypeScript, so don't
  expect that rule to catch prop mistakes.

## Troubleshooting

- **`Missing apps/api/.env`** (driver exits immediately): run the Setup
  steps above — `.env` is gitignored and must be created locally.
- **`[FAIL] api boots`**: check `/tmp/dirtcar-drift-api.log`. Usually
  means Postgres isn't running (`brew services start postgresql@16`) or
  `.env`'s `DATABASE_URL` doesn't match the actual DB user/name.
- **`EADDRINUSE` on port 4000 or 5173**: something didn't get cleaned up
  from a previous run. `lsof -ti:4000 -sTCP:LISTEN | xargs -r kill` (and
  `5173`) before retrying — the driver does this itself on start, but a
  killed-mid-run driver can leave stragglers.
