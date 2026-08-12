/**
 * The blocky knight mesh + arm-pivot pose math (buildPlayer() port).
 * Pure view: takes plain numbers read from ECS state, drives a Three.js group.
 */
import * as THREE from 'three';

export interface PlayerRenderState {
  x: number;
  z: number;
  /** Facing angle, atan2(x,z) convention. */
  face: number;
  faceVel: number;
  velX: number;
  velZ: number;
  tipX: number;
  tipZ: number;
  tipVX: number;
  tipVZ: number;
  /** Seconds of invulnerability remaining (0 = none). */
  invuln: number;
}

export interface PlayerView {
  update(state: PlayerRenderState, dt: number): void;
  dispose(): void;
}

function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function createPlayerView(scene: THREE.Scene): PlayerView {
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const tunic = new THREE.MeshStandardMaterial({ color: 0x3f6fb5, roughness: 0.7 });
  const legsMat = new THREE.MeshStandardMaterial({ color: 0x2b2b38, roughness: 0.8 });

  const bodyGeo = new THREE.BoxGeometry(0.8, 1, 0.5);
  const headGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const legsGeo = new THREE.BoxGeometry(0.72, 0.6, 0.44);
  const armGeo = new THREE.BoxGeometry(0.26, 0.7, 0.26);

  const group = new THREE.Group();

  const body = new THREE.Mesh(bodyGeo, tunic);
  body.position.y = 1.1;
  body.castShadow = true;

  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.95;
  head.castShadow = true;

  const legs = new THREE.Mesh(legsGeo, legsMat);
  legs.position.y = 0.42;

  group.add(body, head, legs);

  const pivot = new THREE.Group();
  pivot.position.set(0.5, 1.55, 0);
  pivot.rotation.order = 'YXZ';
  group.add(pivot);
  const arm = new THREE.Mesh(armGeo, skin);
  arm.position.y = -0.3;
  arm.castShadow = true;
  pivot.add(arm);

  const pivotL = new THREE.Group();
  pivotL.position.set(-0.5, 1.55, 0);
  pivotL.rotation.order = 'YXZ';
  group.add(pivotL);
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.y = -0.3;
  armL.castShadow = true;
  pivotL.add(armL);

  scene.add(group);

  // Render-local clock (ms) drives the idle bob and the invuln flicker window,
  // matching the demo's performance.now()-based cadence without touching sim time.
  let elapsedMs = 0;

  return {
    update(state, dt) {
      elapsedMs += dt * 1000;

      const toTipX = state.tipX - state.x;
      const toTipZ = state.tipZ - state.z;
      const tipAng = Math.atan2(toTipX, toTipZ);
      const rel = wrapAngle(tipAng - state.face);
      const tipSpeed = Math.hypot(state.tipVX, state.tipVZ);
      const k = THREE.MathUtils.clamp(tipSpeed / 14, 0, 1);

      pivot.rotation.set(-0.5 - 1.0 * k, rel, 0);
      pivotL.rotation.set(-0.35 - 0.9 * k, rel * 0.85, 0.3 - 0.2 * k);

      const spd = Math.hypot(state.velX, state.velZ);
      const bob = spd > 1 ? Math.sin(elapsedMs * 0.014) * 0.06 : 0;
      group.position.set(state.x, bob, state.z);
      group.rotation.y = state.face;

      group.visible = !(
        state.invuln > 0 &&
        Math.floor(elapsedMs / 80) % 2 === 0 &&
        state.invuln > 0.25
      );

      const fwdX = Math.sin(state.face);
      const fwdZ = Math.cos(state.face);
      const rightX = fwdZ;
      const rightZ = -fwdX;
      group.rotation.x = THREE.MathUtils.clamp(
        (state.velX * fwdX + state.velZ * fwdZ) * 0.016,
        -0.2,
        0.2,
      );
      group.rotation.z = THREE.MathUtils.clamp(
        -(state.velX * rightX + state.velZ * rightZ) * 0.014 - state.faceVel * 0.03,
        -0.25,
        0.25,
      );
    },
    dispose() {
      scene.remove(group);
      bodyGeo.dispose();
      headGeo.dispose();
      legsGeo.dispose();
      armGeo.dispose();
      skin.dispose();
      tunic.dispose();
      legsMat.dispose();
    },
  };
}
