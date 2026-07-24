# DirtCar Drift Challenge — Build Plan

A company-culture drifting game: employees log in, drift tracks with mouse
clicks, chase high scores, and climb weekly/monthly leaderboards that feed
your podium recognition.

---

## 1. Goals & Constraints (confirmed)

| Decision | Choice |
|---|---|
| Hosting model | Standalone site on its own subdomain (e.g. `play.dirtcar.com`), linked from the main company site |
| Auth | Email + password, **restricted to `@dirtcar.com`**, one account per email, **email verification required before login** |
| Scale | Small (<100 employees) — free-tier hosting is fine to start; some data loss risk is acceptable |
| Infra | Greenfield — recommended stack below |
| Core loop | Click-to-drift, gate-based scoring, multiple tracks |
| Leaderboards | Weekly + Monthly, feeding a "podium" announced via **Slack, intraweb site, and WhatsApp** |

---

## 2. Recommended Stack

**Frontend**
- React 18 + Vite (fast dev server, simple static build)
- Game rendered on HTML5 `<canvas>`, driven by a custom game loop (no heavy
  game engine needed — this is 2D physics-lite, not 3D)
- Plain CSS with **BEM** naming (no Tailwind/CSS-in-JS, so class names stay
  explicit and portable if the game ever gets embedded elsewhere)
- React Router for `/login`, `/signup`, `/tracks`, `/play/:trackId`, `/leaderboard`
- **Route guarding**: `/tracks`, `/play/:trackId`, and `/leaderboard` all
  require a logged-in session — an unauthenticated user hitting any of
  them is redirected to `/login`. Login is the sole gate on playing; there
  is no anonymous/guest play.

**Backend**
- Node.js + Express (REST API)
- Prisma ORM
- PostgreSQL
- JWT auth in an httpOnly cookie, **persistent** (a real expiry, e.g. 7–30
  days, not a session-only cookie) so the browser retains it across
  restarts and users aren't forced to re-login every visit — this is the
  intended behavior, not a security gap to close later
- bcrypt password hashing
- `zod` for request validation
- Transactional email provider (**Resend** recommended — simple API, generous
  free tier) for signup verification links and password reset

**Hosting**
- Frontend → **Vercel** (free tier, auto SSL, custom subdomain, instant rollbacks)
- Backend + Postgres → **Render** (Node web service + managed Postgres,
  free tier to start)
- Alternative if you outgrow it later: Railway or AWS (RDS + ECS/Fargate) —
  Prisma makes that migration low-risk since it isn't tied to a provider.

**Why this combo:** zero server management to start, both platforms have
generous free tiers for an internal tool with modest traffic, and nothing
here locks you in — it's all standard React/Node/Postgres, so a future
migration to AWS or on-prem is a config change, not a rewrite.

**Known limitation, accepted given the small user count:** Render's free
Postgres tier auto-expires (data deleted) after 90 days of the free
instance's lifetime. At <100 users this is an acceptable risk to start;
if the leaderboard history starts to matter, upgrade to Render's paid
Postgres (a few dollars/month) before it expires — no schema or code
changes required, just a plan change in the Render dashboard.

---

## 3. Repository Structure

Monorepo, two workspaces, shared conventions:

```
dirtcar-drift/
├── apps/
│   ├── web/                     # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/      # PascalCase folders, BEM classnames
│   │   │   │   ├── LoginForm/
│   │   │   │   │   ├── LoginForm.jsx
│   │   │   │   │   └── LoginForm.css
│   │   │   │   ├── TrackSelect/
│   │   │   │   ├── Leaderboard/
│   │   │   │   └── GameCanvas/
│   │   │   ├── game/            # pure game engine, framework-agnostic
│   │   │   │   ├── engine.js        # game loop (requestAnimationFrame)
│   │   │   │   ├── drift.js         # drift physics/state machine
│   │   │   │   ├── tracks/          # track data files (JSON/JS)
│   │   │   │   ├── scoring.js
│   │   │   │   └── input.js         # mouse click handling
│   │   │   ├── pages/            # route-level components
│   │   │   ├── hooks/            # useAuth, useLeaderboard, etc.
│   │   │   ├── api/               # fetch wrappers to backend
│   │   │   ├── context/           # AuthContext
│   │   │   └── styles/            # global tokens, BEM base
│   │   └── vite.config.js
│   └── api/                      # Node + Express backend
│       ├── src/
│       │   ├── routes/            # auth.routes.js, scores.routes.js, leaderboard.routes.js
│       │   ├── controllers/
│       │   ├── services/          # business logic (score validation, anti-cheat)
│       │   ├── middleware/        # auth.middleware.js, validate.middleware.js
│       │   └── app.js
│       ├── prisma/
│       │   └── schema.prisma
│       └── server.js
├── packages/
│   └── shared/                    # shared constants/types between web & api (track IDs, scoring rules)
├── .eslintrc.cjs
├── .prettierrc
└── package.json                   # npm workspaces root
```

