import { describe, expect, it } from 'vitest';
import { BELT_SPEED, BREACH, BUILDINGS, FOREST, HAND_MINING, HUB_SIZE, PLAYER, ItemId, LUMBER, MAP_SIZE, NESTS, REPAIR, RESEARCH, TURRETS, nestComposition } from './data';
import { Nest, cellKey, hubDistance, isAngry, nestCentre, newNest, threatAt } from './nests';
import { Building, LEFT, NO_TREE, OldSaveError, RIGHT, SAVE_VERSION, STUMP, TICK, TREE, World } from './world';
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
  w.state.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999, plank: 999 };
  return w;
}

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

/** Puts the character on tile (x, y), standing still. */
function stand(w: World, x: number, y: number) {
  const p = w.state.players[0];
  p.x = x + 0.5;
  p.y = y + 0.5;
  p.path = [];
  p.pending = null;
}

/** Ore under a w×h area. */
function ore(w: World, x: number, y: number, kind = 1, size = 2) {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) w.state.resources[w.idx(x + dx, y + dy)] = kind;
}

/** Adds a nest (with `bugs` crawlers) whose cell has its top-left at (x, y). */
function addNest(w: World, x: number, y: number, bugs = 3): Nest {
  const n: Nest = newNest(w.state.nests.length, x, y, 0);
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
    const sizes: [string, number, number][] = [['extractor', 2, 2], ['furnace', 2, 2], ['workshop', 2, 2], ['assembler', 3, 3], ['splitter', 1, 2]];
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
    expect(w.place('belt', 21, 21, 0)).toBe('occupied'); // inside the workshop
    expect(w.place('extractor', 30, 30, 0)).toBe('needs-resource');
    expect(w.place('workshop', MAP_SIZE - 1, 10, 0)).toBe('bounds');
    expect(w.place('port', 60, 60, 0)).toBe('needs-hub');
    w.demolish(b.id);
    expect(w.state.inventory.iron_plate).toBe(before);
  });

  it('turn in place only when their new footprint is free', () => {
    const w = emptyWorld();
    const b = placed(w.place('splitter', 20, 20, 0)); // 1 along, 2 across
    expect(w.rotate(b.id)).toBe(true); // facing south: 2 wide, 1 deep
    expect(w.buildingAt(21, 20)).toBe(b);
    expect(w.buildingAt(20, 21)).toBeUndefined();
    placed(w.place('wall', 20, 21, 0));
    expect(w.rotate(b.id)).toBe(false); // facing west it would cover the wall
  });

  it('output from the middle of the side they face', () => {
    const w = emptyWorld();
    const b = placed(w.place('workshop', 20, 20, 1)); // facing south: 2×2
    expect(w.outputTile(b)).toEqual({ x: 20, y: 22, fromX: 20, fromY: 21 });
    const a = placed(w.place('assembler', 30, 20, 0)); // facing east: 3×3, so a true middle
    expect(w.outputTile(a)).toEqual({ x: 33, y: 21, fromX: 32, fromY: 21 });
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
    expect(w.state.inventory.iron_plate).toBe(plates + 2); // two belts refunded (a furnace costs stone)
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
    w.state.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999, plank: 999 };
    expect(w.researchNow('workshop')).toBe('requires'); // workshops need planks, so Forestry comes first
    for (const id of ['defense', 'forestry', 'workshop', 'assembly', 'shipyard']) expect(w.researchNow(id)).toBeNull();
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

  it('splitters span two lanes, take from behind either one and alternate between the two outputs (#34)', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 20, 20, 0)); // tiles (20,20) and (20,21)
    const out = [placed(w.place('belt', 21, 20, 0)), placed(w.place('belt', 21, 21, 0))];
    expect(w.insert(sp, 'gear', 20, 19)).toBe(false); // not from the side
    expect(w.insert(sp, 'gear', 21, 20)).toBe(false); // nor from the front
    for (let i = 0; i < 4; i++) {
      expect(w.insert(sp, 'gear', 19, 20 + (i % 2))).toBe(true); // behind either lane
      for (let t = 0; t < 10; t++) w.tick();
    }
    expect(out.map((b) => b.belt.length)).toEqual([2, 2]);
    // With one lane blocked, everything goes out of the other.
    w.demolish(out[1].id);
    for (let i = 0; i < 2; i++) {
      expect(w.insert(sp, 'gear', 19, 20)).toBe(true);
      for (let t = 0; t < 10; t++) w.tick();
    }
    expect(out[0].belt.length).toBeGreaterThanOrEqual(2);
  });

  it('move items at an even speed across belt tiles, with no pause or jump at the edges', () => {
    const w = emptyWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 6;
    const line = Array.from({ length: 10 }, (_, i) => placed(w.place('belt', x0 + i, y, 0)));
    const it = { item: 'iron_plate' as ItemId, pos: 0, lane: 1 as const };
    line[0].belt.push(it);
    const travelled = () => line.findIndex((b) => b.belt.includes(it)) + it.pos;
    let last = travelled();
    for (let t = 0; t < 4; t += TICK) {
      w.tick();
      const now = travelled();
      expect(now - last).toBeCloseTo(BELT_SPEED * TICK, 9);
      last = now;
    }
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
    expect(far.hp).toBe(w.maxHp(far));
    for (const e of w.state.enemies) expect(Math.hypot(e.x - cx, e.y - cy)).toBeLessThanOrEqual(NESTS.leash + 1);
    expect(isAngry(w, n)).toBe(false);
  });

  it('spread into neighbouring cells without a live nest, never into a live one or onto buildings', () => {
    const w = emptyWorld();
    addNest(w, 50, 50, 2);
    const b = addNest(w, 60, 50, 2); // a live neighbour: its cell is never taken
    addNest(w, 50, 60, 0).destroyed = true; // a destroyed neighbour: can be taken over
    placed(w.place('wall', 45, 55, 0)); // the cell to the left holds a building: stays clear
    const spreads = () => w.state.nests.length - 3;
    for (let i = 0; i < 6; i++) {
      w.state.nextSpread = w.state.time; // spread now
      w.tick();
    }
    expect(spreads()).toBe(6);
    const owners = new Map<string, number>();
    for (const n of w.state.nests.slice(3)) {
      const key = `${n.x},${n.y}`;
      expect(owners.has(key), `two new nests in ${key}`).toBe(false);
      owners.set(key, n.id);
      expect(n.x === b.x && n.y === b.y, 'took the live neighbour').toBe(false);
      expect(n.x === 40 && n.y === 50, 'settled on a building').toBe(false);
      expect(w.state.enemies.some((e) => e.nest === n.id)).toBe(true);
    }
    // The first spreads can only come from a or b; each new nest borders an older live one.
    expect(w.state.nests.slice(3).every((n) => w.state.nests.some((o) => o.id < n.id && Math.abs(o.x - n.x) + Math.abs(o.y - n.y) === NESTS.cell))).toBe(true);
  });

  it('spread on a timer, a few minutes apart', () => {
    const w = emptyWorld();
    addNest(w, 50, 50, 2);
    run(w, NESTS.spreadEvery - 1);
    expect(w.state.nests.length).toBe(1);
    run(w, 2);
    expect(w.state.nests.length).toBe(2);
    expect(w.events).toContain('Bugs have spread into a new territory.');
  });

  it('hold still at the end of their leash instead of twitching back and forth', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 3);
    const [cx, cy] = nestCentre(n);
    placed(w.place('wall', Math.round(cx) + NESTS.leash + 3, Math.round(cy), 0));
    n.angryUntil = w.state.time + 120;
    w.markFlowDirty();
    run(w, 60); // time to reach the edge
    let moved = 0;
    for (let t = 0; t < 3; t += TICK) {
      const last = w.state.enemies.map((e) => [e.x, e.y]);
      w.tick();
      w.state.enemies.forEach((e, i) => (moved += Math.hypot(e.x - last[i][0], e.y - last[i][1])));
    }
    expect(moved).toBeLessThan(0.01);
    for (const e of w.state.enemies) expect(Math.hypot(e.x - cx, e.y - cy)).toBeGreaterThan(NESTS.leash - 1);
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
    w.state.researched.push('logistics');
    w.state.inventory.iron_plate = 20;
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

  it('v11 saves gain path timers and a player, and rebuild their paths on loading', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 11;
    delete old.paths;
    delete old.players;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.players.map((p) => p.id)).toEqual([0]);
    expect(loaded.state.paths).toEqual({ dirty: true, at: null, shipDirty: true, shipAt: null });
    // Beside the hub there's a short, finite way to it: the field was built (an unbuilt one is all zeros).
    const near = loaded.flow[loaded.idx(loaded.hub!.x - 2, loaded.hub!.y)];
    expect(near).toBeGreaterThan(0);
    expect(Number.isFinite(near)).toBe(true);
  });

  it('v12 saves get a timer for territories spreading', () => {
    const w = World.create(5);
    run(w, 10);
    const old = JSON.parse(w.toJSON());
    old.version = 12;
    delete old.nextSpread;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.nextSpread).toBeCloseTo(w.state.time + NESTS.spreadEvery);
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
    run(w, LUMBER.regrow + LUMBER.regrowSpread);
    expect(w.treeAt(x - 1, y)).toBe(TREE);
  });

  it("stumps grow back at staggered times, so a camp's output evens out", () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const x = hub.x - 14;
    const y = hub.y + 2;
    grove(w, x - 3, y - 3, 3);
    const camp = placed(w.place('lumber_camp', x, y, 0));
    for (let t = 0; t < 40; t += TICK) {
      camp.outputs = [];
      w.tick();
    }
    const times = Object.values(w.state.regrow);
    expect(times.length).toBeGreaterThan(5);
    const growIn = times.map((t) => t - w.state.time);
    for (const g of growIn) expect(g).toBeLessThanOrEqual(LUMBER.regrow + LUMBER.regrowSpread);
    // Not all on the same schedule: cut 3 s apart, they'd otherwise come back 3 s apart too.
    const sorted = [...times].sort((p, q) => p - q);
    const gaps = sorted.slice(1).map((t, i) => t - sorted[i]);
    expect(gaps.some((g) => Math.abs(g - LUMBER.period) > 5)).toBe(true);
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

describe('Wood in the economy', () => {
  it('a sawmill saws planks into stakes; a furnace burns logs into charcoal, then makes steel', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const saw = placed(w.place('sawmill', hub.x - 20, hub.y - 10, 0));
    w.setRecipe(saw.id, 'stake');
    for (let i = 0; i < 2; i++) w.insert(saw, 'plank', saw.x - 1, saw.y);
    const furnace = placed(w.place('furnace', hub.x - 20, hub.y - 4, 0));
    for (let i = 0; i < 2; i++) expect(w.insert(furnace, 'log', furnace.x - 1, furnace.y)).toBe(true);
    expect(furnace.recipe).toBe('charcoal');
    run(w, 3);
    expect(saw.outputs.filter((o) => o === 'stake').length).toBeGreaterThanOrEqual(3);
    expect(furnace.outputs).toEqual(['charcoal']);
    // A furnace fed plates and charcoal makes steel.
    const steel = placed(w.place('furnace', hub.x - 20, hub.y + 2, 0));
    for (let i = 0; i < 2; i++) expect(w.insert(steel, 'iron_plate', steel.x - 1, steel.y)).toBe(true);
    expect(steel.recipe).toBe('steel');
    expect(w.insert(steel, 'charcoal', steel.x - 1, steel.y)).toBe(true);
    run(w, 3.5);
    expect(steel.outputs).toEqual(['steel']);
  });

  it('a ballista reaches further than a turret and reloads with stakes', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const x = hub.x - 20;
    const y = hub.y - 10;
    const ballista = placed(w.place('ballista', x, y, 0));
    const turret = placed(w.place('turret', x, y + 4, 0));
    const n = addNest(w, 0, 0, 0);
    // A bug 6 tiles from the ballista, and more than 5 from the turret.
    const e = w.spawnBug('crawler', n, 1);
    e.x = x + 6.5;
    e.y = y + 0.5;
    e.hp = e.maxHp = 1000;
    const before = turret.ammo;
    w.tick();
    expect(e.hp).toBe(1000 - TURRETS.ballista!.damage);
    expect(turret.ammo).toBe(before); // out of the turret's reach
    ballista.ammo = 0;
    expect(w.insert(ballista, 'plank', x - 1, y)).toBe(false);
    expect(w.insert(ballista, 'stake', x - 1, y)).toBe(true);
    expect(ballista.ammo).toBe(TURRETS.ballista!.shotsPerItem);
  });

  it('repair stations burn planks as well as iron plates', () => {
    const w = emptyWorld();
    const r = placed(w.place('repair', w.hub!.x - 20, w.hub!.y - 10, 0));
    r.ammo = 0;
    expect(w.insert(r, 'plank', r.x - 1, r.y)).toBe(true);
    expect(r.ammo).toBe(REPAIR.hpPerPlank);
    expect(w.insert(r, 'iron_plate', r.x - 1, r.y)).toBe(true);
    expect(r.ammo).toBe(REPAIR.hpPerPlank + REPAIR.hpPerPlate);
    expect(w.insert(r, 'log', r.x - 1, r.y)).toBe(false);
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
    fast.belt.push({ item: 'iron_plate', pos: 0, lane: 1 });
    slow.belt.push({ item: 'iron_plate', pos: 0, lane: 1 });
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
    line[3].belt.push({ item: 'gear', pos: 0.5, lane: 1 });
    const inv = { ...w.state.inventory };
    expect(w.upgradeBeltLine(x0 + 3, y)).toEqual({ upgraded: 7, left: 0 });
    for (const b of [...line, merge]) expect(b.type).toBe('express_belt');
    expect(merge.dir).toBe(3);
    expect(line[3].belt).toEqual([{ item: 'gear', pos: 0.5, lane: 1 }]);
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

describe('Starting from nothing (#38)', () => {
  it('starts with an empty hub, only extractors and furnaces, and Logistics to research first', () => {
    const w = World.create(3);
    expect(w.state.inventory).toEqual({});
    expect(w.isUnlocked('furnace')).toBe(true);
    expect(w.isUnlocked('extractor')).toBe(true);
    expect(w.isUnlocked('belt')).toBe(false);
    expect(w.availableResearch().map((r) => r.id)).toContain('logistics');
    expect(BUILDINGS.furnace.cost).toEqual({ stone: 6 });
    expect(Object.keys(BUILDINGS.extractor.cost).sort()).toEqual(['iron_ore', 'stone']);
  });

  it('eight taps in a row on an ore tile loosen one ore, which the character carries', () => {
    const w = emptyWorld();
    w.state.inventory = {};
    const [x, y] = [w.hub!.x - 6, w.hub!.y];
    ore(w, x, y, 3, 1);
    stand(w, x + 1, y);
    for (let i = 1; i < HAND_MINING.taps; i++) {
      const tap = w.mineByHand(x, y);
      expect(typeof tap !== 'string' && tap.item).toBe(null);
      expect(w.handMiningAt(x, y)).toBe(i);
    }
    const last = w.mineByHand(x, y);
    expect(typeof last !== 'string' && last.item).toBe('stone');
    expect(w.state.players[0].carry).toEqual(['stone']);
    expect(w.state.inventory.stone).toBeUndefined(); // not in the hub until it's carried there
    expect(w.handMiningAt(x, y)).toBe(0);
    expect(w.taps.length).toBe(HAND_MINING.taps);
    run(w, 1.1);
    expect(w.taps.length).toBe(0); // the sparks have faded
  });

  it('the count starts over on another tile or after a pause, and bare ground or buildings cannot be mined', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 8, w.hub!.y];
    ore(w, x, y, 1, 2);
    stand(w, x - 1, y);
    for (let i = 0; i < 5; i++) w.mineByHand(x, y);
    w.mineByHand(x + 1, y);
    expect(w.handMiningAt(x, y)).toBe(0);
    expect(w.handMiningAt(x + 1, y)).toBe(1);
    run(w, HAND_MINING.resetAfter + 0.5);
    expect(w.handMiningAt(x + 1, y)).toBe(0);
    w.mineByHand(x + 1, y);
    expect(w.handMiningAt(x + 1, y)).toBe(1);
    expect(w.mineByHand(x - 3, y)).toBe('no-ore');
    placed(w.place('extractor', x, y, 0));
    expect(w.mineByHand(x, y)).toBe('occupied');
  });

  it('from nothing: mine, carry it to the hub, build a furnace and an extractor, and collect plates without belts', () => {
    const w = emptyWorld();
    w.state.researched = [];
    w.state.inventory = {};
    const [x, y] = [w.hub!.x - 14, w.hub!.y];
    ore(w, x, y, 3, 1); // one stone tile
    ore(w, x, y + 3, 1, 2); // iron ore
    const mine = (tx: number, ty: number, n: number) => {
      expect(w.mineByHand(tx, ty)).toBe('far'); // the character walks over first
      run(w, 8); // there, and the first tap's count has run out
      for (let i = 0; i < n * HAND_MINING.taps; i++) w.mineByHand(tx, ty);
    };
    mine(x, y, 10);
    mine(x, y + 3, 4);
    expect(w.state.players[0].carry.length).toBe(14);
    const hub = w.hub!;
    w.moveTo(hub.x - 1, hub.y + 2); // walking up to the hub drops everything off
    run(w, 8);
    expect(w.state.players[0].carry).toEqual([]);
    expect(w.state.inventory).toEqual({ stone: 10, iron_ore: 4 });
    placed(w.place('extractor', x, y + 3, 0));
    const fu = placed(w.place('furnace', x + 2, y + 3, 0));
    expect(w.state.inventory).toEqual({ stone: 0, iron_ore: 0 });
    run(w, 12);
    expect(fu.outputs.length).toBeGreaterThan(0);
    expect(w.collect(fu.id)).toBe(0); // out of reach: the character goes to fetch them
    run(w, 8);
    expect(w.state.players[0].carry.length).toBeGreaterThan(0);
    expect(w.collect(w.hub!.id)).toBe(0);
    w.moveTo(hub.x - 1, hub.y + 2);
    run(w, 8);
    expect(w.state.inventory.iron_plate).toBeGreaterThan(0);
  });

  it('v14 saves resize workshops, assemblers and splitters, keeping outputs where they were or refunding (#33, #34)', () => {
    const w = emptyWorld();
    const ws = placed(w.place('workshop', 20, 20, 0));
    const as = placed(w.place('assembler', 40, 20, 0));
    const free = placed(w.place('splitter', 60, 20, 0));
    const boxed = placed(w.place('splitter', 70, 20, 0));
    for (const y of [19, 22]) placed(w.place('wall', 70, y, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 14;
    // As they stood at the old sizes: the boxed splitter's second tile was a wall.
    old.buildings.find((b: Building) => b.id === boxed.id).y = 20;
    old.buildings.push({ ...old.buildings.find((b: Building) => b.type === 'wall'), id: 9999, x: 70, y: 21 });
    const plates = old.inventory.iron_plate;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    const at = (id: number) => loaded.byId.get(id);
    // The workshop (3×2 → 2×2) keeps its output tile at (23, 20).
    expect([at(ws.id)!.x, at(ws.id)!.y]).toEqual([21, 20]);
    expect(loaded.outputTile(at(ws.id)!)).toMatchObject({ x: 23, y: 20 });
    // The assembler (4×2 → 3×3) also keeps its output at (44, 20).
    expect(loaded.outputTile(at(as.id)!)).toMatchObject({ x: 44, y: 20 });
    expect(at(free.id)).toBeDefined();
    expect(at(boxed.id)).toBeUndefined(); // walls above, below and in its second lane
    expect(loaded.state.inventory.iron_plate).toBe(plates + BUILDINGS.splitter.cost.iron_plate!);
    // No two buildings overlap.
    const seen = new Set<number>();
    for (const b of loaded.state.buildings) {
      const [fw, fh] = loaded.footprintOf(b);
      for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) {
        const i = loaded.idx(b.x + dx, b.y + dy);
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    }
  });

  it('v13 saves get Logistics as done, and the old Underground Belt research goes away', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 13;
    old.researched = ['forestry', 'underground'];
    old.research.active = 'logistics';
    old.research.paid = { logistics: { iron_plate: 5 } };
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.researched.sort()).toEqual(['forestry', 'logistics']);
    expect(loaded.state.research.active).toBe(null);
    expect(loaded.state.research.paid).toEqual({});
    expect(loaded.isUnlocked('belt')).toBe(true);
    expect(loaded.isUnlocked('tunnel')).toBe(true);
  });
});

describe('Nest mounds and chitin (D-065)', () => {
  it('turrets with no bugs in reach shoot a mound; destroying it clears the territory and drops chitin', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 0);
    const t = placed(w.place('turret', 57, 54, 0)); // next to the mound in the middle of the cell
    t.ammo = 50;
    expect(w.place('wall', 54, 54, 0)).toBe('nest'); // the mound's own tiles
    const hp = n.hp;
    for (let i = 0; i < 20; i++) w.tick();
    expect(n.hp).toBeLessThan(hp);
    expect(isAngry(w, n)).toBe(true); // shooting the mound wakes the nest
    n.hp = 1;
    const chitin = w.state.inventory.chitin ?? 0;
    run(w, 2);
    expect(n.destroyed).toBe(true);
    expect(w.state.inventory.chitin).toBeGreaterThan(chitin);
    expect(w.events.some((e) => e.startsWith('Nest destroyed'))).toBe(true);
    expect(placed(w.place('wall', 54, 54, 0))).toBeDefined(); // the ground is free now
    const ammo = t.ammo;
    run(w, 2);
    expect(t.ammo).toBe(ammo); // nothing left to shoot
  });

  it("a destroyed nest's survivors stay angry and chase past the leash", () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 2);
    const [cx, cy] = nestCentre(n);
    const far = placed(w.place('wall', Math.round(cx) + NESTS.leash + 6, Math.round(cy), 0));
    n.hp = 0;
    n.destroyed = true;
    w.markFlowDirty();
    run(w, 60);
    expect(isAngry(w, n)).toBe(true);
    expect(far.hp).toBeLessThan(w.maxHp(far));
  });

  it('Chitin Plating gives turrets and walls more health, including ones already built', () => {
    const w = emptyWorld();
    w.state.researched = w.state.researched.filter((r) => r !== 'plating');
    const wall = placed(w.place('wall', 20, 20, 0));
    const furnace = placed(w.place('furnace', 30, 20, 0));
    expect(wall.hp).toBe(BUILDINGS.wall.hp);
    w.state.inventory.chitin = 10;
    expect(w.researchNow('plating')).toBe(null);
    expect(wall.hp).toBe(BUILDINGS.wall.hp * 1.5);
    expect(w.maxHp(furnace)).toBe(BUILDINGS.furnace.hp);
    expect(placed(w.place('wall', 21, 20, 0)).hp).toBe(BUILDINGS.wall.hp * 1.5);
  });

  it('v15 saves give nests mounds; nests with no bugs left count as destroyed', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 15;
    for (const n of old.nests) {
      delete n.hp;
      delete n.maxHp;
    }
    const bare = old.nests.find((n: Nest) => n.id === 0);
    old.enemies = old.enemies.filter((e: { nest: number }) => e.nest !== bare.id);
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.nests[0].destroyed).toBe(true);
    const live = loaded.state.nests[1];
    expect(live.destroyed).toBeUndefined();
    expect(live.hp).toBe(live.maxHp);
    expect(live.hp).toBeGreaterThanOrEqual(300);
  });
});

