import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';

export type EnemyKind = 'runner' | 'brute' | 'boss';

export interface EnemyType {
  kind: EnemyKind;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xpDrop: number;
  color: number;
  scale: number;
  meshHeight: number;
}

export const ENEMY_TYPES: Record<EnemyKind, EnemyType> = {
  runner: { kind: 'runner', maxHp: 20, speed: 4.5, damage: 8,  radius: 0.45, xpDrop: 1, color: 0x88c34a, scale: 1.0, meshHeight: 1.4 },
  brute:  { kind: 'brute',  maxHp: 80, speed: 2.0, damage: 18, radius: 0.75, xpDrop: 5, color: 0xc94f3a, scale: 1.55, meshHeight: 1.8 },
  boss:   { kind: 'boss',   maxHp: 600, speed: 2.5, damage: 30, radius: 1.4, xpDrop: 60, color: 0x8a3df0, scale: 2.6,  meshHeight: 2.4 },
};

interface Enemy {
  active: boolean;
  kind: EnemyKind;
  hp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hitFlashUntil: number;
  attackCooldown: number;
  knockback: THREE.Vector3;
}

// Pre-allocated white color for hit-flash emissive lerp. Was being created
// fresh inside the per-enemy traverse — at 300 enemies × ~6 sub-meshes that
// was 1800 Color allocations per frame just for hit feedback.
const FLASH_WHITE = new THREE.Color(0xffffff);

/** Build a stylized monster mesh by kind — composite primitives. */
function buildMonsterMesh(type: EnemyType): THREE.Group {
  const g = new THREE.Group();
  const flat = (color: number, rough = 0.7) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

  if (type.kind === 'runner') {
    // small hunched goblin: body + head + arms + legs
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.55, 4, 8), flat(type.color));
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), flat(type.color, 0.6));
    head.position.set(0, 1.4, 0.05);
    head.castShadow = true;
    g.add(head);

    // glowing eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 1.45, 0.27);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    g.add(eyeR);

    // claws / arms
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.4, 4, 6);
    const armMat = flat(type.color);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.4, 0.95, 0.0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.4;
    g.add(armR);

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.35, 4, 6);
    const legL = new THREE.Mesh(legGeo, armMat);
    legL.position.set(-0.18, 0.3, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.18;
    g.add(legR);
  } else if (type.kind === 'brute') {
    // chunky orc
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 0.8, 4, 8), flat(type.color));
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), flat(0x8a3a28));
    belly.position.set(0, 0.85, 0.18);
    g.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), flat(type.color, 0.6));
    head.position.set(0, 1.78, 0.05);
    head.castShadow = true;
    g.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.13, 1.82, 0.38);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    g.add(eyeR);

    // tusks
    const tuskGeo = new THREE.ConeGeometry(0.05, 0.18, 6);
    const tuskMat = flat(0xfff0d0, 0.4);
    const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
    tuskL.position.set(-0.1, 1.7, 0.4);
    tuskL.rotation.x = Math.PI;
    g.add(tuskL);
    const tuskR = tuskL.clone();
    tuskR.position.x = 0.1;
    g.add(tuskR);

    // huge arms
    const armGeo = new THREE.CapsuleGeometry(0.2, 0.7, 4, 6);
    const armMat = flat(type.color);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.7, 1.05, 0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.7;
    g.add(armR);

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.22, 0.4, 4, 6);
    const legL = new THREE.Mesh(legGeo, armMat);
    legL.position.set(-0.25, 0.35, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.25;
    g.add(legR);
  } else {
    // boss — towering hulk with crown of horns
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 1.3, 4, 10), flat(type.color));
    body.position.y = 1.6;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 12), flat(type.color, 0.5));
    head.position.set(0, 2.95, 0.05);
    head.castShadow = true;
    g.add(head);

    // crown of horns
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 6), flat(0x2a1a1a, 0.4));
      horn.position.set(Math.cos(a) * 0.6, 3.45, Math.sin(a) * 0.6);
      horn.rotation.z = -Math.cos(a) * 0.5;
      horn.rotation.x = Math.sin(a) * 0.5;
      horn.castShadow = true;
      g.add(horn);
    }

    // glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4ee0 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeMat);
    eyeL.position.set(-0.22, 3.0, 0.65);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.22;
    g.add(eyeR);

    // huge arms
    const armGeo = new THREE.CapsuleGeometry(0.32, 1.2, 4, 6);
    const armMat = flat(type.color);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-1.2, 1.7, 0);
    armL.castShadow = true;
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 1.2;
    g.add(armR);

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.36, 0.7, 4, 6);
    const legL = new THREE.Mesh(legGeo, armMat);
    legL.position.set(-0.4, 0.5, 0);
    legL.castShadow = true;
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.4;
    g.add(legR);
  }

  return g;
}

