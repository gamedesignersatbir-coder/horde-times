# Horde Times — Blender Character Overhaul

**Date:** 2026-05-07
**Status:** Draft for approval
**Supersedes:** none — extends `2026-04-25-swarm-grinder-3d-design.md`

## 1. Goal

Replace the procedural primitive characters (knight, witch, hunter) and enemies (runner, brute, boss) with the rigged, animated GLB models authored in Blender. Use the per-character Attack animations to make starter weapons feel embodied (the knight visibly swings, the witch visibly thrusts her staff, the hunter visibly throws). Make enemy attacks telegraphed so combat reads as deliberate threats rather than touch-damage. Preserve every other system that already works: state machine, juice, post-FX, music, UI, weapon roster, upgrade pool, arena, time-of-day, torch.

**Non-goals:** new mechanics, second arena, weapon evolutions, meta-progression, mobile touch, save/load, multiplayer, engine port. The existing game already feels good — this overhaul upgrades the visuals and the felt physicality of attacks, nothing else.

**Timebox:** one day.

## 2. Asset inputs

Six glTF binaries at `E:\AI Data\ClaudeCode\test\HordeTimes\horde_times_exports\`:

| File | Used as | Approx height |
|------|---------|---------------|
| `sir_pommelry.glb`        | Knight player        | 1.36 m |
| `mistress_quill.glb`      | Witch player         | 1.78 m (with hat) |
| `margate_tossworthy.glb`  | Hunter player        | 1.34 m |
| `runner.glb`              | Runner enemy         | 0.95 m |
| `brute.glb`               | Brute enemy          | 1.57 m |
| `boss.glb`                | Mini-boss enemy      | 1.99 m |

All six share an 11-bone armature (`Root → Spine → Head_bone`, `UpperArm.L/R → Forearm.L/R`, `UpperLeg.L/R → LowerLeg.L/R`). **Meshes are bone-parented, not skinned** — joints pivot like a marionette. This is intentional and we do not re-rig.

Each GLB exports five animations with bare names:
- `Idle` — 60 frames, seamless loop. ~2.5s.
- `Run` — 24 frames, seamless loop. ~1s.
- `Attack` — one-shot, character-specific frame count, returns to neutral on last frame.
- `Hit` — 14 frames, one-shot, returns to neutral.
- `Death` — 30 frames, one-shot. The armature object itself rotates 90° around X between frame 12 and 30 — character ends lying flat. Standard glTF object-track animation; Three.js's `AnimationMixer` plays it correctly without bone manipulation.

Per-character Attack frame counts and **strike-frames** (when damage lands):

| Character | Attack frames | Strike-frame | Strike-time @24fps |
|-----------|---------------|--------------|--------------------|
| Knight    | 22            | 12           | 0.500 s            |
| Witch     | 24            | 12           | 0.500 s            |
| Hunter    | 20            | 12           | 0.500 s            |
| Runner    | 22            | 11           | 0.458 s            |
| Brute     | 29            | 14           | 0.583 s            |
| Boss      | 35            | 18           | 0.750 s            |

Known visual quirks (baked, accepted): witch's skirt and Margate's cloak are rigid (Root-parented), legs may pop through; boss/brute loincloths sway only with hips; witch's staff floats in front (telekinetic, Spine-parented). These are design, not bugs.

Source `.blend` lives at `C:\Users\Satbir\Desktop\horde_times_assets.blend`. Do not modify; this overhaul is the consumer, the .blend is upstream.

## 3. Files changed and added

**Copied from exports:**
- `public/assets/characters/{sir_pommelry,mistress_quill,margate_tossworthy,runner,brute,boss}.glb`

**New files:**
- `src/engine/assets.ts` — GLTF loader with cache, parallel preload at boot, returns `CharacterAsset { scene, clips }`.
- `src/game/animated-character.ts` — wraps a cloned GLB scene + `AnimationMixer` + animation state machine. Single source of truth for `Idle ↔ Run` blends, one-shot `Attack/Hit/Death` clips, and strike-frame events.
- `src/game/weapons/sword-swing.ts` — knight's new starter weapon (melee arc).

**Replaced (the surgical core of the overhaul):**
- `src/game/characters.ts` — procedural `THREE.Group` builders → references to GLB asset keys; per-character `startingWeapon`, stats, and Attack-clip frame metadata.
- `src/game/player.ts` — `buildKnightMesh` + sine-wave limb wiggle removed; `Player` now composes an `AnimatedCharacter` and drives it via `setMoving`/`play('attack')`/`play('hit')`/`play('death')`.
- `src/game/enemies.ts` — `buildMonsterMesh` removed; each enemy gets an `AnimatedCharacter`. Touch-damage AI replaced with telegraphed FSM: `chase → windup → strike → recover → chase`. Damage lands once on the strike-frame and only if the player is still inside the attack range.
- `src/game/weapons.ts` — `blades` moves from per-character starter to universal unlockable. `swordswing` added (knight's starter). Lightning and boomerang remain per-character starters but their cooldowns are now driven from the character's `Attack` clip duration so the visual swing matches the projectile/arc spawn moment.

**Unchanged (the working core we are protecting):**
- `src/main.ts` — state machine, frame loop.
- `src/engine/{renderer,camera-rig,input,audio,music,quality,touch,event-bus}.ts`.
- `src/game/{arena,xp,upgrades,vfx,timeofday,torch,spawner,types}.ts`.
- All of `src/ui/`.
- `src/style.ts` — palette stays the brand source.

## 4. The animation system (`AnimatedCharacter`)

A single class owns everything about a character's visual state. The rest of the game talks to it through five verbs.

**Public API:**
```ts
class AnimatedCharacter {
  group: THREE.Group;                    // the scene-graph node — mounts at entity origin
  height: number;                        // for camera framing / damage-number anchor

