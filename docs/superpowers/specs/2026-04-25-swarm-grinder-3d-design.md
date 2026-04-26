# Swarm Grinder 3D — Design Spec

**Date:** 2026-04-25
**Status:** Approved (vertical slice)

## 1. Concept

A 3D, third-person, browser-playable reimagining of the auto-fire horde-survivor genre popularized by Swarm Grinder. The player controls a single character in a contained arena. Weapons fire automatically. The player only moves and dodges. Killed enemies drop XP gems; collecting enough gems triggers a level-up that pauses the game and presents three random upgrades to choose from. Enemy density and difficulty escalate over time. The run ends in death or in victory at 10 minutes.

The vertical slice prioritizes **moment-to-moment feel** over content breadth: tight controls, satisfying hit feedback, dense readable swarms, and dopamine-rich level-up loops.

## 2. Platform & Stack

- **Runtime:** Modern browsers (WebGL2). Chrome, Firefox, Safari, Edge.
- **Language:** TypeScript (strict mode).
- **Bundler / dev server:** Vite.
- **3D engine:** Three.js (latest stable).
- **Physics:** Rapier3D (WASM build) — capsule-vs-capsule for character/enemy collisions, raycasts for projectile hits.
- **Audio:** Howler.js with positional audio.
- **Tuning UI (dev only):** Tweakpane, gated behind `?debug=1`.
- **Distribution:** Static build (`vite build`) deployable to any static host. Single URL, hit Play.

## 3. Camera & Controls

**Camera:** Smoothed chase cam positioned behind the character at ~6m distance, ~4m height, looking down at ~25°. Rotation follows the character's facing direction with a small lag. Slight FOV punch on damage taken.

**Input:**
- **Keyboard:** WASD or arrow keys for movement. ESC pauses. Space confirms in menus.
- **Gamepad:** Left stick for movement. Start to pause. A/Cross to confirm.
- **Mouse:** Used only in menus (clicking upgrade cards).

The character always faces movement direction. There is no aim input — all weapons target automatically.

## 4. Visual Direction

**Style:** Stylized low-poly. Characters and enemies from Quaternius's Ultimate packs. Environment from Quaternius Nature pack. Single coherent art source ensures visual consistency.

**Lighting:**
- One directional sun light (warm, ~5500K) casting soft contact shadows.
- Hemisphere ambient (sky tint above, grass tint below).
- HDRI from Poly Haven (e.g., `kloofendal_48d_partly_cloudy`) for image-based lighting and skybox.

**Post-processing pipeline (Three.js EffectComposer):**
- Render pass
- Bloom (gentle, threshold ~0.85, intensity ~0.4)
- SMAA (anti-aliasing)
- Tone mapping: ACES Filmic
- Subtle vignette + slight color grading (warmer highlights, cooler shadows)

**Performance budget:** 60 fps with up to 400 enemies on screen on mid-range hardware. Achieved via:
- Instanced meshes for enemies (one InstancedMesh per enemy type)
- Shared materials, frustum-culled
- Particles via GPU-friendly point sprites
- Capped shadow map resolution; only the player and large enemies cast shadows

## 5. Arena

Single circular arena, ~80m diameter. Grassy ground texture, scattered low-poly trees and rocks as visual landmarks (non-blocking decoration; no collision). A soft invisible boundary at 40m radius prevents the player from leaving — visualized as a faint glowing ring when approached.

## 6. Player

- Single character: a low-poly knight model from Quaternius Ultimate Animated Character pack with built-in idle/run animations.
- Stats: 100 max HP, 5 m/s base move speed, 1.5m XP magnet radius (auto-attract gems within range).
- Damage taken triggers a 0.5s i-frame window to prevent insta-death from overlapping enemies.
- Health regenerates 1 HP/sec out of combat (no enemies within 5m for 3s).
- On HP ≤ 0: ragdoll/death animation, fade to game-over screen after 1.5s.

## 7. Weapons (v1)

All weapons auto-fire on independent cooldowns. Each has level 1–5; upgrades raise level and apply a stat tweak.

**a. Orbiting Blades** (starter)
- Two blades orbit the player at 3m radius, 1 full rotation per 1.2s.
- Deal 8 damage on contact with knockback.
- Level-ups: +1 blade (max 5), +damage, +rotation speed.

**b. Auto-Pistol**
- Fires every 0.6s at the nearest enemy within 15m.
- Projectile travels at 25 m/s, deals 12 damage, pierces 1 enemy.
- Level-ups: −cooldown, +damage, +pierce, +projectiles per shot (spread).

