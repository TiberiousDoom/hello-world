import { describe, expect, it } from 'vitest';
import { BREACH, BUILDINGS, FOREST, HUB_SIZE, ItemId, LUMBER, MAP_SIZE, NESTS, RESEARCH, TURRETS } from './data';
import { Nest, cellKey, isAngry, nestCentre } from './nests';
import { Building, NO_TREE, OldSaveError, SAVE_VERSION, STUMP, TICK, TREE, World } from './world';
import { createDemoWorld } from './demo';

/** A world with no resources, no bugs, only the hub, everything researched and a big inventory. */
function emptyWorld(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(1, mode);
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.nests = [];
  w.state.enemies = [];
  w.nestCells.clear();
  w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999 };
  return w;
}

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

/** Ore under a w×h area. */
function ore(w: World, x: number, y: number, kind = 1, size = 2) {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.state.resources[w.idx(x + dx, y + dy)] = kind;
}

/** Adds a nest (with `bugs` crawlers) whose cell has its top-left at (x, y). */
function addNest(w: World, x: number, y: number, bugs = 3): Nest {
  const n: Nest = { id: w.state.nests.length, x, y, angryUntil: 0 };
  w.state.nests.push(n);
  w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
  for (let i = 0; i < bugs; i++) w.spawnBug('crawler', n, 1);
  return n;
}

describe('Map', () => {
  it('is 256×256, with a 5×5 hub in the middle and every ore within reach of it', () => {
    const w = World.create(42);
    expect(w.state.width).toBe(MAP_SIZE);
    const hub = w.hub!;
    expect(w.footprintOf(hub)).toEqual([HUB_SIZE, HUB_SIZE]);
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) expect(w.buildingAt(hub.x + dx, hub.y + dy)).toBe(hub);
    const near = new Set<number>();
    const c = hub.x + 2;
    for (let y = c - 18; y <= c + 18; y++) for (let x = c - 18; x <= c + 18; x++) if (w.state.resources[w.idx(x, y)]) near.add(w.state.resources[w.idx(x, y)]);
    expect(near).toEqual(new Set([1, 2, 3]));
    // Ore spread across the map as well.
    expect(w.state.resources.filter((r) => r).length).toBeGreaterThan(MAP_SIZE * MAP_SIZE * 0.08);
  });

  it('is the same for the same seed', () => {
    const a = World.create(7);
    const b = World.create(7);
    expect(a.state.resources).toEqual(b.state.resources);
    expect(a.state.nests).toEqual(b.state.nests);
    expect(World.create(8).state.resources).not.toEqual(a.state.resources);
  });

  it('places bug territories away from the hub, each with bugs inside its cell', () => {
    for (const seed of [1, 2, 3]) {
      const w = World.create(seed);
      const hub = w.hub!;
      const c = hub.x + 2;
      expect(w.state.nests.length).toBeGreaterThan(40);
      for (const n of w.state.nests) {
        const nx = Math.max(n.x, Math.min(c, n.x + NESTS.cell - 1));
        const ny = Math.max(n.y, Math.min(c, n.y + NESTS.cell - 1));
        expect(Math.hypot(nx - c, ny - c)).toBeGreaterThanOrEqual(NESTS.safeRadius);
      }
      for (const e of w.state.enemies) {
        const n = w.state.nests[e.nest];
        expect(e.x >= n.x && e.x < n.x + NESTS.cell && e.y >= n.y && e.y < n.y + NESTS.cell).toBe(true);
      }
    }
  });
});

