/**
 * Execution: a fast cut on a STAGGERED enemy finishes it outright. See
 * src/content/execution.ts. Stagger (Enemy.stagger) is only ever set by parry,
 * ground slam, and wall slam — ordinary hits never open the window.
 *
 * Runs AFTER swordDamage, BEFORE enemyDeath, and reads this tick's 'sword-hit'
 * events via tickEvents (never events.ofType — the bus clears per frame, not
 * per tick). For each hit whose enemy is still alive (Health.hp > 0),
 * Enemy.stagger > 0, and tipSpeed >= EXECUTION.minTipSpeed:
 * - Health.hp = 0 (enemyDeath resolves the kill normally, so streaks count it),
 * - refund EXECUTION.staminaRefund (clamp 1),
 * - state.shake/hitstop max'd with EXECUTION.shake/hitstop,
 * - emit 'execution'.
 *
 * The regular hit's damage/knockback already applied in swordDamage stands —
 * an execution is that same cut, elevated by the opening.
 */
import { Enemy, Health, Player } from '../components';
import { EXECUTION } from '../content/execution';
import { tickEvents, type SimContext } from './context';

export function executionSystem(ctx: SimContext): void {
  const { state } = ctx;
  const p = ctx.playerEid;

  // This tick's cuts only — the bus is cleared per frame, not per step, so
  // ofType() would re-finish a previous tick's hit on a double-stepped frame.
  for (const hit of tickEvents(ctx, 'sword-hit')) {
    const e = hit.eid;
    // Already finished by the cut itself, no opening to exploit, or too slow to
    // be a committed swing — all three are just an ordinary hit.
    if (Health.hp[e] <= 0) continue;
    if (Enemy.stagger[e] <= 0) continue;
    if (hit.tipSpeed < EXECUTION.minTipSpeed) continue;

    // enemyDeath reaps it later this tick, so the kill counts, heals and feeds
    // the streak exactly like any other.
    Health.hp[e] = 0;
    Player.stamina[p] = Math.min(1, Player.stamina[p] + EXECUTION.staminaRefund);
    state.shake = Math.max(state.shake, EXECUTION.shake);
    state.hitstop = Math.max(state.hitstop, EXECUTION.hitstop);

    ctx.events.emit({ type: 'execution', eid: e, x: hit.x, z: hit.z, big: hit.big });
  }
}
