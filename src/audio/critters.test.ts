import { describe, expect, it } from 'vitest';
import { CLOCK } from '../sim/data';
import { chorus } from './critters';

const DAY = CLOCK.day + CLOCK.night;
/** A game time on a day of the year (from 0), at a part of the day or of the night. */
const at = (day: number, part: number, night = false) => day * DAY + (night ? CLOCK.day + part * CLOCK.night : part * CLOCK.day);

describe('Critters (D-101)', () => {
  it('birds sing in the morning, insects in the evening, frogs at night', () => {
    const summer = 4;
    const morning = chorus(at(summer, 0.15));
    const evening = chorus(at(summer, 0.92));
    const night = chorus(at(summer, 0.3, true));
    expect(morning.bird).toBeGreaterThan(evening.bird);
    expect(morning.cricket).toBe(0);
    expect(evening.cicada).toBeGreaterThan(0.5);
    expect(evening.cricket).toBeGreaterThan(0.5);
    expect(night.frog).toBe(0.8);
    expect(night.bird).toBe(0);
  });

  it('fade through fall to almost nothing in winter', () => {
    const early = chorus(at(6, 0.3, true));
    const late = chorus(at(9, 0.3, true));
    expect(late.cricket).toBeLessThan(early.cricket);
    const winter = [chorus(at(10, 0.15)), chorus(at(10, 0.92)), chorus(at(11, 0.3, true))];
    for (const c of winter) {
      expect(c.cricket + c.katydid + c.cicada + c.frog).toBe(0);
      expect(c.bird).toBeLessThan(0.2);
    }
  });
});
