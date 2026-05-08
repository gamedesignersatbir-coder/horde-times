import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';
import { AnimatedCharacter } from './animated-character';
import { assets } from '../engine/assets';
import type { CharacterAssetId } from '../engine/assets';

export type EnemyKind = 'runner' | 'brute' | 'boss';

export interface EnemyType {
  kind: EnemyKind;
  assetId: CharacterAssetId;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xpDrop: number;
  scale: number;
  meshHeight: number;
  attackStrikeFrame: number;
  attackTotalFrames: number;
  /** Distance from player center at which the enemy stops to wind up. */
  attackRange: number;
  /** Cooldown after a finished attack clip before another attack can start. */
  recoverTime: number;
}

export const ENEMY_TYPES: Record<EnemyKind, EnemyType> = {
  runner: {
    kind: 'runner', assetId: 'runner',
    maxHp: 20, speed: 4.5, damage: 8, radius: 0.45, xpDrop: 1,
    scale: 1.0, meshHeight: 1.4,
    attackStrikeFrame: 11, attackTotalFrames: 22,
    attackRange: 1.0, recoverTime: 0.25,
  },
  brute: {
    kind: 'brute', assetId: 'brute',
    maxHp: 80, speed: 2.0, damage: 18, radius: 0.75, xpDrop: 5,
    scale: 1.0, meshHeight: 1.8,
    attackStrikeFrame: 14, attackTotalFrames: 29,
    attackRange: 1.6, recoverTime: 0.5,
  },
  boss: {
    kind: 'boss', assetId: 'boss',
    maxHp: 600, speed: 2.5, damage: 30, radius: 1.4, xpDrop: 60,
    scale: 1.0, meshHeight: 2.4,
    attackStrikeFrame: 18, attackTotalFrames: 35,
    attackRange: 2.4, recoverTime: 0.6,
  },
};

type EnemyState = 'chase' | 'attacking' | 'recover' | 'dying';

interface Enemy {
  active: boolean;
  kind: EnemyKind;
  hp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hitFlashUntil: number;
  knockback: THREE.Vector3;
  state: EnemyState;
  recoverUntil: number;
  yaw: number;
}

const FLASH_WHITE = new THREE.Color(0xffffff);

interface EnemySlot {
  enemy: Enemy;
  char: AnimatedCharacter;
  /** Per-instance materials for hit-flash, gathered from the cloned mesh. */
  flashMats: { mat: THREE.MeshStandardMaterial; baseE: THREE.Color; baseI: number }[];
  /** Outermost wrapper Group from cloneFor — receives scale and position. */
  root: THREE.Group;
}

function buildSlot(kind: EnemyKind): EnemySlot {
  const type = ENEMY_TYPES[kind];
  const cloned = assets.cloneFor(type.assetId);
  const char = new AnimatedCharacter(cloned, {
    strikeFrame: type.attackStrikeFrame,
    attackTotalFrames: type.attackTotalFrames,
  });
  const root = char.group;
  root.scale.setScalar(type.scale);
  const flashMats: EnemySlot['flashMats'] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const collect = (m: THREE.Material) => {
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        flashMats.push({ mat: std, baseE: std.emissive.clone(), baseI: std.emissiveIntensity });
      }
    };
    if (Array.isArray(mesh.material)) mesh.material.forEach(collect);
    else collect(mesh.material);
  });
  return {
    enemy: {
      active: false,
      kind,
      hp: type.maxHp,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      hitFlashUntil: 0,
      knockback: new THREE.Vector3(),
      state: 'chase',
      recoverUntil: 0,
      yaw: 0,
    },
    char,
    flashMats,
    root,
  };
}

export class EnemyManager {
  readonly group: THREE.Group;
  private slots: Record<EnemyKind, EnemySlot[]> = { runner: [], brute: [], boss: [] };

