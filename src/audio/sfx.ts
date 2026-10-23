// Sound effects, synthesized with Web Audio: no sound files to download, and
// the single-file build gets them too. Each sound is a few oscillators and
// filtered noise bursts with short envelopes.

import { audioContext } from './context';

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
  | 'hub_shot'
  | 'cannon'
  | 'zap'
  | 'twang'
  | 'death'
  | 'destroyed'
  | 'hub_hit'
  | 'breach'
  | 'research'
  | 'stage'
  | 'provoked'
  | 'launch';

/** The shortest gap (seconds) between two plays of a sound, so a busy fight doesn't turn into noise. */
const MIN_GAP: Partial<Record<Sound, number>> = {
  click: 0.03,
  belt: 0.05,
  place: 0.05,
  chop: 0.15,
  pick: 0.05,
  shot: 0.07,
  hub_shot: 0.1,
  cannon: 0.12,
  zap: 0.1,
  twang: 0.1,
  death: 0.06,
  destroyed: 0.15,
  hub_hit: 0.6,
  provoked: 1,
};
/** At most this many sounds at once. */
const MAX_VOICES = 24;
/** The machine hum at its loudest (a busy factory filling the screen). */
const HUM_PEAK = 0.1;

export interface PlayOptions {
  /** 0–1, e.g. quieter when far from the middle of the screen. */
  gain?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
}

/** One envelope-shaped layer of a sound. */
interface Layer {
  kind: OscillatorType | 'noise';
  from: number; // Hz: oscillator pitch, or the noise filter's cutoff
  to: number;
  dur: number;
  peak: number;
  at?: number; // delay in seconds
  attack?: number;
  filter?: BiquadFilterType; // noise only (default bandpass)
  q?: number;
}

const tone = (kind: OscillatorType, from: number, to: number, dur: number, peak: number, at = 0, attack?: number): Layer => ({
  kind,
  from,
  to,
  dur,
  peak,
  at,
  attack,
});
const noise = (filter: BiquadFilterType, from: number, to: number, dur: number, peak: number, q = 0.8, at = 0, attack?: number): Layer => ({
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

function recipe(sound: Sound): Layer[] {
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
      return [noise('highpass', 2500, 1500, 0.06, 0.2), tone('square', 900, 300, 0.05, 0.05)];
    case 'hub_shot':
      return [tone('sawtooth', 1100, 250, 0.1, 0.12), noise('highpass', 1800, 1800, 0.05, 0.18)];
    case 'cannon':
      return [tone('sine', 110, 38, 0.35, 0.7), noise('lowpass', 1400, 150, 0.32, 0.45)];
    case 'twang':
      // A bowstring: a plucked, falling tone and the thud of the bolt leaving.
      return [tone('triangle', 330, 180, 0.18, 0.3), tone('sine', 165, 120, 0.2, 0.2), noise('lowpass', 900, 300, 0.06, 0.25)];
    case 'zap':
      // A crackle of high noise over a falling buzz.
      return [noise('highpass', 4000, 2500, 0.12, 0.3, 1.5), tone('sawtooth', 1400, 300, 0.1, 0.1), noise('bandpass', 2500, 900, 0.08, 0.2, 4, 0.03)];
    case 'death':
      return [noise('bandpass', 1600, 350, 0.14, 0.5, 3), tone('sine', 500, 160, 0.08, 0.18)];
    case 'destroyed':
      return [noise('lowpass', 2200, 150, 0.45, 0.65), tone('sine', 90, 35, 0.4, 0.65), noise('bandpass', 3000, 1500, 0.2, 0.25, 2, 0.05)];
    case 'hub_hit':
      return [tone('triangle', 330, 320, 0.28, 0.22), tone('sine', 812, 800, 0.22, 0.1), noise('bandpass', 2000, 1200, 0.05, 0.15)];
    case 'breach':
      return [
        tone('sine', 80, 30, 1.2, 0.6),
        noise('lowpass', 2500, 100, 1, 0.45),
        tone('square', 660, 440, 0.3, 0.1, 0.15),
        tone('square', 660, 440, 0.3, 0.1, 0.5),
      ];
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

  constructor(volume: number) {
    this.volume = volume;
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

    const out = ctx.createGain();
    out.gain.value = gain;
    let node: AudioNode = out;
    if (opts.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(panner);
      node = panner;
    }
    node.connect(this.master!);

    let end = 0;
    for (const layer of recipe(sound)) end = Math.max(end, this.layer(layer, out, now));
    this.voices++;
    setTimeout(() => {
      this.voices--;
      out.disconnect();
      node.disconnect();
    }, (end - now) * 1000 + 100);
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
    const whirr = ctx.createBufferSource();
    whirr.buffer = this.noiseBuf;
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
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    // Two seconds of white noise, shared by every noise layer.
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /** Plays one layer into `out`; returns when it ends (context time). */
  private layer(l: Layer, out: AudioNode, now: number): number {
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
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = l.filter ?? 'bandpass';
      f.Q.value = l.q ?? 0.8;
      f.frequency.setValueAtTime(l.from, t0);
      f.frequency.exponentialRampToValueAtTime(l.to, t1);
      n.connect(f).connect(env);
      n.start(t0, Math.random() * 1.5);
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = l.kind;
      o.frequency.setValueAtTime(l.from, t0);
      o.frequency.exponentialRampToValueAtTime(l.to, t1);
      o.connect(env);
      o.start(t0);
      src = o;
    }
    src.stop(t1 + 0.02);
    src.onended = () => env.disconnect();
    return t1;
  }
}
