// Shared tools for composing the game's music in code (D-051, D-052): note
// names, a phrase parser, synthesized instruments in the style of late-90s
// adventure games, a reverb, and a WAV writer. Each track script describes its
// notes and calls render().

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RATE = 22050;
const TAU = 2 * Math.PI;

// ------------------------------------------------------------------ notes

const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** MIDI number for a note like 'C5', 'Bb4' or 'F#4'. */
export function midi(n) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (Number(m[2]) + 1) + NAMES[m[1]];
}
export const freq = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * Parses bars like 'C6:2 A5:1 | E6:3 D6:3' (note:length in grid steps, '-' for
 * a rest) starting at bar `startBar`, checking each bar adds up to `barLen` steps.
 */
export function phrase(text, startBar, barLen) {
  const out = [];
  text
    .trim()
    .split('|')
    .forEach((bar, i) => {
      let t = (startBar + i) * barLen;
      let used = 0;
      for (const tok of bar.trim().split(/\s+/)) {
        const [n, len] = tok.split(':');
        if (n !== '-') out.push({ m: midi(n), at: t, len: Number(len) });
        t += Number(len);
        used += Number(len);
      }
      if (Math.abs(used - barLen) > 1e-9) throw new Error(`bar ${i + 1} of "${text.trim().slice(0, 30)}…" has ${used} steps, not ${barLen}`);
    });
  return out;
}

/** Chord voicings by name, low to high. */
export const voicing = (notes) => notes.map(midi);

// ------------------------------------------------------------- the track

/**
 * A track being rendered: `step` is the length of one grid step in seconds.
 * Notes' `at` and `len` are in grid steps.
 */
export function createTrack({ step, steps, tail = 3, seed = 12345 }) {
  const total = Math.ceil((steps * step + tail) * RATE);
  let s = seed;
  return {
    step,
    total,
    dry: new Float64Array(total),
    /** Seeded noise, so the file comes out the same every time. */
    rand: () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296,
  };
}

// ------------------------------------------------------------ instruments

/** A breathy, ocarina-like flute: a little scoop up into each note, and vibrato on long ones. */
export function flute(tr, e) {
  const f = freq(e.m);
  const dur = e.len * tr.step * 0.94;
  const i0 = Math.floor(e.at * tr.step * RATE);
  const n = Math.floor((dur + 0.12) * RATE);
  let ph = 0;
  let breath = 0;
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    const scoop = 1 - 0.015 * Math.exp(-t / 0.03);
    const vib = t > 0.25 ? 1 + 0.005 * Math.sin(TAU * 5 * t) * Math.min(1, (t - 0.25) / 0.3) : 1;
    ph += (f * scoop * vib) / RATE;
    const tone = Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph) + 0.05 * Math.sin(3 * TAU * ph);
    breath += (tr.rand() * 2 - 1 - breath) * 0.3; // softened noise
    const env = Math.min(1, t / 0.05) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 1) * (0.9 + 0.1 * Math.exp(-t / 0.2));
    tr.dry[i0 + i] += (tone + breath * 0.05) * e.vol * env;
  }
}

/** Plucked strings and struck bars, built from decaying partials so every note is in tune. */
export function plucked(tr, e, partials, decay, bright) {
  const f = freq(e.m);
  const i0 = Math.floor(e.at * tr.step * RATE);
  const n = Math.floor(Math.min(4, e.len * tr.step + decay * 3) * RATE);
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [mult, amp, d] of partials) v += amp * Math.sin(TAU * f * mult * t) * Math.exp(-t / (decay * d));
    const click = bright * Math.exp(-t / 0.002) * (tr.rand() * 2 - 1);
    tr.dry[i0 + i] += (v + click) * e.vol * Math.min(1, t / 0.002);
  }
}
export const harp = (tr, e) => plucked(tr, e, [[1, 1, 1], [2, 0.45, 0.6], [3, 0.2, 0.4], [4, 0.1, 0.3]], 0.9, 0.05);
export const pizz = (tr, e) => plucked(tr, e, [[1, 1, 1], [2, 0.3, 0.5], [3, 0.12, 0.3]], 0.28, 0.08);
export const marimba = (tr, e) => plucked(tr, e, [[1, 1, 1], [3.93, 0.25, 0.12], [9.2, 0.06, 0.05]], 0.35, 0.02);
/** A music box or celesta: bright, bell-like, ringing on. */
export const bell = (tr, e) => plucked(tr, e, [[1, 1, 1], [2, 0.35, 0.5], [3.01, 0.15, 0.3], [5.4, 0.06, 0.15]], 1.1, 0.03);
/** A plucked lute or guitar: warmer than the harp, quicker to fade. */
export const lute = (tr, e) => plucked(tr, e, [[1, 1, 1], [2, 0.6, 0.5], [3, 0.35, 0.35], [4, 0.2, 0.25], [5, 0.1, 0.2]], 0.45, 0.06);

