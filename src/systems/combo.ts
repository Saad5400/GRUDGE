/**
 * Kill-streak meter: consecutive kills within COMBO.window build a streak;
 * getting hurt (or the window lapsing) resets it. Every COMBO.healEvery streak
 * kills heals 1 hp (capped at maxHp, emits 'player-healed').
 *
 * Runs AFTER enemyDeath so it can read this tick's 'enemy-died' events, and
 * reads 'player-hurt' events for the reset. Writes state.streak / state.streakT
 * / state.bestStreak and emits 'streak-changed' on every change (including the
 * drop back to zero).
 *
 * Getting hit in the same tick as a kill loses the streak: the hurt is applied
 * after the kills, so trading a heart for a kill still costs you the meter.
 */
import { Health } from '../components';
import { COMBO } from '../content/combo';
import type { SimContext } from './context';

export function comboSystem(ctx: SimContext): void {
  const { state } = ctx;
  const p = ctx.playerEid;

  const kills = ctx.events.ofType('enemy-died').length;
  for (let i = 0; i < kills; i++) {
    state.streak++;
    state.streakT = COMBO.window;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    ctx.events.emit({ type: 'streak-changed', streak: state.streak, best: state.bestStreak });

    // Every healEvery-th kill of a streak pays a heart back — the only reward
    // for chaining kills that survives the fight.
    if (state.streak % COMBO.healEvery === 0 && Health.hp[p] < Health.maxHp[p]) {
      Health.hp[p] = Math.min(Health.maxHp[p], Health.hp[p] + 1);
      ctx.events.emit({ type: 'player-healed', hp: Health.hp[p] });
    }
  }

  if (COMBO.resetOnHurt && ctx.events.ofType('player-hurt').length > 0) {
    if (state.streak > 0) {
      state.streak = 0;
      ctx.events.emit({ type: 'streak-changed', streak: 0, best: state.bestStreak });
    }
    state.streakT = 0;
  } else if (kills === 0 && state.streak > 0) {
    // The window only burns down on ticks that did not feed it.
    state.streakT -= ctx.dt;
    if (state.streakT <= 0) {
      state.streak = 0;
      state.streakT = 0;
      ctx.events.emit({ type: 'streak-changed', streak: 0, best: state.bestStreak });
    }
  }
}
