import { describe, expect, it } from 'vitest';
import { Collider, ENEMY_KIND, Enemy, Health, Transform, Velocity } from '../../src/components';
import { ARENA_HALF, PILLARS } from '../../src/content/arena';
import { COMBAT } from '../../src/content/combat';
import { ENEMY_PHYS, ENEMY_STATS } from '../../src/content/enemies';
import { PLAYER } from '../../src/content/player';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { makeInvincible, run } from './harness';

describe('enemy AI', () => {
  it('slimes hop toward the player: airborne bursts, not a steady walk', () => {
    const game = createGame(41);
    const e = spawnEnemyAt(game, 10, 4, ENEMY_KIND.slime);
    const x0 = Transform.x[e];
    let airborne = 0;
    let maxSpeed = 0;
    run(game, 180, () => {
      if (Transform.y[e] > 0) airborne++;
      maxSpeed = Math.max(maxSpeed, Math.hypot(Velocity.x[e], Velocity.z[e]));
    });
    expect(Transform.x[e]).toBeLessThan(x0 - 2); // closed the distance
    expect(airborne).toBeGreaterThan(20); // spent real time in the air
    expect(maxSpeed).toBeGreaterThan(ENEMY_STATS[ENEMY_KIND.brute].maxSpeed);
    expect(maxSpeed).toBeLessThanOrEqual(ENEMY_STATS[ENEMY_KIND.slime].maxSpeed + 1e-3);
  });

  it('brutes walk the player down, capped and grounded', () => {
    const game = createGame(42);
    const e = spawnEnemyAt(game, 12, 4, ENEMY_KIND.brute);
    const x0 = Transform.x[e];
    let maxSpeed = 0;
    run(game, 120, () => {
      maxSpeed = Math.max(maxSpeed, Math.hypot(Velocity.x[e], Velocity.z[e]));
      expect(Transform.y[e]).toBe(0);
    });
    expect(Transform.x[e]).toBeLessThan(x0 - 3);
    expect(maxSpeed).toBeLessThanOrEqual(ENEMY_STATS[ENEMY_KIND.brute].maxSpeed + 1e-3);
  });

  it('a stunned enemy stops thinking (but is still a physics body)', () => {
    const game = createGame(43);
    const e = spawnEnemyAt(game, 10, 4, ENEMY_KIND.brute);
    Enemy.stun[e] = 999;
    const x0 = Transform.x[e];
    run(game, 120);
    expect(Math.abs(Transform.x[e] - x0)).toBeLessThan(0.05);
    expect(Enemy.stun[e]).toBeLessThan(999); // …and the stun is ticking down
  });

  it('wave spawns drop in from above and land', () => {
    const game = createGame(44);
    run(game, 23); // first trickle spawn
    const [e] = enemyEids(game);
    expect(e).toBeDefined();
    expect(Transform.y[e]).toBeGreaterThan(ENEMY_PHYS.spawnHeight - 1);
    run(game, 120);
    expect(Transform.y[e]).toBe(0);
  });

  it('enemies push each other apart instead of stacking', () => {
    const game = createGame(45);
    const a = spawnEnemyAt(game, 6, 4, ENEMY_KIND.slime);
    const b = spawnEnemyAt(game, 6.05, 4.05, ENEMY_KIND.slime);
    run(game, 30);
    const d = Math.hypot(Transform.x[a] - Transform.x[b], Transform.z[a] - Transform.z[b]);
    expect(d).toBeGreaterThan(Collider.radius[a] + Collider.radius[b] - 0.2);
  });

  it('enemies obey the arena and the pillars', () => {
    const game = createGame(46);
    makeInvincible(game);
    const pillar = PILLARS[1];
    const e = spawnEnemyAt(game, pillar.x + 0.1, pillar.z + 0.05, ENEMY_KIND.brute);
    run(game, 200, (_i, intents) => {
      intents.aimActive = true;
      intents.aimX = 0;
      intents.aimZ = 4;
    });
    for (const eid of enemyEids(game)) {
      expect(Math.abs(Transform.x[eid])).toBeLessThanOrEqual(ARENA_HALF);
      expect(Math.abs(Transform.z[eid])).toBeLessThanOrEqual(ARENA_HALF);
    }
    expect(Math.hypot(Transform.x[e] - pillar.x, Transform.z[e] - pillar.z)).toBeGreaterThanOrEqual(
      pillar.r + Collider.radius[e] - 1e-3,
    );
  });
});

