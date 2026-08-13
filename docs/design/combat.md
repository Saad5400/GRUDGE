# Combat design — cursor is the sword

Source of truth for the numbers: `reference/dungeon-brawler.html` (the ported
demo). Once `src/content/` lands the real tunables, those files win — this doc
should be updated to match, not the other way around. As of this writing the
constants below are copied straight from the demo; check
`src/content/*.ts` first before trusting a number here.

Decision record: `docs/decisions/0003-cursor-is-the-sword.md`.

## Core model: the sword tip is a spring-mass, not an attack button

There is no "attack" input. The cursor/touch position is a **target**; the
sword tip is a **point mass** that chases it on a stiff spring. This single
system produces aiming, swing commitment, whiff recovery, and repositioning —
no separate state machine needed.

Each fixed tick (`SIM_DT = 1/60`):

1. Aim point = cursor/touch raycast onto the ground plane (y=0).
2. Spring force pulls the tip toward the aim point.
3. Tip velocity integrates the force, damped, capped.
4. If the tip strays past `REACH` from the body, the reach constraint kicks in:
   past `REACH`, it pulls the **body** toward the tip (drag); past
   `REACH + STRETCH`, it hard-clamps the tip radius.
5. Body movement is independent momentum (own spring/accel toward the aim
   point, only outside the walk zone) plus whatever the reach constraint adds.

## Tunables (from the demo — verify against `src/content/*.ts` once landed)

| Constant              | Value              | Meaning                                                                                                                                                                                                       |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tip spring stiffness  | 42                 | Force = `(target − tip) * 42`. Higher = snappier tracking, more overshoot on fast flicks.                                                                                                                     |
| Tip damping (drag)    | 2.4                | `tipVel *= exp(−2.4 * dt)` every tick — bleeds speed so the blade settles instead of oscillating forever.                                                                                                     |
| Tip speed cap         | 44                 | Hard clamp on tip velocity magnitude. Stops runaway spring energy from fast cursor flicks.                                                                                                                    |
| Commitment damping    | ×0.35 spring force | When tip speed > 7 and the new spring force opposes current tip velocity, the force is cut to 35%. This is _why swings commit_ — you can't instantly cancel a swing mid-flight, you have to let it bleed off. |
| Reach                 | 2.9                | Radius from body (grip point) at which the reach constraint starts pulling the body.                                                                                                                          |
| Stretch               | 1.1                | Extra radius beyond `REACH` before the tip is hard-clamped. Total elastic range: `REACH` to `REACH + STRETCH`.                                                                                                |
| Body drag-along force | 340                | `vel += radialDir * over * 340 * dt` when tip is past reach and not planted — this is the "sword drags the body" feel.                                                                                        |
| Walk zone             | 3.4                | Inside this distance from the body, the cursor doesn't make the body walk — pure swordplay, no footwork needed for close targets.                                                                             |
| Body max speed        | 13                 | Hard cap on body velocity (prevents drag-along + player input from compounding to infinity).                                                                                                                  |

## Planted stance

Right-click (mouse) / second finger down (touch) sets `planted = true`:

- Body ignores the walk-zone chase entirely — no footwork, stand your ground.
- Body velocity damping increases sharply (11/s vs 2.8–8/s) — you plant hard.
- Reach-constraint drag-along on the body is **suppressed** while planted (the
  tip still gets pulled back elastically, but the body doesn't get yanked
  forward) — this is deliberate: planting means the sword can stretch to its
  limit without your feet moving.

## Stamina

- 0..1 meter on the `Player` component (`stamina`).
- **Drains** when tip speed > 8: `stamina -= (tipSpeed − 8) * 0.085 * dt`.
- **Regens** when tip speed < 4.5: `stamina += 0.28 * dt`.
- Between 4.5 and 8, stamina holds steady — moderate blade work is free.
- (Demo does not yet gate anything on stamina hitting 0 — reserve/confirm this
  behavior when the real system lands; likely candidate: swing force or speed
  cap scales down near empty.)

## Damage model — speed-gated, not input-gated

Hits are detected via **swept-segment** collision: the segment from last
tick's tip position to this tick's tip position (plus a second segment from
grip to tip) is checked against each enemy's circle. This is why a fast blade
can hit something it "passed through" in one tick without tunneling.

Damage depends on tip speed at the moment of the hit, not on any attack-button
state:

| Tip speed | Damage               | Notes                                                                         |
| --------- | -------------------- | ----------------------------------------------------------------------------- |
| < 6.5     | 0 (no hit registers) | Below this speed the blade doesn't damage — resting/idle contact is harmless. |
| 6.5–14    | 1                    | Standard hit. Kills a slime (2hp) in two hits.                                |
| > 14      | 2                    | Clean fast cut — one-shots a slime, meaningfully dents a brute (6hp).         |

Per-enemy `hitCD` (0.28s) prevents one swing from multi-hitting the same
target every tick while the blade lingers on it.

## Knockback / recoil — momentum exchange, not scripted animation

On hit:

- Enemy knockback direction = tip velocity direction (falls back to
  hit-point-minus-player-position if the blade is nearly still).
- Enemy knockback power = `min(tipSpeed * 0.5 + bodySpeed * 0.6, 15)`, halved
  again for brutes (`/2.2` vs `/1`) — heavier enemies resist knockback more.
