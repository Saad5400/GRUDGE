/**
 * Static world collision (arena walls + pillars) and enemy-enemy separation.
 *
 * `collideStatics` is also called directly by the player movement system,
 * because the demo resolved the player against statics immediately after
 * integrating its position — before facing and sword physics read that position.
 */
import { Collider, Transform } from '../components';
import { ARENA_HALF, PILLARS } from '../content/arena';
import { ENEMY_PHYS } from '../content/enemies';
import { clamp } from '../core/math';
import { enemiesNewestFirst, type SimContext } from './context';

/** Clamps an entity inside the arena and pushes it out of pillars. */
export function collideStatics(eid: number): void {
  const r = Collider.radius[eid];
  Transform.x[eid] = clamp(Transform.x[eid], -ARENA_HALF, ARENA_HALF);
  Transform.z[eid] = clamp(Transform.z[eid], -ARENA_HALF, ARENA_HALF);
  for (const p of PILLARS) {
    const dx = Transform.x[eid] - p.x;
    const dz = Transform.z[eid] - p.z;
    const rr = p.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      Transform.x[eid] = p.x + (dx / d) * rr;
      Transform.z[eid] = p.z + (dz / d) * rr;
    }
  }
}

/** Enemies vs statics, then vs each other (soft overlap pushout). */
export function collisionSystem(ctx: SimContext): void {
  const enemies = enemiesNewestFirst(ctx.world);
  for (const e of enemies) {
    collideStatics(e);
    // Separation resolved per-enemy right after its own static pass, matching
    // the demo (later enemies therefore see already-nudged neighbours).
    for (const o of enemies) {
      if (o === e) continue;
      const dx = Transform.x[e] - Transform.x[o];
      const dz = Transform.z[e] - Transform.z[o];
      const rr = Collider.radius[e] + Collider.radius[o];
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * ENEMY_PHYS.separation;
        Transform.x[e] += (dx / d) * push;
        Transform.z[e] += (dz / d) * push;
      }
    }
  }
}
