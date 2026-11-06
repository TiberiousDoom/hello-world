// Takes on sounds no version has won yet, for the sound board (#214); the game doesn't play them. The winner
// of each moves into sfx-realistic.ts (or sfx-enhanced.ts) and GAME_SOUNDS, and leaves this file.
// Empty since round 4 (D-185): every sound has a pick. Add takes here to try new ones on the board.

import { Layer, Sound } from './sfx';

export interface Candidate {
  name: string;
  /** What it's going for, in a few words. */
  what: string;
  /** Its layers, made fresh for each play (some are random). */
  layers: () => Layer[];
  /** Its level, matched to the classic sound's (measured on the board). */
  level?: number;
}

export const CANDIDATES: Partial<Record<Sound, Candidate[]>> = {};
