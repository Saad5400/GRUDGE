/**
 * Blade → enemy damage: the swept tip segment (last tick's tip → this tick's
 * tip) AND the grip→tip blade segment are tested against enemy spheres, so both
 * whipped tip cuts and slow shoulder-checks with the flat of the blade connect.
 * Damage and knockback scale with blade speed; every connect kicks back on the
 * knight's own body.
 */
import { Collider, Enemy, Health, SwordTip, Transform, Velocity } from '../components';
import { COMBAT } from '../content/combat';
import { SWORD } from '../content/sword';
import { segPointDist2 } from '../core/math';
import { enemiesNewestFirst, enemyStats, type SimContext } from './context';

export function swordDamageSystem(ctx: SimContext): void {
  const { state } = ctx;
  const p = ctx.playerEid;
  const tipX = SwordTip.x[p];
  const tipZ = SwordTip.z[p];
  const tipSpeed = Math.hypot(SwordTip.vx[p], SwordTip.vz[p]);

  if (!state.dead && tipSpeed > COMBAT.minHitTipSpeed) {
    const prevX = SwordTip.prevX[p];
    const prevZ = SwordTip.prevZ[p];
    const gripX = Transform.x[p];
    const gripZ = Transform.z[p];
    const bodySpeed = ctx.bodySpeed;

    for (const e of enemiesNewestFirst(ctx.world)) {
      if (Enemy.hitCD[e] > 0) continue;
      const stats = enemyStats(e);
      const cx = Transform.x[e];
      const cy = Math.min(COMBAT.centreMax, COMBAT.centreBase + Transform.y[e]);
      const cz = Transform.z[e];
      const hitR = Collider.radius[e] + COMBAT.hitRadiusPad;
      const hitR2 = hitR * hitR;

      // swept tip segment (both ends on the tip plane) …
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
      // … and the blade itself, grip → tip.
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

      Enemy.hitCD[e] = COMBAT.hitCD;
      const dmg = tipSpeed > COMBAT.heavyTipSpeed ? COMBAT.heavyDamage : COMBAT.lightDamage;
      Health.hp[e] -= dmg;
      Enemy.flash[e] = COMBAT.flashTime;
      Enemy.stun[e] = COMBAT.stunTime;

      // Momentum transfer: knockback along the blade's velocity (kept modest so
      // follow-ups still land), falling back to "away from the knight".
      let kbX = SwordTip.vx[p];
      let kbZ = SwordTip.vz[p];
      if (kbX * kbX + kbZ * kbZ < 1) {
        kbX = cx - Transform.x[p];
        kbZ = cz - Transform.z[p];
      }
      const kbLen = Math.hypot(kbX, kbZ);
      if (kbLen > 0) {
        kbX /= kbLen;
        kbZ /= kbLen;
      }
      const power =
        Math.min(
          tipSpeed * COMBAT.knockbackTipFactor + bodySpeed * COMBAT.knockbackBodyFactor,
          COMBAT.knockbackMax,
        ) / (stats.big ? COMBAT.bigKnockbackDivisor : 1);
      Velocity.x[e] += kbX * power;
      Velocity.z[e] += kbZ * power;
      Velocity.y[e] = Math.max(
        Velocity.y[e],
        (stats.big ? COMBAT.popupBrute : COMBAT.popupSlime) + tipSpeed * COMBAT.popupTipFactor,
      );

      // Equal-and-opposite: recoil on the body, blade loses momentum in the cut.
      const recoil = stats.big ? COMBAT.recoilBig : COMBAT.recoilSmall;
      Velocity.x[p] -= kbX * recoil;
      Velocity.z[p] -= kbZ * recoil;
      const bleed = stats.big ? COMBAT.tipBleedBig : COMBAT.tipBleedSmall;
      SwordTip.vx[p] *= bleed;
      SwordTip.vz[p] *= bleed;

      state.shake = Math.max(state.shake, COMBAT.hitShake);
      state.hitstop = Math.max(state.hitstop, stats.big ? COMBAT.hitstopBig : COMBAT.hitstopSmall);

      ctx.events.emit({
        type: 'sword-hit',
        eid: e,
        x: cx,
        y: cy,
        z: cz,
        big: stats.big,
        killed: Health.hp[e] <= 0,
        tipSpeed,
      });
    }
  }

  // The swept segment always advances, hit or not.
  SwordTip.prevX[p] = tipX;
  SwordTip.prevZ[p] = tipZ;
}
