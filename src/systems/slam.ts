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
import { Collider, Enemy, Health, Player, SwordTip, Transform, Velocity } from '../components';
import { COMBAT } from '../content/combat';
import { SLAM } from '../content/slam';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function slamSystem(ctx: SimContext): void {
  const { dt, state } = ctx;
  const p = ctx.playerEid;
  const tipSpeed = Math.hypot(SwordTip.vx[p], SwordTip.vz[p]);
  const charge = Player.charge[p];

  // A full charge leaves on the first fast swing, planted or not — the release
  // IS the swing, and nobody stays rooted through one.
  if (charge >= 1 && tipSpeed >= SLAM.releaseTipSpeed) {
    releaseSlam(ctx, p);
    return;
  }

  // Winding up: planted feet and a blade held still. Everything else bleeds it.
  if (!state.dead && ctx.intents.planted && tipSpeed < SLAM.stillTipSpeed) {
    const next = Math.min(1, charge + dt / SLAM.chargeTime);
    Player.charge[p] = next;
    // Rising edge only: the "ready" cue rings once per charge, not every tick.
    if (charge < 1 && next >= 1) ctx.events.emit({ type: 'slam-charged' });
    return;
  }

  // Fast enough to survive the moment it takes to start the release swing,
  // nowhere near long enough to carry a charge across the arena.
  Player.charge[p] = Math.max(0, charge - SLAM.decayRate * dt);
}

/** The shockwave: everything standing in the ring around the tip, all at once. */
function releaseSlam(ctx: SimContext, p: number): void {
  const tipX = SwordTip.x[p];
  const tipZ = SwordTip.z[p];

  for (const e of enemiesNewestFirst(ctx.world)) {
    if (Health.hp[e] <= 0) continue;
    const cx = Transform.x[e];
    const cz = Transform.z[e];
    let kbX = cx - tipX;
    let kbZ = cz - tipZ;
    // Ground distance only — the wave runs along the floor, so an enemy already
    // in the air over the tip is still caught by it.
    let len = Math.hypot(kbX, kbZ);
    if (len > SLAM.radius + Collider.radius[e]) continue;

    Health.hp[e] -= SLAM.damage;
    // Stagger is the execution window; stun keeps the AI off it for at least as
    // long (see components/index.ts). Enemy.hitCD is deliberately NOT set: the
    // wave is not a blade contact, so the same swing's cut still lands — and
    // lands on something this wave just staggered.
    Enemy.stun[e] = Math.max(Enemy.stun[e], SLAM.stagger);
    Enemy.stagger[e] = Math.max(Enemy.stagger[e], SLAM.stagger);
    Enemy.flash[e] = SLAM.flashTime;

    // Blown radially off the tip; standing exactly on it means blown off the
    // knight instead, so a degenerate direction never eats the knockback.
    if (len <= 1e-6) {
      kbX = cx - Transform.x[p];
      kbZ = cz - Transform.z[p];
      len = Math.hypot(kbX, kbZ);
    }
    if (len > 0) {
      const power = SLAM.knockback / (enemyStats(e).big ? COMBAT.bigKnockbackDivisor : 1);
      Velocity.x[e] += (kbX / len) * power;
      Velocity.z[e] += (kbZ / len) * power;
    }
    Velocity.y[e] = Math.max(Velocity.y[e], SLAM.popup);
  }

  Player.charge[p] = 0;
  ctx.state.shake = Math.max(ctx.state.shake, SLAM.shake);
  ctx.state.hitstop = Math.max(ctx.state.hitstop, SLAM.hitstop);
  ctx.events.emit({ type: 'slam', x: tipX, z: tipZ, radius: SLAM.radius });
}
