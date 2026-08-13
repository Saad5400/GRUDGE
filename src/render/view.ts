/**
 * Composition root for the render layer: wires the renderer/scene/camera and every
 * sub-view together into the GameView the rest of the app depends on. Read-only view
 * of ECS state — this module (and everything under src/render/) must never write a
 * component or GameState field, except reading (never writing) game.state.shake.
 */
import * as THREE from 'three';
import type { Game, GameView } from '../core/types';
import { Transform, Velocity, Health, Player, SwordTip } from '../components';
import { WALL_SLAM } from '../content/environment';
import { createLights } from './lights';
import { createArena } from './arena';
import { createPlayerView } from './playerView';
import { createSwordView } from './swordView';
import { createTrail } from './trail';
import { createEnemyView } from './enemyView';
import { createParticlePool } from './particles';
import { createShockwavePool } from './shockwave';
import { createCameraRig } from './cameraRig';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function createView(game: Game, container: HTMLElement): GameView {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a12);
  scene.fog = new THREE.Fog(0x0b0a12, 26, 46);

  function measure(): { width: number; height: number } {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    return { width, height };
  }

  const initial = measure();
  renderer.setSize(initial.width, initial.height);

  const cameraRig = createCameraRig(initial.width / Math.max(initial.height, 1));
  const lights = createLights(scene);
  const arena = createArena(scene);
  const playerView = createPlayerView(scene);
  const swordView = createSwordView(scene);
  const trail = createTrail(scene);
  const enemyView = createEnemyView(scene);
  const particles = createParticlePool(scene);
  const shockwave = createShockwavePool(scene);

  const ray = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const groundHit = new THREE.Vector3();

  function onResize(): void {
    const { width, height } = measure();
    renderer.setSize(width, height);
    cameraRig.resize(width / Math.max(height, 1));
  }
  window.addEventListener('resize', onResize);

  function spawnEventParticles(): void {
    // Reset first: drop any in-flight effects before spawning this frame's new ones.
    if (game.events.ofType('game-reset').length > 0) {
      particles.clear();
      enemyView.clear();
      trail.clear();
      shockwave.clear();
    }

    for (const e of game.events.ofType('sword-hit')) {
      particles.spawnBurst(e.x, e.y, e.z, e.big ? 0xc06a6a : 0x8fe07a, 8, 6);
    }
    for (const e of game.events.ofType('enemy-died')) {
      if (e.big) particles.spawnBurst(e.x, 0.7, e.z, 0x8a3535, 18, 8);
      else particles.spawnBurst(e.x, 0.7, e.z, 0x5fae4a, 12, 6);
    }
    for (const e of game.events.ofType('player-hurt')) {
      particles.spawnBurst(e.x, 1.2, e.z, 0xd43a3a, 10, 5);
    }
    if (game.events.ofType('player-healed').length > 0) {
      const eid = game.playerEid;
      particles.spawnBurst(Transform.x[eid], 1.5, Transform.z[eid], 0xd43a3a, 6, 3);
    }
    for (const e of game.events.ofType('parry')) {
      // Brighter/whiter and punchier than a normal sword-hit spark — reads as "clang".
      const kick = Math.min(1, e.tipSpeed / 20);
      particles.spawnBurst(e.x, 1.1, e.z, 0xffffff, 16 + Math.round(kick * 8), 10 + kick * 4);
    }

    // Ground-slam "ready" cue: a small warm sparkle at the tip plus the sword's own flash.
    if (game.events.ofType('slam-charged').length > 0) {
      const eid = game.playerEid;
      particles.spawnBurst(SwordTip.x[eid], 1.0, SwordTip.z[eid], 0xffe066, 6, 3);
      swordView.chargeReady();
    }

    // Slam release: expanding ground ring (pooled, see shockwave.ts) plus a chunky
    // debris kick at the epicentre — the screen shake/hitstop juice is sim-driven already.
    for (const e of game.events.ofType('slam')) {
      shockwave.spawn(e.x, e.z, e.radius, 0xffcf6b);
      particles.spawnBurst(e.x, 0.35, e.z, 0xffcf6b, 22, 11);
    }

    // Execution: a decisive kill, visually distinct from an ordinary enemy-died burst —
    // taller, mixed white/red, and bigger on a brute.
    for (const e of game.events.ofType('execution')) {
      const n = e.big ? 26 : 18;
      const pow = e.big ? 14 : 10;
      particles.spawnBurst(e.x, 1.3, e.z, 0xffffff, Math.round(n * 0.4), pow);
      particles.spawnBurst(e.x, 1.0, e.z, 0xd43a3a, n, pow);
    }

    // Wall slam: masonry dust, scaled by how hard the enemy hit the surface.
    for (const e of game.events.ofType('wall-slam')) {
      const kick = clamp01((e.impact - WALL_SLAM.minImpactSpeed) / 15);
      const count = Math.round((e.big ? 16 : 10) + kick * 10);
      const pow = (e.big ? 7 : 5) + kick * 6;
      particles.spawnBurst(e.x, 0.6, e.z, 0x8a7a63, count, pow);
    }
  }

  function render(_alpha: number, frameDt: number): void {
    spawnEventParticles();

    const eid = game.playerEid;
    const px = Transform.x[eid];
    const pz = Transform.z[eid];
    const face = Transform.rot[eid];
    const velX = Velocity.x[eid];
    const velZ = Velocity.z[eid];
    const faceVel = Player.faceVel[eid];
    const invuln = Health.invuln[eid];
    const tipX = SwordTip.x[eid];
    const tipZ = SwordTip.z[eid];
    const tipVX = SwordTip.vx[eid];
    const tipVZ = SwordTip.vz[eid];
    const tipSpeed = Math.hypot(tipVX, tipVZ);
    const charge = Player.charge[eid];

    playerView.update(
      { x: px, z: pz, face, faceVel, velX, velZ, tipX, tipZ, tipVX, tipVZ, invuln },
      frameDt,
    );
    swordView.update({ playerX: px, playerZ: pz, tipX, tipZ, tipVX, tipVZ, charge }, frameDt);
    trail.update(tipX, tipZ, px, pz, tipSpeed);
    enemyView.update(game.world, px, pz);

    particles.update(frameDt);
    shockwave.update(frameDt);
    arena.update(frameDt);
    cameraRig.update(px, pz, game.state.shake, frameDt);

    renderer.render(scene, cameraRig.camera);
  }

  function screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, cameraRig.camera);
    const hit = ray.ray.intersectPlane(groundPlane, groundHit);
    return hit ? { x: groundHit.x, z: groundHit.z } : null;
  }

  return {
    render,
    screenToGround,
    canvas: renderer.domElement,
    dispose() {
      window.removeEventListener('resize', onResize);
      arena.dispose();
      playerView.dispose();
      swordView.dispose();
      trail.dispose();
      enemyView.dispose();
      particles.dispose();
      shockwave.dispose();
      lights.dispose();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    },
  };
}
