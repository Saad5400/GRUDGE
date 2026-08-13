/**
 * Environmental damage: enemies smashed into arena walls or pillars at speed.
 * Knockback (sword, parry, slam) becomes a weapon when there's masonry behind
 * the target — and a brute whose lunge is sidestepped near a wall slams itself.
 * Data only; no logic, no imports.
 */

export const WALL_SLAM = {
  /** Speed INTO the surface below this is a harmless bump — walking never triggers it. */
  minImpactSpeed: 9,
  /** Damage = baseDamage + floor((impact − minImpactSpeed) * speedDamageFactor). */
  baseDamage: 1,
  speedDamageFactor: 1 / 8,
  /** A wall slam is a big opening: staggered (execution window), not just stunned. */
  stagger: 0.9,
  flashTime: 0.2,
  /** Velocity into the surface is reflected and scaled by this (bounce off the wall). */
  restitution: 0.45,
  /** Impact juice. */
  shake: 0.35,
  hitstop: 0.05,
} as const;
