// The in-game tracks, the first-delivery fanfare (D-052) and the season interludes (#42): original tunes in
// the same late-90s adventure style as the menu theme, some upbeat and some
// slow. Each is a song description: chord voicings, sections of bars with a
// lead line (and sometimes a second voice), and an accompaniment style.
//
// Notes are written as note:length, where the length counts eighth notes
// (0.5 is a sixteenth). Every bar is checked to add up.

import {
  accordion,
  bell,
  brass,
  clarinet,
  createTrack,
  flute,
  harp,
  lowDrum,
  lute,
  marimba,
  midi,
  phrase,
  pizz,
  render,
  shaker,
  snare,
  strings,
  timpani,
  woodblock,
} from './lib.mjs';

/** Every track is brought to the menu theme's average level, so nothing jumps out of the playlist. */
const LOUDNESS = -14.5;

// ------------------------------------------------------- accompaniment

// Each style adds notes for one chord: `v` is its voicing (MIDI, low to high),
// `at` and `len` in eighths, `beat` the eighths per beat.
const STYLES = {
  /** Harp up and back down the chord in eighths. */
  harpArp: (out, v, at, len) => {
    const order = [0, 1, 2, 3, 2, 1];
    for (let s = 0; s < len; s++) out.push({ ins: harp, m: v[order[s % order.length]] + 12, at: at + s, len: 2, vol: s === 0 ? 0.16 : 0.12 });
  },
  /** Harp only on the beats, for slow tracks. */
  harpSparse: (out, v, at, len, beat) => {
    for (let s = 0, k = 0; s < len; s += beat, k++) out.push({ ins: harp, m: v[[0, 2, 3, 1][k % 4]] + 12, at: at + s, len: beat * 2, vol: 0.13 });
  },
  /** Pizzicato bass on the main beats: root, then fifth. */
  bassRootFifth: (out, v, at, len, beat) => {
    const step = len >= beat * 3 && beat === 2 ? beat * 2 : beat;
    for (let s = 0, k = 0; s < len; s += step, k++) out.push({ ins: pizz, m: (k % 2 ? v[1] : v[0]) - 12, at: at + s, len: step, vol: k === 0 ? 0.32 : 0.24 });
  },
  /** A bass on every beat, stepping root, octave, fifth, octave. */
  bassWalk: (out, v, at, len, beat) => {
    const line = [v[0] - 12, v[0], v[1] - 12, v[0]];
    for (let s = 0, k = 0; s < len; s += beat, k++) out.push({ ins: pizz, m: line[k % 4], at: at + s, len: beat, vol: 0.28 });
  },
  /** Oom-pah: bass on the beat, a short chord on the off-beat. */
  oompah: (out, v, at, len, beat) => {
    for (let s = 0, k = 0; s < len; s += beat, k++) {
      out.push({ ins: pizz, m: (k % 2 ? v[1] : v[0]) - 12, at: at + s, len: 1, vol: 0.3 });
      for (const m of v.slice(1)) out.push({ ins: lute, m, at: at + s + beat / 2, len: 0.5, vol: 0.06 });
    }
  },
  /** Waltz: a low note on one, the chord on two and three. */
  waltz: (out, v, at, len) => {
    out.push({ ins: harp, m: v[0], at, len: 2, vol: 0.16 });
    for (const s of [2, 4]) for (const m of v.slice(1)) out.push({ ins: harp, m: m + 12, at: at + s, len: 2, vol: 0.06 });
  },
  /** A lute strummed on each beat. */
  strum: (out, v, at, len, beat) => {
    for (let s = 0; s < len; s += beat) v.forEach((m, k) => out.push({ ins: lute, m: m + 12, at: at + s + k * 0.08, len: beat, vol: 0.06 }));
  },
  /** Lute chords on the back beats (two and four). */
  backbeat: (out, v, at, len, beat) => {
    for (let s = beat; s < len; s += beat * 2) for (const m of v.slice(1)) out.push({ ins: lute, m: m + 12, at: at + s, len: 1, vol: 0.06 });
  },
  /** Marimba bouncing between the chord's tones in eighths. */
  marimbaBounce: (out, v, at, len) => {
    for (let s = 0; s < len; s++) out.push({ ins: marimba, m: v[1 + (s % 3)] + 12, at: at + s, len: 1, vol: s % 2 ? 0.07 : 0.1 });
  },
  /** Soft strings holding the chord. */
  pad: (out, v, at, len) => out.push({ ins: strings, chord: v.slice(1), at, len, vol: 0.045 }),
  padLow: (out, v, at, len) => out.push({ ins: strings, chord: v, at, len, vol: 0.05, attack: 1.2 }),
  /** Timpani on the downbeat. */
  timp: (out, v, at) => out.push({ ins: timpani, m: v[0] - 12, at, len: 2, vol: 0.4 }),
};

