/**
 * Camera follow + shake. Shake ENERGY is sim-owned (game.state.shake decays sim-side);
 * this module only reads it each frame to jitter the camera position — it never writes it.
 */
import * as THREE from 'three';

const CAM_OFF = new THREE.Vector3(0, 15.5, 9.5);

export interface CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** shake = game.state.shake, read-only. dt = real seconds this frame. */
  update(playerX: number, playerZ: number, shake: number, dt: number): void;
  resize(aspect: number): void;
}

export function createCameraRig(aspect: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(42, aspect, 1, 100);
  camera.position.copy(CAM_OFF);
  camera.lookAt(0, 0, 0);

  const target = new THREE.Vector3();
  const look = new THREE.Vector3();

  return {
    camera,
    update(playerX, playerZ, shake, dt) {
      target.set(playerX, 0, playerZ).add(CAM_OFF);
      camera.position.lerp(target, 1 - Math.exp(-6 * dt));

      const s = shake * shake * 0.5;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;

      look.set(playerX, 1, playerZ);
      camera.lookAt(look);
    },
    resize(nextAspect) {
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
    },
  };
}
