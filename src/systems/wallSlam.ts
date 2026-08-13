/**
 * Wall slams: an enemy carried into the arena boundary or a pillar faster than
 * WALL_SLAM.minImpactSpeed (speed component INTO the surface) takes impact
 * damage, is staggered (execution window), and bounces off. See
 * src/content/environment.ts.
 *
 * Runs AFTER enemyAI/telegraph (positions are integrated, so an over-the-line
 * position + inward velocity IS the impact) and BEFORE collision (which then
 * clamps the position as it always did — this system only reads the overshoot
 * and edits velocity/health, it never resolves positions itself).
 *
 * Detection, per living enemy:
 * - Arena walls: Transform.x or .z beyond ±ARENA_HALF with velocity pointing
 *   further out → impact speed = |velocity component along that axis|.
 * - Pillars (content/arena PILLARS): overlap (dist < p.r + collider radius)
 *   with velocity pointing into the pillar → impact speed = −(vel · outNormal).
 * - One impact per enemy per tick (check walls first, then pillars; first hit wins).
 *
 * On impact >= minImpactSpeed:
 * - damage = baseDamage + floor((impact − minImpactSpeed) * speedDamageFactor),
 * - stun AND stagger max'd to WALL_SLAM.stagger, flash,
 * - the into-surface velocity component is reflected and scaled by restitution,
 * - a mid-attack enemy (attackState !== idle) has its attack broken: state →
 *   idle, attackT = 0 (keep its current attackCD) — a brute that lunges into a
 *   wall does not keep swinging,
 * - state.shake/hitstop max'd with WALL_SLAM.shake/hitstop, emit 'wall-slam'.
 * Kills resolve in enemyDeath via hp <= 0 as usual. No RNG in this system.
 */
import type { SimContext } from './context';

export function wallSlamSystem(ctx: SimContext): void {
  void ctx; // TODO(sim-b): implement per the header contract.
}
