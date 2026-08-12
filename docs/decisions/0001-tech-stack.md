# 0001 — Tech stack

- Status: accepted
- Date: 2026-08-12

## Context

GRUDGE is built primarily by AI agents, targets desktop + mobile browsers, and
needs a stack where docs, examples, and training-data coverage are strong
enough for agents to produce correct code with minimal hand-holding. It also
needs a headless-testable sim core (deterministic, fast, no browser) separate
from a 3D renderer.

## Decision

| Layer                     | Choice                                                   |
| ------------------------- | -------------------------------------------------------- |
| Rendering                 | Three.js                                                 |
| Language                  | TypeScript, strict mode                                  |
| Entity data               | bitECS (pinned 0.3.40 — see ADR 0004)                    |
| Build/dev                 | Vite                                                     |
| UI/HUD                    | plain DOM                                                |
| Meta/persistent app state | Zustand                                                  |
| Audio                     | Howler                                                   |
| Save persistence          | localforage                                              |
| Testing                   | Vitest (headless sim/unit) + Playwright (e2e/browser)    |
| Deploy                    | static hosting + PWA                                     |
| Gameplay physics          | custom deterministic 2.5D sim (see ADR 0002; not Rapier) |

Rationale beyond the obvious (mature, well-documented, widely-used choices):
this project is agent-first. Every one of these libraries has a large public
corpus of examples and Q&A, which measurably improves agent output quality
versus niche or bleeding-edge alternatives. Where a newer/less-documented
option would otherwise be technically preferable (see ADR 0004 on bitECS
0.4), agent-friendliness is a real, explicit factor in the decision — not an
afterthought.

## Consequences

- Agents can lean on broad public knowledge for Three.js/Vite/Vitest/Playwright
  without repo-specific hand-holding.
- Sim core (`src/core`, `src/systems`, `src/components`, `src/content`) stays
  headless and Three.js-free by construction — enforced by ESLint, not just
  discipline (see `eslint.config.js`, `CLAUDE.md`).
- Physics is NOT a general-purpose engine (see ADR 0002) — anything that later
  needs real rigid-body dynamics (ragdolls, debris, stacked physics props) will
  require introducing Rapier or similar at that point, not before.