describe('The player character (#40)', () => {
  it('starts below the hub and walks around solid buildings to where it is sent', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    const hub = w.hub!;
    expect([p.x, p.y]).toEqual([hub.x + 2.5, hub.y + 5.5]);
    stand(w, 20, 20);
    for (let y = 15; y <= 25; y++) placed(w.place('wall', 23, y, 0));
    placed(w.place('belt', 22, 20, 0)); // belts can be walked over
    expect(w.moveTo(26, 20)).toBe(true);
    expect(p.path.every((i) => !w.buildingAt(i % w.state.width, Math.floor(i / w.state.width))?.type.includes('wall'))).toBe(true);
    run(w, 10);
    expect([p.x, p.y]).toEqual([26.5, 20.5]);
  });

  it('walks with the keys, sliding along walls, and stops when told', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    stand(w, 20, 20);
    placed(w.place('wall', 21, 20, 0));
    w.walk(1, 0);
    run(w, 1);
    expect(p.x).toBeLessThan(21); // the wall stops it
    w.walk(1, 1);
    run(w, 1);
    expect(p.y).toBeGreaterThan(21); // diagonal: slides down past the wall
    w.walk(0, 0);
    const at = [p.x, p.y];
    run(w, 1);
    expect([p.x, p.y]).toEqual(at);
  });

  it('carries at most a handful, drops it all into the hub on walking up, and hands buildings what they take', () => {
    const w = emptyWorld();
    w.state.inventory = {};
    const p = w.state.players[0];
    const [x, y] = [w.hub!.x - 10, w.hub!.y];
    ore(w, x, y, 1, 1);
    stand(w, x + 1, y);
    for (let i = 0; i < (PLAYER.carry + 1) * HAND_MINING.taps; i++) w.mineByHand(x, y);
    expect(p.carry.length).toBe(PLAYER.carry);
    expect(w.mineByHand(x, y)).toBe('full');
    w.state.inventory = { stone: 6 };
    const fu = placed(w.place('furnace', x + 3, y + 3, 0));
    expect(w.dropOff(fu.id)).toBe(0); // not in reach yet: walks over, then hands it in
    run(w, 4);
    const left = p.carry.length;
    expect(left).toBeLessThan(PLAYER.carry); // the furnace took what it had room for
    expect(left).toBeGreaterThan(0);
    w.moveTo(w.hub!.x - 1, w.hub!.y + 2);
    run(w, 6);
    expect(p.carry).toEqual([]);
    expect(w.state.inventory.iron_ore).toBe(left);
  });

  it('stops if something is built across its path', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    stand(w, 20, 20);
    w.moveTo(30, 20);
    run(w, 0.5);
    for (let y = 18; y <= 22; y++) placed(w.place('wall', 24, y, 0));
    run(w, 5);
    expect(p.x).toBeLessThan(24);
    expect(p.path).toEqual([]);
  });

  it('v16 saves get a character just below the hub', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 16;
    old.players = [{ id: 0 }];
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    const p = loaded.state.players[0];
    expect([p.x, p.y]).toEqual([loaded.hub!.x + 2.5, loaded.hub!.y + 5.5]);
    expect(p.carry).toEqual([]);
  });
});

