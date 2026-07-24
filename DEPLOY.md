# Deploying DirtCar Drift Challenge

Frontend on Vercel, backend + Postgres on Render — per
`dirtcar-drift-game-build-plan.md` §2. This doc covers the actual setup:
required env vars, the deploy order (there's a circular dependency between
the two services' URLs), the DNS record for a custom domain, and one
non-obvious fix this monorepo needed to work cross-origin at all.

This is a guide for you to follow — it doesn't deploy anything itself.
Creating the Vercel/Render projects, entering billing details, and
changing DNS are your call to make with your own accounts.

## Architecture

```
play.dirtcar.com (Vercel, static)  --https-->  dirtcar-drift-api.onrender.com (Render, Node)
                                                          |
                                                   Render Postgres
```

Frontend and API are on **different domains** — there's no shared parent
domain to make this same-site. That matters for the auth cookie (see
Gotchas below).

## Prerequisites

- A Vercel account and a Render account.
- Push access to this repo (both platforms deploy from a connected Git repo).
- DNS access for `dirtcar.com` (to point `play.dirtcar.com` at Vercel).
- A Resend account + verified sending domain, if you want real emails
  instead of the dev-mode console log (optional to start).
- A Slack incoming webhook URL, if you want real podium posts instead of
  the dev-mode console log (optional to start).

## 1. Backend + Postgres (Render)

This repo includes `render.yaml` at the root — a Blueprint that creates
the API web service and a Postgres database together. In the Render
dashboard: **New → Blueprint**, point it at this repo. Verify the
generated plan against Render's current Blueprint docs before confirming —
this file was written from documentation, not a live deploy.

If you'd rather set it up by hand instead of the Blueprint:

- **New → Web Service**, connect this repo.
- Runtime: Node. Since this is an **npm workspaces monorepo**, run
  install/build from the **repo root**, not `apps/api` — `@dirtcar-drift/shared`
  only resolves via npm's workspace symlinking when `npm install` runs at
  the root.
  - Build command: `npm install && npm run prisma:generate --workspace apps/api && npm run prisma:migrate:deploy --workspace apps/api`
  - Start command: `npm run start --workspace apps/api`
- **New → PostgreSQL** for the database.

### Required env vars (Render dashboard → your service → Environment)

| Var                 | Value                                        | Notes                                                                           |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                 | Flips the auth cookie to `SameSite=None; Secure` — see Gotchas                  |
| `DATABASE_URL`      | from the Render Postgres instance            | Blueprint wires this automatically                                              |
| `JWT_SECRET`        | random string                                | Blueprint auto-generates this                                                   |
| `SCORE_HMAC_SECRET` | random string                                | Blueprint auto-generates this; separate from `JWT_SECRET` on purpose            |
| `CORS_ORIGIN`       | `https://play.dirtcar.com`                   | **Set after the frontend is deployed** — see §3 deploy order                    |
| `WEB_BASE_URL`      | `https://play.dirtcar.com`                   | Used to build password-reset links                                              |
| `API_BASE_URL`      | `https://<your-render-service>.onrender.com` | Used to build email-verification links                                          |
| `RESEND_API_KEY`    | your key, or leave blank                     | Blank = verification/reset emails log to Render's log stream instead of sending |
| `RESEND_FROM_EMAIL` | e.g. `DirtCar Drift <noreply@dirtcar.com>`   | Needs a domain verified in Resend                                               |
| `SLACK_WEBHOOK_URL` | your webhook, or leave blank                 | Blank = podium announcements log instead of posting                             |
| `PORT`              | leave unset                                  | Render sets this itself; the app already reads `process.env.PORT`               |

## 2. Frontend (Vercel)

**New Project**, import this repo. Same monorepo caveat as the backend —
`apps/web` depends on the workspace-linked `@dirtcar-drift/shared`:

- **Root Directory**: leave as the repo root (don't point Vercel at `apps/web` — that skips the root `npm install` needed for workspace linking).
- **Build Command**: `npm install && npm run build --workspace apps/web`
- **Output Directory**: `apps/web/dist`

### Env vars (Vercel dashboard → Settings → Environment Variables)

| Var                 | Value                                        |
| ------------------- | -------------------------------------------- |
| `VITE_API_BASE_URL` | `https://<your-render-service>.onrender.com` |

### Custom domain

Vercel → Settings → Domains → add `play.dirtcar.com`. Vercel shows the
exact record to add; typically a `CNAME` at your DNS provider:

```
play.dirtcar.com.   CNAME   cname.vercel-dns.com.
```

(Vercel's dashboard will show the current expected target — use what it
displays, the above is illustrative.)

## 3. Deploy order (breaks the circular dependency)

The API needs the frontend's URL (`CORS_ORIGIN`) and the frontend needs
the API's URL (`VITE_API_BASE_URL`) — deploy in this order:

1. Deploy the **API** first, with `CORS_ORIGIN` left blank/unset for now
   (the API still runs; cross-origin requests just won't work yet).
2. Note the API's `https://*.onrender.com` URL.
3. Deploy the **frontend** with `VITE_API_BASE_URL` set to that URL.
4. Add the `play.dirtcar.com` custom domain in Vercel, update DNS.
5. Go back to Render, set `CORS_ORIGIN` to `https://play.dirtcar.com`
   (or the `.vercel.app` URL if not using the custom domain yet), and
   redeploy the API so it picks up the new env var.

## Gotchas

- **The auth cookie needed a cross-origin fix.** It was originally
  `SameSite=Lax`, which only works because local dev is same-site (Vite
  proxies `/auth` and `/api` to the API). In production, Vercel and Render
  are genuinely different domains — a `Lax` cookie is never sent on
  cross-site `fetch`/XHR (only top-level navigation), so login would
  appear to succeed but every subsequent authenticated request would
  silently fail. Fixed in `apps/api/src/controllers/auth.controller.js`:
  `NODE_ENV=production` now sets `SameSite=None; Secure` instead. `None`
  requires `Secure` (HTTPS-only), which both Vercel and Render provide by
  default — no extra config needed there.
- **`CORS_ORIGIN` can't be a wildcard.** `cors` is configured with
  `credentials: true`, and browsers reject wildcard (`*`) origins on
  credentialed requests. It must be the exact frontend origin.
- **Don't point either platform's root directory at the app subfolder.**
  Both `apps/web` and `apps/api` depend on `@dirtcar-drift/shared` via npm
  workspaces, which only links correctly when `npm install` runs at the
  repo root.
- **Node 22.6+ required** — the API's Prisma client is generated as
  TypeScript and loaded via Node's native type-stripping, no build step.
  Both `package.json` files now declare `"engines": { "node": ">=22.6.0" }`;
  confirm Render is actually provisioning a Node version that satisfies it.
- **Render's free Postgres expires after 90 days** (data deleted), per the
  build plan's known limitations (§2). Fine to start at <100 users; upgrade
  to a paid Postgres plan before the 90 days are up if leaderboard history
  starts to matter — no schema or code changes needed, just a plan change.
- **WhatsApp podium announcements are still a TODO stub** — needs a
  provider decision (WhatsApp Business Platform vs. Twilio) and a
  pre-approved message template, outside this codebase's control. See
  `apps/api/src/services/announcement.service.js`.

## Post-deploy smoke test

1. Visit `https://play.dirtcar.com` → redirects to `/login`.
2. Sign up with a `@dirtcar.com` email → check Render's log stream for the
   verification link (or your inbox, if `RESEND_API_KEY` is set) → verify.
3. Log in → confirm you land on `/tracks` and **stay logged in on a page
   reload** (this is the specific case that silently breaks if the cookie
   fix above didn't take — a reload calls `GET /auth/me` cross-origin).
4. Play a track, confirm the run POSTs successfully and the score appears
   correctly (not as a "could not save this run" note).
5. Check `/leaderboard` renders.
