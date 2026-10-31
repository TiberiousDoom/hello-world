// Day, night and the seasons (#42, D-068). All of it follows from game time, so
// it's saved with the game and the same in every co-op game. Players can't turn
// it off. A game starts on the first morning of spring.

import { CLOCK, Season } from './data';

export interface Clock {
  /** Days since the game began, from 1. */
  day: number;
  season: Season;
  /** Day within the season, from 1. */
  seasonDay: number;
  night: boolean;
  /** How far through the day (or the night), 0 to 1. */
  part: number;
}

const DAY = CLOCK.day + CLOCK.night;
const YEAR = CLOCK.seasons.reduce((sum, s) => sum + s.days, 0) * DAY;

export function clockAt(time: number): Clock {
  const t = Math.max(0, time);
  const day = Math.floor(t / DAY) + 1;
  const into = t - (day - 1) * DAY;
  const night = into >= CLOCK.day;
  const part = night ? (into - CLOCK.day) / CLOCK.night : into / CLOCK.day;
  let d = Math.floor((t % YEAR) / DAY);
  let season = CLOCK.seasons[0];
  for (const s of CLOCK.seasons) {
    if (d < s.days) {
      season = s;
      break;
    }
    d -= s.days;
  }
  return { day, season, seasonDay: d + 1, night, part };
}

/**
 * How dark it is, 0 (day) to 1 (deep night), for drawing: dusk and dawn each take
 * CLOCK.twilight seconds at the ends of the night.
 */
export function darkness(time: number): number {
  const into = Math.max(0, time) % DAY;
  if (into < CLOCK.day - CLOCK.twilight) return 0;
  if (into < CLOCK.day) return (into - (CLOCK.day - CLOCK.twilight)) / CLOCK.twilight;
  if (into < DAY - CLOCK.twilight) return 1;
  return (DAY - into) / CLOCK.twilight;
}

/**
 * How the land looks (D-111, D-152): the four seasons, plus the end of fall, when the broadleaf trees are
 * down to their last leaves and leaves cover the ground.
 */
export type Look = Season['id'] | 'late';

/**
 * How far the land has turned from one look to the next (D-111, D-152). Over the last CLOCK.turn days of
 * a season it turns to the next season's look, except that fall turns to `late` (the leaves fall), and
 * winter's snow settles over its first CLOCK.snow days and melts over its last CLOCK.snow days, so it lies
 * full for a while in between. Otherwise `shift` is 0.
 * Only the look follows it; the rules change on the day the season does.
 */
export function seasonTurn(time: number): { look: Look; next: Look; shift: number } {
  const t = Math.max(0, time) % YEAR;
  let start = 0;
  for (let i = 0; i < CLOCK.seasons.length; i++) {
    const s = CLOCK.seasons[i];
    const end = start + s.days * DAY;
    if (t < end) {
      const span = (s.id === 'winter' ? CLOCK.snow : CLOCK.turn) * DAY;
      if (s.id === 'winter' && t < start + span) return { look: 'late', next: 'winter', shift: (t - start) / span };
      const next = s.id === 'fall' ? 'late' : CLOCK.seasons[(i + 1) % CLOCK.seasons.length].id;
      return { look: s.id, next, shift: Math.min(1, Math.max(0, (t - (end - span)) / span)) };
    }
    start = end;
  }
  return { look: CLOCK.seasons[0].id, next: CLOCK.seasons[1].id, shift: 0 };
}
