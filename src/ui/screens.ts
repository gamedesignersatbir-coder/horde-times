import type { UpgradeOption } from '../game/upgrades';
import type { CharacterDef } from '../game/characters';
import { CHARACTER_LIST } from '../game/characters';
import { WEAPON_DEFS } from '../game/weapons';
import { getQuality, setQuality, type Quality } from '../engine/quality';

/**
 * Adaptive controls hint — shows keyboard glyphs by default, switches to Xbox
 * button glyphs when a gamepad is connected. Updated globally via the
 * `input:gamepad-changed` custom event dispatched by Input.
 */
function setupControlsHint(host: HTMLElement, kb: string, pad: string) {
  const update = () => {
    const pads = navigator.getGamepads?.() ?? [];
    const hasPad = Array.from(pads).some((p) => !!p);
    host.innerHTML = hasPad ? pad : kb;
  };
  update();
  window.addEventListener('input:gamepad-changed', update);
}

const GLYPH = {
  // Inline-styled "button" pills for controller hints. Colors match Xbox face buttons.
  A: `<span class="pad-btn" style="background:#5da14d">A</span>`,
  B: `<span class="pad-btn" style="background:#d0413e">B</span>`,
  X: `<span class="pad-btn" style="background:#3a7bc8">X</span>`,
  Y: `<span class="pad-btn" style="background:#e2b13b">Y</span>`,
  Start: `<span class="pad-btn pad-btn-pill">≡</span>`,
  LStick: `<span class="pad-btn pad-btn-pill">L Stick</span>`,
};

export class TitleScreen {
  private el: HTMLDivElement;
  private settings: SettingsScreen;
  constructor(parent: HTMLElement, onPlay: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'modal title-modal hidden';
    this.el.innerHTML = `
      <h1>HORDE<br/>TIMES</h1>
      <h2>· A SURVIVOR'S INCONVENIENT AFFAIR ·</h2>
      <p>Stand in a field. The field, regrettably, fills with monsters. You did not invite them. They are coming anyway. Last ten minutes — without dying, ideally — and you may, if you are very lucky, be permitted to do it again.</p>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button class="btn" id="play-btn">Pick a Volunteer</button>
        <button class="btn btn-secondary" id="settings-btn">\u2699 Settings</button>
      </div>
      <div class="controls-hint" id="title-hint" style="margin-top:28px;"></div>
    `;
    parent.appendChild(this.el);
    setupControlsHint(
      this.el.querySelector('#title-hint') as HTMLElement,
      `Move <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> &nbsp;·&nbsp; Pause <kbd>Esc</kbd> &nbsp;·&nbsp; Pick upgrades <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>`,
      `Move with ${GLYPH.LStick} &nbsp;·&nbsp; Pause ${GLYPH.Start} &nbsp;·&nbsp; Pick upgrades ${GLYPH.X} ${GLYPH.A} ${GLYPH.B}`,
    );
    const btn = this.el.querySelector('#play-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => onPlay());
    this.settings = new SettingsScreen(parent);
    (this.el.querySelector('#settings-btn') as HTMLButtonElement).addEventListener('click', () => this.settings.show());
  }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
}

export class PauseScreen {
  private el: HTMLDivElement;
  private settings: SettingsScreen;
  constructor(parent: HTMLElement, onResume: () => void, onRestart: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.innerHTML = `
      <h1>A Moment, Please</h1>
      <p>The monsters have agreed to wait. They are not, in fact, terribly patient about it. Best not to keep them.</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn" id="resume-btn">Carry On</button>
        <button class="btn" id="restart-btn">Try Someone Else</button>
        <button class="btn btn-secondary" id="pause-settings-btn">\u2699 Settings</button>
      </div>
      <div class="controls-hint" id="pause-hint" style="margin-top:24px;"></div>
    `;
    parent.appendChild(this.el);
    setupControlsHint(
      this.el.querySelector('#pause-hint') as HTMLElement,
      `<kbd>Esc</kbd> resume &nbsp;·&nbsp; click to restart`,
      `${GLYPH.A} resume &nbsp;·&nbsp; ${GLYPH.B} restart`,
    );
    (this.el.querySelector('#resume-btn') as HTMLButtonElement).addEventListener('click', () => onResume());
    (this.el.querySelector('#restart-btn') as HTMLButtonElement).addEventListener('click', () => onRestart());
    this.settings = new SettingsScreen(parent);
    (this.el.querySelector('#pause-settings-btn') as HTMLButtonElement).addEventListener('click', () => this.settings.show());
  }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
}

/**
 * Graphics quality picker. Three buttons (Low / Medium / High); selecting one
 * persists the choice and reloads the page so the new preset takes effect.
 * Reload-on-change is simpler than rebuilding the EffectComposer mid-run.
 */
export class SettingsScreen {
  private el: HTMLDivElement;
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'modal hidden settings-modal';
    const current = getQuality();
    const opts: Array<{ id: Quality; title: string; sub: string }> = [
      { id: 'low',    title: 'Low',    sub: 'Best battery, runs cool. Native pixels, hard shadows, light bloom.' },
      { id: 'medium', title: 'Medium', sub: 'Phone default. Balanced look + thermals.' },
      { id: 'high',   title: 'High',   sub: 'Desktop default. Soft shadows, full bloom, anti-aliasing.' },
    ];
    this.el.innerHTML = `
      <h1>Graphics</h1>
      <p>Pick a quality preset. The page will refresh to apply.</p>
      <div class="settings-options">
        ${opts.map((o) => `
          <button class="settings-option ${o.id === current ? 'active' : ''}" data-q="${o.id}">
            <div class="settings-option-title">${o.title}${o.id === current ? ' <span class="settings-tick">\u2713</span>' : ''}</div>
            <div class="settings-option-sub">${o.sub}</div>
          </button>
        `).join('')}
      </div>
      <button class="btn btn-secondary" id="settings-close">Close</button>
    `;
    parent.appendChild(this.el);
    this.el.querySelectorAll<HTMLButtonElement>('.settings-option').forEach((b) => {
      b.addEventListener('click', () => {
        const q = b.dataset.q as Quality;
        if (!q) return;
        setQuality(q);
        if (q === current) { this.hide(); return; }
        // Reload to rebuild the renderer + post-processing chain with the new preset.
        window.location.reload();
      });
    });
    (this.el.querySelector('#settings-close') as HTMLButtonElement).addEventListener('click', () => this.hide());
  }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
}