describe('Buildings', () => {
  it('have their sizes, and sideways turns swap width and height', () => {
    const w = emptyWorld();
    const sizes: [string, number, number][] = [['extractor', 2, 2], ['furnace', 2, 2], ['workshop', 3, 2], ['assembler', 4, 2]];
    let y = 20;
    for (const [type, bw, bh] of sizes) {
      ore(w, 20, y, 1, 4);
      ore(w, 40, y, 1, 4);
      const b = placed(w.place(type as 'workshop', 20, y, 0));
      expect(w.footprintOf(b)).toEqual([bw, bh]);
      const s = placed(w.place(type as 'workshop', 40, y, 1));
      expect(w.footprintOf(s)).toEqual([bh, bw]);
      expect(w.buildingAt(40 + bh - 1, y + bw - 1)).toBe(s);
      y += 6;
    }
  });

  it('charges and refunds costs, and rejects bad placements', () => {
    const w = emptyWorld();
    const before = w.state.inventory.iron_plate!;
    const b = placed(w.place('workshop', 20, 20, 0));
    expect(w.state.inventory.iron_plate).toBe(before - BUILDINGS.workshop.cost.iron_plate!);
    expect(w.place('belt', 22, 21, 0)).toBe('occupied'); // inside the workshop
    expect(w.place('extractor', 30, 30, 0)).toBe('needs-resource');
    expect(w.place('workshop', MAP_SIZE - 2, 10, 0)).toBe('bounds');
    expect(w.place('port', 60, 60, 0)).toBe('needs-hub');
    w.demolish(b.id);
    expect(w.state.inventory.iron_plate).toBe(before);
  });

  it('turn in place only when their new footprint is free', () => {
    const w = emptyWorld();
    const b = placed(w.place('workshop', 20, 20, 0)); // 3 wide, 2 deep
    expect(w.rotate(b.id)).toBe(true); // now 2 wide, 3 deep
    expect(w.buildingAt(20, 22)).toBe(b);
    expect(w.buildingAt(22, 20)).toBeUndefined();
    placed(w.place('wall', 22, 20, 0));
    expect(w.rotate(b.id)).toBe(false); // facing west it would cover the wall
  });

  it('output from the middle of the side they face', () => {
    const w = emptyWorld();
    const b = placed(w.place('workshop', 20, 20, 1)); // facing south: 2 wide, 3 deep
    expect(w.outputTile(b)).toEqual({ x: 20, y: 23, fromX: 20, fromY: 22 });
    const a = placed(w.place('assembler', 30, 20, 0)); // facing east: 4 wide, 2 deep
    expect(w.outputTile(a)).toEqual({ x: 34, y: 20, fromX: 33, fromY: 20 });
  });

  it('extractors mine the ore covering most of their base', () => {
    const w = emptyWorld();
    w.state.resources[w.idx(20, 20)] = 1;
    w.state.resources[w.idx(21, 20)] = 2;
    w.state.resources[w.idx(21, 21)] = 2;
    const b = placed(w.place('extractor', 20, 20, 0));
    expect(b.recipe).toBe('copper_ore');
  });
});

