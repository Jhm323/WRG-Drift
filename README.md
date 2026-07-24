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
Phase 3 (frontend skeleton + auth UI), and Phase 4 (game engine) done.
The engine isn't wired into React/the track-select UI yet — that's
Phase 5.

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
session, backed by `GET /auth/me` on load. Track select, gameplay, and
leaderboard pages are still placeholders — they're built out in Phases
4–7.

## Game engine (Phase 4)

`apps/web/src/game` is a framework-agnostic canvas engine — no React import
anywhere in it:

- `tracks/` — the 3 tracks (`oval-loop`, `figure-8`, `switchback-canyon`),
  generated with the same parametric math as `apps/api/prisma/seed.js` so
  the client-rendered shape matches what's in the DB under the same `id`.
- `drift.js` — pure, deterministic simulation: `simulateRun(track, trackIndex, clickTimestampsMs, { stopAtMs })`
  replays a run from `t=0` given only the recorded click timestamps. No
  wall-clock reads, no randomness — same inputs always produce the same
  output, which is what will let `scoring.js` become the server-side
  anti-cheat authority once it moves to `packages/shared` in Phase 6.
- `scoring.js` — `computeScore(track, clickTimestampsMs)`, pure, returns
  `{ score, gatesCleared, gatesTotal, crashed, durationMs }` (maps directly
  onto the `Run` model for Phase 6's `POST /api/v1/scores`).
- `input.js` — click capture, `engine.js` — the `requestAnimationFrame`
  loop tying simulation + rendering + input together.

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

## Dev commands

```bash
npm install          # install all workspaces
npm run dev:web       # start the Vite dev server
npm run dev:api       # start the Express dev server
npm run lint           # eslint across the monorepo
npm run format          # prettier --write across the monorepo
```