  damageEvents: Array<{ pos: THREE.Vector3; amount: number; weapon: any }> = [];
  deathEvents: Array<{ pos: THREE.Vector3; kind: EnemyKind }> = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'enemies';
    scene.add(this.group);
  }

  spawn(kind: EnemyKind, pos: THREE.Vector3) {
    const type = ENEMY_TYPES[kind];
    let slot = this.slots[kind].find((s) => !s.enemy.active);
    if (!slot) {
      slot = buildSlot(kind);
      this.slots[kind].push(slot);
      this.group.add(slot.root);
    } else {
      slot.char.reset();
    }
    const e = slot.enemy;
    e.active = true;
    e.hp = type.maxHp;
    e.pos.copy(pos);
    e.vel.set(0, 0, 0);
    e.knockback.set(0, 0, 0);
    e.hitFlashUntil = 0;
    e.state = 'chase';
    e.recoverUntil = 0;
    e.yaw = 0;
    slot.root.position.copy(pos);
    slot.root.scale.setScalar(type.scale);
    slot.root.visible = true;
  }

  count(kind?: EnemyKind): number {
    if (kind) return this.slots[kind].filter((s) => s.enemy.active && s.enemy.state !== 'dying').length;
    let n = 0;
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      for (const s of this.slots[k]) if (s.enemy.active && s.enemy.state !== 'dying') n++;
    }
    return n;
  }

  /** Iterate all live (non-dying) enemies. */
  forEach(cb: (e: Enemy, root: THREE.Group, type: EnemyType) => void) {
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      const arr = this.slots[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s.enemy.active && s.enemy.state !== 'dying') cb(s.enemy, s.root, type);
      }
    }
  }

  /** Apply damage at a world position to all live enemies within radius. */
  damageInRadius(center: THREE.Vector3, radius: number, dmg: number, weapon: any, time: number, knockbackScale = 0.5): number {
    let kills = 0;
    const r2 = radius * radius;
    const emitNumber = dmg >= 1.5;
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      const arr = this.slots[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const e = s.enemy;
        if (!e.active || e.state === 'dying') continue;
        const dx = e.pos.x - center.x;
        const dz = e.pos.z - center.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        e.hp -= dmg;
        e.hitFlashUntil = time + 0.08;
        const d = Math.sqrt(d2) || 0.0001;
        const kb = (1 - Math.min(d / radius, 1)) * knockbackScale;
        e.knockback.x += (dx / d) * kb * 6;
        e.knockback.z += (dz / d) * kb * 6;
        if (emitNumber) {
          const headPos = e.pos.clone();
          headPos.y += type.meshHeight;
          this.damageEvents.push({ pos: headPos, amount: dmg, weapon });
        }
        if (e.hp <= 0) {
          this.killSlot(s, type);
          kills++;
        } else {
          s.char.playHit();
        }
      }
    }
    return kills;
  }

  damageEnemy(e: Enemy, _root: THREE.Group, type: EnemyType, dmg: number, weapon: any, time: number, knockbackDir: THREE.Vector3, knockbackAmt: number): boolean {
    const slot = this.slotOf(e);
    if (!slot) return false;
    e.hp -= dmg;
    e.hitFlashUntil = time + 0.08;
    e.knockback.x += knockbackDir.x * knockbackAmt;
    e.knockback.z += knockbackDir.z * knockbackAmt;
    const headPos = e.pos.clone();
    headPos.y += type.meshHeight;
    this.damageEvents.push({ pos: headPos, amount: dmg, weapon });
    if (e.hp <= 0) {
      this.killSlot(slot, type);
      return true;
    }
    slot.char.playHit();
    return false;
  }

  private slotOf(e: Enemy): EnemySlot | null {
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      for (const s of this.slots[k]) if (s.enemy === e) return s;
    }
    return null;
  }

  private killSlot(slot: EnemySlot, type: EnemyType) {
    const e = slot.enemy;
    e.state = 'dying';
    const dropPos = e.pos.clone();
    slot.char.playDeath(() => {
      e.active = false;
      slot.root.visible = false;
      this.deathEvents.push({ pos: dropPos, kind: type.kind });
    });
  }

  findNearest(pos: THREE.Vector3, maxDist: number): { enemy: Enemy; mesh: THREE.Group; type: EnemyType; dist: number } | null {
    let best: any = null;
    let bestD = maxDist;
    for (const k of ['boss', 'brute', 'runner'] as EnemyKind[]) {
      const arr = this.slots[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const e = s.enemy;
        if (!e.active || e.state === 'dying') continue;
        const dx = e.pos.x - pos.x;
        const dz = e.pos.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD) {
          bestD = d;
          best = { enemy: e, mesh: s.root, type, dist: d };
        }
      }
    }
    return best;
  }

  /** Tick all enemies: chase / windup / strike / recover, plus dying anim mixers. */
  update(dt: number, playerPos: THREE.Vector3, time: number, onPlayerHit: (dmg: number) => void) {
    const sep = 0.6;

    // --- chase / attack-state machine + per-instance mixer update ---
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      const arr = this.slots[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const e = s.enemy;
        if (!e.active) continue;

        // Always tick the mixer so death/hit anims play out even when state == dying.
        s.char.update(dt);

        if (e.state === 'dying') {
          // Keep the corpse on the ground; no movement, no AI.
          continue;
        }

        const dx = playerPos.x - e.pos.x;
        const dz = playerPos.z - e.pos.z;
        const d = Math.hypot(dx, dz) || 0.0001;

        // Always face the player so the windup reads.
        e.yaw = Math.atan2(dx, dz);

        const inRange = d < type.attackRange + 0.45; // + player radius

        if (e.state === 'attacking') {
          // Pinned during windup/strike/recover-anim. Once the attack clip ends
          // AnimatedCharacter returns to idle/run; we check that to leave the state.
          if (s.char.currentState() !== 'attack') {
            e.state = 'recover';
            e.recoverUntil = time + type.recoverTime;
          }
          e.vel.set(0, 0, 0);
        } else if (e.state === 'recover') {
          if (time >= e.recoverUntil) e.state = 'chase';
          e.vel.set(0, 0, 0);
        } else {
          // chase
          if (inRange) {
            // Telegraphed attack: stop, play Attack, deal damage on strike-frame
            // only if the player is still in range at that moment.
            e.state = 'attacking';
            e.vel.set(0, 0, 0);
            s.char.setMoving(false);
            s.char.playAttack(() => {
              const d2x = playerPos.x - e.pos.x;
              const d2z = playerPos.z - e.pos.z;
              const d2 = Math.hypot(d2x, d2z);
              if (d2 < type.attackRange + 0.55) onPlayerHit(type.damage);
            });
          } else {
            const speed = type.speed;
            e.vel.x = (dx / d) * speed;
            e.vel.z = (dz / d) * speed;
            s.char.setMoving(true);
          }
        }

        // apply velocity + knockback
        e.pos.x += e.vel.x * dt + e.knockback.x * dt;
        e.pos.z += e.vel.z * dt + e.knockback.z * dt;

        // decay knockback
        const decay = Math.exp(-6 * dt);
        e.knockback.multiplyScalar(decay);

        // clamp loosely to outer ring
        const r = Math.hypot(e.pos.x, e.pos.z);
        if (r > ARENA_RADIUS + 6) {
          e.pos.x *= (ARENA_RADIUS + 6) / r;
          e.pos.z *= (ARENA_RADIUS + 6) / r;
        }
      }
    }

    // --- separation pass (skip dying corpses) ---
    const all: { e: Enemy; type: EnemyType }[] = [];
    this.forEach((e, _r, type) => all.push({ e, type }));
    for (let i = 0; i < all.length; i++) {
      const a = all[i].e;
      const ar = all[i].type.radius;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j].e;
        const br = all[j].type.radius;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const minD = ar + br;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5 * sep;
          const px = (dx / d) * push;
          const pz = (dz / d) * push;
          a.pos.x -= px; a.pos.z -= pz;
          b.pos.x += px; b.pos.z += pz;
        }
      }
    }

    // --- sync mesh transform + hit flash + tick dying mixers' transform too ---
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      const arr = this.slots[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const e = s.enemy;
        if (!e.active) continue;

        const flashAmt = Math.max(0, (e.hitFlashUntil - time) / 0.08);
        for (const f of s.flashMats) {
          if (flashAmt > 0) {
            f.mat.emissive.copy(f.baseE).lerp(FLASH_WHITE, flashAmt);
            f.mat.emissiveIntensity = f.baseI + flashAmt * 1.6;
          } else {
            f.mat.emissive.copy(f.baseE);
            f.mat.emissiveIntensity = f.baseI;
          }
        }
        const punch = flashAmt > 0 ? 1 + 0.05 * flashAmt : 1;
        s.root.scale.setScalar(type.scale * punch);

        s.root.position.set(e.pos.x, 0, e.pos.z);
        s.char.setFacing(e.yaw);
      }
    }
  }
}

export type { Enemy };
