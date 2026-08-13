/**
 * Procedural audio — ported from reference/dungeon-brawler.html's beep().
 * Dependency-free WebAudio; no Howler. The AudioContext is created/resumed
 * lazily on first pointerdown/touchstart to respect autoplay policy.
 */
import type { Game } from '../core/types';
import { TELEGRAPH } from '../content/ai';
import { WALL_SLAM } from '../content/environment';

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

  // `delay` schedules the note to start `delay` seconds from now instead of immediately —
  // used to string a few beep() calls into one short arpeggio (e.g. the streak fanfare).
  function beep(
    freq: number,
    dur: number,
    type: BeepType = 'square',
    vol = 0.08,
    slide = 0,
    delay = 0,
  ): void {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur);
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

      // Low menacing tone that rises through the windup — same duration as TELEGRAPH.windupTime
      // so the sound and the visual coil resolve together.
      game.events
        .ofType('enemy-telegraph')
        .forEach((e) =>
          beep(e.big ? 70 : 95, TELEGRAPH.windupTime, 'sawtooth', 0.07, e.big ? 90 : 70),
        );

      // Bright metallic clang — a sharp attack layered with a higher ringing overtone.
      game.events.ofType('parry').forEach(() => {
        beep(880, 0.05, 'square', 0.16, 400);
        beep(1760, 0.12, 'triangle', 0.09, -300);
      });

      // Small ascending fanfare blip every 5th streak kill.
      game.events.ofType('streak-changed').forEach((e) => {
        if (e.streak > 0 && e.streak % 5 === 0) {
          beep(523, 0.09, 'triangle', 0.11, 0, 0);
          beep(784, 0.14, 'triangle', 0.12, 60, 0.09);
        }
      });

      // Ground-slam charge hits full: a bright two-note "ready" chime.
      game.events.ofType('slam-charged').forEach(() => {
        beep(700, 0.09, 'sine', 0.12, 260);
        beep(1050, 0.12, 'triangle', 0.08, 0, 0.05);
      });

      // Slam release: deep double-layered thump — the biggest impact in the game.
      game.events.ofType('slam').forEach(() => {
        beep(60, 0.35, 'sine', 0.22, -30);
        beep(40, 0.5, 'triangle', 0.18, -20, 0.02);
      });

      // Execution: a heavy, punchy finishing stab.
      game.events.ofType('execution').forEach((e) => {
        beep(e.big ? 140 : 190, 0.09, 'sawtooth', 0.18, -120);
        beep(50, 0.15, 'square', 0.14, -20, 0.02);
      });

      // Wall slam: dull masonry thud, louder/deeper the harder the impact.
      game.events.ofType('wall-slam').forEach((e) => {
        const kick = Math.max(0, Math.min(1, (e.impact - WALL_SLAM.minImpactSpeed) / 15));
        beep(70, 0.18 + kick * 0.1, 'triangle', 0.08 + kick * 0.14, -25);
      });
    },
  };
}
