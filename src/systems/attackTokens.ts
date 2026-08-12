/**
 * Attack-token allocator: at most AI_TOKENS.maxAttackers enemies hold a token
 * at any moment; only holders press the player, everyone else orbits at
 * standoff range (see enemyAI). Tokens go to the nearest eligible enemies and
 * are re-evaluated on a fixed cadence (ctx.tokenTimer) so the pack rotates
 * pressure instead of dogpiling — the group reads as coordinated, not psychic.
 *
 * SKELETON — implemented by the Phase 2 sim agent. Contract:
 *  - Writes Enemy.token[e] (1 = may attack, 0 = orbit).
 *  - An enemy mid-attack (attackState !== idle) keeps its token until recover ends.
 *  - Deterministic: distance ties broken by entity id; RNG only via ctx.rng.
 */
import type { SimContext } from './context';

export function attackTokenSystem(_ctx: SimContext): void {
  // no-op until implemented
}
