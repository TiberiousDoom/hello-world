// Composes and renders the main menu theme (D-051): an original tune in the
// style of late-90s 3D adventure games. A breathy, ocarina-like flute carries
// the melody over plucked harp, pizzicato bass, marimba and soft strings, in a
// lilting 6/8 and the F Lydian mode (its raised fourth sounds a little magical),
// with a roomy reverb like the consoles of the time.
//
// Run with `node audio/compose/menu-theme.mjs`. It writes public/music/menu-theme.wav
// (22 kHz, 16-bit mono). Change the notes below and run it again to rework the tune.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const EIGHTH = 60 / (64 * 3); // 6/8 at 64 dotted quarters a minute
const BAR = 6; // eighths per bar

// ------------------------------------------------------------------ notes

const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** MIDI number for a note like 'C5', 'Bb4' or 'F#4'. */
function midi(n) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (Number(m[2]) + 1) + NAMES[m[1]];
}
const freq = (m) => 440 * 2 ** ((m - 69) / 12);

/** Parses bars like 'C6:2 A5:1 | E6:3 D6:3' (note:eighths, '-' for a rest), checking each bar is full. */
function phrase(text, startBar) {
  const out = [];
  text
    .trim()
    .split('|')
    .forEach((bar, i) => {
      let t = (startBar + i) * BAR;
      let used = 0;
      for (const tok of bar.trim().split(/\s+/)) {
        const [n, len] = tok.split(':');
        if (n !== '-') out.push({ m: midi(n), at: t, len: Number(len) });
        t += Number(len);
        used += Number(len);
      }
      if (used !== BAR) throw new Error(`bar ${i + 1} of "${text.trim().slice(0, 30)}…" has ${used} eighths`);
    });
  return out;
}

// ------------------------------------------------------------- the tune

// Chord voicings, low to high (the bass plays the first note an octave down).
const CHORDS = {
  Fmaj7: ['F3', 'C4', 'E4', 'A4'],
  'G/F': ['F3', 'B3', 'D4', 'G4'],
  Am: ['A3', 'E4', 'A4', 'C5'],
  Dm: ['D3', 'A3', 'D4', 'F4'],
  Bbmaj7: ['Bb2', 'F3', 'A3', 'D4'],
  C: ['C3', 'G3', 'C4', 'E4'],
  Csus: ['C3', 'G3', 'C4', 'F4'],
  Gm: ['G3', 'D4', 'G4', 'Bb4'],
  F: ['F3', 'C4', 'F4', 'A4'],
};

const A_CHORDS = ['Fmaj7', 'G/F', 'Fmaj7', 'G/F', 'Am', 'Dm', 'Bbmaj7', 'Csus'];
const A_END_CHORDS = ['Fmaj7', 'G/F', 'Fmaj7', 'G/F', 'Am', 'Dm', 'Bbmaj7', 'F'];
const B_CHORDS = ['Dm', 'Am', 'Bbmaj7', 'F', 'Gm', 'Am', 'Bbmaj7', 'C'];

const A_MELODY = `
  C6:2 A5:1 C6:2 F6:1 | E6:3 D6:2 B5:1 |
  C6:2 A5:1 F5:2 A5:1 | G5:6 |
  A5:2 C6:1 E6:2 D6:1 | C6:2 A5:1 F5:3 |
  D6:2 C6:1 Bb5:2 A5:1 | G5:3 C6:1 D6:1 E6:1`;
const A_END_MELODY = `
  C6:2 A5:1 C6:2 F6:1 | E6:3 D6:2 B5:1 |
  C6:2 A5:1 F5:2 A5:1 | G5:6 |
  A5:2 C6:1 E6:2 D6:1 | C6:2 A5:1 F5:3 |
  D6:2 E6:1 F6:2 E6:1 | F6:6`;
const B_MELODY = `
  F5:2 A5:1 D6:3 | C6:2 E6:1 A5:3 |
  D6:2 C6:1 Bb5:2 D6:1 | C6:6 |
  Bb5:2 D6:1 G6:2 F6:1 | E6:2 C6:1 A5:3 |
  Bb5:2 C6:1 D6:2 F6:1 | E6:3 G6:3`;
