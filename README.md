# Horde Times — A Survivor's Inconvenient Affair

A browser-playable 3D third-person horde-survivor in which you stand in a
field. The field, regrettably, fills with monsters. Move, dodge, and let your
weapons do the rest. Last ten minutes — without dying, ideally — and you may,
if you are very lucky, be permitted to do it again.

Pick from three reluctantly-employed heroes:
- **Sir Pommelry**, a Knight on probation, with two helpful knives
- **Mistress Quill**, a Witch in private practice, with electrocution to order
- **Margate Tossworthy**, a paid-up member of the Boomerang Throwers' Guild

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in any modern browser (Chrome / Firefox / Edge / Safari).
Click **Play**.

## Controls

### Keyboard / mouse
| Action               | Keys                          |
|----------------------|-------------------------------|
| Move                 | `W` `A` `S` `D` or arrow keys |
| Pause                | `Esc` or `P`                  |
| Pick upgrade card    | `1` `2` `3` (or click)        |
| Restart              | `R` (or click button)         |

### Xbox controller (or any standard-mapping gamepad)
| Action               | Button                 |
|----------------------|------------------------|
| Move                 | Left stick + D-pad     |
| Confirm / Play / Try Again / Resume | A       |
| Restart from pause   | B                      |
| Pause / Resume       | Start (≡)              |
| Pick upgrade cards   | X (left), A (middle), B (right) |

The UI auto-detects when a controller is connected and switches the on-screen
hints to controller glyphs. Plug it in and play — no setup needed.

## How to play

1. Your character has one starter weapon: **Orbiting Blades** (cyan crystals
   that spin around you and damage anything they touch).
2. Enemies spawn at the arena edge and chase you. They die when their HP
   reaches 0 and drop glowing **XP gems** (small blue or large purple).
3. Walk over gems to collect XP. When you fill the bar at the bottom of the
   screen, you **level up** — time slows, three upgrade cards appear, pick one.
4. Upgrades let you unlock new weapons (Auto-Pistol, Shockwave Pulse) or
   power up what you have. Stack the right combos and the swarm becomes a
   pinball table you stand in the middle of.
5. At **5:00** a mini-boss spawns. At **10:00** you win the run.

## Build for production

```bash
npm run build
```

Outputs a static `dist/` folder you can deploy to any host (Netlify, Vercel,
GitHub Pages, S3, etc).

## Tech

- **Three.js** — WebGL2 rendering with EffectComposer post-processing
  (UnrealBloom, SMAA anti-aliasing, custom color-grade + vignette pass,
  ACES Filmic tone mapping)
- **TypeScript** (strict) + **Vite**
- **Howler.js** for audio (procedurally synthesized SFX baked to WAV)
- **InstancedMesh** for grass tufts and XP gems (hundreds rendered cheap)
- Custom math-only physics (capsule-vs-capsule, projectile-vs-sphere) — no
  WASM physics engine; faster and smaller for this scale

## Art direction

All visuals are procedurally composed from Three.js primitives with carefully
tuned colors, flat shading, and lighting. No external asset packs required —
the entire game ships in a single self-contained bundle (~190 KB gzipped).

## Project structure

```
src/
  engine/          # renderer, camera, input, audio, event bus
  game/            # arena, player, enemies, weapons, vfx, xp, spawner, upgrades
  ui/              # HUD + screen overlays (HTML/CSS)
  main.ts          # state machine + frame loop
docs/superpowers/specs/
  2026-04-25-swarm-grinder-3d-design.md  # full design spec
```

## Dev tips

- Append `?debug=1` to the URL for the dev tuning panel (planned).
- The HUD shows live FPS and active enemy count in the top-right.
- All weapon cooldowns scale with the global `cooldownMult` stat. All
  damage scales with `damageMult`. Tweak in `game/upgrades.ts` to taste.

## License & attribution

Code: yours. The game uses no third-party art, audio, or model assets — every
visual is composed from primitives and every sound is synthesized in-engine.
Fonts (Cinzel, Inter) are loaded from Google Fonts (Open Font License).
