/**
 * Execution: a fast cut on a STAGGERED enemy (Enemy.stagger > 0 — set by parry,
 * ground slam, or wall slam, never by an ordinary hit) kills it outright.
 * This is the riposte payoff the parry stagger exists for.
 * Data only; no logic, no imports.
 */

export const EXECUTION = {
  /** The finishing cut must be at least this fast (a deliberate swing, not a graze). */
  minTipSpeed: 10,
  /** A clean finish pays the arms back (0..1 stamina). */
  staminaRefund: 0.5,
  /** An execution should land like a guillotine. */
  hitstop: 0.12,
  shake: 0.55,
} as const;
