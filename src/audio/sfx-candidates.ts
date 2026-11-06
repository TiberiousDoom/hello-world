// Takes on sounds no version has won yet, for the sound board (#214); the game doesn't play them. The winner
// of each moves into sfx-realistic.ts (or sfx-enhanced.ts) and GAME_SOUNDS, and leaves this file.
// Round 4: the railgun. The owner liked "Charge and fire" (round 3) but wants the charge to be a deep suction.

import { Layer, noise, Sound, tone } from './sfx';

export interface Candidate {
  name: string;
  /** What it's going for, in a few words. */
  what: string;
  /** Its layers, made fresh for each play (some are random). */
  layers: () => Layer[];
  /** Its level, matched to the classic sound's (measured on the board). */
  level?: number;
}

/** The railgun's shot after its charge: a supersonic crack, a thump and a short tail, starting at `at`. */
function railFire(at: number): Layer[] {
  return [noise('highpass', 6000, 3000, 0.02, 0.6, 0.7, at, 0.001), tone('sine', 100, 40, 0.18, 0.5, at, 0.002), noise('lowpass', 1200, 150, 0.4, 0.15, 0.7, at + 0.02, 0.02)];
}

export const CANDIDATES: Partial<Record<Sound, Candidate[]>> = {
  rail: [
    {
      name: 'Charge and fire',
      what: 'Round 3’s take, as you heard it: a rising whine, then the crack',
      level: 0.37,
      layers: () => [tone('sine', 600, 3200, 0.2, 0.08, 0, 0.15), tone('sine', 1200, 6400, 0.2, 0.03, 0, 0.15), ...railFire(0.2)],
    },
    {
      name: 'Deep inhale',
      what: 'Air rushing in low and getting faster, cut off by the crack',
      level: 0.25,
      layers: () => [noise('lowpass', 80, 900, 0.32, 0.5, 1.2, 0, 0.3), tone('sine', 38, 110, 0.32, 0.3, 0, 0.3), ...railFire(0.32)],
    },
    {
      name: 'Vacuum pull',
      what: 'A heavier, longer pull with a growl in it, like the coils draining the air',
      level: 0.23,
      layers: () => [
        noise('bandpass', 180, 1400, 0.42, 0.45, 3, 0, 0.4),
        tone('sawtooth', 45, 90, 0.42, 0.08, 0, 0.4),
        tone('sawtooth', 46, 92, 0.42, 0.06, 0, 0.4),
        tone('sine', 30, 80, 0.42, 0.3, 0, 0.4),
        ...railFire(0.42),
      ],
    },
    {
      name: 'Implosion',
      what: 'A short, deep suck like the air folding in, then the crack and a boom',
      level: 0.2,
      layers: () => [
        noise('lowpass', 60, 2000, 0.2, 0.55, 0.9, 0, 0.19),
        tone('sine', 25, 70, 0.2, 0.4, 0, 0.19),
        ...railFire(0.2),
        noise('lowpass', 800, 70, 0.7, 0.3, 0.7, 0.22, 0.01),
        tone('sine', 55, 25, 0.5, 0.35, 0.22, 0.005),
      ],
    },
  ],
};
