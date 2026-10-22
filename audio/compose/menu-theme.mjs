// The main menu theme (D-051): an original tune in the style of late-90s 3D
// adventure games. A breathy, ocarina-like flute carries the melody over
// plucked harp, pizzicato bass, marimba and soft strings, in a lilting 6/8 and
// the F Lydian mode (its raised fourth sounds a little magical).
//
// Rendered by `node audio/compose/render.mjs menu-theme` (or with no name, every track).

import { createTrack, flute, harp, marimba, midi, phrase, pizz, render, shaker, strings } from './lib.mjs';

const EIGHTH = 60 / (64 * 3); // 6/8 at 64 dotted quarters a minute
const BAR = 6; // eighths per bar

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

export default function menuTheme() {
  const events = [];
  let bar = 0;
  for (const sec of SECTIONS) {
    sec.chords.forEach((name, i) => {
      const v = CHORDS[name].map(midi);
      const at = (bar + i) * BAR;
      const lastBar = sec.last && i === sec.chords.length - 1;
      // Harp: up and back down the chord in eighths; on the very last bar, one slow roll.
      if (sec.harp) {
        if (lastBar) v.forEach((m, k) => events.push({ ins: harp, m: m + 12, at: at + k * 0.5, len: 6, vol: 0.16 }));
        else [0, 1, 2, 3, 2, 1].forEach((k, s) => events.push({ ins: harp, m: v[k] + 12, at: at + s, len: 2, vol: s === 0 ? 0.17 : 0.13 }));
      }
      // Pizzicato bass on the two beats of the bar: root, then fifth.
      events.push({ ins: pizz, m: v[0] - 12, at, len: 2, vol: 0.32 });
      if (!lastBar) events.push({ ins: pizz, m: v[1] - 12, at: at + 3, len: 2, vol: 0.24 });
      if (sec.strings) events.push({ ins: strings, chord: v.slice(1), at, len: BAR, vol: lastBar ? 0.05 : 0.045 });
      if (sec.shaker) for (let s = 0; s < BAR; s++) events.push({ ins: shaker, at: at + s, vol: s % 3 === 0 ? 0.035 : 0.018 });
    });
    if (sec.melody) for (const n of phrase(sec.melody, bar, BAR)) events.push({ ins: flute, ...n, vol: 0.34 });
    if (sec.marimba) for (const n of phrase(sec.marimba, bar, BAR)) events.push({ ins: marimba, ...n, vol: 0.14 });
    bar += sec.chords.length;
  }

  const tr = createTrack({ step: EIGHTH, steps: bar * BAR });
  for (const e of events) e.ins(tr, e);
  render(tr, 'menu-theme');
}
