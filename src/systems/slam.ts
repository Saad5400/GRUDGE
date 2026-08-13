/**
 * Ground slam: charge while planted with a still blade, release as an AoE
 * shockwave on the next fast swing. See src/content/slam.ts for the intent and
 * every tunable.
 *
 * Charge (Player.charge, 0..1):
 * - Builds at 1/SLAM.chargeTime per second while !state.dead && intents.planted
 *   && tipSpeed < SLAM.stillTipSpeed.
 * - Emits 'slam-charged' exactly once on the tick charge crosses 1 (clamp at 1).
 * - Whenever the build conditions are NOT met (and no release happens), charge
 *   drains at SLAM.decayRate per second (floor 0). A full charge therefore
 *   survives the ~0.1s it takes to start the release swing, but not a stroll.
 *
 * Release: charge >= 1 && tipSpeed >= SLAM.releaseTipSpeed (planted or not):
 * - Shockwave centred on the TIP (SwordTip.x/z): every living enemy whose
 *   ground distance from the tip is <= SLAM.radius + its collider radius takes
 *   SLAM.damage, radial knockback SLAM.knockback away from the tip (falls back
 *   to away-from-player if the enemy is exactly on the tip), vy raised to at
 *   least SLAM.popup, stun AND stagger set to SLAM.stagger (max with current),
 *   flash. Does NOT touch Enemy.hitCD — the wave is not a blade contact.
 * - charge = 0, state.shake/hitstop max'd with SLAM.shake/hitstop, emit 'slam'.
 *
 * Runs after swordPhysics (needs this tick's tip speed) and before parry/
 * swordDamage — a slam-staggered enemy can be executed by the same swing's cut.
 * Kills are NOT resolved here; enemyDeath picks up hp <= 0 as usual.
 */
import type { SimContext } from './context';

export function slamSystem(ctx: SimContext): void {
  void ctx; // TODO(sim-a): implement per the header contract.
}
