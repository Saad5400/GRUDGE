/**
 * Arena layout data — shared by sim (collision) and render (meshes).
 * Data only; no logic, no imports.
 */

/** Half-size of the playable square (player/enemy positions clamp to ±ARENA_HALF). */
export const ARENA_HALF = 17;

/** Floor tile grid: tiles at (x*2, z*2) for x,z in [-TILE_RANGE, TILE_RANGE]. */
export const TILE_RANGE = 9;

export interface PillarDef {
  x: number;
  z: number;
  /** Collision radius. */
  r: number;
}

/** Corner pillars with torches; solid circle colliders. */
export const PILLARS: readonly PillarDef[] = [
  { x: -10, z: -10, r: 1.35 },
  { x: 10, z: -10, r: 1.35 },
  { x: -10, z: 10, r: 1.35 },
  { x: 10, z: 10, r: 1.35 },
];