describe('Production', () => {
  /** Extractor → belt → furnace → belts → hub, along the hub's middle row. */
  function line(w: World) {
    const hub = w.hub!;
    const y = hub.y + 2;
    const x0 = hub.x - 12;
    ore(w, x0, y);
    placed(w.place('extractor', x0, y, 0));
    placed(w.place('belt', x0 + 2, y, 0));
    placed(w.place('furnace', x0 + 3, y, 0));
    for (let x = x0 + 5; x < hub.x; x++) placed(w.place('belt', x, y, 0));
    return { x0, y };
  }

  it('mines, smelts and delivers to the hub', () => {
    const w = emptyWorld();
    line(w);
    const start = w.state.inventory.iron_plate!;
    run(w, 30);
    expect(w.state.inventory.iron_plate! - start).toBeGreaterThan(10);
  });

  it('crafts multi-input recipes in the big machines', () => {
    const w = emptyWorld();
    const a = placed(w.place('assembler', 20, 20, 0));
    w.setRecipe(a.id, 'motor');
    for (const item of ['gear', 'wire', 'wire', 'iron_plate'] as ItemId[]) w.insert(a, item, 19, 20);
    run(w, 5);
    expect(a.outputs).toContain('motor');
  });

  it('a furnace dropped onto a belt line replaces those belts, faces their way and starts smelting', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const y = hub.y + 2;
    const x0 = hub.x - 12;
    ore(w, x0, y);
    placed(w.place('extractor', x0, y, 0));
    for (let x = x0 + 2; x < hub.x; x++) placed(w.place('belt', x, y, 0));
    expect(w.place('furnace', x0 + 4, y, 1)).toBe('occupied'); // a drag doesn't eat the line
    const plates = w.state.inventory.iron_plate!;
    const furnace = placed(w.place('furnace', x0 + 4, y, 0, true));
    expect(w.buildingAt(x0 + 5, y)).toBe(furnace);
    expect(w.state.inventory.iron_plate).toBe(plates - 2 + 2); // furnace cost, two belts refunded
    const start = w.state.inventory.iron_plate!;
    run(w, 30);
    expect(w.state.inventory.iron_plate! - start).toBeGreaterThan(10);
    expect(w.place('belt', x0 + 7, y, 0, true)).toBe('occupied'); // belts don't replace belts
  });

  it('starts with a few buildings and unlocks more through research, including the shipyard', () => {
    const w = World.create(3);
    expect(w.isUnlocked('extractor')).toBe(true);
    expect(w.isUnlocked('turret')).toBe(false);
    expect(w.isUnlocked('shipyard')).toBe(false);
    w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999 };
    for (const id of ['defense', 'workshop', 'assembly', 'shipyard']) expect(w.researchNow(id)).toBeNull();
    expect(w.isUnlocked('turret')).toBe(true);
    expect(w.isUnlocked('shipyard')).toBe(true);
  });

  it('hub ports take the chosen item out of stock and face away from the 5×5 hub', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const port = placed(w.place('port', hub.x + 5, hub.y + 2, 1));
    expect(port.dir).toBe(0);
    placed(w.place('belt', hub.x + 6, hub.y + 2, 0));
    w.setFilter(port.id, 'gear');
    const gears = w.state.inventory.gear!;
    run(w, 3);
    expect(w.state.inventory.gear).toBeLessThan(gears);
  });

  it('turrets touching the hub reload from hub stock; others need a belt', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const touching = placed(w.place('turret', hub.x - 1, hub.y + 1, 0));
    const apart = placed(w.place('turret', hub.x - 3, hub.y + 1, 0));
    touching.ammo = 0;
    apart.ammo = 0;
    const plates = w.state.inventory.iron_plate!;
    run(w, 1);
    const def = TURRETS.turret!;
    expect(touching.ammo).toBe(def.maxShots);
    expect(apart.ammo).toBe(0);
    expect(plates - w.state.inventory.iron_plate!).toBe(def.maxShots / def.shotsPerItem);
  });

  it('splitters take from behind and alternate between front, left and right', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 20, 20, 0));
    const out = [placed(w.place('belt', 21, 20, 0)), placed(w.place('belt', 20, 19, 3)), placed(w.place('belt', 20, 21, 1))];
    expect(w.insert(sp, 'gear', 20, 19)).toBe(false); // not from the side
    for (let i = 0; i < 3; i++) {
      expect(w.insert(sp, 'gear', 19, 20)).toBe(true);
      w.tick();
    }
    expect(out.map((b) => b.belt.length)).toEqual([1, 1, 1]);
  });

  it('underground belts carry items under walls', () => {
    const w = emptyWorld();
    const entrance = placed(w.place('tunnel', 20, 20, 0));
    placed(w.place('wall', 21, 20, 0));
    placed(w.place('wall', 22, 20, 0));
    const exit = placed(w.place('tunnel', 23, 20, 0));
    expect(entrance.link).toBe(exit.id);
    const after = placed(w.place('belt', 24, 20, 0));
    w.insert(entrance, 'gear', 19, 20);
    run(w, 4);
    expect(after.belt.length + (w.buildingAt(25, 20) ? 1 : 0)).toBeGreaterThan(0);
  });

  it('repair stations heal nearby buildings using stored plates', () => {
    const w = emptyWorld();
    const wall = placed(w.place('wall', 20, 20, 0));
    placed(w.place('repair', 22, 20, 0));
    wall.hp = 100;
    run(w, 3);
    expect(wall.hp).toBeGreaterThan(100);
  });
});

