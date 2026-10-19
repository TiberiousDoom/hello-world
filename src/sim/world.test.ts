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

  it('splitters take from behind and alternate between front, left and right', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 10, 10, 0)); // facing east
    const front = placed(w.place('belt', 11, 10, 0));
    const left = placed(w.place('belt', 10, 9, 3));
    const right = placed(w.place('belt', 10, 11, 1));
    expect(w.insert(sp, 'iron_plate', 10, 9)).toBe(false); // from the side
    for (let i = 0; i < 3; i++) {
      expect(w.insert(sp, 'iron_plate', 9, 10)).toBe(true);
      run(w, 0.5);
    }
    expect([front, left, right].map((b) => b.belt.length)).toEqual([1, 1, 1]);
  });

  it('splitters skip blocked sides', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 10, 10, 0));
    const front = placed(w.place('belt', 11, 10, 0));
    for (let i = 0; i < 3; i++) {
      expect(w.insert(sp, 'iron_plate', 9, 10)).toBe(true);
      run(w, 0.5);
    }
    expect(front.belt.length).toBeGreaterThanOrEqual(2);
  });

  it('underground belts pair up and carry items under walls', () => {
    const w = emptyWorld();
    const a = placed(w.place('tunnel', 10, 10, 0));
    placed(w.place('wall', 11, 10, 0));
    placed(w.place('wall', 12, 10, 0));
    const b = placed(w.place('tunnel', 13, 10, 0));
    expect(a.link).toBe(b.id);
    expect(b.link).toBe(a.id);
    expect(w.isTunnelExit(b)).toBe(true);
    expect(w.isTunnelExit(a)).toBe(false);
    const out = placed(w.place('belt', 14, 10, 0));
    expect(w.insert(b, 'gear', 12, 10)).toBe(false); // exits take no input
    expect(w.insert(a, 'gear', 9, 10)).toBe(true);
    run(w, 3);
    expect(out.belt.map((i) => i.item)).toEqual(['gear']);
    w.demolish(b.id);
    expect(a.link).toBe(null);
  });

  it('underground belts only pair within range and the same direction', () => {
    const w = emptyWorld();
    placed(w.place('tunnel', 10, 10, 0));
    expect(placed(w.place('tunnel', 16, 10, 0)).link).toBe(null); // 6 tiles: too far
    const c = placed(w.place('tunnel', 20, 20, 1));
    expect(placed(w.place('tunnel', 21, 20, 0)).link).toBe(null); // c faces south
    expect(c.link).toBe(null);
  });

  it('repair stations heal nearby buildings using stored plates', () => {
    const w = emptyWorld();
    w.state.tier = 1;
    const wall = placed(w.place('wall', 12, 10, 0));
    const far = placed(w.place('wall', 30, 10, 0));
    wall.hp = 100;
    far.hp = 100;
    const r = placed(w.place('repair', 10, 10, 0));
    r.ammo = 0;
    run(w, 1);
    expect(wall.hp).toBe(100);
    expect(w.insert(r, 'iron_plate', 9, 10)).toBe(true);
    run(w, 3);
    expect(wall.hp).toBeCloseTo(140);
    expect(far.hp).toBe(100);
  });

  it('adds runners from wave 2', () => {
    const w = emptyWorld();
    w.startWave();
    expect(w.state.spawnQueue.some((p) => p.type === 'runner')).toBe(false);
    w.startWave();
    expect(w.state.spawnQueue.some((p) => p.type === 'runner')).toBe(true);
  });

  it('loads version 1 saves', () => {
    const w = World.create(9);
    placed(w.place('belt', 1, 1, 2));
    const v1 = JSON.parse(w.toJSON());
    v1.version = 1;
    for (const b of v1.buildings) {
      delete b.link;
      delete b.rr;
    }
    const loaded = World.fromJSON(JSON.stringify(v1));
    expect(loaded.state.version).toBe(2);
    expect(loaded.buildingAt(1, 1)?.link).toBe(null);
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
