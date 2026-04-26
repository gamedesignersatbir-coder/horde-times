import * as THREE from 'three';
import { PALETTE } from '../style';

/**
 * A character-carried torch. Visible only during sunset/night runs. Composed of:
 *
 *  - A wooden handle (small dark cylinder)
 *  - An animated flame (icosahedron with emissive orange material, scaled by
 *    a noise-driven flicker function)
 *  - A warm PointLight (range ~9m, flickering intensity) that lights nearby
 *    geometry — characters, ground, enemies — so the world feels lit BY the
 *    torch, not by an ambient cheat
 *  - A second tiny PointLight at the player's feet for a soft "ground glow"
 *
 * The whole rig is a Group attached to the player's mesh. The flicker uses
 * a sum of two sine waves with prime-ratio frequencies to avoid an obvious
 * loop, plus a tiny random jitter so it never feels mechanical.
 */
export class Torch {
  readonly group: THREE.Group;
  private flameInner: THREE.Mesh;
  private flameOuter: THREE.Mesh;
  private light: THREE.PointLight;
  private groundLight: THREE.PointLight;
  private baseIntensity: number;
  private t = 0;

  constructor(intensity = 1.6) {
    this.baseIntensity = intensity;
    this.group = new THREE.Group();
    this.group.name = 'torch';

    // wooden handle (held in the off-hand, raised up like a torch carrier)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.95, flatShading: true }),
    );
    handle.position.y = 0;
    handle.castShadow = true;
    this.group.add(handle);

    // metal cap at the top
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.7, metalness: 0.4, flatShading: true }),
    );
    cap.position.y = 0.32;
    this.group.add(cap);

    // Outer flame — bigger soft halo, low opacity
    this.flameOuter = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({
        color: PALETTE.emberGlow,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.flameOuter.position.y = 0.5;
    this.group.add(this.flameOuter);

    // Inner flame — bright core
    this.flameInner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c0,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.flameInner.position.y = 0.5;
    this.group.add(this.flameInner);

    // Main warm point light — wide reach, gentle falloff so it reads as a real
    // dungeon torch lighting up the surrounding area, not just the character's
    // immediate footprint. range = 24m, decay = 1.0 (linear-ish for soft pool).
    this.light = new THREE.PointLight(PALETTE.ember, intensity, 24, 1.0);
    this.light.position.y = 0.6;
    this.light.castShadow = false; // skip shadow casting for perf — too many enemies
    this.group.add(this.light);

    // Ground-glow light — wider, brighter, pools warmly under the character.
    this.groundLight = new THREE.PointLight(0xffa050, intensity * 0.65, 12, 1.2);
    this.groundLight.position.set(0, -0.8, 0);
    this.group.add(this.groundLight);

    // Position the whole rig in the player's left hand area (off-hand)
    this.group.position.set(-0.55, 1.55, 0.05);
    // Tilt the torch slightly forward like a real carry pose
    this.group.rotation.z = 0.12;
  }

  /**
   * Animate the flame. Called every frame from the player's update loop.
   * Combines two prime-ratio sines with random jitter for natural flicker.
   */
  update(dt: number) {
    this.t += dt;
    // primary flicker — two sines at incommensurate frequencies + small noise
    const f1 = Math.sin(this.t * 11.3);
    const f2 = Math.sin(this.t * 17.7);
    const noise = (Math.random() - 0.5) * 0.4;
    const flicker = 0.85 + (f1 * 0.5 + f2 * 0.3 + noise) * 0.18;

    this.light.intensity = this.baseIntensity * flicker;
    this.groundLight.intensity = this.baseIntensity * 0.4 * flicker;

    // Flame mesh subtly pulses + slowly rotates for a "live fire" feel
    const scale = 0.85 + flicker * 0.25;
    this.flameOuter.scale.setScalar(scale * 1.1);
    this.flameInner.scale.setScalar(scale);
    this.flameOuter.rotation.y += dt * 4;
    this.flameInner.rotation.y -= dt * 6;
    // tiny vertical wobble
    this.flameOuter.position.y = 0.5 + Math.sin(this.t * 8) * 0.02;
    this.flameInner.position.y = 0.5 + Math.sin(this.t * 12 + 1) * 0.015;

    // outer halo opacity also flickers
    (this.flameOuter.material as THREE.MeshBasicMaterial).opacity = 0.45 + flicker * 0.2;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if ((o as any).isMesh) {
        const m = (o as THREE.Mesh);
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  }
}
