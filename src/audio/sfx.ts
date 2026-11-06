// Sound effects, synthesized with Web Audio: no sound files to download, and
// the single-file build gets them too. Each sound is a few oscillators and
// filtered noise bursts with short envelopes.

import { audioContext } from './context';
import { enhancedRecipe, LEVEL, VARY } from './sfx-enhanced';
import { REAL_LEVEL, realisticRecipe } from './sfx-realistic';

export type Sound =
  | 'click'
  | 'belt'
  | 'place'
  | 'place_big'
  | 'demolish'
  | 'chop'
  | 'pick'
  | 'pick_done'
  | 'error'
  | 'shot'
  | 'gun'
  | 'hub_shot'
  | 'cannon'
  | 'mortar'
  | 'artillery'
  | 'zap'
  | 'rail'
  | 'twang'
  | 'treb'
  | 'death'
  | 'destroyed'
  | 'hub_hit'
  | 'breach'
  | 'research'
  | 'stage'
  | 'provoked'
  | 'launch'
  | 'ping'
  | 'bird'
  | 'cricket'
  | 'katydid'
  | 'cicada'
  | 'frog';

/** The shortest gap (seconds) between two plays of a sound, so a busy fight doesn't turn into noise. */
const MIN_GAP: Partial<Record<Sound, number>> = {
  click: 0.03,
  belt: 0.05,
  place: 0.05,
  chop: 0.15,
  pick: 0.05,
  shot: 0.07,
  gun: 0.06,
  hub_shot: 0.1,
  cannon: 0.12,
  mortar: 0.15,
  artillery: 0.2,
  zap: 0.1,
  rail: 0.15,
  twang: 0.1,
  treb: 0.2,
  death: 0.06,
  destroyed: 0.15,
  hub_hit: 0.6,
  provoked: 1,
  bird: 0.4,
  cricket: 0.3,
  katydid: 0.8,
  cicada: 3,
  frog: 0.5,
};
/** A sound's version (#214): as first made, the enhanced retro rework, or the realistic one. */
export type Variant = 'classic' | 'enhanced' | 'realistic';
/** One version for every sound (the sound board), or each sound as the owner picked it (`game`). */
export type SfxStyle = Variant | 'game';

/**
 * The version of each sound the game plays: the owner's picks from the sound board (#214). Sounds not
 * listed play as first made.
 */
export const GAME_SOUNDS: Partial<Record<Sound, Variant>> = {
  belt: 'enhanced',
  place: 'enhanced',
  place_big: 'enhanced',
  demolish: 'enhanced',
  error: 'enhanced',
  chop: 'enhanced',
  pick: 'enhanced',
  pick_done: 'enhanced',
  ping: 'enhanced',
  provoked: 'enhanced',
  breach: 'enhanced',
  research: 'enhanced',
  // Round 2: realistic guns and hits, and the ballista's enhanced twang.
  gun: 'realistic',
  hub_shot: 'realistic',
  twang: 'enhanced',
  treb: 'realistic',
  cannon: 'realistic',
  mortar: 'realistic',
  artillery: 'realistic',
  death: 'realistic',
  destroyed: 'realistic',
};
/** The machine hum the game plays (round 2). */
export const GAME_HUM: 'classic' | 'enhanced' = 'enhanced';

/** At most this many sounds at once. */
const MAX_VOICES = 24;
/** The machine hum at its loudest (a busy factory filling the screen). */
const HUM_PEAK = 0.1;

export interface PlayOptions {
  /** 0–1, e.g. quieter when far from the middle of the screen. */
  gain?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** The sound board only: play these layers instead of the sound's recipe (a candidate being tried). */
  layers?: Layer[];
}

