/**
 * Shared contracts between simulation (headless) and presentation (render/ui/audio).
 * The sim exposes `Game`; presentation reads ECS state + events and writes `Intents`.
 */
import type { IWorld } from 'bitecs';
import type { EventBus } from './events';
import type { Rng } from './rng';

/**
 * Unified input intents. Mouse, touch, and gamepad all reduce to this —
 * the sim never knows which device produced them.
 */
export interface Intents {
  /** World-space aim point on the ground plane (the sword tip's spring target). */
  aimX: number;
  aimZ: number;
  /** False until the first real pointer input arrives. */
  aimActive: boolean;
  /** Plant feet: stand ground, no body chase (right mouse / plant button). */
  planted: boolean;
  /** One-shot restart request (game-over screen). Sim consumes and clears it. */
  restart: boolean;
}

export function createIntents(): Intents {
  return { aimX: 0, aimZ: 4, aimActive: false, planted: false, restart: false };
}

/** Singleton game state (not per-entity, so kept outside ECS stores). */
export interface GameState {
  wave: number;
  kills: number;
  /** Enemies currently alive. */
  alive: number;
  /** Mid-wave spawn trickle still in progress. */
  spawning: boolean;
  dead: boolean;
  /** Camera shake energy 0..1. Sim writes, render consumes/decays. */
  shake: number;
  /** Hit-stop seconds remaining. Sim decrements; while >0 sim substeps run slowed. */
  hitstop: number;
  /** Total sim time in seconds (sum of fixed steps). */
  time: number;
}

/**
 * Presentation-side contract implemented by src/render/view.ts.
 * (Type-only here; core never imports Three.js at runtime.)
 */
export interface GameView {
  /** Draw the current ECS state. alpha = interpolation fraction, frameDt = real seconds. */
  render(alpha: number, frameDt: number): void;
  /** Unproject a client-space point onto the ground plane (y=0). Null if no hit. */
  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null;
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

/** The headless game simulation. Owns the ECS world; never touches DOM/Three/audio. */
export interface Game {
  world: IWorld;
  playerEid: number;
  events: EventBus;
  intents: Intents;
  state: GameState;
  rng: Rng;
  /** Advance exactly one fixed tick (SIM_DT). Reads intents, emits events. */
  step(): void;
  /** Full restart with a fresh (or given) seed. Emits 'game-reset'. */
  reset(seed?: number): void;
}
