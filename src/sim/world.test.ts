import { describe, expect, it } from 'vitest';
import { FIRST_WAVE_AT, ItemId } from './data';
import { Building, TICK, World } from './world';

/** A world with no resources, no buildings except the hub, and a big inventory. */
function emptyWorld(): World {
  const w = World.create(1);
  w.state.resources.fill(0);
  w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999 };
  w.state.nextWaveAt = 1e9;
  return w;
}

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

describe('World', () => {
  it('creates a map with a hub and resources near it', () => {
    const w = World.create(42);
    expect(w.hub?.type).toBe('hub');
    const kinds = new Set(w.state.resources.filter((r) => r > 0));
    expect(kinds).toEqual(new Set([1, 2, 3]));
  });

  it('is deterministic for a seed', () => {
    expect(World.create(7).state.resources).toEqual(World.create(7).state.resources);
  });

  it('charges and refunds building costs', () => {
    const w = World.create(3);
    const before = w.state.inventory.iron_plate!;
    const belt = placed(w.place('belt', 2, 2, 0));
    expect(w.state.inventory.iron_plate).toBe(before - 1);
    w.demolish(belt.id);
    expect(w.state.inventory.iron_plate).toBe(before);
  });

  it('rejects invalid placements', () => {
    const w = emptyWorld();
    expect(w.place('extractor', 2, 2, 0)).toBe('needs-resource');
    expect(w.place('assembler', 2, 2, 0)).toBe('locked');
    const hub = w.hub!;
    expect(w.place('belt', hub.x, hub.y, 0)).toBe('occupied');
    w.state.inventory = {};
    expect(w.place('belt', 2, 2, 0)).toBe('cost');
  });

  it('mines, smelts and delivers to the hub along belts', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    // Extractor -> belt -> furnace -> belt x2 -> hub, laid out west of the hub.
    const y = hub.y + 1;
    const x0 = hub.x - 6;
    w.state.resources[w.idx(x0, y)] = 1; // iron
    placed(w.place('extractor', x0, y, 0));
    placed(w.place('belt', x0 + 1, y, 0));
    placed(w.place('furnace', x0 + 2, y, 0));
    for (let x = x0 + 3; x < hub.x; x++) placed(w.place('belt', x, y, 0));
    const start = w.state.inventory.iron_plate!;
    run(w, 30);
    expect(w.state.inventory.iron_plate! - start).toBeGreaterThan(10);
  });

  it('crafts multi-input recipes', () => {
    const w = emptyWorld();
    w.state.tier = 1;
    const a = placed(w.place('assembler', 2, 2, 0));
    const feed = (item: ItemId, n: number) => {
      for (let i = 0; i < n; i++) expect(w.insert(a, item, 1, 2)).toBe(true);
    };
    feed('gear', 1);
    feed('wire', 2);
    feed('iron_plate', 1);
    expect(a.recipe).toBe('motor');
    run(w, 5);
    expect(a.outputs).toEqual(['motor']);
  });

  it('advances tiers when goals are delivered', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const goal = { iron_plate: 60, copper_ingot: 40, gear: 20, brick: 20 };
    for (const [item, n] of Object.entries(goal)) for (let i = 0; i < n; i++) w.insert(hub, item as ItemId, 0, 0);
    expect(w.state.tier).toBe(1);
    expect(w.isUnlocked('cannon')).toBe(true);
  });

  it('sends enemies to the hub and damages it', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    w.state.enemies.push({ id: 999, type: 'crawler', x: 0.5, y: hub.y + 1.5, hp: 1e6, maxHp: 1e6 });
    const hp = hub.hp;
    run(w, 40);
    expect(hub.hp).toBeLessThan(hp);
  });

  it('enemies chew through walls in their way', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    // Fully enclose the hub with walls.
    for (let x = hub.x - 1; x <= hub.x + 3; x++)
      for (let y = hub.y - 1; y <= hub.y + 3; y++) if (!w.buildingAt(x, y)) placed(w.place('wall', x, y, 0));
    w.state.enemies.push({ id: 999, type: 'brute', x: 0.5, y: hub.y + 1.5, hp: 1e6, maxHp: 1e6 });
    const walls = w.state.buildings.filter((b) => b.type === 'wall').length;
    run(w, 90);
    expect(w.state.buildings.filter((b) => b.type === 'wall').length).toBeLessThan(walls);
  });

  it('turrets need ammo and kill enemies in range', () => {
    const w = emptyWorld();
    const t = placed(w.place('turret', 5, 5, 0));
    expect(t.ammo).toBeGreaterThan(0);
    t.ammo = 0;
    w.state.enemies.push({ id: 999, type: 'crawler', x: 7.5, y: 5.5, hp: 10, maxHp: 10 });
    w.tick();
    expect(w.state.enemies[0].hp).toBe(10);
    expect(w.insert(t, 'iron_plate', 4, 5)).toBe(true);
    expect(w.insert(t, 'gear', 4, 5)).toBe(false);
    run(w, 1);
    expect(w.state.enemies.length).toBe(0);
  });

  it('two loaded turrets by the hub hold off the first wave', () => {
    const w = World.create(11);
    const hub = w.hub!;
    placed(w.place('turret', hub.x - 1, hub.y + 1, 0));
    placed(w.place('turret', hub.x + 3, hub.y + 1, 0));
    w.state.time = FIRST_WAVE_AT - 1;
    run(w, 60);
    expect(w.state.wave).toBe(1);
    expect(w.state.enemies.length + w.state.spawnQueue.length).toBe(0);
    expect(w.state.gameOver).toBe(false);
  });

  it('spawns waves on schedule', () => {
    const w = World.create(5);
    w.state.time = FIRST_WAVE_AT - TICK / 2;
    w.tick();
    expect(w.state.wave).toBe(1);
    run(w, 10);
    expect(w.state.enemies.length).toBeGreaterThan(0);
  });

  it('round-trips through save data', () => {
    const w = World.create(9);
    placed(w.place('belt', 1, 1, 2));
    run(w, 2);
    const copy = World.fromJSON(w.toJSON());
    expect(copy.state).toEqual(w.state);
    expect(copy.buildingAt(1, 1)?.type).toBe('belt');
  });
});
