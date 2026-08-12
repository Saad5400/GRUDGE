/**
 * Composition root: wires the headless sim to input, render, HUD, audio, debug.
 * This is the ONLY file that knows about every layer.
 */
import { createLoop } from './core/loop';
import { createGame } from './game';
import { createView } from './render/view';
import { createInput } from './input/input';
import { createHud } from './ui/hud';
import { createAudio } from './audio/audio';
import { createDebugOverlay } from './debug/overlay';

const app = document.getElementById('app');
const hudRoot = document.getElementById('hud');
if (!app || !hudRoot) throw new Error('missing #app / #hud mount points');

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null ? Number(seedParam) >>> 0 : (Date.now() & 0xffffffff) >>> 0;

const game = createGame(seed);
const view = createView(game, app);
const input = createInput(game.intents, view);
const hud = createHud(game, hudRoot);
const audio = createAudio(game);
const debug = createDebugOverlay(game, view);

const loop = createLoop({
  step() {
    input.update();
    game.step();
  },
  render(alpha, frameDt) {
    view.render(alpha, frameDt);
    hud.update();
    audio.update();
    debug.update(frameDt);
    game.events.clear();
  },
});

loop.start();

// Testing/debug hook (Playwright smoke tests reach the sim through this).
declare global {
  interface Window {
    __grudge?: { game: typeof game; view: typeof view; seed: number };
  }
}
window.__grudge = { game, view, seed };
