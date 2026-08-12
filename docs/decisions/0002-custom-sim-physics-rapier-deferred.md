# 0002 — Custom deterministic 2.5D sim physics; Rapier deferred

- Status: accepted
- Date: 2026-08-12

## Context

The original spec assumed a general physics engine (Rapier) for gameplay
collision/movement. The adopted combat identity (see ADR 0003) is a port of
`reference/dungeon-brawler.html`, whose feel comes entirely from bespoke
spring/impulse code: a spring-mass sword tip with commitment damping, a reach
constraint that drags the body, exponential velocity decay tuned per context
(planted/moving/idle), and circle colliders against static pillars/arena
bounds. None of this is "let a rigid-body solver figure it out" — it's
hand-tuned scalar math against a handful of specific constants (spring
stiffness 42, reach 2.9, etc. — see `docs/design/combat.md`).

Separately, the sim must be deterministic and headless: fixed 60Hz timestep,
seeded RNG, no DOM/Three.js in gameplay code (see `CLAUDE.md`), so that
`tests/sim/*` can run without a browser and produce reproducible results
across machines.

## Decision

Gameplay sim physics is **custom deterministic 2.5D code** — the demo's
spring/impulse/collision math ported directly into `src/systems/` (each system
its own file, tunables in `src/content/`). Circle colliders on the ground
plane (player, enemies, pillars) are sufficient for all currently-planned
gameplay. **Rapier is deferred**, not adopted for Phase 0/1.

Revisit at **Phase 2** (grab & throw, environmental kills), when ragdolls,
thrown debris, or stacked physics props start to need real rigid-body
dynamics that hand-rolled code won't scale to cleanly.

## Consequences

- Porting the demo's feel is direct and low-risk: the demo's math IS the spec,
  translated into ECS systems, not reimplemented against an engine's
  abstractions that would change how it feels.
- Determinism is straightforward to guarantee: no engine internals, no
  platform-dependent floating point quirks from a WASM physics library, no
  async engine init — every system is `f(state, dt, rng) -> state`, directly
  testable headless in Vitest.
- Bundle size and load time stay small (no physics engine WASM blob) through
  Phase 1.
- Cost: circle colliders and scalar spring math don't generalize to 3D rigid
  bodies. When Phase 2 needs throws/ragdolls, expect either (a) extending the
  custom sim with more bespoke code, or (b) introducing Rapier at that point
  as a genuinely new dependency with its own determinism/testing story to
  solve. This ADR doesn't pre-decide which; that's Phase 2's problem.
