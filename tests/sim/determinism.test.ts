import { describe, expect, it } from 'vitest';
import { createGame, enemyEids } from '../../src/game';
import { Transform } from '../../src/components';
import type { GameEvent } from '../../src/core/events';
import { run, snapshot, type Script } from './harness';

/** A busy 10-second script: circling aim, periodic planting, real combat. */
const script: Script = (i, intents) => {
  intents.aimX = Math.sin(i * 0.11) * 7;
  intents.aimZ = 4 + Math.cos(i * 0.13) * 7;
  intents.aimActive = true;
  intents.planted = i % 120 < 20;
};

describe('determinism', () => {
  it('same seed + same intents → identical state after 600 ticks', () => {
    const a = createGame(1234);
    const b = createGame(1234);
    run(a, 600, script);
    run(b, 600, script);
    expect(snapshot(a, enemyEids)).toEqual(snapshot(b, enemyEids));
    // sanity: the script actually did something
    expect(a.state.wave).toBeGreaterThanOrEqual(1);
    expect(enemyEids(a).length).toBeGreaterThan(0);
  });

  it('same seed → identical event stream', () => {
    const a = createGame(99);
    const b = createGame(99);
    // Entity ids come from a process-global cursor, so they differ between two
    // worlds in the same process; everything else about the stream must match.
    const strip = (events: GameEvent[]) =>
      events.map((e) => ('eid' in e ? { ...e, eid: 0 } : e));
    expect(strip(run(a, 400, script))).toEqual(strip(run(b, 400, script)));
  });

  it('different seeds → different spawn positions', () => {
    const a = createGame(1);
    const b = createGame(2);
    run(a, 90);
    run(b, 90);
    const ea = enemyEids(a);
    const eb = enemyEids(b);
    expect(ea.length).toBeGreaterThan(1);
    expect(ea.length).toBe(eb.length);
    const posA = ea.map((e) => [Transform.x[e], Transform.z[e]]);
    const posB = eb.map((e) => [Transform.x[e], Transform.z[e]]);
    expect(posA).not.toEqual(posB);
  });

  it('reset(seed) makes two runs converge again', () => {
    const a = createGame(5);
    const b = createGame(77);
    run(a, 137, script);
    run(b, 40, script);
    a.reset(4242);
    b.reset(4242);
    run(a, 200, script);
    run(b, 200, script);
    expect(snapshot(a, enemyEids)).toEqual(snapshot(b, enemyEids));
  });
});
