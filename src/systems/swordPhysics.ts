/**
 * THE SWORD TIP IS THE CURSOR.
 *
 * The tip is a point mass on a stiff spring toward the aim point: it goes where
 * you point, but it carries momentum, so fast pointer moves whip it through
 * targets with overshoot. Once it is moving, pulling back the other way barely
 * bites until that momentum bleeds off (commitment). Past arm's reach the leash
 * inverts: the sword drags the knight's body along behind it.
 */
import { Player, SwordTip, Transform, Velocity } from '../components';
import { SWORD } from '../content/sword';
import { clamp, expDecay } from '../core/math';
import type { SimContext } from './context';

export function swordPhysicsSystem(ctx: SimContext): void {
  const { dt, intents } = ctx;
  const p = ctx.playerEid;

  const px = Transform.x[p];
  const pz = Transform.z[p];

  // Spring target: the aim point, or a ready-stance point ahead of the knight
  // until the first pointer input arrives.
  let targetX: number;
  let targetZ: number;
  if (intents.aimActive) {
    targetX = intents.aimX;
    targetZ = intents.aimZ;
  } else {
    targetX = px + Math.sin(Transform.rot[p]) * SWORD.idleTargetDist;
    targetZ = pz + Math.cos(Transform.rot[p]) * SWORD.idleTargetDist;
  }

  let vx = SwordTip.vx[p];
  let vz = SwordTip.vz[p];
  let tipX = SwordTip.x[p];
  let tipZ = SwordTip.z[p];

  // Stamina: sustained fast blade work tires the arms slightly.
  const tsNow = Math.hypot(vx, vz);
  const stamDelta =
    tsNow > SWORD.stamDrainSpeed
      ? -(tsNow - SWORD.stamDrainSpeed) * SWORD.stamDrainRate * dt
      : (tsNow < SWORD.stamRegenSpeed ? SWORD.stamRegenRate : 0) * dt;
  Player.stamina[p] = clamp(Player.stamina[p] + stamDelta, 0, 1);

  // Heavy spring: big mass, low damping — the blade commits to a swing.
  let fX = (targetX - tipX) * SWORD.springStiffness;
  let fZ = (targetZ - tipZ) * SWORD.springStiffness;
  if (tsNow > SWORD.commitSpeed && fX * vx + fZ * vz < 0) {
    fX *= SWORD.commitFactor;
    fZ *= SWORD.commitFactor;
  }
  vx += fX * dt;
  vz += fZ * dt;
  const tipDrag = expDecay(SWORD.tipDrag, dt);
  vx *= tipDrag;
  vz *= tipDrag;

  // Reach constraint: beyond arm's reach the sword drags the body (and the
  // blade stretches slightly before a hard limit stops it).
  let radialX = tipX - px;
  let radialZ = tipZ - pz;
  let rd = Math.hypot(radialX, radialZ);
  if (rd < 1e-4) {
    radialX = 0;
    radialZ = 1;
    rd = 1;
  }
  const rdx = radialX / rd;
  const rdz = radialZ / rd;
  if (rd > SWORD.reach) {
    const over = rd - SWORD.reach;
    if (!intents.planted) {
      // The sword pulls the knight along.
      Velocity.x[p] += rdx * over * SWORD.bodyPull * dt;
      Velocity.z[p] += rdz * over * SWORD.bodyPull * dt;
    }
    const pullback = intents.planted ? SWORD.pullbackPlanted : SWORD.pullbackFree;
    vx -= rdx * over * pullback * dt;
    vz -= rdz * over * pullback * dt;
    if (rd > SWORD.reach + SWORD.stretch) {
      // Hard limit: snap back and kill outward radial velocity.
      tipX = px + rdx * (SWORD.reach + SWORD.stretch);
      tipZ = pz + rdz * (SWORD.reach + SWORD.stretch);
      const outward = rdx * vx + rdz * vz;
      if (outward > 0) {
        vx -= rdx * outward;
        vz -= rdz * outward;
      }
    }
  } else if (rd < SWORD.minRadius) {
    // The blade can't pass through the body.
    tipX = px + rdx * SWORD.minRadius;
    tipZ = pz + rdz * SWORD.minRadius;
    const inward = rdx * vx + rdz * vz;
    if (inward < 0) {
      vx -= rdx * inward;
      vz -= rdz * inward;
    }
  }

  const tvLen = Math.hypot(vx, vz);
  if (tvLen > SWORD.maxTipSpeed) {
    const s = SWORD.maxTipSpeed / tvLen;
    vx *= s;
    vz *= s;
  }
  tipX += vx * dt;
  tipZ += vz * dt;

  SwordTip.x[p] = tipX;
  SwordTip.z[p] = tipZ;
  SwordTip.vx[p] = vx;
  SwordTip.vz[p] = vz;

  // Whoosh on the rising edge only, with hysteresis (demo's `step._wh` latch).
  const tipSpeed = Math.hypot(vx, vz);
  if (tipSpeed > SWORD.whooshOn && !ctx.whooshLatch) {
    ctx.whooshLatch = true;
    ctx.events.emit({ type: 'whoosh', tipSpeed });
  }
  if (tipSpeed < SWORD.whooshOff) ctx.whooshLatch = false;
}
