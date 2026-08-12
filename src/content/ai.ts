/**
 * Group-AI tunables: attack tokens (how many enemies may press the player at
 * once) and the brute's telegraphed lunge attack.
 * Data only; no logic, no imports.
 */

export const AI_TOKENS = {
  /** Max enemies allowed to press the attack simultaneously. */
  maxAttackers: 2,
  /** Non-holders orbit the player at roughly this ring distance. */
  standoffDist: 4.5,
  /** Dead-zone around the ring so orbiters don't jitter between approach/retreat. */
  standoffSlack: 0.8,
  /** Tangential drift speed for orbiters (uses Enemy.circleDir). */
  orbitAccel: 10,
  /** Token assignment is re-evaluated every this many seconds. */
  reassignInterval: 0.4,
} as const;

export const TELEGRAPH = {
  /** A token-holding brute starts its lunge within this range of the player. */
  triggerRange: 3.4,
  /** Windup: readable + parryable. Strike: committed lunge. Recover: vulnerable. */
  windupTime: 0.55,
  strikeTime: 0.28,
  recoverTime: 0.5,
  /** Impulse along the locked lunge direction at strike start. */
  lungeImpulse: 15,
  /** Speed cap during the strike (overrides the brute's walk cap). */
  strikeSpeedCap: 17,
  /** Cooldown before the same enemy may attack again. */
  cooldown: 1.6,
} as const;