export class GameOverScreen {
  private el: HTMLDivElement;
  private timeEl!: HTMLSpanElement;
  private levelEl!: HTMLSpanElement;
  constructor(parent: HTMLElement, onRestart: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.innerHTML = `
      <h1>Bother</h1>
      <p>You held out for <span id="go-time">0:00</span>, ascending to <span id="go-level">level 1</span> of importance before being ascended into the next bit by something with too many teeth. Death, who keeps notes about these things, has filed it under "Statistically Inevitable."</p>
      <button class="btn" id="restart-btn">One More Go</button>
      <div class="controls-hint" id="go-hint" style="margin-top:24px;"></div>
    `;
    parent.appendChild(this.el);
    this.timeEl = this.el.querySelector('#go-time')!;
    this.levelEl = this.el.querySelector('#go-level')!;
    setupControlsHint(
      this.el.querySelector('#go-hint') as HTMLElement,
      `<kbd>R</kbd> or click to retry`,
      `${GLYPH.A} to retry`,
    );
    (this.el.querySelector('#restart-btn') as HTMLButtonElement).addEventListener('click', () => onRestart());
  }
  show(time: number, level: number) {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.levelEl.textContent = `level ${level}`;
    this.el.classList.remove('hidden');
  }
  hide() { this.el.classList.add('hidden'); }
}

export class VictoryScreen {
  private el: HTMLDivElement;
  private levelEl!: HTMLSpanElement;
  constructor(parent: HTMLElement, onRestart: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.innerHTML = `
      <h1>Well, Look at That</h1>
      <p>You outlasted the appointment. Reached <span id="vic-level">level 1</span> of importance. Death, somewhat put out, has been informed and is updating his ledger. The field is, briefly, a field again.</p>
      <button class="btn" id="restart-btn">Push Your Luck</button>
      <div class="controls-hint" id="vic-hint" style="margin-top:24px;"></div>
    `;
    parent.appendChild(this.el);
    this.levelEl = this.el.querySelector('#vic-level')!;
    setupControlsHint(
      this.el.querySelector('#vic-hint') as HTMLElement,
      `<kbd>R</kbd> or click for a new run`,
      `${GLYPH.A} for a new run`,
    );
    (this.el.querySelector('#restart-btn') as HTMLButtonElement).addEventListener('click', () => onRestart());
  }
  show(level: number) {
    this.levelEl.textContent = `level ${level}`;
    this.el.classList.remove('hidden');
  }
  hide() { this.el.classList.add('hidden'); }
}

