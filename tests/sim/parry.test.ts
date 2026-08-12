import { describe, expect, it } from 'vitest';
import {
  ATTACK_STATE,
  Collider,
  ENEMY_KIND,
  Enemy,
  Health,
  Player,
  SwordTip,
  Transform,
  Velocity,
} from '../../src/components';
import { COMBAT, PARRY } from '../../src/content/combat';
import { SWORD } from '../../src/content/sword';
import { segPointDist2 } from '../../src/core/math';
import type { GameEvent } from '../../src/core/events';
import type { Game, Intents } from '../../src/core/types';
import { createGame, enemyEids, spawnEnemyAt } from '../../src/game';
import { aim, run, snapshot, type Script } from './harness';

/** Non-zero so "the attack was cancelled" is an observable change, not a no-op. */
const STAGED_ATTACK_T = 0.4;

/**
 * Sweeps the aim point back and forth *through* a target, perpendicular to the
 * player→target line — the mouse motion a player makes to meet an incoming
 * attack. `planted` is scripted by the caller.
 */
function whipThrough(game: Game, eid: number, planted: boolean, period = 10, offset = 1.6) {
  return (i: number, intents: Intents) => {
    intents.planted = planted;
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

interface Drive {
  log: GameEvent[];
  /** Tick index of the first parry, or -1. */
  parryTick: number;
  /** Enemy position at the start of the parry tick (what the event should carry). */
  at: { x: number; z: number };
}

/**
 * Steps the sim with `script`, holding the enemy in `state` at the top of every
 * tick (the telegraph state machine is a separate system; these tests stage the
 * state directly so they only exercise parry). Stops on the first parry.
 */
function drive(
  game: Game,
  eid: number,
  script: Script,
  ticks: number,
  state: number = ATTACK_STATE.windup,
  perTick?: () => void,
): Drive {
  const log: GameEvent[] = [];
  const out: Drive = { log, parryTick: -1, at: { x: 0, z: 0 } };
  for (let i = 0; i < ticks; i++) {
    Enemy.attackState[eid] = state;
    Enemy.attackT[eid] = STAGED_ATTACK_T;
    perTick?.();
    script(i, game.intents);
    const at = { x: Transform.x[eid], z: Transform.z[eid] };
    game.step();
    const tick = [...game.events.events];
    game.events.clear();
    for (const e of tick) log.push(e);
    if (tick.some((e) => e.type === 'parry')) {
      out.parryTick = i;
      out.at = at;
      break;
    }
  }
  return out;
}

describe('parry', () => {
  it('a planted blade meeting a windup breaks the attack instead of cutting it', () => {
    const game = createGame(61);
    const p = game.playerEid;
    const e = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.brute);
    const hp0 = Health.hp[e];

    const d = drive(game, e, whipThrough(game, e, true), 60, ATTACK_STATE.windup, () => {
      Player.stamina[p] = 0.5;
    });
    expect(d.parryTick).toBeGreaterThanOrEqual(0);

    const parries = d.log.filter((ev) => ev.type === 'parry');
    expect(parries.length).toBe(1);
    const parry = parries[0];
    if (parry.type !== 'parry') throw new Error('unreachable');
    expect(parry.eid).toBe(e);
    expect(parry.x).toBe(d.at.x);
    expect(parry.z).toBe(d.at.z);
    expect(parry.tipSpeed).toBeGreaterThanOrEqual(PARRY.minTipSpeed);

    // the attack is broken, not merely delayed
    expect(Enemy.attackState[e]).toBe(ATTACK_STATE.idle);
    expect(Enemy.attackT[e]).toBe(0);
    // (timers.ts runs later in the same tick, so one dt has already come off)
    expect(Enemy.attackCD[e]).toBeGreaterThan(PARRY.attackCD - 0.05);
    expect(Enemy.attackCD[e]).toBeLessThanOrEqual(PARRY.attackCD);
    expect(Enemy.stun[e]).toBeGreaterThan(PARRY.stun - 0.05);
    expect(Enemy.stun[e]).toBeLessThanOrEqual(PARRY.stun);
    expect(Enemy.flash[e]).toBeGreaterThan(PARRY.flashTime - 0.05);

    // …and it costs the enemy no health at all: the parry ate the contact
    expect(Health.hp[e]).toBe(hp0);
    expect(d.log.filter((ev) => ev.type === 'sword-hit')).toEqual([]);
    expect(Enemy.hitCD[e]).toBeGreaterThan(0);

    // shoved straight back off the knight, still on its feet
    const awayX = Transform.x[e] - Transform.x[p];
    const awayZ = Transform.z[e] - Transform.z[p];
    const away = Math.hypot(awayX, awayZ);
    const outward = (Velocity.x[e] * awayX + Velocity.z[e] * awayZ) / away;
    expect(outward).toBeGreaterThan(PARRY.knockback * 0.4);
    expect(Velocity.y[e]).toBe(0);

    // reading the attack pays the arms back and rings the bell
    expect(Player.stamina[p]).toBeGreaterThan(0.5 + PARRY.staminaRefund - 0.05);
    expect(Player.stamina[p]).toBeLessThanOrEqual(0.5 + PARRY.staminaRefund);
    expect(game.state.hitstop).toBe(PARRY.hitstop);
    expect(game.state.shake).toBeGreaterThan(PARRY.shake - 0.05);
  });

  it('the stamina refund never overfills the meter', () => {
    const game = createGame(62);
    const p = game.playerEid;
    const e = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.brute);
    const d = drive(game, e, whipThrough(game, e, true), 60, ATTACK_STATE.windup, () => {
      Player.stamina[p] = 1 - PARRY.staminaRefund / 2;
    });
    expect(d.parryTick).toBeGreaterThanOrEqual(0);
    expect(Player.stamina[p]).toBe(1);
  });

  it('without planted feet the very same swing just cuts', () => {
    const game = createGame(61); // same seed + placement as the parry above
    const e = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.brute);
    Health.hp[e] = 99; // survive the cut so the run is comparable

    const d = drive(game, e, whipThrough(game, e, false), 60);
    expect(d.parryTick).toBe(-1);
    expect(d.log.filter((ev) => ev.type === 'parry')).toEqual([]);
    expect(d.log.filter((ev) => ev.type === 'sword-hit').length).toBeGreaterThan(0);
    expect(Health.hp[e]).toBeLessThan(99);
    // a cut staggers far less than a parry does
    expect(Enemy.stun[e]).toBeLessThanOrEqual(COMBAT.stunTime);
  });

  it.each([
    ['idle', ATTACK_STATE.idle],
    ['strike', ATTACK_STATE.strike],
    ['recover', ATTACK_STATE.recover],
  ])('an enemy in %s is not parryable — the blade only cuts it', (_name, state) => {
    const game = createGame(63);
    const e = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.brute);
    Health.hp[e] = 99;

    const d = drive(game, e, whipThrough(game, e, true), 60, state);
    expect(d.parryTick).toBe(-1);
    expect(d.log.filter((ev) => ev.type === 'parry')).toEqual([]);
    // the blade demonstrably reached it — only the attack state withheld the parry
    expect(d.log.filter((ev) => ev.type === 'sword-hit').length).toBeGreaterThan(0);
    expect(Health.hp[e]).toBeLessThan(99);
  });

  it('a slow blade resting on a windup does not parry it', () => {
    const game = createGame(64);
    const p = game.playerEid;
    // settle the blade on a parked aim point: the spring comes fully to rest
    run(game, 150, (_i, intents) => {
      intents.planted = true;
      Health.invuln[p] = 999; // no hurt-knockback to stir the blade
      aim(intents, 0, 1.2);
    });
    expect(Math.hypot(SwordTip.vx[p], SwordTip.vz[p])).toBeLessThan(PARRY.minTipSpeed);

    const e = spawnEnemyAt(game, 0, 2.2, ENEMY_KIND.brute);
    const contact = () => {
      const hitR = Collider.radius[e] + COMBAT.hitRadiusPad;
      const blade = segPointDist2(
        Transform.x[p],
        SWORD.gripHeight,
        Transform.z[p],
        SwordTip.x[p],
        SWORD.tipHeight,
        SwordTip.z[p],
        Transform.x[e],
        Math.min(COMBAT.centreMax, COMBAT.centreBase + Transform.y[e]),
        Transform.z[e],
      );
      return blade < hitR * hitR;
    };
    expect(contact()).toBe(true); // the blade is lying across it…

    let maxTipSpeed = 0;
    const d = drive(
      game,
      e,
      (_i, intents) => {
        intents.planted = true;
        Health.invuln[p] = 999;
        aim(intents, 0, 1.2);
        maxTipSpeed = Math.max(maxTipSpeed, Math.hypot(SwordTip.vx[p], SwordTip.vz[p]));
      },
      20,
    );

    expect(maxTipSpeed).toBeLessThan(PARRY.minTipSpeed); // …but never swung
    expect(d.parryTick).toBe(-1);
    expect(d.log.filter((ev) => ev.type === 'parry')).toEqual([]);
    expect(contact()).toBe(true);
    expect(Health.hp[e]).toBe(6); // and far too slow to cut, either
  });

  it('one contact yields one parry: the hit cooldown gates re-triggering', () => {
    const game = createGame(65);
    const e = spawnEnemyAt(game, 2.2, 4, ENEMY_KIND.brute);
    const script = whipThrough(game, e, true);
    const log: GameEvent[] = [];
    // no early exit here: keep swinging straight through the contact
    for (let i = 0; i < 16; i++) {
      Enemy.attackState[e] = ATTACK_STATE.windup;
      Enemy.attackT[e] = STAGED_ATTACK_T;
      script(i, game.intents);
      game.step();
      for (const ev of game.events.events) log.push(ev);
      game.events.clear();
    }
    // 16 ticks < COMBAT.hitCD (0.28s = ~17 ticks), so at most one parry can land
    expect(log.filter((ev) => ev.type === 'parry').length).toBe(1);
  });
});

