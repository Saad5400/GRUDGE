import { describe, expect, it } from 'vitest';
import { Enemy, ENEMY_KIND, Health, Transform } from '../../src/components';
import { ARENA_HALF } from '../../src/content/arena';
import { WAVES } from '../../src/content/waves';
import { createGame, enemyEids } from '../../src/game';
import { makeInvincible, run } from './harness';

/** Steps until the current wave has finished trickling in (or the cap is hit). */
function runUntilSpawned(game: ReturnType<typeof createGame>, cap = 600) {
  const log = [];
  for (let i = 0; i < cap && game.state.spawning; i++) {
    log.push(...run(game, 1));
  }
  return log;
}

describe('waves', () => {
  it('wave 1 is live before the first tick', () => {
    const game = createGame(61);
    expect(game.state.wave).toBe(1);
    expect(game.state.spawning).toBe(true);
    expect(game.events.ofType('wave-started').map((e) => e.wave)).toEqual([1]);
    expect(enemyEids(game).length).toBe(0);
  });

  it('spawns trickle in one at a time on the ring', () => {
    const game = createGame(62);
    makeInvincible(game);
    const spawnTicks: number[] = [];
    const spawnRadii: number[] = [];
    const ring = ARENA_HALF - WAVES.ringInset;
    for (let i = 0; i < 200 && game.state.spawning; i++) {
      for (const e of run(game, 1)) {
        if (e.type !== 'enemy-spawned') continue;
        spawnTicks.push(i);
        spawnRadii.push(Math.hypot(Transform.x[e.eid], Transform.z[e.eid]));
      }
    }
    expect(spawnTicks.length).toBe(WAVES.baseSlimes + WAVES.slimesPerWave);
    for (let i = 1; i < spawnTicks.length; i++) {
      // 0.38s apart, ±1 tick of fixed-step quantisation
      expect(Math.abs(spawnTicks[i] - spawnTicks[i - 1] - WAVES.spawnInterval * 60)).toBeLessThan(
        1,
      );
    }
    expect(game.state.alive).toBe(spawnTicks.length);
    // every one of them entered on the perimeter ring, at its own angle
    for (const r of spawnRadii) expect(r).toBeCloseTo(ring, 2);
    expect(new Set(spawnRadii.map((r) => r.toFixed(6))).size).toBeGreaterThan(0);
  });

  it('wave n = 3 + 2n slimes then floor(n/2) brutes', () => {
    const game = createGame(63);
    makeInvincible(game);
    for (let wave = 1; wave <= 4; wave++) {
      expect(game.state.wave).toBe(wave);
      let slimes = 0;
      let brutes = 0;
      let sawBruteBeforeSlime = false;
      for (const e of runUntilSpawned(game)) {
        if (e.type !== 'enemy-spawned') continue;
        if (e.big) brutes++;
        else {
          slimes++;
          if (brutes > 0) sawBruteBeforeSlime = true;
        }
      }
      expect(slimes).toBe(WAVES.baseSlimes + wave * WAVES.slimesPerWave);
      expect(brutes).toBe(Math.floor(wave / WAVES.brutesPerWaveDiv));
      expect(sawBruteBeforeSlime).toBe(false);
      // clear the field to roll into the next wave
      for (const e of enemyEids(game)) Health.hp[e] = 0;
      run(game, 1);
    }
    expect(game.state.wave).toBe(5);
  });

  it('clearing the field starts the next wave', () => {
    const game = createGame(64);
    makeInvincible(game);
    runUntilSpawned(game);
    const kills0 = game.state.kills;
    const n = enemyEids(game).length;
    expect(n).toBeGreaterThan(0);
    for (const e of enemyEids(game)) Health.hp[e] = 0;

    const log = run(game, 1);
    expect(log.filter((e) => e.type === 'enemy-died').length).toBe(n);
    expect(log.some((e) => e.type === 'wave-started' && e.wave === 2)).toBe(true);
    expect(game.state.kills).toBe(kills0 + n);
    expect(game.state.alive).toBe(0);
    expect(game.state.wave).toBe(2);
  });

  it('does not start a new wave while enemies are still alive', () => {
    const game = createGame(65);
    makeInvincible(game);
    game.events.clear(); // drop wave 1's start, emitted at construction
    const log = run(game, 400);
    expect(log.filter((e) => e.type === 'wave-started')).toEqual([]);
    expect(game.state.wave).toBe(1);
    expect(enemyEids(game).length).toBeGreaterThan(0);
  });

  it('later waves mix in brutes that hit harder to kill', () => {
    const game = createGame(66);
    makeInvincible(game);
    // fast-forward two waves
    for (let w = 0; w < 2; w++) {
      runUntilSpawned(game);
      for (const e of enemyEids(game)) Health.hp[e] = 0;
      run(game, 1);
    }
    runUntilSpawned(game);
    const kinds = enemyEids(game).map((e) => Enemy.kind[e]);
    expect(kinds.filter((k) => k === ENEMY_KIND.brute).length).toBe(1);
    expect(kinds.filter((k) => k === ENEMY_KIND.slime).length).toBe(9);
  });
});
