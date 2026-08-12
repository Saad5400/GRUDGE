/**
 * Player body tunables — locomotion, facing spring, survivability.
 * Every number here is lifted verbatim from reference/dungeon-brawler.html.
 * Data only; no logic, no imports.
 */

export const PLAYER = {
  /** Body collision radius. */
  radius: 0.55,
  hp: 5,
  maxHp: 5,
  /** Spawn / respawn position on the ground plane. */
  startX: 0,
  startZ: 4,

  /**
   * Inside this distance from the aim point the body stands its ground —
   * everything within sword reach is pure swordplay, no walking.
   */
  walkZone: 3.4,
  /** Chase acceleration at full urgency. */
  accel: 55,
  /** Distance past `walkZone` at which urgency saturates. */
  urgencyRamp: 4,
  /** Acceleration fades out as body speed approaches this. */
  accelSpeedFalloff: 10.5,
  /** Exponential braking rate when velocity opposes the desired direction. */
  brakeRate: 9,
  /** Below this speed no braking is applied. */
  brakeMinSpeed: 0.5,

  /** Velocity drag rates (exp(-rate*dt)) by stance. */
  dragPlanted: 11,
  dragMoving: 2.8,
  dragIdle: 8,
  /** Hard speed cap: lunges + recoil can never stack to infinity. */
  maxSpeed: 13,

  /** Facing spring-damper toward the sword tip (angular momentum). */
  faceStiffness: 44,
  faceDamping: 8,
  /** Tip must be at least this far away to define a facing target. */
  faceMinTipDist: 0.4,

  /** Invulnerability window after taking a hit. */
  invulnTime: 1.0,
  /** Impulse applied away from the damage source. */
  hurtKnockback: 11,
} as const;
