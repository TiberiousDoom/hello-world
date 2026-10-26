import { describe, expect, it } from 'vitest';
import { FOG, HUB_SIZE, RESEARCH } from './data';
import { explored } from './fog';
import { SAVE_VERSION, World } from './world';

describe('Fog of war (D-112)', () => {
  it('a new game has seen only around the hub and the engineer', () => {
    const w = World.create(3);
    const s = w.state;
    const hub = w.hub!;
    const [mx, my] = [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2];
    expect(explored(s, mx, my)).toBe(true);
    expect(explored(s, mx + FOG.hub - 4, my)).toBe(true);
    expect(explored(s, mx + FOG.hub + 8, my)).toBe(false);
    expect(explored(s, 0, 0)).toBe(false);
    // The shipyard's site is close enough to be seen.
    expect(explored(s, s.shipSite!.x, s.shipSite!.y)).toBe(true);
  });

  it('engineers explore as they walk, and buildings see around them', () => {
    const w = World.create(3);
    const s = w.state;
    const p = s.players[0];
    const far = Math.floor(p.y) + FOG.hub + 20;
    expect(explored(s, p.x, far)).toBe(false);
    p.y = far;
    w.tick();
    expect(explored(s, p.x, far)).toBe(true);
    expect(explored(s, p.x, far + FOG.player - 2)).toBe(true);
    // A turret sees its range and more.
    s.researched = RESEARCH.map((r) => r.id);
    s.inventory = { iron_plate: 99, copper_ingot: 99 };
    const x = Math.floor(p.x) - 40;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.trees[w.idx(x + dx, far + dy)] = s.resources[w.idx(x + dx, far + dy)] = 0;
    s.nests = [];
    w.nestCells.clear();
    expect(explored(s, x - 6, far)).toBe(false);
    const t = w.place('turret', x, far, 0);
    expect(t).toMatchObject({ type: 'turret' });
    expect(explored(s, x - 6, far)).toBe(true);
  });

  it('is saved, and older saves see what their buildings and engineers see', () => {
    const w = World.create(5);
    w.state.players[0].y += 30;
    w.tick();
    const p = w.state.players[0];
    expect(World.fromJSON(JSON.stringify(w.state)).state.explored).toEqual(w.state.explored);
    const old = JSON.parse(JSON.stringify(w.state));
    old.version = 26;
    delete old.explored;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(explored(loaded.state, p.x, p.y)).toBe(true);
    const hub = loaded.hub!;
    expect(explored(loaded.state, hub.x, hub.y)).toBe(true);
    expect(explored(loaded.state, 0, 0)).toBe(false);
  });
});
