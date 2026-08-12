/**
 * Wave composition + spawn trickle.
 * Data only; no logic, no imports.
 */

export const WAVES = {
  /** Wave n contains baseSlimes + n*slimesPerWave slimes... */
  baseSlimes: 3,
  slimesPerWave: 2,
  /** ...and floor(n / brutesPerWaveDiv) brutes, spawned after the slimes. */
  brutesPerWaveDiv: 2,
  /** Seconds between spawns in the trickle (the demo's setInterval period). */
  spawnInterval: 0.38,
  /** Spawn ring: ARENA_HALF - ringInset, at a random angle. */
  ringInset: 1.5,
} as const;