/** Soft strings: detuned, gently filtered saws that swell in and out. `e.chord` holds the notes. */
export function strings(tr, e) {
  const i0 = Math.floor(e.at * tr.step * RATE);
  const dur = e.len * tr.step;
  const n = Math.floor((dur + 0.4) * RATE);
  const voices = e.chord.flatMap((m) => [freq(m) * 0.997, freq(m) * 1.003]);
  const ph = voices.map(() => tr.rand());
  let lp = 0;
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    let v = 0;
    voices.forEach((f, k) => {
      ph[k] = (ph[k] + f / RATE) % 1;
      v += ph[k] * 2 - 1;
    });
    lp += (v / voices.length - lp) * 0.08;
    const env = Math.min(1, t / (e.attack ?? 0.5)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.4) : 1);
    tr.dry[i0 + i] += lp * e.vol * 4 * env;
  }
}

/**
 * Sustained, filtered tones for reeds and brass. `odd` favours odd harmonics
 * (a clarinet's hollow sound); `bite` opens the filter on the attack (brass).
 */
function sustained(tr, e, { harmonics, attack, release, vib = 0.004, vibRate = 5, bite = 0, beat = 0 }) {
  const f = freq(e.m);
  const dur = e.len * tr.step * 0.95;
  const i0 = Math.floor(e.at * tr.step * RATE);
  const n = Math.floor((dur + release) * RATE);
  let ph = 0;
  let ph2 = 0;
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    const v = t > 0.2 ? 1 + vib * Math.sin(TAU * vibRate * t) * Math.min(1, (t - 0.2) / 0.3) : 1;
    ph += (f * v) / RATE;
    ph2 += (f * v * (1 + beat)) / RATE; // a second reed, slightly out, for the accordion's shimmer
    const open = 1 + bite * Math.exp(-t / 0.08);
    let s = 0;
    harmonics.forEach((a, k) => {
      const amp = a * Math.min(1, open / (k + 1) ** 0.5);
      s += amp * Math.sin(TAU * (k + 1) * ph);
      if (beat) s += amp * Math.sin(TAU * (k + 1) * ph2);
    });
    const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    tr.dry[i0 + i] += s * e.vol * env * (beat ? 0.5 : 1);
  }
}
export const clarinet = (tr, e) => sustained(tr, e, { harmonics: [1, 0.05, 0.45, 0.03, 0.22, 0.02, 0.1], attack: 0.04, release: 0.1 });
export const accordion = (tr, e) => sustained(tr, e, { harmonics: [1, 0.6, 0.45, 0.3, 0.2, 0.12], attack: 0.025, release: 0.06, vib: 0, beat: 0.006 });
export const brass = (tr, e) => sustained(tr, e, { harmonics: [1, 0.7, 0.5, 0.35, 0.22, 0.14, 0.08], attack: 0.03, release: 0.12, bite: 2.5, vib: 0.005 });

