// Enhanced sound effects (#214): the same retro sounds, built a little richer. Each keeps its classic
// recipe's shape (the same pitches, lengths and feel) and adds what old consoles did well:
// - narrow pulse waves (25% and 12.5%) in place of plain squares, thinner and less harsh;
// - coarse "chip" noise for hits, crumbles and sparks;
// - a short pitch-drop punch under impacts, and a second, slightly detuned voice for body;
// - arpeggios for the jingles (research, a new stage, a ping);
// - a small pitch change on every play of a busy sound (VARY), so a fight isn't one sample on a loop.
// Sfx adds a compressor and a quiet room echo for this style. The sound board (`npm run soundboard`)
// plays each sound every way; GAME_SOUNDS in sfx.ts holds the owner's picks.

import { birdCall, Layer, noise, recipe, Sound, tone } from './sfx';

/** How far (a fraction) a sound's pitch may wander from play to play, in the enhanced style. */
export const VARY: Partial<Record<Sound, number>> = {
  belt: 0.04,
  place: 0.03,
  chop: 0.06,
  pick: 0.06,
  shot: 0.07,
  gun: 0.05,
  hub_shot: 0.05,
  cannon: 0.04,
  mortar: 0.04,
  artillery: 0.03,
  rail: 0.03,
  treb: 0.04,
  twang: 0.05,
  zap: 0.05,
  death: 0.1,
  destroyed: 0.04,
};

/**
 * Each enhanced sound's level, matched to its classic one (measured as the loudest moment, in Chromium), so the
 * board compares sounds rather than volumes.
 */
export const LEVEL: Partial<Record<Sound, number>> = {
  click: 4.07,
  place: 0.77,
  place_big: 0.77,
  demolish: 0.21,
  error: 0.86,
  chop: 0.51,
  pick: 0.85,
  pick_done: 0.32,
  ping: 2.66,
  shot: 0.6,
  twang: 0.64,
  hub_shot: 0.71,
  cannon: 0.72,
  death: 0.61,
  provoked: 0.58,
  destroyed: 0.88,
  hub_hit: 0.5,
  breach: 0.78,
  research: 1.41,
  stage: 0.67,
  launch: 0.41,
  gun: 0.6,
  mortar: 0.72,
  artillery: 0.72,
  treb: 0.64,
};

/** A pulse-wave note. */
export const pulse = (duty: 0.25 | 0.125, from: number, to: number, dur: number, peak: number, at = 0, attack?: number): Layer => ({
  ...tone('square', from, to, dur, peak, at, attack),
  pulse: duty,
});
/** A note with a second voice `cents` sharp. */
export const fat = (l: Layer, cents: number): Layer => ({ ...l, detune: cents });
/** Coarse noise. */
export const grit = (filter: BiquadFilterType, from: number, to: number, dur: number, peak: number, q = 0.8, at = 0, attack?: number): Layer => ({
  ...noise(filter, from, to, dur, peak, q, at, attack),
  grit: true,
});
/** A short pitch drop under an impact, felt more than heard. */
export const punch = (from: number, to: number, dur: number, peak: number, at = 0): Layer => tone('sine', from, to, dur, peak, at, 0.002);
/** Notes one after another, `step` seconds apart. */
export const arp = (duty: 0.25 | 0.125, freqs: number[], step: number, dur: number, peak: number, at = 0): Layer[] => freqs.map((f, i) => pulse(duty, f, f, dur, peak, at + i * step));

