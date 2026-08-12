/**
 * Attack-token allocator: at most AI_TOKENS.maxAttackers enemies hold a token
 * at any moment; only holders press the player, everyone else orbits at
 * standoff range (see enemyAI). Tokens go to the nearest eligible enemies and
 * are re-evaluated on a fixed cadence (ctx.tokenTimer) so the pack rotates
 * pressure instead of dogpiling — the group reads as coordinated, not psychic.
 *
 * Contract:
 *  - Writes Enemy.token[e] (1 = may attack, 0 = orbit).
 *  - An enemy mid-attack (attackState !== idle) keeps its token until recover ends.
 *  - Deterministic: distance ties broken by entity id; RNG only via ctx.rng.
 */
import { ATTACK_STATE, Enemy, Health, Transform } from '../components';
import { AI_TOKENS } from '../content/ai';
import { enemiesNewestFirst, type SimContext } from './context';

export function attackTokenSystem(ctx: SimContext): void {
  // Reassign on a cadence, not every tick: constant re-picking makes the pack
  // twitch, and a holder needs long enough with the token to actually commit.
  ctx.tokenTimer -= ctx.dt;
  if (ctx.tokenTimer > 0) return;
  ctx.tokenTimer += AI_TOKENS.reassignInterval;

  const p = ctx.playerEid;
  const px = Transform.x[p];
  const pz = Transform.z[p];

  const contenders: number[] = [];
  const dist2: number[] = [];
  let committed = 0;

  for (const e of enemiesNewestFirst(ctx.world)) {
    // Corpses (killed this tick, removed by enemyDeath later) never hold one.
    if (Health.hp[e] <= 0) {
      Enemy.token[e] = 0;
      continue;
    }
    // Already swinging: keep the token through recover so a committed brute is
    // never stranded mid-lunge by a reassignment.
    if (Enemy.attackState[e] !== ATTACK_STATE.idle) {
      Enemy.token[e] = 1;
      committed++;
      continue;
    }
    Enemy.token[e] = 0;
    const dx = px - Transform.x[e];
    const dz = pz - Transform.z[e];
    dist2.push(dx * dx + dz * dz);
    contenders.push(e);
  }

  const slots = AI_TOKENS.maxAttackers - committed;
  if (slots <= 0) return;

  // Nearest first; entity id breaks ties so the pack's choice is reproducible.
  const order = contenders.map((_e, i) => i);
  order.sort((a, b) => dist2[a] - dist2[b] || contenders[a] - contenders[b]);
  for (let i = 0; i < slots && i < order.length; i++) Enemy.token[contenders[order[i]]] = 1;
}
