/**
 * Damage exchange tunables: blade→enemy, enemy→player, and the impact "juice"
 * (hit-stop, shake) each exchange produces.
 * Data only; no logic, no imports.
 */

export const COMBAT = {
  /** Below this tip speed the blade is a stick, not a weapon. */
  minHitTipSpeed: 6.5,
  /** Blade thickness: added to the enemy radius for the segment test. */
  hitRadiusPad: 0.55,
  /** Enemy hit sphere centre height: min(centreMax, centreBase + enemy y). */
  centreBase: 0.6,
  centreMax: 1.4,

  /** A clean fast cut does double damage (one-shots slimes). */
  heavyTipSpeed: 14,
  heavyDamage: 2,
  lightDamage: 1,

  /** Per-enemy cooldowns / reaction times from one blade hit. */
  hitCD: 0.28,
  flashTime: 0.15,
  stunTime: 0.5,

  /** Knockback power = min(tip*tipFactor + body*bodyFactor, max) / bigDivisor. */
  knockbackTipFactor: 0.5,
  knockbackBodyFactor: 0.6,
  knockbackMax: 15,
  bigKnockbackDivisor: 2.2,

  /** Pop-up: vy is raised to base + tipSpeed*tipFactor. */
  popupSlime: 3.5,
  popupBrute: 1.5,
  popupTipFactor: 0.05,

  /** Equal-and-opposite: the body recoils and the blade loses momentum. */
  recoilBig: 1.6,
  recoilSmall: 0.7,
  tipBleedBig: 0.35,
  tipBleedSmall: 0.6,

  /** Impact juice. */
  hitShake: 0.28,
  hitstopBig: 0.06,
  hitstopSmall: 0.045,

  /** Touch damage: contact slop, per-enemy cooldown, max height to connect. */
  touchPad: 0.15,
  touchCD: 0.8,
  touchMaxHeight: 1,
  hurtShake: 0.5,
  hurtHitstop: 0.07,
} as const;