**Naming conventions**
- Components: `PascalCase` folder + file (`GameCanvas/GameCanvas.jsx`)
- CSS classes: **BEM** — `.leaderboard__row--highlighted`, `.track-card__title`
- JS variables/functions: `camelCase`; constants: `SCREAMING_SNAKE_CASE`
- API routes: kebab-case, versioned: `/api/v1/scores`
- DB tables/columns: `snake_case` (Postgres convention), Prisma models map them to camelCase automatically

---

## 4. Data Model (Prisma schema, conceptual)

```
User
  id                uuid PK
  email             string, unique, must end @dirtcar.com
  passwordHash      string
  displayName       string
  avatarUrl         string
  emailVerified     boolean, default false
  verificationToken string, nullable   # single-use, set on signup, cleared on verify
  createdAt         datetime

Track
  id                string PK (slug, e.g. "canyon-loop")
  name              string
  difficulty        enum(easy, medium, hard)
  pointsMultiplier  float   # scales per-gate and drift-bonus points; harder = higher
  config            json    # gate positions, curve data, par time

Run  (a single play-through / attempt)
  id            uuid PK
  userId        FK -> User
  trackId       FK -> Track
  score         int
  gatesCleared  int
  crashed       boolean
  durationMs    int
  playedAt      datetime
  serverChecksum string   # anti-cheat, see §7

LeaderboardSnapshot (optional, for fast podium queries)
  id, period ("weekly"|"monthly"), periodStart, periodEnd,
  userId, bestScore, rank
```

- **One account per email** → `email` has a DB-level `UNIQUE` constraint, and
  signup validates the domain server-side (`@dirtcar.com`) before insert —
  never trust client-side checks alone.
- **Email verification** → signup creates the user with `emailVerified: false`
  and a random `verificationToken`, then emails a verification link. Login
  is rejected until `emailVerified` is true. This also proves the signer
  actually owns the `@dirtcar.com` inbox, not just that they typed a
  plausible-looking one. The same email provider powers password reset
  (a `passwordResetToken` + expiry, reusing the same send-email plumbing).
- **Leaderboards are computed from `Run`**, not stored redundantly, except
  an optional snapshot table for fast historical podium lookups (see §6).

---

## 5. Game Design (translating the reference game)

Reference mechanic: pick speed/track → click to steer/drift through a
sequence of circular gates → avoid the curb → score = gates cleared cleanly
+ drift style bonus.

Your version:
- Track = a predefined curve path (array of waypoints/gates) stored as JSON
- Car auto-runs forward at a base speed along the track
- Each mouse click = a "drift pulse": rotates the car's heading toward the
  next gate and applies a temporary slide (lateral drift decay curve)
- Scoring:
  - Base +100 per gate cleared cleanly (inside gate bounds), scaled by the
    track's `pointsMultiplier`
  - Drift angle bonus (closer to ideal angle = more points, like real
    drift judging: speed/angle/line), also scaled by `pointsMultiplier`
  - Combo multiplier for consecutive clean gates
  - Crash (hit curb/obstacle) ends the run, locks in score
- **Points scale with difficulty, not just gate count**: an easy track
  earns fewer points per gate/second than a hard track, so grinding an
  easy track can't out-earn genuine skill on a hard one. Exact
  multiplier values (e.g. 1.0× / 1.5× / 2.0×) get tuned during Phase 8
  playtesting — the mechanism is fixed now, the numbers aren't.
- Three initial tracks, each a **distinct shape** rather than a scaled
  copy of one template:
  1. **Easy — Oval Loop** (`oval-loop`): simple rounded oval, wide gates,
     generous tolerance. `pointsMultiplier` ~1.0×
  2. **Medium — Figure-8** (`figure-8`): a crossing figure-eight, tighter
     gates through the crossover point. `pointsMultiplier` ~1.5×
  3. **Hard — Switchback Canyon** (`switchback-canyon`): a canyon road
     with tight hairpin switchbacks, narrow gate tolerance, more gates
     overall. `pointsMultiplier` ~2.0×

This is entirely doable as 2D canvas + vector math — no 3D engine, no
external game framework required, which keeps load time fast and the bundle
small (important for an internal tool people open on a work break).

---

## 6. Leaderboard Logic

- **Weekly**: best `score` per user where `playedAt` falls in the current
  ISO week (Mon–Sun). Query on demand: `MAX(score) GROUP BY userId WHERE playedAt BETWEEN weekStart AND weekEnd`.
- **Monthly**: same, grouped by calendar month.
- Both exposed via `GET /api/v1/leaderboard?period=weekly|monthly&trackId=optional`
- A scheduled job (simple `node-cron` in the API, or Render's cron job
  feature) runs at week/month rollover to snapshot the final standings into
  `LeaderboardSnapshot` — this is what you pull for the physical/virtual
  podium each week/month, so it's frozen and doesn't shift after the fact.

