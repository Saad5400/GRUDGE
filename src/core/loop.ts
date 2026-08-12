/**
 * Fixed-timestep driver: simulation always steps at SIM_DT (60 Hz) regardless of
 * display refresh rate. Rendering happens once per animation frame with an
 * interpolation alpha. Gameplay code must never read wall-clock time.
 */

export const SIM_DT = 1 / 60;

/** Cap on how much real time one frame may simulate (tab switch, hitching). */
const MAX_FRAME = 0.1;

export interface LoopHooks {
  /** Advance the simulation by exactly SIM_DT. */
  step: () => void;
  /** Draw. alpha = fraction [0,1) of a sim step elapsed since the last step. */
  render: (alpha: number, frameDt: number) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createLoop(hooks: LoopHooks): Loop {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += dt;
    while (acc >= SIM_DT) {
      hooks.step();
      acc -= SIM_DT;
    }
    hooks.render(acc / SIM_DT, dt);
  }

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
