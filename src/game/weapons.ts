import * as THREE from 'three';
import type { Player } from './player';
import type { EnemyManager, Enemy } from './enemies';
import type { Vfx } from './vfx';
import type { Audio } from '../engine/audio';
import type { WeaponKind, WeaponState } from './types';
import { ICONS } from '../ui/icons';
import { PALETTE } from '../style';

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  icon: string;
  desc: (lvl: number) => string;
  maxLevel: number;
}

export const WEAPON_DEFS: Record<WeaponKind, WeaponDef> = {
  blades: {
    kind: 'blades', name: 'Helpful Cutlery', icon: ICONS.blades, maxLevel: 5,
    desc: (l) => `${1 + Math.min(l - 1, 4)} enchanted knives, will not be reasoned with, ${(8 + (l - 1) * 3)} dmg apiece. A wedding gift, in retrospect ominous.`,
  },
  pistol: {
    kind: 'pistol', name: 'The Personable Pistol', icon: ICONS.pistol, maxLevel: 5,
    desc: (l) => `Fires every ${(0.6 - (l - 1) * 0.06).toFixed(2)}s, ${(12 + (l - 1) * 4)} dmg, and apologises afterwards. Always at the nearest unfortunate.`,
  },
  shockwave: {
    kind: 'shockwave', name: 'A Strongly-Worded Cough', icon: ICONS.shockwave, maxLevel: 5,
    desc: (l) => `Every ${(4 - (l - 1) * 0.4).toFixed(1)}s. ${(20 + (l - 1) * 6)} dmg in ${(6 + (l - 1)).toFixed(1)}m. Knocks over the audience. Earplugs sold separately.`,
  },
  lightning: {
    kind: 'lightning', name: 'Suggested Electrocution', icon: ICONS.lightning, maxLevel: 5,
    desc: (l) => `Every ${(1.4 - (l - 1) * 0.12).toFixed(2)}s. ${(18 + (l - 1) * 5)} dmg, hops between ${1 + l} regrettable life-decisions. The third hop is statistically the funniest.`,
  },
  boomerang: {
    kind: 'boomerang', name: 'The Triangle of Returning', icon: ICONS.boomerang, maxLevel: 5,
    desc: (l) => `Every ${(1.6 - (l - 1) * 0.15).toFixed(2)}s. ${(16 + (l - 1) * 5)} dmg. Goes out, comes back. Cuts everything in between. The Guild are very firm on this.`,
  },
  swordswing: {
    kind: 'swordswing', name: "Sir Pommelry's Sword", icon: ICONS.swordswing, maxLevel: 5,
    desc: (l) => `A wide arc of unenthusiastic violence. ${(18 + (l - 1) * 5)} dmg, ${(2.5 + (l - 1) * 0.2).toFixed(1)}m reach. Performed under protest.`,
  },
};

/**
 * Cone-arc detection: is the point (x,z) inside a sector of half-angle
 * halfAngleRad and length range, anchored at (ox,oz) and pointing in the
 * direction `facing` (atan2(moveX, moveZ) convention — character forward
 * is +Z when facing == 0, so the unit vector is (sin facing, cos facing)).
 */
export function isInsideArc(
  origin: { ox: number; oz: number; facing: number; range: number; halfAngleRad: number },
  pt: { x: number; z: number },
): boolean {
  const dx = pt.x - origin.ox;
  const dz = pt.z - origin.oz;
  const dist2 = dx * dx + dz * dz;
  if (dist2 > origin.range * origin.range || dist2 < 1e-6) return false;
  const fx = Math.sin(origin.facing);
  const fz = Math.cos(origin.facing);
  const d = Math.sqrt(dist2);
  const cosAngle = (dx * fx + dz * fz) / d;
  return cosAngle >= Math.cos(origin.halfAngleRad);
}

interface Projectile {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  pierceLeft: number;
  ttl: number;
  mesh: THREE.Mesh;
}

export class WeaponSystem {
  private blades: { active: boolean; mesh: THREE.Mesh; angle: number }[] = [];
  private bladesRoot: THREE.Group;
  private bladeBaseAngle = 0;
  private bladeRotSpeed = (Math.PI * 2) / 1.2; // 1 rotation per 1.2s

  // pistol
  private projectiles: Projectile[] = [];
  private projGroup: THREE.Group;
  private pistolCd = 0;

