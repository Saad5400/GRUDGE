/**
 * Kill-streak (combo) tunables.
 * Data only; no logic, no imports.
 */

export const COMBO = {
  /** Seconds after a kill before the streak expires. Each kill refreshes it. */
  window: 4,
  /** Every this-many streak kills heals the player 1 hp (capped at max). */
  healEvery: 5,
  /** Getting hit resets the streak to zero. */
  resetOnHurt: true,
} as const;
