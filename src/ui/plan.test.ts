import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../sim/data';
import { World } from '../sim/world';
import { planSteps, tunnelExitSpot } from './plan';
import { Plan } from './state';

function clearWorld(): World {
  const w = World.create(1);
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.nests = [];
  w.state.enemies = [];
  w.nestCells.clear();
  w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, stone: 999 };
  return w;
}

/** A belt line dragged east along row y from x0 to x1. */
const eastLine = (x0: number, x1: number, y: number): Plan => ({ tool: 'belt', tiles: Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ x: x0 + i, y })) });

describe('Belts dragged across a belt go under it (#65)', () => {
  it('the tiles either side of the crossing become an underground entrance and exit', () => {
    const w = clearWorld();
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    for (let dy = -2; dy <= 2; dy++) w.place('belt', x0 + 3, y + dy, 1); // a belt running south
    const steps = planSteps(w, eastLine(x0, x0 + 6, y), 0);
    expect(steps.map((s) => (s.over ? 'under' : s.exit ? 'exit' : s.tool))).toEqual(['belt', 'belt', 'tunnel', 'under', 'exit', 'belt', 'belt']);
    expect(steps.filter((s) => !s.over).every((s) => s.status === null)).toBe(true);
  });

  it('one underground passes under several belts side by side, but not under a belt running the same way', () => {
    const w = clearWorld();
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    for (const x of [x0 + 3, x0 + 4]) for (let dy = -1; dy <= 1; dy++) w.place('belt', x, y + dy, 3); // two belts running north
    const steps = planSteps(w, eastLine(x0, x0 + 7, y), 0);
    expect(steps.map((s) => (s.over ? 'under' : s.exit ? 'exit' : s.tool))).toEqual(['belt', 'belt', 'tunnel', 'under', 'under', 'exit', 'belt', 'belt']);
    const w2 = clearWorld();
    w2.place('belt', x0 + 3, y, 0); // already running east, along the line
    expect(planSteps(w2, eastLine(x0, x0 + 6, y), 0).some((s) => s.tool === 'tunnel')).toBe(false);
  });

  it("when the undergrounds can't be paid for, the line stops before the crossing", () => {
    const w = clearWorld();
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    w.place('belt', x0 + 3, y, 1);
    w.state.inventory = { iron_plate: 10, brick: 1 }; // belts, but only one underground's brick
    const status = planSteps(w, eastLine(x0, x0 + 6, y), 0).map((s) => s.status);
    expect(status).toEqual([null, null, 'cost', 'cost', 'cost', 'cost', 'cost']);
  });

  it('a line ending on the crossing has nothing to tunnel to', () => {
    const w = clearWorld();
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    w.place('belt', x0 + 3, y, 1);
    const steps = planSteps(w, eastLine(x0, x0 + 3, y), 0);
    expect(steps.some((s) => s.tool === 'tunnel')).toBe(false);
    expect(steps[3].status).toBe('occupied');
  });
});

describe('Underground exit blueprint (#64)', () => {
  it('goes to the first free tile past what is in the way, or two tiles on', () => {
    const w = clearWorld();
    const [x, y] = [w.hub!.x - 30, w.hub!.y - 12];
    expect(tunnelExitSpot(w, x, y, 0)).toEqual({ x: x + 2, y });
    w.place('wall', x + 1, y, 0);
    w.place('wall', x + 2, y, 0);
    expect(tunnelExitSpot(w, x, y, 0)).toEqual({ x: x + 3, y });
  });
});

describe('Belts dragged across anything else go under it too (#93, D-102)', () => {
  it('a wall, a machine or trees in the way are tunnelled under, and paid for', () => {
    const w = clearWorld();
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    w.place('wall', x0 + 3, y, 0);
    const steps = planSteps(w, eastLine(x0, x0 + 6, y), 0);
    expect(steps.map((s) => (s.over ? 'under' : s.exit ? 'exit' : s.tool))).toEqual(['belt', 'belt', 'tunnel', 'under', 'exit', 'belt', 'belt']);
    expect(steps.filter((s) => !s.over).every((s) => s.status === null)).toBe(true);
    const t = clearWorld();
    for (const x of [x0 + 3, x0 + 4]) t.state.trees[t.idx(x, y)] = 1; // a strip of trees
    expect(planSteps(t, eastLine(x0, x0 + 7, y), 0).map((s) => (s.over ? 'under' : s.exit ? 'exit' : s.tool))).toEqual([
      'belt',
      'belt',
      'tunnel',
      'under',
      'under',
      'exit',
      'belt',
      'belt',
    ]);
  });

  it('rollers have no underground: a roller line stops at what is in the way', () => {
    const w = clearWorld();
    w.state.inventory = { plank: 99, dowel: 99, iron_plate: 99, brick: 99 };
    const [x0, y] = [w.hub!.x - 30, w.hub!.y - 12];
    w.place('wall', x0 + 3, y, 0);
    const steps = planSteps(w, { tool: 'roller', tiles: eastLine(x0, x0 + 6, y).tiles }, 0);
    expect(steps.some((s) => s.tool === 'tunnel')).toBe(false);
    expect(steps[3].status).toBe('occupied');
  });
});