describe('Bugs', () => {
  it('stroll inside their territory while calm', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 5);
    run(w, 60);
    for (const e of w.state.enemies) {
      expect(e.x).toBeGreaterThanOrEqual(n.x);
      expect(e.x).toBeLessThan(n.x + NESTS.cell);
      expect(e.y).toBeGreaterThanOrEqual(n.y);
      expect(e.y).toBeLessThan(n.y + NESTS.cell);
    }
    expect(isAngry(w, n)).toBe(false);
  });

  it('are provoked by building in or next to their territory, not further away', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50);
    placed(w.place('wall', 50 + NESTS.cell + NESTS.nearMargin + 1, 55, 0));
    expect(isAngry(w, n)).toBe(false);
    placed(w.place('wall', 50 + NESTS.cell + NESTS.nearMargin - 1, 55, 0));
    expect(isAngry(w, n)).toBe(true);
  });

  it('are provoked by a building close to one of them', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    const bug = w.state.enemies[0];
    bug.x = 59.5;
    bug.y = 55.5;
    bug.tx = bug.x;
    bug.ty = bug.y;
    bug.wait = 99; // resting at the edge of its cell
    placed(w.place('wall', 59 + NESTS.closeRadius, 55, 0)); // just outside the territory's margin
    expect(isAngry(w, n)).toBe(false);
    run(w, 1);
    expect(isAngry(w, n)).toBe(true);
  });

  it('are provoked by being shot, then go for the nearest buildings and chew them', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 4);
    const [cx] = nestCentre(n);
    // A turret just outside the margin, in range of the territory.
    const turret = placed(w.place('turret', Math.round(cx), 50 + NESTS.cell + NESTS.nearMargin + 1, 0));
    turret.ammo = 0;
    expect(isAngry(w, n)).toBe(false);
    turret.ammo = 40;
    for (const e of w.state.enemies) {
      e.x = cx;
      e.y = 59.5; // in range of the turret, but not close enough to notice it
    }
    run(w, 1);
    expect(isAngry(w, n)).toBe(true);
    turret.ammo = 0; // out of ammo: the bugs reach it
    run(w, 20);
    expect(turret.hp).toBeLessThan(BUILDINGS.turret.hp);
  });

  it("don't chase past their leash, and calm down after a while", () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 2);
    const [cx, cy] = nestCentre(n);
    const far = placed(w.place('wall', Math.round(cx) + NESTS.leash + 10, Math.round(cy), 0));
    n.angryUntil = w.state.time + 5;
    w.markFlowDirty();
    run(w, 30);
    expect(far.hp).toBe(BUILDINGS.wall.hp);
    for (const e of w.state.enemies) expect(Math.hypot(e.x - cx, e.y - cy)).toBeLessThanOrEqual(NESTS.leash + 1);
    expect(isAngry(w, n)).toBe(false);
  });

  it('standard mode survives losing the hub, at a cost, and the bugs go home', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50);
    n.angryUntil = 1e9;
    w.hub!.hp = 0;
    w.tick();
    expect(w.state.gameOver).toBe(false);
    expect(w.state.breaches).toBe(1);
    expect(w.hub!.hp).toBe(BUILDINGS.hub.hp * BREACH.hubRestore);
    expect(w.state.inventory.iron_plate).toBe(Math.floor(999 * (1 - BREACH.stockLost)));
    expect(isAngry(w, n)).toBe(false);
  });

  it('hardcore mode ends when the hub falls', () => {
    const w = emptyWorld('hardcore');
    w.hub!.hp = 0;
    w.tick();
    expect(w.state.gameOver).toBe(true);
  });

  it('the hub gun shoots bugs in range, without ammo', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const n = addNest(w, 0, 0, 1);
    const bug = w.state.enemies[0];
    bug.x = hub.x - 3;
    bug.y = hub.y + 2;
    bug.wait = 99;
    bug.tx = bug.x;
    bug.ty = bug.y;
    run(w, 3);
    expect(bug.hp).toBeLessThan(bug.maxHp);
    expect(isAngry(w, n)).toBe(true);
  });
});

