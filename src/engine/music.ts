/**
 * Procedural music engine. Per-character themes synthesized in-browser via
 * Web Audio (no external audio files — keeps the bundle self-contained).
 *
 * Style: jaunty English folk in 6/8. Each character has a distinct jig that
 * fits the Pratchett tone — stately-but-deflated for the Knight, mischievous
 * for the Witch, driving for the Hunter. Tunes are original compositions
 * built from simple major/minor scales with the occasional flat-7 for that
 * folk-cheeky flavour.
 *
 * Instruments are faked from oscillator stacks:
 *   - fiddle:    sawtooth + slow tremolo (bowed-string buzz)
 *   - accordion: three slightly-detuned saws stacked (reedy chord pad)
 *   - whistle:   square wave high register, slight vibrato
 *   - bass:      sine with sharp pluck envelope (acoustic upright)
 *   - tuba:      sine + saw at low frequencies for "wuh-wuh" punctuation
 *
 * Drums (kick/snare/hat) are tuned for folk: kick→light bodhran thump,
 * snare→tambourine slap, hat→shaker.
 */

import type { CharacterId } from '../game/characters';

type Instrument = 'fiddle' | 'accordion' | 'whistle' | 'bass' | 'tuba';

interface NoteEvent {
  beat: number;        // beat offset (eighth-note in 6/8)
  freq: number;        // hertz
  duration: number;    // beats
  instrument: Instrument;
  volume: number;      // 0..1
}

interface DrumEvent {
  beat: number;
  kind: 'bodhran' | 'tambourine' | 'shaker';
  volume: number;
}

interface Theme {
  bpm: number;         // counted in eighth-notes (6/8 time = 6 per bar)
  loopBeats: number;   // total eighth-notes in the loop
  notes: NoteEvent[];
  drums: DrumEvent[];
}

// ---------- Note frequency table ----------
const NOTES: Record<string, number> = {
  'A1': 55, 'B1': 61.74, 'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98,
  'A2': 110, 'B2': 123.47, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196,
  'A3': 220, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392,
  'A4': 440, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
  'A5': 880, 'B5': 987.77, 'C6': 1046.50,
  'F#3': 185.00, 'F#4': 369.99, 'F#5': 739.99,
  'C#4': 277.18, 'C#5': 554.37,
  'G#4': 415.30,
  'D#4': 311.13, 'D#5': 622.25,
};
const n = (name: string) => NOTES[name] ?? 440;

/**
 * Helper to write 6/8 jig melodies cleanly. Each pair of beats represents
 * one "dotted-quarter" beat in 6/8 (i.e. 6 eighth-notes). Pass note names
 * grouped by triplet (3 notes per group).
 *
 *   jig(0, 'G', ['G','B','D','G','B','D'], 'fiddle', 0.13)
 *
 * places: G at beat 0, B at 0.333, D at 0.667, G at 1, B at 1.333, D at 1.667.
 *
 * Each note duration is 0.33 beats by default (equivalent to one eighth-note
 * in 6/8 played in a triplet feel).
 */
function tripletRun(
  startBeat: number,
  noteNames: string[],
  instrument: Instrument,
  volume: number,
  durEach = 0.32,
): NoteEvent[] {
  return noteNames.map((nm, i) => ({
    beat: startBeat + i * (1 / 3),
    freq: n(nm),
    duration: durEach,
    instrument,
    volume,
  }));
}

/** Sustained chord: 3 notes (root + third + fifth) on accordion, full bar. */
function chord(beat: number, notes: string[], duration: number, vol: number): NoteEvent[] {
  return notes.map((nm) => ({
    beat, freq: n(nm), duration, instrument: 'accordion', volume: vol,
  }));
}

/** Bouncing bass: root on the strong beat, fifth on the weak beat. Repeats. */
function bassLine(startBeat: number, root: string, fifth: string, bars = 1, vol = 0.18): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let b = 0; b < bars; b++) {
    const base = startBeat + b * 6;
    out.push({ beat: base,     freq: n(root),  duration: 0.45, instrument: 'bass', volume: vol });
    out.push({ beat: base + 2, freq: n(root),  duration: 0.45, instrument: 'bass', volume: vol });
    out.push({ beat: base + 4, freq: n(fifth), duration: 0.45, instrument: 'bass', volume: vol });
  }
  return out;
}

