/**
 * Unified input: reduces mouse + touch to the sim's `Intents`. Called once per
 * sim tick, before game.step(). Touch aim takes priority while a touch is
 * active (mobile), otherwise the mouse drives aim. Exactly one raycast
 * (view.screenToGround) happens per update() call.
 */
import type { GameView, Intents } from '../core/types';
import { createMouseSource } from './mouse';
import { createTouchSource } from './touch';

export interface Input {
  update(): void;
  dispose(): void;
}

export function createInput(intents: Intents, view: GameView): Input {
  const mouse = createMouseSource();
  const touch = createTouchSource(view.canvas);

  return {
    update() {
      const pos = touch.active ? touch.sample() : mouse.sample();
      if (pos) {
        const ground = view.screenToGround(pos.x, pos.y);
        if (ground) {
          intents.aimX = ground.x;
          intents.aimZ = ground.z;
          intents.aimActive = true;
        }
      }
      intents.planted = mouse.planted || touch.planted;
    },
    dispose() {
      mouse.dispose();
      touch.dispose();
    },
  };
}
