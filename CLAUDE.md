# Horde Times — project handoff

This file is read automatically at the start of every Claude Code session in this repo. It is the single source of truth for project state, who the user is, and what to do next.

## What this project is

A browser-playable 3D horde-survivor (Three.js + TypeScript + Vite + Howler.js). Custom math-only physics — capsule-vs-capsule, no Rapier. ~236 KB gzipped after the GLB pipeline. Deployed to Netlify on push to `main`.

The game was built originally with procedural primitive characters. We are mid-overhaul to wire in six rigged Blender characters as GLB assets, with character-specific embodied attacks (sword swing, staff thrust, boomerang throw) driven by the Attack animation. Telegraphed enemy attacks (stop, windup, strike, recover). Same feel and "perfect sense of fun" as the original prototype.

## Who the user is

Game designer, not a programmer. Defers all technical implementation calls to Claude. When the user delegates ("you take the call", "keep moving forward"), do not ask follow-up implementation questions — execute. The user reviews the result and corrects course in plain language ("the colours look off", "the attack direction is wrong"). Frame explanations in design / play-feel terms, not engine internals, unless asked.

## Branches

- `main` — original procedural-primitive prototype, kept safe.
- `character-overhaul` — the GLB overhaul work. **Continue from this branch.** It is `git push`ed to GitHub; just `git checkout character-overhaul` after a fresh clone.

## Stack & layout

- `src/engine/` — engine glue: `assets.ts` (AssetCache + cloneFor), `character-palette.ts` (linear-RGB material overrides extracted from .blend Color Ramps), `audio.ts`, `camera-rig.ts`, `vfx.ts`.
- `src/game/` — gameplay: `player.ts`, `enemies.ts`, `weapons.ts`, `animated-character.ts` (5-state FSM Idle/Run/Attack/Hit/Death), `characters.ts`, `spawner.ts`, `xp.ts`, `arena.ts`, `torch.ts`.
- `src/ui/` — title, character-select, level-up, HUD, settings.
- `src/main.ts` — boot + main loop.
- `public/assets/characters/*.glb` — the six runtime character assets, shipped with the build.
- `docs/superpowers/specs/2026-05-07-blender-character-overhaul-design.md` — design intent spec.
- `docs/superpowers/plans/2026-05-07-blender-character-overhaul.md` — 29-task implementation plan, Phases A–G. **This is your authoritative roadmap. Read it before resuming work.**

## Asset pipeline

Six GLBs, one per character. Each bundles geometry, bone-parented (NOT skinned) marionette rig, and five animations (Idle, Run, Attack, Hit, Death) baked at 24 fps.

| Character          | Asset id              | Strike-frame | Attack frames | Role |
|--------------------|-----------------------|--------------|---------------|------|
| Sir Pommelry       | `sir_pommelry`        | 12           | 22            | Knight starter — sword swing |
| Mistress Quill     | `mistress_quill`      | 12           | 24            | Witch starter — staff thrust → lightning |
| Margate Tossworthy | `margate_tossworthy`  | 12           | 20            | Hunter starter — returning boomerang |
| Runner             | `runner`              | 11           | 22            | Common enemy |
| Brute              | `brute`               | 14           | 29            | Heavy enemy |
| Boss               | `boss`                | 18           | 35            | Boss enemy |

`AssetCache.preloadAll()` runs at boot (gates the title-screen "Pick a Volunteer" button). `cloneFor(id)` returns an independent skeleton/material clone wrapped in a fixed group hierarchy — see "Consumer-side workarounds" below.

### Source files (NOT in repo)

These live on the user's local disk, not in the GitHub repo. If you need them at a fresh machine, ask the user to copy them over.

