/**
 * DOM HUD overlay — ported 1:1 from reference/dungeon-brawler.html (hearts,
 * stamina bar, wave/kills stats, center message, game-over screen, help
 * line). Reads sim state + events each frame; never mutates the sim except
 * via `game.intents.restart` from the retry button.
 */
import './hud.css';
import type { Game } from '../core/types';
import { Health, Player } from '../components';

export interface Hud {
  update(): void;
  dispose(): void;
}

const HELP_TEXT =
  'Cursor IS the sword tip · drag far to walk · RIGHT CLICK plants your feet · touch: drag to aim, second finger plants';

const MSG_DURATION_MS = 1300;
const OVER_DELAY_MS = 700;

export function createHud(game: Game, root: HTMLElement): Hud {
  root.innerHTML = `
    <div id="hearts"></div>
    <div id="stambar"><div id="stamfill"></div></div>
    <div id="stats">WAVE <b id="wave">1</b><br>KILLS <span id="kills">0</span></div>
    <div id="msg"></div>
    <div id="over"><h1>YOU FELL</h1><p id="overstats"></p><button id="retry" type="button">RISE AGAIN</button></div>
    <div id="help"></div>
  `;

  const heartsEl = root.querySelector<HTMLDivElement>('#hearts')!;
  const stamBarEl = root.querySelector<HTMLDivElement>('#stambar')!;
  const stamFillEl = root.querySelector<HTMLDivElement>('#stamfill')!;
  const waveEl = root.querySelector<HTMLElement>('#wave')!;
  const killsEl = root.querySelector<HTMLElement>('#kills')!;
  const msgEl = root.querySelector<HTMLDivElement>('#msg')!;
  const overEl = root.querySelector<HTMLDivElement>('#over')!;
  const overStatsEl = root.querySelector<HTMLParagraphElement>('#overstats')!;
  const retryBtn = root.querySelector<HTMLButtonElement>('#retry')!;
  const helpEl = root.querySelector<HTMLDivElement>('#help')!;
  helpEl.textContent = HELP_TEXT;

  let lastHp = -1;
  let lastMaxHp = -1;
  let lastWave = -1;
  let lastKills = -1;
  let msgHideAt: number | null = null;
  let pendingOver: { wave: number; kills: number; showAt: number } | null = null;

  function rebuildHearts(maxHp: number, hp: number): void {
    heartsEl.innerHTML = '';
    for (let i = 0; i < maxHp; i++) {
      const d = document.createElement('div');
      d.className = i < hp ? 'heart' : 'heart empty';
      heartsEl.appendChild(d);
    }
  }

  function showMsg(text: string): void {
    msgEl.textContent = text;
    msgEl.style.opacity = '1';
    msgHideAt = performance.now() + MSG_DURATION_MS;
  }

  function onRetryClick(): void {
    game.intents.restart = true;
  }
  retryBtn.addEventListener('click', onRetryClick);

  return {
    update() {
      const eid = game.playerEid;
      const hp = Health.hp[eid];
      const maxHp = Health.maxHp[eid];
      if (hp !== lastHp || maxHp !== lastMaxHp) {
        rebuildHearts(maxHp, hp);
        lastHp = hp;
        lastMaxHp = maxHp;
      }

      const stam = Player.stamina[eid];
      stamFillEl.style.width = `${stam * 100}%`;
      stamBarEl.classList.toggle('low', stam < 0.28);

      if (game.state.wave !== lastWave) {
        waveEl.textContent = String(game.state.wave);
        lastWave = game.state.wave;
      }
      if (game.state.kills !== lastKills) {
        killsEl.textContent = String(game.state.kills);
        lastKills = game.state.kills;
      }

      for (const ev of game.events.ofType('wave-started')) {
        showMsg(`WAVE ${ev.wave}`);
      }

      for (const ev of game.events.ofType('player-died')) {
        pendingOver = { wave: ev.wave, kills: ev.kills, showAt: performance.now() + OVER_DELAY_MS };
      }

      if (game.events.ofType('game-reset').length > 0) {
        pendingOver = null;
        overEl.style.display = 'none';
      }

      if (pendingOver && performance.now() >= pendingOver.showAt) {
        overStatsEl.textContent = `Wave ${pendingOver.wave} · ${pendingOver.kills} kills`;
        overEl.style.display = 'flex';
        pendingOver = null;
      }

      if (msgHideAt !== null && performance.now() >= msgHideAt) {
        msgEl.style.opacity = '0';
        msgHideAt = null;
      }
    },
    dispose() {
      retryBtn.removeEventListener('click', onRetryClick);
      root.innerHTML = '';
    },
  };
}