### Podium announcements

The same rollover job that writes the `LeaderboardSnapshot` also fires the
winner announcement, out to three channels:
- **Slack/Teams** — post via an incoming webhook URL (env var), simplest
  integration, do this one first.
- **Intraweb site** — depends on what that platform is (SharePoint? a
  custom CMS?) and whether it has a content API. Until that's confirmed,
  stub this as a generated announcement post (title + winners) that gets
  pasted in manually, and swap in an API call once the target system and
  its auth are known.
- **WhatsApp** — meaningfully heavier than the other two: requires either
  the WhatsApp Business Platform (Meta app review, business verification)
  or a wrapper like Twilio's WhatsApp API (faster to stand up, per-message
  cost, requires a pre-approved message template for outbound
  notifications). Treat this as its own small spike before Phase 7 rather
  than folding it into the leaderboard prompt — needs a decision on
  which provider and a template approved in advance, both of which are
  outside Claude Code's control.

---

## 7. Anti-Cheat / Score Integrity

Since "play as much as you want to chase high score" is the whole point,
scores need to be trustworthy:
- **Never trust a score sent raw from the client.** The client sends the
  full input sequence (click timestamps) and track ID; the server replays
  the deterministic scoring logic (same `scoring.js` logic, shared via the
  `packages/shared` workspace) and computes the authoritative score.
- Rate-limit run submissions per user (e.g. max 1 submission per 3 seconds)
  to block scripted spam.
- Add a lightweight `serverChecksum` (HMAC of run data + secret) so replayed
  or forged payloads are rejected.
- This also means: **build the scoring function once, in `packages/shared`,
  imported by both the canvas game (for live feedback) and the API (for
  authoritative validation)** — don't duplicate the logic.

---

## 8. Iterative Build Plan (with Claude Code prompts)

Work in phases; each phase should end with something runnable and testable
before moving on. Below are the actual terminal commands to run and the
prompts to give Claude Code inside VS Code for each phase.

### Phase 0 — Repo scaffold
```bash
mkdir dirtcar-drift && cd dirtcar-drift
git init
npm init -y
mkdir -p apps/web apps/api packages/shared
```
Claude Code prompt:
> "Set up an npm workspaces monorepo with apps/web (Vite + React), apps/api
> (Express), and packages/shared. Add root ESLint + Prettier config shared
> across workspaces. Add a root README with dev commands."

### Phase 1 — Backend skeleton + DB
```bash
# Local dev DB — Homebrew Postgres (not Docker, not `npx prisma dev`)
brew install postgresql@16
brew services start postgresql@16
createdb dirtcar_drift_dev

cd apps/api
npm init -y
npm install express prisma @prisma/client @prisma/adapter-pg pg bcrypt jsonwebtoken zod cors dotenv
npm install -D nodemon
npx prisma init --datasource-provider postgresql
```

**Prisma 7 notes (this stack pins to Prisma 7, not the 5/6-era API a lot of
older tutorials assume):**
- `npx prisma dev` (Prisma's own bundled local Postgres) errored out under
  newer Node versions — Homebrew Postgres is the reliable local option, so
  that's the setup step above, not a Docker container or a hosted
  `DATABASE_URL` handed to you.
- Prisma 7 requires a **driver adapter** for SQL databases — there's no more
  bare `DATABASE_URL` client. Install `@prisma/adapter-pg` + `pg` and wire
  them through `src/lib/prisma.js`: construct `new PrismaPg({ connectionString:
  process.env.DATABASE_URL })` and pass it as `new PrismaClient({ adapter })`.
- The generated client (`generated/prisma/client.ts`) is **TypeScript**, not
  plain JS. Node runs it directly via native type-stripping (Node 22.6+) —
  no build step or ts-node needed, just `import` it from `.js` files as usual.

Claude Code prompt:
> "Create the Prisma schema for User, Track, Run, LeaderboardSnapshot as
> described in [paste §4]. Add migration, seed script with 3 sample tracks.
> Build Express app.js with /health endpoint and error-handling middleware."

Verify: `npx prisma migrate dev`, `npm run dev`, hit `/health`.

### Phase 2 — Auth
```bash
cd apps/api
npm install resend   # or your chosen transactional email provider
```
Claude Code prompt:
> "Implement signup/login endpoints. Signup validates email ends with
> @dirtcar.com (reject otherwise), hashes password with bcrypt, enforces
> unique email at the DB level with a friendly 409 error on duplicate.
> Create the user with emailVerified: false and a random verificationToken,
> then send a verification email (via Resend) with a link to
> GET /auth/verify?token=... that sets emailVerified: true. Login is
> rejected with a clear error if emailVerified is false. Also add
> POST /auth/forgot-password and /auth/reset-password using a
> passwordResetToken + expiry, reusing the same email plumbing. Login
> issues a JWT in an httpOnly cookie. Add auth middleware that protects
> routes and attaches req.user."

Verify with curl/Postman: signup, duplicate-email rejection, non-dirtcar
email rejection, login blocked pre-verification, verify link flow, login
post-verification, password reset flow, protected-route check.

### Phase 3 — Frontend skeleton + auth UI
```bash
cd apps/web
npm create vite@latest . -- --template react
npm install react-router-dom
```
Claude Code prompt:
> "Build LoginForm and SignupForm components using BEM CSS classes (no
> Tailwind). Add AuthContext + useAuth hook. Wire to the API's
> /auth/signup and /auth/login. Add a simple avatar picker (grid of preset
> avatar images) for signup, matching the User model's avatarUrl."

