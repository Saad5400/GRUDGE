/**
 * Shared helpers for the headless sim tests: drive N fixed ticks with a scripted
 * intent function and collect every event the sim emitted along the way
 * (the real main loop clears the bus each frame, so tests do the same).
 */
import { Health, Player, SwordTip, Transform, Velocity } from '../../src/components';
import type { GameEvent } from '../../src/core/events';
import type { Game, Intents } from '../../src/core/types';

export type Script = (tick: number, intents: Intents) => void;

export function run(game: Game, ticks: number, script?: Script): GameEvent[] {
  const log: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    if (script) script(i, game.intents);
    game.step();
    for (const e of game.events.events) log.push(e);
    game.events.clear();
  }
  return log;
}

export function aim(intents: Intents, x: number, z: number): void {
  intents.aimX = x;
  intents.aimZ = z;
  intents.aimActive = true;
}

/** Makes the player unkillable so long tests can observe other systems. */
export function makeInvincible(game: Game): void {
  Health.hp[game.playerEid] = 9999;
  Health.maxHp[game.playerEid] = 9999;
}

export interface Snapshot {
  x: number;
  z: number;
  rot: number;
  vx: number;
  vz: number;
  tipX: number;
  tipZ: number;
  tipVx: number;
  tipVz: number;
  hp: number;
  stamina: number;
  wave: number;
  kills: number;
  alive: number;
  enemies: number[];
}

/** Everything a determinism check needs to compare two runs. */
export function snapshot(game: Game, enemyEids: (g: Game) => number[]): Snapshot {
  const p = game.playerEid;
  const enemies: number[] = [];
  for (const e of enemyEids(game)) {
    enemies.push(Transform.x[e], Transform.y[e], Transform.z[e], Health.hp[e]);
  }
  return {
    x: Transform.x[p],
    z: Transform.z[p],
    rot: Transform.rot[p],
    vx: Velocity.x[p],
    vz: Velocity.z[p],
    tipX: SwordTip.x[p],
    tipZ: SwordTip.z[p],
    tipVx: SwordTip.vx[p],
    tipVz: SwordTip.vz[p],
    hp: Health.hp[p],
    stamina: Player.stamina[p],
    wave: game.state.wave,
    kills: game.state.kills,
    alive: game.state.alive,
    enemies,
  };
}
