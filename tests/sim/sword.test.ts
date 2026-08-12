import { describe, expect, it } from 'vitest';
import { ENEMY_KIND, Enemy, Health, Player, SwordTip, Transform } from '../../src/components';
import { COMBAT } from '../../src/content/combat';
import { SWORD } from '../../src/content/sword';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import type { Game, Intents } from '../../src/core/types';
import { aim, run } from './harness';

/** Aim alternately to either side of the aim line, whipping the tip sideways. */
function whipSides(half: number, period = 10, z = 4) {
  return (i: number, intents: Intents) => {
    aim(intents, Math.floor(i / period) % 2 === 0 ? half : -half, z);
  };
}

/**
 * Sweeps the aim point back and forth *through* a target, perpendicular to the
 * player→target line and tracking the target as it is knocked around. This is
 * what a player does with the mouse to cut something down.
 */
function whipThrough(game: Game, eid: number, period = 10, offset = 1.6) {
  return (i: number, intents: Intents) => {
    const p = game.playerEid;
    const dx = Transform.x[eid] - Transform.x[p];
    const dz = Transform.z[eid] - Transform.z[p];
    const d = Math.hypot(dx, dz) || 1;
    const s = Math.floor(i / period) % 2 === 0 ? 1 : -1;
    aim(
      intents,
      Transform.x[eid] + (-dz / d) * offset * s,
      Transform.z[eid] + (dx / d) * offset * s,
    );
  };
}

describe('sword physics', () => {
  it('the tip settles on the aim point but reaches it with momentum, not teleporting', () => {
    const game = createGame(7);
    const p = game.playerEid;
    let maxSpeed = 0;
    run(game, 240, (_i, intents) => {
      aim(intents, 2.4, 4);
      maxSpeed = Math.max(maxSpeed, Math.hypot(SwordTip.vx[p], SwordTip.vz[p]));
    });
    // it whipped out to the target...
    expect(maxSpeed).toBeGreaterThan(COMBAT.heavyTipSpeed);
    // ...and eventually came to rest on it
    expect(Math.hypot(SwordTip.x[p] - 2.4, SwordTip.z[p] - 4)).toBeLessThan(0.5);
    expect(Math.hypot(SwordTip.vx[p], SwordTip.vz[p])).toBeLessThan(1);
  });

  it('never breaks the reach + stretch leash, and never passes through the body', () => {
    const game = createGame(11);
    const p = game.playerEid;
    let maxR = 0;
    let minR = Infinity;
    run(game, 400, (i, intents) => {
      // yank the aim around in a wide circle, far outside arm's reach
      aim(intents, Math.sin(i * 0.4) * 14, 4 + Math.cos(i * 0.4) * 14);
      const r = Math.hypot(SwordTip.x[p] - Transform.x[p], SwordTip.z[p] - Transform.z[p]);
      maxR = Math.max(maxR, r);
      minR = Math.min(minR, r);
    });
    // one tick of integration may carry the tip a little past the clamp
    expect(maxR).toBeLessThan(SWORD.reach + SWORD.stretch + 0.6);
    expect(minR).toBeGreaterThan(SWORD.minRadius - 0.3);
  });

  it('an over-extended blade drags the body along (no walk input at all)', () => {
    const game = createGame(3);
    const p = game.playerEid;
    const z0 = Transform.z[p];
    // 3.3 units away: inside the walk zone (3.4) so no chase accel can fire,
    // but outside arm reach (2.9) so only the leash can move the knight.
    run(game, 60, (_i, intents) => aim(intents, 0, z0 - 3.3));
    expect(Transform.z[p]).toBeLessThan(z0 - 0.5);
    expect(Transform.x[p]).toBeCloseTo(0, 5);
  });

  it('emits whoosh on the rising edge of a fast swing, with hysteresis', () => {
    const game = createGame(21);
    const log = run(game, 60, whipSides(2.6, 12));
    const whooshes = log.filter((e) => e.type === 'whoosh');
    // 5 direction changes, but the latch only re-arms once the blade slows down
    expect(whooshes.length).toBeGreaterThanOrEqual(2);
    expect(whooshes.length).toBeLessThan(5);
    for (const w of whooshes) {
      if (w.type === 'whoosh') expect(w.tipSpeed).toBeGreaterThan(SWORD.whooshOn);
    }
  });

  it('stamina drains under sustained fast blade work and regenerates at rest', () => {
    const game = createGame(31);
    const p = game.playerEid;
    expect(Player.stamina[p]).toBe(1);
    run(game, 240, whipSides(2.6, 8));
    const drained = Player.stamina[p];
    expect(drained).toBeLessThan(0.8);

    // park the aim right where the tip already is: the blade goes quiet
    run(game, 240, (_i, intents) => aim(intents, SwordTip.x[p], SwordTip.z[p]));
    expect(Player.stamina[p]).toBeGreaterThan(drained + 0.2);
    expect(Player.stamina[p]).toBeLessThanOrEqual(1);
  });
});

