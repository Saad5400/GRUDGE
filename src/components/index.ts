/**
 * ECS component definitions (bitECS 0.3 SoA stores).
 * Components are pure data — no methods, no Three.js objects.
 * Access pattern: Transform.x[eid], Velocity.z[eid], etc.
 *
 * Coordinate convention: X/Z is the ground plane, Y is height above ground.
 * Transform.rot is facing angle (radians, atan2(x, z) convention like the demo).
 */
import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
  rot: Types.f32,
});

export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
});

/** Circle collider on the ground plane. */
export const Collider = defineComponent({
  radius: Types.f32,
});

export const Health = defineComponent({
  hp: Types.f32,
  maxHp: Types.f32,
  /** Invulnerability seconds remaining (i-frames). */
  invuln: Types.f32,
});

/** Tag + player-specific state. Exactly one entity has this. */
export const Player = defineComponent({
  /** Angular velocity of facing (spring-damper toward sword tip). */
  faceVel: Types.f32,
  /** 0..1 — sustained fast blade work drains it. */
  stamina: Types.f32,
  /** 0..1 ground-slam charge — builds while planted with a still blade. */
  charge: Types.f32,
});

/**
 * The physics sword tip: a point mass on a stiff spring toward the aim point.
 * Lives on the player entity. prevX/prevZ are last tick's position, used for
 * swept-segment hit detection.
 */
export const SwordTip = defineComponent({
  x: Types.f32,
  z: Types.f32,
  vx: Types.f32,
  vz: Types.f32,
  prevX: Types.f32,
  prevZ: Types.f32,
});

export const ENEMY_KIND = {
  slime: 0,
  brute: 1,
} as const;
export type EnemyKind = (typeof ENEMY_KIND)[keyof typeof ENEMY_KIND];

/**
 * Telegraphed-attack state machine (brutes). idle → windup (readable, parryable)
 * → strike (lunge) → recover → idle. Render reads this for windup visuals.
 */
export const ATTACK_STATE = {
  idle: 0,
  windup: 1,
  strike: 2,
  recover: 3,
} as const;
export type AttackState = (typeof ATTACK_STATE)[keyof typeof ATTACK_STATE];

export const Enemy = defineComponent({
  kind: Types.ui8,
  /** Seconds until next hop (slimes). */
  hopT: Types.f32,
  /** Stun seconds remaining (no AI while stunned). */
  stun: Types.f32,
  /**
   * Stagger seconds remaining — the EXECUTION window. Only big openings set it
   * (parry, ground slam, wall slam), never an ordinary blade hit; a staggered
   * enemy dies outright to a fast follow-up cut. Always paired with >= as much stun.
   */
  stagger: Types.f32,
  /** Hit-flash seconds remaining (render reads this for white flash). */
  flash: Types.f32,
  /** Cooldown before this enemy can damage the player by touch again. */
  touchCD: Types.f32,
  /** Cooldown before the sword can hit this enemy again. */
  hitCD: Types.f32,
  /** -1 or 1; strafing preference. */
  circleDir: Types.i8,
  /** ATTACK_STATE value (telegraph state machine, brutes). */
  attackState: Types.ui8,
  /** Seconds remaining in the current attack state. */
  attackT: Types.f32,
  /** Cooldown before this enemy may start another telegraphed attack. */
  attackCD: Types.f32,
  /** Lunge direction, locked at windup start (unit vector). */
  lungeX: Types.f32,
  lungeZ: Types.f32,
  /** 1 while holding an attack token (allowed to press the player). */
  token: Types.ui8,
});
