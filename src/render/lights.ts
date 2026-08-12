/**
 * Global scene lighting: ambient fill + directional "moon" key light with shadows.
 * Torch point lights live in arena.ts (they're tied to pillar placement/flicker).
 */
import * as THREE from 'three';

export interface Lights {
  dispose(): void;
}

export function createLights(scene: THREE.Scene): Lights {
  const ambient = new THREE.AmbientLight(0x3a3f5c, 1.1);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0x8ea0d8, 1.0);
  moon.position.set(-8, 18, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -22;
  moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 22;
  moon.shadow.camera.bottom = -22;
  scene.add(moon);

  return {
    dispose() {
      scene.remove(ambient);
      scene.remove(moon);
    },
  };
}
