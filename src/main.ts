import * as THREE from 'three';
import { Renderer } from './engine/renderer';
import { Input } from './engine/input';
import { TouchControls, isTouchDevice } from './engine/touch';
import { CameraRig } from './engine/camera-rig';
import { getPreset } from './engine/quality';
import { Audio } from './engine/audio';
import { Music } from './engine/music';
import { buildArena } from './game/arena';
import { TOD_PRESETS, pickRandomTod } from './game/timeofday';
import { Torch } from './game/torch';

/**
 * Walk every descendant of the scene and dispose its GPU resources before
 * removing it. Three.js does NOT auto-dispose on scene.clear() — geometries,
 * materials, textures, and render targets stay on the GPU until manually
 * released. Without this, each /restart leaks the previous run's entire
 * arena (mountains, trees, grass tufts, motes, sky texture) plus the
 * weapons, enemies, vfx, and player rigs.
 */
function disposeSceneContents(scene: THREE.Scene) {
  const disposed = new Set<number>();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposed.has(mesh.geometry.id)) {
      disposed.add(mesh.geometry.id);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : (mesh.material ? [mesh.material] : []);
    for (const m of mats) {
      if (!m || disposed.has(m.id)) continue;
      disposed.add(m.id);
      // dispose any textures the material references
      for (const key of Object.keys(m) as (keyof THREE.Material)[]) {
        const v = (m as any)[key];
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      m.dispose();
    }
  });
  // Background can be a Texture (our sky gradient) — dispose it too.
  const bg = scene.background as any;
  if (bg && bg.isTexture) bg.dispose();
  scene.clear();
}
import { Player } from './game/player';
import { EnemyManager } from './game/enemies';
import { WeaponSystem } from './game/weapons';
import { Vfx } from './game/vfx';
import { XpSystem } from './game/xp';
import { Spawner, RUN_DURATION } from './game/spawner';
import { rollUpgradeOptions } from './game/upgrades';
import { Hud } from './ui/hud';
import { TitleScreen, PauseScreen, GameOverScreen, VictoryScreen, LevelUpScreen, CharacterSelectScreen } from './ui/screens';
import type { GameState } from './game/types';
import type { CharacterDef } from './game/characters';
import { CHARACTERS } from './game/characters';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLDivElement;

// Debug mode is opt-in via ?debug=1 query string. Hides the FPS/enemy
// counter and any other dev-only overlays in normal play.
const debugMode = new URLSearchParams(window.location.search).has('debug');

// Graphics preset (low / medium / high). Persisted in localStorage; default
// is medium on touch, high on desktop. See engine/quality.ts.
const qualityPreset = getPreset();
const frameMinMs = qualityPreset.fpsCap > 0 ? 1000 / qualityPreset.fpsCap - 1 : 0;
let renderer: Renderer;
try {
  renderer = new Renderer(canvas, qualityPreset);
} catch (err) {
  uiRoot.innerHTML = `
    <div class="modal">
      <h1>WebGL Not Available</h1>
      <p>Your browser couldn't create a 3D rendering context. Make sure WebGL2 is enabled,
         try a different browser (Chrome / Firefox / Edge), or check that hardware acceleration is on.</p>
      <p style="font-size:12px; opacity:0.6; max-width:600px; word-break:break-word;">${(err as Error).message}</p>
    </div>`;
  throw err;
}
const input = new Input();
const touch = isTouchDevice() ? new TouchControls(uiRoot) : null;
if (touch) {
  // Mark <body> so the short-viewport CSS can hide keyboard/gamepad hints
  // that don't apply to touch players.
  document.body.classList.add('touch-mode');
  input.attachTouch(touch);
  // Landscape gate. Shown by a CSS media query (portrait + coarse pointer) so
  // we don't have to listen for orientation events. Best-effort: try to lock
  // landscape after a user gesture (works in some Android browsers in PWAs).
  const gate = document.createElement('div');
  gate.className = 'landscape-gate';
  gate.innerHTML = '<div class="landscape-gate-inner"><div class="landscape-gate-icon">\u21BB</div><div>Please rotate your device.<br/>Horde Times prefers landscape.</div></div>';
  uiRoot.appendChild(gate);
  const tryLock = () => {
    const orient = (screen as any).orientation;
    try { orient?.lock?.('landscape').catch(() => {}); } catch { /* not supported */ }
  };
  document.addEventListener('pointerdown', tryLock, { once: true });
}
const audio = new Audio();
const music = new Music();
const cameraRig = new CameraRig(renderer.camera);

// Browsers block audio until a user gesture. The first key/click/gamepad press
// resumes the audio context (Howler) so SFX play correctly. Important for
// controller-only players who never touch the keyboard or mouse.
input.onFirstInput = () => { audio.unlock(); /* music context resumes when play() is called */ };

// Brief on-screen toast when a controller connects/disconnects so the player
// knows it was detected and which buttons to use.
const toast = document.createElement('div');
toast.className = 'toast';
uiRoot.appendChild(toast);
let toastTimer: number | undefined;
window.addEventListener('input:gamepad-changed', (e) => {
  const detail = (e as CustomEvent).detail as { connected: boolean; id?: string };
  toast.textContent = detail.connected ? 'A controller has volunteered. Press A to begin.' : 'The controller has retired.';
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
});

