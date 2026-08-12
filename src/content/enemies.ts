/**
 * Enemy archetypes + shared enemy physics.
 * Indexed by ENEMY_KIND (see src/components) so `ENEMY_STATS[kind]` works.
 * Data only; no logic (the ENEMY_KIND import is a type/const table, not logic).
 */
import { ENEMY_KIND, type EnemyKind } from '../components';

export interface EnemyStats {
  radius: number;
  hp: number;
  /** Horizontal speed cap while not stunned. */
  maxSpeed: number;
  /** Steady walk acceleration (brutes). 0 for hoppers. */
  accel: number;
  /** Hop cadence: hopT = hopMin + rng*hopRand. 0 for walkers. */
  hopMin: number;
  hopRand: number;
  /** Hop launch: vy = hopVy + rng*hopVyRand, plus a horizontal impulse. */
  hopVy: number;
  hopVyRand: number;
  hopImpulse: number;
  /** Initial hop timer at spawn: rng*spawnHopT. */
  spawnHopT: number;
  /** Counts as a "big" enemy (brute) for damage/knockback/heal rules. */
  big: boolean;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  [ENEMY_KIND.slime]: {
    radius: 0.55,
    hp: 2,
    maxSpeed: 8,
    accel: 0,
    hopMin: 0.55,
    hopRand: 0.45,
    hopVy: 5.2,
    hopVyRand: 1,
    hopImpulse: 5.5,
    spawnHopT: 0.8,
    big: false,
  },
  [ENEMY_KIND.brute]: {
    radius: 1.0,
    hp: 6,
    maxSpeed: 3.4,
    accel: 26,
    hopMin: 0,
    hopRand: 0,
    hopVy: 0,
    hopVyRand: 0,
    hopImpulse: 0,
    spawnHopT: 0.8,
    big: true,
  },
};

export const ENEMY_PHYS = {
  gravity: 22,
  /** Horizontal drag rate (exp(-rate*dt)) on the ground vs mid-air. */
  dragGround: 6,
  dragAir: 1.2,
  /** Stunned enemies may fly this fast (knockback needs headroom). */
  stunSpeedCap: 14,
  /** Enemy-enemy overlap resolution fraction per body. */
  separation: 0.5,
  /** Enemies drop into the arena from this height. */
  spawnHeight: 6,
} as const;
