/**
 * The signature mechanic: the aim point IS the sword tip.
 * A point mass on a stiff, lightly damped spring, leashed to the body by a
 * reach constraint that drags the knight around when the blade over-extends.
 * Data only; no logic, no imports.
 */

export const SWORD = {
  /** The tip lives on a constant-height plane; the sim is 2D in x/z. */
  tipHeight: 0.75,
  /** Height of the two-handed grip, used by the grip→tip blade segment. */
  gripHeight: 1.4,

  /** Arm's reach: past this the sword starts pulling the body. */
  reach: 2.9,
  /** Extra elastic stretch past reach before the hard limit clamps it. */
  stretch: 1.1,
  /** The blade cannot pass through the body. */
  minRadius: 0.9,

  /** Spring stiffness toward the aim point (heavy mass, low damping). */
  springStiffness: 42,
  /**
   * Commitment: once the blade is moving this fast, spring force that opposes
   * its momentum barely bites until that momentum has bled off.
   */
  commitSpeed: 7,
  commitFactor: 0.35,
  /** Tip velocity drag rate (exp(-rate*dt)). */
  tipDrag: 2.4,

  /** How hard an over-extended blade drags the body along. */
  bodyPull: 340,
  /** Elastic pull-back on the tip; planted feet make the leash stiffer. */
  pullbackPlanted: 260,
  pullbackFree: 160,

  /** Hard cap on tip speed. */
  maxTipSpeed: 44,
  /** Where the tip target sits before any pointer input has arrived. */
  idleTargetDist: 2,

  /** Whoosh SFX threshold with hysteresis (rising edge only). */
  whooshOn: 16,
  whooshOff: 9,

  /** Stamina: sustained fast blade work tires the arms (cosmetic in the demo). */
  stamDrainSpeed: 8,
  stamDrainRate: 0.085,
  stamRegenSpeed: 4.5,
  stamRegenRate: 0.28,
} as const;