/** A soft noise hit, high-passed for shakers or band-passed for a snare. */
function hit(tr, at, vol, dur, body) {
  const i0 = Math.floor(at * tr.step * RATE);
  const n = Math.floor(dur * 3 * RATE);
  let prev = 0;
  let lp = 0;
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    const w = tr.rand() * 2 - 1;
    const hp = w - prev;
    prev = w;
    lp += (hp - lp) * body;
    tr.dry[i0 + i] += (body ? lp * 2 : hp) * vol * Math.min(1, t / 0.008) * Math.exp(-t / dur);
  }
}
export const shaker = (tr, e) => hit(tr, e.at, e.vol, 0.02, 0);
export const snare = (tr, e) => hit(tr, e.at, e.vol, 0.06, 0.35);

/** Tuned drums: a falling sine with a soft thump. Woodblocks are short and high, timpani long and low. */
function drum(tr, e, { f0, f1, fall, decay }) {
  const i0 = Math.floor(e.at * tr.step * RATE);
  const n = Math.floor(decay * 5 * RATE);
  let ph = 0;
  for (let i = 0; i < n && i0 + i < tr.total; i++) {
    const t = i / RATE;
    ph += (f1 + (f0 - f1) * Math.exp(-t / fall)) / RATE;
    tr.dry[i0 + i] += Math.sin(TAU * ph) * e.vol * Math.min(1, t / 0.002) * Math.exp(-t / decay);
  }
}
export const woodblock = (tr, e) => drum(tr, e, { f0: 1500, f1: 1100, fall: 0.004, decay: 0.03 });
export const lowDrum = (tr, e) => drum(tr, e, { f0: 140, f1: 70, fall: 0.03, decay: 0.12 });
export const timpani = (tr, e) => drum(tr, e, { f0: freq(e.m) * 1.05, f1: freq(e.m), fall: 0.05, decay: 0.6 });

// ------------------------------------------------------------- reverb

/** A small Schroeder reverb: parallel damped combs, then allpasses. */
export function reverb(input, { feedback = 0.86, damp = 0.35 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({ buf: new Float64Array(Math.round(d / 2)), i: 0, store: 0 }));
  const allpasses = [556, 441, 341].map((d) => ({ buf: new Float64Array(Math.round(d / 2)), i: 0 }));
  const out = new Float64Array(input.length);
  for (let n = 0; n < input.length; n++) {
    const x = input[n] * 0.12;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.store = o * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * feedback;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    for (const a of allpasses) {
      const b = a.buf[a.i];
      a.buf[a.i] = y + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      y = b - y;
    }
    out[n] = y;
  }
  return out;
}

// ----------------------------------------------------------- mix down

/**
 * Adds reverb, sets the level and writes public/music/<name>.wav (22 kHz,
 * 16-bit mono). With `loudness` (dBFS), every track is brought to the same
 * average level, so the playlist doesn't jump in volume; otherwise the peak
 * is set to 0.85.
 */
export function render(tr, name, { wet = 0.6, dryLevel = 0.85, room, loudness } = {}) {
  const { total, dry } = tr;
  const w = reverb(dry, room);
  const mix = new Float64Array(total);
  for (let i = 0; i < total; i++) mix[i] = dry[i] * dryLevel + w[i] * wet;

  let gain;
  if (loudness != null) {
    let sum = 0;
    for (const v of mix) sum += v * v;
    gain = 10 ** (loudness / 20) / Math.sqrt(sum / total);
  } else {
    let peak = 0;
    for (const v of mix) peak = Math.max(peak, Math.abs(v));
    gain = 0.85 / peak;
  }
  // Fade the very end, so the crossfade into the next track lands softly.
  const fade = 2 * RATE;
  for (let i = total - fade; i < total; i++) mix[i] *= (total - i) / fade;

  const data = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) data.writeInt16LE(Math.round(Math.tanh(mix[i] * gain) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  const out = fileURLToPath(new URL(`../../public/music/${name}.wav`, import.meta.url));
  writeFileSync(out, Buffer.concat([header, data]));
  let sum = 0;
  for (let i = 0; i < total; i++) sum += (data.readInt16LE(i * 2) / 32768) ** 2;
  console.log(`${name}: ${(total / RATE).toFixed(1)} s, ${((44 + data.length) / 1024 / 1024).toFixed(2)} MB, ${(10 * Math.log10(sum / total)).toFixed(1)} dBFS`);
}
