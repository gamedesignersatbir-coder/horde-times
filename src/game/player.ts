import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';
import type { PlayerStats } from './types';
import type { CharacterDef } from './characters';
import type { Torch } from './torch';
import { AnimatedCharacter } from './animated-character';
import { assets } from '../engine/assets';

const TURN_LERP = 14;

/**
 * Composes an AnimatedCharacter (GLB-backed) with the existing player
 * physics, stats, i-frames, regen, and torch attachment.
 *
 * Phase A: locomotion only — Idle ↔ Run via setMoving. Attack/Hit/Death
 * are wired in Phase B.
 */
export class Player {
  readonly mesh: THREE.Group;             // group root (matches old API)
  readonly char: AnimatedCharacter;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly stats: PlayerStats;
  readonly radius = 0.45;
  readonly height: number;
  facing = 0;
  private targetFacing = 0;
  iframeUntil = 0;
  alive = true;
  outOfCombatFor = 0;
  private leanZ = 0;
  private torch: Torch | null = null;
  private wasInIframe = false;

  constructor(character: CharacterDef) {
    if (!character.assetId) {
      throw new Error(`Character ${character.id} has no assetId — GLB conversion incomplete.`);
    }
    const cloned = assets.cloneFor(character.assetId);
    this.char = new AnimatedCharacter(cloned);
    this.mesh = this.char.group;
    this.position = this.mesh.position;
    this.position.set(0, 0, 0);
    this.height = character.height ?? 1.4;

    this.stats = {
      maxHp: character.stats.maxHp,
      hp: character.stats.maxHp,
      moveSpeed: character.stats.moveSpeed,
      magnetRadius: character.stats.magnetRadius,
      damageMult: character.stats.damageMult,
      cooldownMult: character.stats.cooldownMult,
    };
  }

  attachTorch(torch: Torch) {
    this.torch = torch;
    this.mesh.add(torch.group);
  }

  takeDamage(amount: number, time: number): boolean {
    if (!this.alive) return false;
    if (time < this.iframeUntil) return false;
    this.stats.hp -= amount;
    this.iframeUntil = time + 0.5;
    this.outOfCombatFor = 0;
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  heal(amount: number) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  update(dt: number, moveX: number, moveZ: number, time: number, anyEnemyNear: boolean) {
    if (!this.alive) {
      this.char.update(dt);
      return;
    }

    const speed = this.stats.moveSpeed;
    this.velocity.set(moveX * speed, 0, moveZ * speed);
    this.position.addScaledVector(this.velocity, dt);

    // arena clamp
    const dist = Math.hypot(this.position.x, this.position.z);
    if (dist > ARENA_RADIUS - this.radius) {
      const k = (ARENA_RADIUS - this.radius) / dist;
      this.position.x *= k;
      this.position.z *= k;
    }

    // facing — track the target heading
    const moving = (moveX !== 0 || moveZ !== 0);
    if (moving) this.targetFacing = Math.atan2(moveX, moveZ);
    let dy = this.targetFacing - this.facing;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const a = 1 - Math.exp(-TURN_LERP * dt);
    this.facing += dy * a;

    // lean into the turn
    const targetLean = THREE.MathUtils.clamp(dy * 1.6, -0.22, 0.22);
    this.leanZ = THREE.MathUtils.lerp(this.leanZ, targetLean, 1 - Math.exp(-8 * dt));

    // drive the animated character
    this.char.setMoving(moving);
    this.char.setFacing(this.facing);
    this.mesh.rotation.z = this.leanZ;
    this.char.update(dt);

    // i-frame opacity flicker — keep the existing visual so combat feedback
    // doesn't change in this overhaul.
    const inIframe = time < this.iframeUntil;
    if (inIframe || this.wasInIframe) {
      this.mesh.traverse((o) => {
        if ((o as any).isMesh) {
          const mat = (o as any).material as THREE.MeshStandardMaterial;
          if (!mat) return;
          if (mat.transparent !== inIframe) mat.transparent = inIframe;
          mat.opacity = inIframe ? (Math.sin(time * 30) * 0.5 + 0.5) * 0.5 + 0.4 : 1;
        }
      });
      this.wasInIframe = inIframe;
    }

    this.torch?.update(dt);

    if (anyEnemyNear) this.outOfCombatFor = 0;
    else this.outOfCombatFor += dt;
    if (this.outOfCombatFor > 2) this.heal(2.5 * dt);
  }
}