describe('Two-lane belts and splitter filters (#61, #62)', () => {
  const lanesOf = (b: Building) => b.belt.map((it) => it.lane);

  it("buildings put items on a belt's right lane; a belt fed from the side puts them on the near lane", () => {
    const w = emptyWorld();
    const line = [20, 21, 22, 23, 24].map((x) => placed(w.place('belt', x, 20, 0))); // east
    expect(w.insert(line[0], 'gear', 19, 20)).toBe(true); // from a building behind it
    expect(lanesOf(line[0])).toEqual([RIGHT]);
    const north = placed(w.place('belt', 22, 19, 1)); // runs south into the line's left side
    const south = placed(w.place('belt', 23, 21, 3)); // runs north into its right side
    north.belt.push({ item: 'wire', pos: 1, lane: RIGHT });
    south.belt.push({ item: 'plank', pos: 1, lane: LEFT });
    w.tick();
    expect(line[2].belt.find((it) => it.item === 'wire')?.lane).toBe(LEFT);
    expect(line[3].belt.find((it) => it.item === 'plank')?.lane).toBe(RIGHT);
  });

  it('a belt holds two lanes, each as full as a whole belt used to be', () => {
    const w = emptyWorld();
    const b = placed(w.place('belt', 20, 20, 0));
    let n = 0;
    for (const lane of [LEFT, RIGHT]) {
      for (let i = 0; i < 10; i++) {
        if (w.insert(b, 'gear', 19, 20, lane)) n++;
        b.belt.forEach((it) => it.lane === lane && (it.pos += BELT_SPEED * TICK * 4));
      }
    }
    expect(b.belt.filter((it) => it.lane === LEFT).length).toBeGreaterThan(1);
    expect(b.belt.filter((it) => it.lane === RIGHT).length).toBe(b.belt.filter((it) => it.lane === LEFT).length);
    expect(n).toBe(b.belt.length);
  });

  it('items keep their lane round a corner and through an underground belt', () => {
    const w = emptyWorld();
    const a = placed(w.place('belt', 20, 20, 0)); // east
    placed(w.place('belt', 21, 20, 1)); // then south: a corner
    const c = placed(w.place('belt', 21, 21, 1));
    a.belt.push({ item: 'gear', pos: 0.9, lane: LEFT });
    run(w, 1);
    expect(c.belt.some((it) => it.item === 'gear' && it.lane === LEFT)).toBe(true);

    const t = emptyWorld();
    const feed = placed(t.place('belt', 30, 30, 0));
    placed(t.place('tunnel', 31, 30, 0));
    placed(t.place('tunnel', 34, 30, 0));
    const after = placed(t.place('belt', 35, 30, 0));
    feed.belt.push({ item: 'wire', pos: 0.9, lane: LEFT });
    run(t, 4);
    expect(after.belt.some((it) => it.item === 'wire' && it.lane === LEFT)).toBe(true);
  });

  it('a splitter keeps lanes; with a filter, that item goes out of its side and the rest out of the other', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 20, 20, 0)); // facing east: lane 0 (north) is its left
    expect(w.splitterLeft(sp)).toBe(0);
    const top = placed(w.place('belt', 21, 20, 0));
    const bottom = placed(w.place('belt', 21, 21, 0));
    expect(w.insert(sp, 'gear', 19, 20, LEFT)).toBe(true);
    w.tick();
    expect([...top.belt, ...bottom.belt].map((it) => it.lane)).toEqual([LEFT]);
    w.setFilter(sp.id, 'wire');
    w.setSplitterSide(sp.id, 'right');
    const feed = (item: ItemId) => {
      expect(w.insert(sp, item, 19, 20, RIGHT)).toBe(true);
      for (let i = 0; i < 10; i++) w.tick();
    };
    for (const item of ['wire', 'gear', 'wire', 'plank'] as ItemId[]) feed(item);
    const items = (b: Building) => b.belt.map((it) => it.item).sort();
    expect(items(bottom)).toEqual(['wire', 'wire']); // right side, facing east
    expect(items(top)).toEqual(['gear', 'gear', 'plank']);
    expect(w.splitterLeft(placed(w.place('splitter', 40, 40, 2)))).toBe(1); // facing west, lane 1 (south) is on its left
  });

  it('v17 saves put belt items on the right lane', () => {
    const w = emptyWorld();
    const b = placed(w.place('belt', 20, 20, 0));
    b.belt.push({ item: 'gear', pos: 0.5, lane: LEFT });
    const old = JSON.parse(w.toJSON());
    old.version = 17;
    for (const ob of old.buildings) for (const it of ob.belt) delete it.lane;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.byId.get(b.id)!.belt[0].lane).toBe(RIGHT);
  });
});

