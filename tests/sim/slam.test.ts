import { describe, expect, it } from 'vitest';
import {
  Collider,
  ENEMY_KIND,
  Enemy,
  Health,
  Player,
  SwordTip,
  Transform,
  Velocity,
} from '../../src/components';
import { COMBAT } from '../../src/content/combat';
import { SLAM } from '../../src/content/slam';
import { SIM_DT } from '../../src/core/loop';
import type { GameEvent } from '../../src/core/events';
import type { Game } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { aim, run, type Script } from './harness';

/** Aim point held just inside arm's reach: the tip spring settles dead still on it. */
const PARK_X = 0;
const PARK_Z = 1.2;

/** Ticks of parked aim needed for the tip spring to ring itself out. */
const SETTLE = 90;
/** Ticks of planted stillness that comfortably clear SLAM.chargeTime (54 ticks). */
const CHARGE = 90;

/**
 * Silences the wave director and the incoming damage: these tests are about one
 * shockwave, not about the arena filling up behind it. `alive > 0` with nothing
 * spawning leaves waveSystem with nothing to do.
 */
function isolate(game: Game): void {
  game.state.spawning = false;
  game.state.alive = 2;
}

/** Holds the aim on the park point (and the knight untouchable) for a whole run. */
function park(game: Game, planted: boolean): Script {
  return (_i, intents) => {
    intents.planted = planted;
    Health.invuln[game.playerEid] = 999;
    aim(intents, PARK_X, PARK_Z);
  };
}

/** Settles the blade, then holds the planted stance until the charge is full. */
function chargeToFull(game: Game): void {
  run(game, SETTLE, park(game, false));
  run(game, CHARGE, park(game, true));
  expect(Player.charge[game.playerEid]).toBe(1);
}

const tipSpeedOf = (game: Game) =>
  Math.hypot(SwordTip.vx[game.playerEid], SwordTip.vz[game.playerEid]);

const slams = (log: GameEvent[]) => log.filter((e) => e.type === 'slam');
const charged = (log: GameEvent[]) => log.filter((e) => e.type === 'slam-charged');

describe('ground slam charge', () => {
  it('a planted, still blade fills the charge and rings ready exactly once', () => {
    const game = createGame(101);
    const p = game.playerEid;
    isolate(game);

    // settling with the feet free charges nothing at all…
    const settle = run(game, SETTLE, park(game, false));
    expect(Player.charge[p]).toBe(0);
    expect(charged(settle)).toEqual([]);
    expect(tipSpeedOf(game)).toBeLessThan(SLAM.stillTipSpeed);

    // …then planting fills it in SLAM.chargeTime, and not a tick sooner
    const full = Math.round(SLAM.chargeTime / SIM_DT);
    const early = run(game, full - 2, park(game, true));
    expect(Player.charge[p]).toBeGreaterThan(0.9);
    expect(Player.charge[p]).toBeLessThan(1);
    expect(charged(early)).toEqual([]);

    // crossing full rings the cue once; holding it does not ring it again
    const held = run(game, 60, park(game, true));
    expect(Player.charge[p]).toBe(1);
    expect(charged(held)).toEqual([{ type: 'slam-charged' }]);
  });

  it('lifting the feet bleeds a full charge away in well under a second', () => {
    const game = createGame(102);
    const p = game.playerEid;
    isolate(game);
    chargeToFull(game);

    // the blade is still, only the stance changed — that alone drains it
    const ticks = 12;
    run(game, ticks, park(game, false));
    expect(Player.charge[p]).toBeCloseTo(1 - SLAM.decayRate * ticks * SIM_DT, 2);

    run(game, 30, park(game, false));
    expect(Player.charge[p]).toBe(0);
  });

  it('a swinging blade never charges, however planted the feet are', () => {
    const game = createGame(103);
    const p = game.playerEid;
    isolate(game);

    // sweeping the aim across the knight keeps the tip well over stillTipSpeed
    let stillTicks = 0;
    const log = run(game, 180, (i, intents) => {
      intents.planted = true;
      Health.invuln[p] = 999;
      aim(intents, Math.sin(i * 0.4) * 2.4, PARK_Z);
      if (tipSpeedOf(game) < SLAM.stillTipSpeed) stillTicks++;
    });

    // only the momentary reversals are "still", and decay eats those instantly
    expect(stillTicks).toBeLessThan(60);
    expect(charged(log)).toEqual([]);
    expect(slams(log)).toEqual([]);
    expect(Player.charge[p]).toBeLessThan(0.5);
  });
});