/** One envelope-shaped layer of a sound. */
export interface Layer {
  kind: OscillatorType | 'noise';
  /** Oscillators: a narrow pulse in place of the plain wave, 25% or 12.5% duty (the chip sound of old consoles). */
  pulse?: 0.25 | 0.125;
  /** Oscillators: a second voice this many cents sharp, for body. */
  detune?: number;
  /** Noise: coarse noise (each value held for a few samples), grittier and more retro. */
  grit?: boolean;
  from: number; // Hz: oscillator pitch, or the noise filter's cutoff
  to: number;
  dur: number;
  peak: number;
  at?: number; // delay in seconds
  attack?: number;
  filter?: BiquadFilterType; // noise only (default bandpass)
  q?: number;
}

export const tone = (kind: OscillatorType, from: number, to: number, dur: number, peak: number, at = 0, attack?: number): Layer => ({
  kind,
  from,
  to,
  dur,
  peak,
  at,
  attack,
});
export const noise = (filter: BiquadFilterType, from: number, to: number, dur: number, peak: number, q = 0.8, at = 0, attack?: number): Layer => ({
  kind: 'noise',
  filter,
  from,
  to,
  dur,
  peak,
  q,
  at,
  attack,
});

export function recipe(sound: Sound): Layer[] {
  switch (sound) {
    case 'click':
      return [tone('triangle', 1400, 1000, 0.04, 0.22)];
    case 'belt':
      return [tone('square', 520, 380, 0.04, 0.06), noise('highpass', 3000, 3000, 0.03, 0.08)];
    case 'place':
      return [tone('sine', 180, 70, 0.18, 0.6), noise('bandpass', 1800, 900, 0.06, 0.25, 1), tone('triangle', 620, 620, 0.08, 0.1, 0.05)];
    case 'place_big':
      return [tone('sine', 120, 45, 0.32, 0.7), noise('lowpass', 900, 200, 0.14, 0.35), tone('triangle', 540, 540, 0.1, 0.1, 0.08), tone('triangle', 720, 720, 0.1, 0.08, 0.16)];
    case 'demolish':
      return [noise('bandpass', 1200, 200, 0.25, 0.4, 1.2), tone('sawtooth', 300, 80, 0.2, 0.12)];
    case 'chop':
      // A thunk into wood, then the creak of the tree going over.
      return [tone('triangle', 240, 140, 0.07, 0.35), noise('bandpass', 1100, 700, 0.05, 0.3, 2), noise('lowpass', 700, 180, 0.35, 0.2, 0.8, 0.12)];
    case 'pick':
      // A pickaxe on rock: a hard, bright clink.
      return [tone('triangle', 2100, 1700, 0.06, 0.22), noise('highpass', 3500, 2500, 0.04, 0.25, 1), tone('sine', 260, 160, 0.05, 0.2)];
    case 'pick_done':
      // The ore comes loose: a crumble and a little rising chime.
      return [noise('lowpass', 1200, 300, 0.18, 0.35), tone('triangle', 660, 660, 0.08, 0.14, 0.05), tone('triangle', 990, 990, 0.12, 0.14, 0.11)];
    case 'error':
      return [tone('square', 180, 180, 0.09, 0.16), tone('square', 140, 140, 0.13, 0.16, 0.11)];
    case 'shot':
    case 'gun':
      return [noise('highpass', 2500, 1500, 0.06, 0.2), tone('square', 900, 300, 0.05, 0.05)];
    case 'hub_shot':
      return [tone('sawtooth', 1100, 250, 0.1, 0.12), noise('highpass', 1800, 1800, 0.05, 0.18)];
    case 'cannon':
    case 'mortar':
    case 'artillery':
      return [tone('sine', 110, 38, 0.35, 0.7), noise('lowpass', 1400, 150, 0.32, 0.45)];
    case 'twang':
    case 'treb':
      // A bowstring: a plucked, falling tone and the thud of the bolt leaving.
      return [tone('triangle', 330, 180, 0.18, 0.3), tone('sine', 165, 120, 0.2, 0.2), noise('lowpass', 900, 300, 0.06, 0.25)];
    case 'zap':
    case 'rail':
      // A crackle of high noise over a falling buzz.
      return [noise('highpass', 4000, 2500, 0.12, 0.3, 1.5), tone('sawtooth', 1400, 300, 0.1, 0.1), noise('bandpass', 2500, 900, 0.08, 0.2, 4, 0.03)];
    case 'death':
      return [noise('bandpass', 1600, 350, 0.14, 0.5, 3), tone('sine', 500, 160, 0.08, 0.18)];
    case 'destroyed':
      return [noise('lowpass', 2200, 150, 0.45, 0.65), tone('sine', 90, 35, 0.4, 0.65), noise('bandpass', 3000, 1500, 0.2, 0.25, 2, 0.05)];
    case 'hub_hit':
      return [tone('triangle', 330, 320, 0.28, 0.22), tone('sine', 812, 800, 0.22, 0.1), noise('bandpass', 2000, 1200, 0.05, 0.15)];
    case 'breach':
      return [tone('sine', 80, 30, 1.2, 0.6), noise('lowpass', 2500, 100, 1, 0.45), tone('square', 660, 440, 0.3, 0.1, 0.15), tone('square', 660, 440, 0.3, 0.1, 0.5)];
    case 'research':
      return [523, 659, 784, 1047].flatMap((f, i) => [tone('triangle', f, f, 0.35, 0.2, i * 0.09), tone('sine', f / 2, f / 2, 0.3, 0.08, i * 0.09)]);
    case 'stage':
      return [tone('triangle', 587, 587, 0.3, 0.22), tone('triangle', 880, 880, 0.5, 0.22, 0.14), tone('sine', 440, 440, 0.6, 0.1, 0.14)];
    case 'provoked': {
      // Angry chittering over a low drone.
      const chirps = [0, 1, 2, 3, 4, 5].map((i) => tone('sawtooth', 380 + ((i * 53) % 140), 260, 0.07, 0.18, i * 0.07, 0.003));
      return [...chirps, tone('sawtooth', 70, 95, 0.6, 0.2, 0, 0.1)];
    }
    case 'launch':
      return [noise('lowpass', 150, 1800, 3.5, 1, 0.8, 0, 2), tone('sawtooth', 45, 180, 3.5, 0.3, 0, 2)];
    case 'ping':
      // Two bright blips, rising: someone points at something.
      return [tone('sine', 1320, 1320, 0.12, 0.22), tone('sine', 1760, 1760, 0.18, 0.22, 0.1), tone('triangle', 880, 880, 0.25, 0.06, 0.1)];
    // Critters (D-101): each call a little different, so the chorus doesn't loop.
    case 'bird':
      return birdCall();
    case 'cricket': {
      // Three or four short pulses of one high note.
      const f = 4300 + Math.random() * 500;
      const n = 3 + Math.floor(Math.random() * 2);
      return Array.from({ length: n }, (_, i) => tone('sine', f, f, 0.03, 0.06, i * 0.05, 0.005));
    }
    case 'katydid': {
      // Ka-ty-did: three rasps.
      const f = 5500 + Math.random() * 1500;
      return [0, 0.12, 0.24].map((at, i) => noise('bandpass', f, f * 0.9, i === 2 ? 0.07 : 0.05, 0.12, 6, at, 0.005));
    }
    case 'cicada': {
      // A long buzz that swells and dies away, with a fast throb in it.
      const f = 4500 + Math.random() * 1500;
      const pulses = Array.from({ length: 14 }, (_, i) => noise('bandpass', f, f * 0.95, 0.12, 0.05 + 0.04 * Math.sin((i / 13) * Math.PI), 8, i * 0.11, 0.03));
      return pulses;
    }
    case 'frog': {
      // A low, rattling croak, sometimes two.
      const f = 140 + Math.random() * 80;
      const n = Math.random() < 0.4 ? 2 : 1;
      return Array.from({ length: n }, (_, i) => [tone('sawtooth', f, f * 0.85, 0.22, 0.07, i * 0.35, 0.02), noise('bandpass', f * 4, f * 3, 0.2, 0.06, 3, i * 0.35, 0.02)]).flat();
    }
  }
}