- **Equal-and-opposite recoil:** the player's body velocity gets pushed
  backward along the same direction (`−0.7` for slimes, `−1.6` for brutes —
  hitting something heavy pushes _you_ back harder), and the tip's own
  velocity is damped hard on hit (`×0.6` slime / `×0.35` brute) — the cut
  _costs_ momentum, it isn't free.

## Game feel

- **Hit-stop:** on any hit, `hitstop = max(hitstop, 0.045–0.07s)` (bigger for
  brute hits); while active the loop multiplies frame `dt` by 0.08 — everything
  nearly freezes for a beat to sell impact. On player getting hit, hit-stop up
  to 0.07s.
- **Screen shake:** `shake` energy set on hit (0.28 base, 0.5 on player hurt),
  decays at `2.2/s`; render applies `±(shake² * 0.5)` random camera jitter.
- **i-frames:** 1.0s of invulnerability (`player.invuln`) after taking damage.
  Player mesh flickers (visibility toggled) while invuln remaining is between
  0.25 and 1.0s.
- **Enemy touch damage:** enemies deal contact damage on overlap
  (`dist < enemyRadius + playerRadius + 0.15`), gated by a per-enemy
  `touchCD` (0.8s) — not a swing, just proximity.

## Phase 2 — group AI, telegraphs, parry, streak

Numbers live in `src/content/ai.ts`, `src/content/combat.ts` (`PARRY`) and
`src/content/combo.ts`; the values below are the intent, the content files win.

### Attack tokens (group AI)

At most `AI_TOKENS.maxAttackers` (2) enemies may press the player at once.
Tokens are re-dealt every 0.4s to the nearest living enemies (mid-attack
holders keep theirs until they finish); everyone else orbits at a standoff
ring (~4.5) using their `circleDir` preference. The pack reads as coordinated
— it surrounds and rotates pressure — without ever becoming an unreadable
dogpile. This is the fairness backbone of "hard but fair": you fight two
enemies at a time, the rest are a threat you can see coming.

### Telegraphed attacks (brutes)

Brutes attack through a readable state machine on `Enemy.attackState`:
**windup** (0.55s — stands still, locks a lunge direction toward where you
*were*, render pulses red) → **strike** (0.28s — one big impulse along the
locked direction; damage comes from the existing touch-damage overlap, not a
scripted hitbox) → **recover** (0.5s — vulnerable) → cooldown (1.6s). The
locked direction is the dodge window: a windup is a promise, and sidestepping
it is always possible. Stun at any point cancels the attack. Slimes keep their
hop as their only "attack" — they never telegraph.

### Parry — a read, not a twitch

While **planted** (right-click / second finger), meeting a **winding-up**
enemy with a moving blade (tip speed ≥ 3 — far below the 6.5 damage gate; a
firm push parries) cancels its attack, staggers it for 1.4s (a long riposte
window), knocks it back, and refunds 0.35 stamina. No damage is dealt by the
parry itself — the reward is the stagger. Parrying deliberately requires the
planted stance: standing your ground is the defensive read, footwork is the
evasive one.

### Kill streak (combo)

Kills within 4s of each other build a streak; the window refreshes per kill.
Getting hit — or letting the window lapse — resets it to zero. Every 5th
streak kill heals 1 hp (capped). The meter is deliberately fragile: it
rewards aggressive, clean play, which is the whole cursor-sword thesis.

## Phase 2b — executions, ground slam, wall slams

Numbers live in `src/content/execution.ts`, `src/content/slam.ts` and
`src/content/environment.ts`; the content files win over the prose below.

### Stagger — the opening, as a first-class state

`Enemy.stagger` is distinct from ordinary hit-stun: only **big openings** set
it (a parry, the ground slam, a wall slam) — a regular blade hit never does.
Stagger is the execution window, and everything in 2b feeds it.

### Execution — the riposte payoff

A cut at tip speed ≥ 10 on a **staggered** enemy kills it outright, whatever
its hp. The normal hit's damage and knockback land first (an execution is that
same cut, elevated by the opening), the kill resolves through the ordinary
death path so streaks count it, and half a stamina bar is refunded. This is
why the parry stagger is 1.4s: read the windup, ring the bell, take the head.

### Ground slam — the charged ability, still no button

Planting with a **still** blade (tip speed < 1.5) charges 0→1 over 0.9s
(`Player.charge`). At full charge, the next swing that crosses tip speed 10
releases a shockwave centred on the tip: 2 damage, hard radial knockback,
pop-up, and a 0.8s **stagger** to everything within radius 3.5 — a crowd
opener that chains straight into executions. Charge drains (2.5/s) whenever
you're not planted-and-still, so it survives the release swing but not a
stroll. Charging is a bet: standing still in a souls-like is never free.

### Wall slams — masonry is a weapon

An enemy carried into the arena wall or a pillar at ≥ 9 units/s of
into-surface speed takes impact damage (1 + 1 per 8 over threshold), is
**staggered** 0.9s, and bounces off (restitution 0.45). Knockback near walls
is now positioning play — and a brute whose lunge you sidestep next to a wall
slams itself, attack broken, execution served. Below the threshold nothing
happens: walking into a wall is still just walking into a wall.

## Future (Phase 2c+ hooks)

- **Grab & throw** — physics object interaction; deliberately deferred until
  ragdoll/impulse needs justify pulling in Rapier (see
  `docs/decisions/0002-*.md`). Wall slams already give throws a payoff surface
  when they arrive.
- **More environment** — hazards beyond walls/pillars (braziers, pits, spike
  racks) once dungeon rooms (Phase 6) exist to place them in.