describe('ground slam release', () => {
  it('the shockwave sweeps the ring around the tip and spares everything outside it', () => {
    const game = createGame(104);
    const p = game.playerEid;
    isolate(game);
    chargeToFull(game);

    // Targets sit straight out beyond the parked tip: inside the ring, but clear
    // of the blade itself, so anything that happens to them is the wave's doing.
    const parkedZ = SwordTip.z[p];
    const inside = spawnEnemyAt(game, SwordTip.x[p], parkedZ - 1.6, ENEMY_KIND.slime);
    const outside = spawnEnemyAt(game, SwordTip.x[p], parkedZ - (SLAM.radius + 3));
    Health.hp[inside] = 5; // survive the wave so the damage is readable
    const at = { x: Transform.x[inside], z: Transform.z[inside] };
    const outAt = { x: Transform.x[outside], z: Transform.z[outside] };

    // whip the blade — and let the feet come off the ground with it: a release
    // does not care about the stance, only about charge and blade speed
    SwordTip.vx[p] = SLAM.releaseTipSpeed * 2;
    const log = run(game, 1, park(game, false));
    const tip = { x: SwordTip.x[p], z: SwordTip.z[p] };

    expect(slams(log)).toEqual([{ type: 'slam', x: tip.x, z: tip.z, radius: SLAM.radius }]);
    expect(Player.charge[p]).toBe(0);
    // the blade itself never touched either of them
    expect(log.filter((e) => e.type === 'sword-hit')).toEqual([]);

    // one inside the ring, one outside it — measured against the tip the wave left from
    expect(Math.hypot(at.x - tip.x, at.z - tip.z)).toBeLessThanOrEqual(
      SLAM.radius + Collider.radius[inside],
    );
    expect(Math.hypot(outAt.x - tip.x, outAt.z - tip.z)).toBeGreaterThan(
      SLAM.radius + Collider.radius[outside],
    );

    // caught: damaged, staggered wide open, and blown off its feet
    expect(Health.hp[inside]).toBe(5 - SLAM.damage);
    // (timers.ts runs later in the same tick, so one dt has already come off)
    expect(Enemy.stagger[inside]).toBeGreaterThan(SLAM.stagger - 0.05);
    expect(Enemy.stagger[inside]).toBeLessThanOrEqual(SLAM.stagger);
    expect(Enemy.stun[inside]).toBeGreaterThan(SLAM.stagger - 0.05);
    expect(Enemy.flash[inside]).toBeGreaterThan(SLAM.flashTime - 0.05);
    // the wave is not a blade contact: the same swing's cut is still available
    expect(Enemy.hitCD[inside]).toBe(0);

    // knocked radially off the tip and popped into the air
    const outX = (at.x - tip.x) / Math.hypot(at.x - tip.x, at.z - tip.z);
    const outZ = (at.z - tip.z) / Math.hypot(at.x - tip.x, at.z - tip.z);
    const radial = Velocity.x[inside] * outX + Velocity.z[inside] * outZ;
    // (drag and the stun speed cap have already scrubbed some of it)
    expect(radial).toBeGreaterThan(SLAM.knockback * 0.5);
    expect(Velocity.y[inside]).toBeGreaterThan(0);
    expect(Transform.y[inside]).toBeGreaterThan(0);

    // spared: not a scratch, not a stagger
    expect(Health.hp[outside]).toBe(2);
    expect(Enemy.stagger[outside]).toBe(0);
    expect(Enemy.flash[outside]).toBe(0);

    // the biggest single impact in the game so far
    expect(game.state.hitstop).toBe(SLAM.hitstop);
    expect(game.state.shake).toBeGreaterThan(SLAM.shake - 0.05);
  });

  it('a released slam can kill outright, and the kill lands like any other', () => {
    const game = createGame(105);
    const p = game.playerEid;
    isolate(game);
    chargeToFull(game);

    // a slime's whole health bar is exactly SLAM.damage
    const victim = spawnEnemyAt(game, SwordTip.x[p], SwordTip.z[p] - 1.6);
    expect(Health.hp[victim]).toBe(SLAM.damage);

    SwordTip.vx[p] = SLAM.releaseTipSpeed * 2;
    const log = run(game, 1, park(game, true));

    expect(slams(log).length).toBe(1);
    const deaths = log.filter((e) => e.type === 'enemy-died');
    expect(deaths.length).toBe(1);
    expect(deaths[0]).toMatchObject({ big: false });
    expect(game.state.kills).toBe(1);
    expect(enemyEids(game)).not.toContain(victim);
    // enemyDeath resolved it, so the streak counted it like any other kill
    expect(game.state.streak).toBe(1);
  });

  it('a full charge does not go off below the release speed — it just bleeds', () => {
    const game = createGame(106);
    const p = game.playerEid;
    isolate(game);
    chargeToFull(game);

    const bystander = spawnEnemyAt(game, SwordTip.x[p], SwordTip.z[p] - 1.6);
    // a shove, not a swing: over "still", under the release threshold
    SwordTip.vx[p] = (SLAM.stillTipSpeed + SLAM.releaseTipSpeed) / 2;
    const log = run(game, 1, park(game, true));

    const speed = tipSpeedOf(game);
    expect(speed).toBeGreaterThan(SLAM.stillTipSpeed);
    expect(speed).toBeLessThan(SLAM.releaseTipSpeed);
    expect(speed).toBeLessThan(COMBAT.minHitTipSpeed); // nor fast enough to cut

    expect(slams(log)).toEqual([]);
    expect(Health.hp[bystander]).toBe(2);
    expect(Enemy.stagger[bystander]).toBe(0);
    // neither charging nor releasing: the charge is bleeding away
    expect(Player.charge[p]).toBeCloseTo(1 - SLAM.decayRate * SIM_DT, 4);
  });

  it('a fast swing on a half-built charge releases nothing', () => {
    const game = createGame(107);
    const p = game.playerEid;
    isolate(game);
    run(game, SETTLE, park(game, false));
    run(game, 30, park(game, true));
    const half = Player.charge[p];
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);

    const bystander = spawnEnemyAt(game, SwordTip.x[p], SwordTip.z[p] - 1.6);
    SwordTip.vx[p] = SLAM.releaseTipSpeed * 2;
    const log = run(game, 1, park(game, true));

    expect(tipSpeedOf(game)).toBeGreaterThanOrEqual(SLAM.releaseTipSpeed);
    expect(slams(log)).toEqual([]);
    expect(Health.hp[bystander]).toBe(2);
    // and the swing cost it the charge it had
    expect(Player.charge[p]).toBeLessThan(half);
  });
});
