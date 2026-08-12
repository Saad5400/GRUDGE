/**
 * Enemy meshes (makeSlime() port). One mesh group per living enemy entity, created/
 * removed via bitECS enter/exit queries on Enemy. Geometry and non-flashing materials
 * are shared per kind; only the body material is cloned per instance because the hit
 * flash needs to mutate a single enemy's color without touching its neighbors.
 */
import * as THREE from 'three';
import { defineQuery, enterQuery, exitQuery } from 'bitecs';
import type { IWorld } from 'bitecs';
import { Transform, Velocity, Enemy, ENEMY_KIND, ATTACK_STATE } from '../components';
import { TELEGRAPH } from '../content/ai';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface EnemyView {
  update(world: IWorld, playerX: number, playerZ: number): void;
  /** Force-drop every tracked mesh immediately (game-reset; also guards eid reuse races). */
  clear(): void;
  dispose(): void;
}

interface KindAssets {
  bodyGeo: THREE.BoxGeometry;
  innerGeo: THREE.BoxGeometry;
  eyeGeo: THREE.BoxGeometry;
  innerMat: THREE.MeshStandardMaterial;
  bodyColor: number;
  bodyRoughness: number;
  scale: number;
}

interface EnemyRecord {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  big: boolean;
}

function buildKindAssets(big: boolean): KindAssets {
  const s = big ? 1.7 : 1;
  const innerMat = big
    ? new THREE.MeshStandardMaterial({ color: 0x5c2020 })
    : new THREE.MeshStandardMaterial({ color: 0x3d7a30, roughness: 0.6 });
  return {
    bodyGeo: new THREE.BoxGeometry(0.9 * s, 0.8 * s, 0.9 * s),
    innerGeo: new THREE.BoxGeometry(0.5 * s, 0.45 * s, 0.5 * s),
    eyeGeo: new THREE.BoxGeometry(0.12 * s, 0.14 * s, 0.05),
    innerMat,
    bodyColor: big ? 0x8a3535 : 0x5fae4a,
    bodyRoughness: big ? 0.7 : 0.5,
    scale: s,
  };
}

export function createEnemyView(scene: THREE.Scene): EnemyView {
  const query = defineQuery([Enemy]);
  const onEnter = enterQuery(query);
  const onExit = exitQuery(query);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const assetsByKind: [KindAssets, KindAssets] = [buildKindAssets(false), buildKindAssets(true)];

  const records = new Map<number, EnemyRecord>();
  const white = new THREE.Color(0xffffff);
  const telegraphRed = new THREE.Color(0xff2b12);
  const scratchColor = new THREE.Color();

  function disposeRecord(rec: EnemyRecord): void {
    scene.remove(rec.group);
    rec.bodyMat.dispose();
  }

  function clearAll(): void {
    for (const rec of records.values()) disposeRecord(rec);
    records.clear();
  }

  function addMesh(eid: number): void {
    if (records.has(eid)) return;
    const kind = Enemy.kind[eid] === ENEMY_KIND.brute ? 1 : 0;
    const big = kind === 1;
    const a = assetsByKind[kind];
    const s = a.scale;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: a.bodyColor,
      roughness: a.bodyRoughness,
    });
    const body = new THREE.Mesh(a.bodyGeo, bodyMat);
    body.position.y = 0.4 * s;
    body.castShadow = true;

    const inner = new THREE.Mesh(a.innerGeo, a.innerMat);
    inner.position.y = 0.38 * s;

    const e1 = new THREE.Mesh(a.eyeGeo, eyeMat);
    e1.position.set(-0.18 * s, 0.5 * s, 0.46 * s);
    const e2 = new THREE.Mesh(a.eyeGeo, eyeMat);
    e2.position.set(0.18 * s, 0.5 * s, 0.46 * s);

    const group = new THREE.Group();
    group.add(body, inner, e1, e2);
    scene.add(group);

    records.set(eid, { group, bodyMat, baseColor: bodyMat.color.clone(), big });
  }

  function removeMesh(eid: number): void {
    const rec = records.get(eid);
    if (!rec) return;
    disposeRecord(rec);
    records.delete(eid);
  }

  return {
    update(world, playerX, playerZ) {
      for (const eid of onExit(world)) removeMesh(eid);
      for (const eid of onEnter(world)) addMesh(eid);

      for (const eid of query(world)) {
        const rec = records.get(eid);
        if (!rec) continue;

        const x = Transform.x[eid];
        const y = Transform.y[eid];
        const z = Transform.z[eid];
        rec.group.position.set(x, y, z);

        const vy = Velocity.y[eid];
        const hopT = Enemy.hopT[eid];
        const airborne = y > 0;
        const landing = !airborne && vy === 0 && hopT < 0.15 && !rec.big;
        const sq = airborne ? 1.12 : landing ? 0.82 : 1;

        // Telegraph coil/stretch: idle/recover leave scale untouched. Driven off
        // Enemy.attackT (sim time), never wall-clock, so it stays correct under hitstop.
        const attackState = Enemy.attackState[eid];
        const attackT = Enemy.attackT[eid];
        let telegraphX = 1;
        let telegraphY = 1;
        let telegraphZ = 1;
        let tintAmt = 0;
        if (attackState === ATTACK_STATE.windup) {
          const progress = clamp01(1 - attackT / TELEGRAPH.windupTime);
          // Fast pulse riding on top of the linear ramp — reads as a tensing heartbeat.
          const pulse = 0.5 + 0.5 * Math.sin(attackT * 26);
          const coil = progress * (0.7 + 0.3 * pulse);
          telegraphY = 1 - coil * 0.22;
          telegraphX = 1 + coil * 0.12;
          telegraphZ = 1 + coil * 0.12;
          tintAmt = clamp01(progress * (0.55 + 0.35 * pulse));
        } else if (attackState === ATTACK_STATE.strike) {
          const progress = clamp01(1 - attackT / TELEGRAPH.strikeTime);
          const stretch = 1 - progress; // 1 at strike start, decays to 0
          // Local +z faces the lunge target (group is rotated to face it below).
          telegraphZ = 1 + stretch * 0.35;
          telegraphX = 1 - stretch * 0.15;
          telegraphY = 1 - stretch * 0.05;
        }

        const invSqrtSq = 1 / Math.sqrt(sq);
        rec.group.scale.set(telegraphX * invSqrtSq, telegraphY * sq, telegraphZ * invSqrtSq);

        const toPX = playerX - x;
        const toPZ = playerZ - z;
        if (Math.hypot(toPX, toPZ) > 0.01) rec.group.rotation.y = Math.atan2(toPX, toPZ);

        const flashAmt = Enemy.flash[eid] > 0 ? 0.85 : 0;
        scratchColor.copy(rec.baseColor);
        if (tintAmt > 0) scratchColor.lerp(telegraphRed, tintAmt);
        if (flashAmt > 0) scratchColor.lerp(white, flashAmt);
        rec.bodyMat.color.copy(scratchColor);
      }
    },
    clear() {
      clearAll();
    },
    dispose() {
      clearAll();
      for (const a of assetsByKind) {
        a.bodyGeo.dispose();
        a.innerGeo.dispose();
        a.eyeGeo.dispose();
        a.innerMat.dispose();
      }
      eyeMat.dispose();
    },
  };
}
