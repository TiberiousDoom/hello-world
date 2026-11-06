// Round 3 of the sound board (#214): new takes on the five sounds no version has won yet, three each in
// different directions. The board plays them; the game doesn't. The winner of each moves into
// sfx-realistic.ts (or sfx-enhanced.ts) and GAME_SOUNDS, and this file empties.

import { Layer, noise, Sound, tone } from './sfx';
import { arp, fat, grit, pulse, punch } from './sfx-enhanced';
import { crackle, ring } from './sfx-realistic';

export interface Candidate {
  name: string;
  /** What it's going for, in a few words. */
  what: string;
  /** Its layers, made fresh for each play (some are random). */
  layers: () => Layer[];
  /** Its level, matched to the classic sound's (measured on the board). */
  level?: number;
}

export const CANDIDATES: Partial<Record<Sound, Candidate[]>> = {
  shot: [
    {
      name: 'Nail gun',
      what: 'A pneumatic punch: a sharp hiss-thunk, like a nail gun',
      level: 0.37,
      layers: () => [
        noise('highpass', 7000, 4000, 0.05, 0.35, 0.7, 0, 0.001),
        tone('sine', 220, 70, 0.06, 0.5, 0, 0.001),
        ...ring(2100, 0.05, 0.08),
        noise('highpass', 5000, 3000, 0.1, 0.07, 0.7, 0.05, 0.02),
      ],
    },
    {
      name: 'Heavy piston',
      what: 'A big, slow clunk of steel on steel, then the hydraulics sigh',
      level: 0.16,
      layers: () => [
        tone('sine', 110, 45, 0.16, 0.6, 0, 0.002),
        ...ring(520, 0.22, 0.14),
        noise('lowpass', 1500, 300, 0.08, 0.3, 0.8, 0, 0.002),
        noise('bandpass', 2500, 1200, 0.3, 0.08, 1, 0.08, 0.06),
      ],
    },
    {
      name: 'Plate flung',
      what: 'A spring-loaded snap, and the plate whirring off as it spins',
      level: 0.38,
      layers: () => [
        noise('bandpass', 1800, 1400, 0.02, 0.4, 2, 0, 0.001),
        tone('triangle', 900, 700, 0.04, 0.2, 0, 0.001),
        ...Array.from({ length: 6 }, (_, i) => noise('bandpass', 1500 - i * 120, 1400 - i * 120, 0.025, 0.14 * (1 - i / 7), 4, 0.03 + i * 0.03, 0.003)),
        tone('sine', 160, 90, 0.05, 0.3, 0, 0.002),
      ],
    },
  ],
  zap: [
    {
      name: 'Jacob’s ladder',
      what: 'A buzzing arc that crawls and crackles, like a spark climbing two wires',
      level: 1.29,
      layers: () => [fat(tone('sawtooth', 120, 120, 0.35, 0.05, 0, 0.01), 20), noise('bandpass', 2000, 4500, 0.35, 0.12, 3, 0, 0.02), ...crackle(18, 0.33, 3000, 0.25, 0, 1.5)],
    },
    {
      name: 'Lightning crack',
      what: 'A real lightning strike in small: a whip-crack and a short roll of thunder',
      level: 0.45,
      layers: () => [
        noise('highpass', 7000, 3500, 0.015, 0.7, 0.7, 0, 0.001),
        ...crackle(6, 0.04, 5000, 0.45, 0, 1),
        noise('lowpass', 900, 90, 0.5, 0.25, 0.7, 0.03, 0.03),
        tone('sine', 70, 35, 0.4, 0.2, 0.03, 0.02),
      ],
    },
    {
      name: 'Tesla coil',
      what: 'A tesla coil’s harsh, fizzing tone: an electric buzz with a pitch to it',
      level: 1.14,
      layers: () => [fat(pulse(0.125, 440, 400, 0.22, 0.08), 30), fat(tone('sawtooth', 880, 800, 0.18, 0.04), -25), grit('highpass', 5000, 3000, 0.22, 0.2, 0.8), ...crackle(8, 0.2, 4000, 0.2)],
    },
  ],
  rail: [
    {
      name: 'Charge and fire',
      what: 'A quick rising whine, then the crack (the shot is heard a fifth of a second late)',
      level: 0.37,
      layers: () => [
        tone('sine', 600, 3200, 0.2, 0.08, 0, 0.15),
        tone('sine', 1200, 6400, 0.2, 0.03, 0, 0.15),
        noise('highpass', 6000, 3000, 0.02, 0.6, 0.7, 0.2, 0.001),
        tone('sine', 100, 40, 0.18, 0.5, 0.2, 0.002),
        noise('lowpass', 1200, 150, 0.4, 0.15, 0.7, 0.22, 0.02),
      ],
    },
    {
      name: 'Magnetic thump',
      what: 'A deep electric "vwoom" and a hard knock: heavy rather than sharp',
      level: 0.24,
      layers: () => [
        tone('sawtooth', 60, 160, 0.12, 0.15, 0, 0.01),
        tone('sine', 140, 40, 0.3, 0.6, 0.02, 0.002),
        noise('lowpass', 2000, 120, 0.35, 0.35, 0.8, 0.02, 0.002),
        noise('highpass', 4000, 2000, 0.03, 0.3, 0.7, 0.02, 0.001),
      ],
    },
    {
      name: 'Sci-fi',
      what: 'The film railgun: a falling electric "pew" over a boom',
      level: 0.27,
      layers: () => [
        fat(tone('sawtooth', 2400, 300, 0.25, 0.08, 0, 0.002), 15),
        tone('sine', 1800, 200, 0.3, 0.12, 0, 0.002),
        tone('sine', 90, 35, 0.3, 0.5, 0, 0.002),
        noise('lowpass', 1500, 100, 0.4, 0.25, 0.8, 0, 0.003),
      ],
    },
  ],
  hub_hit: [
    {
      name: 'Chomp',
      what: 'Mandibles biting in: a crunchy, chittering bite, no metal',
      layers: () => [...crackle(6, 0.06, 2600, 0.35, 0, 3), noise('bandpass', 1200, 600, 0.08, 0.35, 2, 0.02, 0.003), tone('sine', 180, 110, 0.07, 0.2, 0.02, 0.003)],
    },
    {
      name: 'Dull thud',
      what: 'A blow on a heavy, armoured wall: a low thud and a small rattle',
      level: 0.32,
      layers: () => [tone('sine', 95, 50, 0.18, 0.55, 0, 0.002), noise('lowpass', 900, 150, 0.15, 0.35, 0.8, 0, 0.002), ...crackle(4, 0.15, 1400, 0.1, 0.04)],
    },
    {
      name: 'Warning hit',
      what: 'A thud with a short, low warning beep, so you notice the hub is under attack',
      level: 0.37,
      layers: () => [tone('sine', 110, 55, 0.14, 0.5, 0, 0.002), noise('lowpass', 1100, 200, 0.1, 0.3, 0.8, 0, 0.002), pulse(0.25, 330, 330, 0.1, 0.07, 0.08), pulse(0.25, 262, 262, 0.14, 0.07, 0.19)],
    },
  ],
  launch: [
    {
      name: 'Big rocket',
      what: 'A real rocket: a deep roar you feel more than hear, building and then drifting away',
      level: 0.31,
      layers: () => [
        noise('lowpass', 120, 900, 2.2, 0.9, 0.7, 0, 1),
        tone('sine', 32, 45, 2.2, 0.5, 0, 0.8),
        noise('lowpass', 900, 200, 1.6, 0.6, 0.7, 2.0, 0.1),
        ...crackle(25, 2.6, 900, 0.12, 0.4, 1),
      ],
    },
    {
      name: 'Steam liftoff',
      what: 'Steam vents with a hiss, the engines thrum faster, and it whooshes up and away',
      level: 0.49,
      layers: () => [
        noise('highpass', 3000, 1500, 0.8, 0.35, 0.7, 0, 0.02),
        ...Array.from({ length: 14 }, (_, i) => noise('lowpass', 500, 300, 0.12, 0.3, 1, 0.5 + i * (0.16 - i * 0.006), 0.01)),
        noise('bandpass', 600, 3000, 1.6, 0.4, 1, 1.6, 0.6),
        tone('sine', 55, 35, 2.5, 0.3, 0.5, 0.6),
      ],
    },
    {
      name: 'Retro rocket',
      what: 'A game-console take: a rising noise sweep, a rumble and a fanfare at the end',
      level: 0.39,
      layers: () => [
        grit('lowpass', 200, 3000, 2.6, 0.7, 1, 0, 1.4),
        punch(70, 30, 0.8, 0.5),
        fat(tone('sawtooth', 50, 120, 2.6, 0.12, 0, 1.4), 12),
        ...arp(0.25, [523, 659, 784, 1047], 0.1, 0.25, 0.06, 2.5),
        fat(pulse(0.125, 1319, 1319, 0.6, 0.05, 2.9), 8),
      ],
    },
  ],
};