let state: GameState = 'title';
let runTime = 0;
let runFps = 60;
let pausedShake: { amp: number; duration: number } | null = null;

// long-lived game world
let arenaRoot: THREE.Group | null = null;
let player: Player;
let enemies: EnemyManager;
let weapons: WeaponSystem;
let vfx: Vfx;
let xp: XpSystem;
let spawner: Spawner;
let timeScale = 1;

// UI
const hud = new Hud(uiRoot);
const title = new TitleScreen(uiRoot, () => openSelect());
const characterSelect = new CharacterSelectScreen(uiRoot);
const pauseScreen = new PauseScreen(uiRoot, () => setState('playing'), () => openSelect());
const gameOverScreen = new GameOverScreen(uiRoot, () => openSelect());
const victoryScreen = new VictoryScreen(uiRoot, () => openSelect());
const levelUpScreen = new LevelUpScreen(uiRoot);

let selectedCharacter: CharacterDef = CHARACTERS.knight;

hud.hide();
title.show();

function setState(next: GameState) {
  if (next === state) return;
  state = next;
  // hide all overlays
  pauseScreen.hide();
  gameOverScreen.hide();
  victoryScreen.hide();
  levelUpScreen.hide();
  characterSelect.hide();
  title.hide();
  if (next === 'title') { title.show(); hud.hide(); music.stop(); }
  if (next === 'select') {
    hud.hide();
    music.stop();
    characterSelect.show((c) => { selectedCharacter = c; startRun(); });
  }
  if (next === 'paused') pauseScreen.show();
  if (next === 'gameover') { gameOverScreen.show(runTime, xp.level); music.stop(); }
  if (next === 'victory') { victoryScreen.show(xp.level); music.stop(); }
  if (next === 'playing') hud.show();
  // Show touch UI only during active play. Modals (pause, levelup, gameover)
  // already provide their own taps; the joystick + pause button would just
  // sit on top of them otherwise.
  touch?.setEnabled(next === 'playing');
}

function openSelect() { setState('select'); }

function startRun() {
  // Teardown existing world. Walk every child of the scene and dispose its
  // GPU resources (geometries, materials, textures) before clearing — without
  // this, every restart leaks ~50 enemy materials, hundreds of cone+rock
  // geometries, the sky CanvasTexture, the mote ShaderMaterial, etc.
  if (arenaRoot) {
    disposeSceneContents(renderer.scene);
    arenaRoot = null;
    renderer.scene.background = new THREE.Color('#9bd3ff');
    renderer.scene.fog = new THREE.Fog('#9bd3ff', 60, 140);
  }

  // pick a fresh time-of-day per run — sunrise / day / sunset / night
  const tod = TOD_PRESETS[pickRandomTod()];
  renderer.renderer.toneMappingExposure = tod.exposure;
  arenaRoot = buildArena(renderer.scene, tod);
  player = new Player(selectedCharacter);

  // Torch: only carried during low-light TODs (sunset / night). Casts a warm
  // flickering point light around the character — gives the dark scenes that
  // RPG "I am the only source of light here" feel.
  if (tod.id === 'sunset' || tod.id === 'night') {
    const intensity = tod.id === 'night' ? 5.0 : 3.0;
    player.attachTorch(new Torch(intensity));
  }

  // start the per-character musical theme
  music.stop();
  music.play(selectedCharacter.id);
  renderer.scene.add(player.mesh);

  vfx = new Vfx(renderer.scene);
  enemies = new EnemyManager(renderer.scene);
  weapons = new WeaponSystem(renderer.scene, vfx, audio);
  weapons.add(selectedCharacter.startingWeapon);
  xp = new XpSystem(renderer.scene);
  xp.pickupSfx = () => audio.play('xpPickup');
  spawner = new Spawner();
  spawner.bossSpawnedCb = () => audio.play('boss');

  runTime = 0;
  timeScale = 1;
  cameraRig.snapTo(player.position);
  setState('playing');
}

// pause toggle
window.addEventListener('keydown', (e) => {
  // restart shortcut
  if (e.code === 'KeyR' && (state === 'gameover' || state === 'victory')) startRun();
});

// frame loop ----------------------------------------------------------
const clock = new THREE.Clock();
let fpsAcc = 0;
let fpsFrames = 0;
let lastFrameTs = 0;

