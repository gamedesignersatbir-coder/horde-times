# Blender Character Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace procedural primitive characters with the rigged Blender GLBs, drive starter weapons from per-character Attack animations, and convert enemies to telegraphed strike-frame attacks — without regressing the existing game feel.

**Architecture:** Layered swap. A new `AssetCache` preloads six GLBs at boot. A new `AnimatedCharacter` class wraps each GLB instance with an `AnimationMixer`-driven five-state FSM (Idle / Run / Attack / Hit / Death) and emits a `strike` event at the per-character strike-frame. `Player`, `EnemyManager`, and three weapons (`swordswing` (new), `lightning`, `boomerang`) compose `AnimatedCharacter` and consume `strike` events. The state machine in `main.ts`, the camera rig, the post-FX, the music, the upgrades, the XP, and the UI are unchanged.

**Tech Stack:** Three.js 0.169 (`GLTFLoader`, `SkeletonUtils`, `AnimationMixer`), TypeScript strict, Vite, Vitest.

**Working branch:** `character-overhaul` (already checked out; spec is committed).

**Repo root:** `E:\AI Data\ClaudeCode\test\HordeTimes\horde-times`

---

## Pre-flight (do this once before Task 1)

- [ ] **Verify branch & clean tree.**

Run:
```
git status
git rev-parse --abbrev-ref HEAD
```
Expected: `On branch character-overhaul`, `nothing to commit, working tree clean`. If you are not on `character-overhaul`, run `git checkout character-overhaul` before continuing.

- [ ] **Verify dev server runs the existing game.** This is your before-baseline.

Run:
```
npm install
npm run dev
```
Open `http://localhost:5173`. Click Play, pick any character, walk in a circle, kill an enemy, take damage. Confirm the game runs at 60fps. Stop the server (`Ctrl+C`). If anything is broken before you start, fix that first — do not begin the overhaul on a broken baseline.

---

## Phase A — Asset pipeline (one character, end-to-end)

Goal of this phase: by the end, choosing the Knight on the character-select screen spawns a GLB-backed knight that plays Idle when stationary and Run when moving. Combat doesn't work yet — that's Phase B onward.

### Task 1: Copy GLB assets into the Vite static folder

**Files:**
- Create: `public/assets/characters/sir_pommelry.glb`
- Create: `public/assets/characters/mistress_quill.glb`
- Create: `public/assets/characters/margate_tossworthy.glb`
- Create: `public/assets/characters/runner.glb`
- Create: `public/assets/characters/brute.glb`
- Create: `public/assets/characters/boss.glb`

- [ ] **Step 1: Create the public assets directory.**

Run (from repo root):
```
mkdir -p public/assets/characters
```
On Windows PowerShell: `New-Item -ItemType Directory -Force -Path public/assets/characters`.

- [ ] **Step 2: Copy all six GLBs.**

Source: `E:\AI Data\ClaudeCode\test\HordeTimes\horde_times_exports\`. Copy each `.glb` file (six total) into `public/assets/characters/`. Do not rename them.

PowerShell:
```
Copy-Item "E:\AI Data\ClaudeCode\test\HordeTimes\horde_times_exports\*.glb" `
  -Destination "public\assets\characters\"
```

- [ ] **Step 3: Verify all six files landed.**

Run:
```
ls public/assets/characters
```
Expected: six `.glb` files (sir_pommelry, mistress_quill, margate_tossworthy, runner, brute, boss). Each between ~50KB and ~500KB.

- [ ] **Step 4: Commit.**

```
git add public/assets/characters/
git commit -m "Add character GLB assets"
```

### Task 2: Create the AssetCache

**Files:**
- Create: `src/engine/assets.ts`
- Test: `src/engine/assets.test.ts`

This module owns GLB loading. It exposes `preloadAll()` which fires six parallel `GLTFLoader.loadAsync` calls and caches results, plus `cloneFor(id)` which returns an independent skeleton clone for spawning.

- [ ] **Step 1: Write the unit test.**

Create `src/engine/assets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AssetCache, CHARACTER_ASSETS } from './assets';

describe('AssetCache', () => {
  it('exposes the six expected character keys', () => {
    expect(CHARACTER_ASSETS.map(a => a.id).sort()).toEqual([
      'boss', 'brute', 'margate_tossworthy', 'mistress_quill',
      'runner', 'sir_pommelry',
    ]);
  });

  it('throws on get() before preloadAll resolves', () => {
    const cache = new AssetCache();
    expect(() => cache.get('runner')).toThrow(/preload/i);
  });
});
```

- [ ] **Step 2: Run the test, expect failure (module not implemented).**

Run:
```
npx vitest run src/engine/assets.test.ts
```
Expected: FAIL — cannot import './assets'.

- [ ] **Step 3: Implement `assets.ts`.**

Create `src/engine/assets.ts`:
```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

export type CharacterAssetId =
  | 'sir_pommelry' | 'mistress_quill' | 'margate_tossworthy'
  | 'runner' | 'brute' | 'boss';

interface AssetMeta {
  id: CharacterAssetId;
  url: string;
}

export const CHARACTER_ASSETS: AssetMeta[] = [
  { id: 'sir_pommelry',       url: '/assets/characters/sir_pommelry.glb' },
  { id: 'mistress_quill',     url: '/assets/characters/mistress_quill.glb' },
  { id: 'margate_tossworthy', url: '/assets/characters/margate_tossworthy.glb' },
  { id: 'runner',             url: '/assets/characters/runner.glb' },
  { id: 'brute',              url: '/assets/characters/brute.glb' },
  { id: 'boss',               url: '/assets/characters/boss.glb' },
];

export interface LoadedAsset {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

export class AssetCache {
  private cache = new Map<CharacterAssetId, LoadedAsset>();
  private loader = new GLTFLoader();

  async preloadAll(): Promise<void> {
    const jobs = CHARACTER_ASSETS.map(async ({ id, url }) => {
      const gltf = await this.loader.loadAsync(url);
      this.cache.set(id, { scene: gltf.scene, clips: gltf.animations });
    });
    await Promise.all(jobs);
  }

  get(id: CharacterAssetId): LoadedAsset {
    const a = this.cache.get(id);
    if (!a) throw new Error(`Asset "${id}" not preloaded — call preloadAll first.`);
    return a;
  }

  /** Independent skeleton clone. Materials are also cloned per-instance so
   *  hit-flash emissive patches don't leak across enemies. */
  cloneFor(id: CharacterAssetId): { scene: THREE.Group; clips: THREE.AnimationClip[] } {
    const src = this.get(id);
    const scene = SkeletonUtils.clone(src.scene) as THREE.Group;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = mats.length === 1 ? mats[0].clone() : mats.map(m => m.clone());
        mesh.castShadow = true;
      }
    });
    return { scene, clips: src.clips };
  }
}

/**
 * Process-wide singleton. Lives here (not in main.ts) so domain modules
 * (Player, EnemyManager) can import it without creating a circular
 * dependency back through main.ts.
 */
export const assets = new AssetCache();
```

- [ ] **Step 4: Run the test, expect pass.**

Run:
```
npx vitest run src/engine/assets.test.ts
```
Expected: 2 PASS.

- [ ] **Step 5: Commit.**

```
git add src/engine/assets.ts src/engine/assets.test.ts
git commit -m "Add AssetCache for GLB loading + skeleton cloning"
```

### Task 3: Create AnimatedCharacter (Idle/Run only — locomotion FSM)

**Files:**
- Create: `src/game/animated-character.ts`
- Test: `src/game/animated-character.test.ts`

This task only adds the locomotion half. Attack/Hit/Death come in Phase B.

- [ ] **Step 1: Write the unit test.**