export class LevelUpScreen {
  private el: HTMLDivElement;
  private cards: UpgradeOption[] = [];
  private onPick?: (i: number) => void;
  private keyHandler = (e: KeyboardEvent) => {
    if (this.el.classList.contains('hidden')) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') this.pick(0);
    if (e.code === 'Digit2' || e.code === 'Numpad2') this.pick(1);
    if (e.code === 'Digit3' || e.code === 'Numpad3') this.pick(2);
  };

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'levelup hidden';
    this.el.innerHTML = `
      <div class="levelup-title">PROMOTION</div>
      <div class="levelup-sub" id="levelup-sub">Pick a perk. The committee is waiting.</div>
      <div class="cards" id="cards"></div>
    `;
    parent.appendChild(this.el);
    window.addEventListener('keydown', this.keyHandler);
    // adapt the subtitle to controller users
    const sub = this.el.querySelector('#levelup-sub') as HTMLElement;
    const updateSub = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const hasPad = Array.from(pads).some((p) => !!p);
      sub.textContent = hasPad ? 'Press X · A · B' : 'Pick a perk. The committee is waiting.';
    };
    updateSub();
    window.addEventListener('input:gamepad-changed', updateSub);
  }

  /** Programmatic pick — used by gamepad poll loop in main.ts. */
  pickByIndex(i: number) { this.pick(i); }

  isOpen(): boolean { return !this.el.classList.contains('hidden'); }

  show(cards: UpgradeOption[], onPick: (i: number) => void) {
    this.cards = cards;
    this.onPick = onPick;
    const cardsEl = this.el.querySelector('#cards') as HTMLDivElement;
    cardsEl.innerHTML = '';
    const padHints = ['X', 'A', 'B'];
    cards.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'card';
      const padHint = padHints[i] ?? '';
      div.innerHTML = `
        <div class="card-tag">${c.tag}</div>
        <div class="card-icon">${c.icon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
        <div class="card-key">${i + 1} <span class="card-key-pad">${padHint}</span></div>
      `;
      div.addEventListener('click', () => this.pick(i));
      cardsEl.appendChild(div);
    });
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }

  private pick(i: number) {
    if (i < 0 || i >= this.cards.length) return;
    this.hide();
    this.onPick?.(i);
  }
}

/**
 * Character select — three hero cards. Pick with click, keys 1/2/3, or
 * gamepad X/A/B. Each card shows the hero's name, class, blurb, stat bars,
 * and starting weapon. Visual identity matches the level-up cards so the
 * whole UI reads as one piece.
 */
export class CharacterSelectScreen {
  private el: HTMLDivElement;
  private onPick?: (id: CharacterDef) => void;
  private keyHandler = (e: KeyboardEvent) => {
    if (this.el.classList.contains('hidden')) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') this.pick(0);
    if (e.code === 'Digit2' || e.code === 'Numpad2') this.pick(1);
    if (e.code === 'Digit3' || e.code === 'Numpad3') this.pick(2);
  };

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'levelup hidden';
    const cardsHtml = CHARACTER_LIST.map((c, i) => {
      const w = WEAPON_DEFS[c.startingWeapon];
      const padHints = ['X', 'A', 'B'];
      const hpPct = Math.round((c.stats.maxHp / 150) * 100);
      const spdPct = Math.round((c.stats.moveSpeed / 7) * 100);
      const dmgPct = Math.round((c.stats.damageMult / 1.4) * 100);
      return `
        <div class="card hero-card" data-idx="${i}">
          <div class="card-tag">${c.title}</div>
          <div class="hero-name">${c.name}</div>
          <div class="card-desc" style="margin: 6px 0 14px;">${c.blurb}</div>
          <div class="hero-stats">
            <div class="hero-stat"><span>HP</span><div class="bar"><div style="width:${hpPct}%"></div></div></div>
            <div class="hero-stat"><span>SPD</span><div class="bar"><div style="width:${spdPct}%"></div></div></div>
            <div class="hero-stat"><span>DMG</span><div class="bar"><div style="width:${dmgPct}%"></div></div></div>
          </div>
          <div class="hero-weapon">
            <div class="hero-weapon-icon">${w.icon}</div>
            <div class="hero-weapon-text">
              <div class="hero-weapon-tag">Starting Weapon</div>
              <div class="hero-weapon-name">${w.name}</div>
            </div>
          </div>
          <div class="card-key">${i + 1} <span class="card-key-pad">${padHints[i]}</span></div>
        </div>`;
    }).join('');
    this.el.innerHTML = `
      <div class="levelup-title" style="font-size:48px;">PICK A VOLUNTEER</div>
      <div class="levelup-sub" id="charsel-sub">All three are, regrettably, available.</div>
      <div class="cards">${cardsHtml}</div>
    `;
    parent.appendChild(this.el);
    this.el.querySelectorAll('.hero-card').forEach((card) => {
      card.addEventListener('click', () => this.pick(parseInt((card as HTMLElement).dataset.idx!, 10)));
    });
    window.addEventListener('keydown', this.keyHandler);
    // adapt subtitle for controller users
    const sub = this.el.querySelector('#charsel-sub') as HTMLElement;
    const updateSub = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const hasPad = Array.from(pads).some((p) => !!p);
      sub.textContent = hasPad ? 'Press X · A · B' : 'All three are, regrettably, available.';
    };
    updateSub();
    window.addEventListener('input:gamepad-changed', updateSub);
  }

  pickByIndex(i: number) { this.pick(i); }
  isOpen(): boolean { return !this.el.classList.contains('hidden'); }
  show(onPick: (c: CharacterDef) => void) { this.onPick = onPick; this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  private pick(i: number) {
    if (i < 0 || i >= CHARACTER_LIST.length) return;
    this.hide();
    this.onPick?.(CHARACTER_LIST[i]);
  }
}
