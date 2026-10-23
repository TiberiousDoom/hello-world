import { describe, expect, it } from 'vitest';
import { RECIPES, RESEARCH } from '../sim/data';
import { TICK, World } from '../sim/world';
import { beltPerMinute, buildingRates, rateSummary, recipePerMinute } from './rates';

describe('Rates', () => {
  it('come from the game numbers', () => {
    expect(Math.round(beltPerMinute('belt'))).toBe(265);
    expect(Math.round(beltPerMinute('express_belt'))).toBe(529);
    const plate = RECIPES.find((r) => r.output === 'iron_plate')!;
    expect(recipePerMinute(plate).output).toBeCloseTo((plate.count * 60) / plate.time);
    expect(rateSummary('extractor')).toBe('40 ore/min');
    expect(rateSummary('turret')).toMatch(/^3 shots\/s, 45 iron plate\/min while firing$/);
  });

  it('show what a machine is doing, and how fast it has been going', () => {
    const w = World.create(1);
    w.state.researched = RESEARCH.map((r) => r.id);
    w.state.inventory = { iron_plate: 99, brick: 99 };
    const hub = w.hub!;
    const x = hub.x - 10;
    const y = hub.y;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) w.state.resources[w.idx(x + dx, y + dy)] = w.state.trees[w.idx(x + dx, y + dy)] = 0;
    const f = w.place('furnace', x, y, 0);
    if (typeof f === 'string') throw new Error(f);
    w.setRecipe(f.id, 'iron_plate');
    expect(buildingRates(w, f)?.now).toBe('Waiting for iron ore');
    // Feed it by hand for a while: it works, and reports a rate.
    for (let t = 0; t < 30; t += TICK) {
      f.inputs.iron_ore = 5;
      w.tick();
    }
    const r = buildingRates(w, f)!;
    expect(r.max).toMatch(/iron plate\/min, using .* iron ore\/min/);
    expect(r.now).toMatch(/\/min lately · /);
  });
});