describe('Research over time', () => {
  it('draws items from stock over its research time, then unlocks', () => {
    const w = emptyWorld();
    w.state.researched = [];
    w.state.inventory = { iron_plate: 100 };
    expect(w.startResearch('defense')).toBeNull();
    run(w, 10);
    const used = 100 - w.state.inventory.iron_plate!;
    expect(used).toBeGreaterThan(3);
    expect(used).toBeLessThan(20);
    run(w, 25);
    expect(w.state.researched).toContain('defense');
  });

  it('stalls when the hub runs out, and keeps progress when switching', () => {
    const w = emptyWorld();
    w.state.researched = [];
    w.state.inventory = { iron_plate: 5, brick: 50 };
    w.startResearch('defense');
    run(w, 20);
    expect(w.state.research.stalled).toBe(true);
    const progress = w.researchProgress('defense');
    w.startResearch('masonry');
    run(w, 5);
    w.startResearch('defense');
    expect(w.researchProgress('defense')).toBe(progress);
  });

  it("won't start research whose prerequisites aren't done", () => {
    const w = emptyWorld();
    w.state.researched = [];
    expect(w.startResearch('shipyard')).toBe('requires');
  });
});

describe('Saves', () => {
  it('round-trip', () => {
    const w = World.create(5);
    run(w, 3);
    const loaded = World.fromJSON(w.toJSON());
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.toJSON()).toBe(w.toJSON());
    expect(loaded.nestCells.size).toBe(w.state.nests.length);
  });

  it('v8 saves gain forest around what is already built', () => {
    const w = World.create(5);
    const x = w.hub!.x - 30;
    w.state.trees.fill(NO_TREE);
    for (let i = 0; i < 20; i++) placed(w.place('belt', x + i, w.hub!.y, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 8;
    delete old.trees;
    delete old.regrow;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.trees.filter((t) => t === TREE).length).toBeGreaterThan(1000);
    for (const b of loaded.state.buildings) {
      const [fw, fh] = loaded.footprintOf(b);
      for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) expect(loaded.treeAt(b.x + dx, b.y + dy)).toBe(NO_TREE);
    }
    expect(World.fromJSON(loaded.toJSON()).toJSON()).toBe(loaded.toJSON());
  });

  it('refuse older versions (a different kind of map)', () => {
    const old = JSON.parse(World.create(5).toJSON());
    old.version = 7;
    expect(() => World.fromJSON(JSON.stringify(old))).toThrow(OldSaveError);
  });
});

