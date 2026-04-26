import * as THREE from 'three';

/** Top-level game states. */
export type GameState = 'title' | 'select' | 'playing' | 'paused' | 'levelup' | 'gameover' | 'victory';

/** Compact stat block for the player. Mutated in place by upgrades. */
export interface PlayerStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  magnetRadius: number;
  damageMult: number;
  cooldownMult: number; // 1.0 = base, 0.5 = 50% reduced
}

export type WeaponKind = 'blades' | 'pistol' | 'shockwave' | 'lightning' | 'boomerang';

export interface WeaponState {
  kind: WeaponKind;
  level: number; // 1..5
}

/** Damage event recorded per frame, drained by VFX/UI. */
export interface DamageEvent {
  pos: THREE.Vector3;
  amount: number;
  weapon: WeaponKind;
  isCrit: boolean;
}