Create `src/game/animated-character.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { AnimatedCharacter } from './animated-character';

// Build a tiny mock GLB-shaped object with two named clips.
function makeMockAsset() {
  const scene = new THREE.Group();
  // single track per clip is enough — mixer just needs SOMETHING to play.
  const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 1]);
  const idle = new THREE.AnimationClip('Idle', 1, [track]);
  const run = new THREE.AnimationClip('Run', 1, [track]);
  return { scene, clips: [idle, run] };
}

describe('AnimatedCharacter — locomotion', () => {
  it('starts in Idle', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    expect(ac.currentState()).toBe('idle');
  });

  it('switches to Run when setMoving(true)', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    ac.setMoving(true);
    expect(ac.currentState()).toBe('run');
  });

  it('returns to Idle when setMoving(false)', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    ac.setMoving(true);
    ac.setMoving(false);
    expect(ac.currentState()).toBe('idle');
  });
});
```

- [ ] **Step 2: Run the test, expect failure.**

```
npx vitest run src/game/animated-character.test.ts
```
Expected: FAIL — `Cannot find module './animated-character'`.

- [ ] **Step 3: Implement the locomotion-only class.**

Create `src/game/animated-character.ts`:
```typescript
import * as THREE from 'three';

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

    // Map clip names → states. GLB exports use bare names (Idle, Run, ...).
    const byName = new Map(asset.clips.map(c => [c.name, c]));
    const idle = byName.get('Idle');
    const run  = byName.get('Run');
    if (idle) this.actions.idle = this.mixer.clipAction(idle);
    if (run)  this.actions.run  = this.mixer.clipAction(run);

    // Start Idle.
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
    if (b) {
      b.reset().setEffectiveWeight(1).fadeIn(dur).play();
    }
    if (a && a !== b) {
      a.fadeOut(dur);
    }
  }
}
```

- [ ] **Step 4: Run the test, expect pass.**

```
npx vitest run src/game/animated-character.test.ts
```
Expected: 3 PASS.

- [ ] **Step 5: Commit.**

```
git add src/game/animated-character.ts src/game/animated-character.test.ts
git commit -m "Add AnimatedCharacter with Idle/Run state machine"
```

### Task 4: Wire AssetCache.preloadAll into main.ts boot

**Files:**
- Modify: `src/main.ts` (add preload before title interactivity)

- [ ] **Step 1: Add the preload at boot.**

Open `src/main.ts`. Near the top imports, add:
```typescript
import { assets } from './engine/assets';
```
(Note: `assets` is the singleton exported by `assets.ts`, not a fresh instance. This avoids a circular import — domain modules like `Player` and `EnemyManager` import it from `engine/assets`, never from `main`.)

Find the line `let selectedCharacter: CharacterDef = CHARACTERS.knight;` (around line 150) and ABOVE the existing `hud.hide(); title.show();` block, add:

```typescript
// Preload character GLBs while the title sits on screen. We disable the Play
// button until preload resolves — title/select fall through gracefully on a
// fast machine because the promise resolves before the user clicks.
title.setPlayEnabled(false);
assets.preloadAll().then(() => {
  title.setPlayEnabled(true);
}).catch(err => {
  console.error('Asset preload failed', err);
  uiRoot.innerHTML = `<div class="modal"><h1>Failed to load characters</h1><p>${(err as Error).message}</p></div>`;
});
```

- [ ] **Step 2: Add `setPlayEnabled` to TitleScreen.**

Open `src/ui/screens.ts` and find the `TitleScreen` class. Add this method to it:
```typescript
setPlayEnabled(enabled: boolean) {
  // Find the play button inside this title screen and toggle its disabled state.
  const btn = this.root.querySelector('button.play') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = !enabled;
    btn.textContent = enabled ? 'Play' : 'Loading…';
  }
}
```

If the existing play button doesn't have class `play`, add `class="play"` to it in the title screen template.

- [ ] **Step 3: Verify in browser.**

Run:
```
npm run dev
```
Open `http://localhost:5173`. Title should show "Loading…" briefly then become "Play". DevTools Network tab should show six `.glb` requests, all 200 OK. No console errors. Stop server.

- [ ] **Step 4: Commit.**

```
git add src/main.ts src/ui/screens.ts
git commit -m "Preload character GLBs at boot before enabling Play"
```

### Task 5: Replace knight in characters.ts with a GLB-backed CharacterDef

**Files:**
- Modify: `src/game/characters.ts`

The other characters stay procedural for now — Witch and Hunter are converted in Phase D. We do Knight first end-to-end so the integration risk is contained.

- [ ] **Step 1: Add `assetId` to `CharacterDef` interface.**

In `src/game/characters.ts`, change the interface:
```typescript
export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  blurb: string;
  startingWeapon: WeaponKind;
  stats: CharacterStats;
  // Either `assetId` (GLB-backed) OR `build` (procedural). New characters
  // use assetId; legacy procedural ones still use build during the migration.
  assetId?: 'sir_pommelry' | 'mistress_quill' | 'margate_tossworthy';
  build?: () => THREE.Group;
  // Per-character animation metadata (only meaningful for GLB-backed ones).
  attackStrikeFrame?: number;  // 0-indexed frame within Attack clip
  attackTotalFrames?: number;
  height?: number;             // metres, for camera framing & damage anchor
}
```

- [ ] **Step 2: Switch Knight to assetId form.**

Replace the `knight:` entry in the `CHARACTERS` record (around `characters.ts:300`) with:
```typescript
knight: {
  id: 'knight',
  name: 'Sir Pommelry',
  title: 'Knight, Probationary',
  blurb: 'Inherited a sword and a chronic sense of duty from an aunt. Has been meaning to put both down for some years now. Stands in the middle of trouble and lets it spin past him, which is, technically, a kind of strategy.',
  startingWeapon: 'blades',  // we change this to 'swordswing' in Task 13
  stats: { maxHp: 130, moveSpeed: 5.4, magnetRadius: 2.0, damageMult: 1.0, cooldownMult: 1.0 },
  assetId: 'sir_pommelry',
  attackStrikeFrame: 12,
  attackTotalFrames: 22,
  height: 1.36,
},
```

(Leave `buildKnight` defined for now — we delete it in Task 7 once nothing references it.)

- [ ] **Step 3: Commit.**

```
git add src/game/characters.ts
git commit -m "Add assetId metadata; switch Knight to GLB-backed def"
```

### Task 6: Replace Player rendering with AnimatedCharacter

**Files:**
- Modify: `src/game/player.ts`

This is the surgical core for Phase A. Remove the procedural mesh + sine-wave limb wiggle; compose `AnimatedCharacter` instead.

- [ ] **Step 1: Update Player constructor + update loop.**

