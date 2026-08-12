import { describe, expect, it } from 'vitest';
import {
  ATTACK_STATE,
  Collider,
  ENEMY_KIND,
  Enemy,
  Health,
  SwordTip,
  Transform,
} from '../../src/components';
import { AI_TOKENS } from '../../src/content/ai';
import { COMBAT } from '../../src/content/combat';
import { SIM_DT } from '../../src/core/loop';
import type { Game } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { makeInvincible, run } from './harness';

/** Ticks between two token reassignments. */
const REASSIGN_TICKS = Math.ceil(AI_TOKENS.reassignInterval / SIM_DT);

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

/**
 * Per-tick script for AI-only tests: no waves, no blade, no knockback — the
 * knight stands at his spawn and the only thing moving is enemy intent.
 */
function calm(game: Game): void {
  const p = game.playerEid;
  game.state.spawning = false;
  game.state.alive = 1; // > 0 keeps waveSystem from rolling the next wave
  game.intents.aimActive = true;
  game.intents.aimX = Transform.x[p];
  game.intents.aimZ = Transform.z[p];
  Health.invuln[p] = 9; // no touch damage, so nothing knocks him off his mark
}

function holders(game: Game): number[] {
  return enemyEids(game)
    .filter((e) => Enemy.token[e] === 1)
    .sort((a, b) => a - b);
}

function ids(...eids: number[]): number[] {
  return eids.sort((a, b) => a - b);
}

function distToPlayer(game: Game, e: number): number {
  const p = game.playerEid;
  return Math.hypot(Transform.x[e] - Transform.x[p], Transform.z[e] - Transform.z[p]);
}

/** Bearing of an enemy around the knight — how far an orbiter has swung. */
function angleAroundPlayer(game: Game, e: number): number {
  const p = game.playerEid;
  return Math.atan2(Transform.x[e] - Transform.x[p], Transform.z[e] - Transform.z[p]);
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
    // …and it really is rationing a crowd, not starving everyone.
    expect(crowd).toBeGreaterThan(AI_TOKENS.maxAttackers * 2);
    expect(maxSeen).toBe(AI_TOKENS.maxAttackers);
  });

  it('gives the tokens to the nearest enemies, and only on the reassign cadence', () => {
    const game = createGame(102);
    parkBlade(game);
    // The knight stands at (0, 4); the pack lines up behind him, frozen so the
    // only thing that moves in this test is the allocation itself.
    const near = spawnEnemyAt(game, 0, 8, ENEMY_KIND.brute);
    const mid = spawnEnemyAt(game, 0, 11, ENEMY_KIND.brute);
    const far = spawnEnemyAt(game, 0, 14, ENEMY_KIND.brute);
    const back = spawnEnemyAt(game, 0, 16, ENEMY_KIND.brute);
    for (const e of [near, mid, far, back]) freeze(e);

    run(game, 1, () => calm(game));
    expect(holders(game)).toEqual(ids(near, mid));

    // Teleporting the back marker to the knight's feet does not steal a token
    // mid-interval — the pack only re-reads the field on its own cadence.
    Transform.z[back] = 5;
    run(game, 2, () => calm(game));
    expect(Enemy.token[back]).toBe(0);
    run(game, REASSIGN_TICKS, () => calm(game));
    expect(holders(game)).toEqual(ids(near, back));

    // Killing both holders promotes the next two in line.
    Health.hp[near] = 0;
    Health.hp[back] = 0;
    run(game, REASSIGN_TICKS + 1, () => calm(game));
    expect(ids(...enemyEids(game))).toEqual(ids(mid, far));
    expect(holders(game)).toEqual(ids(mid, far));
  });

  it('never strands an enemy mid-attack: a committed brute keeps its token', () => {
    const game = createGame(103);
    parkBlade(game);
    const brute = spawnEnemyAt(game, 0, 7.2, ENEMY_KIND.brute);
    run(game, 1, () => calm(game));
    expect(Enemy.attackState[brute]).toBe(ATTACK_STATE.windup);

    // Two slimes appear right on top of the knight — strictly nearer than the
    // brute, so a naive allocator would yank its token mid-windup.
    const a = spawnEnemyAt(game, 1.2, 4.2, ENEMY_KIND.slime);
    const b = spawnEnemyAt(game, -1.2, 4.2, ENEMY_KIND.slime);
    freeze(a);
    freeze(b);

    run(game, REASSIGN_TICKS + 2, () => calm(game));
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
    parkBlade(game);
    const holderA = spawnEnemyAt(game, 0, 6, ENEMY_KIND.brute);
    const holderB = spawnEnemyAt(game, 2, 6, ENEMY_KIND.brute);
    const orbiter = spawnEnemyAt(game, 0, 13, ENEMY_KIND.brute); // always the farthest

    const contact = Collider.radius[orbiter] + Collider.radius[game.playerEid] + COMBAT.touchPad;
    const inner = AI_TOKENS.standoffDist - AI_TOKENS.standoffSlack;
    const outer = AI_TOKENS.standoffDist + AI_TOKENS.standoffSlack;
    const startAngle = angleAroundPlayer(game, orbiter);

    let orbiterMin = Infinity;
    let orbiterEverHeld = false;
    let holderMin = Infinity;
    let swept = 0;
    for (let i = 0; i < 600; i++) {
      run(game, 1, () => calm(game));
      orbiterMin = Math.min(orbiterMin, distToPlayer(game, orbiter));
      orbiterEverHeld ||= Enemy.token[orbiter] === 1;
      holderMin = Math.min(holderMin, distToPlayer(game, holderA), distToPlayer(game, holderB));
      swept = Math.abs(angleAroundPlayer(game, orbiter) - startAngle);
    }

    expect(orbiterEverHeld).toBe(false);
    expect(orbiterMin).toBeGreaterThan(contact); // never walked into the knight
    expect(orbiterMin).toBeGreaterThan(inner - 0.5); // …and held the ring
    expect(distToPlayer(game, orbiter)).toBeLessThan(outer + 1);
    expect(swept).toBeGreaterThan(0.5); // it circled instead of just standing off
    // Meanwhile the token holders did the job the orbiter was told to leave alone.
    expect(holderMin).toBeLessThan(contact);
  });
});