  setMoving(isMoving: boolean): void;    // auto Idle ↔ Run with 0.15s crossfade
  playAttack(onStrike: () => void): void; // one-shot; calls onStrike at strike-frame, returns to Idle/Run
  playHit(): void;                       // one-shot Hit, layered briefly over locomotion
  playDeath(onDone: () => void): void;   // one-shot Death, locks state, calls onDone at clip end
  setFacing(yaw: number): void;          // smooth-turn handled here, not in caller
  reset(): void;                         // reset to Idle, clear locks (used when respawning enemies from pool)

  update(dt: number): void;              // ticks the AnimationMixer
}
```

**State machine (internal):**

```
                ┌──────────┐
            ┌──►│   Idle   │◄───┐
            │   └─────┬────┘    │
       (no move)      │ (moving)│
            │         ▼         │
            │   ┌──────────┐    │
            └───┤   Run    ├────┘
                └─────┬────┘
                      │ (playAttack / playHit)
                      ▼
                 ┌──────────┐  one-shot
                 │  Attack  │  (clip ends → Idle or Run)
                 │  / Hit   │
                 └─────┬────┘
                       │ (HP ≤ 0)
                       ▼
                 ┌──────────┐
                 │  Death   │  freeze on last frame
                 └──────────┘
```

- `Idle ↔ Run` is a smooth crossfade. A small move-velocity hysteresis prevents flicker when the player taps WASD.
- `Attack` and `Hit` are one-shots that play *over* locomotion: they don't lock the entity in place. The entity can still translate during the clip — whether it actually moves is decided by the caller (the player keeps moving on input; enemies plant their feet during windup at the FSM level, see Section 7). Crossfade in 0.08s, out 0.12s.
- Strike-frame detection: each frame, compare `mixer.time` against `attackStrikeTime`. Fire `onStrike` once per Attack play, then disarm.
- `Death` is terminal. The clip rotates the armature root 90°X via the GLB's own keyframes — we do not touch rotation manually. After clip end, the entity stays visible on the last frame for ~1.0s, then despawns / fades.

**Per-instance materials.** GLB materials are shared across clones by default. We clone all materials per instance at spawn time and patch them with `__baseEmissive` / `__baseEmissiveIntensity` (matching the existing hit-flash convention in `enemies.ts:447`). This preserves the white-tint hit flash without any further changes to VFX code.

**Pooling.** Enemies are already pooled per kind (`enemies.ts:283`). We keep the pool; on `spawn`, the pool slot's `AnimatedCharacter` is `reset()` and re-shown. On `despawn`, hidden + state cleared. We do not destroy the `THREE.Group` or the mixer — pool slots are reused exactly as today.

## 5. Asset loader (`engine/assets.ts`)

Tiny cache-on-first-load pattern:

```ts
class AssetCache {
  private cache = new Map<string, CharacterAsset>();
  async preloadAll(): Promise<void>;                  // called from main.ts boot
  get(id: CharacterAssetId): CharacterAsset;          // throws if not preloaded
  cloneFor(id: CharacterAssetId): { scene, clips };   // SkeletonUtils.clone for instance
}
```

Six parallel `GLTFLoader.loadAsync` calls at boot, behind the existing title screen. The title screen already exists and clicking Play already gates entry to gameplay — we simply await preload before allowing the click. A small "loading…" line appears under the Play button if the preload hasn't finished by the time the player reaches the title.

## 6. Player redesign

`Player` keeps:
- Position, velocity, facing, lean-into-turn (already feels good — preserved).
- Stats block, i-frames, regen, torch hookup, `takeDamage`, `heal`.
- Arena clamp.

`Player` loses:
- `buildKnightMesh()` and the limb-bob loop (lines 9–93, 189–202 in `player.ts`).
- Direct `mesh.rotation.y` and limb manipulation.

`Player` gains:
- An `AnimatedCharacter` field. `setMoving((moveX|moveZ) !== 0)` each frame.
- `setFacing(this.facing)` each frame (smooth-turn moves into `AnimatedCharacter`).
- `playHit()` called from `takeDamage` when damage is dealt and i-frame begins.
- `playDeath()` called when `hp ≤ 0` — the existing 1.5s game-over delay in `main.ts` covers the death clip + flat-on-ground hold.

I-frame visual today is opacity flicker (`player.ts:208`). With the new GLB materials, opacity flicker on cloned `MeshStandardMaterial` continues to work. We keep it.

The torch attachment (`attachTorch`) currently parents to `this.mesh`. With GLBs we attach to the same group root; the torch hovers off the character's left hip as today. We do **not** attach to a hand bone in this overhaul — the torch is a Pratchett-flavored constant flicker, not a held weapon. (If we ever want to bone-attach, the rig has `Forearm.L`/`Forearm.R` bones available.)

## 7. Enemy redesign — telegraphed attacks

Replaces the per-frame contact-damage loop in `enemies.ts:429-443` with a four-state FSM per enemy:

```
                     player out of range
              ┌──────────────────────────────┐
              ▼                              │
         ┌───────┐  player in attackRange  ┌─┴─────┐
         │ Chase ├────────────────────────►│Windup │
         └───────┘                          └───┬───┘
              ▲                                 │ Attack clip frame == strikeFrame
              │ recover timer expires           ▼
         ┌────┴────┐   strike resolved      ┌───────┐
         │ Recover │◄───────────────────────┤Strike │
         └─────────┘                         └───────┘
