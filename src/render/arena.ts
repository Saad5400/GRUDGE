/**
 * Static arena geometry: floor tiles, walls, pillars, and torch flames/lights.
 * Tile/pillar placement is driven by src/content/arena.ts (shared with sim collision).
 */
import * as THREE from 'three';
import { TILE_RANGE, PILLARS } from '../content/arena';

export interface Arena {
  /** Advance torch flicker. dt = real seconds since last frame (visual only). */
  update(dt: number): void;
  dispose(): void;
}

const TILE_COLORS = [0x2c2836, 0x322d3d, 0x282433, 0x35303f];

interface Torch {
  flame: THREE.Mesh;
  light: THREE.PointLight;
  seed: number;
}

export function createArena(scene: THREE.Scene): Arena {
  // Walls sit at the literal ±19.8 the reference demo used — that offset isn't part of
  // the shared ARENA_HALF/TILE_RANGE content data, so it stays a literal here too.
  const added: THREE.Object3D[] = [];
  const pointLights: THREE.PointLight[] = [];

  const tileGeo = new THREE.BoxGeometry(2, 0.4, 2);
  const tileMats = TILE_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }),
  );
  for (let x = -TILE_RANGE; x <= TILE_RANGE; x++) {
    for (let z = -TILE_RANGE; z <= TILE_RANGE; z++) {
      const mat = tileMats[Math.abs(x * 7 + z * 13) % 4];
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(x * 2, -0.2 + ((x * 3 + z * 5) % 3) * 0.02, z * 2);
      tile.receiveShadow = true;
      scene.add(tile);
      added.push(tile);
    }
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f1b29, roughness: 0.9 });
  const wallGeo = new THREE.BoxGeometry(40, 4, 2);
  const wallDefs: ReadonlyArray<readonly [number, number, number]> = [
    [0, -19.8, 0],
    [0, 19.8, 0],
    [-19.8, 0, 1],
    [19.8, 0, 1],
  ];
  for (const [x, z, rot] of wallDefs) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(x, 1.8, z);
    if (rot) wall.rotation.y = Math.PI / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    added.push(wall);
  }

  const pillarGeo = new THREE.BoxGeometry(1.6, 4.4, 1.6);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x262133, roughness: 0.85 });
  const flameGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const torches: Torch[] = [];

  for (const p of PILLARS) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(p.x, 2.2, p.z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);
    added.push(pillar);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(p.x, 4.9, p.z);
    scene.add(flame);
    added.push(flame);

    const light = new THREE.PointLight(0xff9a3c, 30, 14, 1.8);
    light.position.set(p.x, 5.2, p.z);
    scene.add(light);
    pointLights.push(light);

    torches.push({ flame, light, seed: Math.random() * 9 });
  }

  let elapsed = 0;

  return {
    update(dt) {
      elapsed += dt;
      for (const t of torches) {
        t.light.intensity =
          26 + Math.sin(elapsed * 11 + t.seed) * 5 + Math.sin(elapsed * 23 + t.seed * 2) * 3;
        t.flame.scale.setScalar(1 + Math.sin(elapsed * 13 + t.seed) * 0.2);
      }
    },
    dispose() {
      for (const obj of added) scene.remove(obj);
      for (const light of pointLights) scene.remove(light);
      tileGeo.dispose();
      for (const mat of tileMats) mat.dispose();
      wallGeo.dispose();
      wallMat.dispose();
      pillarGeo.dispose();
      pillarMat.dispose();
      flameGeo.dispose();
      flameMat.dispose();
    },
  };
}
