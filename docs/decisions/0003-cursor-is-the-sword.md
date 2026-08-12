# 0003 — Cursor is the sword tip (core combat identity)

- Status: accepted
- Date: 2026-08-12

## Context

The original spec called for a conventional button-based light/heavy attack
combo scheme. `reference/dungeon-brawler.html` demonstrated a different
mechanic: the mouse cursor's world-space position directly targets the sword
tip, which is a physics point-mass on a stiff spring — carrying momentum,
resisting reversal mid-swing (commitment), and dragging the player's body
along once stretched past reach. This produced markedly better combat feel
than a discrete-input combo system in the demo, and became the thing GRUDGE is
about — see `docs/design/combat.md` for the full mechanical spec.

## Decision

Adopt cursor-is-the-sword as GRUDGE's **core combat identity**, replacing the
button-based light/heavy attack scheme entirely. There is no attack button;
damage is speed-gated on blade velocity, not input-gated on a button press.
Full model in `docs/design/combat.md`.

## Consequences

- **Mouse/touch parity is now a hard design requirement**, not a port
  afterthought. Touch needs an equivalent of "cursor position" (drag point)
  and an equivalent of right-click-to-plant (second finger down) — both are
  first-class from Phase 1, not bolted on later. Gamepad support (if pursued)
  needs its own aim-point mapping (e.g. stick-relative reticle) — not yet
  designed.
- **Stamina is redesigned around blade speed**, not stance/dodge economy —
  drains above a tip-speed threshold, regens below a lower one. This replaces
  whatever stamina model the original button-based spec assumed.
- **Dodge-roll is replaced** by momentum-based repositioning (walk zone: body
  only chases the cursor past a distance threshold) plus the planted stance.
  There is no roll input, no roll i-frames — invulnerability comes only from
  the post-hit i-frame window (see combat doc).
- **Parry and executions must be re-imagined** for this scheme — they can't
  assume a discrete "attack" input state machine to hang off of. Deferred to
  Phase 2+; see the "Future" section of `docs/design/combat.md`.
- Combo/streak systems (Phase 2) must be designed against continuous blade
  velocity/hit-timing data, not discrete button-combo windows.
