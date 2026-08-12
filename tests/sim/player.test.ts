import { describe, expect, it } from 'vitest';
import { Health, Player, SwordTip, Transform } from '../../src/components';
import { ARENA_HALF, PILLARS } from '../../src/content/arena';
import { PLAYER } from '../../src/content/player';
import { createGame } from '../../src/game';
import { angleDelta } from '../../src/core/math';
import { aim, makeInvincible, run, type Script } from './harness';

describe('player movement', () => {
  it('stands its ground inside the walk zone, chases outside it', () => {
    const near = createGame(2);
    const far = createGame(2);
    // 2.0 units away — inside the walk zone (3.4): no chase acceleration, the
    // only body motion left is the leash tugging on swing overshoot.
    run(near, 90, (_i, intents) => aim(intents, 2, 4));
    run(far, 90, (_i, intents) => aim(intents, 12, 4));
    const nearD = Math.hypot(Transform.x[near.playerEid], Transform.z[near.playerEid] - 4);
    const farD = Math.hypot(Transform.x[far.playerEid], Transform.z[far.playerEid] - 4);
    expect(farD).toBeGreaterThan(8);
    expect(nearD).toBeLessThan(farD * 0.25);
  });

  it('chases a far aim point, capped at PLAYER.maxSpeed per tick', () => {
    const game = createGame(3);
    const p = game.playerEid;
    let maxStep = 0;
    let px = Transform.x[p];
    let pz = Transform.z[p];
    run(game, 120, (_i, intents) => {
      aim(intents, 15, 4);
      maxStep = Math.max(maxStep, Math.hypot(Transform.x[p] - px, Transform.z[p] - pz));
      px = Transform.x[p];
      pz = Transform.z[p];
    });
    expect(Transform.x[p]).toBeGreaterThan(10);
    // the body integrates with the capped velocity (the sword's reach pull is
    // applied after integration, so it only shows up on the following tick)
    expect(maxStep).toBeLessThanOrEqual(PLAYER.maxSpeed / 60 + 1e-3);
  });

  it('planted feet: the body barely moves even with the aim far away', () => {
    const planted = createGame(3);
    const free = createGame(3);
    run(planted, 120, (_i, intents) => {
      aim(intents, 15, 4);
      intents.planted = true;
    });
    run(free, 120, (_i, intents) => aim(intents, 15, 4));
    expect(Math.abs(Transform.x[planted.playerEid])).toBeLessThan(0.5);
    expect(Transform.x[free.playerEid]).toBeGreaterThan(10);
  });

  it('facing is a spring-damper that turns toward the sword tip', () => {
    const game = createGame(4);
    const p = game.playerEid;
    expect(Transform.rot[p]).toBe(0);
    run(game, 240, (_i, intents) => aim(intents, 2.4, 4));
    const bearing = Math.atan2(SwordTip.x[p] - Transform.x[p], SwordTip.z[p] - Transform.z[p]);
    expect(Math.abs(angleDelta(Transform.rot[p], bearing))).toBeLessThan(0.25);
    expect(Math.abs(Player.faceVel[p])).toBeLessThan(1);
  });
});

describe('static collision', () => {
  it('pushes the player out of a pillar', () => {
    const game = createGame(5);
    const p = game.playerEid;
    const pillar = PILLARS[0];
    Transform.x[p] = pillar.x - 0.2;
    Transform.z[p] = pillar.z - 0.1;
    run(game, 1);
    const d = Math.hypot(Transform.x[p] - pillar.x, Transform.z[p] - pillar.z);
    expect(d).toBeCloseTo(pillar.r + PLAYER.radius, 4);
  });

  it('a player walking into a pillar never ends up inside it', () => {
    const game = createGame(5);
    const p = game.playerEid;
    makeInvincible(game);
    const pillar = PILLARS[0];
    let minD = Infinity;
    run(game, 400, (_i, intents) => {
      aim(intents, pillar.x, pillar.z);
      minD = Math.min(minD, Math.hypot(Transform.x[p] - pillar.x, Transform.z[p] - pillar.z));
    });
    expect(minD).toBeGreaterThanOrEqual(pillar.r + PLAYER.radius - 1e-3);
    // and he really did press up against it
    expect(minD).toBeLessThan(pillar.r + PLAYER.radius + 0.5);
  });

  it('keeps the player inside the arena', () => {
    const game = createGame(6);
    const p = game.playerEid;
    makeInvincible(game);
    let maxX = 0;
    let maxZ = 0;
    run(game, 600, (i, intents) => {
      const corner = i < 300 ? 1 : -1;
      aim(intents, 40 * corner, 40 * corner);
      maxX = Math.max(maxX, Math.abs(Transform.x[p]));
      maxZ = Math.max(maxZ, Math.abs(Transform.z[p]));
    });
    maxX = Math.max(maxX, Math.abs(Transform.x[p]));
    maxZ = Math.max(maxZ, Math.abs(Transform.z[p]));
    // he pressed all the way into the walls, and never got through them
    expect(maxX).toBe(ARENA_HALF);
    expect(maxZ).toBe(ARENA_HALF);
  });
});

describe('hit-stop', () => {
  it('slows the whole simulation while active', () => {
    const normal = createGame(8);
    const stopped = createGame(8);
    const script: Script = (_i, intents) => aim(intents, 15, 4);
    run(normal, 40, script);
    run(stopped, 40, script);

    stopped.state.hitstop = 0.5;
    const a0 = Transform.x[normal.playerEid];
    const b0 = Transform.x[stopped.playerEid];
    run(normal, 10, script);
    run(stopped, 10, script);

    const moved = Transform.x[normal.playerEid] - a0;
    const crawled = Transform.x[stopped.playerEid] - b0;
    expect(crawled).toBeGreaterThan(0);
    expect(crawled).toBeLessThan(moved * 0.2);
    // the budget drains in real time, not slowed time
    expect(stopped.state.hitstop).toBeCloseTo(0.5 - 10 / 60, 5);
  });

  it('does not leak: it always drains back to zero', () => {
    const game = createGame(9);
    game.state.hitstop = 0.1;
    run(game, 30);
    expect(game.state.hitstop).toBe(0);
  });

  it('shake decays on its own', () => {
    const game = createGame(10);
    game.state.shake = 1;
    run(game, 20);
    expect(game.state.shake).toBeLessThan(1);
    run(game, 200);
    expect(game.state.shake).toBe(0);
    expect(Health.hp[game.playerEid]).toBeGreaterThan(0);
  });
});
