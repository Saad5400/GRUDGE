# Rivals — design stub (Phase 4)

Status: stub, not started. Full design pass happens at the start of Phase 4 —
this doc exists so Phase 0–3 work doesn't foreclose options rivals will need
(persistence hooks, enemy identity fields, event types for kills/wounds).

## Goals

- Named enemies that persist across a run (and across sessions, via local
  save) instead of being disposable trash mobs.
- A rival should feel like _your_ rival: specific fights against it should be
  rememberable, not procedurally identical to every other fight.
- Losing to a rival should feel like a story beat, not just a death — it comes
  back scarred, stronger, or with a taunt referencing the fight.
- Keep scope bounded: one dominated captain at a time, flat notoriety, no
  simulated faction/army layer. See "Differentiation" below — this is a legal
  boundary, not just a scope preference.

## The memory loop

```
Rival spawns → fight happens → outcome recorded → rival's next appearance reflects it
```

| Event                                        | Effect                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Player kills a rival                         | Rival is gone for good. A **new** captain is promoted from the regular enemy pool to fill the "named rival" slot — flat notoriety score, not a hierarchy graph (see Differentiation). Promotion may come with a taunt line referencing the kill. |
| Rival wounds the player badly / player flees | Rival gains a persistent **scar** (visual marker + minor stat/behavior tag, e.g. "remembers your dodge pattern," "afraid of fire after being burned") and a taunt on next encounter.                                                             |
| Rival kills the player                       | Rival's notoriety score increases. Next encounter opens with a taunt referencing the death.                                                                                                                                                      |
| Player wounds but doesn't kill a rival       | Rival persists with the wound as a scar; may return with an adapted moveset (e.g. favors the side that wasn't hurt).                                                                                                                             |

Scars and taunts are the two persistent, player-visible artifacts of memory.
Notoriety is the one persistent _number_ driving promotion — deliberately kept
flat (see Differentiation).

## Domination

A charged finisher usable on a rival at critically low HP: instead of a kill,
the player can **dominate** the rival — it survives as a defeated, marked
subordinate. Mechanical effect (tentative, refine at Phase 4 kickoff):

- The dominated rival becomes a limited-duration ally/summon in later fights,
  OR
- The dominated rival's gear/moveset becomes a drop/unlock for the player.

Exactly one dominated captain can exist at a time (see Differentiation — no
follower army). A dominated captain can **betray** the player (break
domination and return to hostile) under conditions TBD at Phase 4 design time
— this is the single relationship state the system tracks beyond notoriety and
scars, and it's explicitly bounded to one relationship, not a network.

## Persistence schema (sketch — localforage)

```ts
interface RivalRecord {
  id: string; // stable id, survives renames
  name: string; // procedurally generated
  archetype: string; // grunt/shield/berserker/archer base, see Phase 3
  notoriety: number; // flat score — NOT a rank in a hierarchy
  scars: ScarRecord[]; // visual + minor behavior tags from past fights
  dominated: boolean; // true if currently the player's one dominated captain
  lastOutcome: 'player-won' | 'rival-won' | 'fled' | null;
  encounters: number;
}

interface ScarRecord {
  source: string; // e.g. 'burn', 'left-arm-wound'
  appliedAt: number; // sim time or run count
}

interface RivalSaveState {
  version: number;
  seed: number;
  rivals: RivalRecord[];
  dominatedRivalId: string | null; // at most one — enforced, not just convention
}
```

Persisted via `localforage` (already in the stack, see
`docs/decisions/0001-tech-stack.md`), keyed per local player profile. No
server, no cross-player sync — see Differentiation, "memory is per-player
local."

## Differentiation from US 10,926,179 (REQUIRED — read before implementing)

WB's Nemesis System patent (US 10,926,179, "Nemesis system for a computer
simulation") is specifically about a fort/army hierarchy simulation layer.
GRUDGE's rivals system is deliberately scoped to avoid that structure:

- **No fort/army hierarchy simulation.** GRUDGE has no forts, no army rosters,
  no simulated chain-of-command among enemies.
- **No nemesis-fort invasion structure.** There is no mechanic where a rival
  invades or attacks a player-held fort/base as part of a simulated
  territorial campaign.
- **Promotion is a flat notoriety score, not a military hierarchy graph.**
  When a rival dies, the replacement is picked from a flat pool by notoriety —
  there is no rank structure (captain → warchief → overlord tree, or similar)
  being simulated or advanced.
- **Followers limited to a single dominated captain, with betrayal** — not a
  follower army. Domination produces at most one subordinate relationship at a
  time; there is no growing personal army of dominated enemies.
- **Memory is per-player, local only.** Rival state is stored in the local
  player's `localforage` save. There is no social/vendetta-transfer mechanic
  between players (e.g. "this rival killed another player, beware" propagating
  across a playerbase) — that cross-player social layer is a distinguishing
  feature of the patented system and GRUDGE does not implement it.

**This section is a design constraint, not a legal opinion.** Get real legal
review before monetizing anything in this system (loot boxes, rival-themed
purchases, etc.) or before marketing copy makes comparisons to "Nemesis"-style
systems by name.