function loop(nowMs: number = 0) {
  // Frame-rate cap (touch devices only — frameMinMs is 0 on desktop, no-op).
  // Skip the frame's work if we'd be ahead of schedule, but keep the rAF chain
  // alive so we wake up next vsync.
  if (frameMinMs > 0 && nowMs - lastFrameTs < frameMinMs) {
    requestAnimationFrame(loop);
    return;
  }
  lastFrameTs = nowMs;

  const rawDt = Math.min(clock.getDelta(), 1 / 30);
  const dt = rawDt * timeScale;
  // FPS
  fpsAcc += rawDt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    runFps = fpsFrames / fpsAcc;
    fpsAcc = 0;
    fpsFrames = 0;
  }

  input.poll();

  // Menu navigation via gamepad. Each menu state listens for the right buttons
  // (A to confirm, B to back/restart). Keyboard is handled by each screen's
  // own button click + key listeners.
  if (state === 'title') {
    if (input.confirmJustPressed()) openSelect();
  } else if (state === 'select') {
    const pick = input.levelUpPickJustPressed();
    if (pick >= 0) characterSelect.pickByIndex(pick);
  } else if (state === 'playing') {
    if (input.pauseJustPressed()) {
      setState('paused');
    } else {
      tickGame(dt);
    }
  } else if (state === 'paused') {
    if (input.pauseJustPressed() || input.confirmJustPressed()) setState('playing');
    else if (input.cancelJustPressed()) startRun();
  } else if (state === 'levelup') {
    // game world frozen but particles/vfx still tick a bit for ambience
    vfx.update(rawDt * 0.3);
    const pick = input.levelUpPickJustPressed();
    if (pick >= 0) levelUpScreen.pickByIndex(pick);
  } else if (state === 'gameover' || state === 'victory') {
    if (input.confirmJustPressed()) startRun();
  }

  // camera always follows
  if (player) {
    cameraRig.update(rawDt, player.position);
    // camera shake from vfx requests
    const sh = vfx.consumeShake();
    if (sh) cameraRig.shake(sh.amp, sh.duration);
  }

  renderer.render();

  if (state === 'playing') {
    hud.update(player, xp, weapons, runTime);
    // FPS counter only shown in debug mode (?debug=1 in URL).
    if (debugMode) hud.updateFps(runFps, enemies.count());
  }

  requestAnimationFrame(loop);
}

function tickGame(dt: number) {
  runTime += dt;

  const move = input.movement();
  // map screen input to world: camera looks down +Z toward origin from +z. Forward = -z.
  const worldX = move.x;
  const worldZ = move.y;

  // detect if any enemy near (for regen gating)
  let anyNear = false;
  enemies.forEach((e) => {
    const dx = e.pos.x - player.position.x;
    const dz = e.pos.z - player.position.z;
    if (dx * dx + dz * dz < 25) anyNear = true;
  });

  player.update(dt, worldX, worldZ, runTime, anyNear);
  enemies.update(dt, player.position, runTime, (dmg) => {
    if (runTime < player.iframeUntil) return; // absorbed silently
    const died = player.takeDamage(dmg, runTime);
    if (!died && player.stats.hp > 0) {
      audio.play('playerHurt');
      cameraRig.shake(0.06, 0.12);
    }
    if (died) {
      audio.play('gameOver');
      setState('gameover');
    }
  });
  weapons.update(dt, runTime, player, enemies);
  spawner.update(dt, runTime, enemies, player.position);

  // drain damage events into floating numbers — color matches the weapon palette
  for (const ev of enemies.damageEvents) {
    const color =
      ev.weapon === 'shockwave' ? '#88e0ff' :
      ev.weapon === 'blades'    ? '#b4eaff' :
      ev.weapon === 'lightning' ? '#caf6ff' :
      ev.weapon === 'boomerang' ? '#ffd166' :
                                  '#ffe066';
    hud.floatDamage(ev.pos, ev.amount, color, renderer.camera, window.innerWidth, window.innerHeight);
  }
  enemies.damageEvents.length = 0;

  // drain death events into XP gems + particles
  for (const ev of enemies.deathEvents) {
    xp.spawnFromKill(ev.pos, ev.kind);
    audio.play('enemyDeath', ev.kind === 'boss' ? 1.0 : 0.5);
    const color = ev.kind === 'runner' ? new THREE.Color(0xa8e063) :
                  ev.kind === 'brute' ? new THREE.Color(0xff8a5b) :
                  new THREE.Color(0xff77ff);
    vfx.burst(ev.pos, color, ev.kind === 'boss' ? 60 : 14, ev.kind === 'boss' ? 8 : 4);
    if (ev.kind === 'boss') {
      cameraRig.shake(0.4, 0.6);
      player.heal(player.stats.maxHp * 0.3);
    }
  }
  enemies.deathEvents.length = 0;

  xp.update(dt, runTime, player, () => onLevelUp());
  vfx.update(dt);

  // tick atmospheric motes (and any other arena-attached updaters)
  if (arenaRoot) {
    arenaRoot.traverse((o) => {
      const upd = (o as any).userData?.update as ((dt: number) => void) | undefined;
      if (upd) upd(dt);
    });
  }

  // victory
  if (runTime >= RUN_DURATION) {
    audio.play('victory');
    setState('victory');
  }
}

function onLevelUp() {
  audio.play('levelUp');
  vfx.sparkle(player.position);
  // brief slow-mo before opening picker
  timeScale = 0.15;
  setTimeout(() => {
    timeScale = 1;
    const cards = rollUpgradeOptions(player, weapons, 3);
    setState('levelup');
    levelUpScreen.show(cards, (i) => {
      cards[i].apply();
      setState('playing');
    });
  }, 220);
}

requestAnimationFrame(loop);