const DRUMS = {
  shaker: (out, at, len, beat) => {
    for (let s = 0; s < len; s++) out.push({ ins: shaker, at: at + s, vol: s % beat === 0 ? 0.035 : 0.018 });
  },
  polka: (out, at, len, beat) => {
    for (let s = 0; s < len; s += beat) {
      out.push({ ins: lowDrum, at: at + s, vol: 0.22 });
      out.push({ ins: woodblock, at: at + s + beat / 2, vol: 0.12 });
    }
    for (let s = 0; s < len; s++) out.push({ ins: shaker, at: at + s + 0.5, vol: 0.015 });
  },
  jig: (out, at, len) => {
    for (const s of [0, 3]) out.push({ ins: lowDrum, at: at + s, vol: 0.26 });
    out.push({ ins: lowDrum, at: at + 5, vol: 0.12 });
    for (let s = 0; s < len; s++) out.push({ ins: shaker, at: at + s, vol: s % 3 === 0 ? 0.035 : 0.02 });
  },
  backbeat: (out, at, len, beat) => {
    for (let s = 0; s < len; s += beat) {
      out.push(s % (beat * 2) === 0 ? { ins: lowDrum, at: at + s, vol: 0.2 } : { ins: woodblock, at: at + s, vol: 0.1 });
    }
    for (let s = 0; s < len; s++) out.push({ ins: shaker, at: at + s, vol: s % 2 ? 0.016 : 0.028 });
  },
  heartbeat: (out, at) => {
    out.push({ ins: lowDrum, at, vol: 0.18 });
    out.push({ ins: lowDrum, at: at + 0.75, vol: 0.1 });
  },
  march: (out, at, len, beat) => {
    for (let s = beat; s < len; s += beat * 2) out.push({ ins: snare, at: at + s, vol: 0.08 });
    out.push({ ins: lowDrum, at, vol: 0.2 });
  },
  roll: (out, at, len) => {
    for (let s = 0; s < len; s += 0.25) out.push({ ins: snare, at: at + s, vol: 0.02 + (0.06 * s) / len });
  },
};

// --------------------------------------------------------------- songs

/**
 * Builds and renders a song. `step` is the length of an eighth note in seconds,
 * `bar` the eighths per bar, `beat` the eighths per beat. A chord name like
 * 'G|C' splits the bar between two chords. `swing` delays off-beat eighths.
 */
function song({ name, step, bar, beat, chords, sections, swing = 0, room }) {
  const events = [];
  let at = 0;
  for (const sec of sections) {
    sec.chords.forEach((c, i) => {
      const parts = c.split('|');
      parts.forEach((p, k) => {
        const v = chords[p].map(midi);
        const len = bar / parts.length;
        const start = at + i * bar + k * len;
        for (const style of sec.parts ?? []) STYLES[style](events, v, start, len, beat);
      });
      if (sec.drums) DRUMS[sec.drums](events, at + i * bar, bar, beat);
    });
    for (const line of sec.lines ?? []) {
      for (const n of phrase(line.text, at / bar, bar)) events.push({ ins: line.ins, ...n, m: n.m + (line.shift ?? 0), vol: line.vol });
    }
    at += sec.chords.length * bar;
  }
  // A little swing: off-beat eighths land late.
  if (swing) for (const e of events) if (Math.abs((e.at % 2) - 1) < 1e-9) e.at += swing;
  const tr = createTrack({ step, steps: at, seed: [...name].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) | 0 });
  for (const e of events) e.ins(tr, e);
  render(tr, name, { loudness: LOUDNESS, room });
}

// --------------------------------------------- 1. Morning Clearing (moderate)

