# CLAUDE.md — contract for agents working on GRUDGE

GRUDGE: top-down 3D web action game. Souls-like difficulty, physics-driven sword
combat (your cursor IS the sword tip), procedural rival enemies with memory.
Built primarily by AI agents. Read this file, then `docs/design/` and
`docs/decisions/` before changing anything.

## Commands

| Command             | Does                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | Vite dev server                                                    |
| `npm run build`     | `tsc --noEmit` + vite build                                        |
| `npm run typecheck` | `tsc --noEmit`                                                     |
| `npm run lint`      | ESLint over `src` + `tests`                                        |
| `npm run test`      | Vitest headless sim/unit tests (`tests/sim`, `tests/unit`)         |
| `npm run test:e2e`  | Playwright, drives the built app in a browser                      |
| `npm run verify`    | typecheck + lint + test + build — run before calling anything done |

## Architecture rules (non-negotiable)

1. **Sim/render separation.** `src/core`, `src/systems`, `src/components`,
   `src/content`, `src/game.ts` are headless gameplay logic. They **never** import
   Three.js, Howler, or touch the DOM (`document`/`window`/`navigator`). ESLint
   (`eslint.config.js`) enforces this with `no-restricted-imports` /
   `no-restricted-globals` on those paths — a lint failure here is a real
   architecture violation, not a style nit.
2. **Rendering is a read-only view of ECS state.** `src/render` reads
   `Transform`/`Velocity`/etc. off the bitECS world and events off the event bus.
   It never mutates sim state and never drives gameplay decisions.
3. **Fixed timestep.** `SIM_DT = 1/60` (`src/core/loop.ts`). Gameplay code only
   ever advances by `SIM_DT` and only ever reasons in sim time (`GameState.time`),
   never wall-clock time (`performance.now()`, `Date.now()`) or per-frame `dt`.
   Rendering interpolates with an `alpha` between sim steps; it may use wall-clock
   time for cosmetic-only motion (torch flicker, camera shake jitter).
4. **All sim randomness goes through `Rng`** (`src/core/rng.ts`, seeded
   mulberry32). `Math.random()` is forbidden anywhere under the headless paths
   listed in rule 1. Same seed → same simulation — this is what makes replays and
   deterministic headless tests possible. `Math.random()` is allowed in `src/render`
   for purely cosmetic jitter that never feeds back into sim state (particle
   drift, flame flicker) — never for anything that affects hits, spawns, or damage.

## Repo layout

| Path              | Contents                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`       | Contracts: `types.ts` (Game/Intents/GameState/GameView), `loop.ts` (fixed timestep), `rng.ts`, `events.ts` (EventBus), `math.ts`. Headless. |
| `src/components/` | bitECS component stores (SoA, data-only). Headless.                                                                                         |
| `src/systems/`    | One system, one file. Headless. Each ships a vitest sim test.                                                                               |
| `src/content/`    | All tunables as plain data (e.g. `arena.ts`). No logic.                                                                                     |
| `src/game.ts`     | Composes systems into `Game.step()`. Headless.                                                                                              |
| `src/render/`     | Three.js scene, `GameView` implementation. Reads ECS state only.                                                                            |
| `src/input/`      | Mouse/touch/gamepad → `Intents`. The sim never knows the device.                                                                            |
| `src/ui/`         | DOM HUD.                                                                                                                                    |
| `src/audio/`      | Howler, driven by events.                                                                                                                   |
| `src/debug/`      | Debug overlay.                                                                                                                              |
| `tests/sim/`      | Headless vitest tests against `Game`/systems. No DOM, no Three.                                                                             |
| `tests/e2e/`      | Playwright, drives the built app in a real browser.                                                                                         |
| `reference/`      | Source demos being ported (e.g. `dungeon-brawler.html`). Read, don't edit.                                                                  |

## Conventions

- Every gameplay system in `src/systems/` ships a headless vitest test in
  `tests/sim/`. No test, no merge.
- Balance/tuning changes are **content-file edits only** (`src/content/*.ts`).
  Never hardcode a tunable number inside a system.
- New behavior = a new system file. Do not spread one feature's logic across
  five existing files — if you're touching more than one or two files for a
  single new mechanic, you're probably missing a system boundary.
- The **only** channels from sim to presentation are (a) events on the
  `EventBus` (`src/core/events.ts`) and (b) direct reads of ECS component state.
  Presentation never reaches back into sim internals.

## bitECS version note

Pinned to **0.3.40** — the classic API (`defineComponent`, `Types`,
`defineQuery`). Do **not** use 0.4.x API (`defineComponent`-free tag components,
new query syntax) — it will not compile against this pin. See
`docs/decisions/0004-bitecs-0.3-pin.md` for why.

## Before changing anything

Read `docs/design/` (combat, rivals) and `docs/decisions/` (ADRs) first. They
record the actual decisions and the reasoning behind them — don't re-derive or
contradict them without reading why they were made.
