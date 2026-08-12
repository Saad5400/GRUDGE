# 0004 — Pin bitECS to 0.3.40 (classic API)

- Status: accepted
- Date: 2026-08-12

## Context

bitECS 0.4 changed its API significantly from the 0.3.x line (component
definition style, query syntax). GRUDGE is built primarily by AI agents, and
agent code quality correlates strongly with how much public training data
exists for the exact API being used. 0.3.x's classic API
(`defineComponent`/`Types`/`defineQuery`) has a far larger public corpus
(examples, tutorials, Stack Overflow, existing open-source usage) than 0.4,
which is newer and less documented at the time of this decision.

## Decision

Pin `bitecs` to exactly **0.3.40** in `package.json`. Use only the classic API
surface: `defineComponent`, `Types`, `defineQuery`, `IWorld`. Do **not** use
0.4.x API shapes (tag components without `defineComponent`, the newer query
builder syntax) anywhere in this repo — they will not compile or run against
the pinned version.

Revisit this pin when 0.4 stabilizes **and** its public documentation/training
corpus matures enough that agents reliably produce correct 0.4 code without
repo-specific hand-holding. That's a moving bar this ADR doesn't try to
predict a date for — check current agent output quality against 0.4 before
unpinning, don't unpin on a schedule.

## Consequences

- All `src/components/**` and any code touching bitECS must use classic 0.3
  patterns (see `src/components/index.ts` for the reference shape:
  `defineComponent({ field: Types.f32, ... })`).
- Upgrading to 0.4 later is a real migration, not a version bump — component
  definitions and query call sites will need rewriting. Budget for it
  explicitly if/when it happens; don't casually bump the version in
  `package.json` without doing the migration.
- `CLAUDE.md` carries this rule forward so future agents don't "helpfully"
  upgrade or mix API styles.