### Phase 4 — Game engine (build in isolation first)
Claude Code prompt:
> "In apps/web/src/game, build a framework-agnostic canvas game engine:
> engine.js (game loop), tracks/track-1.js (waypoint + gate data), drift.js
> (drift physics: heading, lateral slide decay), input.js (click handler),
> scoring.js (pure function: takes click timestamps + track config, returns
> score). No React yet — this should be testable with plain HTML."

Verify by opening the engine directly in a bare `test.html` before wiring
into React — isolates game bugs from React state bugs.

### Phase 5 — GameCanvas React wrapper + track select
Claude Code prompt:
> "Wrap the game engine in a GameCanvas React component using useRef +
> useEffect for the canvas lifecycle. Build TrackSelect page showing track
> cards (BEM: track-card, track-card__thumbnail, track-card__difficulty).
> On run completion, POST the run (trackId + click timestamps) to
> /api/v1/scores."

### Phase 6 — Server-side scoring + shared logic
Claude Code prompt:
> "Move scoring.js into packages/shared so both apps/web and apps/api can
> import it. Implement POST /api/v1/scores on the backend: recompute the
> score server-side from the submitted click timestamps using the shared
> scoring function, reject if it doesn't match within tolerance, persist
> the Run, rate-limit to 1 submission per 3 seconds per user."

### Phase 7 — Leaderboards
Claude Code prompt:
> "Implement GET /api/v1/leaderboard?period=weekly|monthly with the query
> logic from [paste §6]. Build the Leaderboard React page: two tabs
> (Weekly/Monthly), ranked table with avatar, name, best score, rank
> change indicator. Add a node-cron job that snapshots standings at
> week/month rollover into LeaderboardSnapshot, then posts the winners to
> a Slack incoming webhook (SLACK_WEBHOOK_URL env var) and logs a
> generated announcement post for the intraweb site. Leave WhatsApp
> notification as a TODO stub — that needs a provider decision made
> separately (see §6 Podium announcements)."

### Phase 8 — Polish & QA
- Loading/error states on every API call
- Empty states (no runs yet, empty leaderboard)
- Responsive layout check (people may open this on a phone during a break)
- Lighthouse pass on the built frontend (bundle size, load time)
- Manual playtest across all tracks for balance (is the hardest track
  actually beatable?)

### Phase 9 — Deploy
```bash
# Frontend
cd apps/web && vercel   # link to play.dirtcar.com custom domain in Vercel dashboard

# Backend + DB
# Render: New Web Service (point at apps/api), New PostgreSQL instance
# Set DATABASE_URL, JWT_SECRET, CORS_ORIGIN env vars on Render
```
Claude Code prompt:
> "Add a production build script, .env.example for both apps, and a
> DEPLOY.md documenting the Vercel + Render setup, required env vars, and
> the DNS record needed to point play.dirtcar.com at Vercel."

---

## 9. Testing Strategy

- **Unit**: `scoring.js` and `drift.js` (pure functions — easiest and most
  valuable tests, since these guard score integrity)
- **API integration**: Vitest/Jest + Supertest for auth and scoring routes,
  including the domain-restriction and duplicate-email cases
- **E2E** (optional, later): Playwright — signup → play → appear on
  leaderboard, as one smoke test

---

## 10. Suggested Build Order Recap

1. Repo + DB schema
2. Auth (signup/login, domain lock, unique email)
3. Game engine in isolation (no React)
4. Wire engine into React + track select
5. Server-authoritative scoring
6. Leaderboards (weekly/monthly) + snapshot cron
7. Polish, QA, responsive check
8. Deploy to Vercel + Render, point subdomain

Each phase above is scoped to be a single focused Claude Code session —
give it the relevant prompt, review the diff, run the app, then move to
the next phase rather than asking for the whole app at once. That keeps
quality high and makes it easy to catch issues (like the anti-cheat logic
or the email-domain check) before they're buried under later code.
