import { describe, expect, it } from 'vitest';
import {
  ATTACK_STATE,
  ENEMY_KIND,
  Enemy,
  Health,
  Transform,
  Velocity,
  type EnemyKind,
} from '../../src/components';
import { TELEGRAPH } from '../../src/content/ai';
import { ARENA_HALF, PILLARS } from '../../src/content/arena';
import { ENEMY_PHYS } from '../../src/content/enemies';
import { WALL_SLAM } from '../../src/content/environment';
import type { GameEvent } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Game } from '../../src/core/types';
import { createGame, spawnEnemyAt } from '../../src/game';
import type { SimContext } from '../../src/systems/context';
import { wallSlamSystem } from '../../src/systems/wallSlam';
import { run } from './harness';

/**
 * enemyAI caps horizontal speed every tick (ENEMY_PHYS.stunSpeedCap while
 * stunned, TELEGRAPH.strikeSpeedCap mid-lunge), so this is the speed a slam
 * actually arrives with in the full pipeline — set velocities well above it and
 * the cap does the normalising for us.
 */
const STUN_IMPACT = ENEMY_PHYS.stunSpeedCap;

/** Damage the formula owes for a given impact speed. */
function expectedDamage(impact: number): number {
  return (
    WALL_SLAM.baseDamage +
    Math.floor((impact - WALL_SLAM.minImpactSpeed) * WALL_SLAM.speedDamageFactor)
  );
}

/**
 * A stunned enemy planted on a surface with velocity driving into it. Stunned
 * because a walking enemy is capped below the slam threshold by design (and a
 * stunned body still integrates velocity, un-steered — see enemyAI), so
 * knockback is the only thing that ever slams anything into masonry.
 */
function flung(
  game: Game,
  x: number,
  z: number,
  vx: number,
  vz: number,
  kind: EnemyKind = ENEMY_KIND.slime,
) {
  const e = spawnEnemyAt(game, x, z, kind);
  Enemy.stun[e] = 1;
  Velocity.x[e] = vx;
  Velocity.z[e] = vz;
  return e;
}

function slams(log: GameEvent[], eid: number) {
  return log.filter((ev) => ev.type === 'wall-slam' && ev.eid === eid);
}

/**
 * A SimContext over a real game's world, for driving wallSlam on its own. The
 * pipeline's speed caps put the top of the damage curve out of reach of
 * game.step(), so the formula itself is pinned here instead.
 */
function directCtx(game: Game): SimContext {
  return {
    world: game.world,
    events: game.events,
    intents: game.intents,
    state: game.state,
    rng: game.rng,
    playerEid: game.playerEid,
    dt: SIM_DT,
    bodySpeed: 0,
    whooshLatch: false,
    spawnSlimes: 0,
    spawnTotal: 0,
    spawnIndex: 0,
    spawnTimer: 0,
    tokenTimer: 0,
    eventCursor: 0,
  };
}

