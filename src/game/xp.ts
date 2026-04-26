import * as THREE from 'three';
import type { Player } from './player';
import type { EnemyKind } from './enemies';

interface Gem {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  value: number;
  bobOffset: number;
  isBig: boolean;
}

const SMALL_VALUE = 1;
const BIG_THRESHOLD = 5;

export class XpSystem {
  private gems: Gem[] = [];
  private mesh: THREE.InstancedMesh;
  private bigMesh: THREE.InstancedMesh;
  private maxGems = 800;

  level = 1;
  xp = 0;
  xpToNext = 4;
  totalXp = 0;
  pickupSfx?: () => void;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.OctahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4cc9f0,
      emissive: 0x4cc9f0,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxGems);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    const bigGeo = new THREE.OctahedronGeometry(0.36, 0);
    const bigMat = new THREE.MeshStandardMaterial({
      color: 0xb388ff,
      emissive: 0xb388ff,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true,
    });
    this.bigMesh = new THREE.InstancedMesh(bigGeo, bigMat, 80);
    this.bigMesh.frustumCulled = false;
    scene.add(this.bigMesh);

    // initialize all instances offscreen
    const m = new THREE.Matrix4();
    m.makeTranslation(0, -100, 0);
    for (let i = 0; i < this.maxGems; i++) this.mesh.setMatrixAt(i, m);
    for (let i = 0; i < 80; i++) this.bigMesh.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.bigMesh.instanceMatrix.needsUpdate = true;
  }

  spawnFromKill(pos: THREE.Vector3, kind: EnemyKind) {
    let value: number;
    if (kind === 'runner') value = 1;
    else if (kind === 'brute') value = 5;
    else value = 60;

    if (value >= BIG_THRESHOLD) {
      this.spawnGem(pos, value, true);
    } else {
      this.spawnGem(pos, value, false);
    }
  }

  private spawnGem(pos: THREE.Vector3, value: number, isBig: boolean) {
    let g = this.gems.find((x) => !x.active && x.isBig === isBig);
    if (!g) {
      g = { active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), value, bobOffset: Math.random() * Math.PI * 2, isBig };
      this.gems.push(g);
    }
    g.active = true;
    g.value = value;
    g.isBig = isBig;
    g.pos.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    // small pop
    const a = Math.random() * Math.PI * 2;
    g.vel.set(Math.cos(a) * 1.5, 3, Math.sin(a) * 1.5);
    g.bobOffset = Math.random() * Math.PI * 2;
  }

  addXp(amount: number, onLevelUp: () => void) {
    this.xp += amount;
    this.totalXp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      // mild curve: 4, 7, 10, 13, ... lvl 5 takes 16 XP, lvl 10 takes 31
      this.xpToNext = Math.floor(4 + (this.level - 1) * 3);
      onLevelUp();
    }
  }

  update(dt: number, time: number, player: Player, onLevelUp: () => void) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const sc = new THREE.Vector3(1, 1, 1);
    const offGrid = new THREE.Vector3(0, -100, 0);

    let smallIdx = 0;
    let bigIdx = 0;
    const magnetR = player.stats.magnetRadius;
    const pickR = 0.7;

    for (const g of this.gems) {
      if (!g.active) continue;

      // gravity + bounce
      g.vel.y -= 14 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.4) { g.pos.y = 0.4; g.vel.y *= -0.3; g.vel.x *= 0.6; g.vel.z *= 0.6; }

      // magnet
      const dx = player.position.x - g.pos.x;
      const dz = player.position.z - g.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < magnetR + 0.5) {
        const pull = 14;
        g.pos.x += (dx / (d || 1)) * pull * dt;
        g.pos.z += (dz / (d || 1)) * pull * dt;
      }

      // pickup
      if (d < pickR) {
        g.active = false;
        this.addXp(g.value, onLevelUp);
        if (this.pickupSfx) this.pickupSfx();
        continue;
      }

      // bobbing
      const bob = Math.sin(time * 4 + g.bobOffset) * 0.08;
      eul.set(time * 1.5 + g.bobOffset, time * 2 + g.bobOffset, 0);
      q.setFromEuler(eul);
      m.compose(new THREE.Vector3(g.pos.x, g.pos.y + bob, g.pos.z), q, sc);

      if (g.isBig) {
        if (bigIdx < 80) this.bigMesh.setMatrixAt(bigIdx++, m);
      } else {
        if (smallIdx < this.maxGems) this.mesh.setMatrixAt(smallIdx++, m);
      }
    }

    // hide unused instances
    m.makeTranslation(offGrid.x, offGrid.y, offGrid.z);
    for (let i = smallIdx; i < this.maxGems; i++) this.mesh.setMatrixAt(i, m);
    for (let i = bigIdx; i < 80; i++) this.bigMesh.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.bigMesh.instanceMatrix.needsUpdate = true;
  }
}
