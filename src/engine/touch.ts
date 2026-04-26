/**
 * Touch input — virtual joystick (bottom-left, floating) + on-screen pause button.
 *
 * Floating joystick: touching anywhere in the bottom-left half of the screen
 * spawns the joystick base at the touch point. The thumb follows the finger,
 * capped at JOYSTICK_RADIUS, with a small dead-zone so a still finger reads as
 * zero movement. Releasing the finger hides the joystick.
 *
 * The pause button is a separate top-right DOM button. Its taps are queued as
 * a rising edge that Input.pauseJustPressed() consumes once per frame.
 *
 * This module owns its DOM and event listeners. Input composes a TouchControls
 * instance and folds its vector / pause edge into the existing pipeline so
 * keyboard and gamepad behavior is unchanged.
 */

const JOYSTICK_RADIUS = 70;
const JOYSTICK_DEADZONE = 0.18;

export class TouchControls {
  private root: HTMLDivElement;
  private base: HTMLDivElement;
  private thumb: HTMLDivElement;
  private pauseBtn: HTMLButtonElement;

  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private dx = 0;
  private dy = 0;

  private pauseQueued = false;

  enabled = false;

  /** Fires once on the very first touch — used to unlock audio just like Input. */
  onFirstInput?: () => void;
  private firstInputFired = false;

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-ui';

    this.base = document.createElement('div');
    this.base.className = 'touch-joystick-base';
    this.thumb = document.createElement('div');
    this.thumb.className = 'touch-joystick-thumb';
    this.base.appendChild(this.thumb);
    this.root.appendChild(this.base);

    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'touch-pause';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.textContent = '\u23F8';
    this.pauseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.pauseQueued = true;
      this.markFirstInput();
    });
    this.root.appendChild(this.pauseBtn);

    uiRoot.appendChild(this.root);
    this.setEnabled(false);

    document.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);
  }

  setEnabled(b: boolean) {
    this.enabled = b;
    this.root.style.display = b ? '' : 'none';
    if (!b) this.releasePointer();
  }

  /** Joystick vector, length 0..1, dead-zone applied. */
  vector(): { x: number; y: number } {
    if (this.pointerId === null) return { x: 0, y: 0 };
    let nx = this.dx / JOYSTICK_RADIUS;
    let ny = this.dy / JOYSTICK_RADIUS;
    const len = Math.hypot(nx, ny);
    if (len < JOYSTICK_DEADZONE) return { x: 0, y: 0 };
    if (len > 1) { nx /= len; ny /= len; }
    return { x: nx, y: ny };
  }

  /** Rising-edge consume of an on-screen pause tap. */
  pauseJustPressed(): boolean {
    if (this.pauseQueued) {
      this.pauseQueued = false;
      return true;
    }
    return false;
  }

  private markFirstInput() {
    if (!this.firstInputFired) {
      this.firstInputFired = true;
      this.onFirstInput?.();
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (this.pointerId !== null) return;
    // Only touch / pen — mouse left-click on desktop shouldn't drag the joystick.
    if (e.pointerType === 'mouse' && !new URLSearchParams(window.location.search).has('touch')) return;
    // Don't claim taps on UI buttons or modal surfaces.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, .modal, .upgrade-card, .touch-pause, .landscape-gate')) return;
    // Joystick zone: bottom-left half of the screen.
    if (e.clientX > window.innerWidth / 2) return;

    this.pointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.dx = 0;
    this.dy = 0;
    this.base.style.left = `${this.originX}px`;
    this.base.style.top = `${this.originY}px`;
    this.thumb.style.transform = 'translate(-50%, -50%)';
    this.base.classList.add('active');
    this.markFirstInput();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > JOYSTICK_RADIUS) {
      dx = (dx / len) * JOYSTICK_RADIUS;
      dy = (dy / len) * JOYSTICK_RADIUS;
    }
    this.dx = dx;
    this.dy = dy;
    this.thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.releasePointer();
  };

  private releasePointer() {
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    this.base.classList.remove('active');
  }
}

/** True for actual touch hardware, or when ?touch=1 forces touch UI on desktop. */
export function isTouchDevice(): boolean {
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}