- `horde_times_exports/horde_times_assetssaveanim02.blend` — the source .blend.
- `horde_times_exports/*.glb` — the export staging copies (these mirror what's in `public/assets/characters/`; whichever is newer is authoritative).
- `horde_times_exports/GODOT_HANDOFF.md` — the original Godot-port handoff doc; some tables (heights, strike frames, rigid-cloth quirks) are still useful even though we stayed on Three.js.
- `extract_*.py` — headless Blender extraction scripts used to pull material colours and bounding boxes from the .blend. Run via `"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b <blend> --python <script.py>`.

The path on the prior machine was `E:\AI Data\ClaudeCode\test\HordeTimes\horde_times_exports\`.

### Consumer-side workarounds (engine/assets.ts → cloneFor)

The .blend has three quirks that the engine works around at clone time. If a future Blender re-export fixes them upstream, this consumer code can be simplified.

1. **Off-origin meshes.** Several characters in the .blend are positioned off the world origin (knight at X=-1.29, witch at +0.60, boss at +2.81 — laid out as a roster). The export carries that into the GLB. We compute the bounding box at clone time and translate the inner group by `-cx, -bbox.min.y, -cz` so feet are at Y=0 and rotation pivots through the visual centre.

2. **Forward-axis flip.** GLBs are authored with character forward along **-Z**, but the codebase uses `Math.atan2(moveX, moveZ)` for facing, which expects forward = **+Z**. We wrap the cloned scene in an orient `Group` with `rotation.y = π` so the authored -Z forward becomes +Z.

3. **Lost material colours.** The .blend uses procedural Color Ramp + Noise Texture node graphs feeding the Principled BSDF. glTF export only round-trips `baseColorFactor` and textures — Color Ramp graphs do not survive. Most `M_*` materials shipped as plain white. We patch them at clone time using `MATERIAL_COLORS_LINEAR` (in `engine/character-palette.ts`), values extracted from the .blend's Color Ramps via headless Blender, applied via `setRGB(r, g, b, THREE.LinearSRGBColorSpace)`. The wood-grain noise variation is lost — user has accepted the flat-shaded look as good-enough.

Plus a fourth, smaller workaround: eyes are coplanar with the visor in some characters; we set `polygonOffset` on `M_Eye*` materials to push them toward the camera so the visor is unambiguously behind them. Without this they "blink" as the camera moves due to depth-precision wobble.

## Phases — implementation status

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| A | Asset pipeline + Knight as GLB (AssetCache, AnimatedCharacter Idle/Run, character-palette, polygon offset, bbox centring, facing-flip wrapper) | DONE | b771eb4, c8f47c9, cb8b7ff |
| B | Player Attack/Hit/Death animations with strike-frame events | DONE | 3d1786c |
| C | Knight `swordswing` weapon (cone-arc damage, animation-coupled cooldown, crescent VFX) | DONE | 3d1786c |
| C-fix | Sword-swing visual direction fix (intrinsic Euler bug) | DONE | 5d9b490 |
| D | Witch + Hunter as GLB; lightning + boomerang firings coupled to Attack | DONE | 3d1786c |
| Anim re-export | User re-keyframed attack/hit/death in Blender; new GLBs copied into repo | DONE | bb4b8a4 |
| E | Enemies (runner/brute/boss) as GLB-backed AnimatedCharacter; telegraphed FSM (chase → attacking → recover); strike-frame-gated damage; deferred gem drop after Death anim | DONE | 8ae8a8d |
| F | Polish — see punch list below | PARTIAL — Task 23 N/A, Task 25 absorbed into E |
| G | Verification & ship — see punch list below | PARTIAL — typecheck/tests/prod-build pass, end-to-end smoke pending |

### Pending punch list (start here)

From `docs/superpowers/plans/2026-05-07-blender-character-overhaul.md`:

- **Task 20** — Camera height / pitch tuning for the GLB models. The current `cameraRig.lookOffset.y` is 0.9; verify it reads well across all three heroes during play.
- **Task 21** — Shadow `normalBias` to suppress joint-seam acne where rigid bone-parented limb pieces meet.
- **Task 22** — Mixer update gating for off-screen enemies (cull `AnimationMixer.update` when distance > some threshold to save CPU under heavy waves).
- **Task 23** — *Skip.* The character-select cards are HTML-only and never had a 3D preview. Plan Task 23 ("character-select preview uses the GLBs") would be net-new feature work outside the overhaul scope.
- **Task 24** — Enemy windup audio cue. Telegraphed attack should have a small whoosh / inhale on the first frame of the windup so the player can react.
- **Task 25** — *Already done.* Dead procedural enemy code (`buildMonsterMesh`) was removed as part of the Phase E rewrite.
- **Task 26 / 27** — Run unit test suite + production build smoke. Currently green: `npm run typecheck`, `npm test` (14/14), `npm run build` (231 KB gzip). Re-run before shipping.
- **Task 28** — Full 10-minute end-to-end smoke. The Playwright smoke runs we did were ~30-second sessions; a full 10-min run validates wave scaling, boss spawn at 5:00, level-ups, weapon unlocks.
- **Task 29** — Final branch cleanup: squash merge or leave as-is; user's call. Then merge `character-overhaul` → `main`.

### Known visual gaps (open, but accepted by the user)

- **Wood-grain shader lost.** The Blender procedural Color Ramp + Noise Texture variation didn't survive glTF export. Materials are flat-shaded with the lighter end of each ramp. User has accepted this; revisit only if they ask. Reference image of the intended Blender look at `C:\Users\Satbir\Pictures\Screenshots\Screenshot 2026-05-07 162020.png` (on the original machine).
- **Bone-parented marionette aesthetic.** Limbs are rigid pieces parented to bones, NOT skinned. Joints can show small gaps at extreme rotations. Intentional and documented in the original handoff doc. Don't try to "fix" this — the user wants the wooden-toy look.

## Local dev

```bash
npm install
npm run dev        # vite, port 5173
npm run typecheck  # tsc --noEmit, must be clean
npm test           # vitest run (14 tests as of Phase E)
npm run build      # vite build → dist/
```

For browser smoke testing, the Playwright MCP server is available — `mcp__plugin_playwright_playwright__browser_*`. Vite dev runs hot, but full reloads happen on TS edits; expect the title screen between iterations.

## Working agreements

- **Skill-first.** Use the superpowers skill system. The brainstorming skill before non-trivial design choices, debugging skill before fixing bugs, TDD when adding new behaviour with clean test surface.
- **Don't ask the user implementation questions** when they have delegated. Pick the right call, save the rationale to memory if it's non-obvious, move on.
- **Commit per phase, not per micro-step.** Group related work into one descriptive commit. Push to `character-overhaul` regularly so progress is durable across sessions and machines.
- **Keep this CLAUDE.md current.** When you finish a phase or learn something non-obvious about the codebase or user, update the relevant section here so the next session starts informed.
