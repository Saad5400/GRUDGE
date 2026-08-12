/**
 * Composition root for the render layer: wires the renderer/scene/camera and every
 * sub-view together into the GameView the rest of the app depends on. Read-only view
 * of ECS state — this module (and everything under src/render/) must never write a
 * component or GameState field, except reading (never writing) game.state.shake.
 */
import * as THREE from 'three';
import type { Game, GameView } from '../core/types';
import { Transform, Velocity, Health, Player, SwordTip } from '../components';
import { createLights } from './lights';
import { createArena } from './arena';
import { createPlayerView } from './playerView';
import { createSwordView } from './swordView';
import { createTrail } from './trail';
import { createEnemyView } from './enemyView';
import { createParticlePool } from './particles';
import { createCameraRig } from './cameraRig';

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

    playerView.update(
      { x: px, z: pz, face, faceVel, velX, velZ, tipX, tipZ, tipVX, tipVZ, invuln },
      frameDt,
    );
    swordView.update({ playerX: px, playerZ: pz, tipX, tipZ, tipVX, tipVZ });
    trail.update(tipX, tipZ, px, pz, tipSpeed);
    enemyView.update(game.world, px, pz);

    particles.update(frameDt);
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
      lights.dispose();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    },
  };
}
