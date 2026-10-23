import { describe, expect, it } from 'vitest';
import { CLOCK, LUMBER, NESTS, RESEARCH } from './data';
import { clockAt, darkness } from './clock';
import { cellKey, newNest, nestCentre } from './nests';
import { TICK, TREE, World } from './world';

const DAY = CLOCK.day + CLOCK.night;

describe('Day, night and seasons (#42)', () => {
  it('a game starts on a spring morning; days are 6 minutes and nights 3', () => {
    expect(clockAt(0)).toMatchObject({ day: 1, night: false, seasonDay: 1 });
    expect(clockAt(0).season.id).toBe('spring');
    expect(clockAt(CLOCK.day - 1).night).toBe(false);
    expect(clockAt(CLOCK.day).night).toBe(true);
    expect(clockAt(DAY)).toMatchObject({ day: 2, night: false, seasonDay: 2 });
  });

  it('runs through a 12-day year: 4 days of spring, 2 of summer, 4 of fall, 2 of winter', () => {
    const seasonOn = (day: number) => clockAt((day - 1) * DAY + 1).season.id;
    expect([1, 4, 5, 6, 7, 10, 11, 12, 13].map(seasonOn)).toEqual(['spring', 'spring', 'summer', 'summer', 'fall', 'fall', 'winter', 'winter', 'spring']);
    expect(clockAt(6 * DAY + 1).seasonDay).toBe(1); // the first day of fall
  });

  it('darkens over dusk and lightens over dawn', () => {
    expect(darkness(10)).toBe(0);
    expect(darkness(CLOCK.day - CLOCK.twilight / 2)).toBeCloseTo(0.5);
    expect(darkness(CLOCK.day + 60)).toBe(1);
    expect(darkness(DAY - CLOCK.twilight / 2)).toBeCloseTo(0.5);
  });

  it('announces nightfall, morning and a new season', () => {
    const w = World.create(2);
    w.state.time = CLOCK.day - TICK / 2;
    w.tick();
    expect(w.events).toContain('Night falls. Bugs range further in the dark.');
    w.state.time = 4 * DAY - TICK / 2;
    w.tick();
    expect(w.events.some((e) => e.startsWith('Summer has come.'))).toBe(true);
  });

  it('bugs chase further at night', () => {
    const w = World.create(1);
    w.state.researched = RESEARCH.map((r) => r.id);
    w.state.resources.fill(0);
    w.state.trees.fill(0);
    w.state.nests = [];
    w.state.enemies = [];
    w.nestCells.clear();
    w.state.inventory = { stone: 999, brick: 999, iron_plate: 999 };
    const n = newNest(0, 50, 50, 0);
    w.state.nests.push(n);
    w.nestCells.set(cellKey(5, 5), n);
    w.spawnBug('crawler', n, 1);
    const [cx, cy] = nestCentre(n);
    const wall = w.place('wall', Math.round(cx) + NESTS.leash + 4, Math.round(cy), 0);
    if (typeof wall === 'string') throw new Error(wall);
    w.state.time = CLOCK.day + 1; // night
    n.angryUntil = w.state.time + 60;
    w.markFlowDirty();
    for (let t = 0; t < 40; t += TICK) w.tick();
    expect(wall.hp).toBeLessThan(w.maxHp(wall));
  });

  it('stumps grow back faster in summer than in winter', () => {
    const regrowTime = (time: number) => {
      const w = World.create(3);
      w.state.time = time;
      w.state.inventory = { plank: 99, iron_plate: 99 };
      w.state.researched = RESEARCH.map((r) => r.id);
      const hub = w.hub!;
      const [x, y] = [hub.x - 12, hub.y];
      w.state.trees.fill(0);
      w.state.trees[w.idx(x + 3, y)] = TREE;
      const camp = w.place('lumber_camp', x, y, 0);
      if (typeof camp === 'string') throw new Error(camp);
      for (let t = 0; t < LUMBER.period + 1; t += TICK) w.tick();
      return w.state.regrow[w.idx(x + 3, y)] - time;
    };
    const summer = regrowTime(4 * DAY + 10);
    const winter = regrowTime(10 * DAY + 10);
    expect(summer).toBeLessThan((LUMBER.regrow + LUMBER.regrowSpread) / 2 + 5);
    expect(winter).toBeGreaterThan((LUMBER.regrow - LUMBER.regrowSpread) / 0.5 - 5);
  });
});
