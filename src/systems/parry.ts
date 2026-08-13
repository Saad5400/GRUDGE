/**
 * Parry: planted stance + blade contact vs a winding-up enemy.
 *
 * While intents.planted and the tip is moving at least PARRY.minTipSpeed, test
 * the blade segments (swept tip + grip→tip, same geometry as swordDamage, via
 * core/math segPointDist2) against enemies in ATTACK_STATE.windup. On contact:
 * cancel the attack (state → idle, attackCD = PARRY.attackCD), stagger
 * (stun = PARRY.stun, flash), knock the enemy back PARRY.knockback away from
 * the player, refund stamina, add PARRY.shake/hitstop, emit 'parry'. No damage
 * — the reward is the long riposte window on a staggered enemy.
 *
 * Runs BEFORE swordDamage: a parried enemy gets Enemy.hitCD = COMBAT.hitCD so
 * the same swing cannot also cut it, and hitCD is what limits a contact to one
 * parry. The swept segment (SwordTip.prevX/prevZ) is deliberately NOT advanced
 * here — swordDamage owns that, and it must see the same segment we did.
 */
import {
  ATTACK_STATE,
  Collider,
  Enemy,
  Player,
  SwordTip,
  Transform,
  Velocity,
} from '../components';
import { COMBAT, PARRY } from '../content/combat';
import { SWORD } from '../content/sword';
import { segPointDist2 } from '../core/math';
import { enemiesNewestFirst, type SimContext } from './context';

export function parrySystem(ctx: SimContext): void {
  const { state } = ctx;
  const p = ctx.playerEid;

  // A parry is a stance, not a swing: feet planted, blade actually moving.
  if (state.dead || !ctx.intents.planted) return;
  const tipSpeed = Math.hypot(SwordTip.vx[p], SwordTip.vz[p]);
  if (tipSpeed < PARRY.minTipSpeed) return;

  const tipX = SwordTip.x[p];
  const tipZ = SwordTip.z[p];
  const prevX = SwordTip.prevX[p];
  const prevZ = SwordTip.prevZ[p];
  const gripX = Transform.x[p];
  const gripZ = Transform.z[p];

  for (const e of enemiesNewestFirst(ctx.world)) {
    // Only a committed windup is readable — idle/strike/recover are not parryable.
    if (Enemy.attackState[e] !== ATTACK_STATE.windup) continue;
    if (Enemy.hitCD[e] > 0) continue;

    const cx = Transform.x[e];
    const cy = Math.min(COMBAT.centreMax, COMBAT.centreBase + Transform.y[e]);
    const cz = Transform.z[e];
    const hitR = Collider.radius[e] + COMBAT.hitRadiusPad;
    const hitR2 = hitR * hitR;

    // Same two segments swordDamage uses: swept tip, then the blade itself.
    const swept = segPointDist2(
      prevX,
      SWORD.tipHeight,
      prevZ,
      tipX,
      SWORD.tipHeight,
      tipZ,
      cx,
      cy,
      cz,
    );
    const blade = segPointDist2(
      gripX,
      SWORD.gripHeight,
      gripZ,
      tipX,
      SWORD.tipHeight,
      tipZ,
      cx,
      cy,
      cz,
    );
    if (swept >= hitR2 && blade >= hitR2) continue;

    // The attack is broken outright, not merely interrupted.
    Enemy.attackState[e] = ATTACK_STATE.idle;
    Enemy.attackT[e] = 0;
    Enemy.attackCD[e] = PARRY.attackCD;
    Enemy.stun[e] = PARRY.stun;
    // The stagger is the execution window — the whole point of the riposte.
    Enemy.stagger[e] = PARRY.stun;
    Enemy.flash[e] = PARRY.flashTime;
    // Consumes the blade contact: no damage from this swing on this enemy.
    Enemy.hitCD[e] = COMBAT.hitCD;

    // Shoved straight back off the knight. vy is left alone — a parry rings the
    // enemy off its feet horizontally, it does not pop it into the air.
    let kbX = cx - gripX;
    let kbZ = cz - gripZ;
    const len = Math.hypot(kbX, kbZ);
    if (len > 0) {
      kbX /= len;
      kbZ /= len;
      Velocity.x[e] += kbX * PARRY.knockback;
      Velocity.z[e] += kbZ * PARRY.knockback;
    }

    // Reading an attack pays the arms back and rings the bell.
    Player.stamina[p] = Math.min(1, Player.stamina[p] + PARRY.staminaRefund);
    state.shake = Math.max(state.shake, PARRY.shake);
    state.hitstop = Math.max(state.hitstop, PARRY.hitstop);

    ctx.events.emit({ type: 'parry', eid: e, x: cx, z: cz, tipSpeed });
  }
}
