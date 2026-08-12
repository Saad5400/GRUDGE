/**
 * Telegraphed attacks (brutes): idle → windup → strike → recover state machine
 * on Enemy.attackState / Enemy.attackT.
 *
 * A token-holding brute within TELEGRAPH.triggerRange stops, locks a lunge
 * direction (Enemy.lungeX/Z, toward the player at windup start) and winds up —
 * visibly and parryably — then lunges with TELEGRAPH.lungeImpulse. Damage is
 * NOT dealt here: the lunge carries the brute into the player and the existing
 * touchDamage system resolves the hit. Recover leaves it standing vulnerable.
 *
 * SKELETON — implemented by the Phase 2 sim agent. Contract:
 *  - Emits 'enemy-telegraph' at windup start, 'enemy-lunge' at strike start.
 *  - Being stunned (Enemy.stun > 0) cancels any attack back to idle.
 *  - Decrements Enemy.attackCD here (its own clock; timers.ts doesn't know it).
 *  - Sets Enemy.attackCD = TELEGRAPH.cooldown when an attack ends (any path).
 */
import type { SimContext } from './context';

export function telegraphSystem(_ctx: SimContext): void {
  // no-op until implemented
}
