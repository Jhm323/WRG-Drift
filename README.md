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

Phase 0 (repo scaffold) only. `apps/web` and `apps/api` are empty
workspace placeholders — running their `dev` scripts will fail until
their respective build phases are done.

## Dev commands (once later phases are built)

```bash
npm install          # install all workspaces
npm run dev:web       # start the Vite dev server
npm run dev:api       # start the Express dev server
npm run lint           # eslint across the monorepo
npm run format          # prettier --write across the monorepo
```
