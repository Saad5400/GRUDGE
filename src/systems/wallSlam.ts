/**
 * Wall slams: an enemy carried into the arena boundary or a pillar faster than
 * WALL_SLAM.minImpactSpeed (speed component INTO the surface) takes impact
 * damage, is staggered (execution window), and bounces off. See
 * src/content/environment.ts.
 *
 * Runs AFTER enemyAI/telegraph (positions are integrated, so an over-the-line
 * position + inward velocity IS the impact) and BEFORE collision (which then
 * clamps the position as it always did — this system only reads the overshoot
 * and edits velocity/health, it never resolves positions itself).
 *
 * Detection, per living enemy:
 * - Arena walls: Transform.x or .z beyond ±ARENA_HALF with velocity pointing
 *   further out → impact speed = |velocity component along that axis|.
 * - Pillars (content/arena PILLARS): overlap (dist < p.r + collider radius)
 *   with velocity pointing into the pillar → impact speed = −(vel · outNormal).
 * - One impact per enemy per tick (check walls first, then pillars; first hit wins).
 *
 * On impact >= minImpactSpeed:
 * - damage = baseDamage + floor((impact − minImpactSpeed) * speedDamageFactor),
 * - stun AND stagger max'd to WALL_SLAM.stagger, flash,
 * - the into-surface velocity component is reflected and scaled by restitution,
 * - a mid-attack enemy (attackState !== idle) has its attack broken: state →
 *   idle, attackT = 0 (keep its current attackCD) — a brute that lunges into a
 *   wall does not keep swinging,
 * - state.shake/hitstop max'd with WALL_SLAM.shake/hitstop, emit 'wall-slam'.
 * Kills resolve in enemyDeath via hp <= 0 as usual. No RNG in this system.
 */
import { ATTACK_STATE, Collider, Enemy, Health, Transform, Velocity } from '../components';
import { ARENA_HALF, PILLARS } from '../content/arena';
import { WALL_SLAM } from '../content/environment';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function wallSlamSystem(ctx: SimContext): void {
  const { state } = ctx;
  const min = WALL_SLAM.minImpactSpeed;

  for (const e of enemiesNewestFirst(ctx.world)) {
    if (Health.hp[e] <= 0) continue;

    const vx = Velocity.x[e];
    const vz = Velocity.z[e];
    // Speed into the surface, and the surface's outward normal (the direction
    // the body bounces). Below the threshold nothing is recorded at all — a
    // walking enemy leaning on a wall is a bump, and collision handles bumps.
    let impact = 0;
    let nx = 0;
    let nz = 0;

    // Walls first, x before z: a body that overshot a corner hard on both axes
    // still resolves to exactly one impact, and always the same one.
    if (Transform.x[e] > ARENA_HALF && vx >= min) {
      impact = vx;
      nx = -1;
    } else if (Transform.x[e] < -ARENA_HALF && -vx >= min) {
      impact = -vx;
      nx = 1;
    } else if (Transform.z[e] > ARENA_HALF && vz >= min) {
      impact = vz;
      nz = -1;
    } else if (Transform.z[e] < -ARENA_HALF && -vz >= min) {
      impact = -vz;
      nz = 1;
    } else {
      // …then the pillars: overlapping one with velocity still driving into it.
      for (const p of PILLARS) {
        const dx = Transform.x[e] - p.x;
        const dz = Transform.z[e] - p.z;
        const rr = p.r + Collider.radius[e];
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 <= 1e-6) continue;
        const d = Math.sqrt(d2);
        const ox = dx / d;
        const oz = dz / d;
        const into = -(vx * ox + vz * oz);
        if (into < min) continue;
        impact = into;
        nx = ox;
        nz = oz;
        break;
      }
    }

    if (impact === 0) continue;

    const stats = enemyStats(e);
    Health.hp[e] -= WALL_SLAM.baseDamage + Math.floor((impact - min) * WALL_SLAM.speedDamageFactor);
    // Masonry hits harder than the blade: this is an execution window, not a flinch.
    Enemy.stun[e] = Math.max(Enemy.stun[e], WALL_SLAM.stagger);
    Enemy.stagger[e] = Math.max(Enemy.stagger[e], WALL_SLAM.stagger);
    Enemy.flash[e] = WALL_SLAM.flashTime;

    // Bounce: reflect the into-surface component, keep the tangential slide.
    const vn = vx * nx + vz * nz;
    Velocity.x[e] = vx - (1 + WALL_SLAM.restitution) * vn * nx;
    Velocity.z[e] = vz - (1 + WALL_SLAM.restitution) * vn * nz;

    // A lunge that ends in a wall ends, full stop. attackCD is left alone: the
    // brute keeps whatever cooldown it had rather than being handed a free reset.
    if (Enemy.attackState[e] !== ATTACK_STATE.idle) {
      Enemy.attackState[e] = ATTACK_STATE.idle;
      Enemy.attackT[e] = 0;
    }

    state.shake = Math.max(state.shake, WALL_SLAM.shake);
    state.hitstop = Math.max(state.hitstop, WALL_SLAM.hitstop);

    ctx.events.emit({
      type: 'wall-slam',
      eid: e,
      x: Transform.x[e],
      z: Transform.z[e],
      big: stats.big,
      impact,
    });
  }
}
