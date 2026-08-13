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
import type { SimContext } from './context';

export function executionSystem(ctx: SimContext): void {
  void ctx; // TODO(sim-a): implement per the header contract.
}
