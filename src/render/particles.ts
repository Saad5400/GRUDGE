/**
 * Pooled particle burst effects (impact/death/hurt/heal). Ported from the demo's
 * burst()/parts loop, but pre-allocated so gameplay never allocates a mesh per hit.
 * Math.random() is fine here — purely cosmetic, never read back into sim state.
 */
import * as THREE from 'three';

const MAX_PARTICLES = 200;
const GRAVITY = 18;
const GROUND_BOUNCE = -0.4;
const GROUND_FRICTION = 0.7;

interface Particle {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  active: boolean;
}

export interface ParticlePool {
  /** Spawn `count` cubes at (x,y,z) with the given color; pow scales launch velocity. */
  spawnBurst(x: number, y: number, z: number, color: number, count: number, pow: number): void;
  update(dt: number): void;
  /** Deactivate every particle immediately (e.g. on game-reset). */
  clear(): void;
  dispose(): void;
}

export function createParticlePool(scene: THREE.Scene): ParticlePool {
  const geometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const pool: Particle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, material, vel: new THREE.Vector3(), life: 0, active: false });
  }
  let cursor = 0;

  function takeSlot(): Particle {
    for (let tries = 0; tries < MAX_PARTICLES; tries++) {
      const idx = (cursor + tries) % MAX_PARTICLES;
      if (!pool[idx].active) {
        cursor = (idx + 1) % MAX_PARTICLES;
        return pool[idx];
      }
    }
    // Pool exhausted: steal the next slot round-robin (oldest-ish) rather than grow.
    const idx = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;
    return pool[idx];
  }

  return {
    spawnBurst(x, y, z, color, count, pow) {
      for (let n = 0; n < count; n++) {
        const p = takeSlot();
        p.active = true;
        p.material.color.setHex(color);
        p.mesh.position.set(x, y, z);
        p.mesh.visible = true;
        p.vel.set(
          (Math.random() - 0.5) * pow,
          Math.random() * pow * 0.8 + 2,
          (Math.random() - 0.5) * pow,
        );
        p.life = 0.6 + Math.random() * 0.4;
        p.mesh.scale.setScalar(p.life * 1.6);
      }
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        p.vel.y -= GRAVITY * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < 0) {
          p.mesh.position.y = 0;
          p.vel.y *= GROUND_BOUNCE;
          p.vel.x *= GROUND_FRICTION;
          p.vel.z *= GROUND_FRICTION;
        }
        p.mesh.scale.setScalar(Math.max(p.life, 0.01) * 1.6);
        if (p.life <= 0) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    },
    clear() {
      for (const p of pool) {
        p.active = false;
        p.mesh.visible = false;
      }
    },
    dispose() {
      for (const p of pool) {
        scene.remove(p.mesh);
        p.material.dispose();
      }
      geometry.dispose();
    },
  };
}
