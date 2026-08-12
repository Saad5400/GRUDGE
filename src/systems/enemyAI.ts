/**
 * Enemy locomotion + brains.
 *
 * Slimes hop at the knight in bursts (all their speed arrives as a launch
 * impulse, so they are readable and dodgeable); brutes walk him down steadily.
 * Only attack-token holders (systems/attackTokens) actually press him — the
 * rest hold a standoff ring and circle, so a wave crowds the arena instead of
 * collapsing onto one point. Gravity and drag always run — a stunned or
 * airborne enemy is still a physics object being flung around by the blade.
 */
import { ATTACK_STATE, Enemy, Transform, Velocity } from '../components';
import { AI_TOKENS, TELEGRAPH } from '../content/ai';
import { ENEMY_PHYS } from '../content/enemies';
import { expDecay } from '../core/math';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function enemyAISystem(ctx: SimContext): void {
  const { dt, state } = ctx;
  const p = ctx.playerEid;

  for (const e of enemiesNewestFirst(ctx.world)) {
    const stats = enemyStats(e);

    // gravity / hop arc
    Velocity.y[e] -= ENEMY_PHYS.gravity * dt;
    Transform.y[e] += Velocity.y[e] * dt;
    if (Transform.y[e] <= 0) {
      Transform.y[e] = 0;
      Velocity.y[e] = 0;
    }

    let toX = Transform.x[p] - Transform.x[e];
    let toZ = Transform.z[p] - Transform.z[e];
    const dist = Math.hypot(toX, toZ);
    if (dist > 0) {
      toX /= dist;
      toZ /= dist;
    }
    const attack = Enemy.attackState[e];
    // A committed attacker stops tracking: the lunge lands where it was aimed,
    // so sidestepping a windup beats it (see systems/telegraph).
    const committed = attack === ATTACK_STATE.windup || attack === ATTACK_STATE.strike;
    // Face the knight (render reads Transform.rot).
    if (dist > 0.01 && !committed) Transform.rot[e] = Math.atan2(toX, toZ);

    // Mid-attack enemies are steered by the telegraph state machine, not here.
    if (!state.dead && Enemy.stun[e] <= 0 && attack === ATTACK_STATE.idle) {
      // Token holders go for the throat; everyone else works the standoff ring:
      // back off inside it, close from outside it, circle while on it.
      let dirX = toX;
      let dirZ = toZ;
      let accel = stats.accel;
      if (!Enemy.token[e]) {
        if (dist < AI_TOKENS.standoffDist - AI_TOKENS.standoffSlack) {
          dirX = -toX;
          dirZ = -toZ;
        } else if (dist <= AI_TOKENS.standoffDist + AI_TOKENS.standoffSlack) {
          const cd = Enemy.circleDir[e];
          dirX = -toZ * cd;
          dirZ = toX * cd;
          accel = AI_TOKENS.orbitAccel;
        }
      }

      if (stats.accel > 0) {
        // brute: steady pressure
        Velocity.x[e] += dirX * accel * dt;
        Velocity.z[e] += dirZ * accel * dt;
      } else {
        // slime: charge the hop timer, then launch (orbiters hop sideways)
        Enemy.hopT[e] -= dt;
        if (Transform.y[e] === 0 && Enemy.hopT[e] <= 0) {
          Velocity.y[e] = stats.hopVy + ctx.rng.next() * stats.hopVyRand;
          Velocity.x[e] += dirX * stats.hopImpulse;
          Velocity.z[e] += dirZ * stats.hopImpulse;
          Enemy.hopT[e] = stats.hopMin + ctx.rng.next() * stats.hopRand;
        }
      }
    }

    // Airborne bodies keep their momentum; grounded ones scrub it off.
    const drag = expDecay(Transform.y[e] > 0 ? ENEMY_PHYS.dragAir : ENEMY_PHYS.dragGround, dt);
    Velocity.x[e] *= drag;
    Velocity.z[e] *= drag;

    const es = Math.hypot(Velocity.x[e], Velocity.z[e]);
    // A lunge is allowed to outrun the walk cap; a stun still outranks both.
    const emax =
      Enemy.stun[e] > 0
        ? ENEMY_PHYS.stunSpeedCap
        : attack === ATTACK_STATE.strike
          ? TELEGRAPH.strikeSpeedCap
          : stats.maxSpeed;
    if (es > emax) {
      const s = emax / es;
      Velocity.x[e] *= s;
      Velocity.z[e] *= s;
    }

    Transform.x[e] += Velocity.x[e] * dt;
    Transform.z[e] += Velocity.z[e] * dt;
  }
}
