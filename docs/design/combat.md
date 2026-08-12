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

## Future (Phase 2 hooks)

- **Parry** vs. telegraphed attacks — timing-based, not part of this port.
  Needs enemy telegraph state first (Phase 3 also depends on this).
- **Executions** — likely a charged finisher on staggered/low-hp enemies.
- **Grab & throw** — physics object interaction, revisit once ragdoll/impulse
  needs justify pulling in Rapier (see `docs/decisions/0002-*.md`).