// The marimba's answer on the second pass: short notes between the flute's phrases.
const A_MARIMBA = `
  -:3 F5:1 A5:1 C6:1 | -:3 G5:1 B5:1 D6:1 |
  -:3 A5:1 C6:1 E6:1 | -:3 B5:1 D6:1 G6:1 |
  -:3 E5:1 A5:1 C6:1 | -:3 D5:1 F5:1 A5:1 |
  -:3 D5:1 F5:1 Bb5:1 | -:6`;

// Form: harp intro, A, A with marimba, B with strings, A to close, and a quiet ending.
const SECTIONS = [
  { chords: ['Fmaj7', 'G/F'], harp: true },
  { chords: A_CHORDS, melody: A_MELODY, harp: true, shaker: true },
  { chords: A_CHORDS, melody: A_MELODY, marimba: A_MARIMBA, harp: true, shaker: true },
  { chords: B_CHORDS, melody: B_MELODY, harp: true, strings: true, shaker: true },
  { chords: A_END_CHORDS, melody: A_END_MELODY, harp: true, strings: true, shaker: true },
  { chords: ['Fmaj7', 'Fmaj7'], melody: 'A5:3 C6:3 | F6:6', harp: true, strings: true, last: true },
];

// ------------------------------------------------------------ the parts

const events = [];
let bar = 0;
for (const sec of SECTIONS) {
  sec.chords.forEach((name, i) => {
    const v = CHORDS[name].map(midi);
    const at = (bar + i) * BAR;
    const lastBar = sec.last && i === sec.chords.length - 1;
    // Harp: up and back down the chord in eighths; on the very last bar, one slow roll.
    if (sec.harp) {
      if (lastBar) v.forEach((m, k) => events.push({ ins: 'harp', m: m + 12, at: at + k * 0.5, len: 6, vol: 0.16 }));
      else [0, 1, 2, 3, 2, 1].forEach((k, s) => events.push({ ins: 'harp', m: v[k] + 12, at: at + s, len: 2, vol: s === 0 ? 0.17 : 0.13 }));
    }
    // Pizzicato bass on the two beats of the bar: root, then fifth.
    events.push({ ins: 'pizz', m: v[0] - 12, at, len: 2, vol: 0.32 });
    if (!lastBar) events.push({ ins: 'pizz', m: v[1] - 12, at: at + 3, len: 2, vol: 0.24 });
    if (sec.strings) events.push({ ins: 'strings', chord: v, at, len: BAR, vol: lastBar ? 0.05 : 0.045 });
    if (sec.shaker) for (let s = 0; s < BAR; s++) events.push({ ins: 'shaker', at: at + s, vol: s % 3 === 0 ? 0.035 : 0.018 });
  });
  if (sec.melody) for (const n of phrase(sec.melody, bar)) events.push({ ins: 'flute', ...n, vol: 0.34 });
  if (sec.marimba) for (const n of phrase(sec.marimba, bar)) events.push({ ins: 'marimba', ...n, vol: 0.14 });
  bar += sec.chords.length;
}

// ------------------------------------------------------------- synthesis

const tailSeconds = 3; // room for the last notes and the reverb to ring out
const total = Math.ceil((bar * BAR * EIGHTH + tailSeconds) * RATE);
const dry = new Float64Array(total);
const TAU = 2 * Math.PI;

/** Seeded noise, so the file comes out the same every time. */
let seed = 12345;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;

/** The flute: a soft, slightly hollow tone with breath, a little scoop up into each note, and vibrato on long ones. */
function flute(e) {
  const f = freq(e.m);
  const dur = e.len * EIGHTH * 0.94;
  const i0 = Math.floor(e.at * EIGHTH * RATE);
  const n = Math.floor((dur + 0.12) * RATE);
  let ph = 0;
  let breath = 0;
  for (let i = 0; i < n && i0 + i < total; i++) {
    const t = i / RATE;
    const scoop = 1 - 0.015 * Math.exp(-t / 0.03);
    const vib = t > 0.25 ? 1 + 0.005 * Math.sin(TAU * 5 * t) * Math.min(1, (t - 0.25) / 0.3) : 1;
    ph += (f * scoop * vib) / RATE;
    const tone = Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph) + 0.05 * Math.sin(3 * TAU * ph);
    breath += (rand() * 2 - 1 - breath) * 0.3; // softened noise
    const env = Math.min(1, t / 0.05) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 1) * (0.9 + 0.1 * Math.exp(-t / 0.2));
    dry[i0 + i] += (tone + breath * 0.05) * e.vol * env;
  }
}

