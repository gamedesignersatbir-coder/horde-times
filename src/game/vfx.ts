import * as THREE from 'three';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

const MAX_PARTICLES = 600;

/**
 * GPU-friendly particle system using a single THREE.Points object with per-vertex attributes.
 * Also exposes screen-shake requests that the camera rig consumes.
 */
export class Vfx {
  readonly points: THREE.Points;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  pendingShake: { amp: number; duration: number } | null = null;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        color: new THREE.Color(),
        size: 1,
      });
      // start far below ground so unused points are invisible
      this.positions[i * 3 + 1] = -100;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */`
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.1, r);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  private spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, color: THREE.Color, size: number) {
    const p = this.particles.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.maxLife = life;
    p.life = life;
    p.color.copy(color);
    p.size = size;
  }

  /** Burst on enemy death. */
  burst(pos: THREE.Vector3, color: THREE.Color, count = 14, speed = 4, lifeMax = 0.7, sizeBase = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * speed;
      const vy = 1 + Math.random() * 4;
      this.spawn(
        pos.clone().add(new THREE.Vector3(0, 0.4 + Math.random() * 0.4, 0)),
        new THREE.Vector3(Math.cos(a) * v, vy, Math.sin(a) * v),
        lifeMax * (0.6 + Math.random() * 0.6),
        color,
        sizeBase * (0.6 + Math.random() * 0.8),
      );
    }
  }

  /** Quick gold sparkle (used on level up + xp pickup). */
  sparkle(pos: THREE.Vector3) {
    const c = new THREE.Color(0xffd166);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 2;
      this.spawn(
        pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3)),
        new THREE.Vector3(Math.cos(a) * v, 2 + Math.random() * 2, Math.sin(a) * v),
        0.5 + Math.random() * 0.3,
        c,
        9 + Math.random() * 6,
      );
    }
  }

  shockRing(pos: THREE.Vector3, _radius: number) {
    const c = new THREE.Color(0x88e0ff);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      this.spawn(
        pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3)),
        new THREE.Vector3(Math.cos(a) * 6, 1 + Math.random() * 2, Math.sin(a) * 6),
        0.45,
        c,
        14 + Math.random() * 6,
      );
    }
  }

  requestShake(amp: number, duration: number) {
    if (!this.pendingShake || this.pendingShake.amp < amp) {
      this.pendingShake = { amp, duration };
    }
  }

  consumeShake(): { amp: number; duration: number } | null {
    const s = this.pendingShake;
    this.pendingShake = null;
    return s;
  }

  update(dt: number) {
    let needs = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.positions[i * 3 + 1] = -100;
        this.sizes[i] = 0;
        needs = true;
        continue;
      }
      // gravity
      p.vel.y -= 9 * dt;
      p.pos.addScaledVector(p.vel, dt);
      // ground bounce dampen
      if (p.pos.y < 0.05) { p.pos.y = 0.05; p.vel.y *= -0.3; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      const k = p.life / p.maxLife;
      this.positions[i * 3 + 0] = p.pos.x;
      this.positions[i * 3 + 1] = p.pos.y;
      this.positions[i * 3 + 2] = p.pos.z;
      this.colors[i * 3 + 0] = p.color.r * k * 1.5;
      this.colors[i * 3 + 1] = p.color.g * k * 1.5;
      this.colors[i * 3 + 2] = p.color.b * k * 1.5;
      this.sizes[i] = p.size * k;
      needs = true;
    }
    if (needs) {
      (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
