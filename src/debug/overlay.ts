/**
 * Tiny dependency-free debug panel. Hidden by default; enabled via ?debug=1
 * or toggled with the backquote key. Shows FPS, live entity/wave/kill counts,
 * sim time, seed (if given), and shake/hitstop.
 */
import type { Game, GameView } from '../core/types';

export interface DebugOverlay {
  update(frameDt: number): void;
}

export function createDebugOverlay(game: Game, _view: GameView): DebugOverlay {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed');
  let enabled = params.get('debug') === '1';

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'z-index:99999',
    "font-family:Menlo,Consolas,'SF Mono',monospace",
    'font-size:11px',
    'line-height:1.5',
    'color:#b8f0c8',
    'background:rgba(10,10,14,.72)',
    'padding:6px 9px',
    'border:1px solid rgba(255,255,255,.08)',
    'white-space:pre',
    'pointer-events:none',
    'display:none',
  ].join(';');
  document.body.appendChild(panel);

  function setVisible(v: boolean): void {
    enabled = v;
    panel.style.display = v ? 'block' : 'none';
  }
  setVisible(enabled);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === '`') setVisible(!enabled);
  });

  let fps = 0;

  return {
    update(frameDt: number) {
      if (frameDt > 0) {
        const instant = 1 / frameDt;
        fps = fps === 0 ? instant : fps + (instant - fps) * 0.1;
      }
      if (!enabled) return;
      const lines = [
        `FPS ${fps.toFixed(0)}`,
        `entities ${game.state.alive + 1}`,
        `wave ${game.state.wave}  kills ${game.state.kills}`,
        `time ${game.state.time.toFixed(1)}s`,
      ];
      if (seed !== null) lines.push(`seed ${seed}`);
      lines.push(`shake ${game.state.shake.toFixed(2)}  hitstop ${game.state.hitstop.toFixed(2)}`);
      panel.textContent = lines.join('\n');
    },
  };
}
