import * as THREE from 'three';

/**
 * Smoothed third-person chase cam. Sits behind the target at OFFSET, looks slightly
 * ahead of it. Recoils on damage events via shake().
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private current = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private currentLook = new THREE.Vector3();

  // chase offset (behind, above) — angled for a cinematic third-person view that
  // still shows what's coming at you. Lower angle = more horizon visible.
  private readonly offset = new THREE.Vector3(0, 8, 14);
  private readonly lookOffset = new THREE.Vector3(0, 1.4, -3);
  private readonly followLerp = 6.5;
  private readonly lookLerp = 7.5;

  // shake state
  private shakeAmp = 0;
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeOffset = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Snap immediately — call once at start. */
  snapTo(targetPos: THREE.Vector3) {
    this.target.copy(targetPos);
    this.current.copy(targetPos).add(this.offset);
    this.currentLook.copy(targetPos).add(this.lookOffset);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.currentLook);
  }

  shake(amp: number, duration: number) {
    if (amp > this.shakeAmp) {
      this.shakeAmp = amp;
      this.shakeDuration = duration;
      this.shakeTime = 0;
    }
  }

  update(dt: number, targetPos: THREE.Vector3) {
    this.target.copy(targetPos);
    const desired = this.target.clone().add(this.offset);
    const desiredLook = this.target.clone().add(this.lookOffset);

    // smoothed exponential follow (frame-rate independent)
    const aPos = 1 - Math.exp(-this.followLerp * dt);
    const aLook = 1 - Math.exp(-this.lookLerp * dt);
    this.current.lerp(desired, aPos);
    this.currentLook.lerp(desiredLook, aLook);

    // shake — decays with time
    if (this.shakeAmp > 0) {
      this.shakeTime += dt;
      const t = Math.min(this.shakeTime / this.shakeDuration, 1);
      const decay = 1 - t;
      const amp = this.shakeAmp * decay;
      this.shakeOffset.set(
        (Math.random() - 0.5) * 2 * amp,
        (Math.random() - 0.5) * 2 * amp,
        (Math.random() - 0.5) * 2 * amp,
      );
      if (t >= 1) { this.shakeAmp = 0; this.shakeOffset.set(0, 0, 0); }
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    this.camera.position.copy(this.current).add(this.shakeOffset);
    this.camera.lookAt(this.currentLook);
  }
}