export function enhancedRecipe(sound: Sound): Layer[] {
  switch (sound) {
    case 'click':
      return [pulse(0.125, 1800, 1500, 0.03, 0.16), tone('triangle', 900, 900, 0.025, 0.08)];
    case 'belt':
      return [pulse(0.25, 520, 400, 0.035, 0.06), grit('highpass', 3000, 3000, 0.03, 0.07)];
    case 'place':
      // A clunk, then a two-note blip: it's in.
      return [punch(170, 55, 0.16, 0.6), grit('bandpass', 1600, 800, 0.05, 0.22, 1), ...arp(0.25, [660, 990], 0.05, 0.06, 0.06, 0.05)];
    case 'place_big':
      return [punch(120, 38, 0.32, 0.72), grit('lowpass', 900, 200, 0.16, 0.35), ...arp(0.25, [440, 554, 660], 0.06, 0.08, 0.06, 0.08)];
    case 'demolish':
      return [grit('bandpass', 1400, 180, 0.3, 0.42, 1.2), fat(tone('sawtooth', 260, 70, 0.22, 0.07), 14), grit('lowpass', 800, 150, 0.2, 0.2, 0.8, 0.08), punch(110, 45, 0.15, 0.35)];
    case 'chop':
      // A thunk into wood, then the creak and swish of the tree going over.
      return [punch(260, 120, 0.06, 0.4), grit('bandpass', 1200, 700, 0.05, 0.3, 2), pulse(0.125, 190, 120, 0.22, 0.035, 0.12, 0.04), noise('lowpass', 700, 180, 0.3, 0.16, 0.8, 0.14)];
    case 'pick':
      // A pickaxe on rock: a hard clink with a ring above it.
      return [pulse(0.125, 2200, 1800, 0.05, 0.14), tone('triangle', 3300, 3200, 0.06, 0.06), grit('highpass', 3500, 2500, 0.04, 0.22, 1), punch(240, 140, 0.05, 0.22)];
    case 'pick_done':
      return [grit('lowpass', 1200, 300, 0.18, 0.35), ...arp(0.25, [660, 880, 1320], 0.05, 0.1, 0.07, 0.05)];
    case 'error':
      return [fat(pulse(0.25, 196, 196, 0.09, 0.09), 12), fat(pulse(0.25, 147, 147, 0.14, 0.09, 0.11), 12)];
    case 'shot':
    case 'gun':
      return [grit('highpass', 2800, 1600, 0.05, 0.2), pulse(0.25, 1000, 280, 0.05, 0.06), punch(200, 80, 0.04, 0.16)];
    case 'hub_shot':
      return [fat(tone('sawtooth', 1100, 250, 0.1, 0.07), 12), pulse(0.125, 2200, 500, 0.08, 0.04), grit('highpass', 1800, 1800, 0.05, 0.16)];
    case 'cannon':
    case 'mortar':
    case 'artillery':
      return [punch(120, 34, 0.4, 0.75), grit('lowpass', 1600, 120, 0.38, 0.5), pulse(0.25, 90, 40, 0.15, 0.1)];
    case 'twang':
    case 'treb':
      // A bowstring: the pluck with its buzz, and the thud of the bolt leaving.
      return [tone('triangle', 340, 180, 0.2, 0.3), pulse(0.125, 680, 360, 0.12, 0.05), tone('sine', 170, 120, 0.2, 0.18), grit('lowpass', 900, 300, 0.06, 0.22)];
    case 'zap':
    case 'rail':
      return [
        grit('highpass', 4200, 2500, 0.12, 0.28, 1.5),
        fat(tone('sawtooth', 1500, 300, 0.1, 0.06), 25),
        noise('bandpass', 2500, 900, 0.08, 0.2, 4, 0.03),
        pulse(0.125, 3000, 800, 0.06, 0.04, 0.02),
      ];
    case 'death':
      // A squish and a falling squeak.
      return [grit('bandpass', 1700, 350, 0.14, 0.46, 3), pulse(0.25, 520, 150, 0.09, 0.1)];
    case 'destroyed':
      return [grit('lowpass', 2200, 150, 0.45, 0.6), punch(90, 32, 0.42, 0.68), grit('bandpass', 3000, 1500, 0.2, 0.22, 2, 0.05), pulse(0.25, 300, 60, 0.3, 0.08, 0.04)];
    case 'hub_hit':
      // A clang: two voices close together beat like struck metal.
      return [fat(tone('triangle', 330, 318, 0.3, 0.14), 9), tone('sine', 812, 800, 0.22, 0.09), tone('sine', 1230, 1215, 0.18, 0.04), grit('bandpass', 2000, 1200, 0.05, 0.15)];
    case 'breach':
      return [punch(80, 28, 1.2, 0.6), grit('lowpass', 2500, 100, 1, 0.42), ...[0.15, 0.4, 0.65, 0.9].map((at, i) => pulse(0.25, i % 2 ? 440 : 660, i % 2 ? 440 : 660, 0.22, 0.08, at))];
    case 'research':
      // A rising arpeggio, the last note held with a chorus on it.
      return [...arp(0.25, [523, 659, 784, 1047], 0.07, 0.12, 0.1), fat(pulse(0.125, 1319, 1319, 0.45, 0.07, 0.28), 8), ...[262, 330, 392].map((f, i) => tone('triangle', f, f, 0.2, 0.08, i * 0.14))];
    case 'stage':
      return [tone('triangle', 587, 587, 0.3, 0.2), tone('triangle', 880, 880, 0.5, 0.2, 0.14), fat(pulse(0.125, 1175, 1175, 0.4, 0.05, 0.14), 7), tone('sine', 440, 440, 0.6, 0.1, 0.14)];
    case 'provoked': {
      // Angry chittering, each chirp a little off, over a low, uneasy drone.
      const chirps = [0, 1, 2, 3, 4, 5, 6].map((i) => pulse(0.125, 380 + ((i * 53) % 140), 250, 0.06, 0.12, i * 0.065, 0.003));
      return [...chirps, fat(tone('sawtooth', 70, 95, 0.6, 0.12, 0, 0.1), 18)];
    }
    case 'ignite':
    case 'launch':
      return [grit('lowpass', 150, 1800, 3.5, 0.9, 0.8, 0, 2), fat(tone('sawtooth', 45, 180, 3.5, 0.18, 0, 2), 10), ...arp(0.25, [392, 523, 659, 784], 0.12, 0.2, 0.05, 2.6)];
    case 'ping':
      // Two bright blips, rising, and a quiet echo of them.
      return [pulse(0.125, 1320, 1320, 0.1, 0.12), pulse(0.125, 1760, 1760, 0.14, 0.12, 0.1), pulse(0.125, 1320, 1320, 0.08, 0.035, 0.3), pulse(0.125, 1760, 1760, 0.1, 0.035, 0.4)];
    // The critters are already natural sounds; they stay as they are.
    case 'bird':
      return birdCall();
    case 'cricket':
    case 'katydid':
    case 'cicada':
    case 'frog':
      return recipe(sound);
  }
}
