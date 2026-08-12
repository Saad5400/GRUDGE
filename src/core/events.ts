/**
 * Frame-scoped typed event bus.
 * Sim systems EMIT events; render/audio/UI READ them after each frame; the main
 * loop calls clear() once all readers have consumed. Events are the only channel
 * from sim → presentation besides raw ECS component state.
 */

export type GameEvent =
  /** Blade connected with an enemy. killed=true when the hit was lethal. */
  | {
      type: 'sword-hit';
      x: number;
      y: number;
      z: number;
      big: boolean;
      killed: boolean;
      tipSpeed: number;
    }
  | { type: 'enemy-died'; x: number; z: number; big: boolean }
  | { type: 'enemy-spawned'; eid: number; big: boolean }
  | { type: 'player-hurt'; x: number; z: number; hp: number }
  | { type: 'player-healed'; hp: number }
  | { type: 'player-died'; wave: number; kills: number }
  | { type: 'wave-started'; wave: number }
  /** Blade passed the whoosh speed threshold this tick. */
  | { type: 'whoosh'; tipSpeed: number }
  /** An enemy began a telegraphed attack windup (audio/visual cue). */
  | { type: 'enemy-telegraph'; eid: number; x: number; z: number; big: boolean }
  /** Windup finished; the enemy committed to its lunge. */
  | { type: 'enemy-lunge'; eid: number; x: number; z: number }
  /** Planted blade met a winding-up enemy: attack cancelled, enemy staggered. */
  | { type: 'parry'; eid: number; x: number; z: number; tipSpeed: number }
  /** Kill streak went up or expired. */
  | { type: 'streak-changed'; streak: number; best: number }
  | { type: 'game-reset' };

export type GameEventType = GameEvent['type'];

export class EventBus {
  /** Events emitted since last clear(). Readers iterate; only the main loop clears. */
  readonly events: GameEvent[] = [];

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  /** All events of one type this frame. */
  ofType<T extends GameEventType>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
  }

  clear(): void {
    this.events.length = 0;
  }
}
