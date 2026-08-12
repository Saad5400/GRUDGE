# GRUDGE — Project Roadmap

Top-down 3D web action game. Souls-like difficulty, physics-driven combat,
procedural rival enemies with memory. Targets desktop + mobile browsers. Built
primarily by AI agents.

## Pillars

1. Combat feel first (hit-stop, knockback, screen shake, sound).
2. Physics is a weapon (ragdolls, throws, environment kills).
3. Hard but fair (telegraphs, stamina, death cost).
4. Rivals remember (named enemies persist, promoted, scarred — differentiated
   from WB patent US 10,926,179; see `docs/design/rivals.md`).
5. 60fps on mid-range phones.

## Stack

Three.js, TypeScript strict, ECS (bitECS 0.3.40), Vite, DOM HUD, Zustand
(meta state), Howler (audio), localforage (saves), Vitest + Playwright,
static + PWA deploy. Physics: custom deterministic 2.5D sim physics (spring/impulse,
circle colliders). Rapier was the original plan — deferred until ragdolls/debris/
environmental objects need a real rigid-body engine. See
`docs/decisions/0001-tech-stack.md` and `docs/decisions/0002-custom-sim-physics-rapier-deferred.md`.

## Combat model — cursor is the sword (see `docs/design/combat.md`)

Adopted from `reference/dungeon-brawler.html` (see
`docs/decisions/0003-cursor-is-the-sword.md`), replacing the originally-specced
button-based light/heavy attack scheme:

- The mouse/touch cursor **is** the sword tip: a physics point-mass on a stiff
  spring toward the aim point, with momentum, commitment (resists reversal
  mid-swing), and a reach constraint that drags the body along past a threshold.
- **Dodge-roll → replaced** by momentum-based repositioning (walk zone: body
  chases the cursor only past a distance threshold) + a planted stance
  (right-click / second touch: stand ground, no body chase — pure swordplay).
- **Light/heavy attack buttons → replaced** by blade speed: there is no attack
  button. Fast, clean cuts do more damage; slow contact does less. Damage is
  speed-gated, not input-gated.
- Parry is kept as a **future** timing mechanic against telegraphed attacks
  (Phase 2+), not part of the initial port.

## Phases

- [x] **Phase 0 — Foundations.** Repo scaffold, CI, ECS component stores, fixed
      timestep loop, seeded RNG, event bus, input→intents abstraction, debug
      overlay wiring, CI pipeline (typecheck/lint/test/build + e2e). _Essentially
      done: `src/core/*`, `src/components/index.ts`, `src/content/arena.ts`,
      `.github/workflows/ci.yml`, `main.ts` composition root are in place._
- [ ] **Phase 1 — Core prototype.** _In flight, via the demo port._ Camera,
      cursor-sword combat (spring/reach/commitment), player controller, stamina
      (drain above blade speed 8, regen below 4.5), dummy/slime/brute enemies,
      hitbox/hurtbox via swept blade segment, wave spawner, game-feel pass
      (hit-stop, screen shake, knockback, i-frames). Exit: killing one enemy is
      satisfying.
- [ ] **Phase 2 — Combat vertical slice.** Combo streak meter, charged
      abilities (Execution, Ground Slam), grab & throw, environmental kills, group
      AI attack tokens (limit simultaneous attackers). Parry vs. telegraphed
      attacks introduced here. Exit: a 3-minute arena fight is fun.
- [ ] **Phase 3 — Souls-like structure.** Archetypes (grunt/shield/berserker/
      archer), telegraph AI, death cost (XP drop on death, recoverable), checkpoints,
      healing charges, difficulty data pass.
- [ ] **Phase 4 — Rivals.** Procedural captains with names/personality/
      strengths/weaknesses, memory + taunts, Domination ability, IndexedDB
      persistence (via localforage), intro cinematics, ambushes. Design doc first —
      see `docs/design/rivals.md`.
- [ ] **Phase 5 — Progression.** Skill tree, ability perks, rival gear drops,
      runes.
- [ ] **Phase 6 — Content.** Room-based semi-procedural dungeons, 3 biomes,
      physics-gimmick bosses.
- [ ] **Phase 7 — Mobile & perf.** Quality tiers, instancing, pooling, touch
      UX, thermal testing, PWA packaging.
- [ ] **Phase 8 — Polish & launch.** Audio, VFX, onboarding, saves/
      accessibility, analytics, itch.io release.

## Milestone gates

- **P1:** one satisfying kill.
- **P2:** a 3-minute group fight is fun.
- **P4:** players talk about their rival.
- **P7:** 60fps on a 3-year-old phone.

## Agent-friendliness

This project is built primarily by AI agents. Optimize for that:

- Read `CLAUDE.md`, `docs/design/`, `docs/decisions/` before touching code.
- One system, one file (`src/systems/`); balance changes are content-file
  edits only (`src/content/`); every system ships a headless sim test.
- Prefer well-trodden, heavily-documented APIs over newer/less-documented ones
  when both are viable — see `docs/decisions/0004-bitecs-0.3-pin.md` for the
  reasoning (bigger training corpus → more reliable agent output).
- Sim/render separation is enforced by ESLint, not just convention — a lint
  error on a sim-path import of Three.js/DOM is a real bug, fix the
  architecture, don't suppress the rule.

## Legal note

The rivals system (Phase 4) is deliberately differentiated from WB's Nemesis
patent, US 10,926,179. See the required "Differentiation" section in
`docs/design/rivals.md`. Get real legal review before monetizing anything in
that system.
