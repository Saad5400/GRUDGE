/**
 * Per-game simulation context: everything the systems need that is not
 * per-entity component data. One instance per Game, mutated in place (so
 * `reset()` keeps the same object identity).
 */
import { defineQuery, type IWorld } from 'bitecs';
import { Collider, Enemy, Health, Transform, Velocity, type EnemyKind } from '../components';
import { ENEMY_STATS, type EnemyStats } from '../content/enemies';
import type { EventBus, GameEvent, GameEventType } from '../core/events';
import type { GameState, Intents } from '../core/types';
import type { Rng } from '../core/rng';

export interface SimContext {
  world: IWorld;
  events: EventBus;
  intents: Intents;
  state: GameState;
  rng: Rng;
  playerEid: number;

  /** Effective dt for this tick (SIM_DT, or slowed while hit-stop is active). */
  dt: number;
  /**
   * Body speed captured right after movement integration, before the sword's
   * reach constraint adds its pull. The demo's knockback maths used exactly
   * this value, so it is carried across systems rather than recomputed.
   */
  bodySpeed: number;
  /** Rising-edge latch for the whoosh event. */
  whooshLatch: boolean;

  /** Spawn trickle state for the wave in progress. */
  spawnSlimes: number;
  spawnTotal: number;
  spawnIndex: number;
  spawnTimer: number;

  /** Countdown to the next attack-token reassignment (see systems/attackTokens). */
  tokenTimer: number;

  /**
   * events.events.length at the top of the current step. The bus is cleared
   * once per rendered frame, but several sim steps can run inside one frame —
   * sim-side readers must only see events emitted this tick (see tickEvents),
   * or a double-stepped frame re-counts the previous tick's events.
   */
  eventCursor: number;
}

/** Events of one type emitted THIS TICK (after ctx.eventCursor). Sim-side readers use this, never events.ofType. */
export function tickEvents<T extends GameEventType>(
  ctx: SimContext,
  type: T,
): Extract<GameEvent, { type: T }>[] {
  const evs = ctx.events.events;
  const out: Extract<GameEvent, { type: T }>[] = [];
  for (let i = ctx.eventCursor; i < evs.length; i++) {
    const e = evs[i];
    if (e.type === type) out.push(e as Extract<GameEvent, { type: T }>);
  }
  return out;
}

export const enemyQuery = defineQuery([Enemy, Transform, Velocity, Collider, Health]);

/**
 * Enemies as a stable snapshot, newest-first — the demo walked its enemy array
 * backwards, and the copy makes it safe to remove entities while iterating.
 */
/** Archetype stats for an enemy entity. */
export function enemyStats(eid: number): EnemyStats {
  return ENEMY_STATS[Enemy.kind[eid] as EnemyKind];
}

export function enemiesNewestFirst(world: IWorld): number[] {
  const q = enemyQuery(world);
  const out: number[] = new Array(q.length);
  for (let i = 0; i < q.length; i++) out[i] = q[q.length - 1 - i];
  return out;
}