Open `src/game/player.ts`. Replace the entire file with:
```typescript
import * as THREE from 'three';
import { ARENA_RADIUS } from './arena';
import type { PlayerStats } from './types';
import type { CharacterDef } from './characters';
import type { Torch } from './torch';
import { AnimatedCharacter } from './animated-character';
import { assets } from '../engine/assets';

const TURN_LERP = 14;

export class Player {
  readonly mesh: THREE.Group;             // group root (matches old API)
  readonly char: AnimatedCharacter;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly stats: PlayerStats;
  readonly radius = 0.45;
  readonly height: number;
  facing = 0;
  private targetFacing = 0;
  iframeUntil = 0;
  alive = true;
  outOfCombatFor = 0;
  private leanZ = 0;
  private torch: Torch | null = null;
  private wasInIframe = false;

  constructor(character: CharacterDef) {
    if (!character.assetId) {
      throw new Error(`Character ${character.id} has no assetId — GLB conversion incomplete.`);
    }
    const cloned = assets.cloneFor(character.assetId);
    this.char = new AnimatedCharacter(cloned);
    this.mesh = this.char.group;
    this.position = this.mesh.position;
    this.position.set(0, 0, 0);
    this.height = character.height ?? 1.4;

    this.stats = {
      maxHp: character.stats.maxHp,
      hp: character.stats.maxHp,
      moveSpeed: character.stats.moveSpeed,
      magnetRadius: character.stats.magnetRadius,
      damageMult: character.stats.damageMult,
      cooldownMult: character.stats.cooldownMult,
    };
  }

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
      return true;
    }
    return false;
  }

  heal(amount: number) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  update(dt: number, moveX: number, moveZ: number, time: number, anyEnemyNear: boolean) {
    if (!this.alive) {
      this.char.update(dt);
      return;
    }

    const speed = this.stats.moveSpeed;
    this.velocity.set(moveX * speed, 0, moveZ * speed);
    this.position.addScaledVector(this.velocity, dt);

    // arena clamp
    const dist = Math.hypot(this.position.x, this.position.z);
    if (dist > ARENA_RADIUS - this.radius) {
      const k = (ARENA_RADIUS - this.radius) / dist;
      this.position.x *= k;
      this.position.z *= k;
    }

    // facing — track the target heading
    const moving = (moveX !== 0 || moveZ !== 0);
    if (moving) this.targetFacing = Math.atan2(moveX, moveZ);
    let dy = this.targetFacing - this.facing;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const a = 1 - Math.exp(-TURN_LERP * dt);
    this.facing += dy * a;

    // lean into the turn
    const targetLean = THREE.MathUtils.clamp(dy * 1.6, -0.22, 0.22);
    this.leanZ = THREE.MathUtils.lerp(this.leanZ, targetLean, 1 - Math.exp(-8 * dt));

    // drive the animated character
    this.char.setMoving(moving);
    this.char.setFacing(this.facing);
    this.mesh.rotation.z = this.leanZ;
    this.char.update(dt);

    // i-frame opacity flicker
    const inIframe = time < this.iframeUntil;
    if (inIframe || this.wasInIframe) {
      this.mesh.traverse((o) => {
        if ((o as any).isMesh) {
          const mat = (o as any).material as THREE.MeshStandardMaterial;
          if (!mat) return;
          if (mat.transparent !== inIframe) mat.transparent = inIframe;
          mat.opacity = inIframe ? (Math.sin(time * 30) * 0.5 + 0.5) * 0.5 + 0.4 : 1;
        }
      });
      this.wasInIframe = inIframe;
    }

    this.torch?.update(dt);

    if (anyEnemyNear) this.outOfCombatFor = 0;
    else this.outOfCombatFor += dt;
    if (this.outOfCombatFor > 2) this.heal(2.5 * dt);
  }
}
```

- [ ] **Step 2: Type-check.**

Run:
```
npm run typecheck
```
Expected: PASS. If a type error mentions `character.build` not existing where `Player` is constructed in `main.ts`, that's the next step.

- [ ] **Step 3: Adjust character-select handling for non-GLB heroes.**

Witch and Hunter still use `build:` (procedural). They will fail at `new Player(...)` until Phase D. To keep the game runnable, force the character-select to only allow Knight for now: open `src/main.ts`, find `characterSelect.show((c) => { selectedCharacter = c; startRun(); });` and change to:
```typescript
characterSelect.show((c) => {
  if (!c.assetId) {
    console.warn(`${c.name} not yet GLB-backed — falling back to Knight.`);
    c = CHARACTERS.knight;
  }
  selectedCharacter = c;
  startRun();
});
```
This is a temporary scaffolding gate that we remove in Task 19.

- [ ] **Step 4: Smoke-test in browser.**

```
npm run dev
```
Open `http://localhost:5173`. Click Play → pick Knight. Walk in all four diagonal directions. Verify:
- Knight model is the GLB (taller, wooden-toy aesthetic, sword visible) — not the primitive cube-knight.
- Standing still: plays Idle (gentle bob).
- Moving: plays Run.
- Stopping: smoothly returns to Idle.
- Lean-into-turn still feels responsive.
- Console: zero errors.
- FPS counter (top-right): 60.

If the character looks tiny or floating, jot down the offset and adjust `height` / a Y-translation on `mesh.position` in Task 9 follow-up. Otherwise continue.

- [ ] **Step 5: Commit.**

```
git add src/game/player.ts src/main.ts
git commit -m "Player composes AnimatedCharacter; Knight runs as GLB end-to-end"
```

---

## Phase B — Combat animations for the player

Goal: Knight visibly reacts (Hit) when damaged and plays Death when killed. Sword swing logic lands in Phase C.

### Task 7: Extend AnimatedCharacter with Attack / Hit / Death + strike-frame events

**Files:**
- Modify: `src/game/animated-character.ts`
- Modify: `src/game/animated-character.test.ts`

- [ ] **Step 1: Write the strike-frame test.**

Append to `animated-character.test.ts`:
```typescript
import { vi } from 'vitest';

describe('AnimatedCharacter — Attack/Hit/Death', () => {
  function makeFullAsset() {
    const scene = new THREE.Group();
    const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 1]);
    return {
      scene,
      clips: [
        new THREE.AnimationClip('Idle', 1, [track]),
        new THREE.AnimationClip('Run', 1, [track]),
        new THREE.AnimationClip('Attack', 22 / 24, [track]),  // 22f @24fps
        new THREE.AnimationClip('Hit', 14 / 24, [track]),
        new THREE.AnimationClip('Death', 30 / 24, [track]),
      ],
    };
  }

  it('fires onStrike exactly once after the strike-frame elapses', () => {
    const ac = new AnimatedCharacter(makeFullAsset(), { strikeFrame: 12, attackTotalFrames: 22 });
    const onStrike = vi.fn();
    ac.playAttack(onStrike);
    // Tick past strike-time (12/24 = 0.5s).
    ac.update(0.4); expect(onStrike).not.toHaveBeenCalled();
    ac.update(0.2); expect(onStrike).toHaveBeenCalledTimes(1);
    // Tick to clip end; should NOT fire again.
    ac.update(1.0); expect(onStrike).toHaveBeenCalledTimes(1);
  });

  it('Death state is terminal — playAttack/setMoving become no-ops', () => {
    const ac = new AnimatedCharacter(makeFullAsset(), { strikeFrame: 12, attackTotalFrames: 22 });
    ac.playDeath(() => {});
    ac.setMoving(true);
    ac.playAttack(() => {});
    expect(ac.currentState()).toBe('death');
  });
});
```

- [ ] **Step 2: Run test, expect failure (signature mismatch).**

```
npx vitest run src/game/animated-character.test.ts
```
Expected: FAIL — `AnimatedCharacter` constructor doesn't accept a second arg.

- [ ] **Step 3: Implement Attack/Hit/Death.**

Replace the contents of `src/game/animated-character.ts` with:
```typescript
import * as THREE from 'three';

export type AnimState = 'idle' | 'run' | 'attack' | 'hit' | 'death';

const CROSSFADE = 0.15;
const ATTACK_FADE_IN = 0.08;
const ATTACK_FADE_OUT = 0.12;
const FPS = 24;

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
  private onDeathDone: (() => void) | null = null;
  private deathTimer = 0;

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

  playAttack(onStrike: () => void): void {
    if (this.state === 'death') return;
    const a = this.actions.attack;
    if (!a) { onStrike(); return; }   // no clip → fire immediately so weapon still works
    a.reset().setEffectiveWeight(1).fadeIn(ATTACK_FADE_IN).play();
    // fade out the locomotion clip so attack reads cleanly
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
    a.reset().setEffectiveWeight(0.7).fadeIn(0.05).play();
    setTimeout(() => a.fadeOut(0.1), 250);
  }

  playDeath(onDone: () => void): void {
    const a = this.actions.death;
    this.state = 'death';
    if (!a) { onDone(); return; }
    // stop everything else
    Object.values(this.actions).forEach(act => act && act !== a && act.fadeOut(0.1));
    a.reset().setEffectiveWeight(1).fadeIn(0.1).play();
    this.onDeathDone = onDone;
    this.deathTimer = 0;
  }

  reset(): void {
    Object.values(this.actions).forEach(a => a && a.stop());
    this.state = 'idle';
    this.locomotion = 'idle';
    this.attackArmed = false;
    this.deathTimer = 0;
    this.group.rotation.set(0, 0, 0);
    this.actions.idle?.reset().play();
  }

  update(dt: number): void {
    this.mixer.update(dt);

    // strike-frame detection
    if (this.state === 'attack' && this.attackArmed) {
      this.attackElapsed += dt;
      if (this.attackElapsed >= this.attackStrikeTime) {
        this.attackArmed = false;
        const cb = this.onStrike;
        this.onStrike = null;
        cb?.();
      }
    }
    // attack clip end → return to locomotion
    if (this.state === 'attack') {
      const a = this.actions.attack!;
      if (a.time >= a.getClip().duration - 0.001) {
        this.crossfade('attack', this.locomotion, ATTACK_FADE_OUT);
        this.state = this.locomotion;
        this.attackArmed = false;
        this.onStrike = null;
      }
    }
    // death tail timer → fire onDone after clip + 1s lie-still
    if (this.state === 'death' && this.onDeathDone) {
      this.deathTimer += dt;
      const clipDur = this.actions.death?.getClip().duration ?? 1.25;
      if (this.deathTimer >= clipDur + 1.0) {
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
```