**c. Shockwave Pulse**
- Every 4s, expanding radial shockwave centered on player out to 6m.
- Deals 20 damage and strong knockback to all enemies hit.
- Level-ups: −cooldown, +damage, +radius.

The player starts with **Orbiting Blades**. The other two are unlocked via level-up upgrades.

## 8. Enemies (v1)

All enemies share: face the player, melee attack on contact (touching the player deals damage and triggers the player's i-frame), die on HP ≤ 0 with a particle poof and gem drop.

**a. Runner** — small humanoid (zombie or imp asset). 20 HP, 4.5 m/s, deals 8 damage on touch. Common, spawns in clusters.

**b. Brute** — large monster (orc or troll asset). 80 HP, 2 m/s, deals 18 damage on touch. Rare, spawns alone or in pairs.

**c. Mini-Boss** (spawns at 5:00) — oversized brute variant, scaled 2x. 600 HP, 2.5 m/s, 30 damage on touch. Drops a large XP gem worth 5 levels of XP and a temporary HP refill on death.

## 9. Waves & Difficulty Curve

Continuous spawning from the arena edge (just outside the camera frustum), capped by an active enemy budget that grows over time:

| Time   | Active enemy cap | Spawn rate     | Mix                        |
|--------|------------------|----------------|----------------------------|
| 0:00   | 30               | 1/sec          | 100% Runner                |
| 1:00   | 60               | 2/sec          | 100% Runner                |
| 2:30   | 100              | 3/sec          | 90% Runner, 10% Brute      |
| 5:00   | 150 + Mini-Boss  | 4/sec          | 80% Runner, 20% Brute      |
| 7:00   | 220              | 5/sec          | 70% Runner, 30% Brute      |
| 9:00   | 300              | 6/sec          | 60% Runner, 40% Brute      |
| 10:00  | —                | —              | Victory                    |

Numbers are starting points; final values come from in-engine tuning.

## 10. XP, Levels, Upgrades

- Runner drops 1 XP gem (worth 1 XP). Brute drops 1 large gem (worth 5 XP).
- XP curve: level N requires `5 + N * 3` XP. (Lvl 1→2: 8 XP, 2→3: 11, 3→4: 14, ...)
- On level-up: time scales to 0, screen darkens, three upgrade cards fly in from below.
- Player picks one with mouse click, keys 1/2/3, or gamepad A.

**Upgrade pool:**
- Unlock Auto-Pistol (only if not owned)
- Unlock Shockwave Pulse (only if not owned)
- Orbiting Blades +1 level
- Auto-Pistol +1 level (only if owned)
- Shockwave Pulse +1 level (only if owned)
- +20 max HP
- +10% move speed
- +1m magnet radius
- +5% damage (global)
- +10% cooldown reduction (global, max 50%)

Card selection is random from valid pool entries, no duplicates per offer.

## 11. UI

**HUD (always visible):**
- Top-left: HP bar (red), small heart icon
- Top-center: run timer (mm:ss), current level
- Bottom: XP bar spanning width, fills up to next level
- Bottom-right: weapon icons with level pips

**Modals:**
- Pause menu (resume, restart, settings)
- Level-up upgrade picker (3 cards)
- Game-over screen (run time survived, level reached, restart button)
- Victory screen (at 10:00 — confetti particles, "You survived!", restart)
- Title screen (game name, Play button, controls hint)

UI is pure HTML/CSS overlaid on the canvas — easier to style and accessible.

## 12. Feel & Juice

These are non-negotiable for the slice to feel good:
- **Hit flash:** enemies tint white for 80ms when struck
- **Knockback:** hit enemies are pushed 0.3–1.0m away from damage source
- **Death poof:** small burst of colored particles + a "poof" sound
- **Damage numbers:** floating numbers above enemies, color-coded by weapon, fade out after 0.6s
- **Screen shake:** small on player damage (0.1s, 0.05 amp), large on shockwave (0.2s, 0.15 amp), big on mini-boss death (0.5s, 0.25 amp)
- **Hit-stop:** 40ms pause when player is damaged
- **Level-up:** brief slow-mo (timeScale 0.1 for 0.3s) before pause, gold sparkle particles around player
- **Audio:** distinct SFX for gem pickup (rising chime), level-up (fanfare), each weapon, enemy death, player damage, mini-boss spawn

## 13. Audio

- Background music: one looping track, ~120 BPM, dark-fantasy mood (Kenney music pack or freesound CC0)
- Master, music, SFX volume sliders in pause menu
- Positional audio for enemy footsteps and deaths (Howler 3D mode)

## 14. Architecture

```
src/
  main.ts                    # entry point, top-level state machine
  engine/
    renderer.ts              # Three.js scene, camera, post-processing chain
    camera-rig.ts            # smoothed chase camera
    input.ts                 # keyboard + gamepad
    audio.ts                 # Howler wrapper
    physics.ts               # Rapier world setup, helpers
    assets.ts                # GLTF + texture + audio loader with cache
    instancing.ts            # InstancedMesh pool helper for enemies
  game/
    state.ts                 # global game state (running, paused, level-up, dead, won)
    arena.ts                 # ground, props, sky, lighting, boundary
    player.ts                # character, stats, animation state, i-frames
    weapons/
      base.ts                # Weapon interface + base class
      orbiting-blades.ts
      auto-pistol.ts
      shockwave-pulse.ts
    enemies/
      base.ts                # Enemy interface
      runner.ts
      brute.ts
      mini-boss.ts
      spawner.ts             # wave logic, active cap, spawn rate
    xp.ts                    # gem entities, magnet, level curve
    upgrades.ts              # pool + selection logic
    vfx.ts                   # particles, hit flashes, damage numbers, screen shake
    feel.ts                  # hit-stop, slow-mo, time scale
  ui/
    hud.ts
    title.ts
    pause.ts
    level-up.ts
    game-over.ts
    victory.ts
    settings.ts
public/
  assets/
    models/      # GLTF files
    hdri/        # .hdr files
    audio/       # ogg/mp3
    textures/    # particle sprites, etc
```

### State Machine

Top-level states: `Title → Playing → (Paused | LevelUp) → Playing → (GameOver | Victory) → Title`.

The game loop ticks all systems each frame except when in `Paused`, `LevelUp`, `GameOver`, `Victory`, or `Title`. The level-up state pauses simulation but keeps render running (for the slow-mo intro and card animations).

### Component Boundaries

- **Engine layer** has no knowledge of game rules. It exposes scene graph, physics world, input, and asset loading.
- **Game layer** owns gameplay rules and entities; consumes engine services.
- **UI layer** is HTML/CSS, communicates with game via a small event bus (events: `xp-changed`, `hp-changed`, `level-up`, `game-over`, `victory`, `pause-toggled`).

### Frame loop

```
each frame:
  dt = clock delta (capped at 1/30s)
  input.poll()
  if state == Playing:
    physics.step(dt)
    player.update(dt)
    spawner.update(dt)
    enemies.update(dt)        # AI: seek player, melee on contact
    weapons.update(dt)        # cooldowns, fire, projectiles
    xp.update(dt)             # magnet, pickup
    vfx.update(dt)
  cameraRig.update(dt)
  renderer.render(scene)
```

## 15. Performance

- Enemy meshes use `InstancedMesh`, one per enemy type. Per-instance matrix updated each frame from a flat `Float32Array`.
- Enemy AI is dead simple (move toward player), runs in plain JS — no per-enemy physics body; instead a fast capsule-vs-capsule check against the player only. Enemy-vs-enemy uses lightweight position spread (push apart by ε if overlapping).
- Projectiles tracked in a typed-array pool, capped at 256 active.
- Particles: max 1000 active, GPU-instanced quads.
- Shadow map: 2048×2048, only player + mini-boss cast shadows.
- Object pooling for everything (gems, projectiles, particles, damage numbers).

## 16. Testing & Verification

This is a feel-driven game; automated tests cover what they're good at and manual QA covers the rest.

- **Unit tests** (Vitest): pure logic — XP curve math, upgrade pool selection (correct exclusions), wave table lookup, weapon damage calculation.
- **Manual QA in browser:** every commit cycle, run a full 10-minute survival in-browser and verify framerate, controls, hit feedback, audio, and that nothing crashes.
- **Performance probe:** in-game FPS counter (toggleable with backtick) showing fps, draw calls, active enemy count.

## 17. Deliverables

1. Source repo at `/Users/josh/Documents/AI-Projects/claudecode/SwarmGrinderGame` with full game source.
2. `npm run dev` launches the game on `http://localhost:5173`.
3. `npm run build` produces a `dist/` ready for static hosting.
4. Documented controls + asset attributions in `README.md`.
5. A working playthrough proven by running the dev server and surviving a wave in-browser.

## 18. Out of Scope (for the slice)

- Multiple characters
- Multiple arenas / biomes
- Weapon evolutions (combine 2 maxed weapons)
- Meta-progression (gold, permanent upgrades between runs)
- Hub area
- Daily challenges, leaderboards
- Mobile touch controls
- Localization
- Save/load
