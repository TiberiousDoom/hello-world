import { describe, expect, it } from 'vitest';
import { BREACH, BUILDINGS, FIRST_WAVE_AT, ItemId, RESEARCH } from './data';
import { Building, SAVE_VERSION, TICK, World } from './world';

/** A world with no resources, no buildings except the hub, everything researched and a big inventory. */
function emptyWorld(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(1, mode);
  w.state.researched = RESEARCH.map((r) => r.id);
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

  it('spreads node tiles out so none touch side by side, with each ore near the hub', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = World.create(seed);
      const hub = w.hub!;
      const near = new Set<number>();
      for (let y = 0; y < w.state.height; y++) {
        for (let x = 0; x < w.state.width; x++) {
          const r = w.state.resources[w.idx(x, y)];
          if (!r) continue;
          if (x + 1 < w.state.width) expect(w.state.resources[w.idx(x + 1, y)]).toBe(0);
          if (y + 1 < w.state.height) expect(w.state.resources[w.idx(x, y + 1)]).toBe(0);
          if (Math.abs(x - hub.x - 1) <= 13 && Math.abs(y - hub.y - 1) <= 13) near.add(r);
        }
      }
      expect(near).toEqual(new Set([1, 2, 3]));
    }
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
    expect(World.create(1).place('turret', 2, 2, 0)).toBe('locked');
    expect(w.place('port', 2, 2, 0)).toBe('needs-hub');
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

  it('starts with a few buildings and unlocks more through research', () => {
    const w = World.create(2);
    expect(['belt', 'extractor', 'furnace'].every((t) => w.isUnlocked(t as never))).toBe(true);
    expect(w.isUnlocked('turret')).toBe(false);
    expect(w.researchNow('logistics')).toBe('requires'); // needs workshops first
    const plates = w.state.inventory.iron_plate!;
    expect(w.researchNow('defense')).toBe(null);
    expect(w.state.inventory.iron_plate).toBe(plates - 20);
    expect(w.isUnlocked('turret')).toBe(true);
    expect(w.researchNow('defense')).toBe('done');
    w.state.inventory = {};
    expect(w.researchNow('workshop')).toBe('cost');
    expect(w.availableResearch().map((r) => r.id)).toContain('distribution');
  });

  it('hub ports take the chosen item out of stock and face away from the hub', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const port = placed(w.place('port', hub.x - 1, hub.y + 1, 1));
    expect(port.dir).toBe(2); // west, away from the hub
    const belt = placed(w.place('belt', hub.x - 2, hub.y + 1, 2)); // leads nowhere, so items pile up
    const before = w.state.inventory.iron_plate!;
    run(w, 2);
    expect(belt.belt.length).toBe(0); // no item chosen yet
    w.setFilter(port.id, 'iron_plate');
    run(w, 2);
    expect(w.state.inventory.iron_plate).toBeLessThan(before);
    expect(belt.belt.length).toBeGreaterThan(0);
  });

  it('standard mode survives losing the hub, at a cost', () => {
    const w = emptyWorld();
    w.state.inventory = { iron_plate: 100 };
    w.state.enemies.push({ id: 999, type: 'brute', x: 0.5, y: 0.5, hp: 50, maxHp: 50 });
    w.hub!.hp = 0;
    const nextWave = w.state.nextWaveAt;
    w.tick();
    expect(w.state.gameOver).toBe(false);
    expect(w.state.breaches).toBe(1);
    expect(w.state.enemies.length).toBe(0);
    expect(w.state.inventory.iron_plate).toBe(100 * (1 - BREACH.stockLost));
    expect(w.hub!.hp).toBe(BUILDINGS.hub.hp * BREACH.hubRestore);
    expect(w.state.nextWaveAt).toBeGreaterThan(nextWave);
  });

  it('hardcore mode ends when the hub falls', () => {
    const w = emptyWorld('hardcore');
    w.hub!.hp = 0;
    w.tick();
    expect(w.state.gameOver).toBe(true);
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
    w.researchNow('defense');
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
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.buildingAt(1, 1)?.link).toBe(null);
  });

  it('loads version 2 saves, converting tiers to research', () => {
    const v2 = JSON.parse(World.create(4).toJSON());
    v2.version = 2;
    v2.tier = 1;
    v2.tierProgress = {};
    delete v2.researched;
    delete v2.mode;
    delete v2.breaches;
    const loaded = World.fromJSON(JSON.stringify(v2));
    expect(loaded.isUnlocked('cannon')).toBe(true);
    expect(loaded.state.mode).toBe('standard');
    expect('tier' in loaded.state).toBe(false);
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

describe('Demo world', () => {
  it('lays out a working factory that delivers to the hub and fights waves', async () => {
    const { createDemoWorld, sustainDemo } = await import('./demo');
    const w = createDemoWorld();
    const types = w.state.buildings.map((b) => b.type);
    for (const t of ['extractor', 'furnace', 'workshop', 'splitter', 'tunnel', 'turret', 'cannon', 'wall', 'repair']) {
      expect(types).toContain(t);
    }
    expect(w.state.buildings.filter((b) => b.type === 'tunnel').every((b) => b.link != null)).toBe(true);
    const start = { ...w.state.inventory };
    for (let t = 0; t < 60; t += TICK) {
      w.tick();
      sustainDemo(w);
    }
    expect(w.state.inventory.iron_plate!).toBeGreaterThan(start.iron_plate!);
    expect(w.state.inventory.wire!).toBeGreaterThan(start.wire!);
    expect(w.state.inventory.brick!).toBeGreaterThan(start.brick!);
    expect(w.state.wave).toBeGreaterThan(0);
  });
});

describe('Hub weapon', () => {
  /** Runs wave `n` against a hub with no other defenses; returns HP lost and breaches. */
  function hubAlone(seed: number, n: number) {
    const w = World.create(seed);
    w.state.wave = n - 1;
    w.state.time = FIRST_WAVE_AT - TICK / 2;
    w.state.nextWaveAt = FIRST_WAVE_AT;
    w.tick();
    w.state.nextWaveAt = 1e9;
    for (let t = 0; t < 120 && (w.state.enemies.length || w.state.spawnQueue.length); t += TICK) w.tick();
    return { lost: BUILDINGS.hub.hp - w.hub!.hp, breaches: w.state.breaches, left: w.state.enemies.length };
  }

  it('beats wave 1 alone, losing at most 25% of its HP, on every map', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = hubAlone(seed, 1);
      expect(r.left).toBe(0);
      expect(r.breaches).toBe(0);
      expect(r.lost).toBeLessThanOrEqual(BUILDINGS.hub.hp * 0.25);
    }
  });

  it('is not enough on its own by wave 3', () => {
    expect(hubAlone(7, 3).breaches).toBe(1);
  });

  it('needs no ammo', () => {
    const w = World.create(2);
    const hub = w.hub!;
    w.state.enemies.push({ id: 999, type: 'crawler', x: hub.x + 5, y: hub.y + 1.5, hp: 1000, maxHp: 1000 });
    for (let t = 0; t < 5; t += TICK) w.tick();
    expect(w.state.enemies[0].hp).toBeLessThan(1000);
    expect(hub.ammo).toBe(0);
  });
});

