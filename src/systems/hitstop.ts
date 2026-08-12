/**
 * Hit-stop + shake bookkeeping.
 *
 * The demo scaled its real frame dt by .08 while `hitstop > 0`, which froze the
 * world for a beat on every connect. With a fixed timestep the tick length can
 * not change, so instead every system receives a slowed *effective* dt while the
 * hit-stop budget (spent in real SIM_DT units) drains.
 */
import { SIM_DT } from '../core/loop';
import { HITSTOP_TIME_SCALE, SHAKE_DECAY } from '../content/feel';
import type { SimContext } from './context';

/** Drains the hit-stop budget and writes `ctx.dt` for the rest of the pipeline. */
export function hitstopSystem(ctx: SimContext): void {
  if (ctx.state.hitstop > 0) {
    ctx.state.hitstop = Math.max(0, ctx.state.hitstop - SIM_DT);
    ctx.dt = SIM_DT * HITSTOP_TIME_SCALE;
  } else {
    ctx.dt = SIM_DT;
  }
}

/** Bleeds camera-shake energy. Runs last, like the demo's post-step decay. */
export function shakeDecaySystem(ctx: SimContext): void {
  ctx.state.shake = Math.max(0, ctx.state.shake - ctx.dt * SHAKE_DECAY);
}
