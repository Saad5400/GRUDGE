/**
 * Ground slam — the charged ability. Planting (right-click / second finger)
 * with a STILL blade builds charge; at full charge the next fast swing releases
 * a shockwave centred on the sword tip: damage + radial knockback + stagger to
 * everything in the radius. No new input: it is read entirely from the existing
 * planted stance and tip speed, like everything else in the cursor-sword model.
 * Data only; no logic, no imports.
 */

export const SLAM = {
  /** Seconds of planted stillness to fill the charge 0 → 1. */
  chargeTime: 0.9,
  /** The blade counts as "still" below this tip speed while charging. */
  stillTipSpeed: 1.5,
  /** A swing at least this fast releases a full charge. */
  releaseTipSpeed: 10,
  /** Charge drained per second whenever the charging conditions aren't met. */
  decayRate: 2.5,

  /** Shockwave radius around the tip at the moment of release. */
  radius: 3.5,
  /** Flat damage to everything caught in the wave. */
  damage: 2,
  /** Radial knockback away from the tip. Brutes still resist via bigKnockbackDivisor. */
  knockback: 18,
  /** Everything caught is popped into the air at least this hard (vy floor). */
  popup: 4,
  /** Enemies caught in the wave are staggered — slam into execution chains. */
  stagger: 0.8,
  flashTime: 0.2,

  /** Release juice — the biggest single impact in the game so far. */
  shake: 0.6,
  hitstop: 0.1,
} as const;
