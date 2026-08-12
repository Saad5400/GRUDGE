/**
 * Reaps enemies whose hp ran out, banks the kill, and pays out the brute bounty
 * (killing a brute heals one heart if you are hurt — the only healing in the
 * game, so the scariest enemy is also the medkit).
 */
import { Health, Transform } from '../components';
import { removeEntity } from 'bitecs';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function enemyDeathSystem(ctx: SimContext): void {
  const p = ctx.playerEid;
  for (const e of enemiesNewestFirst(ctx.world)) {
    if (Health.hp[e] > 0) continue;
    const stats = enemyStats(e);
    ctx.events.emit({ type: 'enemy-died', x: Transform.x[e], z: Transform.z[e], big: stats.big });
    ctx.state.kills++;
    ctx.state.alive--;
    if (stats.big && Health.hp[p] < Health.maxHp[p]) {
      Health.hp[p] += 1;
      ctx.events.emit({ type: 'player-healed', hp: Health.hp[p] });
    }
    removeEntity(ctx.world, e);
  }
}
