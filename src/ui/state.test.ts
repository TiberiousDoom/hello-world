import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../sim/data';
import { World } from '../sim/world';
import { placementAt } from './state';

/** A clear world with everything researched and plenty of stock. */
function clearWorld(): World {
  const w = World.create(1);
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.nests = [];
  w.state.enemies = [];
  w.nestCells.clear();
  w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999 };
  return w;
}

describe('Buildings line up with belts while aiming', () => {
  it('beside the end of a belt line, a building turns to carry the flow straight on', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // running east, ending at x0 + 3
    // Aimed just past the end, facing north: it turns east, with the belt running into it.
    expect(placementAt(w, 'furnace', { x: x0 + 4, y }, 3, true)).toEqual({ x: x0 + 4, y, dir: 0 });
  });

  it('near the start of a belt line, a building faces it and sits so its output runs onto the belt', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // starts at x0, running east
    // Aimed just left of the start, facing west: it turns east and lines its output up with the belt.
    const p = placementAt(w, 'furnace', { x: x0 - 1, y: y + 1 }, 2, true);
    expect(p.dir).toBe(0);
    const out = { x: p.x + 2, y: p.y }; // a 2×2 facing east outputs from its top-right tile's east side
    expect(out).toEqual({ x: x0, y });
  });

  it('with no belts around, or in a dragged line, the building keeps the player\'s facing', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    expect(placementAt(w, 'furnace', { x: x0, y }, 1, true)).toEqual({ x: x0, y, dir: 1 });
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0);
    expect(placementAt(w, 'furnace', { x: x0 + 4, y }, 3, false)).toEqual({ x: x0 + 4, y, dir: 3 });
  });

  it('dropped onto a belt, it still faces the way the belt runs', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0, y + i, 1); // running south
    expect(placementAt(w, 'furnace', { x: x0, y: y + 1 }, 0, true).dir).toBe(1);
  });
});
