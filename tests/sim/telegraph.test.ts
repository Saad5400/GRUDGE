import { describe, expect, it } from 'vitest';
import {
  ATTACK_STATE,
  ENEMY_KIND,
  Enemy,
  Health,
  SwordTip,
  Transform,
  Velocity,
} from '../../src/components';
import { TELEGRAPH } from '../../src/content/ai';
import { ENEMY_STATS } from '../../src/content/enemies';
import type { GameEvent } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Game, Intents } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { run } from './harness';

const ticksFor = (seconds: number) => Math.round(seconds / SIM_DT);

/** Parks the blade on the body so a resting tip never cuts the test's enemies. */
function parkBlade(game: Game): void {
  const p = game.playerEid;
  SwordTip.x[p] = Transform.x[p];
  SwordTip.z[p] = Transform.z[p];
  SwordTip.prevX[p] = Transform.x[p];
  SwordTip.prevZ[p] = Transform.z[p];
  SwordTip.vx[p] = 0;
  SwordTip.vz[p] = 0;
}

/** No waves, no blade, no knockback: the test watches one brute and nothing else. */
function calm(game: Game): void {
  const p = game.playerEid;
  game.state.spawning = false;
  game.state.alive = 1;
  game.intents.aimActive = true;
  game.intents.aimX = Transform.x[p];
  game.intents.aimZ = Transform.z[p];
  Health.invuln[p] = 9;
}

interface Sample {
  tick: number;
  state: number;
  x: number;
  z: number;
  speed: number;
}

/** Steps the game one tick at a time, sampling the enemy after each step. */
function trace(game: Game, ticks: number, e: number): { log: GameEvent[]; samples: Sample[] } {
  const log: GameEvent[] = [];
  const samples: Sample[] = [];
  for (let i = 0; i < ticks; i++) {
    log.push(...run(game, 1, () => calm(game)));
    samples.push({
      tick: i,
      state: Enemy.attackState[e],
      x: Transform.x[e],
      z: Transform.z[e],
      speed: Math.hypot(Velocity.x[e], Velocity.z[e]),
    });
  }
  return { log, samples };
}

