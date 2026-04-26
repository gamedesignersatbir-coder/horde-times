import { Howl, Howler } from 'howler';

/**
 * Simple synthesized sound effects: rather than depending on external audio files,
 * we generate small WAV blobs in-memory. This keeps the game self-contained and
 * lets us tune SFX in code.
 */
function tone(opts: {
  freq: number;
  duration: number;
  type?: 'sine' | 'square' | 'saw' | 'triangle' | 'noise';
  attack?: number;
  decay?: number;
  freqEnd?: number;
  volume?: number;
}): string {
  const sr = 22050;
  const n = Math.floor(opts.duration * sr);
  const data = new Float32Array(n);
  const type = opts.type ?? 'sine';
  const attack = opts.attack ?? 0.005;
  const decay = opts.decay ?? opts.duration;
  const freqEnd = opts.freqEnd ?? opts.freq;
  const volume = opts.volume ?? 0.5;

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const freq = opts.freq + (freqEnd - opts.freq) * (t / opts.duration);
    phase += (2 * Math.PI * freq) / sr;
    let s = 0;
    switch (type) {
      case 'sine': s = Math.sin(phase); break;
      case 'square': s = Math.sin(phase) > 0 ? 1 : -1; break;
      case 'saw': s = ((phase / (2 * Math.PI)) % 1) * 2 - 1; break;
      case 'triangle': s = Math.asin(Math.sin(phase)) * (2 / Math.PI); break;
      case 'noise': s = Math.random() * 2 - 1; break;
    }
    // ADSR-ish envelope: linear attack, exponential decay
    const env =
      t < attack ? t / attack :
      Math.exp(-(t - attack) / decay);
    data[i] = s * env * volume;
  }
  return encodeWav(data, sr);
}

function encodeWav(samples: Float32Array, sampleRate: number): string {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, n * 2, true);
  // 16-bit PCM
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  // base64
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

function writeStr(view: DataView, off: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
}

export class Audio {
  private sounds: Record<string, Howl> = {};
  private musicVolume = 0.25;
  private sfxVolume = 0.55;
  private muted = false;

  constructor() {
    this.register('hit', tone({ freq: 220, freqEnd: 80, duration: 0.08, type: 'square', decay: 0.05, volume: 0.5 }));
    this.register('enemyDeath', tone({ freq: 180, freqEnd: 60, duration: 0.18, type: 'triangle', decay: 0.1, volume: 0.45 }));
    this.register('playerHurt', tone({ freq: 140, freqEnd: 60, duration: 0.22, type: 'sawtooth' as any, decay: 0.16, volume: 0.55 }));
    this.register('xpPickup', tone({ freq: 880, freqEnd: 1320, duration: 0.06, type: 'sine', decay: 0.05, volume: 0.35 }));
    this.register('levelUp', tone({ freq: 440, freqEnd: 880, duration: 0.6, type: 'sine', attack: 0.01, decay: 0.4, volume: 0.55 }));
    this.register('shockwave', tone({ freq: 90, freqEnd: 30, duration: 0.35, type: 'sine', decay: 0.25, volume: 0.6 }));
    this.register('shoot', tone({ freq: 520, freqEnd: 320, duration: 0.05, type: 'square', decay: 0.04, volume: 0.25 }));
    this.register('blade', tone({ freq: 320, freqEnd: 220, duration: 0.05, type: 'triangle', decay: 0.04, volume: 0.18 }));
    this.register('boss', tone({ freq: 60, freqEnd: 30, duration: 1.4, type: 'sawtooth' as any, decay: 0.9, volume: 0.7 }));
    this.register('victory', tone({ freq: 523, freqEnd: 1046, duration: 1.5, type: 'sine', decay: 1.0, volume: 0.6 }));
    this.register('gameOver', tone({ freq: 220, freqEnd: 55, duration: 1.4, type: 'triangle', decay: 1.0, volume: 0.55 }));
  }

  private register(key: string, src: string) {
    this.sounds[key] = new Howl({ src: [src], volume: this.sfxVolume });
  }

  play(key: string, volScale = 1) {
    if (this.muted) return;
    const s = this.sounds[key];
    if (!s) return;
    s.volume(this.sfxVolume * volScale);
    s.play();
  }

  setSfxVolume(v: number) { this.sfxVolume = v; }
  setMusicVolume(v: number) { this.musicVolume = v; }
  setMuted(m: boolean) { this.muted = m; }

  /**
   * Resume the suspended Web Audio context. Browsers require a user gesture
   * before audio plays — gamepad input doesn't count as one in some browsers,
   * so we explicitly resume here on the first detected input of any kind.
   */
  unlock() {
    const ctx = (Howler as any).ctx as AudioContext | undefined;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
}
