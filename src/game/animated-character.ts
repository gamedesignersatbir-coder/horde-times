import * as THREE from 'three';

/**
 * Wraps a GLB-cloned scene + AnimationMixer + a five-state state machine
 * (Idle / Run / Attack / Hit / Death). Single source of truth for clip
 * transitions. Owns smooth turning so the caller never touches rotation.y.
 *
 * Phase A delivers Idle/Run only. Attack/Hit/Death added in Phase B.
 */

export type AnimState = 'idle' | 'run' | 'attack' | 'hit' | 'death';

const CROSSFADE = 0.15;

export class AnimatedCharacter {
  readonly group: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  private actions: Partial<Record<AnimState, THREE.AnimationAction>> = {};
  private state: AnimState = 'idle';

  constructor(asset: { scene: THREE.Group; clips: THREE.AnimationClip[] }) {
    this.group = asset.scene;
    this.mixer = new THREE.AnimationMixer(this.group);

    const byName = new Map(asset.clips.map(c => [c.name, c]));
    const idle = byName.get('Idle');
    const run = byName.get('Run');
    if (idle) this.actions.idle = this.mixer.clipAction(idle);
    if (run) this.actions.run = this.mixer.clipAction(run);

    this.actions.idle?.play();
  }

  currentState(): AnimState { return this.state; }

  setMoving(isMoving: boolean): void {
    const next: AnimState = isMoving ? 'run' : 'idle';
    if (next === this.state) return;
    this.crossfade(this.state, next, CROSSFADE);
    this.state = next;
  }

  setFacing(yaw: number): void {
    this.group.rotation.y = yaw;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  private crossfade(from: AnimState, to: AnimState, dur: number) {
    const a = this.actions[from];
    const b = this.actions[to];
    if (b) b.reset().setEffectiveWeight(1).fadeIn(dur).play();
    if (a && a !== b) a.fadeOut(dur);
  }
}