describe('telegraphed lunge', () => {
  it('winds up, commits, lunges along the locked direction, then cools down', () => {
    const game = createGame(201);
    parkBlade(game);
    // Knight at (0, 4); the brute stands 3 away — inside triggerRange (3.4).
    const brute = spawnEnemyAt(game, 0, 7, ENEMY_KIND.brute);
    const total = ticksFor(
      TELEGRAPH.windupTime + TELEGRAPH.strikeTime + TELEGRAPH.recoverTime + TELEGRAPH.cooldown,
    );
    // Stop a few ticks shy of the full cycle: one attack, start to cooled-down.
    const { log, samples } = trace(game, total - 4, brute);

    // The tell fires on the first tick it is in range, the commit one windup later.
    const tele = log.filter((e) => e.type === 'enemy-telegraph');
    const lunge = log.filter((e) => e.type === 'enemy-lunge');
    expect(tele.length).toBe(1);
    expect(lunge.length).toBe(1);
    expect(tele[0]).toMatchObject({ eid: brute, big: true });
    expect(lunge[0]).toMatchObject({ eid: brute });
    // …aimed at where the knight was standing when it committed.
    expect(Enemy.lungeX[brute]).toBeCloseTo(0, 3);
    expect(Enemy.lungeZ[brute]).toBeCloseTo(-1, 3);

    // Every state lasts as long as the content file says it does.
    const ticksIn = (s: number) => samples.filter((v) => v.state === s).length;
    expect(ticksIn(ATTACK_STATE.windup)).toBe(ticksFor(TELEGRAPH.windupTime));
    expect(ticksIn(ATTACK_STATE.strike)).toBe(ticksFor(TELEGRAPH.strikeTime));
    expect(ticksIn(ATTACK_STATE.recover)).toBe(ticksFor(TELEGRAPH.recoverTime));

    // Windup is a plant, not a creep.
    const windup = samples.filter((v) => v.state === ATTACK_STATE.windup);
    for (const v of windup) expect(v.speed).toBe(0);
    expect(Math.abs(windup.at(-1)!.z - windup[0].z)).toBeLessThan(1e-6);

    // The strike is a real lunge: faster than the brute could ever walk, capped,
    // and dead straight along the locked direction.
    const strike = samples.filter((v) => v.state === ATTACK_STATE.strike);
    const strikeTop = Math.max(...strike.map((v) => v.speed));
    expect(strikeTop).toBeGreaterThan(ENEMY_STATS[ENEMY_KIND.brute].maxSpeed * 2);
    expect(strikeTop).toBeLessThanOrEqual(TELEGRAPH.strikeSpeedCap + 1e-3);
    expect(windup.at(-1)!.z - strike.at(-1)!.z).toBeGreaterThan(1.5); // closed real ground
    expect(Math.abs(strike.at(-1)!.x - windup.at(-1)!.x)).toBeLessThan(1e-3);

    // Recovery leaves it standing, then the cooldown gates the next swing.
    const idleAfter = samples.findIndex(
      (v) => v.state === ATTACK_STATE.idle && v.tick > windup[0].tick,
    );
    expect(idleAfter).toBeGreaterThan(0);
    expect(samples.at(-1)!.state).toBe(ATTACK_STATE.idle);
  });

  it('waits out its cooldown before telegraphing again', () => {
    const game = createGame(202);
    parkBlade(game);
    spawnEnemyAt(game, 0, 6.5, ENEMY_KIND.brute);

    const teleTicks: number[] = [];
    for (let i = 0; i < 600; i++) {
      for (const ev of run(game, 1, () => calm(game))) {
        if (ev.type === 'enemy-telegraph') teleTicks.push(i);
      }
    }

    // Attacks repeat, but never faster than windup + strike + recover + cooldown.
    const cycle = ticksFor(
      TELEGRAPH.windupTime + TELEGRAPH.strikeTime + TELEGRAPH.recoverTime + TELEGRAPH.cooldown,
    );
    expect(teleTicks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < teleTicks.length; i++) {
      expect(teleTicks[i] - teleTicks[i - 1]).toBeGreaterThanOrEqual(cycle - 1);
    }
  });

  it('a stun during the windup cancels the attack outright', () => {
    const game = createGame(203);
    parkBlade(game);
    const brute = spawnEnemyAt(game, 0, 7, ENEMY_KIND.brute);
    const log: GameEvent[] = [];
    log.push(...run(game, 6, () => calm(game)));
    expect(Enemy.attackState[brute]).toBe(ATTACK_STATE.windup);

    Enemy.stun[brute] = 0.4;
    log.push(...run(game, 1, () => calm(game)));
    expect(Enemy.attackState[brute]).toBe(ATTACK_STATE.idle);
    expect(Enemy.attackT[brute]).toBe(0);
    expect(Enemy.attackCD[brute]).toBeCloseTo(TELEGRAPH.cooldown, 6);
    expect(log.filter((e) => e.type === 'enemy-lunge')).toEqual([]);

    // And it cannot simply re-open the moment the stagger ends.
    log.push(...run(game, ticksFor(0.4) + 2, () => calm(game)));
    expect(Enemy.stun[brute]).toBe(0);
    expect(Enemy.attackState[brute]).toBe(ATTACK_STATE.idle);
    expect(Enemy.attackCD[brute]).toBeGreaterThan(0);
    expect(log.filter((e) => e.type === 'enemy-lunge')).toEqual([]);
    expect(log.filter((e) => e.type === 'enemy-telegraph').length).toBe(1);
  });

  it('slimes never telegraph, even holding a token in your face', () => {
    const game = createGame(204);
    parkBlade(game);
    const slimes = [
      spawnEnemyAt(game, 0.8, 4.4, ENEMY_KIND.slime),
      spawnEnemyAt(game, -0.8, 4.4, ENEMY_KIND.slime),
      spawnEnemyAt(game, 0, 6, ENEMY_KIND.slime),
    ];
    let everHeld = false;
    const log: GameEvent[] = [];
    for (let i = 0; i < 600; i++) {
      log.push(...run(game, 1, () => calm(game)));
      for (const e of slimes) {
        expect(Enemy.attackState[e]).toBe(ATTACK_STATE.idle);
        everHeld ||= Enemy.token[e] === 1;
      }
    }
    // The gate is the archetype, not a lack of tokens or of opportunity.
    expect(everHeld).toBe(true);
    expect(log.filter((e) => e.type === 'enemy-telegraph')).toEqual([]);
    expect(log.filter((e) => e.type === 'enemy-lunge')).toEqual([]);
  });

  it('is deterministic: same seed and intents → identical group state', () => {
    const script = (i: number, intents: Intents) => {
      intents.aimX = Math.sin(i * 0.09) * 6;
      intents.aimZ = 4 + Math.cos(i * 0.12) * 6;
      intents.aimActive = true;
      intents.planted = i % 90 < 15;
    };
    const build = (seed: number) => {
      const game = createGame(seed);
      spawnEnemyAt(game, 0, 8, ENEMY_KIND.brute);
      spawnEnemyAt(game, 3, 9, ENEMY_KIND.brute);
      spawnEnemyAt(game, -3, 7, ENEMY_KIND.slime);
      spawnEnemyAt(game, 1, 12, ENEMY_KIND.slime);
      return game;
    };
    const groupState = (game: Game) =>
      enemyEids(game).map((e) => [
        Transform.x[e],
        Transform.y[e],
        Transform.z[e],
        Enemy.attackState[e],
        Enemy.attackT[e],
        Enemy.attackCD[e],
        Enemy.token[e],
      ]);

    const a = build(777);
    const b = build(777);
    run(a, 700, script);
    run(b, 700, script);
    const stateA = groupState(a);
    expect(stateA).toEqual(groupState(b));
    // sanity: the run actually exercised the state machine
    expect(stateA.length).toBeGreaterThan(4);
  });
});