describe('Research over time', () => {
  function world() {
    const w = World.create(8);
    w.state.nextWaveAt = 1e9;
    w.state.company.nextContractAt = 1e9;
    return w;
  }

  it('draws items from stock over its research time, then unlocks', () => {
    const w = world();
    const plates = w.state.inventory.iron_plate!;
    expect(w.startResearch('defense')).toBe(null);
    run(w, 15); // half of 30 s
    expect(w.researchProgress('defense')).toBeCloseTo(0.5, 1);
    expect(Math.abs(w.state.inventory.iron_plate! - (plates - 10))).toBeLessThanOrEqual(1);
    expect(w.isUnlocked('turret')).toBe(false);
    run(w, 16);
    expect(w.isUnlocked('turret')).toBe(true);
    expect(w.state.inventory.iron_plate).toBe(plates - 20);
    expect(w.state.research.active).toBe(null);
  });

  it('stalls when the hub runs out, and resumes when stock arrives', () => {
    const w = world();
    w.state.inventory.iron_plate = 5;
    w.startResearch('defense');
    run(w, 30);
    expect(w.state.research.stalled).toBe(true);
    expect(w.researchProgress('defense')).toBeCloseTo(0.25);
    w.state.inventory.iron_plate = 100;
    run(w, 25);
    expect(w.isUnlocked('turret')).toBe(true);
  });

  it('keeps progress when switching between researches', () => {
    const w = world();
    w.startResearch('defense');
    run(w, 15);
    const p = w.researchProgress('defense');
    w.startResearch('masonry');
    run(w, 10);
    expect(w.researchProgress('defense')).toBe(p);
    expect(w.researchProgress('masonry')).toBeGreaterThan(0);
    w.startResearch('defense');
    run(w, 20);
    expect(w.isUnlocked('turret')).toBe(true);
  });

  it('draws mixed costs evenly', () => {
    const w = world();
    w.startResearch('workshop'); // 30 plates + 10 copper over 60 s
    run(w, 30);
    const paid = w.state.research.paid.workshop;
    expect(paid.iron_plate! / 30).toBeCloseTo(paid.copper_ingot! / 10, 1);
  });

  it("won't start research whose prerequisites aren't done", () => {
    const w = world();
    expect(w.startResearch('logistics')).toBe('requires');
    expect(w.startResearch('nope')).toBe('unknown');
  });

  it('migrates version 4 saves', () => {
    const v4 = JSON.parse(World.create(9).toJSON());
    v4.version = 4;
    delete v4.research;
    const w = World.fromJSON(JSON.stringify(v4));
    expect(w.state.research.active).toBe(null);
  });
});
