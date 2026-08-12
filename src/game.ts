/**
 * Composition root of the simulation.
 *
 * `createGame(seed)` builds the ECS world and returns the `Game` contract from
 * core/types. Everything here is headless and deterministic: given the same seed
 * and the same per-tick `intents`, two games produce bit-identical state, which
 * is what makes replays, headless tests and (later) rival ghosts possible.
 *
 * Pipeline order is load-bearing — it mirrors the reference demo's step(),
 * with the Phase 2 systems slotted where their reads/writes demand:
 *   hitstop → player movement → sword physics → parry (before damage: a parry
 *   consumes the blade contact) → sword damage → timers → attack tokens →
 *   enemy AI → telegraph → collision → touch damage → enemy death → combo
 *   (reads this tick's death events) → waves → shake decay
 */
import { createWorld, removeEntity, addComponent, addEntity, type IWorld } from 'bitecs';
import {
  Collider,
  ENEMY_KIND,
  Health,
  Player,
  SwordTip,
  Transform,
  Velocity,
  type EnemyKind,
} from './components';
import { EventBus } from './core/events';
import { SIM_DT } from './core/loop';
import { Rng } from './core/rng';
import { createIntents, type Game, type GameState } from './core/types';
import { PLAYER } from './content/player';
import { hitstopSystem, shakeDecaySystem } from './systems/hitstop';
import { playerMovementSystem } from './systems/playerMovement';
import { swordPhysicsSystem } from './systems/swordPhysics';
import { swordDamageSystem } from './systems/swordDamage';
import { timerSystem } from './systems/timers';
import { enemyAISystem } from './systems/enemyAI';
import { attackTokenSystem } from './systems/attackTokens';
import { telegraphSystem } from './systems/telegraph';
import { parrySystem } from './systems/parry';
import { comboSystem } from './systems/combo';
import { collisionSystem } from './systems/collision';
import { touchDamageSystem } from './systems/touchDamage';
import { enemyDeathSystem } from './systems/enemyDeath';
import { nextWave, spawnEnemyAt as spawnEnemyEntity, waveSystem } from './systems/wave';
import { enemiesNewestFirst, type SimContext } from './systems/context';

/** The tip's resting position at game start (a first aim input snaps it away). */
const TIP_START_X = 0;
const TIP_START_Z = 1.6;

/** Internal context per game, reachable from test helpers but not from the contract. */
const contexts = new WeakMap<Game, SimContext>();

function createState(): GameState {
  return {
    wave: 0,
    kills: 0,
    alive: 0,
    spawning: false,
    dead: false,
    shake: 0,
    hitstop: 0,
    streak: 0,
    streakT: 0,
    bestStreak: 0,
    time: 0,
  };
}

function createPlayer(world: IWorld): number {
  const eid = addEntity(world);
  addComponent(world, Transform, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Collider, eid);
  addComponent(world, Health, eid);
  addComponent(world, Player, eid);
  addComponent(world, SwordTip, eid);
  Collider.radius[eid] = PLAYER.radius;
  return eid;
}

/** Restores the player to its start-of-run state (also used by reset()). */
function resetPlayer(eid: number): void {
  Transform.x[eid] = PLAYER.startX;
  Transform.y[eid] = 0;
  Transform.z[eid] = PLAYER.startZ;
  Transform.rot[eid] = 0;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Velocity.z[eid] = 0;
  Health.hp[eid] = PLAYER.hp;
  Health.maxHp[eid] = PLAYER.maxHp;
  Health.invuln[eid] = 0;
  Player.faceVel[eid] = 0;
  Player.stamina[eid] = 1;
  SwordTip.x[eid] = TIP_START_X;
  SwordTip.z[eid] = TIP_START_Z;
  SwordTip.vx[eid] = 0;
  SwordTip.vz[eid] = 0;
  SwordTip.prevX[eid] = TIP_START_X;
  SwordTip.prevZ[eid] = TIP_START_Z;
}

export function createGame(seed: number): Game {
  const world = createWorld();
  const events = new EventBus();
  const intents = createIntents();
  const state = createState();
  const playerEid = createPlayer(world);
  resetPlayer(playerEid);

  const ctx: SimContext = {
    world,
    events,
    intents,
    state,
    rng: new Rng(seed),
    playerEid,
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

  function resetRun(newSeed?: number): void {
    for (const e of enemiesNewestFirst(world)) removeEntity(world, e);
    resetPlayer(playerEid);
    if (newSeed !== undefined) ctx.rng = new Rng(newSeed);
    ctx.bodySpeed = 0;
    ctx.whooshLatch = false;
    ctx.spawnSlimes = 0;
    ctx.spawnTotal = 0;
    ctx.spawnIndex = 0;
    ctx.spawnTimer = 0;
    ctx.tokenTimer = 0;
    state.wave = 0;
    state.kills = 0;
    state.alive = 0;
    state.spawning = false;
    state.dead = false;
    state.shake = 0;
    state.hitstop = 0;
    state.streak = 0;
    state.streakT = 0;
    state.bestStreak = 0;
    events.emit({ type: 'game-reset' });
    nextWave(ctx);
  }

  const game: Game = {
    world,
    playerEid,
    events,
    intents,
    state,
    get rng() {
      return ctx.rng;
    },

    step(): void {
      // Everything before this index was emitted by an earlier tick this frame.
      ctx.eventCursor = events.events.length;

      if (intents.restart) {
        intents.restart = false;
        if (state.dead) resetRun();
      }

      hitstopSystem(ctx);
      playerMovementSystem(ctx);
      swordPhysicsSystem(ctx);
      parrySystem(ctx);
      swordDamageSystem(ctx);
      timerSystem(ctx);
      attackTokenSystem(ctx);
      enemyAISystem(ctx);
      telegraphSystem(ctx);
      collisionSystem(ctx);
      touchDamageSystem(ctx);
      enemyDeathSystem(ctx);
      comboSystem(ctx);
      waveSystem(ctx);
      shakeDecaySystem(ctx);

      state.time += SIM_DT;
    },

    reset(newSeed?: number): void {
      resetRun(newSeed);
    },
  };

  contexts.set(game, ctx);
  nextWave(ctx);
  return game;
}

// ---------------------------------------------------------------------------
// Test helpers (headless sim tests need to place enemies deterministically).
// ---------------------------------------------------------------------------

function ctxOf(game: Game): SimContext {
  const ctx = contexts.get(game);
  if (!ctx) throw new Error('not a game created by createGame()');
  return ctx;
}

/**
 * Force-spawn one enemy at an exact spot (default: standing on the ground).
 * Does NOT touch `state.alive`, so wave progression is unaffected unless you
 * ask for it — pass `countAlive` to make it part of the current wave.
 */
export function spawnEnemyAt(
  game: Game,
  x: number,
  z: number,
  kind: EnemyKind = ENEMY_KIND.slime,
  y = 0,
  countAlive = false,
): number {
  const ctx = ctxOf(game);
  const eid = spawnEnemyEntity(ctx, x, z, kind, y);
  if (countAlive) ctx.state.alive++;
  return eid;
}

/** All living enemy entity ids, newest first. */
export function enemyEids(game: Game): number[] {
  return enemiesNewestFirst(ctxOf(game).world);
}
