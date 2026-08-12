# GRUDGE

Top-down 3D web action game. Souls-like difficulty, physics-driven combat,
procedural rival enemies that remember you. Built primarily by AI agents.

**The hook:** your cursor _is_ the sword tip. Not a button. The blade is a
physics point-mass on a stiff spring toward your cursor — it carries momentum,
commits to swings, and drags your body along once it's stretched past reach.
Fast clean cuts kill; slow pokes barely scratch.

## Quickstart

```
npm i
npm run dev
```

## Controls

| Input                     | Does                                                          |
| ------------------------- | ------------------------------------------------------------- |
| Cursor                    | Sword tip — the blade goes where you point, with momentum     |
| Drag far from your body   | Body walks to keep up (past the "walk zone")                  |
| Right-click (hold)        | Plant feet — stand your ground, pure swordplay, no body chase |
| Touch: drag               | Sword tip follows your finger                                 |
| Touch: second finger down | Plant feet (touch equivalent of right-click)                  |

## Scripts

| Command             | Does                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start Vite dev server                      |
| `npm run build`     | Typecheck + production build               |
| `npm run typecheck` | `tsc --noEmit`                             |
| `npm run lint`      | ESLint                                     |
| `npm run test`      | Headless sim/unit tests (Vitest)           |
| `npm run test:e2e`  | Browser smoke tests (Playwright)           |
| `npm run verify`    | typecheck + lint + test + build, all of it |

## Architecture, in 5 bullets

- **Sim/render split, enforced by ESLint:** gameplay logic (`src/core`,
  `src/systems`, `src/components`, `src/content`) never imports Three.js or
  touches the DOM. Rendering is a read-only view of ECS state.
- **Fixed 60Hz timestep** (`SIM_DT = 1/60`); gameplay reasons only in sim time,
  never wall-clock. Render interpolates between steps.
- **bitECS 0.3.40**, classic API (`defineComponent`/`Types`/`defineQuery`) —
  pinned deliberately, see the ADR.
- **All sim randomness is seeded** (`src/core/rng.ts`) — same seed, same run,
  which is what makes deterministic tests and replays possible.
- **Events are the only sim→presentation channel** besides direct ECS reads
  (`src/core/events.ts`) — no callbacks reaching back into sim state.

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — the contract for agents working on this repo.
  Read it first.
- [`ROADMAP.md`](./ROADMAP.md) — pillars, phases, milestone gates.
- [`docs/design/`](./docs/design) — combat and rivals design docs.
- [`docs/decisions/`](./docs/decisions) — architecture decision records (ADRs).
