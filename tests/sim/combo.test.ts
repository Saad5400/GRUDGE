import { describe, expect, it } from 'vitest';
import { ENEMY_KIND, Health } from '../../src/components';
import { COMBO } from '../../src/content/combo';
import { PLAYER } from '../../src/content/player';
import type { GameEvent } from '../../src/core/events';
import type { Game } from '../../src/core/types';
import { createGame, spawnEnemyAt } from '../../src/game';
import { run } from './harness';

/**
 * Keeps the knight untouchable: these tests are about kills, and a stray wave
 * slime landing a hit would (correctly) wipe the streak mid-test.
 */
function noHurt(game: Game): (tick: number) => void {
  return () => {
    Health.invuln[game.playerEid] = 999;
  };
}

/** One clean kill, resolved on the next tick. Returns that tick's events. */
function killOne(game: Game): GameEvent[] {
  const e = spawnEnemyAt(game, 9, 9, ENEMY_KIND.slime);
  Health.hp[e] = 0;
  return run(game, 1, noHurt(game));
}

const streakEvents = (log: GameEvent[]) => log.filter((e) => e.type === 'streak-changed');

describe('kill streak', () => {
  it('kills inside the window stack, and each one refreshes it', () => {
    const game = createGame(71);
    const first = killOne(game);
    expect(game.state.streak).toBe(1);
    expect(game.state.bestStreak).toBe(1);
    expect(game.state.streakT).toBe(COMBO.window);
    expect(streakEvents(first)).toEqual([{ type: 'streak-changed', streak: 1, best: 1 }]);

    // halfway through the window: still standing, but burning down
    const idle = run(game, 120, noHurt(game));
    expect(streakEvents(idle)).toEqual([]);
    expect(game.state.streak).toBe(1);
    expect(game.state.streakT).toBeLessThan(COMBO.window);
    expect(game.state.streakT).toBeGreaterThan(0);

    const second = killOne(game);
    expect(game.state.streak).toBe(2);
    expect(game.state.bestStreak).toBe(2);
    expect(game.state.streakT).toBe(COMBO.window); // the kill reset the clock
    expect(streakEvents(second)).toEqual([{ type: 'streak-changed', streak: 2, best: 2 }]);
  });

  it('two kills in one tick pop the meter twice', () => {
    const game = createGame(72);
    const a = spawnEnemyAt(game, 9, 9, ENEMY_KIND.slime);
    const b = spawnEnemyAt(game, -9, 9, ENEMY_KIND.slime);
    Health.hp[a] = 0;
    Health.hp[b] = 0;
    const log = run(game, 1, noHurt(game));
    expect(game.state.streak).toBe(2);
    expect(streakEvents(log)).toEqual([
      { type: 'streak-changed', streak: 1, best: 1 },
      { type: 'streak-changed', streak: 2, best: 2 },
    ]);
  });

  it('the window lapses back to zero, and the best stands', () => {
    const game = createGame(73);
    killOne(game);
    expect(game.state.streak).toBe(1);

    // COMBO.window is 4s = 240 ticks; stop just short of it
    const before = run(game, 235, noHurt(game));
    expect(streakEvents(before)).toEqual([]);
    expect(game.state.streak).toBe(1);

    const after = run(game, 10, noHurt(game));
    expect(streakEvents(after)).toEqual([{ type: 'streak-changed', streak: 0, best: 1 }]);
    expect(game.state.streak).toBe(0);
    expect(game.state.streakT).toBe(0);
    expect(game.state.bestStreak).toBe(1);

    // …and it stays quiet once it has dropped
    expect(streakEvents(run(game, 60, noHurt(game)))).toEqual([]);
  });

  it('getting hit costs the streak', () => {
    const game = createGame(74);
    const p = game.playerEid;
    killOne(game);
    expect(game.state.streak).toBe(1);

    Health.invuln[p] = 0; // drop the test guard: this hit is meant to land
    spawnEnemyAt(game, 0.4, 4.1, ENEMY_KIND.slime);
    const log = run(game, 1);
    expect(log.some((e) => e.type === 'player-hurt')).toBe(true);
    expect(game.state.streak).toBe(0);
    expect(game.state.streakT).toBe(0);
    expect(game.state.bestStreak).toBe(1);
    expect(streakEvents(log)).toEqual([{ type: 'streak-changed', streak: 0, best: 1 }]);
  });

  it('a hit in the same tick as a kill still loses the streak', () => {
    const game = createGame(75);
    const dying = spawnEnemyAt(game, 9, 9, ENEMY_KIND.slime);
    Health.hp[dying] = 0;
    spawnEnemyAt(game, 0.4, 4.1, ENEMY_KIND.slime);

    const log = run(game, 1);
    expect(log.some((e) => e.type === 'player-hurt')).toBe(true);
    expect(game.state.kills).toBe(1);
    expect(game.state.streak).toBe(0);
    expect(game.state.streakT).toBe(0);
    expect(game.state.bestStreak).toBe(1); // the kill still counted for the record
    expect(streakEvents(log)).toEqual([
      { type: 'streak-changed', streak: 1, best: 1 },
      { type: 'streak-changed', streak: 0, best: 1 },
    ]);
  });

  it('every healEvery-th kill of a streak pays a heart back', () => {
    const game = createGame(76);
    const p = game.playerEid;
    Health.hp[p] = PLAYER.maxHp - 2;

    const early: GameEvent[] = [];
    for (let k = 0; k < COMBO.healEvery - 1; k++) early.push(...killOne(game));
    expect(game.state.streak).toBe(COMBO.healEvery - 1);
    expect(Health.hp[p]).toBe(PLAYER.maxHp - 2);
    expect(early.filter((e) => e.type === 'player-healed')).toEqual([]);

    const milestone = killOne(game);
    expect(game.state.streak).toBe(COMBO.healEvery);
    expect(Health.hp[p]).toBe(PLAYER.maxHp - 1);
    expect(milestone.filter((e) => e.type === 'player-healed')).toEqual([
      { type: 'player-healed', hp: PLAYER.maxHp - 1 },
    ]);
  });

  it('a full-health knight gets no heal and no event', () => {
    const game = createGame(77);
    const p = game.playerEid;
    Health.hp[p] = Health.maxHp[p];

    const log: GameEvent[] = [];
    for (let k = 0; k < COMBO.healEvery; k++) log.push(...killOne(game));
    expect(game.state.streak).toBe(COMBO.healEvery);
    expect(Health.hp[p]).toBe(PLAYER.maxHp);
    expect(log.filter((e) => e.type === 'player-healed')).toEqual([]);
  });

  it('a kill is counted once even when several steps run before the bus clears', () => {
    // The real main loop clears the bus per FRAME; the accumulator can run
    // several step() calls inside one frame. Regression: the streak must not
    // re-count the previous tick's enemy-died events on the second step.
    const game = createGame(78);
    Health.invuln[game.playerEid] = 999;
    const e = spawnEnemyAt(game, 9, 9, ENEMY_KIND.slime);
    Health.hp[e] = 0;

    game.step(); // kill lands, enemy-died emitted
    game.step(); // same frame, bus NOT cleared between steps
    game.step();
    expect(game.state.streak).toBe(1);
    expect(
      game.events.events.filter((ev) => ev.type === 'streak-changed'),
    ).toEqual([{ type: 'streak-changed', streak: 1, best: 1 }]);
    game.events.clear();
  });
});