describe('touch damage', () => {
  it('costs exactly one heart even with three enemies inside the player', () => {
    const game = createGame(51);
    const p = game.playerEid;
    spawnEnemyAt(game, 0.4, 4.1, ENEMY_KIND.slime);
    spawnEnemyAt(game, -0.4, 3.9, ENEMY_KIND.slime);
    spawnEnemyAt(game, 0.0, 4.3, ENEMY_KIND.slime);

    const log = run(game, 1);
    expect(Health.hp[p]).toBe(PLAYER.hp - 1);
    expect(Health.invuln[p]).toBe(PLAYER.invulnTime);
    expect(log.filter((e) => e.type === 'player-hurt').length).toBe(1);
    expect(game.state.hitstop).toBe(COMBAT.hurtHitstop);

    // i-frames hold for the rest of the invulnerability window
    const log2 = run(game, 50);
    expect(Health.hp[p]).toBe(PLAYER.hp - 1);
    expect(log2.filter((e) => e.type === 'player-hurt')).toEqual([]);
    expect(Health.invuln[p]).toBeGreaterThan(0);
  });

  it('an airborne enemy passes harmlessly overhead', () => {
    const game = createGame(52);
    const p = game.playerEid;
    const e = spawnEnemyAt(game, 0, 4, ENEMY_KIND.slime, COMBAT.touchMaxHeight + 2);
    Enemy.stun[e] = 999; // no hopping, just falling
    const log = run(game, 8);
    expect(Transform.y[e]).toBeGreaterThan(COMBAT.touchMaxHeight);
    expect(log.filter((ev) => ev.type === 'player-hurt')).toEqual([]);
    expect(Health.hp[p]).toBe(PLAYER.hp);
  });

  it('running out of hearts kills the player and stops the run', () => {
    const game = createGame(53);
    const p = game.playerEid;
    Health.hp[p] = 1;
    spawnEnemyAt(game, 0.4, 4.1, ENEMY_KIND.slime);

    const log = run(game, 1);
    expect(Health.hp[p]).toBeLessThanOrEqual(0);
    expect(game.state.dead).toBe(true);
    const died = log.find((e) => e.type === 'player-died');
    expect(died).toBeDefined();
    if (died?.type === 'player-died') expect(died.wave).toBe(game.state.wave);

    // no further damage events, and no new waves, once the run is over
    const after = run(game, 300);
    expect(after.filter((e) => e.type === 'player-hurt')).toEqual([]);
    expect(after.filter((e) => e.type === 'wave-started')).toEqual([]);
    expect(game.state.wave).toBe(1);
  });

  it('killing a brute heals a wounded player', () => {
    const game = createGame(54);
    const p = game.playerEid;
    Health.hp[p] = 3;
    const brute = spawnEnemyAt(game, 8, 4, ENEMY_KIND.brute);
    Health.hp[brute] = 0;
    const log = run(game, 1);
    expect(Health.hp[p]).toBe(4);
    expect(log.some((e) => e.type === 'player-healed' && e.hp === 4)).toBe(true);
    expect(log.some((e) => e.type === 'enemy-died' && e.big)).toBe(true);

    // …but never above the cap
    const full = spawnEnemyAt(game, 8, 4, ENEMY_KIND.brute);
    Health.hp[p] = PLAYER.maxHp;
    Health.hp[full] = 0;
    const log2 = run(game, 1);
    expect(Health.hp[p]).toBe(PLAYER.maxHp);
    expect(log2.filter((e) => e.type === 'player-healed')).toEqual([]);
  });
});
