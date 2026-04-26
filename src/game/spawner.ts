import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';
import type { EnemyManager, EnemyKind } from './enemies';

interface WaveTier {
  startTime: number;
  cap: number;
  rate: number;
  bruteChance: number;
}

const WAVES: WaveTier[] = [
  { startTime: 0,   cap: 12,  rate: 0.5, bruteChance: 0.0 },
  { startTime: 30,  cap: 25,  rate: 1.0, bruteChance: 0.0 },
  { startTime: 75,  cap: 50,  rate: 1.8, bruteChance: 0.05 },
  { startTime: 150, cap: 100, rate: 3.0, bruteChance: 0.12 },
  { startTime: 300, cap: 160, rate: 4.0, bruteChance: 0.22 },
  { startTime: 420, cap: 230, rate: 5.0, bruteChance: 0.32 },
  { startTime: 540, cap: 300, rate: 6.0, bruteChance: 0.42 },
];

export const RUN_DURATION = 600; // 10 minutes
export const BOSS_TIME = 300;

const tmp = new THREE.Vector3();

export class Spawner {
  private acc = 0;
  private bossSpawned = false;
  bossSpawnedCb?: () => void;

  current(time: number): WaveTier {
    let cur = WAVES[0];
    for (const w of WAVES) if (time >= w.startTime) cur = w;
    return cur;
  }

  update(dt: number, time: number, enemies: EnemyManager, playerPos: THREE.Vector3) {
    const w = this.current(time);
    this.acc += dt * w.rate;

    while (this.acc >= 1 && enemies.count() < w.cap) {
      this.acc -= 1;
      const kind: EnemyKind = Math.random() < w.bruteChance ? 'brute' : 'runner';
      this.spawnAtRing(kind, enemies, playerPos);
    }
    if (this.acc > 1) this.acc = 1; // don't accumulate when at cap

    if (!this.bossSpawned && time >= BOSS_TIME) {
      this.bossSpawned = true;
      this.spawnAtRing('boss', enemies, playerPos);
      if (this.bossSpawnedCb) this.bossSpawnedCb();
    }
  }

  private spawnAtRing(kind: EnemyKind, enemies: EnemyManager, playerPos: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2;
    const r = ARENA_RADIUS - 2; // spawn near edge but inside
    tmp.set(playerPos.x + Math.cos(angle) * r, 0, playerPos.z + Math.sin(angle) * r);
    // clamp to arena
    const d = Math.hypot(tmp.x, tmp.z);
    if (d > ARENA_RADIUS - 2) {
      tmp.x *= (ARENA_RADIUS - 2) / d;
      tmp.z *= (ARENA_RADIUS - 2) / d;
    }
    enemies.spawn(kind, tmp);
  }

  reset() {
    this.acc = 0;
    this.bossSpawned = false;
  }
}
