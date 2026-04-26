import * as THREE from 'three';
import { WEAPON_DEFS } from '../game/weapons';
import type { WeaponSystem } from '../game/weapons';
import type { Player } from '../game/player';
import type { XpSystem } from '../game/xp';

export class Hud {
  private root: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpText: HTMLDivElement;
  private xpFill: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private levelEl: HTMLDivElement;
  private weaponsEl: HTMLDivElement;
  private dmgLayer: HTMLDivElement;
  private fpsEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-time" id="hud-time">00:00</div>
        <div class="hud-level" id="hud-level">LEVEL 1</div>
      </div>
      <div class="hud-hp">
        <div class="hud-hp-bar">
          <div class="hud-hp-fill" id="hud-hp-fill" style="width:100%"></div>
          <div class="hud-hp-text" id="hud-hp-text">100 / 100</div>
        </div>
      </div>
      <div class="hud-xp"><div class="hud-xp-fill" id="hud-xp-fill" style="width:0%"></div></div>
      <div class="hud-weapons" id="hud-weapons"></div>
      <div class="dmg-layer" id="dmg-layer"></div>
      <div class="hud-fps hidden" id="hud-fps"></div>
    `;
    parent.appendChild(this.root);
    this.hpFill = this.root.querySelector('#hud-hp-fill') as HTMLDivElement;
    this.hpText = this.root.querySelector('#hud-hp-text') as HTMLDivElement;
    this.xpFill = this.root.querySelector('#hud-xp-fill') as HTMLDivElement;
    this.timeEl = this.root.querySelector('#hud-time') as HTMLDivElement;
    this.levelEl = this.root.querySelector('#hud-level') as HTMLDivElement;
    this.weaponsEl = this.root.querySelector('#hud-weapons') as HTMLDivElement;
    this.dmgLayer = this.root.querySelector('#dmg-layer') as HTMLDivElement;
    this.fpsEl = this.root.querySelector('#hud-fps') as HTMLDivElement;
  }

  show() { this.root.style.display = ''; }
  hide() { this.root.style.display = 'none'; }

  update(player: Player, xp: XpSystem, weapons: WeaponSystem, runTime: number) {
    const hpPct = (player.stats.hp / player.stats.maxHp) * 100;
    this.hpFill.style.width = `${Math.max(0, hpPct).toFixed(1)}%`;
    this.hpText.textContent = `${Math.ceil(player.stats.hp)} / ${player.stats.maxHp}`;

    const xpPct = (xp.xp / xp.xpToNext) * 100;
    this.xpFill.style.width = `${xpPct.toFixed(1)}%`;
    this.levelEl.textContent = `LEVEL ${xp.level}`;

    const m = Math.floor(runTime / 60);
    const s = Math.floor(runTime % 60);
    this.timeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // weapons
    const equipped = Array.from(weapons.equipped.values());
    if (this.weaponsEl.childElementCount !== equipped.length) {
      this.weaponsEl.innerHTML = '';
      for (const w of equipped) {
        const def = WEAPON_DEFS[w.kind];
        const el = document.createElement('div');
        el.className = 'hud-weapon';
        el.dataset.kind = w.kind;
        el.innerHTML = `${def.icon}<div class="hud-weapon-pips"></div>`;
        this.weaponsEl.appendChild(el);
      }
    }
    for (let i = 0; i < equipped.length; i++) {
      const w = equipped[i];
      const def = WEAPON_DEFS[w.kind];
      const el = this.weaponsEl.children[i] as HTMLDivElement;
      const pips = el.querySelector('.hud-weapon-pips')!;
      if (pips.childElementCount !== def.maxLevel) {
        pips.innerHTML = '';
        for (let p = 0; p < def.maxLevel; p++) {
          const dot = document.createElement('div');
          dot.className = 'hud-weapon-pip';
          pips.appendChild(dot);
        }
      }
      for (let p = 0; p < def.maxLevel; p++) {
        (pips.children[p] as HTMLDivElement).classList.toggle('on', p < w.level);
      }
    }
  }

  updateFps(fps: number, enemies: number) {
    this.fpsEl.classList.remove('hidden');
    this.fpsEl.textContent = `${fps.toFixed(0)} fps   ${enemies} enemies`;
  }

  // Cap concurrent damage numbers — chain lightning + shockwave can otherwise
  // spawn 50+ DOM nodes per frame, each running its own RAF. Above the cap,
  // new numbers replace the oldest.
  private static MAX_DAMAGE_NUMBERS = 24;
  private dmgProj = new THREE.Vector3();

  /** Float a damage number at world pos by projecting to screen. */
  floatDamage(worldPos: THREE.Vector3, amount: number, color: string, camera: THREE.Camera, w: number, h: number) {
    // Re-use a single Vector3 for projection — was cloning per call.
    this.dmgProj.copy(worldPos).project(camera);
    if (this.dmgProj.z > 1) return;
    // Drop if we're already at the cap. Cheap rule, prevents the storm scenario.
    if (this.dmgLayer.childElementCount >= Hud.MAX_DAMAGE_NUMBERS) return;
    const sx = (this.dmgProj.x * 0.5 + 0.5) * w;
    const sy = (-this.dmgProj.y * 0.5 + 0.5) * h;
    const el = document.createElement('div');
    el.className = 'dmg-num';
    el.style.color = color;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.transform = `translate(-50%, -50%)`;
    const drift = (Math.random() - 0.5) * 30;
    el.textContent = String(Math.ceil(amount));
    this.dmgLayer.appendChild(el);
    const start = performance.now();
    const dur = 600;
    const step = (now: number) => {
      const t = (now - start) / dur;
      if (t >= 1) { el.remove(); return; }
      el.style.transform = `translate(-50%, calc(-50% - ${t * 30}px)) translateX(${drift * t}px) scale(${1.2 - t * 0.3})`;
      el.style.opacity = String(1 - t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
