import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';
import type { PlayerStats } from './types';
import type { CharacterDef } from './characters';
import type { Torch } from './torch';

const TURN_LERP = 14;

/** Builds a stylized "knight" out of primitives. Group origin is at the feet. */
function buildKnightMesh(): THREE.Group {
  const g = new THREE.Group();
  const flat = (color: number, rough = 0.6) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

  // body (torso) — capsule-ish: cylinder + sphere caps
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), flat(0x3b6dd1, 0.5));
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);

  // belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12), flat(0x6b4318, 0.5));
  belt.position.y = 0.78;
  belt.castShadow = true;
  g.add(belt);

  // head (with helmet)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), flat(0xe6c9a0, 0.55));
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2), flat(0xb8babd, 0.35));
  helmet.position.y = 1.85;
  helmet.castShadow = true;
  g.add(helmet);
  // helmet visor strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), flat(0x111418, 0.2));
  visor.position.set(0, 1.78, 0.27);
  g.add(visor);

  // shoulders
  const shoulderGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const shoulderMat = flat(0xb8babd, 0.35);
  const shL = new THREE.Mesh(shoulderGeo, shoulderMat);
  shL.position.set(-0.46, 1.36, 0);
  shL.castShadow = true;
  g.add(shL);
  const shR = shL.clone();
  shR.position.x = 0.46;
  g.add(shR);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.45, 4, 6);
  const armMat = flat(0x3b6dd1, 0.5);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.5, 1.05, 0.0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.5;
  g.add(armR);

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.15, 0.5, 4, 6);
  const legMat = flat(0x2a3b5c, 0.6);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.18, 0.4, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  g.add(legR);

  // feet
  const footGeo = new THREE.BoxGeometry(0.22, 0.1, 0.34);
  const footMat = flat(0x2a1a10, 0.7);
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(-0.18, 0.07, 0.04);
  g.add(footL);
  const footR = footL.clone();
  footR.position.x = 0.18;
  g.add(footR);

  // small forward indicator nub on chest (helps you tell facing in screenshots)
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), flat(0xffd166, 0.3));
  crest.position.set(0, 1.25, 0.43);
  g.add(crest);

  // tag the limbs we want to animate
  (g as any).limbs = { armL, armR, legL, legR, body, head, helmet };
  return g;
}

export class Player {
  readonly mesh: THREE.Group;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly stats: PlayerStats;
  readonly radius = 0.45; // collision radius
  facing = 0; // yaw radians
  private targetFacing = 0;
  iframeUntil = 0; // timestamp seconds
  alive = true;
  outOfCombatFor = 0;
  private bobT = 0;
  private limbs: any;
  private leanZ = 0;
  private torch: Torch | null = null;
  private wasInIframe = false;

  constructor(character?: CharacterDef) {
    this.mesh = character ? character.build() : buildKnightMesh();
    this.position = this.mesh.position;
    this.position.set(0, 0, 0);
    const c = character?.stats;
    this.stats = {
      maxHp: c?.maxHp ?? 120,
      hp: c?.maxHp ?? 120,
      moveSpeed: c?.moveSpeed ?? 5.5,
      magnetRadius: c?.magnetRadius ?? 2.0,
      damageMult: c?.damageMult ?? 1.0,
      cooldownMult: c?.cooldownMult ?? 1.0,
    };
    this.limbs = (this.mesh as any).limbs;
  }

  /** Attach a torch to the off-hand. Updated automatically each frame. */
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
      return true; // died
    }
    return false;
  }

  heal(amount: number) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  update(dt: number, moveX: number, moveZ: number, time: number, anyEnemyNear: boolean) {
    if (!this.alive) return;

    const speed = this.stats.moveSpeed;
    this.velocity.set(moveX * speed, 0, moveZ * speed);
    this.position.addScaledVector(this.velocity, dt);

    // clamp to arena
    const dist = Math.hypot(this.position.x, this.position.z);
    if (dist > ARENA_RADIUS - this.radius) {
      const k = (ARENA_RADIUS - this.radius) / dist;
      this.position.x *= k;
      this.position.z *= k;
    }

    // facing — track the target heading
    if (moveX !== 0 || moveZ !== 0) {
      this.targetFacing = Math.atan2(moveX, moveZ);
    }
    let dy = this.targetFacing - this.facing;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const a = 1 - Math.exp(-TURN_LERP * dt);
    this.facing += dy * a;
    // Character meshes are authored with their front on +Z (knight visor +z,
     // hunter eye-slits +z, sorceress eyes +z; shields and cloaks at -z).
     // atan2(moveX, moveZ) already produces the right yaw to point +Z toward
     // the movement direction, so no extra offset.
    this.mesh.rotation.y = this.facing;

    // Lean into the turn — proportional to remaining angular delta. Capped at
    // ~12° so the character tilts noticeably when changing direction but
    // doesn't tip over. Decays back to upright on straightaways.
    const targetLean = THREE.MathUtils.clamp(dy * 1.6, -0.22, 0.22);
    this.leanZ = THREE.MathUtils.lerp(this.leanZ, targetLean, 1 - Math.exp(-8 * dt));
    this.mesh.rotation.z = this.leanZ;

    // limb bob + walk cycle
    const moving = (moveX !== 0 || moveZ !== 0);
    this.bobT += dt * (moving ? 12 : 4);
    const swing = moving ? 0.7 : 0.05;
    if (this.limbs) {
      this.limbs.armL.rotation.x = Math.sin(this.bobT) * swing;
      this.limbs.armR.rotation.x = -Math.sin(this.bobT) * swing;
      this.limbs.legL.rotation.x = -Math.sin(this.bobT) * swing;
      this.limbs.legR.rotation.x = Math.sin(this.bobT) * swing;
      this.limbs.body.position.y = 1.05 + Math.abs(Math.sin(this.bobT * 2)) * (moving ? 0.05 : 0);
      // forward lean while running adds momentum
      const forwardLean = moving ? 0.08 : 0;
      this.limbs.body.rotation.x = THREE.MathUtils.lerp(this.limbs.body.rotation.x, forwardLean, 1 - Math.exp(-6 * dt));
    }

    // i-frame visual: pulse opacity. Only walk the rig when the state changes
    // or while actively in i-frames — was traversing every frame regardless,
    // walking the whole character + torch for no reason most of the time.
    const inIframe = time < this.iframeUntil;
    if (inIframe || this.wasInIframe) {
      this.mesh.traverse((o) => {
        if ((o as any).isMesh) {
          const mat = (o as any).material as THREE.MeshStandardMaterial;
          if (mat.transparent !== inIframe) {
            mat.transparent = inIframe;
          }
          mat.opacity = inIframe ? (Math.sin(time * 30) * 0.5 + 0.5) * 0.5 + 0.4 : 1;
        }
      });
      this.wasInIframe = inIframe;
    }

    // tick the torch flicker (if equipped)
    this.torch?.update(dt);

    // out-of-combat regen
    if (anyEnemyNear) this.outOfCombatFor = 0;
    else this.outOfCombatFor += dt;
    if (this.outOfCombatFor > 2) {
      this.heal(2.5 * dt);
    }
  }
}
