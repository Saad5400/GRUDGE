/**
 * Procedural audio — ported from reference/dungeon-brawler.html's beep().
 * Dependency-free WebAudio; no Howler. The AudioContext is created/resumed
 * lazily on first pointerdown/touchstart to respect autoplay policy.
 */
import type { Game } from '../core/types';

export interface Audio {
  update(): void;
}

type BeepType = OscillatorType;

export function createAudio(game: Game): Audio {
  let ctx: AudioContext | null = null;

  function ensureContext(): void {
    if (ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }

  const resume = (): void => {
    ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('touchstart', resume, { passive: true });

  function beep(freq: number, dur: number, type: BeepType = 'square', vol = 0.08, slide = 0): void {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  return {
    update() {
      game.events.ofType('player-hurt').forEach(() => beep(110, 0.25, 'sawtooth', 0.12, -40));
      game.events.ofType('player-died').forEach(() => beep(80, 0.6, 'sawtooth', 0.15, -50));
      game.events
        .ofType('sword-hit')
        .forEach((e) => beep(e.big ? 150 : 220, 0.08, 'square', 0.09, -80));
      game.events.ofType('enemy-died').forEach(() => beep(90, 0.18, 'square', 0.1, -30));
      game.events.ofType('wave-started').forEach(() => beep(330, 0.15, 'triangle', 0.1, 220));
      game.events.ofType('whoosh').forEach(() => beep(140, 0.1, 'sawtooth', 0.04, -50));
    },
  };
}
