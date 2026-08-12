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
 * Contract:
 *  - Emits 'enemy-telegraph' at windup start, 'enemy-lunge' at strike start.
 *  - Being stunned (Enemy.stun > 0) cancels any attack back to idle.
 *  - Decrements Enemy.attackCD here (its own clock; timers.ts doesn't know it).
 *  - Sets Enemy.attackCD = TELEGRAPH.cooldown when an attack ends (any path).
 */
import { ATTACK_STATE, ENEMY_KIND, Enemy, Transform, Velocity } from '../components';
import { TELEGRAPH } from '../content/ai';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function telegraphSystem(ctx: SimContext): void {
  const { dt, state } = ctx;
  const p = ctx.playerEid;

  for (const e of enemiesNewestFirst(ctx.world)) {
    // Slimes never telegraph — their hop *is* the tell.
    if (Enemy.kind[e] !== ENEMY_KIND.brute) continue;
    Enemy.attackCD[e] = Math.max(0, Enemy.attackCD[e] - dt);

    const st = Enemy.attackState[e];

    // Getting rocked (blade hit, parry) drops the swing outright — that is what
    // makes reading the windup worth anything.
    if (Enemy.stun[e] > 0) {
      if (st !== ATTACK_STATE.idle) {
        Enemy.attackState[e] = ATTACK_STATE.idle;
        Enemy.attackT[e] = 0;
        Enemy.attackCD[e] = TELEGRAPH.cooldown;
      }
      continue;
    }

    if (st === ATTACK_STATE.idle) {
      if (state.dead || !Enemy.token[e] || Enemy.attackCD[e] > 0 || Transform.y[e] > 0) continue;
      const dx = Transform.x[p] - Transform.x[e];
      const dz = Transform.z[p] - Transform.z[e];
      const dist = Math.hypot(dx, dz);
      if (dist > TELEGRAPH.triggerRange || dist <= 0) continue;

      // Aim is locked NOW: the lunge goes where you were when it committed,
      // which is what makes sidestepping a read rather than a reflex.
      Enemy.lungeX[e] = dx / dist;
      Enemy.lungeZ[e] = dz / dist;
      Enemy.attackState[e] = ATTACK_STATE.windup;
      Enemy.attackT[e] = TELEGRAPH.windupTime;
      ctx.events.emit({
        type: 'enemy-telegraph',
        eid: e,
        x: Transform.x[e],
        z: Transform.z[e],
        big: enemyStats(e).big,
      });
      continue;
    }

    Enemy.attackT[e] -= dt;

    if (st === ATTACK_STATE.windup) {
      // Planted through the windup — no free drift into contact range.
      Velocity.x[e] = 0;
      Velocity.z[e] = 0;
      if (Enemy.attackT[e] <= 0) {
        Enemy.attackState[e] = ATTACK_STATE.strike;
        Enemy.attackT[e] = TELEGRAPH.strikeTime;
        Velocity.x[e] += Enemy.lungeX[e] * TELEGRAPH.lungeImpulse;
        Velocity.z[e] += Enemy.lungeZ[e] * TELEGRAPH.lungeImpulse;
        ctx.events.emit({ type: 'enemy-lunge', eid: e, x: Transform.x[e], z: Transform.z[e] });
      }
    } else if (st === ATTACK_STATE.strike) {
      // The lunge just coasts: enemyAI raises its speed cap and ground drag
      // bleeds it off, so the brute overshoots and is left flat-footed.
      if (Enemy.attackT[e] <= 0) {
        Enemy.attackState[e] = ATTACK_STATE.recover;
        Enemy.attackT[e] = TELEGRAPH.recoverTime;
      }
    } else if (Enemy.attackT[e] <= 0) {
      Enemy.attackState[e] = ATTACK_STATE.idle;
      Enemy.attackT[e] = 0;
      Enemy.attackCD[e] = TELEGRAPH.cooldown;
    }
  }
}
