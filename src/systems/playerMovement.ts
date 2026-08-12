/**
 * Player locomotion: the body chases the aim point with real momentum, and the
 * facing angle is a spring-damper that lags behind the sword tip.
 *
 * Inside `PLAYER.walkZone` the knight stands his ground — dragging the cursor
 * far away is what makes him walk, so movement and aiming are the same gesture.
 */
import { Player, SwordTip, Transform, Velocity } from '../components';
import { PLAYER } from '../content/player';
import { angleDelta, expDecay } from '../core/math';
import { collideStatics } from './collision';
import type { SimContext } from './context';

export function playerMovementSystem(ctx: SimContext): void {
  const { dt, intents, state } = ctx;
  const p = ctx.playerEid;

  const toX = intents.aimX - Transform.x[p];
  const toZ = intents.aimZ - Transform.z[p];
  const aimDist = Math.hypot(toX, toZ);
  const moving = aimDist > PLAYER.walkZone && intents.aimActive && !intents.planted;

  if (!state.dead && moving) {
    const dirX = toX / aimDist;
    const dirZ = toZ / aimDist;
    const spdNow = Math.hypot(Velocity.x[p], Velocity.z[p]);
    const urgency = Math.min((aimDist - PLAYER.walkZone) / PLAYER.urgencyRamp, 1);
    const accel = PLAYER.accel * urgency * Math.max(0, 1 - spdNow / PLAYER.accelSpeedFalloff);
    Velocity.x[p] += dirX * accel * dt;
    Velocity.z[p] += dirZ * accel * dt;
    // Braking when the current velocity opposes where we want to go: gates on
    // the pre-acceleration speed but uses the post-acceleration direction,
    // exactly as the demo did.
    if (spdNow > PLAYER.brakeMinSpeed) {
      const vlen = Math.hypot(Velocity.x[p], Velocity.z[p]);
      if (vlen > 0) {
        const oppose = Math.max(
          0,
          -((Velocity.x[p] / vlen) * dirX + (Velocity.z[p] / vlen) * dirZ),
        );
        const brake = expDecay(oppose * PLAYER.brakeRate, dt);
        Velocity.x[p] *= brake;
        Velocity.z[p] *= brake;
      }
    }
  }

  const drag = expDecay(
    intents.planted ? PLAYER.dragPlanted : moving ? PLAYER.dragMoving : PLAYER.dragIdle,
    dt,
  );
  Velocity.x[p] *= drag;
  Velocity.z[p] *= drag;

  let spd = Math.hypot(Velocity.x[p], Velocity.z[p]);
  if (spd > PLAYER.maxSpeed) {
    // Hard cap: lunges and recoil can't stack to infinity.
    const s = PLAYER.maxSpeed / spd;
    Velocity.x[p] *= s;
    Velocity.z[p] *= s;
    spd = PLAYER.maxSpeed;
  }
  Velocity.y[p] = 0;
  ctx.bodySpeed = spd;

  Transform.x[p] += Velocity.x[p] * dt;
  Transform.z[p] += Velocity.z[p] * dt;
  collideStatics(p);

  // Facing: spring-damper toward the sword tip, so the torso carries angular
  // momentum and overshoots on whipped cuts.
  let faceTarget = Transform.rot[p];
  const toTipX = SwordTip.x[p] - Transform.x[p];
  const toTipZ = SwordTip.z[p] - Transform.z[p];
  if (Math.hypot(toTipX, toTipZ) > PLAYER.faceMinTipDist) {
    faceTarget = Math.atan2(toTipX, toTipZ);
  }
  const fd = angleDelta(Transform.rot[p], faceTarget);
  Player.faceVel[p] += fd * PLAYER.faceStiffness * dt;
  Player.faceVel[p] *= expDecay(PLAYER.faceDamping, dt);
  Transform.rot[p] += Player.faceVel[p] * dt;
}
