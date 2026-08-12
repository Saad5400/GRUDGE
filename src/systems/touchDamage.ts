/**
 * Enemy → player contact damage, i-frames, and death.
 * Airborne enemies pass harmlessly overhead (`touchMaxHeight`), which is what
 * makes hopping slimes readable: you can duck under a hop, not through a walk.
 */
import { Collider, Enemy, Health, Transform, Velocity } from '../components';
import { COMBAT } from '../content/combat';
import { PLAYER } from '../content/player';
import { enemiesNewestFirst, type SimContext } from './context';

/** Applies a hit to the player from a world-space source. No-op while invulnerable. */
export function hurtPlayer(ctx: SimContext, fromX: number, fromZ: number): void {
  const p = ctx.playerEid;
  const { state } = ctx;
  if (Health.invuln[p] > 0 || state.dead) return;

  Health.hp[p] -= 1;
  Health.invuln[p] = PLAYER.invulnTime;

  let kbX = Transform.x[p] - fromX;
  let kbZ = Transform.z[p] - fromZ;
  const len = Math.hypot(kbX, kbZ);
  if (len > 0) {
    kbX /= len;
    kbZ /= len;
  }
  Velocity.x[p] += kbX * PLAYER.hurtKnockback;
  Velocity.z[p] += kbZ * PLAYER.hurtKnockback;

  state.shake = Math.max(state.shake, COMBAT.hurtShake);
  state.hitstop = Math.max(state.hitstop, COMBAT.hurtHitstop);
  ctx.events.emit({ type: 'player-hurt', x: Transform.x[p], z: Transform.z[p], hp: Health.hp[p] });

  if (Health.hp[p] <= 0) {
    state.dead = true;
    ctx.events.emit({ type: 'player-died', wave: state.wave, kills: state.kills });
  }
}

export function touchDamageSystem(ctx: SimContext): void {
  const p = ctx.playerEid;
  const contactPad = Collider.radius[p] + COMBAT.touchPad;

  for (const e of enemiesNewestFirst(ctx.world)) {
    if (Enemy.touchCD[e] > 0 || Transform.y[e] >= COMBAT.touchMaxHeight) continue;
    const dist = Math.hypot(Transform.x[p] - Transform.x[e], Transform.z[p] - Transform.z[e]);
    if (dist < Collider.radius[e] + contactPad) {
      Enemy.touchCD[e] = COMBAT.touchCD;
      hurtPlayer(ctx, Transform.x[e], Transform.z[e]);
    }
  }
}