/**
 * A songbird's call (#159), one of four kinds picked at random, each varied: a fast trill, a two-note
 * "fee-bee" whistle, a sparrow's chips and buzz, or a robin's warble. Real bird notes are quick slides, so
 * each note is a slide, with a quiet second harmonic so it sounds whistled rather than electronic.
 */
export function birdCall(): Layer[] {
  const r = Math.random;
  const pitch = 0.85 + r() * 0.3; // this bird's voice
  // One whistled note sliding from `from` to `to` Hz, with its harmonic an octave up.
  const note = (from: number, to: number, dur: number, at: number, peak = 0.1): Layer[] => [
    tone('sine', from * pitch, to * pitch, dur, peak, at, Math.min(0.012, dur / 4)),
    tone('sine', from * pitch * 2, to * pitch * 2, dur, peak * 0.14, at, Math.min(0.012, dur / 4)),
  ];
  switch (Math.floor(r() * 4)) {
    case 0: {
      // A trill: a run of very short notes, falling a little as it goes.
      const n = 8 + Math.floor(r() * 7);
      const rate = 16 + r() * 8;
      return Array.from({ length: n }, (_, i) => note(4200 - i * 60, 3600 - i * 60, 0.03, i / rate, 0.08)).flat();
    }
    case 1: {
      // "Fee-bee": a held high note, then a lower one, sometimes twice.
      const twice = r() < 0.4 ? 2 : 1;
      return Array.from({ length: twice }, (_, k) => [...note(3900, 3850, 0.24, k * 0.75, 0.1), ...note(3250, 3150, 0.3, k * 0.75 + 0.3, 0.09)]).flat();
    }
    case 2: {
      // Sparrow: a few chips sliding down, then a short buzzy trill.
      const chips = 3 + Math.floor(r() * 3);
      const layers = Array.from({ length: chips }, (_, i) => note(5200, 3000, 0.045, i * 0.13, 0.09)).flat();
      const end = chips * 0.13 + 0.05;
      for (let i = 0; i < 10; i++) layers.push(noise('bandpass', 4600 * pitch, 4400 * pitch, 0.025, 0.05, 12, end + i * 0.035, 0.004));
      return layers;
    }
    default: {
      // Warble: notes rising and falling in turn, like a robin's phrases.
      const n = 5 + Math.floor(r() * 4);
      let at = 0;
      const layers: Layer[] = [];
      for (let i = 0; i < n; i++) {
        const f = 2500 + r() * 1300;
        const d = 0.08 + r() * 0.06;
        layers.push(...note(f, f * 1.18, d / 2, at, 0.09), ...note(f * 1.18, f * 0.92, d / 2, at + d / 2, 0.09));
        at += d + 0.04 + r() * 0.06;
      }
      return layers;
    }
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private volume: number;
  private started = false;
  private last = new Map<Sound, number>();
  private voices = 0;
  /** The machine-running loop, once started. */
  private hum: GainNode | null = null;
  /** The hum's current level, 0–1 (for tests and debugging). */
  humLevel = 0;
  /** The most recent sounds played (for tests and debugging). */
  readonly log: Sound[] = [];

  /** Classic (today's) or enhanced recipes (#214); the sound board compares them. */
  readonly style: SfxStyle;
  private gritBuf: AudioBuffer | null = null;
  /** Where reworked sounds also go, for the room's echo (null in the classic style). */
  private roomIn: GainNode | null = null;
  private pulses = new Map<number, PeriodicWave>();

  constructor(volume: number, style: SfxStyle = 'game') {
    this.volume = volume;
    this.style = style;
    // Sound can only start after the first click or tap (or key press).
    const unlock = () => {
      this.started = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  /** 0–1. Zero mutes. */
  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    if (this.roomIn && this.ctx) this.roomIn.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  play(sound: Sound, opts: PlayOptions = {}): void {
    const gain = opts.gain ?? 1;
    if (!this.started || this.volume <= 0 || gain <= 0.01 || document.visibilityState === 'hidden') return;
    if (!this.setup()) return;
    const ctx = this.ctx!;
    if (ctx.state !== 'running') void ctx.resume();
    const now = ctx.currentTime;
    // Gaps are timed on the page clock: the audio clock stands still while the context is starting up,
    // which made every sound after the first look like a repeat and get dropped.
    const wall = performance.now() / 1000;
    if (wall - (this.last.get(sound) ?? -Infinity) < (MIN_GAP[sound] ?? 0)) return;
    if (this.voices >= MAX_VOICES) return;
    this.last.set(sound, wall);
    this.log.push(sound);
    if (this.log.length > 50) this.log.shift();

    // A candidate from the sound board plays as a reworked sound, at the level the board gives it.
    const variant = opts.layers ? 'realistic' : this.variant(sound);
    const out = ctx.createGain();
    const level = opts.layers ? 1 : variant === 'enhanced' ? (LEVEL[sound] ?? 1) : variant === 'realistic' ? (REAL_LEVEL[sound] ?? 1) : 1;
    out.gain.value = gain * level;
    let node: AudioNode = out;
    if (opts.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(panner);
      node = panner;
    }
    node.connect(this.master!);
    if (variant !== 'classic' && this.roomIn) node.connect(this.roomIn);

    let end = 0;
    const layers = opts.layers ?? (variant === 'realistic' ? realisticRecipe(sound)! : variant === 'enhanced' ? enhancedRecipe(sound) : recipe(sound));
    // Reworked: a repeated sound varies a little in pitch each time, so a fight isn't one sample on a loop.
    const v = variant !== 'classic' ? (VARY[sound] ?? 0) : 0;
    const pitch = v ? 1 + (Math.random() * 2 - 1) * v : 1;
    for (const layer of layers) end = Math.max(end, this.layer(layer, out, now, pitch));
    this.voices++;
    setTimeout(
      () => {
        this.voices--;
        out.disconnect();
        node.disconnect();
      },
      (end - now) * 1000 + 100,
    );
  }

  /** The version of `sound` this style plays; a sound with no realistic version plays its enhanced one. */
  variant(sound: Sound): Variant {
    const v = this.style === 'game' ? (GAME_SOUNDS[sound] ?? 'classic') : this.style;
    return v === 'realistic' && !realisticRecipe(sound) ? 'enhanced' : v;
  }

  /**
   * The machine-running loop: a low drone and a whirr with a gentle chug,
   * fading to `level` (0–1, how busy the factory on screen is).
   */
  setHum(level: number): void {
    this.humLevel = level;
    if (!this.started || (level <= 0 && !this.hum)) return;
    if (!this.setup()) return;
    const ctx = this.ctx!;
    if (!this.hum) this.hum = this.startHum();
    this.hum.gain.setTargetAtTime(level * HUM_PEAK, ctx.currentTime, 0.4);
  }

  private startHum(): GainNode {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master!);
    const drone = ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain).connect(out);
    drone.start();
    const enhancedHum = this.style === 'enhanced' || (this.style === 'game' && GAME_HUM === 'enhanced');
    if (enhancedHum) {
      // A second drone a fifth up and a little out of tune, so the hum beats slowly like real motors.
      const fifth = ctx.createOscillator();
      fifth.type = 'triangle';
      fifth.frequency.value = 82.8;
      const fifthGain = ctx.createGain();
      fifthGain.gain.value = 0.18;
      fifth.connect(fifthGain).connect(out);
      fifth.start();
    }
    const whirr = ctx.createBufferSource();
    whirr.buffer = enhancedHum ? this.gritBuf : this.noiseBuf;
    whirr.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 320;
    band.Q.value = 1.2;
    const whirrGain = ctx.createGain();
    whirrGain.gain.value = 0.35;
    whirr.connect(band).connect(whirrGain).connect(out);
    whirr.start();
    // The chug: the whirr swells and dips a few times a second, like machines at work.
    const chug = ctx.createOscillator();
    chug.frequency.value = 3.2;
    const depth = ctx.createGain();
    depth.gain.value = 0.15;
    chug.connect(depth).connect(whirrGain.gain);
    chug.start();
    return out;
  }

  private setup(): boolean {
    if (this.ctx) return true;
    this.ctx = audioContext();
    if (!this.ctx) return false;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    if (this.style !== 'classic') {
      // A compressor keeps a busy fight from clipping, and a short, quiet room gives the reworked sounds a
      // place (the classic ones stay dry, as they were picked).
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(ctx.destination);
      this.master.connect(comp);
      const room = ctx.createConvolver();
      room.buffer = this.roomImpulse(0.5);
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      this.roomIn = ctx.createGain();
      this.roomIn.gain.value = this.volume;
      this.roomIn.connect(room).connect(wet).connect(comp);
    } else {
      this.master.connect(ctx.destination);
    }
    // Two seconds of white noise, shared by every noise layer.
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // Coarse noise: each value held for 6 samples, like an old console's noise channel.
    this.gritBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const grit = this.gritBuf.getChannelData(0);
    for (let i = 0; i < len; i += 6) grit.fill(Math.random() * 2 - 1, i, Math.min(len, i + 6));
    return true;
  }

  /** A room's echo: noise dying away over `secs`, a little different in each ear. */
  private roomImpulse(secs: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  /** A pulse wave with this duty, built once from its harmonics. */
  private pulseWave(duty: number): PeriodicWave {
    let w = this.pulses.get(duty);
    if (!w) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 * Math.sin(k * Math.PI * duty)) / (k * Math.PI);
      w = this.ctx!.createPeriodicWave(real, imag);
      this.pulses.set(duty, w);
    }
    return w;
  }

  /** Plays one layer into `out`, its pitches scaled by `pitch`; returns when it ends (context time). */
  private layer(l: Layer, out: AudioNode, now: number, pitch = 1): number {
    const ctx = this.ctx!;
    const t0 = now + (l.at ?? 0);
    const t1 = t0 + l.dur;
    const attack = Math.min(l.attack ?? 0.004, l.dur / 2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(l.peak, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    env.connect(out);

    let src: AudioScheduledSourceNode;
    if (l.kind === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = l.grit && this.gritBuf ? this.gritBuf : this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = l.filter ?? 'bandpass';
      f.Q.value = l.q ?? 0.8;
      f.frequency.setValueAtTime(l.from * pitch, t0);
      f.frequency.exponentialRampToValueAtTime(l.to * pitch, t1);
      n.connect(f).connect(env);
      n.start(t0, Math.random() * 1.5);
      src = n;
    } else {
      const voices = l.detune ? [0, l.detune] : [0];
      const oscs = voices.map((cents) => {
        const o = ctx.createOscillator();
        if (l.pulse) o.setPeriodicWave(this.pulseWave(l.pulse));
        else o.type = l.kind as OscillatorType;
        o.detune.value = cents;
        o.frequency.setValueAtTime(l.from * pitch, t0);
        o.frequency.exponentialRampToValueAtTime(l.to * pitch, t1);
        o.connect(env);
        o.start(t0);
        o.stop(t1 + 0.02);
        return o;
      });
      oscs[oscs.length - 1].onended = () => env.disconnect();
      return t1;
    }
    src.stop(t1 + 0.02);
    src.onended = () => env.disconnect();
    return t1;
  }
}