function morningClearing() {
  const A = `
    F#5:2 A5:2 D6:3 C#6:1 | B5:4 A5:2 G5:2 |
    F#5:2 E5:1 F#5:1 A5:2 D6:2 | E6:6 -:2 |
    D6:2 C#6:2 B5:2 F#5:2 | G5:3 A5:1 B5:2 D6:2 |
    E6:2 D6:1 B5:1 G5:2 E5:2 | A5:6 -:2`;
  const A_END = `
    F#5:2 A5:2 D6:3 C#6:1 | B5:4 A5:2 G5:2 |
    F#5:2 E5:1 F#5:1 A5:2 D6:2 | E6:6 -:2 |
    D6:2 C#6:2 B5:2 F#5:2 | G5:3 A5:1 B5:2 D6:2 |
    G5:2 B5:2 E6:2 C#6:2 | D6:8`;
  const B = `
    B5:3 A5:1 G5:2 B5:2 | C#6:3 B5:1 A5:2 E5:2 |
    F#5:2 A5:2 C#6:2 E6:2 | D6:6 -:2 |
    D6:2 B5:2 G5:2 B5:2 | C#6:2 A5:2 E5:2 A5:2 |
    B5:2 G5:2 E5:2 G5:2 | A5:4 C#6:2 E6:2`;
  const B_MARIMBA = `
    -:4 D5:1 G5:1 B5:2 | -:4 E5:1 A5:1 C#6:2 |
    -:4 F#5:1 A5:1 C#6:2 | -:4 F#5:1 B5:1 D6:2 |
    -:4 D5:1 G5:1 B5:2 | -:4 E5:1 A5:1 C#6:2 |
    -:4 E5:1 G5:1 B5:2 | -:8`;
  const flutePart = (text) => ({ ins: flute, text, vol: 0.34 });
  song({
    name: 'morning-clearing',
    step: 60 / 92 / 2,
    bar: 8,
    beat: 2,
    chords: {
      D: ['D3', 'A3', 'D4', 'F#4'],
      G: ['G3', 'B3', 'D4', 'G4'],
      A: ['A3', 'C#4', 'E4', 'A4'],
      Bm: ['B2', 'F#3', 'B3', 'D4'],
      Em: ['E3', 'B3', 'E4', 'G4'],
      'F#m': ['F#3', 'C#4', 'F#4', 'A4'],
    },
    sections: [
      { chords: ['D', 'G'], parts: ['harpArp', 'bassRootFifth'] },
      { chords: ['D', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'], parts: ['harpArp', 'bassRootFifth'], drums: 'shaker', lines: [flutePart(A)] },
      { chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Em', 'A'], parts: ['harpArp', 'bassRootFifth', 'pad'], drums: 'shaker', lines: [flutePart(B), { ins: marimba, text: B_MARIMBA, vol: 0.12 }] },
      { chords: ['D', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'D'], parts: ['harpArp', 'bassRootFifth', 'pad'], drums: 'shaker', lines: [flutePart(A_END)] },
      { chords: ['D'], parts: ['pad'], lines: [{ ins: harp, text: 'D5:1 F#5:1 A5:1 D6:5', vol: 0.16 }] },
    ],
  });
}

// ----------------------------------------------- 2. Workshop Polka (upbeat)

function workshopPolka() {
  const A = `
    G5:1 B5:1 D6:1 B5:1 | G5:1 -:1 D5:1 -:1 | F#5:1 A5:1 D6:1 A5:1 | F#5:1 -:1 D5:1 -:1 |
    E5:0.5 F#5:0.5 G5:1 A5:1 B5:1 | C6:1 B5:1 A5:2 | B5:1 G5:1 D5:1 G5:1 | B5:2 -:2 |
    D6:1 B5:1 D6:1 G6:1 | G6:2 F#6:1 E6:1 | E6:1 C6:1 E6:1 G6:1 | G6:2 E6:2 |
    D6:1 C6:1 B5:1 A5:1 | F#5:1 A5:1 C6:1 F#5:1 | G5:1 B5:1 D6:1 B5:1 | G5:2 -:2`;
  const B = `
    E5:1 G5:1 C6:2 | E6:1 D6:1 C6:2 | B5:1 D6:1 G6:2 | D6:1 B5:1 G5:2 |
    A5:1 B5:1 C6:1 A5:1 | F#5:1 G5:1 A5:2 | B5:1 A5:1 G5:1 F#5:1 | G5:2 D5:2 |
    E5:1 G5:1 C6:1 E6:1 | D6:1 C6:1 G5:2 | B5:1 D6:1 G6:1 D6:1 | B5:2 G5:2 |
    A5:1 C6:1 E6:1 C6:1 | D6:1 F#6:1 A6:2 | G6:1 D6:1 B5:1 D6:1 | G6:2 -:2`;
  const A_CHORDS = ['G', 'G', 'D', 'D', 'D', 'D', 'G', 'G', 'G', 'G', 'C', 'C', 'D', 'D', 'G', 'G'];
  const B_CHORDS = ['C', 'C', 'G', 'G', 'D', 'D', 'G', 'G', 'C', 'C', 'G', 'G', 'Am', 'D', 'G', 'G'];
  const sec = (chords, lines) => ({ chords, parts: ['oompah'], drums: 'polka', lines });
  song({
    name: 'workshop-polka',
    step: 60 / 126 / 2,
    bar: 4,
    beat: 2,
    chords: {
      G: ['G3', 'B3', 'D4', 'G4'],
      D: ['D3', 'A3', 'D4', 'F#4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      Am: ['A3', 'E4', 'A4', 'C5'],
    },
    sections: [
      { chords: ['G', 'G'], parts: ['oompah'], drums: 'polka' },
      sec(A_CHORDS, [{ ins: marimba, text: A, vol: 0.3 }]),
      sec(B_CHORDS, [{ ins: accordion, text: B, vol: 0.11, shift: -12 }, { ins: marimba, text: B, vol: 0.12 }]),
      sec(A_CHORDS, [{ ins: marimba, text: A, vol: 0.3 }, { ins: accordion, text: A, vol: 0.07, shift: -12 }]),
      sec(B_CHORDS, [{ ins: accordion, text: B, vol: 0.11, shift: -12 }, { ins: marimba, text: B, vol: 0.12 }]),
      { chords: ['G', 'G'], parts: ['oompah'], lines: [{ ins: marimba, text: 'G5:1 D5:1 G5:1 B5:1 | G6:1 -:3', vol: 0.3 }] },
    ],
  });
}

// --------------------------------------------- 3. Firefly Lullaby (slow)

function fireflyLullaby() {
  const A = `
    E5:2 A5:2 C6:2 | B5:4 A5:2 | C6:2 B5:2 A5:2 | F#5:6 |
    A5:2 C6:2 F6:2 | E6:3 D6:1 B5:2 | G5:2 B5:2 E6:2 | A5:6`;
  const B = `
    C6:3 A5:1 F5:2 | E5:2 G5:2 C6:2 | D6:3 B5:1 G5:2 | E6:6 |
    F6:2 E6:2 C6:2 | E6:2 D6:2 C6:2 | D6:2 F#6:2 A5:2 | G#5:6`;
  const A_CHORDS = ['Am', 'D', 'Am', 'D', 'F', 'G', 'Em', 'Am'];
  song({
    name: 'firefly-lullaby',
    step: 60 / 66 / 2,
    bar: 6,
    beat: 2,
    chords: {
      Am: ['A3', 'E4', 'A4', 'C5'],
      D: ['D3', 'A3', 'D4', 'F#4'],
      F: ['F3', 'C4', 'F4', 'A4'],
      G: ['G3', 'D4', 'G4', 'B4'],
      Em: ['E3', 'B3', 'E4', 'G4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      E: ['E3', 'B3', 'E4', 'G#4'],
    },
    sections: [
      { chords: ['Am', 'D'], parts: ['waltz', 'pad'] },
      { chords: A_CHORDS, parts: ['waltz', 'pad'], lines: [{ ins: bell, text: A, vol: 0.3 }] },
      { chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'D', 'E'], parts: ['waltz', 'pad'], lines: [{ ins: flute, text: B, vol: 0.3, shift: -12 }, { ins: bell, text: B, vol: 0.1 }] },
      { chords: A_CHORDS, parts: ['waltz', 'pad'], lines: [{ ins: bell, text: A, vol: 0.3 }, { ins: flute, text: A, vol: 0.14, shift: -12 }] },
      { chords: ['Am'], parts: ['pad'], lines: [{ ins: bell, text: 'A5:1 C6:1 E6:1 A6:3', vol: 0.22 }] },
    ],
    room: { feedback: 0.88, damp: 0.3 },
  });
}

// -------------------------------------------------- 4. Conveyor Jig (upbeat)

function conveyorJig() {
  const A = `
    D5:1 F#5:1 A5:1 D6:1 A5:1 F#5:1 | G5:1 F#5:1 E5:1 D5:3 |
    C5:1 E5:1 G5:1 C6:1 G5:1 E5:1 | F5:1 E5:1 D5:1 C5:3 |
    D5:1 F#5:1 A5:1 B5:1 A5:1 F#5:1 | A5:1 B5:1 C6:1 D6:3 |
    B5:1 A5:1 G5:1 E5:1 G5:1 C6:1 | D6:3 D5:3`;
  const B = `
    B5:2 G5:1 B5:1 D6:1 B5:1 | A5:2 F#5:1 A5:1 D6:1 A5:1 |
    G5:2 E5:1 G5:1 C6:1 G5:1 | F#5:1 G5:1 A5:1 D5:3 |
    D6:1 C6:1 B5:1 G5:1 B5:1 D6:1 | F#6:2 E6:1 D6:3 |
    E6:1 D6:1 C6:1 G5:1 E5:1 C5:1 | D5:3 -:3`;
  const A_CHORDS = ['D', 'D', 'C', 'C', 'D', 'D', 'G|C', 'D'];
  const B_CHORDS = ['G', 'D', 'C', 'D', 'G', 'D', 'C', 'D'];
  const sec = (chords, lines) => ({ chords, parts: ['bassRootFifth', 'strum'], drums: 'jig', lines });
  song({
    name: 'conveyor-jig',
    step: 60 / 116 / 3,
    bar: 6,
    beat: 3,
    chords: {
      D: ['D3', 'A3', 'D4', 'F#4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      G: ['G3', 'D4', 'G4', 'B4'],
    },
    sections: [
      { chords: ['D', 'C'], parts: ['bassRootFifth', 'strum'], drums: 'jig' },
      sec(A_CHORDS, [{ ins: flute, text: A, vol: 0.32 }]),
      sec(A_CHORDS, [{ ins: flute, text: A, vol: 0.3 }, { ins: marimba, text: A, vol: 0.12, shift: -12 }]),
      sec(B_CHORDS, [{ ins: flute, text: B, vol: 0.32 }]),
      sec(B_CHORDS, [{ ins: flute, text: B, vol: 0.3 }, { ins: marimba, text: B, vol: 0.12, shift: -12 }]),
      sec(A_CHORDS, [{ ins: flute, text: A, vol: 0.32 }, { ins: accordion, text: A, vol: 0.05, shift: -12 }]),
      sec(A_CHORDS, [{ ins: flute, text: A, vol: 0.3 }, { ins: marimba, text: A, vol: 0.12, shift: -12 }]),
      { chords: ['D'], parts: ['bassRootFifth'], lines: [{ ins: flute, text: 'D6:3 -:3', vol: 0.32 }] },
    ],
  });
}

// ----------------------------------------------- 5. Deep Woods (slow, dark)

function deepWoods() {
  const A = `
    B4:3 E5:1 G5:4 | F#5:2 E5:2 B4:4 |
    E5:2 F#5:2 G5:2 B5:2 | A5:6 -:2 |
    C6:3 B5:1 A5:2 E5:2 | G5:4 F#5:2 E5:2 |
    E5:2 G5:2 C6:2 B5:2 | B5:6 -:2`;
  const A_END = `
    B4:3 E5:1 G5:4 | F#5:2 E5:2 B4:4 |
    E5:2 F#5:2 G5:2 B5:2 | A5:6 -:2 |
    C6:3 B5:1 A5:2 E5:2 | G5:4 F#5:2 E5:2 |
    E5:2 G5:2 B5:2 D#5:2 | E5:8`;
  const B = `
    G5:2 C6:2 E6:4 | F#6:2 E6:2 D6:4 |
    D6:2 B5:2 F#5:4 | G5:6 -:2 |
    E6:3 D6:1 C6:2 G5:2 | A5:3 B5:1 C6:2 D6:2 |
    D#6:4 B5:4 | F#5:8`;
  song({
    name: 'deep-woods',
    step: 60 / 76 / 2,
    bar: 8,
    beat: 2,
    chords: {
      Em: ['E3', 'B3', 'E4', 'G4'],
      Cmaj7: ['C3', 'G3', 'B3', 'E4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      D: ['D3', 'A3', 'D4', 'F#4'],
      Am: ['A3', 'E4', 'A4', 'C5'],
      Bm: ['B2', 'F#3', 'B3', 'D4'],
      B: ['B2', 'F#3', 'B3', 'D#4'],
    },
    sections: [
      { chords: ['Em'], parts: ['harpSparse', 'padLow'], drums: 'heartbeat' },
      { chords: ['Em', 'Cmaj7', 'Em', 'D', 'Am', 'Em', 'C', 'B'], parts: ['harpSparse', 'padLow'], drums: 'heartbeat', lines: [{ ins: clarinet, text: A, vol: 0.3 }] },
      { chords: ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B'], parts: ['harpSparse', 'padLow', 'bassRootFifth'], drums: 'heartbeat', lines: [{ ins: flute, text: B, vol: 0.28 }] },
      { chords: ['Em', 'Cmaj7', 'Em', 'D', 'Am', 'Em', 'C|B', 'Em'], parts: ['harpSparse', 'padLow'], drums: 'heartbeat', lines: [{ ins: clarinet, text: A_END, vol: 0.3 }] },
      { chords: ['Em'], parts: ['padLow'], lines: [{ ins: harp, text: 'E4:1 B4:1 E5:1 G5:5', vol: 0.15 }] },
    ],
    room: { feedback: 0.9, damp: 0.4 },
  });
}

// -------------------------------------------------- 6. Market Day (upbeat)

function marketDay() {
  const A = `
    C5:1 F5:1 A5:2 G5:1 F5:1 A5:2 | C6:3 A5:1 F5:4 |
    D6:2 C6:1 Bb5:1 A5:2 G5:2 | F5:2 A5:2 C6:4 |
    D6:1 C6:1 A5:2 F5:2 D5:2 | G5:2 Bb5:2 D6:2 C6:2 |
    Bb5:2 A5:1 G5:1 E5:2 G5:2 | F5:6 -:2`;
  const B = `
    F5:2 Bb5:2 D6:2 F6:2 | F6:2 E6:1 D6:1 C6:4 |
    E6:2 G6:2 Bb5:2 G5:2 | A5:6 -:2 |
    D6:2 F6:2 A6:2 F6:2 | E6:2 C#6:2 A5:4 |
    Bb5:2 D6:2 E6:2 G6:2 | F6:4 C6:2 A5:2`;
  const A_CHORDS = ['F', 'F', 'Bb', 'F', 'Dm', 'Gm', 'C7', 'F'];
  const parts = ['bassWalk', 'backbeat'];
  song({
    name: 'market-day',
    step: 60 / 112 / 2,
    bar: 8,
    beat: 2,
    swing: 0.18,
    chords: {
      F: ['F3', 'C4', 'F4', 'A4'],
      Bb: ['Bb2', 'F3', 'Bb3', 'D4'],
      C7: ['C3', 'G3', 'Bb3', 'E4'],
      Dm: ['D3', 'A3', 'D4', 'F4'],
      Gm: ['G3', 'D4', 'G4', 'Bb4'],
      A7: ['A2', 'E3', 'G3', 'C#4'],
    },
    sections: [
      { chords: ['F', 'C7'], parts, drums: 'backbeat' },
      { chords: A_CHORDS, parts, drums: 'backbeat', lines: [{ ins: accordion, text: A, vol: 0.13 }] },
      { chords: A_CHORDS, parts: [...parts, 'marimbaBounce'], drums: 'backbeat', lines: [{ ins: accordion, text: A, vol: 0.13 }] },
      { chords: ['Bb', 'F', 'C7', 'F', 'Dm', 'A7', 'Gm|C7', 'F'], parts: [...parts, 'pad'], drums: 'backbeat', lines: [{ ins: marimba, text: B, vol: 0.3 }, { ins: accordion, text: B, vol: 0.05, shift: -12 }] },
      { chords: A_CHORDS, parts, drums: 'backbeat', lines: [{ ins: accordion, text: A, vol: 0.13 }, { ins: marimba, text: A, vol: 0.1 }] },
      { chords: ['F'], parts: ['pad'], lines: [{ ins: marimba, text: 'C6:1 A5:1 F5:1 C6:1 F6:4', vol: 0.3 }] },
    ],
  });
}

// ---------------------------------------------- 7. Starlit Night (slow, dreamy)

function starlitNight() {
  const A = `
    G5:3 E6:3 | F#6:3 D6:3 | E6:2 D6:1 C6:2 B5:1 | A5:6 |
    C6:3 E6:2 A6:1 | G6:3 E6:3 | F6:2 E6:1 C6:2 A5:1 | D6:6`;
  const B = `
    E5:3 A5:3 | G5:3 B5:3 | A5:2 C6:1 F6:3 | E6:6 |
    F6:3 E6:2 C6:1 | D6:3 B5:3 | A5:3 F#5:3 | G5:6`;
  const A_CHORDS = ['Cmaj7', 'D/C', 'Cmaj7', 'D/C', 'Am', 'Em', 'F', 'G'];
  song({
    name: 'starlit-night',
    step: 60 / 48 / 3,
    bar: 6,
    beat: 3,
    chords: {
      Cmaj7: ['C3', 'G3', 'B3', 'E4'],
      'D/C': ['C3', 'F#3', 'A3', 'D4'],
      Am: ['A3', 'E4', 'A4', 'C5'],
      Em: ['E3', 'B3', 'E4', 'G4'],
      F: ['F3', 'C4', 'F4', 'A4'],
      G: ['G3', 'D4', 'G4', 'B4'],
    },
    sections: [
      { chords: ['Cmaj7', 'D/C'], parts: ['harpArp', 'padLow'] },
      { chords: A_CHORDS, parts: ['harpArp', 'padLow'], lines: [{ ins: bell, text: A, vol: 0.3 }] },
      { chords: ['Am', 'Em', 'F', 'Cmaj7', 'F', 'G', 'D/C', 'G'], parts: ['harpArp', 'padLow', 'bassRootFifth'], lines: [{ ins: flute, text: B, vol: 0.3 }] },
      { chords: A_CHORDS, parts: ['harpArp', 'padLow', 'bassRootFifth'], lines: [{ ins: bell, text: A, vol: 0.28 }, { ins: flute, text: A, vol: 0.14, shift: -12 }] },
      { chords: ['Cmaj7', 'Cmaj7'], parts: ['padLow'], lines: [{ ins: bell, text: 'E6:3 G6:3 | C7:6', vol: 0.22 }] },
    ],
    room: { feedback: 0.9, damp: 0.3 },
  });
}

// ---------------------------------------- 8. Supplies Delivered (the fanfare)

function suppliesDelivered() {
  const A = `
    F5:1 F5:1 F5:1 Bb5:5 | G5:2 Bb5:2 Eb6:4 |
    D6:2 C6:1 Bb5:1 F5:2 Bb5:2 | C6:6 -:2 |
    D6:2 Bb5:2 G5:2 D6:2 | Eb6:3 D6:1 C6:2 Bb5:2 |
    A5:2 C6:2 F6:2 Eb6:2 | D6:8`;
  const B = `
    G5:2 Bb5:2 Eb6:2 G6:2 | F6:4 C6:4 |
    D6:2 G6:2 F6:2 D6:2 | Eb6:6 -:2 |
    C6:2 Eb6:2 G6:2 Eb6:2 | F6:4 A5:4 |
    C6:2 Eb6:2 Ab6:2 G6:2 | F6:6 -:2`;
  const A_CHORDS = ['Bb', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'F', 'Bb'];
  const parts = ['harpArp', 'bassRootFifth', 'pad', 'timp'];
  song({
    name: 'supplies-delivered',
    step: 60 / 108 / 2,
    bar: 8,
    beat: 2,
    chords: {
      Bb: ['Bb2', 'F3', 'Bb3', 'D4'],
      Eb: ['Eb3', 'Bb3', 'Eb4', 'G4'],
      F: ['F3', 'C4', 'F4', 'A4'],
      Gm: ['G3', 'D4', 'G4', 'Bb4'],
      Cm: ['C3', 'G3', 'C4', 'Eb4'],
      Ab: ['Ab2', 'Eb3', 'Ab3', 'C4'],
    },
    sections: [
      { chords: ['F', 'F'], parts: ['pad', 'timp'], drums: 'roll' },
      { chords: A_CHORDS, parts, drums: 'march', lines: [{ ins: brass, text: A, vol: 0.2 }] },
      { chords: ['Eb', 'F', 'Gm', 'Eb', 'Cm', 'F', 'Ab', 'F'], parts: ['harpArp', 'bassRootFifth', 'pad'], drums: 'march', lines: [{ ins: flute, text: B, vol: 0.3 }] },
      { chords: A_CHORDS, parts, drums: 'march', lines: [{ ins: brass, text: A, vol: 0.2 }, { ins: flute, text: A, vol: 0.1, shift: 12 }] },
      { chords: ['Bb', 'Bb'], parts: ['pad', 'timp'], lines: [{ ins: brass, text: 'F5:1 F5:1 F5:1 Bb5:5 | Bb5:8', vol: 0.2 }] },
    ],
  });
}

// ----------------------------------- 9–12. Season interludes (#42, about 20 s)

/** Spring: a bright, rising flute over a harp, in G. */
function springThaw() {
  const A = `
    D5:2 G5:2 B5:3 A5:1 | G5:2 B5:2 D6:4 |
    E6:3 D6:1 B5:2 G5:2 | A5:6 -:2 |
    B5:2 D6:2 G6:3 F#6:1 | E6:2 D6:2 B5:4 |
    C6:2 A5:2 F#5:2 A5:2 | G5:8`;
  song({
    name: 'season-spring',
    step: 60 / 100 / 2,
    bar: 8,
    beat: 2,
    chords: {
      G: ['G3', 'B3', 'D4', 'G4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      D: ['D3', 'A3', 'D4', 'F#4'],
      Em: ['E3', 'B3', 'E4', 'G4'],
    },
    sections: [
      { chords: ['G', 'C', 'Em', 'D', 'G', 'C', 'D', 'G'], parts: ['harpArp', 'bassRootFifth', 'pad'], drums: 'shaker', lines: [{ ins: flute, text: A, vol: 0.34 }] },
      { chords: ['G'], parts: ['pad'], lines: [{ ins: harp, text: 'G5:1 B5:1 D6:1 G6:5', vol: 0.16 }] },
    ],
  });
}

/** Summer: a sunny marimba and accordion with a walking bass, in D. */
function highSummer() {
  const A = `
    F#5:1 A5:1 D6:2 C#6:1 B5:1 A5:2 | B5:3 A5:1 F#5:4 |
    G5:1 B5:1 E6:2 D6:1 C#6:1 B5:2 | A5:6 -:2 |
    F#5:1 A5:1 D6:2 F#6:2 E6:2 | D6:2 B5:2 G5:4 |
    E5:2 G5:2 C#6:2 E6:2 | D6:8`;
  song({
    name: 'season-summer',
    step: 60 / 118 / 2,
    bar: 8,
    beat: 2,
    swing: 0.15,
    chords: {
      D: ['D3', 'A3', 'D4', 'F#4'],
      G: ['G3', 'B3', 'D4', 'G4'],
      A7: ['A2', 'E3', 'G3', 'C#4'],
      Em: ['E3', 'B3', 'E4', 'G4'],
    },
    sections: [
      { chords: ['D', 'D', 'Em', 'A7', 'D', 'G', 'A7', 'D'], parts: ['bassWalk', 'backbeat', 'marimbaBounce'], drums: 'backbeat', lines: [{ ins: accordion, text: A, vol: 0.13 }, { ins: marimba, text: A, vol: 0.1, shift: -12 }] },
      { chords: ['D'], parts: ['pad'], lines: [{ ins: marimba, text: 'A5:1 F#5:1 D5:1 A5:1 D6:4', vol: 0.3 }] },
    ],
  });
}

/** Fall: a wistful clarinet over a slow harp, in A minor. */
function harvestWind() {
  const A = `
    E5:3 A5:1 C6:4 | B5:2 A5:2 E5:4 |
    F5:2 A5:2 D6:2 C6:2 | B5:6 -:2 |
    C6:3 B5:1 A5:2 F5:2 | G5:3 F5:1 E5:4 |
    D5:2 F5:2 B5:2 G#5:2 | A5:8`;
  song({
    name: 'season-fall',
    step: 60 / 92 / 2,
    bar: 8,
    beat: 2,
    chords: {
      Am: ['A2', 'E3', 'A3', 'C4'],
      Dm: ['D3', 'A3', 'D4', 'F4'],
      F: ['F3', 'C4', 'F4', 'A4'],
      C: ['C3', 'G3', 'C4', 'E4'],
      E: ['E3', 'B3', 'E4', 'G#4'],
      G: ['G3', 'B3', 'D4', 'G4'],
    },
    sections: [
      { chords: ['Am', 'Am', 'Dm', 'E', 'F', 'C', 'Dm|E', 'Am'], parts: ['harpSparse', 'padLow', 'bassRootFifth'], drums: 'heartbeat', lines: [{ ins: clarinet, text: A, vol: 0.3 }] },
      { chords: ['Am'], parts: ['padLow'], lines: [{ ins: harp, text: 'A4:1 C5:1 E5:1 A5:5', vol: 0.15 }] },
    ],
    room: { feedback: 0.88, damp: 0.4 },
  });
}

/** Winter: slow bells over still strings, in E minor. */
function firstFrost() {
  const A = `
    B5:3 G5:1 E5:4 | F#5:2 G5:2 A5:4 |
    G5:3 E5:1 C6:4 | B5:6 -:2 |
    E6:3 D6:1 B5:4 | C6:3 A5:1 F#5:4`;
  song({
    name: 'season-winter',
    step: 60 / 74 / 2,
    bar: 8,
    beat: 2,
    chords: {
      Em: ['E3', 'B3', 'E4', 'G4'],
      Cmaj7: ['C3', 'G3', 'B3', 'E4'],
      D: ['D3', 'A3', 'D4', 'F#4'],
      B7: ['B2', 'F#3', 'A3', 'D#4'],
      Am: ['A3', 'E4', 'A4', 'C5'],
    },
    sections: [
      { chords: ['Em', 'Cmaj7', 'Am', 'B7', 'Em', 'Am|B7'], parts: ['harpSparse', 'padLow'], lines: [{ ins: bell, text: A, vol: 0.3 }] },
      { chords: ['Em'], parts: ['padLow'], lines: [{ ins: bell, text: 'E5:2 B5:2 E6:4', vol: 0.22 }] },
    ],
    room: { feedback: 0.92, damp: 0.3 },
  });
}

export const TRACKS = {
  'morning-clearing': morningClearing,
  'workshop-polka': workshopPolka,
  'firefly-lullaby': fireflyLullaby,
  'conveyor-jig': conveyorJig,
  'deep-woods': deepWoods,
  'market-day': marketDay,
  'starlit-night': starlitNight,
  'supplies-delivered': suppliesDelivered,
  'season-spring': springThaw,
  'season-summer': highSummer,
  'season-fall': harvestWind,
  'season-winter': firstFrost,
};
