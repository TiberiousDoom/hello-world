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
