/**
 * World-space sword (buildSword() port). The visible blade tracks the physics tip
 * exactly — hand position, lift/reach stretch, and roll are pure functions of
 * (player pos, tip pos, tip velocity), no attachment to the arm pivots.
 */
import * as THREE from 'three';

const TIP_H = 0.75;
const SWORD_LEN = 2.45;

export interface SwordRenderState {
  playerX: number;
  playerZ: number;
  tipX: number;
  tipZ: number;
  tipVX: number;
  tipVZ: number;
  /** 0..1 ground-slam charge (Player.charge) — ramps the blade glow. */
  charge: number;
}

export interface SwordView {
  update(state: SwordRenderState, dt: number): void;
  /** One-shot bright flash — call when a 'slam-charged' event fires. */
  chargeReady(): void;
  dispose(): void;
}

/** Milliseconds the charge-ready flash stays bright. */
const READY_FLASH_MS = 180;

export function createSwordView(scene: THREE.Scene): SwordView {
  const steel = new THREE.MeshStandardMaterial({
    color: 0xd8dde8,
    roughness: 0.25,
    metalness: 0.9,
    emissive: 0x334,
    emissiveIntensity: 0.35,
  });
  const steelDark = new THREE.MeshStandardMaterial({
    color: 0x9aa3b5,
    roughness: 0.4,
    metalness: 0.85,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf5c452, metalness: 0.8, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 0.9 });

  const bladeGeo = new THREE.BoxGeometry(0.3, 0.1, 1.7);
  const fullerGeo = new THREE.BoxGeometry(0.1, 0.12, 1.5);
  const tipGeo = new THREE.BoxGeometry(0.3, 0.1, 0.5);
  const tip2Geo = new THREE.BoxGeometry(0.16, 0.09, 0.22);
  const guardGeo = new THREE.BoxGeometry(0.78, 0.14, 0.18);
  const gripGeo = new THREE.BoxGeometry(0.14, 0.14, 0.42);
  const pommelGeo = new THREE.BoxGeometry(0.2, 0.2, 0.14);

  const group = new THREE.Group();

  const blade = new THREE.Mesh(bladeGeo, steel);
  blade.position.z = 1.05;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(fullerGeo, steelDark);
  fuller.position.z = 1.0;

  const tipMesh = new THREE.Mesh(tipGeo, steel);
  tipMesh.position.z = 2.05;
  tipMesh.castShadow = true;

  const tip2 = new THREE.Mesh(tip2Geo, steel);
  tip2.position.z = 2.35;

  const guard = new THREE.Mesh(guardGeo, gold);
  guard.position.z = 0.2;
  guard.castShadow = true;

  const grip = new THREE.Mesh(gripGeo, wood);
  grip.position.z = -0.05;

  const pommel = new THREE.Mesh(pommelGeo, gold);
  pommel.position.z = -0.3;

  group.add(blade, fuller, tipMesh, tip2, guard, grip, pommel);
  scene.add(group);

  // Charge glow state. Base/charge/white are blended per-frame into steel's emissive;
  // the blend and the ready-pulse are cosmetic wall-clock animation layered on top of
  // the sim-driven `charge` value itself, same pattern as playerView's idle bob.
  const emissiveBase = steel.emissive.clone();
  const emissiveCharge = new THREE.Color(0xffdd66);
  const white = new THREE.Color(0xffffff);
  const scratchEmissive = new THREE.Color();
  let elapsedMs = 0;
  let readyFlashUntilMs = -Infinity;

  return {
    update(state, dt) {
      elapsedMs += dt * 1000;

      const toTipX = state.tipX - state.playerX;
      const toTipZ = state.tipZ - state.playerZ;
      const tipAng = Math.atan2(toTipX, toTipZ);
      const tipSpeed = Math.hypot(state.tipVX, state.tipVZ);
      const k = THREE.MathUtils.clamp(tipSpeed / 14, 0, 1);

      const handX = state.playerX + Math.sin(tipAng) * (0.5 + 0.4 * k);
      const handZ = state.playerZ + Math.cos(tipAng) * (0.5 + 0.4 * k);
      const handY = 1.3 - 0.15 * k;
      group.position.set(handX, handY, handZ);

      const lift = (1 - k) * 1.15;
      group.lookAt(state.tipX, TIP_H + lift, state.tipZ);

      const handDist = Math.hypot(state.tipX - handX, state.tipZ - handZ);
      group.scale.z = THREE.MathUtils.clamp(
        Math.hypot(handDist, lift + (handY - TIP_H)) / SWORD_LEN,
        0.55,
        1.5,
      );

      group.rotation.z =
        THREE.MathUtils.clamp(tipSpeed * 0.02, 0, 0.6) * (Math.sin(tipAng) > 0 ? 1 : -1);

      // Ground-slam charge glow: emissive ramps steel blue -> warm gold as charge
      // fills, a fast pulse kicks in once full ("ready"), and the one-shot flash from
      // chargeReady() briefly blows both past that toward white.
      const charge = THREE.MathUtils.clamp(state.charge, 0, 1);
      const ready = charge >= 1;
      const pulse = ready ? 0.5 + 0.5 * Math.sin(elapsedMs * 0.02) : 0;
      const flashK = readyFlashUntilMs > elapsedMs ? (readyFlashUntilMs - elapsedMs) / READY_FLASH_MS : 0;

      scratchEmissive.copy(emissiveBase).lerp(emissiveCharge, charge);
      if (flashK > 0) scratchEmissive.lerp(white, flashK);
      steel.emissive.copy(scratchEmissive);
      steel.emissiveIntensity = 0.35 + charge * 1.4 + pulse * 1.1 + flashK * 2.2;

      const swell = 1 + charge * 0.06 + pulse * 0.05 + flashK * 0.12;
      blade.scale.setScalar(swell);
      tipMesh.scale.setScalar(swell);
      tip2.scale.setScalar(swell);
    },
    chargeReady() {
      readyFlashUntilMs = elapsedMs + READY_FLASH_MS;
    },
    dispose() {
      scene.remove(group);
      for (const geo of [bladeGeo, fullerGeo, tipGeo, tip2Geo, guardGeo, gripGeo, pommelGeo])
        geo.dispose();
      for (const mat of [steel, steelDark, gold, wood]) mat.dispose();
    },
  };
}
