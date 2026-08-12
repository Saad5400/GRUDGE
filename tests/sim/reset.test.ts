import { describe, expect, it } from 'vitest';
import { ENEMY_KIND, Health, Player, SwordTip, Transform, Velocity } from '../../src/components';
import { PLAYER } from '../../src/content/player';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { aim, run, type Script } from './harness';

const busy: Script = (i, intents) =>
  aim(intents, Math.sin(i * 0.1) * 10, 4 + Math.cos(i * 0.1) * 10);

function expectFreshRun(game: ReturnType<typeof createGame>) {
  const p = game.playerEid;
  expect(Transform.x[p]).toBe(PLAYER.startX);
  expect(Transform.z[p]).toBe(PLAYER.startZ);
  expect(Transform.rot[p]).toBe(0);
  expect(Velocity.x[p]).toBe(0);
  expect(Velocity.z[p]).toBe(0);
  expect(Health.hp[p]).toBe(PLAYER.hp);
  expect(Health.maxHp[p]).toBe(PLAYER.maxHp);
  expect(Health.invuln[p]).toBe(0);
  expect(Player.stamina[p]).toBe(1);
  expect(Player.faceVel[p]).toBe(0);
  expect(SwordTip.vx[p]).toBe(0);
  expect(SwordTip.vz[p]).toBe(0);
  expect(SwordTip.prevX[p]).toBe(SwordTip.x[p]);
  expect(SwordTip.prevZ[p]).toBe(SwordTip.z[p]);
  expect(enemyEids(game).length).toBe(0);
  expect(game.state.wave).toBe(1);
  expect(game.state.kills).toBe(0);
  expect(game.state.alive).toBe(0);
  expect(game.state.dead).toBe(false);
  expect(game.state.spawning).toBe(true);
  expect(game.state.shake).toBe(0);
  expect(game.state.hitstop).toBe(0);
}

describe('reset', () => {
  it('restores the opening state and announces itself', () => {
    const game = createGame(71);
    run(game, 300, busy);
    expect(game.state.kills + enemyEids(game).length).toBeGreaterThan(0);

    game.events.clear();
    game.reset();
    expect(game.events.ofType('game-reset').length).toBe(1);
    expect(game.events.ofType('wave-started').map((e) => e.wave)).toEqual([1]);
    expectFreshRun(game);
  });

  it('the restart intent revives a dead run and clears itself', () => {
    const game = createGame(72);
    const p = game.playerEid;
    Health.hp[p] = 1;
    spawnEnemyAt(game, 0.4, 4.1, ENEMY_KIND.slime);
    run(game, 1);
    expect(game.state.dead).toBe(true);

    game.events.clear();
    game.intents.restart = true;
    const log = run(game, 1);
    expect(game.intents.restart).toBe(false);
    expect(log.some((e) => e.type === 'game-reset')).toBe(true);
    expect(game.state.dead).toBe(false);
    expect(Health.hp[p]).toBe(PLAYER.hp);
    expect(game.state.wave).toBe(1);
  });

  it('the restart intent is consumed (not queued) while alive', () => {
    const game = createGame(73);
    run(game, 60, busy);
    const wave = game.state.wave;
    game.events.clear();
    game.intents.restart = true;
    const log = run(game, 1);
    expect(game.intents.restart).toBe(false);
    expect(log.filter((e) => e.type === 'game-reset')).toEqual([]);
    expect(game.state.wave).toBe(wave);
  });

  it('a reset run plays on normally', () => {
    const game = createGame(74);
    run(game, 200, busy);
    game.reset(1234);
    const log = run(game, 200, busy);
    expect(log.filter((e) => e.type === 'enemy-spawned').length).toBeGreaterThan(0);
    expect(game.state.wave).toBe(1);
    expect(enemyEids(game).length).toBeGreaterThan(0);
  });
});
