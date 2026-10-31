import { describe, expect, it } from 'vitest';
import { ITEM_IDS, RESEARCH } from '../sim/data';
import { World } from '../sim/world';
import { pickableItems } from './hud';

describe('Item pickers (#191)', () => {
  it('list only what the player can have so far, plus the item already chosen', () => {
    const w = World.create(1);
    w.state.researched = [];
    w.state.inventory = {};
    const early = pickableItems(w);
    expect(early).toEqual(expect.arrayContaining(['log', 'iron_ore', 'copper_ore', 'stone']));
    expect(early).not.toContain('circuit');
    expect(early.length).toBeLessThan(15);
    expect(pickableItems(w, 'circuit')).toContain('circuit');
    w.state.inventory = { chitin: 3 };
    expect(pickableItems(w)).toContain('chitin');
    w.state.researched = ['forestry'];
    expect(pickableItems(w)).toContain('plank');
    // In the items' own order, without repeats.
    w.state.researched = RESEARCH.map((r) => r.id);
    const all = pickableItems(w);
    expect(all).toEqual(ITEM_IDS.filter((i) => all.includes(i)));
    expect(all).toContain('circuit');
  });
});