describe('Nests breed (D-065)', () => {
  it('a calm nest short of bugs breeds young ones, one at a time, up to what it started with', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1); // a nest this close starts with 3 crawlers
    const bugs = () => w.state.enemies.filter((e) => e.nest === n.id); // territories may spread meanwhile
    expect(n.brood).toEqual({ crawler: 3, runner: 0, brute: 0 });
    run(w, NESTS.breedEvery[0] - 2);
    expect(bugs().length).toBe(1);
    run(w, NESTS.breedEvery[1] - NESTS.breedEvery[0] + 4);
    expect(bugs().length).toBe(2);
    const young = bugs()[1];
    expect(young.born).toBeDefined();
    expect(young.hp).toBeLessThan(young.maxHp * 0.6);
    run(w, 2 * NESTS.breedEvery[1] + 4);
    expect(bugs().length).toBe(3);
    run(w, 2 * NESTS.breedEvery[1]);
    expect(bugs().length).toBe(3); // full: no more
  });

  it('an angry nest, or a destroyed one, does not breed', () => {
    const w = emptyWorld();
    const angry = addNest(w, 50, 50, 1);
    const gone = addNest(w, 80, 50, 1);
    gone.destroyed = true;
    gone.hp = 0;
    for (let t = 0; t < NESTS.breedEvery[1] * 2; t += 1) {
      angry.angryUntil = w.state.time + 30;
      run(w, 1);
    }
    expect(w.state.enemies.filter((e) => e.nest === angry.id).length).toBe(1);
    expect(w.state.enemies.filter((e) => e.nest === gone.id).length).toBe(1);
  });

  it('young bugs grow into adults: health rises, damage taken stays', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 0);
    const e = w.spawnBug('crawler', n, 1, true);
    expect(e.hp).toBe(e.maxHp * NESTS.young);
    e.hp -= 2; // hurt a little
    run(w, NESTS.growUp / 2);
    expect(e.hp).toBeCloseTo(e.maxHp * 0.75 - 2, 0);
    run(w, NESTS.growUp / 2 + 1);
    expect(e.born).toBeUndefined();
    expect(e.hp).toBeCloseTo(e.maxHp - 2, 0);
  });

  it('v18 saves give nests the brood a nest that far out starts with', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 18;
    for (const n of old.nests) {
      delete n.brood;
      delete n.nextBreed;
    }
    const loaded = World.fromJSON(JSON.stringify(old));
    for (const n of loaded.state.nests) {
      expect(n.brood.crawler).toBeGreaterThanOrEqual(3);
      expect(n.nextBreed).toBe(0);
    }
  });
});