  // shockwave
  private shockCd = 4;
  private shockRings: { mesh: THREE.Mesh; t: number; duration: number; maxR: number }[] = [];
  private shockRoot: THREE.Group;

  // lightning
  private lightningCd = 1.4;
  private lightningArcs: { line: THREE.Line; t: number; duration: number }[] = [];
  private lightningRoot: THREE.Group;

  // boomerang
  private boomerCd = 1.6;
  private boomerangs: {
    active: boolean; mesh: THREE.Mesh;
    pos: THREE.Vector3; vel: THREE.Vector3;
    origin: THREE.Vector3; outboundUntil: number;
    range: number; damage: number; spin: number;
    hitSet: Set<number>;
  }[] = [];
  private boomerRoot: THREE.Group;

  // sword swing
  private swordCd = 0;
  private swordCrescents: { wrapper: THREE.Group; ring: THREE.Mesh; t: number }[] = [];
  private swordRoot: THREE.Group;

  /** Map of currently-equipped weapons (mutable). */
  public equipped: Map<WeaponKind, WeaponState> = new Map();

  constructor(scene: THREE.Scene, private vfx: Vfx, private audio: Audio) {
    this.bladesRoot = new THREE.Group();
    scene.add(this.bladesRoot);
    this.projGroup = new THREE.Group();
    scene.add(this.projGroup);
    this.shockRoot = new THREE.Group();
    scene.add(this.shockRoot);
    this.lightningRoot = new THREE.Group();
    scene.add(this.lightningRoot);
    this.boomerRoot = new THREE.Group();
    scene.add(this.boomerRoot);
    this.swordRoot = new THREE.Group();
    scene.add(this.swordRoot);
  }

  add(kind: WeaponKind) {
    const cur = this.equipped.get(kind);
    if (!cur) this.equipped.set(kind, { kind, level: 1 });
    if (kind === 'blades') this.refreshBlades();
  }

  upgrade(kind: WeaponKind) {
    const cur = this.equipped.get(kind);
    if (!cur) { this.add(kind); return; }
    cur.level = Math.min(WEAPON_DEFS[kind].maxLevel, cur.level + 1);
    if (kind === 'blades') this.refreshBlades();
  }

  has(kind: WeaponKind) { return this.equipped.has(kind); }
  level(kind: WeaponKind) { return this.equipped.get(kind)?.level ?? 0; }