describe('Wood', () => {
  /** Plants a square of trees with its top-left at (x, y). */
  function grove(w: World, x: number, y: number, size: number) {
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.state.trees[w.idx(x + dx, y + dy)] = TREE;
  }

  it('forest covers part of the map, never ore or the hub clearing, with a grove close by', () => {
    const w = World.create(42);
    const s = w.state;
    const c = w.hub!.x + Math.floor(HUB_SIZE / 2);
    let count = 0;
    let nearest = Infinity;
    for (let i = 0; i < s.trees.length; i++) {
      if (s.trees[i] !== TREE) continue;
      count++;
      expect(s.resources[i]).toBe(0);
      nearest = Math.min(nearest, Math.hypot((i % s.width) - c, Math.floor(i / s.width) - c));
    }
    expect(count).toBeGreaterThan(s.trees.length * FOREST.share * 0.7);
    expect(nearest).toBeGreaterThanOrEqual(FOREST.clear);
    expect(nearest).toBeLessThan(FOREST.clear + 3);
    expect(World.create(42).state.trees).toEqual(s.trees);
  });

  it('trees block building; stumps do not, and building over them clears them for good', () => {
    const w = emptyWorld();
    const x = w.hub!.x - 10;
    const y = w.hub!.y;
    w.state.trees[w.idx(x, y)] = TREE;
    expect(w.place('belt', x, y, 0)).toBe('tree');
    w.state.trees[w.idx(x, y)] = STUMP;
    w.state.regrow[w.idx(x, y)] = 5;
    placed(w.place('belt', x, y, 0));
    expect(w.treeAt(x, y)).toBe(NO_TREE);
    run(w, 6);
    expect(w.treeAt(x, y)).toBe(NO_TREE);
  });

  it('lumber camps go near trees, cut the nearest into logs, and stumps grow back', () => {
    const w = emptyWorld();
    const x = w.hub!.x - 20;
    const y = w.hub!.y;
    expect(w.place('lumber_camp', x, y, 0)).toBe('needs-trees');
    w.state.trees[w.idx(x - 1, y)] = TREE; // right beside the camp
    w.state.trees[w.idx(x - 3, y)] = TREE; // further away
    const camp = placed(w.place('lumber_camp', x, y, 0));
    run(w, LUMBER.period + 0.1);
    expect(w.treeAt(x - 1, y)).toBe(STUMP);
    expect(w.treeAt(x - 3, y)).toBe(TREE);
    expect(camp.outputs).toEqual(Array(LUMBER.logsPerTree).fill('log'));
    camp.outputs = [];
    run(w, LUMBER.period);
    expect(w.treeAt(x - 3, y)).toBe(STUMP);
    // Nothing left to cut: the camp waits until a stump grows back.
    camp.outputs = [];
    run(w, LUMBER.period * 2);
    expect(camp.outputs).toEqual([]);
    expect(camp.progress).toBe(-1);
    w.demolish(camp.id); // or it would cut the tree again as soon as it grows back
    run(w, LUMBER.regrow);
    expect(w.treeAt(x - 1, y)).toBe(TREE);
  });

  it('logs go by belt into a sawmill, and planks reach the hub', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const y = hub.y + 2;
    grove(w, hub.x - 16, y - 4, 3);
    placed(w.place('lumber_camp', hub.x - 14, y, 0)); // outputs at (hub.x - 12, y)
    placed(w.place('sawmill', hub.x - 12, y, 0)); // outputs at (hub.x - 10, y)
    for (let x = hub.x - 10; x < hub.x; x++) placed(w.place('belt', x, y, 0));
    const before = w.state.inventory.plank ?? 0;
    run(w, 30);
    expect(w.state.inventory.plank ?? 0).toBeGreaterThan(before + 4);
  });

  it('forestry unlocks the camp and sawmill, and palisades cost planks', () => {
    const w = World.create(3);
    expect(w.isUnlocked('lumber_camp')).toBe(false);
    expect(w.checkResearch('palisades')).toBe('requires');
    w.state.inventory.iron_plate = 999;
    expect(w.researchNow('forestry')).toBeNull();
    expect(w.isUnlocked('lumber_camp') && w.isUnlocked('sawmill')).toBe(true);
    const e = emptyWorld();
    const x = e.hub!.x - 10;
    e.state.inventory.plank = 1;
    expect(e.place('palisade', x, e.hub!.y, 0)).toBe('cost');
    e.state.inventory.plank = 2;
    placed(e.place('palisade', x, e.hub!.y, 0));
    expect(e.state.inventory.plank).toBe(0);
  });
});