/**
 * Manages all enemies in pools per kind. We use Group instances rather than InstancedMesh
 * because each enemy has multi-part meshes with hit-flash uniforms — InstancedMesh would
 * sacrifice that per-enemy color tinting. With ~300 enemies of simple geometry the draw
 * call count stays fine; flat-shaded materials let Three.js batch.
 */
export class EnemyManager {
  readonly group: THREE.Group;
  private pools: Record<EnemyKind, Enemy[]> = { runner: [], brute: [], boss: [] };
  private meshes: Record<EnemyKind, THREE.Group[]> = { runner: [], brute: [], boss: [] };
  private templates: Record<EnemyKind, THREE.Group>;

  /** Damage events to drain each frame (for floating numbers). */
  damageEvents: Array<{ pos: THREE.Vector3; amount: number; weapon: any }> = [];
  /** Death events to drain each frame (for VFX + XP). */
  deathEvents: Array<{ pos: THREE.Vector3; kind: EnemyKind }> = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'enemies';
    scene.add(this.group);
    this.templates = {
      runner: buildMonsterMesh(ENEMY_TYPES.runner),
      brute: buildMonsterMesh(ENEMY_TYPES.brute),
      boss: buildMonsterMesh(ENEMY_TYPES.boss),
    };
  }

  spawn(kind: EnemyKind, pos: THREE.Vector3) {
    const type = ENEMY_TYPES[kind];
    let e = this.pools[kind].find((x) => !x.active);
    let mesh: THREE.Group;
    if (!e) {
      e = {
        active: false,
        kind,
        hp: type.maxHp,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        hitFlashUntil: 0,
        attackCooldown: 0,
        knockback: new THREE.Vector3(),
      };
      this.pools[kind].push(e);
      mesh = this.templates[kind].clone(true);
      mesh.scale.setScalar(type.scale);
      // Clone materials per-instance so we can tint individual enemies on hit
      // without affecting the others. Object3D.clone() shares materials by default.
      // We also stash the base emissive on each material so we can restore it.
      mesh.traverse((o) => {
        if ((o as any).isMesh) {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m && (m as any).isMeshStandardMaterial) {
            const cloned = m.clone();
            (cloned as any).__baseEmissive = cloned.emissive.clone();
            (cloned as any).__baseEmissiveIntensity = cloned.emissiveIntensity;
            (o as THREE.Mesh).material = cloned;
          }
        }
      });
      this.group.add(mesh);
      this.meshes[kind].push(mesh);
    } else {
      mesh = this.meshes[kind][this.pools[kind].indexOf(e)];
    }
    e.active = true;
    e.hp = type.maxHp;
    e.pos.copy(pos);
    e.vel.set(0, 0, 0);
    e.knockback.set(0, 0, 0);
    e.hitFlashUntil = 0;
    e.attackCooldown = 0;
    mesh.position.copy(pos);
    mesh.visible = true;
  }

  count(kind?: EnemyKind): number {
    if (kind) return this.pools[kind].filter((e) => e.active).length;
    let n = 0;
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      for (const e of this.pools[k]) if (e.active) n++;
    }
    return n;
  }

  /** Iterate all active enemies. Cb may mutate (e.g., set inactive). */
  forEach(cb: (e: Enemy, mesh: THREE.Group, type: EnemyType) => void) {
    for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
      const arr = this.pools[k];
      const meshes = this.meshes[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        if (e.active) cb(e, meshes[i], type);
      }
    }
  }

  /** Apply damage at a world position to all enemies within radius. Returns total kills. */
  damageInRadius(center: THREE.Vector3, radius: number, dmg: number, weapon: any, time: number, knockbackScale = 0.5): number {
    let kills = 0;
    const r2 = radius * radius;
    // Continuous-DPS weapons (blades) push tiny damage values per frame; we don't
    // want to flood the floating-number HUD. Only emit a damage number when the
    // applied damage in this tick exceeds a small threshold.
    const emitNumber = dmg >= 1.5;
    this.forEach((e, mesh, type) => {
      const dx = e.pos.x - center.x;
      const dz = e.pos.z - center.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= r2) {
        e.hp -= dmg;
        e.hitFlashUntil = time + 0.08;
        const d = Math.sqrt(d2) || 0.0001;
        const kb = (1 - Math.min(d / radius, 1)) * knockbackScale;
        e.knockback.x += (dx / d) * kb * 6;
        e.knockback.z += (dz / d) * kb * 6;
        if (emitNumber) {
          // One Vector3 alloc per emit (unavoidable — the event outlives the
          // call frame). Was two: the inner `new Vector3` is gone.
          const headPos = e.pos.clone();
          headPos.y += type.meshHeight;
          this.damageEvents.push({ pos: headPos, amount: dmg, weapon });
        }
        if (e.hp <= 0) {
          e.active = false;
          mesh.visible = false;
          this.deathEvents.push({ pos: e.pos.clone(), kind: e.kind });
          kills++;
        }
      }
    });
    return kills;
  }

  /** Hit a single enemy (for projectile hits). */
  damageEnemy(e: Enemy, mesh: THREE.Group, type: EnemyType, dmg: number, weapon: any, time: number, knockbackDir: THREE.Vector3, knockbackAmt: number): boolean {
    e.hp -= dmg;
    e.hitFlashUntil = time + 0.08;
    e.knockback.x += knockbackDir.x * knockbackAmt;
    e.knockback.z += knockbackDir.z * knockbackAmt;
    const headPos = e.pos.clone();
    headPos.y += type.meshHeight;
    this.damageEvents.push({ pos: headPos, amount: dmg, weapon });
    if (e.hp <= 0) {
      e.active = false;
      mesh.visible = false;
      this.deathEvents.push({ pos: e.pos.clone(), kind: e.kind });
      return true;
    }
    return false;
  }

  /** Find nearest active enemy to a position within maxDist. */
  findNearest(pos: THREE.Vector3, maxDist: number): { enemy: Enemy; mesh: THREE.Group; type: EnemyType; dist: number } | null {
    let best: any = null;
    let bestD = maxDist;
    for (const k of ['boss', 'brute', 'runner'] as EnemyKind[]) {
      const arr = this.pools[k];
      const meshes = this.meshes[k];
      const type = ENEMY_TYPES[k];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        if (!e.active) continue;
        const dx = e.pos.x - pos.x;
        const dz = e.pos.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD) {
          bestD = d;
          best = { enemy: e, mesh: meshes[i], type, dist: d };
        }
      }
    }
    return best;
  }

  /** Tick all enemies: seek player, separate, apply knockback, deal melee damage. */
  update(dt: number, playerPos: THREE.Vector3, time: number, onPlayerHit: (dmg: number) => void) {
    const sep = 0.6; // separation strength
    this.forEach((e, mesh, type) => {
      // seek player
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      const speed = type.speed;
      e.vel.x = (dx / d) * speed;
      e.vel.z = (dz / d) * speed;

      // apply velocity + knockback
      e.pos.x += e.vel.x * dt + e.knockback.x * dt;
      e.pos.z += e.vel.z * dt + e.knockback.z * dt;

      // decay knockback
      const decay = Math.exp(-6 * dt);
      e.knockback.multiplyScalar(decay);

      // clamp loosely to outer ring (so they don't wander too far)
      const r = Math.hypot(e.pos.x, e.pos.z);
      if (r > ARENA_RADIUS + 6) {
        e.pos.x *= (ARENA_RADIUS + 6) / r;
        e.pos.z *= (ARENA_RADIUS + 6) / r;
      }
    });

    // separation pass — push overlapping enemies apart (prevents stacking on the player)
    // For perf, we sample a subset each frame using simple bin in O(n^2 / k).
    // At 300 enemies this is ~45k pairs which is fine in JS but we can optimize by
    // grid binning. For the slice scope keeping it simple.
    const all: { e: Enemy; type: EnemyType }[] = [];
    this.forEach((e, _mesh, type) => all.push({ e, type }));
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

    // melee on player + sync mesh + hit-flash material tint
    this.forEach((e, mesh, type) => {
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const touchD = type.radius + 0.45; // player radius
      if (d < touchD) {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          onPlayerHit(type.damage);
          e.attackCooldown = 0.7;
        }
      } else {
        e.attackCooldown = 0;
      }

      // Hit flash: drive emissive toward white during the flash window. Fades
      // smoothly back to base over 80ms. Per-instance materials (cloned at spawn
      // time) make this affect only the hit enemy.
      const flashAmt = Math.max(0, (e.hitFlashUntil - time) / 0.08);
      mesh.traverse((o) => {
        if ((o as any).isMesh) {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (!m || !(m as any).isMeshStandardMaterial) return;
          const baseE = (m as any).__baseEmissive as THREE.Color | undefined;
          const baseI = (m as any).__baseEmissiveIntensity as number | undefined;
          if (baseE === undefined || baseI === undefined) return;
          if (flashAmt > 0) {
            // boost emissive toward white, then fade. Re-using FLASH_WHITE
            // avoids ~1800 Color allocations per frame at 300 enemies.
            m.emissive.copy(baseE).lerp(FLASH_WHITE, flashAmt);
            m.emissiveIntensity = baseI + flashAmt * 1.6;
          } else {
            m.emissive.copy(baseE);
            m.emissiveIntensity = baseI;
          }
        }
      });
      // small punch-scale on the very first frame of the flash for impact
      const punch = flashAmt > 0 ? 1 + 0.05 * flashAmt : 1;
      mesh.scale.setScalar(type.scale * punch);

      mesh.position.set(e.pos.x, 0, e.pos.z);
      // face the player
      const yaw = Math.atan2(dx, dz);
      mesh.rotation.y = yaw;
    });
  }
}

export type { Enemy };