  // ---------- Orbiting Blades ----------
  private refreshBlades() {
    const lvl = this.level('blades');
    const target = Math.min(1 + (lvl - 1), 5);
    // remove extra
    while (this.blades.length > target) {
      const b = this.blades.pop()!;
      this.bladesRoot.remove(b.mesh);
    }
    // add new
    while (this.blades.length < target) {
      const geo = new THREE.IcosahedronGeometry(0.32, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb4eaff,
        emissive: 0x4cc9f0,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      this.bladesRoot.add(mesh);
      this.blades.push({ active: true, mesh, angle: 0 });
    }
  }

  // ---------- Update tick ----------
  update(dt: number, time: number, player: Player, enemies: EnemyManager) {
    const dmgMult = player.stats.damageMult;
    const cdMult = player.stats.cooldownMult;

    // ---------- Blades ----------
    if (this.equipped.has('blades')) {
      const lvl = this.level('blades');
      const radius = 3.0 + lvl * 0.15;
      const speed = this.bladeRotSpeed * (1 + (lvl - 1) * 0.12);
      this.bladeBaseAngle += speed * dt;
      const dmg = (8 + (lvl - 1) * 3) * dmgMult;
      for (let i = 0; i < this.blades.length; i++) {
        const angle = this.bladeBaseAngle + (i / this.blades.length) * Math.PI * 2;
        const x = player.position.x + Math.cos(angle) * radius;
        const z = player.position.z + Math.sin(angle) * radius;
        const y = 1.0 + Math.sin(time * 6 + i) * 0.15;
        const blade = this.blades[i];
        blade.mesh.position.set(x, y, z);
        blade.mesh.rotation.x += dt * 8;
        blade.mesh.rotation.y += dt * 6;
      }
      // Damage model: blades create a continuous "saw" aura around the player.
      // The aura radius matches the blade orbit + a small margin, so any enemy
      // close enough to threaten the player is being chewed up. Each blade adds
      // a damage tick to the aura. Visually the blades orbit; mechanically the
      // damage is centered on the player so coverage is consistent regardless
      // of where individual blades happen to be in their rotation.
      const auraRadius = radius + 0.6; // slightly wider than blade orbit
      const dpsPerBlade = dmg * 4;     // total DPS scales with blade count
      const totalDps = dpsPerBlade * this.blades.length;
      enemies.damageInRadius(player.position, auraRadius, totalDps * dt, 'blades', time, 0.4);
      // play subtle blade tick rarely
      if (Math.random() < dt * 1.5) this.audio.play('blade');
    }

    // ---------- Auto-Pistol ----------
    if (this.equipped.has('pistol')) {
      const lvl = this.level('pistol');
      const baseCd = (0.6 - (lvl - 1) * 0.06) * cdMult;
      this.pistolCd -= dt;
      if (this.pistolCd <= 0) {
        const target = enemies.findNearest(player.position, 18);
        if (target) {
          this.pistolCd = baseCd;
          const dmg = (12 + (lvl - 1) * 4) * dmgMult;
          const pierce = 1 + Math.floor((lvl - 1) / 2);
          this.fireProjectile(player.position, target.enemy.pos, dmg, pierce);
          this.audio.play('shoot');
        } else {
          this.pistolCd = 0.15;
        }
      }
    }

    // ---------- Shockwave ----------
    if (this.equipped.has('shockwave')) {
      const lvl = this.level('shockwave');
      const baseCd = (4 - (lvl - 1) * 0.4) * cdMult;
      this.shockCd -= dt;
      if (this.shockCd <= 0) {
        this.shockCd = baseCd;
        const dmg = (20 + (lvl - 1) * 6) * dmgMult;
        const radius = 6 + (lvl - 1);
        this.fireShockwave(player.position, dmg, radius, time, enemies);
      }
    }

    // ---------- Chain Lightning ----------
    // Cooldown is floored at the witch's Attack-clip duration (24f / 24fps =
    // 1.0s) so the visible staff thrust always plays in full. The bolt
    // spawns at the strike-frame, lining the sparks up with the thrust.
    if (this.equipped.has('lightning')) {
      const lvl = this.level('lightning');
      const baseCd = (1.4 - (lvl - 1) * 0.12) * cdMult;
      const cd = Math.max(baseCd, 24 / 24);
      this.lightningCd -= dt;
      if (this.lightningCd <= 0) {
        const target = enemies.findNearest(player.position, 16);
        if (target) {
          this.lightningCd = cd;
          const dmg = (18 + (lvl - 1) * 5) * dmgMult;
          const chains = 1 + lvl;
          player.playAttack(() => {
            this.fireLightning(player.position, target, dmg, chains, time, enemies);
          });
        } else {
          this.lightningCd = 0.2;
        }
      }
    }

    // ---------- Boomerang ----------
    // Cooldown floored at the hunter's Attack-clip duration (20f / 24fps).
    // The boomerang launches at strike-frame so the throw matches the spawn.
    if (this.equipped.has('boomerang')) {
      const lvl = this.level('boomerang');
      const baseCd = (1.6 - (lvl - 1) * 0.15) * cdMult;
      const cd = Math.max(baseCd, 20 / 24);
      this.boomerCd -= dt;
      if (this.boomerCd <= 0) {
        this.boomerCd = cd;
        const dmg = (16 + (lvl - 1) * 5) * dmgMult;
        const range = 10 + lvl;
        // throw in player's facing direction; if standing still, throw at nearest enemy
        let dirX = Math.sin(player.facing);
        let dirZ = Math.cos(player.facing);
        if (player.velocity.lengthSq() < 0.01) {
          const t = enemies.findNearest(player.position, 18);
          if (t) {
            const dx = t.enemy.pos.x - player.position.x;
            const dz = t.enemy.pos.z - player.position.z;
            const len = Math.hypot(dx, dz) || 1;
            dirX = dx / len; dirZ = dz / len;
          }
        }
        player.playAttack(() => {
          this.throwBoomerang(player.position, dirX, dirZ, dmg, range, time);
          this.audio.play('shoot', 0.7);
        });
      }
    }

    // ---------- Sword Swing (knight starter) ----------
    // Cooldown floored at the knight's Attack-clip duration (22f / 24fps).
    // Damage lands at strike-frame, so the cone arcs out as the sword reaches
    // its mid-swing apex.
    if (this.equipped.has('swordswing')) {
      const lvl = this.level('swordswing');
      const baseCd = 1.0 * cdMult;
      const cd = Math.max(baseCd, 22 / 24);
      this.swordCd -= dt;
      if (this.swordCd <= 0) {
        this.swordCd = cd;
        const dmg = (18 + (lvl - 1) * 5) * dmgMult;
        const range = 2.5 + (lvl - 1) * 0.2;
        const halfAngle = Math.PI / 3;        // 120° cone
        player.playAttack(() => {
          this.fireSwordSwing(player, enemies, dmg, range, halfAngle, time);
        });
      }
    }

    // ---------- update projectiles + arcs + boomerangs + rings + swings ----------
    this.updateProjectiles(dt, time, enemies);
    this.updateShockRings(dt);
    this.updateLightning(dt);
    this.updateBoomerangs(dt, time, player, enemies);
    this.updateSwordCrescents(dt);
  }

  private fireSwordSwing(
    player: Player, enemies: EnemyManager,
    dmg: number, range: number, halfAngle: number, time: number,
  ) {
    const ox = player.position.x, oz = player.position.z;
    enemies.forEach((e, mesh, type) => {
      if (isInsideArc(
        { ox, oz, facing: player.facing, range, halfAngleRad: halfAngle },
        { x: e.pos.x, z: e.pos.z },
      )) {
        const dx = e.pos.x - ox, dz = e.pos.z - oz;
        const d = Math.hypot(dx, dz) || 0.0001;
        const knockDir = new THREE.Vector3(dx / d, 0, dz / d);
        enemies.damageEnemy(e, mesh, type, dmg, 'swordswing', time, knockDir, 6);
      }
    });

    // Crescent VFX. We want the visible sector to overlap the damage cone
    // exactly. Damage is along the unit vector (sin facing, cos facing),
    // i.e. world +Z when facing == 0.
    //
    // Using the ring's own intrinsic Euler rotations to compose "lay flat" +
    // "face direction" gives the wrong axis on the second rotation, so the
    // visible sector ended up 180° offset from the damage cone. Wrap the ring
    // in a Group whose Y rotation IS the facing — clean separation, robust.
    //
    // Geometry: thetaStart = π/2 - halfAngle, thetaLength = 2*halfAngle puts
    // the sector centred on +Y in 2D ring coordinates. ring.rotation.x = +π/2
    // tilts the ring face-down so that +Y in geometry maps to +Z in the
    // wrapper's local frame. Then wrapper.rotation.y = facing aligns the
    // local +Z with the damage cone direction.
    const wrapper = new THREE.Group();
    wrapper.position.set(ox, 0.6, oz);
    wrapper.rotation.y = player.facing;

    const geo = new THREE.RingGeometry(range * 0.7, range, 24, 1, Math.PI / 2 - halfAngle, halfAngle * 2);
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.cyanGlow, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;           // lay flat, sector → wrapper-local +Z
    wrapper.add(ring);
    this.swordRoot.add(wrapper);
    this.swordCrescents.push({ wrapper, ring, t: 0 });

    this.audio.play('swordswing', 0.7);
    this.vfx.requestShake(0.04, 0.06);
  }

  private updateSwordCrescents(dt: number) {
    for (let i = this.swordCrescents.length - 1; i >= 0; i--) {
      const r = this.swordCrescents[i];
      r.t += dt;
      const k = Math.max(0, 1 - r.t / 0.14);
      (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * k;
      if (k <= 0) {
        this.swordRoot.remove(r.wrapper);
        r.ring.geometry.dispose();
        (r.ring.material as THREE.Material).dispose();
        this.swordCrescents.splice(i, 1);
      }
    }
  }

  // ---------- Chain Lightning ----------
  private fireLightning(
    from: THREE.Vector3,
    initial: { enemy: any; mesh: THREE.Group; type: any },
    dmg: number,
    chains: number,
    time: number,
    enemies: EnemyManager,
  ) {
    this.audio.play('shoot', 0.6);
    const points: THREE.Vector3[] = [new THREE.Vector3(from.x, 1.5, from.z)];
    const hit = new Set<number>();
    let current: any = initial;
    let curPos = new THREE.Vector3(from.x, 1.5, from.z);

    for (let i = 0; i < chains && current; i++) {
      const tgt = current.enemy;
      const tgtPos = new THREE.Vector3(tgt.pos.x, 1.0 + current.type.meshHeight * 0.5, tgt.pos.z);
      points.push(tgtPos);
      // damage the hit enemy
      enemies.damageEnemy(
        tgt, current.mesh, current.type,
        dmg * (1 - i * 0.1), 'lightning', time,
        new THREE.Vector3(0, 0, 0), 1.5,
      );
      hit.add(this.enemyId(tgt));
      // splash sparkle on enemy head
      this.vfx.burst(tgt.pos, new THREE.Color(PALETTE.cyanGlow), 6, 3, 0.35, 8);
      // find next nearest unhit enemy within 6m
      curPos = tgtPos;
      current = this.findNearestUnhit(curPos, 6, enemies, hit);
    }

    // build a jagged polyline from points (with per-segment jitter)
    const jagged: THREE.Vector3[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const segs = 4;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        if (s < segs) {
          p.x += (Math.random() - 0.5) * 0.4;
          p.y += (Math.random() - 0.5) * 0.3;
          p.z += (Math.random() - 0.5) * 0.4;
        }
        jagged.push(p);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(jagged);
    const mat = new THREE.LineBasicMaterial({
      color: PALETTE.cyanGlow,
      transparent: true,
      opacity: 1,
      linewidth: 3, // most browsers render line width 1, but try
    });
    const line = new THREE.Line(geo, mat);
    this.lightningRoot.add(line);
    this.lightningArcs.push({ line, t: 0, duration: 0.18 });
  }

  private enemyId(e: any): number {
    if (e.__id === undefined) e.__id = ++this._idCounter;
    return e.__id;
  }
  private _idCounter = 0;

  private findNearestUnhit(pos: THREE.Vector3, maxDist: number, enemies: EnemyManager, hit: Set<number>): any {
    let best: any = null;
    let bestD = maxDist;
    enemies.forEach((e, mesh, type) => {
      if (hit.has(this.enemyId(e))) return;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = { enemy: e, mesh, type, dist: d }; }
    });
    return best;
  }

  private updateLightning(dt: number) {
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      const arc = this.lightningArcs[i];
      arc.t += dt;
      const k = arc.t / arc.duration;
      (arc.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.lightningRoot.remove(arc.line);
        arc.line.geometry.dispose();
        (arc.line.material as THREE.Material).dispose();
        this.lightningArcs.splice(i, 1);
      }
    }
  }

  // ---------- Boomerang ----------
  private throwBoomerang(from: THREE.Vector3, dirX: number, dirZ: number, dmg: number, range: number, _time: number) {
    let b = this.boomerangs.find((x) => !x.active);
    if (!b) {
      // Boomerang model: thin gold "L" shape — two boxes joined
      const group = new THREE.Group();
      const armA = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.07, 0.16),
        new THREE.MeshStandardMaterial({
          color: PALETTE.gold, emissive: PALETTE.goldDeep, emissiveIntensity: 0.7,
          roughness: 0.45, metalness: 0.4, flatShading: true,
        }),
      );
      const armB = armA.clone();
      armB.geometry = new THREE.BoxGeometry(0.16, 0.07, 0.62);
      armB.position.set(0.23, 0, 0.23);
      group.add(armA);
      group.add(armB);
      // hack: use a Mesh wrapper so .position/.rotation work — create a Mesh that owns the group
      const wrapper = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ visible: false }));
      wrapper.add(group);
      this.boomerRoot.add(wrapper);
      b = {
        active: false, mesh: wrapper,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        origin: new THREE.Vector3(), outboundUntil: 0,
        range: 0, damage: 0, spin: 0,
        hitSet: new Set(),
      };
      this.boomerangs.push(b);
    }
    b.active = true;
    b.pos.set(from.x, 1.0, from.z);
    b.origin.set(from.x, 1.0, from.z);
    const speed = 16;
    b.vel.set(dirX * speed, 0, dirZ * speed);
    b.range = range;
    b.damage = dmg;
    b.outboundUntil = range / speed; // seconds outbound before reversing
    b.spin = 0;
    b.hitSet.clear();
    b.mesh.position.copy(b.pos);
    b.mesh.visible = true;
  }

  private updateBoomerangs(dt: number, time: number, player: Player, enemies: EnemyManager) {
    for (const b of this.boomerangs) {
      if (!b.active) continue;
      b.outboundUntil -= dt;
      // outbound: travel straight; return: home toward player position
      if (b.outboundUntil > 0) {
        b.pos.addScaledVector(b.vel, dt);
      } else {
        const dx = player.position.x - b.pos.x;
        const dz = player.position.z - b.pos.z;
        const d = Math.hypot(dx, dz) || 0.0001;
        const speed = 18;
        b.vel.set((dx / d) * speed, 0, (dz / d) * speed);
        b.pos.addScaledVector(b.vel, dt);
        // catch: returns to player
        if (d < 0.7) { b.active = false; b.mesh.visible = false; continue; }
      }
      b.spin += dt * 18;
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y = b.spin;

      // damage any enemy in 0.85m, but only once per throw (hitSet by id)
      enemies.forEach((e, mesh, type) => {
        if (!b.active) return;
        const eid = this.enemyId(e);
        if (b.hitSet.has(eid)) return;
        const dx = e.pos.x - b.pos.x;
        const dz = e.pos.z - b.pos.z;
        const r = type.radius + 0.55;
        if (dx * dx + dz * dz < r * r) {
          enemies.damageEnemy(e, mesh, type, b.damage, 'boomerang', time,
            new THREE.Vector3(b.vel.x, 0, b.vel.z).normalize(), 3);
          b.hitSet.add(eid);
        }
      });
    }
  }

  private fireProjectile(from: THREE.Vector3, to: THREE.Vector3, dmg: number, pierce: number) {
    let p = this.projectiles.find((x) => !x.active);
    if (!p) {
      const geo = new THREE.SphereGeometry(0.16, 10, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffe066,
        emissive: 0xffaa00,
        emissiveIntensity: 1.6,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.projGroup.add(mesh);
      p = {
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 0,
        pierceLeft: 0,
        ttl: 0,
        mesh,
      };
      this.projectiles.push(p);
    }
    p.active = true;
    p.pos.set(from.x, 1.2, from.z);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 30;
    p.vel.set((dx / d) * speed, 0, (dz / d) * speed);
    p.damage = dmg;
    p.pierceLeft = pierce;
    p.ttl = 1.5;
    p.mesh.position.copy(p.pos);
    p.mesh.visible = true;
  }

  private updateProjectiles(dt: number, time: number, enemies: EnemyManager) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.pos.addScaledVector(p.vel, dt);
      p.ttl -= dt;
      p.mesh.position.copy(p.pos);
      if (p.ttl <= 0) { p.active = false; p.mesh.visible = false; continue; }

      // collision: nearest enemy within 0.6m
      enemies.forEach((e, mesh, type) => {
        if (!p.active) return;
        const dx = e.pos.x - p.pos.x;
        const dz = e.pos.z - p.pos.z;
        const d2 = dx * dx + dz * dz;
        const r = type.radius + 0.2;
        if (d2 < r * r) {
          const dirX = p.vel.x / Math.hypot(p.vel.x, p.vel.z);
          const dirZ = p.vel.z / Math.hypot(p.vel.x, p.vel.z);
          enemies.damageEnemy(e, mesh, type, p.damage, 'pistol', time, new THREE.Vector3(dirX, 0, dirZ), 4);
          p.pierceLeft--;
          if (p.pierceLeft < 0) {
            p.active = false; p.mesh.visible = false;
          }
        }
      });
    }
  }

  private fireShockwave(center: THREE.Vector3, dmg: number, radius: number, time: number, enemies: EnemyManager) {
    enemies.damageInRadius(center, radius, dmg, 'shockwave', time, 1.3);
    this.audio.play('shockwave');
    this.vfx.shockRing(center, radius);
    this.vfx.requestShake(0.18, 0.22);
    // visible expanding ring
    const geo = new THREE.RingGeometry(0.5, 0.7, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4cc9f0,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center.x, 0.08, center.z);
    mesh.rotation.x = -Math.PI / 2;
    this.shockRoot.add(mesh);
    this.shockRings.push({ mesh, t: 0, duration: 0.35, maxR: radius });
  }

  private updateShockRings(dt: number) {
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const r = this.shockRings[i];
      r.t += dt;
      const k = Math.min(r.t / r.duration, 1);
      const cur = 0.5 + k * (r.maxR - 0.5);
      r.mesh.scale.setScalar(cur);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85;
      if (k >= 1) {
        this.shockRoot.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.shockRings.splice(i, 1);
      }
    }
  }
}