describe('Colony blueprints', () => {
  it('the express belt needs its blueprint, and moves items twice as fast', () => {
    const w = emptyWorld();
    const y = w.hub!.y - 8;
    const x = w.hub!.x - 10;
    expect(w.place('express_belt', x, y, 0)).toBe('locked');
    w.state.ship.blueprints = ['express_belt'];
    const fast = placed(w.place('express_belt', x, y, 0));
    const slow = placed(w.place('belt', x, y + 2, 0));
    fast.belt.push({ item: 'iron_plate', pos: 0 });
    slow.belt.push({ item: 'iron_plate', pos: 0 });
    run(w, 0.2);
    expect(fast.belt[0].pos).toBeCloseTo(2 * slow.belt[0].pos, 1);
  });

  it('a tap upgrades the whole belt line in place, side merges included, up to other buildings', () => {
    const w = emptyWorld();
    w.state.ship.blueprints = ['express_belt'];
    const y = w.hub!.y - 8;
    const x0 = w.hub!.x - 20;
    const line = [0, 1, 2, 3, 4, 5].map((i) => placed(w.place('belt', x0 + i, y, 0)));
    const merge = placed(w.place('belt', x0 + 2, y + 1, 3)); // feeds in from the side
    placed(w.place('splitter', x0 + 6, y, 0));
    const after = placed(w.place('belt', x0 + 7, y, 0)); // past the splitter: another line
    const apart = placed(w.place('belt', x0, y + 3, 0)); // not joined at all
    line[3].belt.push({ item: 'gear', pos: 0.5 });
    const inv = { ...w.state.inventory };
    expect(w.upgradeBeltLine(x0 + 3, y)).toEqual({ upgraded: 7, left: 0 });
    for (const b of [...line, merge]) expect(b.type).toBe('express_belt');
    expect(merge.dir).toBe(3);
    expect(line[3].belt).toEqual([{ item: 'gear', pos: 0.5 }]);
    expect(after.type).toBe('belt');
    expect(apart.type).toBe('belt');
    // Each upgrade refunds the old belt's plate, so only the gears are spent.
    expect(w.state.inventory.gear).toBe(inv.gear! - 7);
    expect(w.state.inventory.iron_plate).toBe(inv.iron_plate);
    expect(w.upgradeBeltLine(x0 + 3, y)).toBe('occupied'); // already express
    expect(w.upgradeBeltLine(x0 + 6, y)).toBe('occupied'); // a splitter, not a belt
  });

  it('with too little stock, it upgrades the belts nearest the tap and says how many were left', () => {
    const w = emptyWorld();
    w.state.ship.blueprints = ['express_belt'];
    const y = w.hub!.y - 8;
    const x0 = w.hub!.x - 20;
    const line = [0, 1, 2, 3, 4, 5, 6].map((i) => placed(w.place('belt', x0 + i, y, 0)));
    w.state.inventory.gear = 3;
    expect(w.upgradeBeltLine(x0 + 3, y)).toEqual({ upgraded: 3, left: 4 });
    expect(line.map((b) => b.type === 'express_belt')).toEqual([false, false, true, true, true, false, false]);
    expect(w.events.some((e) => e.includes('other 4'))).toBe(true);
    w.state.inventory.gear = 0;
    expect(w.upgradeBeltLine(x0, y)).toBe('cost');
  });

  it('a tesla arcs from the nearest bug to up to two more within reach, and reloads with wire', () => {
    const w = emptyWorld();
    w.state.ship.blueprints = ['tesla'];
    const t = placed(w.place('tesla', w.hub!.x - 20, w.hub!.y - 10, 0));
    const n = addNest(w, 0, 0, 0);
    // A string of bugs 1.5 tiles apart, starting 3 tiles from the tesla.
    const bugs = [0, 1, 2, 3].map((i) => {
      const e = w.spawnBug('crawler', n, 1);
      e.x = t.x + 3.5 + i * 1.5;
      e.y = t.y + 0.5;
      e.hp = e.maxHp = 1000;
      return e;
    });
    w.tick();
    expect(bugs.map((e) => e.hp < 1000)).toEqual([true, true, true, false]);
    expect(w.shots.filter((s) => s.arc).length).toBe(3);
    expect(w.shots.filter((s) => s.jump).length).toBe(2);
    const def = TURRETS.tesla!;
    t.ammo = 0;
    expect(w.insert(t, 'iron_plate', t.x - 1, t.y)).toBe(false);
    expect(w.insert(t, 'wire', t.x - 1, t.y)).toBe(true);
    expect(t.ammo).toBe(def.shotsPerItem);
  });
});

describe('Demo world', () => {
  it('lays out a working factory that delivers to the hub, with calm bugs nearby', () => {
    const w = createDemoWorld();
    const inv = { ...w.state.inventory };
    run(w, 40);
    expect(w.state.inventory.iron_plate!).toBeGreaterThan(inv.iron_plate!);
    expect(w.state.inventory.wire!).toBeGreaterThan(inv.wire!);
    expect(w.state.inventory.brick!).toBeGreaterThan(inv.brick!);
    expect(w.state.inventory.plank ?? 0).toBeGreaterThan(inv.plank ?? 0);
    expect(w.state.nests.every((n) => !isAngry(w, n))).toBe(true);
  });
});
