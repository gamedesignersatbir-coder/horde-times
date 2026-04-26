/**
 * Keyboard + Xbox-style gamepad input. Polled each frame.
 *
 * Gamepad button mapping (HTML5 standard mapping, Xbox controller):
 *   0=A  1=B  2=X  3=Y  4=LB  5=RB  6=LT  7=RT  8=Back  9=Start
 *   10=LS  11=RS  12=DUp  13=DDown  14=DLeft  15=DRight
 *
 * Movement is normalized to a unit-length vector (dx, dy) where +y is forward.
 *
 * The class also emits "rising-edge" gamepad events (consumed by the UI for menu
 * navigation: A to confirm, B to cancel, Start to pause, X/A/B for the three
 * level-up cards). It also calls `onFirstInput` once on the first key/button
 * press so we can resume the audio context (browser autoplay policy).
 *
 * Touch input lives in TouchControls (src/engine/touch.ts). When attached via
 * attachTouch(), its joystick vector is summed into movement() and its pause
 * taps fold into pauseJustPressed(), so callers stay device-agnostic.
 */

import type { TouchControls } from './touch';

type GamepadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' |
                     'Back' | 'Start' | 'LS' | 'RS' |
                     'DUp' | 'DDown' | 'DLeft' | 'DRight';

const PAD_INDEX: Record<GamepadButton, number> = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  Back: 8, Start: 9, LS: 10, RS: 11,
  DUp: 12, DDown: 13, DLeft: 14, DRight: 15,
};

export class Input {
  private keys = new Set<string>();
  private justPressedSet = new Set<string>();
  private prevKeys = new Set<string>();

  // gamepad state — per button we remember last frame's pressed state to detect rising edges
  private padPrev: Record<string, boolean> = {};
  private padJustPressed: Set<GamepadButton> = new Set();
  /** True if any active gamepad is currently connected. Used to switch UI hints. */
  hasGamepad = false;

  /** Fires once on the very first user input (key, mouse, or pad). Used to unlock audio. */
  onFirstInput?: () => void;
  private firstInputFired = false;

  private touch?: TouchControls;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.markFirstInput();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousedown', () => this.markFirstInput());
    window.addEventListener('touchstart', () => this.markFirstInput(), { passive: true });
    window.addEventListener('gamepadconnected', (e) => {
      this.hasGamepad = true;
      window.dispatchEvent(new CustomEvent('input:gamepad-changed', { detail: { connected: true, id: (e as GamepadEvent).gamepad.id } }));
    });
    window.addEventListener('gamepaddisconnected', () => {
      const pads = navigator.getGamepads?.() ?? [];
      this.hasGamepad = Array.from(pads).some((p) => !!p);
      window.dispatchEvent(new CustomEvent('input:gamepad-changed', { detail: { connected: this.hasGamepad } }));
    });
  }

  private markFirstInput() {
    if (!this.firstInputFired) {
      this.firstInputFired = true;
      this.onFirstInput?.();
    }
  }

  /** Attach a touch input source (virtual joystick + on-screen pause). */
  attachTouch(touch: TouchControls) {
    this.touch = touch;
    touch.onFirstInput = () => this.markFirstInput();
  }

  /** Call once per frame BEFORE reading. */
  poll() {
    // keyboard rising edges
    this.justPressedSet.clear();
    for (const k of this.keys) if (!this.prevKeys.has(k)) this.justPressedSet.add(k);
    this.prevKeys = new Set(this.keys);

    // gamepad rising edges
    this.padJustPressed.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let anyPad = false;
    for (const pad of pads) {
      if (!pad) continue;
      anyPad = true;
      for (const [name, idx] of Object.entries(PAD_INDEX)) {
        const pressed = !!pad.buttons[idx]?.pressed;
        const key = `${pad.index}:${name}`;
        if (pressed && !this.padPrev[key]) {
          this.padJustPressed.add(name as GamepadButton);
          this.markFirstInput();
        }
        this.padPrev[key] = pressed;
      }
      // first-input on stick movement too
      if (Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.5) this.markFirstInput();
    }
    // initial detection (pads can connect without firing the event)
    this.hasGamepad = anyPad || this.hasGamepad;
  }

  isDown(code: string) { return this.keys.has(code); }
  justPressed(code: string) { return this.justPressedSet.has(code); }

  /** Was the named gamepad button just pressed this frame (rising edge)? */
  padJustPressedBtn(btn: GamepadButton): boolean {
    return this.padJustPressed.has(btn);
  }

  /** Returns movement vector in world XZ plane, length 0..1. */
  movement(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;

    // gamepad: left stick + d-pad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const gx = pad.axes[0] ?? 0;
      const gy = pad.axes[1] ?? 0;
      if (Math.hypot(gx, gy) > 0.18) { x += gx; y += gy; }
      // d-pad
      if (pad.buttons[PAD_INDEX.DUp]?.pressed) y -= 1;
      if (pad.buttons[PAD_INDEX.DDown]?.pressed) y += 1;
      if (pad.buttons[PAD_INDEX.DLeft]?.pressed) x -= 1;
      if (pad.buttons[PAD_INDEX.DRight]?.pressed) x += 1;
      break;
    }

    // touch joystick (only contributes when enabled)
    if (this.touch?.enabled) {
      const tv = this.touch.vector();
      x += tv.x;
      y += tv.y;
    }

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /** Pause-toggle: ESC, P, gamepad Start, or on-screen pause button. */
  pauseJustPressed(): boolean {
    if (this.justPressed('Escape') || this.justPressed('KeyP') || this.padJustPressedBtn('Start')) return true;
    return this.touch?.pauseJustPressed() ?? false;
  }

  /** Confirm / accept (menus, "Play", "Try Again", "Resume"): Enter, Space, or gamepad A. */
  confirmJustPressed(): boolean {
    return this.justPressed('Enter') || this.justPressed('Space') || this.padJustPressedBtn('A');
  }

  /** Cancel / back: gamepad B. */
  cancelJustPressed(): boolean {
    return this.padJustPressedBtn('B');
  }

  /**
   * Level-up card pick — returns 0/1/2 when the player chooses a card via gamepad,
   * or -1 if no pick this frame. (Keyboard 1/2/3 are handled by the screen directly.)
   * Mapping: X = card 1 (left), A = card 2 (middle), B = card 3 (right). This matches
   * the physical layout of the Xbox face buttons (X left, A bottom-center, B right).
   */
  levelUpPickJustPressed(): number {
    if (this.padJustPressedBtn('X')) return 0;
    if (this.padJustPressedBtn('A')) return 1;
    if (this.padJustPressedBtn('B')) return 2;
    return -1;
  }
}