describe('Threat (D-065)', () => {
  it('rises every NESTS.threatEvery seconds, up to the maximum, with a message', () => {
    expect(threatAt(0)).toBe(0);
    expect(threatAt(NESTS.threatEvery - 1)).toBe(0);
    expect(threatAt(NESTS.threatEvery)).toBe(1);
    expect(threatAt(NESTS.threatEvery * 99)).toBe(NESTS.threatMax);
    const w = emptyWorld();
    w.state.time = NESTS.threatEvery - 0.01;
    w.tick();
    expect(w.events.some((e) => e.startsWith('Threat level 1'))).toBe(true);
  });

  it('makes newly bred bugs tougher, and more often runners, without growing the nest', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 0);
    n.brood = { crawler: 40, runner: 0, brute: 0 };
    w.state.time = NESTS.threatEvery * 6; // level 6: 48% of crawlers hatch as runners
    w.state.nextSpread = Infinity;
    for (let i = 0; i < 40; i++) {
      n.nextBreed = w.state.time;
      run(w, 1);
    }
    const bugs = w.state.enemies.filter((e) => e.nest === n.id);
    expect(bugs.length).toBe(40);
    const runners = bugs.filter((e) => e.type === 'runner').length;
    expect(runners).toBeGreaterThan(8);
    expect(runners).toBeLessThan(32);
    const crawler = bugs.find((e) => e.type === 'crawler')!;
    expect(crawler.maxHp).toBe(Math.round(18 * nestComposition(hubDistance(w, n)).hpMult * 1.9)); // +15% a level
    run(w, NESTS.breedEvery[1] * 2);
    expect(w.state.enemies.filter((e) => e.nest === n.id).length).toBe(40); // runners fill crawler places
  });

  it('makes territories spread sooner', () => {
    const w = emptyWorld();
    w.state.time = NESTS.threatEvery * 5;
    w.state.nextSpread = w.state.time;
    addNest(w, 100, 100, 1);
    w.tick();
    expect(w.state.nextSpread - w.state.time).toBeCloseTo(NESTS.spreadEvery * (1 - NESTS.threatSpread * 5), 0);
  });

  it("shooting a nest's bugs wakes the nests around it, but not ones further off", () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    const next = addNest(w, 60, 60, 1);
    const far = addNest(w, 80, 50, 1);
    const bug = w.state.enemies.find((e) => e.nest === n.id)!;
    const t = placed(w.place('turret', Math.floor(bug.x) + 3, Math.floor(bug.y), 0));
    t.ammo = 20;
    run(w, 1);
    expect(isAngry(w, n)).toBe(true);
    expect(isAngry(w, next)).toBe(true);
    expect(isAngry(w, far)).toBe(false);
  });
});
