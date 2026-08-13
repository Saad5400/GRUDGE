/**
 * Pooled expanding ground-ring effect for the slam shockwave release. Same
 * pre-allocate-and-reuse approach as particles.ts: gameplay never allocates a
 * mesh per event — a handful of rings is more than this ever needs concurrently
 * since only one 'slam' fires per release.
 */
import * as THREE from 'three';

const MAX_RINGS = 4;
const RING_LIFE = 0.45;

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  targetRadius: number;
  life: number;
  active: boolean;
}

export interface ShockwavePool {
  /** Expanding ring centred at (x,z) on the ground, growing to `radius`. */
  spawn(x: number, z: number, radius: number, color?: number): void;
  update(dt: number): void;
  /** Deactivate every ring immediately (e.g. on game-reset). */
  clear(): void;
  dispose(): void;
}

export function createShockwavePool(scene: THREE.Scene): ShockwavePool {
  // Unit ring (thin annulus); world size comes entirely from mesh.scale so one
  // geometry serves every radius.
  const geometry = new THREE.RingGeometry(0.82, 1, 48);
  const pool: Ring[] = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffcf6b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, material, targetRadius: 1, life: 0, active: false });
  }
  let cursor = 0;

  function takeSlot(): Ring {
    for (let tries = 0; tries < MAX_RINGS; tries++) {
      const idx = (cursor + tries) % MAX_RINGS;
      if (!pool[idx].active) {
        cursor = (idx + 1) % MAX_RINGS;
        return pool[idx];
      }
    }
    // Pool exhausted: steal the next slot round-robin rather than grow.
    const idx = cursor;
    cursor = (cursor + 1) % MAX_RINGS;
    return pool[idx];
  }

  return {
    spawn(x, z, radius, color = 0xffcf6b) {
      const ring = takeSlot();
      ring.active = true;
      ring.mesh.visible = true;
      ring.mesh.position.set(x, 0.06, z);
      ring.mesh.scale.set(0.01, 0.01, 1);
      ring.targetRadius = Math.max(radius, 0.1);
      ring.life = RING_LIFE;
      ring.material.color.setHex(color);
      ring.material.opacity = 0.9;
    },
    update(dt) {
      for (const ring of pool) {
        if (!ring.active) continue;
        ring.life -= dt;
        const t = 1 - Math.max(ring.life, 0) / RING_LIFE; // 0 -> 1 over the ring's life
        const eased = 1 - (1 - t) * (1 - t); // ease-out: fast expand, slow finish
        const r = Math.max(eased * ring.targetRadius, 0.01);
        ring.mesh.scale.set(r, r, 1);
        ring.material.opacity = 0.9 * (1 - t);
        if (ring.life <= 0) {
          ring.active = false;
          ring.mesh.visible = false;
        }
      }
    },
    clear() {
      for (const ring of pool) {
        ring.active = false;
        ring.mesh.visible = false;
      }
    },
    dispose() {
      for (const ring of pool) {
        scene.remove(ring.mesh);
        ring.material.dispose();
      }
      geometry.dispose();
    },
  };
}