describe('wall slam', () => {
  it('an enemy flung into a wall is hurt, staggered and bounced off it', () => {
    const game = createGame(81);
    const e = flung(game, ARENA_HALF, 0, 40, 0);
    const hp0 = Health.hp[e];

    const log = run(game, 1);
    const hits = slams(log, e);
    expect(hits.length).toBe(1);
    const hit = hits[0];
    if (hit.type !== 'wall-slam') throw new Error('unreachable');

    expect(hit.impact).toBeCloseTo(STUN_IMPACT, 2);
    expect(hit.big).toBe(false);
    // The event reports where the body actually was — over the line. collision
    // runs after us and is what puts it back inside.
    expect(hit.x).toBeGreaterThan(ARENA_HALF);
    expect(Transform.x[e]).toBe(ARENA_HALF);

    expect(Health.hp[e]).toBe(hp0 - expectedDamage(STUN_IMPACT));
    // A big opening: staggered (executable), not merely flinched.
    expect(Enemy.stagger[e]).toBeCloseTo(WALL_SLAM.stagger, 5);
    expect(Enemy.stun[e]).toBeGreaterThanOrEqual(Enemy.stagger[e]);
    expect(Enemy.flash[e]).toBeCloseTo(WALL_SLAM.flashTime, 5);

    // …and it comes off the wall, slower than it went in
    expect(Velocity.x[e]).toBeCloseTo(-STUN_IMPACT * WALL_SLAM.restitution, 2);
    expect(Velocity.z[e]).toBe(0);

    expect(game.state.hitstop).toBe(WALL_SLAM.hitstop);
    expect(game.state.shake).toBeGreaterThan(WALL_SLAM.shake - 0.05);
  });

  it('a below-threshold nudge into the wall does nothing at all', () => {
    const game = createGame(82);
    // Under the threshold even before drag scrubs it further.
    const v = WALL_SLAM.minImpactSpeed - 3;
    const e = flung(game, ARENA_HALF, 0, v, 0);
    const hp0 = Health.hp[e];

    const log = run(game, 1);
    expect(slams(log, e)).toEqual([]);
    expect(Health.hp[e]).toBe(hp0);
    expect(Enemy.stagger[e]).toBe(0);
    expect(Enemy.flash[e]).toBe(0);
    // No bounce either — it is still pressed against the wall, as before.
    expect(Velocity.x[e]).toBeGreaterThan(0);
    expect(Transform.x[e]).toBe(ARENA_HALF);
  });

  it('walking into a wall never slams: the cap keeps enemies under the threshold', () => {
    const game = createGame(83);
    const e = spawnEnemyAt(game, ARENA_HALF, 0, ENEMY_KIND.slime);
    const hp0 = Health.hp[e];

    // Held against the wall at full tilt for two seconds — un-stunned, so
    // enemyAI clamps it back to the slime's walk cap every single tick.
    const log = run(game, 120, () => {
      Velocity.x[e] = 40;
      Velocity.z[e] = 0;
    });

    expect(slams(log, e)).toEqual([]);
    expect(Health.hp[e]).toBe(hp0);
    expect(Transform.x[e]).toBe(ARENA_HALF);
  });

  it.each([
    [0, 0],
    [1 / WALL_SLAM.speedDamageFactor, 1],
    [2 / WALL_SLAM.speedDamageFactor - 0.001, 1],
    [3 / WALL_SLAM.speedDamageFactor, 3],
  ])('damage scales with impact speed: +%f over the threshold → +%i', (over, extra) => {
    const game = createGame(84);
    const impact = WALL_SLAM.minImpactSpeed + over;
    const e = spawnEnemyAt(game, ARENA_HALF + 0.1, 0, ENEMY_KIND.slime);
    Health.hp[e] = 100;
    Velocity.x[e] = impact;
    game.events.clear();

    wallSlamSystem(directCtx(game));

    expect(Health.hp[e]).toBe(100 - (WALL_SLAM.baseDamage + extra));
    const hits = game.events.ofType('wall-slam');
    expect(hits.length).toBe(1);
    expect(hits[0].impact).toBeCloseTo(impact, 4);
  });

  it('a pillar hits just as hard as a wall does', () => {
    const game = createGame(85);
    const pillar = PILLARS[3]; // (10, 10)
    // Just outside the pillar, driving straight at its centre along +x.
    const e = flung(game, pillar.x - pillar.r - 0.6, pillar.z, 40, 0);
    const hp0 = Health.hp[e];

    const log = run(game, 1);
    const hits = slams(log, e);
    expect(hits.length).toBe(1);
    const hit = hits[0];
    if (hit.type !== 'wall-slam') throw new Error('unreachable');

    expect(hit.impact).toBeCloseTo(STUN_IMPACT, 2);
    expect(Health.hp[e]).toBe(hp0 - expectedDamage(STUN_IMPACT));
    expect(Enemy.stagger[e]).toBeCloseTo(WALL_SLAM.stagger, 5);
    // bounced back off the stone, along the outward normal
    expect(Velocity.x[e]).toBeCloseTo(-STUN_IMPACT * WALL_SLAM.restitution, 2);
    // and collision still owns the position: pushed clear of the pillar
    expect(Math.hypot(Transform.x[e] - pillar.x, Transform.z[e] - pillar.z)).toBeGreaterThan(
      pillar.r,
    );
  });

  it('a corner resolves to exactly one impact, not two', () => {
    const game = createGame(86);
    // Both axes overshoot with a component over the threshold; only the first
    // (x) may land, and the tangential z velocity survives untouched.
    const e = flung(game, ARENA_HALF, ARENA_HALF, 40, 40);
    const hp0 = Health.hp[e];

    const log = run(game, 1);
    expect(slams(log, e).length).toBe(1);
    expect(Health.hp[e]).toBe(hp0 - WALL_SLAM.baseDamage);
    expect(Velocity.x[e]).toBeLessThan(0);
    expect(Velocity.z[e]).toBeGreaterThan(WALL_SLAM.minImpactSpeed);
  });

  it('a brute that lunges into a wall stops swinging', () => {
    const game = createGame(87);
    const e = flung(game, ARENA_HALF, 0, 40, 0, ENEMY_KIND.brute);
    // A committed lunge, not a stun: telegraph would cancel a stunned attack
    // before we ever see it, and the lunge is what carries it into the wall.
    Enemy.stun[e] = 0;
    Enemy.attackState[e] = ATTACK_STATE.strike;
    Enemy.attackT[e] = TELEGRAPH.strikeTime;
    Enemy.attackCD[e] = 1;
    const hp0 = Health.hp[e];

    const log = run(game, 1);
    const hits = slams(log, e);
    expect(hits.length).toBe(1);
    const hit = hits[0];
    if (hit.type !== 'wall-slam') throw new Error('unreachable');
    expect(hit.big).toBe(true);
    // a lunge outruns the walk cap, so it hurts more than a stunned slide
    expect(hit.impact).toBeCloseTo(TELEGRAPH.strikeSpeedCap, 2);
    expect(Health.hp[e]).toBe(hp0 - expectedDamage(TELEGRAPH.strikeSpeedCap));
    expect(expectedDamage(TELEGRAPH.strikeSpeedCap)).toBeGreaterThan(WALL_SLAM.baseDamage);

    // the attack is broken outright…
    expect(Enemy.attackState[e]).toBe(ATTACK_STATE.idle);
    expect(Enemy.attackT[e]).toBe(0);
    // …but it keeps the cooldown it already had (telegraph took one dt off it)
    expect(Enemy.attackCD[e]).toBeCloseTo(1 - SIM_DT, 4);
  });

  it('a wall can finish an enemy, and the kill feeds the streak', () => {
    const game = createGame(88);
    const e = flung(game, ARENA_HALF, 0, 40, 0);
    Health.hp[e] = WALL_SLAM.baseDamage;
    game.state.alive++; // this enemy is part of the wave, so deaths balance out

    const log = run(game, 1);
    expect(slams(log, e).length).toBe(1);
    expect(log.filter((ev) => ev.type === 'enemy-died').length).toBe(1);
    expect(game.state.kills).toBe(1);
    expect(game.state.streak).toBe(1);
    expect(log.filter((ev) => ev.type === 'streak-changed').length).toBe(1);
  });
});
