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
 * SKELETON — implemented by the Phase 2 sim agent.
 */
import type { SimContext } from './context';

export function comboSystem(_ctx: SimContext): void {
  // no-op until implemented
}
