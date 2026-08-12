/**
 * Enemy locomotion + brains.
 *
 * Slimes hop at the knight in bursts (all their speed arrives as a launch
 * impulse, so they are readable and dodgeable); brutes walk him down steadily.
 * Gravity and drag always run — a stunned or airborne enemy is still a physics
 * object being flung around by the blade.
 */
import { Enemy, Transform, Velocity } from '../components';
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
    // Face the knight (render reads Transform.rot).
    if (dist > 0.01) Transform.rot[e] = Math.atan2(toX, toZ);

    if (!state.dead && Enemy.stun[e] <= 0) {
      if (stats.accel > 0) {
        // brute: steady pressure
        Velocity.x[e] += toX * stats.accel * dt;
        Velocity.z[e] += toZ * stats.accel * dt;
      } else {
        // slime: charge the hop timer, then launch
        Enemy.hopT[e] -= dt;
        if (Transform.y[e] === 0 && Enemy.hopT[e] <= 0) {
          Velocity.y[e] = stats.hopVy + ctx.rng.next() * stats.hopVyRand;
          Velocity.x[e] += toX * stats.hopImpulse;
          Velocity.z[e] += toZ * stats.hopImpulse;
          Enemy.hopT[e] = stats.hopMin + ctx.rng.next() * stats.hopRand;
        }
      }
    }

    // Airborne bodies keep their momentum; grounded ones scrub it off.
    const drag = expDecay(Transform.y[e] > 0 ? ENEMY_PHYS.dragAir : ENEMY_PHYS.dragGround, dt);
    Velocity.x[e] *= drag;
    Velocity.z[e] *= drag;

    const es = Math.hypot(Velocity.x[e], Velocity.z[e]);
    const emax = Enemy.stun[e] > 0 ? ENEMY_PHYS.stunSpeedCap : stats.maxSpeed;
    if (es > emax) {
      const s = emax / es;
      Velocity.x[e] *= s;
      Velocity.z[e] *= s;
    }

    Transform.x[e] += Velocity.x[e] * dt;
    Transform.z[e] += Velocity.z[e] * dt;
  }
}