/** Plucked strings and bars, built from decaying partials so every note is in tune. */
function plucked(e, partials, decay, bright) {
  const f = freq(e.m);
  const i0 = Math.floor(e.at * EIGHTH * RATE);
  const n = Math.floor(Math.min(4, e.len * EIGHTH + decay * 3) * RATE);
  for (let i = 0; i < n && i0 + i < total; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [mult, amp, d] of partials) v += amp * Math.sin(TAU * f * mult * t) * Math.exp(-t / (decay * d));
    const click = bright * Math.exp(-t / 0.002) * (rand() * 2 - 1);
    dry[i0 + i] += (v + click) * e.vol * Math.min(1, t / 0.002);
  }
}
const harp = (e) => plucked(e, [[1, 1, 1], [2, 0.45, 0.6], [3, 0.2, 0.4], [4, 0.1, 0.3]], 0.9, 0.05);
const pizz = (e) => plucked(e, [[1, 1, 1], [2, 0.3, 0.5], [3, 0.12, 0.3]], 0.28, 0.08);
const marimba = (e) => plucked(e, [[1, 1, 1], [3.93, 0.25, 0.12], [9.2, 0.06, 0.05]], 0.35, 0.02);

/** Soft strings: detuned, gently filtered saws that swell in and out over the bar. */
function strings(e) {
  const i0 = Math.floor(e.at * EIGHTH * RATE);
  const dur = e.len * EIGHTH;
  const n = Math.floor((dur + 0.4) * RATE);
  const voices = e.chord.slice(1).flatMap((m) => [freq(m) * 0.997, freq(m) * 1.003]);
  const ph = voices.map(() => rand());
  let lp = 0;
  for (let i = 0; i < n && i0 + i < total; i++) {
    const t = i / RATE;
    let v = 0;
    voices.forEach((f, k) => {
      ph[k] = (ph[k] + f / RATE) % 1;
      v += ph[k] * 2 - 1;
    });
    lp += (v / voices.length - lp) * 0.08;
    const env = Math.min(1, t / 0.5) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.4) : 1);
    dry[i0 + i] += lp * e.vol * 4 * env;
  }
}

function shaker(e) {
  const i0 = Math.floor(e.at * EIGHTH * RATE);
  const n = Math.floor(0.06 * RATE);
  let prev = 0;
  for (let i = 0; i < n && i0 + i < total; i++) {
    const t = i / RATE;
    const w = rand() * 2 - 1;
    const hp = w - prev; // only the hiss
    prev = w;
    dry[i0 + i] += hp * e.vol * Math.min(1, t / 0.008) * Math.exp(-t / 0.02);
  }
}

const PLAY = { flute, harp, pizz, marimba, strings, shaker };
for (const e of events) PLAY[e.ins](e);

// ------------------------------------------------------------- reverb

/** A small Schroeder reverb: parallel damped combs, then allpasses. */
function reverb(input) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({ buf: new Float64Array(Math.round(d / 2)), i: 0, store: 0 }));
  const allpasses = [556, 441, 341].map((d) => ({ buf: new Float64Array(Math.round(d / 2)), i: 0 }));
  const out = new Float64Array(input.length);
  const feedback = 0.86;
  const damp = 0.35;
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

const wet = reverb(dry);
const mix = new Float64Array(total);
for (let i = 0; i < total; i++) mix[i] = dry[i] * 0.85 + wet[i] * 0.6;

// ----------------------------------------------------------- mix down

let peak = 0;
for (const v of mix) peak = Math.max(peak, Math.abs(v));
const gain = 0.85 / peak;
// Fade the very end, so the loop's crossfade lands softly.
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

const out = fileURLToPath(new URL('../../public/music/menu-theme.wav', import.meta.url));
writeFileSync(out, Buffer.concat([header, data]));
console.log(`Wrote ${out}: ${(total / RATE).toFixed(1)} s, ${((44 + data.length) / 1024 / 1024).toFixed(2)} MB, ${events.length} notes`);
