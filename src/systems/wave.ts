/**
 * Wave director: composition, the spawn trickle, and the roll into the next wave.
 *
 * The demo trickled spawns on a 380 ms setInterval so a wave arrives as a
 * stream rather than a wall. Here that is a sim-side timer driven by the same
 * effective dt as everything else, so the whole simulation stays deterministic
 * and replayable from a seed.
 */
import { addComponent, addEntity } from 'bitecs';
import {
  Collider,
  ENEMY_KIND,
  Enemy,
  Health,
  Transform,
  Velocity,
  type EnemyKind,
} from '../components';
import { ARENA_HALF } from '../content/arena';
import { ENEMY_PHYS, ENEMY_STATS } from '../content/enemies';
import { WAVES } from '../content/waves';
import type { SimContext } from './context';

/** Creates one enemy at a world position and height. Returns its entity id. */
export function spawnEnemyAt(
  ctx: SimContext,
  x: number,
  z: number,
  kind: EnemyKind,
  y: number,
): number {
  const stats = ENEMY_STATS[kind];
  const world = ctx.world;
  const eid = addEntity(world);
  addComponent(world, Transform, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Collider, eid);
  addComponent(world, Health, eid);
  addComponent(world, Enemy, eid);

  Transform.x[eid] = x;
  Transform.y[eid] = y;
  Transform.z[eid] = z;
  Transform.rot[eid] = 0;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Velocity.z[eid] = 0;
  Collider.radius[eid] = stats.radius;
  Health.hp[eid] = stats.hp;
  Health.maxHp[eid] = stats.hp;
  Health.invuln[eid] = 0;
  Enemy.kind[eid] = kind;
  Enemy.hopT[eid] = ctx.rng.next() * stats.spawnHopT;
  Enemy.stun[eid] = 0;
  Enemy.flash[eid] = 0;
  Enemy.touchCD[eid] = 0;
  Enemy.hitCD[eid] = 0;
  Enemy.circleDir[eid] = ctx.rng.next() < 0.5 ? -1 : 1;
  // bitECS recycles entity ids without zeroing stores — clear Phase 2 fields.
  Enemy.attackState[eid] = 0;
  Enemy.attackT[eid] = 0;
  Enemy.attackCD[eid] = 0;
  Enemy.lungeX[eid] = 0;
  Enemy.lungeZ[eid] = 0;
  Enemy.token[eid] = 0;

  ctx.events.emit({ type: 'enemy-spawned', eid, big: stats.big });
  return eid;
}

/** Spawns one enemy on the perimeter ring, dropping in from above. */
function spawnOnRing(ctx: SimContext, kind: EnemyKind): number {
  const ang = ctx.rng.next() * Math.PI * 2;
  const d = ARENA_HALF - WAVES.ringInset;
  return spawnEnemyAt(ctx, Math.cos(ang) * d, Math.sin(ang) * d, kind, ENEMY_PHYS.spawnHeight);
}

/** Advances the wave counter and queues up the next batch. */
export function nextWave(ctx: SimContext): void {
  const state = ctx.state;
  state.wave++;
  state.spawning = true;
  ctx.spawnSlimes = WAVES.baseSlimes + state.wave * WAVES.slimesPerWave;
  ctx.spawnTotal = ctx.spawnSlimes + Math.floor(state.wave / WAVES.brutesPerWaveDiv);
  ctx.spawnIndex = 0;
  ctx.spawnTimer = WAVES.spawnInterval;
  ctx.events.emit({ type: 'wave-started', wave: state.wave });
}

export function waveSystem(ctx: SimContext): void {
  const state = ctx.state;

  if (state.spawning && !state.dead) {
    ctx.spawnTimer -= ctx.dt;
    while (ctx.spawnTimer <= 0) {
      ctx.spawnTimer += WAVES.spawnInterval;
      if (ctx.spawnIndex < ctx.spawnTotal) {
        spawnOnRing(ctx, ctx.spawnIndex < ctx.spawnSlimes ? ENEMY_KIND.slime : ENEMY_KIND.brute);
        state.alive++;
        ctx.spawnIndex++;
      } else {
        // One idle interval after the last spawn, exactly like the demo's
        // interval tick that cleared itself.
        state.spawning = false;
        break;
      }
    }
  }

  if (!state.spawning && state.alive <= 0 && !state.dead) nextWave(ctx);
}
