/**
 * Parry: planted stance + blade contact vs a winding-up enemy.
 *
 * While intents.planted and the tip is moving at least PARRY.minTipSpeed, test
 * the blade segments (swept tip + grip→tip, same geometry as swordDamage, via
 * core/math segPointDist2) against enemies in ATTACK_STATE.windup. On contact:
 * cancel the attack (state → idle, attackCD = PARRY.attackCD), stagger
 * (stun = PARRY.stun, flash), knock the enemy back PARRY.knockback away from
 * the player, refund stamina, add PARRY.shake/hitstop, emit 'parry'. No damage
 * — the reward is the long riposte window on a staggered enemy.
 *
 * SKELETON — implemented by the Phase 2 sim agent. Contract:
 *  - Runs BEFORE swordDamage in the pipeline; a parried enemy gets
 *    Enemy.hitCD = COMBAT.hitCD so the same swing doesn't also damage it.
 *  - One parry per enemy per contact (hitCD gates re-triggering).
 */
import type { SimContext } from './context';

export function parrySystem(_ctx: SimContext): void {
  // no-op until implemented
}