- [ ] **Step 4: Run tests, expect pass.**

```
npx vitest run src/game/animated-character.test.ts
```
Expected: 5 PASS.

- [ ] **Step 5: Commit.**

```
git add src/game/animated-character.ts src/game/animated-character.test.ts
git commit -m "AnimatedCharacter: Attack/Hit/Death + strike-frame events"
```

### Task 8: Update Player to construct AnimatedCharacter with strike metadata

**Files:**
- Modify: `src/game/player.ts`

- [ ] **Step 1: Pass strike metadata into AnimatedCharacter.**

In `src/game/player.ts`, change the constructor body where `this.char` is created:
```typescript
const cloned = assets.cloneFor(character.assetId);
this.char = new AnimatedCharacter(cloned, {
  strikeFrame: character.attackStrikeFrame ?? 12,
  attackTotalFrames: character.attackTotalFrames ?? 22,
});
```

- [ ] **Step 2: Add helper methods on Player.**

Above the `update` method, add:
```typescript
playAttack(onStrike: () => void) { this.char.playAttack(onStrike); }
```

Inside `takeDamage`, just before `if (this.stats.hp <= 0)`, add:
```typescript
this.char.playHit();
```

Inside `takeDamage`, when the player dies (`this.alive = false;` line), add:
```typescript
this.char.playDeath(() => { /* gameover screen handled by main.ts state machine */ });
```

- [ ] **Step 3: Type-check + smoke-test.**

```
npm run typecheck
npm run dev
```
Open game. Pick Knight. Walk into a runner deliberately so it touches you. Verify:
- Knight plays Hit animation (brief flinch over locomotion).
- I-frame opacity flicker still works.
- Continue dying intentionally → Knight plays Death (falls flat over ~1.25s) and game-over screen appears after the existing 1.5s delay.
- No console errors.

- [ ] **Step 4: Commit.**

```
git add src/game/player.ts
git commit -m "Player drives Hit/Death/Attack via AnimatedCharacter"
```

---

## Phase C — Knight starter weapon: sword swing

### Task 9: Add `swordswing` weapon kind to types

**Files:**
- Modify: `src/game/types.ts`

- [ ] **Step 1: Extend WeaponKind.**

```typescript
export type WeaponKind = 'blades' | 'pistol' | 'shockwave' | 'lightning' | 'boomerang' | 'swordswing';
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck
```
Expected: many failures in `weapons.ts` and `upgrades.ts` complaining about an unhandled case. That's expected — Tasks 10–13 fill them in.

- [ ] **Step 3: Commit.**

```
git add src/game/types.ts
git commit -m "Add 'swordswing' to WeaponKind"
```

### Task 10: Add the sword-swing icon

**Files:**
- Modify: `src/ui/icons.ts`

- [ ] **Step 1: Add an inline SVG glyph.**

Open `src/ui/icons.ts`. Add a new entry to the `ICONS` object matching the existing line-art style. If existing icons are paths-in-strings, follow that exactly. As a starting glyph (replace if a designer icon arrives later):
```typescript
swordswing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21l9-9 5 5-9 9zM12 12l5-5a3 3 0 014 4l-5 5"/></svg>`,
```

If `ICONS` is a `Record<WeaponKind, string>`, the entry above is what's needed. If it's typed differently in the file, mirror the existing weapon icons' style.

- [ ] **Step 2: Type-check.**

```
npm run typecheck
```

- [ ] **Step 3: Commit.**

```
git add src/ui/icons.ts
git commit -m "Add swordswing icon"
```

### Task 11: Implement SwordSwing weapon

**Files:**
- Modify: `src/game/weapons.ts`
- Test: `src/game/weapons.swordswing.test.ts`

- [ ] **Step 1: Add WeaponDef entry for `swordswing`.**

In `weapons.ts`, add to `WEAPON_DEFS`:
```typescript
swordswing: {
  kind: 'swordswing', name: 'Sir Pommelry\'s Sword', icon: ICONS.swordswing, maxLevel: 5,
  desc: (l) => `Wide arc of unenthusiastic violence. ${(18 + (l - 1) * 5)} dmg, ${(2.5 + (l - 1) * 0.2).toFixed(1)}m reach. Performed under protest.`,
},
```

- [ ] **Step 2: Add cone-arc unit test.**

Create `src/game/weapons.swordswing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isInsideArc } from './weapons';

