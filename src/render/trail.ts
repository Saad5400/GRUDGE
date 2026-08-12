/**
 * Sword trail: a physics-driven ribbon following the actual blade tip, ported
 * from the demo's TRAIL_N=14 additive-blended BufferGeometry ribbon.
 */
import * as THREE from 'three';

const TRAIL_N = 14;
const TIP_H = 0.75;
const BASE_Y = 1.5;

export interface Trail {
  /** tipX/tipZ = blade tip world pos, playerX/playerZ = knight pos, tipSpeed = |tip velocity|. */
  update(tipX: number, tipZ: number, playerX: number, playerZ: number, tipSpeed: number): void;
  /** Drop all recorded points immediately (e.g. on game-reset) so no stale ribbon flashes. */
  clear(): void;
  dispose(): void;
}

interface TrailPoint {
  tipX: number;
  tipZ: number;
  baseX: number;
  baseZ: number;
}

export function createTrail(scene: THREE.Scene): Trail {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TRAIL_N * 2 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];
  for (let i = 0; i < TRAIL_N - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    color: 0xcfe0ff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const points: TrailPoint[] = [];

  return {
    update(tipX, tipZ, playerX, playerZ, tipSpeed) {
      if (tipSpeed > 6) {
        points.push({ tipX, tipZ, baseX: playerX, baseZ: playerZ });
        if (points.length > TRAIL_N) points.shift();
      } else {
        points.length = 0;
      }

      mesh.visible = points.length > 2;
      if (mesh.visible) {
        for (let i = 0; i < TRAIL_N; i++) {
          const p = points[Math.min(i, points.length - 1)];
          positions.set([p.tipX, TIP_H, p.tipZ, p.baseX, BASE_Y, p.baseZ], i * 6);
        }
        geometry.attributes.position.needsUpdate = true;
        material.opacity = Math.min(0.55, (tipSpeed - 6) * 0.04);
      }
    },
    clear() {
      points.length = 0;
      mesh.visible = false;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
