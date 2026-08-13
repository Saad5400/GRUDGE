import { describe, expect, it } from 'vitest';
import { ENEMY_KIND, Enemy, Health, Player, SwordTip, Transform } from '../../src/components';
import { COMBAT } from '../../src/content/combat';
import { EXECUTION } from '../../src/content/execution';
import type { GameEvent } from '../../src/core/events';
import type { Game } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { aim, run, type Script } from './harness';

/** Aim point held just inside arm's reach; the blade lies along z toward it. */
const PARK_X = 0;
const PARK_Z = 1.2;
/** Ticks of parked aim needed for the tip spring to ring itself out. */
const SETTLE = 90;
/** Straight down the blade from the knight — squarely inside the grip→tip segment. */
const TARGET_Z = 2.4;

/** Silences the wave director and incoming damage (see slam.test.ts). */
function isolate(game: Game): void {
  game.state.spawning = false;
  game.state.alive = 2;
}

function park(game: Game): Script {
  return (_i, intents) => {
    intents.planted = false;
    Health.invuln[game.playerEid] = 999;
    aim(intents, PARK_X, PARK_Z);
  };
}

/**
 * Settles the blade on the park point and puts a brute under it. Nothing has
 * staggered it yet — each test stages Enemy.stagger itself, exactly as the
 * parry/slam/wall-slam systems would.
 */
function stage(game: Game): number {
  isolate(game);
  run(game, SETTLE, park(game));
  return spawnEnemyAt(game, PARK_X, TARGET_Z, ENEMY_KIND.brute);
}

/** Swings the blade through the staged target at `speed` for exactly one tick. */
function swingAt(game: Game, speed: number): GameEvent[] {
  SwordTip.vx[game.playerEid] = speed;
  return run(game, 1, park(game));
}

const hits = (log: GameEvent[]) => log.filter((e) => e.type === 'sword-hit');
const executions = (log: GameEvent[]) => log.filter((e) => e.type === 'execution');

/** Comfortably over EXECUTION.minTipSpeed once one tick of drag has come off. */
const FAST = EXECUTION.minTipSpeed * 2;
/** Fast enough to cut (COMBAT.minHitTipSpeed), too slow to finish. */
const SLOW = (COMBAT.minHitTipSpeed + EXECUTION.minTipSpeed) / 2;

describe('execution', () => {
  it('a fast cut on a staggered enemy finishes it outright', () => {
    const game = createGame(201);
    const p = game.playerEid;
    const e = stage(game);
    Player.stamina[p] = 0.2;
    Enemy.stagger[e] = 1; // the opening a parry or a slam would have made
    const at = { x: Transform.x[e], z: Transform.z[e] };

    const log = swingAt(game, FAST);

    const hit = hits(log)[0];
    expect(hit).toBeDefined();
    if (hit.type !== 'sword-hit') throw new Error('unreachable');
    expect(hit.eid).toBe(e);
    expect(hit.tipSpeed).toBeGreaterThanOrEqual(EXECUTION.minTipSpeed);

    // the same cut, elevated by the opening
    expect(executions(log)).toEqual([
      { type: 'execution', eid: e, x: hit.x, z: hit.z, big: true },
    ]);
    expect(hit.x).toBe(at.x);
    expect(hit.z).toBe(at.z);

    // enemyDeath resolved it later in the very same tick
    expect(log.filter((ev) => ev.type === 'enemy-died').length).toBe(1);
    expect(enemyEids(game)).not.toContain(e);
    expect(game.state.kills).toBe(1);
    // …so the kill feeds the streak like any other
    expect(game.state.streak).toBe(1);
    expect(log.filter((ev) => ev.type === 'streak-changed')).toEqual([
      { type: 'streak-changed', streak: 1, best: 1 },
    ]);

    // a clean finish pays the arms back and lands like a guillotine
    expect(Player.stamina[p]).toBeGreaterThan(0.2 + EXECUTION.staminaRefund - 0.05);
    expect(Player.stamina[p]).toBeLessThanOrEqual(0.2 + EXECUTION.staminaRefund);
    expect(game.state.hitstop).toBe(EXECUTION.hitstop);
    expect(game.state.shake).toBeGreaterThan(EXECUTION.shake - 0.05);
  });

  it('the stamina refund never overfills the meter', () => {
    const game = createGame(202);
    const p = game.playerEid;
    const e = stage(game);
    Player.stamina[p] = 1 - EXECUTION.staminaRefund / 2;
    Enemy.stagger[e] = 1;

    expect(executions(swingAt(game, FAST)).length).toBe(1);
    expect(Player.stamina[p]).toBe(1);
  });

  it('the very same cut on an unstaggered enemy is just a hit', () => {
    const game = createGame(203);
    const e = stage(game);
    expect(Enemy.stagger[e]).toBe(0); // an ordinary hit never opens the window

    const log = swingAt(game, FAST);

    const hit = hits(log)[0];
    if (hit?.type !== 'sword-hit') throw new Error('the blade did not connect');
    expect(hit.tipSpeed).toBeGreaterThanOrEqual(EXECUTION.minTipSpeed);
    expect(executions(log)).toEqual([]);

    const dmg = hit.tipSpeed > COMBAT.heavyTipSpeed ? COMBAT.heavyDamage : COMBAT.lightDamage;
    expect(Health.hp[e]).toBe(6 - dmg);
    expect(enemyEids(game)).toContain(e);
    // and an ordinary hit still leaves no opening behind it
    expect(Enemy.stagger[e]).toBe(0);
  });

  it('a slow cut on a staggered enemy cuts it without finishing it', () => {
    const game = createGame(204);
    const e = stage(game);
    Enemy.stagger[e] = 1;

    const log = swingAt(game, SLOW);

    const hit = hits(log)[0];
    if (hit?.type !== 'sword-hit') throw new Error('the blade did not connect');
    expect(hit.tipSpeed).toBeGreaterThan(COMBAT.minHitTipSpeed);
    expect(hit.tipSpeed).toBeLessThan(EXECUTION.minTipSpeed);

    expect(executions(log)).toEqual([]);
    expect(Health.hp[e]).toBe(6 - COMBAT.lightDamage);
    expect(enemyEids(game)).toContain(e);
    // the opening survives the graze — it is still there to be used properly
    expect(Enemy.stagger[e]).toBeGreaterThan(0);
  });

  it('a stale hit is never re-finished when several steps run before the bus clears', () => {
    // The real main loop clears the bus per FRAME; the accumulator can run
    // several step() calls inside one frame. Regression: the next step must not
    // re-read the previous tick's sword-hit and execute on an opening that
    // opened after the blade had already gone by.
    const game = createGame(205);
    const p = game.playerEid;
    const e = stage(game);
    Player.stamina[p] = 0.2;

    SwordTip.vx[p] = FAST;
    game.step(); // the cut lands on an unstaggered enemy: no execution
    expect(game.events.events.filter((ev) => ev.type === 'sword-hit').length).toBe(1);
    expect(game.events.events.filter((ev) => ev.type === 'execution')).toEqual([]);
    const hp = Health.hp[e];
    const stamina = Player.stamina[p];

    Enemy.stagger[e] = 1; // something staggers it a tick too late
    game.step(); // same frame, bus NOT cleared between steps
    game.step();

    expect(game.events.events.filter((ev) => ev.type === 'execution')).toEqual([]);
    expect(Health.hp[e]).toBe(hp);
    expect(Player.stamina[p]).toBeLessThan(stamina + EXECUTION.staminaRefund);
    expect(enemyEids(game)).toContain(e);
    game.events.clear();
  });
});
