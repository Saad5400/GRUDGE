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

export const Enemy = defineComponent({
  kind: Types.ui8,
  /** Seconds until next hop (slimes). */
  hopT: Types.f32,
  /** Stun seconds remaining (no AI while stunned). */
  stun: Types.f32,
  /** Hit-flash seconds remaining (render reads this for white flash). */
  flash: Types.f32,
  /** Cooldown before this enemy can damage the player by touch again. */
  touchCD: Types.f32,
  /** Cooldown before the sword can hit this enemy again. */
  hitCD: Types.f32,
  /** -1 or 1; strafing preference. */
  circleDir: Types.i8,
});
