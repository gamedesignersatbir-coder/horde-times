import * as THREE from 'three';

/**
 * Wraps a GLB-cloned scene + AnimationMixer + a five-state state machine
 * (Idle / Run / Attack / Hit / Death). Single source of truth for clip
 * transitions and strike-frame events.
 *
 * Locomotion (Idle ↔ Run) is interrupted by Attack/Hit one-shots that play
 * over the body, then crossfade back. Death is terminal.
 */

export type AnimState = 'idle' | 'run' | 'attack' | 'hit' | 'death';

const CROSSFADE         = 0.15;
const ATTACK_FADE_IN    = 0.08;
const ATTACK_FADE_OUT   = 0.12;
const HIT_FADE_IN       = 0.05;
const HIT_FADE_OUT      = 0.10;
const DEATH_HOLD_AFTER  = 1.0;   // seconds the body lies flat before onDeathDone
const FPS               = 24;

export interface AnimMeta {
  /** 0-indexed frame within Attack at which damage lands. */
  strikeFrame: number;
  attackTotalFrames: number;
}

export class AnimatedCharacter {
  readonly group: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  private actions: Partial<Record<AnimState, THREE.AnimationAction>> = {};
  private state: AnimState = 'idle';
  private locomotion: 'idle' | 'run' = 'idle';

  // attack strike-frame tracking
  private attackElapsed = 0;
  private attackStrikeTime = 0;
  private attackArmed = false;
  private onStrike: (() => void) | null = null;

  // death hold-and-fire
  private onDeathDone: (() => void) | null = null;
  private deathTimer = 0;

  // hit state
  private hitElapsed = 0;
  private hitDuration = 0;

  constructor(
    asset: { scene: THREE.Group; clips: THREE.AnimationClip[] },
    private meta: AnimMeta = { strikeFrame: 12, attackTotalFrames: 22 },
  ) {
    this.group = asset.scene;
    this.mixer = new THREE.AnimationMixer(this.group);

    const byName = new Map(asset.clips.map(c => [c.name, c]));
    const bind = (name: string, key: AnimState, looped: boolean) => {
      const clip = byName.get(name);
      if (!clip) return;
      const action = this.mixer.clipAction(clip);
      action.setLoop(looped ? THREE.LoopRepeat : THREE.LoopOnce, looped ? Infinity : 1);
      action.clampWhenFinished = !looped;
      this.actions[key] = action;
    };
    bind('Idle',   'idle',   true);
    bind('Run',    'run',    true);
    bind('Attack', 'attack', false);
    bind('Hit',    'hit',    false);
    bind('Death',  'death',  false);

    this.actions.idle?.play();
    this.attackStrikeTime = (this.meta.strikeFrame / FPS);
  }

  currentState(): AnimState { return this.state; }

  setMoving(isMoving: boolean): void {
    if (this.state === 'death') return;
    const next: 'idle' | 'run' = isMoving ? 'run' : 'idle';
    if (next === this.locomotion) return;
    if (this.state === 'idle' || this.state === 'run') {
      this.crossfade(this.state, next, CROSSFADE);
      this.state = next;
    }
    this.locomotion = next;
  }

  setFacing(yaw: number): void {
    this.group.rotation.y = yaw;
  }

  /**
   * Play the Attack one-shot. onStrike fires once when the clip reaches the
   * documented strike-frame. If the GLB has no Attack clip we fire onStrike
   * immediately so weapon damage still works.
   */
  playAttack(onStrike: () => void): void {
    if (this.state === 'death') return;
    const a = this.actions.attack;
    if (!a) { onStrike(); return; }
    a.reset().setEffectiveWeight(1).fadeIn(ATTACK_FADE_IN).play();
    const loco = this.actions[this.locomotion];
    if (loco) loco.fadeOut(ATTACK_FADE_IN);
    this.state = 'attack';
    this.attackElapsed = 0;
    this.attackArmed = true;
    this.onStrike = onStrike;
  }

  playHit(): void {
    if (this.state === 'death' || this.state === 'attack') return;
    const a = this.actions.hit;
    if (!a) return;
    a.reset().setEffectiveWeight(0.85).fadeIn(HIT_FADE_IN).play();
    this.hitElapsed = 0;
    this.hitDuration = a.getClip().duration;
    this.state = 'hit';
  }

  playDeath(onDone: () => void): void {
    const a = this.actions.death;
    this.state = 'death';
    if (!a) { onDone(); return; }
    Object.values(this.actions).forEach(act => act && act !== a && act.fadeOut(0.1));
    a.reset().setEffectiveWeight(1).fadeIn(0.1).play();
    this.onDeathDone = onDone;
    this.deathTimer = 0;
  }

  /** Reset to Idle, clear all locks. Used when respawning enemy pool slots. */
  reset(): void {
    Object.values(this.actions).forEach(a => a && a.stop());
    this.state = 'idle';
    this.locomotion = 'idle';
    this.attackArmed = false;
    this.deathTimer = 0;
    this.onStrike = null;
    this.onDeathDone = null;
    this.group.rotation.set(0, 0, 0);
    this.actions.idle?.reset().play();
  }

  update(dt: number): void {
    this.mixer.update(dt);

    // Strike-frame detection.
    if (this.state === 'attack' && this.attackArmed) {
      this.attackElapsed += dt;
      if (this.attackElapsed >= this.attackStrikeTime) {
        this.attackArmed = false;
        const cb = this.onStrike;
        this.onStrike = null;
        cb?.();
      }
    }

    // Attack clip end → return to locomotion.
    if (this.state === 'attack') {
      const a = this.actions.attack!;
      if (a.time >= a.getClip().duration - 0.001) {
        this.crossfade('attack', this.locomotion, ATTACK_FADE_OUT);
        this.state = this.locomotion;
        this.attackArmed = false;
        this.onStrike = null;
      }
    }

    // Hit clip end → return to locomotion.
    if (this.state === 'hit') {
      this.hitElapsed += dt;
      if (this.hitElapsed >= this.hitDuration - 0.001) {
        this.crossfade('hit', this.locomotion, HIT_FADE_OUT);
        this.state = this.locomotion;
      }
    }

    // Death tail timer → fire onDone after clip + lie-still hold.
    if (this.state === 'death' && this.onDeathDone) {
      this.deathTimer += dt;
      const clipDur = this.actions.death?.getClip().duration ?? 1.25;
      if (this.deathTimer >= clipDur + DEATH_HOLD_AFTER) {
        const cb = this.onDeathDone;
        this.onDeathDone = null;
        cb();
      }
    }
  }

  private crossfade(from: AnimState, to: AnimState, dur: number) {
    const a = this.actions[from];
    const b = this.actions[to];
    if (b) b.reset().setEffectiveWeight(1).fadeIn(dur).play();
    if (a && a !== b) a.fadeOut(dur);
  }
}