```

Per state:

- **Chase.** Existing seek-player behavior. Velocity toward player, separation push, knockback decay. `AnimatedCharacter.setMoving(true)` plays Run.
- **Windup.** Triggered when `dist(player) < attackRange` (per-kind: runner 1.4m, brute 1.9m, boss 2.6m). Velocity goes to 0 (the enemy plants its feet). `playAttack(onStrike)` is called once. `setMoving(false)` so the lower body returns to Idle while Attack plays. The enemy continues to face the player but no longer moves.
- **Strike.** The `onStrike` callback fires when the Attack clip reaches the strike-frame. It checks `dist(player) < attackRange + 0.4m` (small forgiveness margin) and, if true, deals `type.damage` to the player. If the player has dodged out by then, the swing whiffs — no damage.
- **Recover.** After Strike fires (or the Attack clip ends, whichever first), the enemy enters a per-kind recovery window (runner 0.25s, brute 0.5s, boss 0.7s) during which it cannot attack again but can resume movement. The current code's 0.7s `attackCooldown` is replaced by this state.

Hit-flash and knockback continue exactly as today — `damageInRadius` and `damageEnemy` are not touched. Hit reaction calls `playHit()` if knockback magnitude exceeds a small threshold (so a tiny chip doesn't constantly interrupt the run animation). Hit anim plays *additively*: the locomotion FSM continues, and `Hit` runs as a one-shot crossfade-in over the body for its 14 frames, then crossfades back.

Death: `damageEnemy` already returns `true` on kill. When that happens we now (a) keep the mesh visible (instead of `mesh.visible = false`), (b) call `playDeath`, (c) on `onDeathDone` (1.25s after the clip ends, so the body lies still for a beat), hide the mesh and emit the existing death event so the gem and poof spawn. Net effect: enemies fall and lie flat for ~2.5s before the gem appears under them. A small dramatic delay; this is good — kills feel weighty.

## 8. Weapon roster

Current code has all five weapons implemented in `weapons.ts`. We re-assign starters and add one new weapon.

**Per-character starters (animation-coupled):**

| Character | Starter weapon | New behavior |
|-----------|----------------|--------------|
| Sir Pommelry  | `swordswing` (NEW) | Plays `Attack` clip on its own cooldown (default 1.0s). On strike-frame, sweeps a 120° arc 2.5m in front of the character and damages all enemies inside. Damage = 18 base, scales with damageMult. Knockback away from character. |
| Mistress Quill | `lightning` (existing, retimed) | Cooldown synced to `Attack` clip duration so the `Idle → Attack → return` loop matches the visual thrust. The lightning bolt spawns at strike-frame from the staff tip's world position, then chains as today. |
| Margate Tossworthy | `boomerang` (existing, retimed) | Cooldown synced to `Attack` clip. The V-boomerang spawns at strike-frame from the throwing hand and travels out then returns as today. |

**Universal unlockables (auto-fire as today, no character anim coupling — they are external systems orbiting the character):**

| Weapon | Notes |
|--------|-------|
| `blades` (Helpful Cutlery) | Was the universal starter; now an unlockable. |
| `pistol` (The Personable Pistol) | Same as today. |
| `shockwave` (A Strongly-Worded Cough) | Same as today. |

**Cooldown coupling for starters:** The `Attack` clip duration is the floor on the cooldown. With `cooldownMult` applied via upgrades, the cooldown can shrink toward — but never below — the clip duration. If a future upgrade would push below clip duration, we cap and play the clip at slightly elevated speed (≤1.4x) to keep the visual swing matching the cadence.

**Sword-swing implementation sketch (`swordswing.ts`):**
- On strike-frame fire: get knight's facing, build a forward-arc query (cone test with half-angle 60°, length 2.5m), iterate active enemies, apply `damageEnemy` to each in cone with knockback away from character.
- Visual: a brief crescent VFX (cyan-tinted swept polygon, 0.12s) anchored at the knight's facing for read-clarity. Not a model attachment, just a particle ribbon — keeps the swing readable even at 60fps with the sword model itself moving fast.
- Audio: existing weapon SFX channel, new `sword-swing` cue (procedural whoosh + metal clink, generated via the same in-engine synth pipeline as other SFX).

**Upgrade pool changes:** The current pool offers per-character starter level-ups and unlocks. We re-thread it so:
- Level-up offers for `swordswing` only appear if the player is the knight.
- `blades` becomes an unlockable for *any* character (was implicit-starter, now explicit-unlock).
- Witch and hunter starters (`lightning`, `boomerang`) continue to receive level-up upgrades.

## 9. Camera, lighting, ground

The new characters are taller and more detailed than the primitives. Three small re-tunes:

- **Camera height:** raise from current rig by ~0.4m and reduce look-down angle from ~25° to ~22° so the witch's hat and the boss's horns are fully framed without losing the third-person feel.
- **Sun shadow bias:** the bone-parented joints expose tiny gaps at extreme rotations. Lower shadow bias from current value to `-0.0005` and add a `normalBias = 0.02` to suppress shadow acne on joint seams.
- **Ground contact:** GLBs are authored Y-up with feet at Y=0. The current player position is mesh-anchored at `y=0` already. Verify on first wire-up; nudge a per-character `groundOffset` (default 0) into `CharacterDef` if any model needs it.

No tone-mapping, bloom, vignette, or palette changes. The brand stays the brand.

## 10. UI

Character-select screen already shows the three heroes with stats and blurbs. We update its preview from procedural builders to the GLB models, playing `Idle` on each and a single `Attack` cue when the player hovers/highlights a card. This is a HUD layer; no new UI structure.

HUD weapon icons: `swordswing` needs an icon. Add one to `ui/icons.ts` matching the existing line-art style of other weapon glyphs.

## 11. Performance

The current build runs 60fps with hundreds of primitive enemies. The GLBs are similar polycount but introduce skinning-equivalent matrix math (bone-parented updates per frame). Three pieces of insurance:

- **Shared GLTF data, cloned skeletons.** All instances of a kind reuse one source `GLTF` (geometry, materials). `SkeletonUtils.clone` per instance. Materials cloned per instance only because the existing hit-flash patches them — no extra geometry duplication.
- **Mixer update gating.** An off-screen enemy ticks its `AnimationMixer` at 1/3 rate (sample every 3 frames). Visible enemies tick every frame. The frustum check is approximate: distance from camera + cheap dot-product against camera forward. We do not pause mixers entirely off-screen because enemies attack out of frustum (the player doesn't see the wind-up if they're behind), so the strike-frame must still tick.
- **Shadow casters.** Today only the player and big enemies cast shadows (per the original spec). Same rule applies to the new GLBs — runners do not cast shadows; brutes and boss do. Shadow map resolution unchanged.

Target: still 60fps with 300+ enemies on mid hardware. If we miss, the lever is mixer update rate, not polycount.

## 12. Audio

No music changes. SFX additions:
- `sword-swing` (knight starter) — procedural whoosh + metal clink.
- `enemy-windup` (subtle huff/growl variants per kind) — plays at start of windup state, gives the audio cue that the player has a window to dodge. Reuses existing in-engine synth pipeline.

Existing `gem-pickup`, `level-up`, `weapon-fire`, `enemy-death`, `player-damage`, `mini-boss-spawn` SFX all stay.

## 13. Testing & verification

Three checkpoints, in order:

1. **Asset import smoke test.** Boot the dev server, load the title, confirm preload completes without console errors, click Play, see the chosen character render and play `Idle`. (10 minutes of work to verify; pure plumbing.)
2. **Locomotion + facing.** Walk in all directions; confirm `Idle ↔ Run` crossfade reads cleanly, lean-into-turn still feels right, no shadow acne, no z-fighting on joint seams. (20 minutes.)
3. **Combat round-trip.** Kill a runner (player attack hits, enemy plays Hit, dies, plays Death, falls flat, gem drops). Take damage from a brute (brute windups, you can dodge during windup, you take damage on its strike-frame, you flicker). Survive long enough for the boss to spawn. (One full 10-minute run, eyes-on; this is the only test that matters because the game is feel-driven.)

Existing Vitest unit tests (XP curve, upgrade pool, wave table) are untouched.

## 14. Out of scope

- Re-rigging anything in Blender.
- Bone-attached weapons (e.g., parenting a sword model to the knight's `Forearm.R`). The sword is part of the GLB; the swing animation already shows it. The `swordswing` weapon is a damage volume + crescent VFX, not a separately-modeled attached prop.
- Smooth skinning. The marionette aesthetic stays.
- New characters, new enemies, new arenas, weapon evolutions, meta-progression, mobile touch, save/load, leaderboards, localization.
- Engine port. Three.js stays.

## 15. Risks and mitigations

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Death-anim object-rotation track doesn't replay correctly when a pooled enemy is reused | Medium | `AnimatedCharacter.reset()` explicitly resets the root group's `rotation` and re-binds the mixer. Verified at first integration of one enemy before scaling up. |
| Bone-parented joints expose visible seams under raked sunlight | Medium | Shadow normal-bias bump (Section 9). If still visible, add 5% mesh inset to limb caps (the only geometry edit we'd make, and it's in the consumer side via material adjustment, not the .blend). |
| 300 enemies × per-instance material clones blow memory budget | Low | Materials are tiny; geometries are shared. We measured ~12MB total with current primitive instance counts. GLBs add one-time geometry of ~1MB per kind. |
| Witch's staff floats noticeably when she walks (rigid, not held) | Low | This is documented design intent in the handoff (telekinetic). Accepted. If players read it as a bug we revisit, but the spec says no Blender changes today. |
| Strike-frame fires while the player is mid-i-frame from a previous hit | Low | Existing `Player.takeDamage` already guards on i-frame window — strike-frame deals zero if i-frame is active. No new code needed. |

## 16. Definition of done

- All six GLBs preload from `public/assets/characters/` at boot.
- Character select shows GLB previews; the chosen character spawns and plays Idle.
- Movement plays Run; stopping returns to Idle smoothly.
- The chosen character's starter weapon visibly drives its Attack animation; damage lands at strike-frame.
- Killing an enemy plays Hit (if hit but alive) or Death (if killed). After the Death clip lands flat (~1.25s), the body holds another ~1.25s before the gem spawns and the mesh hides.
- Brutes and bosses visibly windup and strike; the windup is dodgeable.
- No regression on framerate (target 60fps with the existing 300-enemy late-wave cap).
- No regression on existing systems: HUD, pause, level-up, upgrade pool, time-of-day torch, music, audio, post-FX, victory at 10:00, game-over.
- A single 10-minute run can be completed end-to-end without console errors.
