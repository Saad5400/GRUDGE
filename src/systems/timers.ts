/**
 * Cooldown / timer bookkeeping.
 *
 * Placement matters for feel: the demo decremented the player's i-frames right
 * after the blade resolved its hits, then decremented each enemy's timers at the
 * top of the enemy update. Nothing runs between those two points, so a single
 * system here is exactly equivalent — and keeps the ordering in one place.
 */
import { Enemy, Health } from '../components';
import { enemiesNewestFirst, type SimContext } from './context';

export function timerSystem(ctx: SimContext): void {
  const dt = ctx.dt;
  const p = ctx.playerEid;
  Health.invuln[p] = Math.max(0, Health.invuln[p] - dt);

  for (const e of enemiesNewestFirst(ctx.world)) {
    Enemy.stun[e] = Math.max(0, Enemy.stun[e] - dt);
    Enemy.stagger[e] = Math.max(0, Enemy.stagger[e] - dt);
    Enemy.flash[e] = Math.max(0, Enemy.flash[e] - dt);
    Enemy.touchCD[e] = Math.max(0, Enemy.touchCD[e] - dt);
    Enemy.hitCD[e] = Math.max(0, Enemy.hitCD[e] - dt);
  }
}
