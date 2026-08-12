import { describe, expect, it } from 'vitest';
import { ATTACK_STATE, Collider, ENEMY_KIND, Enemy, Health, Transform } from '../../src/components';
import { AI_TOKENS } from '../../src/content/ai';
import { COMBAT } from '../../src/content/combat';
import { SIM_DT } from '../../src/core/loop';
import type { Game } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { makeInvincible, run } from './harness';

/** Ticks between two token reassignments. */
const REASSIGN_TICKS = Math.ceil(AI_TOKENS.reassignInterval / SIM_DT);

/** Silences the wave director so a test owns exactly the enemies it placed. */
function quietWaves(game: Game): void {
  game.state.spawning = false;
  game.state.alive = 1; // > 0 keeps waveSystem from rolling the next wave
}

function holders(game: Game): number[] {
  return enemyEids(game).filter((e) => Enemy.token[e] === 1);
}

function distToPlayer(game: Game, e: number): number {
  const p = game.playerEid;
  return Math.hypot(Transform.x[e] - Transform.x[p], Transform.z[e] - Transform.z[p]);
}

/** Freezes an enemy in place (stun blocks steering, telegraph and hopping). */
function freeze(e: number): void {
  Enemy.stun[e] = 999;
}

describe('attack tokens', () => {
  it('never hands out more than maxAttackers tokens, however big the crowd', () => {
    const game = createGame(101);
    makeInvincible(game);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spawnEnemyAt(
        game,
        Math.cos(a) * 6,
        4 + Math.sin(a) * 6,
        i % 3 === 0 ? ENEMY_KIND.brute : ENEMY_KIND.slime,
      );
    }

    let maxSeen = 0;
    let crowd = 0;
    for (let i = 0; i < 600; i++) {
      run(game, 1);
      const n = holders(game).length;
      expect(n).toBeLessThanOrEqual(AI_TOKENS.maxAttackers);
      maxSeen = Math.max(maxSeen, n);
      crowd = Math.max(crowd, enemyEids(game).length);
    }
    // …and it really is rationing a crowd, not just starving everyone.
    expect(crowd).toBeGreaterThan(AI_TOKENS.maxAttackers * 2);
    expect(maxSeen).toBe(AI_TOKENS.maxAttackers);
  });

  it('gives the tokens to the nearest enemies, and only on the reassign cadence', () => {
    const game = createGame(102);
    makeInvincible(game);
    // Player sits at (0, 4); the pack lines up behind it, frozen so the only
    // thing that moves in this test is the allocation itself.
    const near = spawnEnemyAt(game, 0, 8, ENEMY_KIND.brute);
    const mid = spawnEnemyAt(game, 0, 11, ENEMY_KIND.brute);
    const far = spawnEnemyAt(game, 0, 14, ENEMY_KIND.brute);
    const farthest = spawnEnemyAt(game, 0, 16, ENEMY_KIND.brute);
    for (const e of [near, mid, far, farthest]) freeze(e);

    run(game, 1, () => quietWaves(game));
    expect(holders(game)).toEqual([near, mid].sort((a, b) => a - b));

    // Teleporting the back marker to the player's feet does not steal a token
    // mid-interval — the pack only re-reads the field on its own cadence.
    Transform.z[farthest] = 5;
    run(game, 2, () => quietWaves(game));
    expect(Enemy.token[farthest]).toBe(0);
    run(game, REASSIGN_TICKS, () => quietWaves(game));
    expect(holders(game)).toEqual([near, farthest].sort((a, b) => a - b));

    // Killing both holders promotes the next two in line.
    Health.hp[near] = 0;
    Health.hp[farthest] = 0;
    run(game, REASSIGN_TICKS + 1, () => quietWaves(game));
    expect(enemyEids(game).sort((a, b) => a - b)).toEqual([mid, far].sort((a, b) => a - b));
    expect(holders(game)).toEqual([mid, far].sort((a, b) => a - b));
  });

  it('never strands an enemy mid-attack: a committed brute keeps its token', () => {
    const game = createGame(103);
    makeInvincible(game);
    const brute = spawnEnemyAt(game, 0, 7.2, ENEMY_KIND.brute);
    run(game, 1, () => quietWaves(game));
    expect(Enemy.attackState[brute]).toBe(ATTACK_STATE.windup);

    // Two slimes appear right on top of the player — strictly nearer than the
    // brute, so a naive allocator would yank its token mid-windup.
    const a = spawnEnemyAt(game, 0.6, 4.2, ENEMY_KIND.slime);
    const b = spawnEnemyAt(game, -0.6, 4.2, ENEMY_KIND.slime);
    freeze(a);
    freeze(b);

    run(game, REASSIGN_TICKS + 2, () => quietWaves(game));
    expect(Enemy.attackState[brute]).not.toBe(ATTACK_STATE.idle);
    expect(Enemy.token[brute]).toBe(1);
    expect(distToPlayer(game, brute)).toBeGreaterThan(distToPlayer(game, a));
    // The committed brute occupies one of the two slots; one slime gets the other.
    const held = holders(game);
    expect(held.length).toBe(AI_TOKENS.maxAttackers);
    expect(held.filter((e) => e === a || e === b).length).toBe(1);
  });

  it('non-holders hold the standoff ring while a holder closes to contact', () => {
    const game = createGame(104);
    makeInvincible(game);
    const holderA = spawnEnemyAt(game, 0, 6, ENEMY_KIND.brute);
    const holderB = spawnEnemyAt(game, 2, 6, ENEMY_KIND.brute);
    const orbiter = spawnEnemyAt(game, 0, 13, ENEMY_KIND.brute); // always the farthest

    const contact = Collider.radius[orbiter] + Collider.radius[game.playerEid] + COMBAT.touchPad;
    const inner = AI_TOKENS.standoffDist - AI_TOKENS.standoffSlack;
    const outer = AI_TOKENS.standoffDist + AI_TOKENS.standoffSlack;

    let orbiterMin = Infinity;
    let orbiterEverHeld = false;
    let holderMin = Infinity;
    let tangential = 0;
    const startAngle = Math.atan2(Transform.x[orbiter], Transform.z[orbiter]);
    for (let i = 0; i < 600; i++) {
      run(game, 1, () => quietWaves(game));
      orbiterMin = Math.min(orbiterMin, distToPlayer(game, orbiter));
      orbiterEverHeld ||= Enemy.token[orbiter] === 1;
      holderMin = Math.min(holderMin, distToPlayer(game, holderA), distToPlayer(game, holderB));
      tangential = Math.abs(Math.atan2(Transform.x[orbiter], Transform.z[orbiter]) - startAngle);
    }

    expect(orbiterEverHeld).toBe(false);
    expect(orbiterMin).toBeGreaterThan(contact); // never walked into the player
    expect(orbiterMin).toBeGreaterThan(inner - 0.5); // …and held the ring
    expect(distToPlayer(game, orbiter)).toBeLessThan(outer + 1.5);
    expect(tangential).toBeGreaterThan(0.5); // it circled instead of standing still
    // Meanwhile the token holders did the job the orbiter was told to leave alone.
    expect(holderMin).toBeLessThan(contact);
  });
});
