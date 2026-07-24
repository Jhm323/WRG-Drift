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

Phase 0 (repo scaffold), Phase 1 (backend skeleton + DB), and Phase 2
(auth) done. `apps/web` is still an empty workspace placeholder — its
`dev` script will fail until Phase 3.

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

## Dev commands

```bash
npm install          # install all workspaces
npm run dev:web       # start the Vite dev server (Phase 3+)
npm run dev:api       # start the Express dev server
npm run lint           # eslint across the monorepo
npm run format          # prettier --write across the monorepo
```