// ---------- SIR POMMELRY: small-town brass-band march-jig in G major (118 BPM) ----------
// Tuba carries the bassline (oom-pah-pah feel). Thick accordion sustains
// underneath. Fiddle plays a slow, restrained melody with lots of sustained
// notes and breathing room — like the village band hasn't quite rehearsed.
// Slower than before so the "dignified-but-deflated" reading lands.
const KNIGHT_THEME: Theme = {
  bpm: 220,
  loopBeats: 48,
  notes: [
    // ---- TUBA BASSLINE — the OOM in oom-pah-pah, on beat 1 of each bar ----
    { beat: 0,  freq: n('G2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 6,  freq: n('D2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 12, freq: n('E2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 18, freq: n('C2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 24, freq: n('G2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 30, freq: n('D2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 36, freq: n('C2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    { beat: 42, freq: n('G2'), duration: 1.4, instrument: 'tuba', volume: 0.18 },
    // tuba pickup on beat 4 of each bar (the second OOM)
    { beat: 3,  freq: n('D2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 9,  freq: n('A2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 15, freq: n('B2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 21, freq: n('G2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 27, freq: n('D2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 33, freq: n('A2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 39, freq: n('G2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    { beat: 45, freq: n('D2'), duration: 1.0, instrument: 'tuba', volume: 0.14 },
    // ---- ACCORDION — thick sustained chord pad through whole bar ----
    ...chord(0,  ['G3', 'B3', 'D4'], 5.5, 0.10),
    ...chord(6,  ['D3', 'F#3', 'A3'], 5.5, 0.10),
    ...chord(12, ['E3', 'G3', 'B3'], 5.5, 0.10),
    ...chord(18, ['C3', 'E3', 'G3'], 5.5, 0.10),
    ...chord(24, ['G3', 'B3', 'D4'], 5.5, 0.10),
    ...chord(30, ['D3', 'F#3', 'A3'], 5.5, 0.10),
    ...chord(36, ['C3', 'E3', 'G3'], 5.5, 0.10),
    ...chord(42, ['G3', 'B3', 'D4'], 5.5, 0.10),
    // ---- FIDDLE — slow, restrained melody. Long notes + breath. ----
    // Bar 1 (G): just root + third + fifth, sustained
    { beat: 0, freq: n('G4'), duration: 2.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 3, freq: n('D5'), duration: 2.5, instrument: 'fiddle', volume: 0.12 },
    // Bar 2 (D): a little walk
    { beat: 6, freq: n('F#5'), duration: 1.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 7.5, freq: n('A5'), duration: 1.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 9, freq: n('F#5'), duration: 3, instrument: 'fiddle', volume: 0.12 },
    // Bar 3 (Em): drop down
    { beat: 12, freq: n('E5'), duration: 2.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 15, freq: n('G5'), duration: 2.5, instrument: 'fiddle', volume: 0.12 },
    // Bar 4 (C): cadence
    { beat: 18, freq: n('E5'), duration: 1.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 19.5, freq: n('D5'), duration: 1.5, instrument: 'fiddle', volume: 0.12 },
    { beat: 21, freq: n('C5'), duration: 3, instrument: 'fiddle', volume: 0.12 },
    // Bar 5 (G): repeat with a bit of motion
    ...tripletRun(24, ['G4','B4','D5','G5'], 'fiddle', 0.12, 1.4),
    // Bar 6 (D): walk
    ...tripletRun(30, ['F#5','A5','F#5','D5'], 'fiddle', 0.12, 1.4),
    // Bar 7 (C): cadence approach
    ...tripletRun(36, ['G5','E5','C5','E5'], 'fiddle', 0.12, 1.4),
    // Bar 8 (G): resolve, hold
    { beat: 42, freq: n('D5'), duration: 2, instrument: 'fiddle', volume: 0.13 },
    { beat: 44, freq: n('B4'), duration: 2, instrument: 'fiddle', volume: 0.13 },
    { beat: 46, freq: n('G4'), duration: 2, instrument: 'fiddle', volume: 0.13 },
  ],
  drums: [
    // Stately march-jig: heavy bodhran on beat 1, soft on beat 4. No shakers
    // (those belong to Hunter). Tambourine on the "and" for lift.
    ...Array.from({ length: 8 }, (_, bar) => [
      { beat: bar * 6 + 0, kind: 'bodhran' as const, volume: 0.36 },
      { beat: bar * 6 + 3, kind: 'bodhran' as const, volume: 0.20 },
      { beat: bar * 6 + 1.5, kind: 'tambourine' as const, volume: 0.10 },
      { beat: bar * 6 + 4.5, kind: 'tambourine' as const, volume: 0.10 },
    ]).flat(),
  ],
};

// ---------- MISTRESS QUILL: mischievous jig in A minor (124 BPM) ----------
// Chord prog: Am | E | F | C | Am | E | Dm | Am — chromatic flourish on E (G# leading tone)
const SORC_THEME: Theme = {
  bpm: 232,
  loopBeats: 48,
  notes: [
    // Bass — slightly skipping pattern
    ...bassLine(0,  'A2', 'E3'),
    ...bassLine(6,  'E2', 'B2'),
    ...bassLine(12, 'F2', 'C3'),
    ...bassLine(18, 'C2', 'G2'),
    ...bassLine(24, 'A2', 'E3'),
    ...bassLine(30, 'E2', 'B2'),
    ...bassLine(36, 'D2', 'A2'),
    ...bassLine(42, 'A2', 'E3'),
    // Accordion stabs
    ...chord(0,  ['A3', 'C4', 'E4'], 0.8, 0.07),
    ...chord(6,  ['E3', 'G#4', 'B3'], 0.8, 0.07),     // major V (with G# leading)
    ...chord(12, ['F3', 'A3', 'C4'], 0.8, 0.07),
    ...chord(18, ['C3', 'E3', 'G3'], 0.8, 0.07),
    ...chord(24, ['A3', 'C4', 'E4'], 0.8, 0.07),
    ...chord(30, ['E3', 'G#4', 'B3'], 0.8, 0.07),
    ...chord(36, ['D3', 'F3', 'A3'], 0.8, 0.07),
    ...chord(42, ['A3', 'C4', 'E4'], 0.8, 0.07),
    ...chord(3,  ['A3', 'E4'], 0.6, 0.05),
    ...chord(9,  ['E3', 'B3'], 0.6, 0.05),
    ...chord(15, ['F3', 'C4'], 0.6, 0.05),
    ...chord(21, ['C3', 'G3'], 0.6, 0.05),
    ...chord(27, ['A3', 'E4'], 0.6, 0.05),
    ...chord(33, ['E3', 'B3'], 0.6, 0.05),
    ...chord(39, ['D3', 'A3'], 0.6, 0.05),
    ...chord(45, ['A3', 'E4'], 0.6, 0.05),
    // ---- Tin whistle melody — winding line over the chords ----
    // Bar 1 (Am)
    ...tripletRun(0, ['A4','C5','E5','A5','E5','C5'], 'whistle', 0.10),
    // Bar 2 (E with G# chromatic) — mischievous twist
    ...tripletRun(6, ['B4','G#4','E4','G#4','B4','E5'], 'whistle', 0.10),
    // Bar 3 (F)
    ...tripletRun(12, ['C5','F5','A5','F5','C5','A4'], 'whistle', 0.10),
    // Bar 4 (C)
    ...tripletRun(18, ['G4','E5','C5','E5','G4','C5'], 'whistle', 0.10),
    // Bar 5 (Am) — variation
    ...tripletRun(24, ['E5','A5','C5','A4','C5','E5'], 'whistle', 0.10),
    // Bar 6 (E with chromatic again)
    ...tripletRun(30, ['G#4','B4','E5','B4','G#4','E4'], 'whistle', 0.10),
    // Bar 7 (Dm) — descending
    ...tripletRun(36, ['F5','D5','A4','F4','A4','D5'], 'whistle', 0.10),
    // Bar 8 (Am) — resolve
    ...tripletRun(42, ['C5','E5','A5','E5','C5','A4'], 'whistle', 0.11),
    // Tiny fiddle countermelody underneath, sparse
    ...tripletRun(2, ['E4','C4','A3'], 'fiddle', 0.06, 0.4),
    ...tripletRun(14, ['A4','F4','C4'], 'fiddle', 0.06, 0.4),
    ...tripletRun(26, ['E4','A4','C5'], 'fiddle', 0.06, 0.4),
    ...tripletRun(38, ['F4','D4','A3'], 'fiddle', 0.06, 0.4),
  ],
  drums: [
    ...Array.from({ length: 8 }, (_, bar) => [
      { beat: bar * 6 + 0, kind: 'bodhran' as const, volume: 0.26 },
      { beat: bar * 6 + 3, kind: 'bodhran' as const, volume: 0.16 },
      { beat: bar * 6 + 1.5, kind: 'tambourine' as const, volume: 0.11 },
      { beat: bar * 6 + 4.5, kind: 'tambourine' as const, volume: 0.11 },
      { beat: bar * 6 + 2, kind: 'shaker' as const, volume: 0.06 },
      { beat: bar * 6 + 5, kind: 'shaker' as const, volume: 0.06 },
    ]).flat(),
  ],
};

// ---------- MARGATE TOSSWORTHY: lean fiddle reel in D major (148 BPM) ----------
// Completely different feel from the Knight: STRAIGHT 4/4 reel, not 6/8 jig.
// Constant running 8th notes on the fiddle. NO accordion (would muddy the
// chase feel), NO tuba (that's the Knight's instrument). Just fiddle, plucked
// triangle bass, and a relentless shaker on every eighth-note. Lean and fast.
// Chord prog over 8 bars (32 quarter-notes / 64 eighth-notes):
//   D | D | A | A | Bm | G | A | D
const HUNTER_THEME: Theme = {
  bpm: 296,                  // eighth-notes per minute
  loopBeats: 64,             // 8 bars of 4/4 = 32 quarter-notes = 64 eighth-notes
  notes: [
    // ---- BASS — bouncing root + fifth, two notes per beat (every 4 eighths)
    ...Array.from({ length: 8 }, (_, bar) => {
      const roots = ['D', 'D', 'A', 'A', 'B', 'G', 'A', 'D'];
      const fifths = ['A', 'A', 'E', 'E', 'F#', 'D', 'E', 'A'];
      const r = roots[bar];
      const f = fifths[bar];
      return [
        { beat: bar * 8 + 0, freq: n(r + '2'), duration: 0.45, instrument: 'bass' as Instrument, volume: 0.18 },
        { beat: bar * 8 + 2, freq: n(f + '2'), duration: 0.45, instrument: 'bass' as Instrument, volume: 0.16 },
        { beat: bar * 8 + 4, freq: n(r + '2'), duration: 0.45, instrument: 'bass' as Instrument, volume: 0.18 },
        { beat: bar * 8 + 6, freq: n(f + '2'), duration: 0.45, instrument: 'bass' as Instrument, volume: 0.16 },
      ];
    }).flat(),

    // ---- FIDDLE — running 8ths, the heart of a reel ----
    // Pattern per bar: 8 eighth-notes outlining the chord with passing tones.
    // Bar 1 (D): D F# A D F# D A F#
    ...['D5','F#5','A5','D5','F#5','D5','A5','F#5'].map((nm, i) => ({
      beat: i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 2 (D): variation — D F# A D A F# A D5
    ...['D5','F#5','A5','D6','A5','F#5','A5','D5'].map((nm, i) => ({
      beat: 8 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 3 (A): E A C# E A E C# A
    ...['E5','A5','C#5','E5','A5','E5','C#5','A4'].map((nm, i) => ({
      beat: 16 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 4 (A): higher — C# E A C# A E C# A
    ...['C#5','E5','A5','C#5','A5','E5','C#5','A4'].map((nm, i) => ({
      beat: 24 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 5 (Bm): B D F# B F# D B F#
    ...['B4','D5','F#5','B5','F#5','D5','B4','F#4'].map((nm, i) => ({
      beat: 32 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 6 (G): G B D G D B G D
    ...['G4','B4','D5','G5','D5','B4','G4','D4'].map((nm, i) => ({
      beat: 40 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 7 (A): A C# E A C# E G A
    ...['A4','C#5','E5','A5','C#5','E5','G5','A5'].map((nm, i) => ({
      beat: 48 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.13,
    })),
    // Bar 8 (D): resolution — D F# A D A F# D5 D4
    ...['D5','F#5','A5','D6','A5','F#5','D5','D4'].map((nm, i) => ({
      beat: 56 + i, freq: n(nm), duration: 0.45, instrument: 'fiddle' as Instrument, volume: 0.14,
    })),
  ],
  drums: [
    // 4/4 rhythm: bodhran on every beat (kick on 1+3, lighter on 2+4),
    // shaker on every 8th-note (the relentless chase pulse).
    ...Array.from({ length: 8 }, (_, bar) => [
      { beat: bar * 8 + 0, kind: 'bodhran' as const, volume: 0.36 },
      { beat: bar * 8 + 2, kind: 'bodhran' as const, volume: 0.20 },
      { beat: bar * 8 + 4, kind: 'bodhran' as const, volume: 0.32 },
      { beat: bar * 8 + 6, kind: 'bodhran' as const, volume: 0.20 },
      // shaker on every 8th
      ...Array.from({ length: 8 }, (_, i) => ({
        beat: bar * 8 + i, kind: 'shaker' as const, volume: 0.10,
      })),
    ]).flat(),
  ],
};

const THEMES: Record<CharacterId, Theme> = {
  knight: KNIGHT_THEME,
  sorceress: SORC_THEME,
  hunter: HUNTER_THEME,
};

// =============================================================================

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private currentTheme: Theme | null = null;
  private nextScheduleAt = 0;
  private rafId: number | null = null;
  private volume = 0.45;
  private playing = false;

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // Soft low-pass + slight high-pass to give an "acoustic recording" warmth
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    this.master.connect(hp);
    hp.connect(lp);
    lp.connect(this.ctx.destination);
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  play(character: CharacterId) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.currentTheme = THEMES[character];
    if (this.playing) return;
    this.playing = true;
    this.nextScheduleAt = ctx.currentTime + 0.05;
    this.tick();
  }

  stop() {
    this.playing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private tick = () => {
    if (!this.playing || !this.ctx || !this.currentTheme || !this.master) return;
    const lookahead = 0.25;
    while (this.nextScheduleAt < this.ctx.currentTime + lookahead) {
      this.scheduleBar(this.nextScheduleAt);
      this.nextScheduleAt += (60 / this.currentTheme.bpm) * this.currentTheme.loopBeats;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private scheduleBar(startTime: number) {
    if (!this.ctx || !this.currentTheme || !this.master) return;
    const beatLen = 60 / this.currentTheme.bpm;
    for (const note of this.currentTheme.notes) {
      this.scheduleInstrument(startTime + note.beat * beatLen, note, beatLen);
    }
    for (const drum of this.currentTheme.drums) {
      this.scheduleDrum(startTime + drum.beat * beatLen, drum);
    }
  }

  private scheduleInstrument(when: number, note: NoteEvent, beatLen: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const dur = note.duration * beatLen;

    switch (note.instrument) {
      case 'fiddle': {
        // Sawtooth body + slow tremolo (4Hz) for bowed-string feel.
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note.freq;
        const gain = ctx.createGain();
        const peak = note.volume;
        const attack = 0.025;
        const release = Math.min(0.15, dur * 0.4);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(peak, when + attack);
        // tremolo: gentle amplitude wobble
        const tremOsc = ctx.createOscillator();
        tremOsc.frequency.value = 5;
        const tremGain = ctx.createGain();
        tremGain.gain.value = peak * 0.12;
        tremOsc.connect(tremGain);
        tremGain.connect(gain.gain);
        tremOsc.start(when);
        tremOsc.stop(when + dur + 0.1);
        // body filter — rolls off harshness
        const bp = ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.value = 2200;
        bp.Q.value = 0.7;
        gain.gain.setValueAtTime(peak, when + dur - release);
        gain.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(bp); bp.connect(gain); gain.connect(this.master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
        break;
      }
      case 'accordion': {
        // Three slightly detuned saws stacked — that reedy chord pad sound.
        const detunes = [-7, 0, 7];
        const gain = ctx.createGain();
        const peak = note.volume;
        const attack = 0.04;
        const release = Math.min(0.18, dur * 0.4);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(peak, when + attack);
        gain.gain.setValueAtTime(peak, when + dur - release);
        gain.gain.linearRampToValueAtTime(0, when + dur);
        const bp = ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.value = 3000;
        bp.Q.value = 0.6;
        for (const detune of detunes) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = note.freq;
          osc.detune.value = detune;
          osc.connect(bp);
          osc.start(when);
          osc.stop(when + dur + 0.05);
        }
        bp.connect(gain); gain.connect(this.master);
        break;
      }
      case 'whistle': {
        // Square wave with slight vibrato (6Hz) — bright, breathy
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = note.freq;
        const vib = ctx.createOscillator();
        vib.frequency.value = 6;
        const vibGain = ctx.createGain();
        vibGain.gain.value = note.freq * 0.012;
        vib.connect(vibGain);
        vibGain.connect(osc.frequency);
        vib.start(when);
        vib.stop(when + dur + 0.1);
        const gain = ctx.createGain();
        const peak = note.volume;
        const attack = 0.015;
        const release = Math.min(0.1, dur * 0.4);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(peak, when + attack);
        gain.gain.setValueAtTime(peak, when + dur - release);
        gain.gain.linearRampToValueAtTime(0, when + dur);
        // soften the square wave
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2800;
        osc.connect(lp); lp.connect(gain); gain.connect(this.master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
        break;
      }
      case 'bass': {
        // Sine with a sharp pluck envelope — acoustic upright feel.
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note.freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(note.volume, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
        osc.connect(gain); gain.connect(this.master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
        break;
      }
      case 'tuba': {
        // Sine + saw stacked at low freq — comic "wuh-wuh" honk.
        const sine = ctx.createOscillator();
        sine.type = 'sine';
        sine.frequency.value = note.freq;
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth';
        saw.frequency.value = note.freq;
        saw.detune.value = -3;
        const gain = ctx.createGain();
        const peak = note.volume;
        const attack = 0.05;
        const release = Math.min(0.18, dur * 0.4);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(peak, when + attack);
        gain.gain.setValueAtTime(peak, when + dur - release);
        gain.gain.linearRampToValueAtTime(0, when + dur);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        sine.connect(lp); saw.connect(lp); lp.connect(gain); gain.connect(this.master);
        sine.start(when); saw.start(when);
        sine.stop(when + dur + 0.05); saw.stop(when + dur + 0.05);
        break;
      }
    }
  }

  private scheduleDrum(when: number, drum: DrumEvent) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (drum.kind === 'bodhran') {
      // Low woody thump — sine that drops fast + a tiny click
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, when);
      osc.frequency.exponentialRampToValueAtTime(45, when + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(drum.volume, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
      osc.connect(gain); gain.connect(this.master);
      osc.start(when); osc.stop(when + 0.18);
      // click for the stick attack
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const clickGain = ctx.createGain();
      clickGain.gain.value = drum.volume * 0.4;
      src.connect(clickGain); clickGain.connect(this.master);
      src.start(when);
    } else if (drum.kind === 'tambourine') {
      // Short metallic shimmer — high-passed noise + a couple of jingle tones
      const bufSize = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufSize * 6);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 5000;
      const gain = ctx.createGain();
      gain.gain.value = drum.volume;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start(when);
    } else {
      // shaker — softer, lower-pitched short noise
      const bufSize = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufSize * 8);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 6000;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = drum.volume;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start(when);
    }
  }
}
