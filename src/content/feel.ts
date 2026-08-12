/**
 * Global "feel" tunables that are not owned by any single actor.
 * Data only; no logic, no imports.
 */

/**
 * While hit-stop is active the whole simulation runs at this fraction of speed.
 * The demo multiplied its frame dt by .08 for as long as `hitstop > 0`.
 */
export const HITSTOP_TIME_SCALE = 0.08;

/** Camera-shake energy bleed per second (sim decays, render consumes). */
export const SHAKE_DECAY = 2.2;