describe('sword damage', () => {
  it('a whipped blade cuts a slime down', () => {
    const game = createGame(5);
    const enemy = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.slime);
    expect(Health.hp[enemy]).toBe(2);

    const log = run(game, 30, whipThrough(game, enemy));
    const hits = log.filter((e) => e.type === 'sword-hit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      if (h.type === 'sword-hit') expect(h.tipSpeed).toBeGreaterThan(COMBAT.minHitTipSpeed);
    }
    expect(log.some((e) => e.type === 'sword-hit' && e.killed)).toBe(true);
    expect(log.some((e) => e.type === 'enemy-died' && !e.big)).toBe(true);
    expect(game.state.kills).toBe(1);
    expect(enemyEids(game).includes(enemy)).toBe(false);
  });

  it('a fast clean cut does double damage', () => {
    const game = createGame(6);
    const enemy = spawnEnemyAt(game, 2.4, 4, ENEMY_KIND.brute);
    const log = run(game, 12, whipThrough(game, enemy));
    const hit = log.find((e) => e.type === 'sword-hit');
    expect(hit).toBeDefined();
    if (hit?.type === 'sword-hit') {
      expect(hit.tipSpeed).toBeGreaterThan(COMBAT.heavyTipSpeed);
      expect(Health.hp[enemy]).toBe(6 - COMBAT.heavyDamage);
    }
  });

  it('the per-enemy hit cooldown prevents a single swing from shredding a brute', () => {
    const game = createGame(6);
    const enemy = spawnEnemyAt(game, 2.4, 4, ENEMY_KIND.brute);
    const log = run(game, 17, whipThrough(game, enemy));
    expect(log.filter((e) => e.type === 'sword-hit').length).toBe(1);
    expect(Health.hp[enemy]).toBeGreaterThan(0);
  });

  it('a slow blade does no damage even while touching the enemy', () => {
    const game = createGame(9);
    const enemy = spawnEnemyAt(game, 0, 1.2, ENEMY_KIND.brute);
    // The enemy sits on the grip→tip blade line the whole time; only the blade's
    // speed decides whether it is a weapon.
    const log = run(game, 120, (i, intents) => aim(intents, 0, Math.max(1.15, 1.6 - i * 0.005)));
    expect(log.filter((e) => e.type === 'sword-hit')).toEqual([]);
    expect(Health.hp[enemy]).toBe(6);
  });

  it('a hit knocks the enemy back, pops it up, stuns it and shakes the camera', () => {
    const game = createGame(13);
    const enemy = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.slime);
    Health.hp[enemy] = 99; // survive the cut so the reaction is observable
    const script = whipThrough(game, enemy);

    // step until the first connect
    let hit = false;
    for (let i = 0; i < 40 && !hit; i++) {
      script(i, game.intents);
      game.step();
      hit = game.events.events.some((e) => e.type === 'sword-hit');
      game.events.clear();
    }
    expect(hit).toBe(true);
    expect(Health.hp[enemy]).toBeLessThan(99);
    expect(Transform.y[enemy]).toBeGreaterThan(0); // popped off the floor
    expect(Enemy.stun[enemy]).toBeGreaterThan(0);
    expect(game.state.hitstop).toBeGreaterThan(0);
    // raised to COMBAT.hitShake, minus this tick's decay
    expect(game.state.shake).toBeGreaterThan(0.2);
  });
});