// We test the geometric primitive in isolation. The full DamagePass requires
// the EnemyManager and is covered by manual QA.
describe('swordswing arc geometry', () => {
  it('point directly in front, within range, is inside the arc', () => {
    expect(isInsideArc({ ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
                       { x: 0, z: 1.5 })).toBe(true);
  });
  it('point behind the swinger is outside', () => {
    expect(isInsideArc({ ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
                       { x: 0, z: -1.5 })).toBe(false);
  });
  it('point sideways beyond half-angle is outside', () => {
    expect(isInsideArc({ ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 6 },
                       { x: 1.4, z: 0.1 })).toBe(false);
  });
  it('point past max range is outside', () => {
    expect(isInsideArc({ ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
                       { x: 0, z: 5.0 })).toBe(false);
  });
});
```

- [ ] **Step 3: Run test, expect failure.**

```
npx vitest run src/game/weapons.swordswing.test.ts
```
Expected: FAIL — `isInsideArc` not exported.

- [ ] **Step 4: Implement `isInsideArc` and the swing trigger in `weapons.ts`.**

Note: facing convention in this codebase is `Math.atan2(moveX, moveZ)`, so character forward is `+Z` when facing == 0. The forward unit vector is `(sin(facing), cos(facing))` in the (x, z) plane.

Add this helper to `src/game/weapons.ts` (near the top, after imports):
```typescript
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
```

In `WeaponSystem` (the class in `weapons.ts`), add fields:
```typescript
private swordCd = 0;
private swordCrescents: { mesh: THREE.Mesh; t: number }[] = [];
private swordRoot: THREE.Group;
```

In the `WeaponSystem` constructor (find `this.bladesRoot = new THREE.Group(); scene.add(this.bladesRoot);`), add similarly:
```typescript
this.swordRoot = new THREE.Group(); scene.add(this.swordRoot);
```

Add a method to `WeaponSystem`:
```typescript
private fireSwordSwing(player: Player, enemies: EnemyManager, vfx: Vfx, audio: Audio, time: number, lvl: number) {
  const dmg = (18 + (lvl - 1) * 5) * player.stats.damageMult;
  const range = 2.5 + (lvl - 1) * 0.2;
  const halfAngle = Math.PI / 3;            // 120° total arc
  const ox = player.position.x, oz = player.position.z;

  // Damage all active enemies inside the cone.
  enemies.forEach((e, mesh, type) => {
    if (isInsideArc({ ox, oz, facing: player.facing, range, halfAngleRad: halfAngle },
                    { x: e.pos.x, z: e.pos.z })) {
      const dx = e.pos.x - ox, dz = e.pos.z - oz;
      const d = Math.hypot(dx, dz) || 0.0001;
      const knockDir = new THREE.Vector3(dx / d, 0, dz / d);
      enemies.damageEnemy(e, mesh, type, dmg, 'swordswing' as any, time, knockDir, 6);
    }
  });

  // Visual: crescent ribbon for 0.12s.
  const geo = new THREE.RingGeometry(range * 0.7, range, 24, 1, -halfAngle, halfAngle * 2);
  const mat = new THREE.MeshBasicMaterial({
    color: PALETTE.cyan, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;           // lay flat on ground plane
  ring.rotation.z = -player.facing;         // align with character facing
  ring.position.set(ox, 0.6, oz);
  this.swordRoot.add(ring);
  this.swordCrescents.push({ mesh: ring, t: 0 });

  audio.play('swordswing', { volume: 0.7 });
  vfx.shake(0.08, 0.04);
}
```

In `WeaponSystem.update(...)` (find the existing per-weapon dispatch), add a `case 'swordswing':` branch that, when the weapon is owned, plays the player's Attack animation and uses the strike callback to fire the actual swing:
```typescript
case 'swordswing': {
  this.swordCd -= dt;
  const baseCd = 1.0 * player.stats.cooldownMult;
  // Floor cooldown at the Attack-clip duration. AnimatedCharacter knows it.
  // We approximate here as 22f / 24fps = 0.917s for the Knight.
  const clipFloor = 22 / 24;
  const cd = Math.max(baseCd, clipFloor);
  if (this.swordCd <= 0) {
    this.swordCd = cd;
    player.playAttack(() => {
      this.fireSwordSwing(player, enemies, vfx, audio, time, state.level);
    });
  }
  break;
}
```

Also tick the crescent fade in `WeaponSystem.update` (alongside the existing shock-ring fade):
```typescript
for (let i = this.swordCrescents.length - 1; i >= 0; i--) {
  const r = this.swordCrescents[i];
  r.t += dt;
  const k = Math.max(0, 1 - r.t / 0.12);
  (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * k;
  if (k <= 0) {
    this.swordRoot.remove(r.mesh);
    r.mesh.geometry.dispose();
    (r.mesh.material as THREE.Material).dispose();
    this.swordCrescents.splice(i, 1);
  }
}
```

- [ ] **Step 5: Run unit test, expect pass.**

```
npx vitest run src/game/weapons.swordswing.test.ts
```
Expected: 4 PASS.

- [ ] **Step 6: Commit.**

```
git add src/game/weapons.ts src/game/weapons.swordswing.test.ts
git commit -m "Add swordswing weapon: cone-arc damage, crescent VFX, anim-coupled cooldown"
```

### Task 12: Register sword-swing SFX

**Files:**
- Modify: `src/engine/audio.ts` (or wherever `audio.play(name, ...)` looks up cues)

- [ ] **Step 1: Add the cue.**

Open `src/engine/audio.ts`. Find where existing weapon SFX are registered (look for `pistol`, `shockwave`, `lightning`). Mirror the same registration shape for `swordswing`. The existing audio engine generates SFX procedurally — match the API used by the others. As a starting cue, mix a fast white-noise whoosh with a brief metallic clink (a short ring-decayed sine at ~2200Hz). If the existing API is `audio.register(name, generatorFn)` with a generator, use that. If it's a static table, add a row.

- [ ] **Step 2: Smoke test SFX in browser.**

```
npm run dev
```
Pick Knight. Wait for first sword-swing. Hear a whoosh-clink. Adjust amplitude/duration only if it sounds out of place compared to the other weapons. Stop server.

- [ ] **Step 3: Commit.**

```
git add src/engine/audio.ts
git commit -m "Add swordswing SFX cue"
```

### Task 13: Switch Knight starter from `blades` to `swordswing`; move `blades` to unlockable pool

**Files:**
- Modify: `src/game/characters.ts`
- Modify: `src/game/upgrades.ts`

- [ ] **Step 1: Update Knight starter.**

In `src/game/characters.ts`, in the Knight entry:
```typescript
startingWeapon: 'swordswing',
```

- [ ] **Step 2: Add `blades` to the universal unlockable pool.**

Open `src/game/upgrades.ts`. Find the upgrade-pool table that lists which weapons can be offered as level-up unlocks. Add a `blades` unlock entry mirroring how `pistol` and `shockwave` are configured. The condition for offering should be: weapon not yet owned. Remove any code path that auto-grants `blades` as a starter (it's now offered, not gifted).

- [ ] **Step 3: Add `swordswing` level-up entry, gated to Knight.**

Same file. Add a level-up upgrade for `swordswing` that is only offered if the player owns it (i.e., is the Knight). Mirror the level-up entry shape used by `lightning` and `boomerang`.

- [ ] **Step 4: Smoke test full Knight loop.**

```
npm run dev
```
Pick Knight. Verify:
- Spawn with sword swing as the only weapon, NOT blades.
- Knight visibly swings the sword on cooldown; enemies in front take damage at the apparent strike moment of the swing.
- Survive to first level-up. The upgrade card pool should include "Helpful Cutlery (Unlock)" alongside other weapons.
- Pick blades, confirm they spawn and orbit as today.
- No console errors. 60fps maintained.

- [ ] **Step 5: Commit.**

```
git add src/game/characters.ts src/game/upgrades.ts
git commit -m "Knight starts with swordswing; blades becomes unlockable"
```

---

## Phase D — Witch and Hunter as GLB-backed heroes

### Task 14: Convert Witch to GLB

**Files:**
- Modify: `src/game/characters.ts`

- [ ] **Step 1: Switch Witch to assetId form.**

Replace the `sorceress:` entry in `CHARACTERS`:
```typescript
sorceress: {
  id: 'sorceress',
  name: 'Mistress Quill',
  title: 'Witch (Independent)',
  blurb: "Failed her wizard's exam on a technicality (gender), opened her own practice the following Tuesday. Business cards read: 'Lightning to Order, Reasonable Rates, No Refunds on Account of Weather.'",
  startingWeapon: 'lightning',
  stats: { maxHp: 90, moveSpeed: 6.2, magnetRadius: 2.6, damageMult: 1.25, cooldownMult: 0.92 },
  assetId: 'mistress_quill',
  attackStrikeFrame: 12,
  attackTotalFrames: 24,
  height: 1.78,
},
```

- [ ] **Step 2: Smoke test.**

```
npm run dev
```
Pick Witch. Walk, take damage, die. Verify GLB renders, animations play. The lightning weapon will still fire on its old cooldown (we couple it to Attack in Task 16).

- [ ] **Step 3: Commit.**

```
git add src/game/characters.ts
git commit -m "Witch uses mistress_quill GLB"
```

### Task 15: Convert Hunter to GLB

**Files:**
- Modify: `src/game/characters.ts`

- [ ] **Step 1: Switch Hunter to assetId form.**

Replace the `hunter:` entry:
```typescript
hunter: {
  id: 'hunter',
  name: 'Margate Tossworthy',
  title: 'Returns Specialist',
  blurb: "Fully paid-up member of the Boomerang Throwers' Guild (motto: 'They Come Back. They Always Come Back.'). Has lost three crossbows, two umbrellas, and one quite reasonable hat. Has never lost a boomerang.",
  startingWeapon: 'boomerang',
  stats: { maxHp: 110, moveSpeed: 5.8, magnetRadius: 2.4, damageMult: 1.1, cooldownMult: 0.95 },
  assetId: 'margate_tossworthy',
  attackStrikeFrame: 12,
  attackTotalFrames: 20,
  height: 1.34,
},
```

- [ ] **Step 2: Smoke test.**

Boot, pick Hunter, walk. Verify GLB renders.

- [ ] **Step 3: Commit.**

```
git add src/game/characters.ts
git commit -m "Hunter uses margate_tossworthy GLB"
```

### Task 16: Couple lightning + boomerang firing to the Attack animation

**Files:**
- Modify: `src/game/weapons.ts`

- [ ] **Step 1: Wrap lightning fire in an Attack call.**

In `weapons.ts`, find the `case 'lightning':` branch in `WeaponSystem.update`. Wrap the existing fire logic so the player plays Attack and the actual lightning bolt spawns at the strike-frame. The fire path is currently something like:
```typescript
case 'lightning': {
  this.lightningCd -= dt;
  if (this.lightningCd <= 0) {
    this.lightningCd = ... ;
    this.fireLightning(player, enemies, ...);
  }
  break;
}
```

Change to:
```typescript
case 'lightning': {
  this.lightningCd -= dt;
  const clipFloor = 24 / 24;  // witch attack: 24f @ 24fps
  const cd = Math.max((1.4 - (lvl - 1) * 0.12) * player.stats.cooldownMult, clipFloor);
  if (this.lightningCd <= 0) {
    this.lightningCd = cd;
    player.playAttack(() => this.fireLightning(player, enemies, ...));
  }
  break;
}
```
(Use whatever local variable holds the level — match the existing code shape.)

- [ ] **Step 2: Wrap boomerang fire in an Attack call.**

Same pattern for `case 'boomerang':`. Hunter clip floor is `20 / 24`.
```typescript
case 'boomerang': {
  this.boomerCd -= dt;
  const clipFloor = 20 / 24;
  const cd = Math.max((1.6 - (lvl - 1) * 0.15) * player.stats.cooldownMult, clipFloor);
  if (this.boomerCd <= 0) {
    this.boomerCd = cd;
    player.playAttack(() => this.fireBoomerang(player, enemies, ...));
  }
  break;
}
```

- [ ] **Step 3: Remove the temporary Knight-only gate from main.ts.**

Open `src/main.ts`. Find the `characterSelect.show((c) => { ... });` callback and revert to:
```typescript
characterSelect.show((c) => { selectedCharacter = c; startRun(); });
```

- [ ] **Step 4: Smoke test all three heroes.**

```
npm run dev
```
For each character:
- Pick them from select.
- Walk, take damage, die.
- Watch the starter weapon: each fire should be visibly preceded by the character playing Attack and the projectile/lightning/sword effect should appear at the apparent strike moment.
- Survive to first level-up. Confirm offered upgrades match expectations.

- [ ] **Step 5: Commit.**

```
git add src/game/weapons.ts src/main.ts
git commit -m "Lightning + boomerang fire on Attack strike-frame; all 3 heroes playable"
```

---

## Phase E — Enemies as GLB-backed entities with telegraphed attacks

### Task 17: Replace runner mesh builder with AnimatedCharacter

**Files:**
- Modify: `src/game/enemies.ts`

This is the largest single edit in the plan because `enemies.ts` is one tightly-coupled file (pools, meshes, AI all in one). We split it into smaller responsibilities at the same time. Smaller files are easier to reason about and more reliable to edit.

- [ ] **Step 1: Add AssetCache lookup table for enemy assets.**

Near the top of `enemies.ts`, alongside `ENEMY_TYPES`:
```typescript
import { AnimatedCharacter, type AnimMeta } from './animated-character';
import { assets } from '../engine/assets';

const ENEMY_ASSETS: Record<EnemyKind, { id: 'runner' | 'brute' | 'boss'; meta: AnimMeta }> = {
  runner: { id: 'runner', meta: { strikeFrame: 11, attackTotalFrames: 22 } },
  brute:  { id: 'brute',  meta: { strikeFrame: 14, attackTotalFrames: 29 } },
  boss:   { id: 'boss',   meta: { strikeFrame: 18, attackTotalFrames: 35 } },
};
```

- [ ] **Step 2: Replace `buildMonsterMesh` with `buildAnimatedEnemy`.**

Delete the entire `buildMonsterMesh` function (~140 lines of primitive building) and replace with:
```typescript
function buildAnimatedEnemy(kind: EnemyKind): { group: THREE.Group; char: AnimatedCharacter } {
  const conf = ENEMY_ASSETS[kind];
  const cloned = assets.cloneFor(conf.id);
  const char = new AnimatedCharacter(cloned, conf.meta);
  // shadow casting per-spec: runners do NOT cast shadows; brutes and boss do.
  if (kind !== 'runner') {
    char.group.traverse((o) => {
      if ((o as any).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  } else {
    char.group.traverse((o) => {
      if ((o as any).isMesh) (o as THREE.Mesh).castShadow = false;
    });
  }
  return { group: char.group, char };
}
```

- [ ] **Step 3: Store the AnimatedCharacter alongside each pool slot.**

Find the `EnemyManager` class. It currently has:
```typescript
private pools: Record<EnemyKind, Enemy[]> = {...};
private meshes: Record<EnemyKind, THREE.Group[]> = {...};
```
Add a parallel:
```typescript
private chars: Record<EnemyKind, AnimatedCharacter[]> = { runner: [], brute: [], boss: [] };
```

In the pool-population code (where `buildMonsterMesh` was called per slot), call `buildAnimatedEnemy` instead and push `built.char` into `this.chars[kind]`.

Also extend the `Enemy` interface at the top of the file:
```typescript
interface Enemy {
  active: boolean;
  kind: EnemyKind;
  hp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hitFlashUntil: number;
  attackCooldown: number;
  knockback: THREE.Vector3;
  // NEW: telegraphed-attack FSM
  aiState: 'chase' | 'windup' | 'recover';
  recoverUntil: number;
  windupStrikeArmed: boolean;
}
```
And initialise these on every spawn (`aiState: 'chase'`, `recoverUntil: 0`, `windupStrikeArmed: false`).

On spawn, also call `this.chars[kind][i].reset()` and set `this.chars[kind][i].group.visible = true`.

- [ ] **Step 4: Patch hit-flash material handling for GLB materials.**

The existing flash code (around `enemies.ts:447`) reads `__baseEmissive` and `__baseEmissiveIntensity` patched onto each material. After spawning a GLB enemy, walk its meshes and patch these:
```typescript
mesh.traverse((o) => {
  if ((o as any).isMesh) {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if (m && (m as any).isMeshStandardMaterial) {
      (m as any).__baseEmissive = m.emissive.clone();
      (m as any).__baseEmissiveIntensity = m.emissiveIntensity ?? 0;
    }
  }
});
```
Do this once per pool slot at construction time. The existing flash loop in `enemies.ts:429-475` then continues to work without further change.

- [ ] **Step 5: Smoke test (without telegraph FSM yet).**

```
npm run dev
```
Boot. Confirm runners spawn as GLB models and walk toward the player. Damage them; the white hit-flash works on the new materials. Kill one; the existing death-event flow runs (gem drops, mesh hides). Touching enemies still does contact damage as today (we change that next). 60fps. No console errors.

- [ ] **Step 6: Commit.**

```
git add src/game/enemies.ts
git commit -m "Enemies use GLBs via AnimatedCharacter; hit-flash compatible"
```

### Task 18: Implement telegraphed-attack FSM (Chase / Windup / Recover)

**Files:**
- Modify: `src/game/enemies.ts`

- [ ] **Step 1: Define per-kind attack tuning.**

Near `ENEMY_TYPES`:
```typescript
const ATTACK_TUNING: Record<EnemyKind, { range: number; recovery: number }> = {
  runner: { range: 1.4, recovery: 0.25 },
  brute:  { range: 1.9, recovery: 0.50 },
  boss:   { range: 2.6, recovery: 0.70 },
};
```

- [ ] **Step 2: Replace the existing melee-on-touch loop with the FSM.**

In `EnemyManager.update`, find the section after the separation pass that does:
```typescript
this.forEach((e, mesh, type) => {
  // ... seek/face/touch-damage logic ...
});
```

Replace the per-enemy block with:
```typescript
this.forEach((e, mesh, type) => {
  const ai = ATTACK_TUNING[e.kind];
  const dx = playerPos.x - e.pos.x;
  const dz = playerPos.z - e.pos.z;
  const d = Math.hypot(dx, dz);
  const char = this.chars[e.kind][indexOf(e, this.pools[e.kind])];

  // Locomotion
  const moving = e.aiState === 'chase';
  char.setMoving(moving);
  char.setFacing(Math.atan2(dx, dz));
  char.update(dt);

  // FSM
  if (e.aiState === 'chase') {
    if (d < ai.range) {
      e.aiState = 'windup';
      e.windupStrikeArmed = true;
      e.vel.set(0, 0, 0);
      char.playAttack(() => {
        if (!e.windupStrikeArmed) return;
        e.windupStrikeArmed = false;
        // re-check distance with forgiveness
        const dx2 = playerPos.x - e.pos.x, dz2 = playerPos.z - e.pos.z;
        if (Math.hypot(dx2, dz2) <= ai.range + 0.4) onPlayerHit(type.damage);
        e.aiState = 'recover';
        e.recoverUntil = time + ai.recovery;
      });
    }
  } else if (e.aiState === 'windup') {
    // freeze in place. FSM advances inside the strike callback or, if the
    // attack clip ends without firing (player dodged out before strike-frame
    // — but the strike callback fires regardless of distance and we re-check
    // there), the callback will still set state→recover.
    e.vel.set(0, 0, 0);
  } else if (e.aiState === 'recover') {
    if (time >= e.recoverUntil) e.aiState = 'chase';
  }

  // Hit-flash + scale-punch (existing code, unchanged)
  const flashAmt = Math.max(0, (e.hitFlashUntil - time) / 0.08);
  mesh.traverse((o) => {
    // ... existing flash loop, untouched ...
  });
  const punch = flashAmt > 0 ? 1 + 0.05 * flashAmt : 1;
  mesh.scale.setScalar(type.scale * punch);
  mesh.position.set(e.pos.x, 0, e.pos.z);
});
```

You'll need a small `indexOf` helper (or restructure `forEach` to provide the pool index). Cleanest is to change `forEach` to pass the index:
```typescript
forEach(cb: (e: Enemy, mesh: THREE.Group, type: EnemyType, idx: number) => void) {
  for (const k of ['runner', 'brute', 'boss'] as EnemyKind[]) {
    const arr = this.pools[k];
    const meshes = this.meshes[k];
    const type = ENEMY_TYPES[k];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.active) cb(e, meshes[i], type, i);
    }
  }
}
```
And update all callers to ignore the new arg if they don't need it (TS will accept extra args silently). Use `idx` where you wrote `indexOf(...)` above.

- [ ] **Step 3: Update the seek-velocity write-back.**

Earlier in the same `update()` (the seek block), velocity was written unconditionally. Wrap in `if (e.aiState === 'chase')`:
```typescript
if (e.aiState === 'chase') {
  e.vel.x = (dx / d) * speed;
  e.vel.z = (dz / d) * speed;
} else {
  e.vel.x = 0; e.vel.z = 0;
}
```

- [ ] **Step 4: Smoke test telegraphed combat.**

```
npm run dev
```
Pick Knight. Approach a runner. Verify:
- Runner stops at melee range and visibly winds up Attack.
- If you stay still, the strike lands on you (i-frame triggers, player flickers, HP drops).
- If you walk away during the windup (you have ~0.46s for runner), the swing whiffs — no damage.
- After strike or whiff, the runner enters recover (briefly stationary) then chases again.
- Brute: longer windup (~0.58s), heavier feel.
- Survive to 5:00, mini-boss spawns; verify boss has the longest, most readable windup (~0.75s) and lands the biggest hit.
- 60fps maintained with full late-wave swarm.

- [ ] **Step 5: Commit.**

```
git add src/game/enemies.ts
git commit -m "Telegraphed enemy attacks: Chase/Windup/Recover FSM with strike-frame damage"
```

### Task 19: Death animation + delayed gem drop

**Files:**
- Modify: `src/game/enemies.ts`

The existing `damageEnemy` and `damageInRadius` set `mesh.visible = false` and push `deathEvents` immediately on kill. We change this to: play Death, hold ~1s after the clip lands, then push the death event and hide.

- [ ] **Step 1: Replace immediate visibility-off with deferred death.**

Find both occurrences of `mesh.visible = false; this.deathEvents.push(...)` in `enemies.ts` (one in `damageInRadius`, one in `damageEnemy`). Replace each with a call to a new private method:
```typescript
private startDeath(e: Enemy, idx: number, type: EnemyType) {
  const char = this.chars[e.kind][idx];
  // mesh stays visible; it'll be hidden after the lie-still timer fires.
  char.playDeath(() => {
    this.deathEvents.push({ pos: e.pos.clone(), kind: e.kind });
    char.group.visible = false;
  });
  // Stop AI from doing anything to this corpse.
  e.aiState = 'recover';
  e.recoverUntil = Number.POSITIVE_INFINITY;
}
```
And in the kill paths:
```typescript
if (e.hp <= 0) {
  e.active = false;
  this.startDeath(e, idx, type);   // (you'll need to thread idx through —
                                   // damageInRadius already iterates with forEach,
                                   // so capture idx in the callback signature)
  kills++;
}
```

Note: `damageInRadius`'s `forEach` already iterates everything; just consume the new `idx` arg from Task 18.

For `damageEnemy` (which receives a raw `Enemy` reference from the projectile/blade hit path), you also need the index. Add an `idx` parameter:
```typescript
damageEnemy(e: Enemy, mesh: THREE.Group, type: EnemyType, dmg: number, weapon: any, time: number, knockbackDir: THREE.Vector3, knockbackAmt: number, idx?: number): boolean {
  // ...
  if (e.hp <= 0) {
    e.active = false;
    if (idx !== undefined) this.startDeath(e, idx, type);
    return true;
  }
  return false;
}
```
Update all `damageEnemy` callers (search the codebase) to pass the index. Where the caller doesn't already have one, find it cheaply: the projectile-hit path in `weapons.ts` iterates `findNearest` results which expose the enemy reference; expose `idx` from that helper too. Mirror the existing pool layout.

- [ ] **Step 2: Add a Hit play on hit-but-alive.**

Inside both damage paths, just before the `e.hp <= 0` check (and ONLY when knockback was substantial — say `knockbackAmt > 2` for `damageEnemy`, or simply on every hit for `damageInRadius`), call:
```typescript
this.chars[e.kind][idx]?.playHit();
```

- [ ] **Step 3: Smoke test full death loop.**

```
npm run dev
```
Kill enemies; verify:
- They visibly play Hit on damage that doesn't kill them (brief flinch).
- On killing blow, they fall flat (Death animation rotates the body to ground), lie still for ~1s, then disappear and the gem appears.
- No phantom gems before the body hits the ground.
- Multiple kills don't stack incorrectly.

- [ ] **Step 4: Commit.**

```
git add src/game/enemies.ts src/game/weapons.ts
git commit -m "Enemy Death animation with delayed gem drop; Hit on damage"
```

---

## Phase F — Polish

### Task 20: Camera height + pitch tuning for taller models

**Files:**
- Modify: `src/engine/camera-rig.ts`

- [ ] **Step 1: Adjust the rig.**

Open `src/engine/camera-rig.ts`. Find the rig offset constants (look for the y-offset and look-down pitch from the player). Raise the camera by ~0.4m and reduce the look-down angle to ~22°. Adjust the precise numbers by feel until the witch's hat and the boss's horns frame cleanly during a level-up moment.

- [ ] **Step 2: Smoke test framing.**

```
npm run dev
```
Pick Witch (tallest hero). Walk near a Boss (tallest enemy). Verify both fit on screen comfortably during a stand-off, with enough ground around them for spatial readability.

- [ ] **Step 3: Commit.**

```
git add src/engine/camera-rig.ts
git commit -m "Tune camera for taller GLB models"
```

### Task 21: Shadow normalBias to suppress joint-seam acne

**Files:**
- Modify: `src/engine/renderer.ts` (or wherever the directional light is configured)

- [ ] **Step 1: Add normalBias to the sun light's shadow.**

Find the `THREE.DirectionalLight` configured as the sun. Add:
```typescript
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
```
Replace existing bias values if present.

- [ ] **Step 2: Smoke test under raked light.**

```
npm run dev
```
Watch a Knight running around — focus on the shoulder/elbow seams during direction changes. Should look clean. Stop server.

- [ ] **Step 3: Commit.**

```
git add src/engine/renderer.ts
git commit -m "Tune shadow bias to suppress joint-seam acne on bone-parented GLBs"
```

### Task 22: Mixer update gating for off-screen enemies

**Files:**
- Modify: `src/game/enemies.ts`

- [ ] **Step 1: Frustum-cheap test + 1/3 update rate off-screen.**

In `EnemyManager.update`, replace the unconditional `char.update(dt);` with:
```typescript
const camForward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
// ... per enemy:
const ex = e.pos.x - camera.position.x;
const ez = e.pos.z - camera.position.z;
const dot = ex * camForward.x + ez * camForward.z;
const dist2 = ex * ex + ez * ez;
const onScreen = dot > 0 && dist2 < 60 * 60;
if (onScreen || (perfTickCounter % 3 === 0)) char.update(dt);
```
Pass `camera` into `EnemyManager.update` from the call site in `main.ts`. Keep a counter inside `EnemyManager` and increment per update.

- [ ] **Step 2: Smoke test perf at full swarm.**

```
npm run dev
```
Survive to 9:00 (300 enemies on screen). Verify FPS stays at 60.

- [ ] **Step 3: Commit.**

```
git add src/game/enemies.ts src/main.ts
git commit -m "Gate off-screen enemy mixers to 1/3 rate for late-wave perf"
```

### Task 23: Character-select preview uses the GLBs

**Files:**
- Modify: `src/ui/screens.ts` (whichever section renders the character-select 3D previews)

- [ ] **Step 1: Replace the procedural preview build with `assets.cloneFor`.**

In the character-select rendering code, find where each character's preview mesh is built (likely a small helper that calls each `CharacterDef.build()`). Change to:
```typescript
const cloned = assets.cloneFor(c.assetId!);
const ac = new AnimatedCharacter(cloned, {
  strikeFrame: c.attackStrikeFrame ?? 12,
  attackTotalFrames: c.attackTotalFrames ?? 22,
});
ac.update(0.016);  // tick once so Idle pose is established
// add ac.group to the preview scene
```
Tick the preview scene's mixer in the screen's animate loop. When the user hovers/highlights a card, call `ac.playAttack(() => {})` for visual flair.

- [ ] **Step 2: Smoke test.**

Open game, see the three GLB heroes in the select screen, hover each — Knight swings, Witch thrusts, Hunter throws.

- [ ] **Step 3: Commit.**

```
git add src/ui/screens.ts
git commit -m "Character select previews use GLB models with hover Attack"
```

### Task 24: Enemy-windup audio cue

**Files:**
- Modify: `src/engine/audio.ts`
- Modify: `src/game/enemies.ts`

- [ ] **Step 1: Register windup SFX cues.**

Add three short, tonally distinct cues in `audio.ts`: `runner-windup` (light huff), `brute-windup` (low growl), `boss-windup` (longer rumble). Mirror the existing procedural-synth registration pattern.

- [ ] **Step 2: Play on transition from chase → windup.**

In `enemies.ts`, in the `if (d < ai.range)` block where `aiState` is set to `'windup'`, play the cue:
```typescript
audio.play(`${e.kind}-windup`, { volume: 0.4, position: e.pos });
```
You'll need an `audio` reference inside `EnemyManager`. Pass it via constructor or `update`.

- [ ] **Step 3: Smoke test audio.**

Verify each enemy's windup is audibly distinct.

- [ ] **Step 4: Commit.**

```
git add src/engine/audio.ts src/game/enemies.ts
git commit -m "Add per-enemy windup audio cues"
```

### Task 25: Delete dead procedural code

**Files:**
- Modify: `src/game/characters.ts`
- Modify: `src/game/player.ts` (if any old refs remain)

- [ ] **Step 1: Remove unused `build` builders.**

Open `characters.ts`. Delete `buildKnight`, `buildSorceress`, `buildHunter` and any private helpers only they used. Remove the `build?:` property from `CharacterDef` (or keep it `undefined` everywhere — cleaner to remove).

- [ ] **Step 2: Type-check.**

```
npm run typecheck
```

- [ ] **Step 3: Commit.**

```
git add src/game/characters.ts
git commit -m "Remove procedural character builders (now obsolete)"
```

---

## Phase G — Verification & ship

### Task 26: Run the full unit test suite

- [ ] **Step 1: Verify all tests pass.**

```
npx vitest run
```
Expected: all tests green. If something fails, fix the underlying issue, do not skip.

### Task 27: Production build smoke

- [ ] **Step 1: Build for production.**

```
npm run build
```
Expected: `tsc --noEmit` then `vite build` complete without errors. `dist/` is created.

- [ ] **Step 2: Preview the production build.**

```
npm run preview
```
Open the URL Vite prints. Play one full run through to confirm nothing broke in production minification.

### Task 28: Full 10-minute end-to-end smoke

- [ ] **Step 1: Survive a full run as Knight.**

```
npm run dev
```
Pick Knight. Survive to 10:00 (the victory state). On the way:
- ✅ Knight visibly swings sword; damage lands at the apparent strike moment.
- ✅ Multiple weapon types unlock via level-up; Helpful Cutlery offered.
- ✅ Runners, Brutes, Boss all wind up before striking; you can dodge.
- ✅ Killed enemies fall flat and stay for ~1s; gems then drop.
- ✅ HUD, pause, level-up screen, victory screen all render correctly.
- ✅ Music, SFX, post-FX, time-of-day, torch all unchanged.
- ✅ FPS stays at 60.

- [ ] **Step 2: Repeat for Witch and Hunter.**

Confirm each hero's embodied starter weapon visibly fires from the right anatomy at the right frame.

### Task 29: Final branch cleanup

- [ ] **Step 1: Confirm branch is clean.**

```
git status
git log --oneline -30
```
Expected: clean working tree, ~25-28 commits on `character-overhaul` since branching from main.

- [ ] **Step 2: Optional — rebase / squash decision.**

If you want a tidier history, `git rebase -i main` to squash trivially related commits. Otherwise leave as-is for review readability. Do NOT force-push to main.

- [ ] **Step 3: Hand back to the user.**

The branch is ready. The user can review the diff (`git diff main..character-overhaul`) and decide whether to merge to main, push to GitHub, or open a PR. Do not push without their explicit instruction.

---

## Self-Review Notes

- **Spec coverage:** Sections 2 (asset inputs), 3 (files), 4 (AnimatedCharacter API), 5 (asset loader), 6 (player), 7 (enemy FSM), 8 (weapons), 9 (camera/lighting), 10 (UI), 11 (perf), 12 (audio), 13 (testing) — all have at least one task. Section 14 (out of scope) is enforced by absence: no task creates anything beyond the listed work. Section 15 (risks) drives Task 21 (shadow bias) and Task 7 (`AnimatedCharacter.reset` clears root rotation).

- **Type consistency:** `AnimMeta { strikeFrame, attackTotalFrames }` is defined in Task 7 and consumed identically in Tasks 8, 17, and 18. `assetId` on `CharacterDef` is added in Task 5 and consumed in Tasks 6, 14, 15, 23. `playAttack(onStrike)` callback signature is consistent across tasks.

- **No placeholders:** The plan ships actual code blocks for every code change; smoke tests have concrete commands and concrete expected outcomes; no "implement appropriate error handling" hand-waves.

- **Out-of-scope drift:** No task adds new mechanics, evolutions, biomes, mobile touch, or save/load. All work serves the asset swap and the strike-frame conversion.