describe('parry + streak determinism', () => {
  it('same seed + same intents → identical state, streaks and events', () => {
    const script = (game: Game): Script => {
      return (i, intents) => {
        intents.aimX = Math.sin(i * 0.29) * 3.4;
        intents.aimZ = 4 + Math.cos(i * 0.23) * 3.4;
        intents.aimActive = true;
        intents.planted = i % 40 < 25;
        // anything that gets close is winding up, so parries fire constantly
        const pl = game.playerEid;
        for (const e of enemyEids(game)) {
          const d = Math.hypot(Transform.x[e] - Transform.x[pl], Transform.z[e] - Transform.z[pl]);
          if (d < 4) Enemy.attackState[e] = ATTACK_STATE.windup;
        }
      };
    };
    // entity ids come from a process-global cursor, so they differ per world
    const strip = (events: GameEvent[]) =>
      events.map((e) =>
        e.type === 'enemy-spawned' || e.type === 'parry' ? { ...e, eid: 0 } : e,
      );

    const a = createGame(4242);
    const b = createGame(4242);
    const logA = strip(run(a, 600, script(a)));
    const logB = strip(run(b, 600, script(b)));

    expect(logA).toEqual(logB);
    expect(snapshot(a, enemyEids)).toEqual(snapshot(b, enemyEids));
    expect([a.state.streak, a.state.bestStreak, a.state.kills]).toEqual([
      b.state.streak,
      b.state.bestStreak,
      b.state.kills,
    ]);
    // sanity: the script actually exercised both new systems
    expect(logA.filter((e) => e.type === 'parry').length).toBeGreaterThan(0);
    expect(logA.filter((e) => e.type === 'streak-changed').length).toBeGreaterThan(0);
  });
});

