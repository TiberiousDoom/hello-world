import { describe, expect, it } from 'vitest';
import { sightOf } from './fog';
import {
  ARC_FENCE,
  DEFENCE_TIERS,
  DIFFICULTY,
  DRONES,
  FLOODLIGHT,
  RECIPE_BY_ID,
  SHIELD,
  STRIKE,
  TELEPORT,
  BELT_SPACING,
  BELT_SPEED,
  BREACH,
  BUILDINGS,
  CRATE_SIZE,
  ENEMIES,
  EXTRACTOR_PERIOD,
  ELECTRIC,
  ELECTRIC_DEFENCES,
  EXPRESS_BELT_SPEED,
  FUEL,
  HYDRAULIC,
  MK2,
  MK3,
  ORE,
  SILO,
  SULFUR,
  POWER,
  PONDS,
  STORAGE,
  ROLLER,
  SPIKES,
  FOREST,
  HAND_MINING,
  HUB_SIZE,
  PLAYER,
  ItemId,
  LUMBER,
  MAP_SIZE,
  NESTS,
  REPAIR,
  RESEARCH,
  RESEARCH_BY_ID,
  TURRETS,
  HARDCORE_NESTS,
  NURSERY,
  QUEENS,
  nestComposition,
  nestKindFor,
  stageSize,
  startLoad,
  BUG_SPACING,
  BuildingType,
} from './data';
import { Nest, anyAngry, broodSize, bugDef, cellKey, coverTiles, damageMound, hubDistance, isAngry, moundTile, nestAt, nestCentre, newNest, onBugHurt, territory, threatAt } from './nests';
import { Building, LEFT, NO_TREE, OldSaveError, RIGHT, defenceTierCost, electricUse, outOfFuel, SAVE_VERSION, SPLITTER_SORT_WINDOW, STUMP, TICK, TREE, World } from './world';
import { CLOCK, RAIDS } from './data';
import { DEMO_SCENES, createDemoWorld, sustainDemo } from './demo';
import { blocked, emptySlots, held, heldOf, isDown } from './player';
import { applyCommand } from './commands';
import { hypot } from './math';

/** A world with no resources, no bugs, only the hub, everything researched and a big inventory. */
function emptyWorld(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(1, mode);
  w.freePower = true; // belts at full speed: power has tests of its own (D-115)
  w.clearWater();
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.nests = [];
  w.state.enemies = [];
  w.nestCells.clear();
  w.state.inventory = {
    iron_plate: 999,
    stone: 999,
    iron_ore: 999,
    brick: 999,
    copper_ingot: 999,
    gear: 999,
    wire: 999,
    motor: 999,
    plank: 999,
    log: 999,
    dowel: 999,
    peg: 999,
    rope: 999,
    truss: 999,
    stake: 999,
    iron_ingot: 999,
    iron_rod: 999,
    rivet: 999,
    bullet: 999,
    shell: 999,
  };
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
  it.each([42, 1, 2, 3, 7])('is 256×256, with the hub in the middle, no ore within 20 tiles of it, and every ore not far beyond (D-097), seed %i', (seed) => {
    const w = World.create(seed);
    expect(w.state.width).toBe(MAP_SIZE);
    const hub = w.hub!;
    expect(w.footprintOf(hub)).toEqual([HUB_SIZE, HUB_SIZE]);
    for (let dy = 0; dy < HUB_SIZE; dy++) for (let dx = 0; dx < HUB_SIZE; dx++) expect(w.buildingAt(hub.x + dx, hub.y + dy)).toBe(hub);
    const near = new Set<number>();
    const edge = (x: number, y: number) => Math.max(hub.x - x, x - (hub.x + HUB_SIZE - 1), hub.y - y, y - (hub.y + HUB_SIZE - 1), 0);
    for (let y = hub.y - 40; y <= hub.y + HUB_SIZE + 40; y++) {
      for (let x = hub.x - 40; x <= hub.x + HUB_SIZE + 40; x++) {
        const r = w.state.resources[w.idx(x, y)];
        if (!r) continue;
        expect(edge(x, y)).toBeGreaterThanOrEqual(ORE.minDistance);
        if (edge(x, y) <= ORE.minDistance + 12) near.add(r);
      }
    }
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
      const c = hub.x + Math.floor(HUB_SIZE / 2);
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
    const sizes: [string, number, number][] = [
      ['extractor', 2, 2],
      ['furnace', 2, 2],
      ['workshop', 2, 2],
      ['assembler', 3, 3],
      ['splitter', 1, 2],
    ];
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
    const before = w.state.inventory.plank!;
    const b = placed(w.place('workshop', 20, 20, 0));
    expect(w.state.inventory.plank).toBe(before - BUILDINGS.workshop.cost.plank!);
    expect(w.place('belt', 21, 21, 0)).toBe('occupied'); // inside the workshop
    expect(w.place('extractor', 30, 30, 0)).toBe('needs-resource');
    expect(w.place('workshop', MAP_SIZE - 1, 10, 0)).toBe('bounds');
    expect(w.place('port', 60, 60, 0)).toBe('needs-hub');
    w.demolish(b.id);
    expect(w.state.inventory.plank).toBe(before);
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
  /** Extractor → belt → furnace → blacksmith → belts → hub, along the hub's middle row (D-113). */
  function line(w: World) {
    const hub = w.hub!;
    const y = hub.y + 2;
    const x0 = hub.x - 12;
    ore(w, x0, y);
    placed(w.place('extractor', x0, y, 0));
    placed(w.place('belt', x0 + 2, y, 0));
    placed(w.place('furnace', x0 + 3, y, 0));
    placed(w.place('blacksmith', x0 + 5, y, 0));
    for (let x = x0 + 7; x < hub.x; x++) placed(w.place('belt', x, y, 0));
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
    const start = w.state.inventory.iron_ingot!;
    run(w, 30);
    expect(w.state.inventory.iron_ingot! - start).toBeGreaterThan(10); // furnaces smelt ingots (D-113)
    expect(w.place('belt', x0 + 7, y, 0, true)).toBe('occupied'); // belts don't replace belts
  });

  it('starts with nothing built and unlocks everything through research, including the shipyard', () => {
    const w = World.create(3);
    expect(w.isUnlocked('extractor')).toBe(false); // smelting comes with Industry (D-093)
    expect(w.isUnlocked('turret')).toBe(false);
    expect(w.isUnlocked('shipyard')).toBe(false);
    w.state.inventory = {
      iron_plate: 999,
      stone: 999,
      iron_ore: 999,
      brick: 999,
      copper_ingot: 999,
      gear: 999,
      wire: 999,
      motor: 999,
      plank: 999,
      log: 999,
      peg: 999,
      rope: 999,
      truss: 999,
      dowel: 999,
      iron_ingot: 999,
      rivet: 999,
      iron_rod: 999,
    };
    expect(w.researchNow('workshop')).toBe('requires'); // workshops need Forestry
    expect(w.researchNow('defense')).toBe('requires'); // hydraulic turrets need Hydraulics (D-117)
    for (const id of ['forestry', 'workshop', 'carpentry', 'rollers', 'palisades', 'defense2', 'industry', 'blacksmith', 'machine_shop', 'hydraulics', 'defense', 'assembly', 'shipyard'])
      expect(w.researchNow(id)).toBeNull();
    expect(w.isUnlocked('extractor') && w.isUnlocked('furnace')).toBe(true);
    expect(w.isUnlocked('turret')).toBe(true);
    expect(w.isUnlocked('shipyard')).toBe(true);
  });

  it('hub ports take the chosen item out of stock and face away from the hub', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const port = placed(w.place('port', hub.x + HUB_SIZE, hub.y + 2, 1));
    expect(port.dir).toBe(0);
    placed(w.place('belt', hub.x + HUB_SIZE + 1, hub.y + 2, 0));
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

  it('notes where repairs happen and buildings fall, for the effects (not saved)', () => {
    const w = emptyWorld();
    const wall = placed(w.place('wall', 20, 20, 0));
    const station = placed(w.place('repair', 22, 20, 0));
    wall.hp = 100;
    run(w, 0.2);
    expect(w.healed).toEqual([expect.objectContaining({ x: 20.5, y: 20.5, by: station.id })]);
    run(w, 1.5);
    expect(w.healed.length).toBeLessThanOrEqual(3); // one sparkle about every half second, not one a tick
    w.remove(wall, true);
    expect(w.lost).toEqual([expect.objectContaining({ id: wall.id, x: 20.5, y: 20.5, size: 1 })]);
    expect(w.toJSON()).not.toContain('healed');
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

  it('need no attack paths once a destroyed nest has no bugs left', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    n.destroyed = true;
    expect(anyAngry(w)).toBe(true); // its survivor still roams
    w.state.enemies = [];
    expect(anyAngry(w)).toBe(false);
    n.angryUntil = w.state.time + 10;
    expect(anyAngry(w)).toBe(false);
  });

  it('a bug killed this tick is not shot again by the next turret', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    const bug = w.state.enemies[0];
    bug.hp = 1;
    const a = placed(w.place('turret', 40, 70, 0));
    const b = placed(w.place('turret', 41, 70, 0));
    bug.x = 40.5;
    bug.y = 72.5;
    bug.tx = bug.x;
    bug.ty = bug.y;
    const before = a.ammo + b.ammo;
    w.tick(TICK);
    expect(isAngry(w, n)).toBe(true);
    expect(w.state.enemies).toHaveLength(0);
    expect(before - (a.ammo + b.ammo)).toBe(1); // one shot, not two
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

  it('give up on buildings out of reach, stay home, and calm down after a while (D-091)', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 2);
    const [cx, cy] = nestCentre(n);
    const far = placed(w.place('wall', Math.round(cx) + NESTS.giveUp + 12, Math.round(cy), 0));
    n.angryUntil = w.state.time + 5;
    w.markFlowDirty();
    run(w, 30);
    expect(far.hp).toBe(w.maxHp(far));
    for (const e of w.state.enemies) expect(Math.hypot(e.x - cx, e.y - cy)).toBeLessThanOrEqual(NESTS.cell);
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

  it('a new territory clears the trees from its mound and the ring around it', () => {
    const w = emptyWorld();
    addNest(w, 50, 50, 2);
    w.state.trees.fill(TREE);
    w.state.nextSpread = w.state.time;
    w.tick();
    const fresh = w.state.nests[1];
    expect(fresh).toBeDefined();
    const [mx, my] = moundTile(fresh);
    for (let y = my - 1; y <= my + 2; y++) for (let x = mx - 1; x <= mx + 2; x++) expect(w.treeAt(x, y)).toBe(NO_TREE);
  });

  it('a nest that merged wakes the neighbours of every cell it holds when its bugs are hurt', () => {
    const w = emptyWorld();
    const a = addNest(w, 50, 50, 1);
    a.cells = [[60, 50]]; // took over the cell to its east
    w.nestCells.set(cellKey(6, 5), a);
    const far = addNest(w, 70, 50, 1); // next to the merged cell only
    const e = w.state.enemies.find((x) => x.nest === a.id)!;
    e.hp -= 1;
    onBugHurt(w, e);
    expect(isAngry(w, far)).toBe(true);
  });

  it('a flying bug with nothing left to go for heads home', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 0);
    const wasp = w.spawnBug('wasp', n, 1);
    n.angryUntil = w.state.time + 60;
    // Only walls nearby (flyers pass over them), so it keeps chasing but has nothing to go for.
    for (let i = 0; i < 4; i++) placed(w.place('wall', 78 + i, 80, 0));
    [wasp.x, wasp.y, wasp.tx, wasp.ty] = [80.5, 81.5, 100.5, 100.5];
    w.state.buildings = w.state.buildings.filter((b) => b.type === 'wall');
    run(w, 1);
    expect([wasp.tx, wasp.ty]).toEqual(nestCentre(n));
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

  it('chase as far as it takes while something is in reach, with no fixed leash (D-091)', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 3);
    const [cx, cy] = nestCentre(n);
    // A line of walls leading away: each within reach of the last, ending 64 tiles from home.
    const walls = [8, 22, 36, 50, 64].map((d) => placed(w.place('wall', Math.round(cx) + d, Math.round(cy), 0)));
    n.angryUntil = 1e9;
    w.markFlowDirty();
    run(w, 300);
    expect(walls.every((b) => !w.byId.has(b.id))).toBe(true); // chewed all the way along
  });

  it('a bug that gave up walks home without dithering, and comes back out when something is built close (D-091)', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    const bug = w.state.enemies[0];
    const [cx, cy] = nestCentre(n);
    n.angryUntil = 1e9;
    const wall = placed(w.place('wall', Math.round(cx) + 8, Math.round(cy), 0));
    w.markFlowDirty();
    run(w, 6);
    w.demolish(wall.id); // the target is gone, and nothing else is in reach
    w.markFlowDirty();
    run(w, 2);
    expect(bug.home).toBe(true);
    const inside = () => bug.x >= n.x && bug.x < n.x + NESTS.cell && bug.y >= n.y && bug.y < n.y + NESTS.cell;
    let away = Math.hypot(bug.x - cx, bug.y - cy);
    for (let i = 0; i < 80 && !inside(); i++) {
      run(w, 0.25);
      const d = Math.hypot(bug.x - cx, bug.y - cy);
      expect(d).toBeLessThanOrEqual(away + 0.01); // only ever closer to home
      away = d;
    }
    expect(inside()).toBe(true);
    run(w, 3);
    expect(bug.home).toBe(true); // still angry, but nothing in reach: it stays home
    const lure = placed(w.place('wall', Math.round(cx) + 6, Math.round(cy), 0));
    w.markFlowDirty();
    run(w, 2);
    expect(bug.home).toBeUndefined();
    run(w, 30);
    expect(lure.hp).toBeLessThan(w.maxHp(lure));
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
    w.state.researched = ['forestry', 'industry', 'blacksmith', 'hydraulics'];
    w.state.inventory = { iron_plate: 100, copper_ingot: 50, rivet: 50, brick: 50 };
    expect(w.startResearch('defense')).toBeNull();
    run(w, 15);
    const used = 100 - w.state.inventory.iron_plate!;
    expect(used).toBeGreaterThan(6);
    expect(used).toBeLessThan(30);
    run(w, 35);
    expect(w.state.researched).toContain('defense');
  });

  it('stalls when the hub runs out, and keeps progress when switching', () => {
    const w = emptyWorld();
    w.state.researched = ['forestry', 'industry', 'blacksmith', 'hydraulics'];
    w.state.inventory = { iron_plate: 5, log: 50 };
    w.startResearch('defense');
    run(w, 20);
    expect(w.state.research.stalled).toBe(true);
    const progress = w.researchProgress('defense');
    w.startResearch('charcoal');
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

  it('only a lumber camp goes over trees: it cuts them at once, their logs pay for it and the rest fill its output (D-147)', () => {
    const w = emptyWorld();
    const x = w.hub!.x - 20;
    const y = w.hub!.y;
    grove(w, x, y, 2);
    w.state.inventory.log = 0;
    expect(w.place('wall', x, y, 0)).toBe('tree');
    const camp = placed(w.place('lumber_camp', x, y, 0));
    expect(w.state.inventory.log).toBe(0);
    expect(camp.outputs).toEqual(Array(4 * LUMBER.logsPerTree - BUILDINGS.lumber_camp.cost.log!).fill('log'));
    expect(camp.outputs.length).toBeLessThanOrEqual(LUMBER.buffer);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      expect(w.treeAt(x + dx, y + dy)).toBe(NO_TREE);
    // Over one tree, its logs pay part of the cost.
    const x2 = x - 10;
    w.state.trees[w.idx(x2, y)] = TREE;
    expect(w.buildCost('lumber_camp', x2, y, 0)).toEqual({ log: BUILDINGS.lumber_camp.cost.log! - LUMBER.logsPerTree });
    w.state.inventory.log = BUILDINGS.lumber_camp.cost.log! - LUMBER.logsPerTree;
    expect(placed(w.place('lumber_camp', x2, y, 0)).outputs).toEqual([]);
    expect(w.state.inventory.log).toBe(0);
    // A camp being moved doesn't go over trees.
    w.state.trees[w.idx(x - 5, y)] = TREE;
    expect(w.relocate(camp.id, x - 5, y, 0)).toBe('tree');
  });

  it('building is paid from hub stock first, then from the engineer’s inventory, wherever it is (D-147)', () => {
    const w = emptyWorld();
    const x = w.hub!.x - 30;
    const y = w.hub!.y;
    w.state.trees[w.idx(x - 1, y)] = TREE;
    const p = w.state.players[0];
    p.slots = emptySlots();
    p.slots[0] = { item: 'log', n: 5 };
    w.state.inventory.log = 5;
    expect(w.canAfford(BUILDINGS.lumber_camp.cost)).toBe(false);
    expect(w.canAfford(BUILDINGS.lumber_camp.cost, 0)).toBe(true);
    expect(w.place('lumber_camp', x, y, 0)).toBe('cost'); // with no player, hub stock alone pays
    placed(applyCommand(w, { kind: 'place', type: 'lumber_camp', x, y, dir: 0, replaceBelt: false }, 0));
    expect(w.state.inventory.log).toBe(0);
    expect(heldOf(p, 'log')).toBe(2);
    expect(w.funds(0).log).toBe(2);
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
    w.state.inventory.log = 999;
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

describe('Wooden parts (D-105)', () => {
  it('a sawmill saws planks into dowels; a workshop makes pegs and rope, and trusses after Carpentry', () => {
    const w = emptyWorld();
    w.state.researched = ['forestry', 'workshop'];
    const hub = w.hub!;
    const saw = placed(w.place('sawmill', hub.x - 20, hub.y - 10, 0));
    w.setRecipe(saw.id, 'dowel');
    expect(saw.recipe).toBe('dowel');
    w.insert(saw, 'plank', saw.x - 1, saw.y);
    const ws = placed(w.place('workshop', hub.x - 20, hub.y - 4, 0));
    // Logs into a new workshop make rope; trusses aren't open yet.
    for (let i = 0; i < 2; i++) expect(w.insert(ws, 'log', ws.x - 1, ws.y)).toBe(true);
    expect(ws.recipe).toBe('rope');
    expect(w.recipesFor('workshop').map((r) => r.id)).not.toContain('truss');
    w.setRecipe(ws.id, 'truss');
    expect(ws.recipe).toBe('rope'); // not researched: refused
    run(w, 3.5);
    expect(saw.outputs).toEqual(['dowel', 'dowel', 'dowel', 'dowel']);
    expect(ws.outputs).toEqual(['rope']);
    // Carpentry opens trusses: 3 planks, 2 pegs and a rope.
    w.state.researched.push('carpentry');
    w.setRecipe(ws.id, 'truss');
    ws.outputs = [];
    for (const [item, n] of [
      ['plank', 3],
      ['peg', 2],
      ['rope', 1],
    ] as [ItemId, number][])
      for (let i = 0; i < n; i++) expect(w.insert(ws, item, ws.x - 1, ws.y)).toBe(true);
    run(w, 4.5);
    expect(ws.outputs).toEqual(['truss']);
  });

  it('the Wood Age leads to Industry: Workshops, then Carpentry, then Industry, all paid in wood and stone', () => {
    const w = World.create(3);
    expect(RESEARCH_BY_ID.workshop.requires).toEqual(['forestry']);
    expect(RESEARCH_BY_ID.carpentry.requires).toEqual(['workshop']);
    expect(RESEARCH_BY_ID.industry.requires).toEqual(['carpentry', 'defense2']); // hold your ground first (D-107)
    // A research never costs something its needs can't make (D-089): before Industry, only wood and stone.
    const wood = new Set(['log', 'plank', 'stake', 'dowel', 'peg', 'rope', 'truss', 'stone']);
    for (const id of ['forestry', 'rollers', 'workshop', 'carpentry', 'palisades', 'defense2', 'industry']) {
      for (const item of Object.keys(RESEARCH_BY_ID[id].cost)) expect(wood.has(item), `${id} costs ${item}`).toBe(true);
    }
    expect(Object.keys(BUILDINGS.workshop.cost).every((k) => wood.has(k))).toBe(true);
    expect(w.isUnlocked('workshop')).toBe(false);
  });
});

describe('Ore that runs out, and trees that stop growing back (D-094, D-096)', () => {
  it('an ore tile is bare ground once its 1200 ore are taken, by hand or by an extractor', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 30, w.hub!.y];
    ore(w, x, y, 1);
    expect(w.oreLeft(x, y)).toBe(ORE.perTile);
    w.state.oreMined = { [w.idx(x, y)]: ORE.perTile - 1 };
    stand(w, x + 1, y);
    for (let i = 0; i < HAND_MINING.taps; i++) w.mineByHand(x, y);
    expect(heldOf(w.state.players[0], 'iron_ore')).toBe(1);
    expect(w.resourceAt(x, y)).toBeNull();
    expect(w.oreLeft(x, y)).toBe(0);
  });

  it('an extractor makes one ore per ore tile under it each cycle, up to 4, and stops when they run out', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 30, w.hub!.y];
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ])
      ore(w, x + dx, y + dy, 1, 1); // three of its four tiles
    const ex = placed(w.place('extractor', x, y, 0));
    for (let t = 0; t < EXTRACTOR_PERIOD + 0.05; t += TICK) w.tick();
    expect(ex.outputs).toEqual(['iron_ore', 'iron_ore', 'iron_ore']); // nothing in front takes them
    // Nearly used up: one ore left in each tile.
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ])
      w.state.oreMined![w.idx(x + dx, y + dy)] = ORE.perTile - 1;
    for (let t = 0; t < EXTRACTOR_PERIOD * 3; t += TICK) {
      ex.outputs = [];
      w.tick();
    }
    expect(w.resourceAt(x, y)).toBeNull();
    expect(ex.progress).toBe(-1); // nothing left to mine
  });

  it('a stump grows back 3 times; the tree cut after that leaves clear ground', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 30, w.hub!.y];
    const i = w.idx(x, y);
    stand(w, x + 1, y);
    for (let cut = 1; cut <= LUMBER.regrowths + 1; cut++) {
      w.state.trees[i] = TREE;
      for (let k = 0; k < HAND_MINING.taps; k++) w.mineByHand(x, y);
      w.state.players[0].slots = emptySlots();
      expect(w.treeAt(x, y)).toBe(cut <= LUMBER.regrowths ? STUMP : NO_TREE);
    }
    expect(w.state.regrow[i]).toBeGreaterThan(0); // the last stump's timer, from the cut before
    expect(w.state.cuts?.[i]).toBeUndefined();
  });
});

describe('Moving a building (#76, #83)', () => {
  it('moves with what it holds, for nothing, anywhere a new one could go, its own tiles included', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const f = placed(w.place('furnace', hub.x - 20, hub.y, 0));
    f.outputs = ['iron_plate'];
    f.inputs = { iron_ore: 2 };
    f.recipe = 'iron_plate';
    const stock = { ...w.state.inventory };
    expect(w.relocate(f.id, f.x + 1, f.y, 1)).toBe(f); // one tile over, overlapping where it stood
    expect([f.x, f.y, f.dir]).toEqual([hub.x - 19, hub.y, 1]);
    expect(f.outputs).toEqual(['iron_plate']);
    expect(f.inputs).toEqual({ iron_ore: 2 });
    expect(w.state.inventory).toEqual(stock);
    expect(w.buildingAt(hub.x - 20, hub.y)).toBeUndefined();
    expect(w.buildingAt(hub.x - 18, hub.y + 1)).toBe(f);
    // Not onto another building, and the hub, shipyard and tunnels stay put.
    placed(w.place('wall', hub.x - 25, hub.y, 0));
    expect(w.relocate(f.id, hub.x - 26, hub.y, 0)).toBe('occupied');
    expect(w.relocate(hub.id, hub.x - 40, hub.y, 0)).toBe('unmovable');
  });

  it('a building that replaces a belt keeps what the belt carried, in hub stock if it cannot take it', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 20, w.hub!.y + 6];
    const belt = placed(w.place('belt', x, y, 0));
    belt.belt.push({ item: 'iron_ore', pos: 0.5, lane: LEFT });
    const ore = w.state.inventory.iron_ore ?? 0;
    placed(w.place('wall', x, y, 0, true));
    expect(w.state.inventory.iron_ore).toBe(ore + 1);
  });

  it('a turned building must fit as a new one would: not onto a tree', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 20, w.hub!.y + 6];
    const s = placed(w.place('storage', x, y, 0)); // 1×2 facing east, 2×1 turned
    w.state.trees[w.idx(x + 1, y)] = TREE;
    expect(w.rotate(s.id, 1)).toBe(false);
    expect(s.dir).toBe(0);
    w.state.trees[w.idx(x + 1, y)] = NO_TREE;
    expect(w.rotate(s.id, 1)).toBe(true);
  });

  it('no tree grows back under a moved or turned building', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 20, w.hub!.y + 6];
    const f = placed(w.place('furnace', x, y, 0));
    const stump = w.idx(x + 4, y);
    w.state.trees[stump] = STUMP;
    w.state.regrow[stump] = w.state.time + 1;
    expect(w.relocate(f.id, x + 3, y, 0)).toBe(f);
    run(w, 3);
    expect(w.state.trees[stump]).toBe(NO_TREE);
    expect(w.state.regrow[stump]).toBeUndefined();
  });

  it('a moved hub port faces away from the hub, whatever it was told', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const port = placed(w.place('port', hub.x - 1, hub.y, 0));
    expect(port.dir).toBe(2);
    expect(w.relocate(port.id, hub.x - 1, hub.y + 1, 0)).toBe(port);
    expect(port.dir).toBe(2);
  });

  it('an extractor moved onto other ore mines that ore', () => {
    const w = emptyWorld();
    const [x, y] = [w.hub!.x - 30, w.hub!.y];
    ore(w, x, y, 1);
    ore(w, x + 4, y, 3);
    const ex = placed(w.place('extractor', x, y, 0));
    expect(ex.recipe).toBe('iron_ore');
    expect(w.relocate(ex.id, x + 4, y, 0)).toBe(ex);
    expect(ex.recipe).toBe('stone');
    expect(w.relocate(ex.id, x + 10, y, 0)).toBe('needs-resource');
  });
});

describe('Rollers and crates (D-106)', () => {
  it('a roller line carries items in single file, slowly, and at belt speed once it is packed', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const y = hub.y + 2;
    const start = hub.x - 10;
    for (let x = start; x < hub.x; x++) placed(w.place('roller', x, y, 0));
    const first = w.buildingAt(start, y)!;
    // One item, from either side lane of a belt, rolls down the middle at a third of belt speed.
    expect(w.insert(first, 'log', start - 1, y, LEFT)).toBe(true);
    expect(first.belt[0].lane).toBe(RIGHT);
    run(w, 1);
    expect(first.belt[0].pos).toBeCloseTo(ROLLER.speed, 1);
    // A fed line packs up and moves faster: items keep arriving at the hub well above the slow rate.
    const before = w.state.inventory.plank ?? 0;
    for (let t = 0; t < 30; t += TICK) {
      w.insert(first, 'plank', start - 1, y);
      w.tick();
    }
    const slow = (30 * ROLLER.speed) / BELT_SPACING;
    expect((w.state.inventory.plank ?? 0) - before).toBeGreaterThan(slow * 1.3);
  });

  it('a crate holds up to 50 of one item, sends them out of its front, and can be collected from', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const crate = placed(w.place('crate', hub.x - 12, hub.y + 2, 0));
    for (let i = 0; i < CRATE_SIZE; i++) expect(w.insert(crate, 'plank', crate.x - 1, crate.y)).toBe(true);
    expect(w.insert(crate, 'plank', crate.x - 1, crate.y)).toBe(false); // full
    crate.outputs.pop();
    expect(w.insert(crate, 'log', crate.x - 1, crate.y)).toBe(false); // one kind only
    expect(w.insert(crate, 'plank', crate.x + 1, crate.y)).toBe(false); // not from the tile it feeds
    // A roller leaving its front takes items out.
    const out = placed(w.place('roller', crate.x + 1, crate.y, 0));
    run(w, 1);
    expect(out.belt.length).toBeGreaterThan(0);
    // The engineer collects what fits.
    stand(w, crate.x - 1, crate.y);
    expect(w.collect(crate.id)).toBeGreaterThan(0);
    expect(heldOf(w.state.players[0], 'plank')).toBeGreaterThan(0);
  });

  it('Basic Logistics comes after Forestry and is paid in wood', () => {
    expect(RESEARCH_BY_ID.rollers.requires).toEqual(['forestry']);
    expect(RESEARCH_BY_ID.rollers.unlocks).toEqual(['roller', 'crate']);
    for (const t of ['roller', 'crate'] as const) for (const k of Object.keys(BUILDINGS[t].cost)) expect(['plank', 'dowel', 'peg', 'log']).toContain(k);
  });
});

describe('Wooden defences (D-107)', () => {
  it('a spike pit hurts and slows bugs that walk over it, wears down, and is refilled with stakes', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const pit = placed(w.place('spike_pit', hub.x - 20, hub.y - 10, 0));
    expect(pit.ammo).toBe(SPIKES.maxCharge);
    expect(BUILDINGS.spike_pit.blocking).toBe(false);
    const n = addNest(w, 0, 0, 0);
    const e = w.spawnBug('crawler', n, 1);
    e.hp = e.maxHp = 1000;
    e.x = pit.x + 0.5;
    e.y = pit.y + 0.5;
    run(w, 1);
    expect(e.hp).toBeLessThan(1000 - SPIKES.dps * 0.8);
    expect(pit.ammo).toBeLessThan(SPIKES.maxCharge);
    expect(pit.hp).toBe(BUILDINGS.spike_pit.hp); // walked over, not bitten
    // Stakes put charge back.
    pit.ammo = 30;
    const charge = pit.ammo;
    expect(w.insert(pit, 'stake', pit.x - 1, pit.y)).toBe(true);
    expect(pit.ammo).toBe(charge + SPIKES.perStake);
    expect(w.insert(pit, 'plank', pit.x - 1, pit.y)).toBe(false);
  });

  it('bugs chasing the factory cross a spike pit slowly and keep going', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    // A pit on the straight way to the hub's west side.
    const y = hub.y + 2;
    const pit = placed(w.place('spike_pit', hub.x - 6, y, 0));
    const n = addNest(w, 0, 0, 0);
    n.angryUntil = 1e9;
    const e = w.spawnBug('crawler', n, 1);
    e.hp = e.maxHp = 1e6;
    e.x = hub.x - 9.5;
    e.y = y + 0.5;
    w.rebuildPaths();
    let onPit = 0;
    for (let t = 0; t < 12; t += TICK) {
      w.tick();
      if (Math.floor(e.x) === pit.x && Math.floor(e.y) === pit.y) onPit += TICK;
    }
    expect(e.x).toBeGreaterThan(pit.x + 1); // past the pit
    // A tile at half speed takes about twice as long as one at full speed.
    expect(onPit).toBeGreaterThan(1.5 / ENEMIES.crawler.speed);
  });

  it('a trebuchet hits a group far away, with splash, and cannot hit anything close', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const t = placed(w.place('trebuchet', hub.x - 40, hub.y - 20, 0));
    const [cx, cy] = w.centreOf(t);
    const n = addNest(w, 0, 0, 0);
    const near = w.spawnBug('crawler', n, 1);
    near.x = cx + 3;
    near.y = cy;
    near.hp = near.maxHp = 1000;
    w.tick();
    expect(near.hp).toBe(1000); // inside its blind spot
    const far = [0, 1].map(() => w.spawnBug('crawler', n, 1));
    far.forEach((e, i) => Object.assign(e, { x: cx + 20, y: cy + i * 0.8, hp: 1000, maxHp: 1000 }));
    w.tick();
    const def = TURRETS.trebuchet!;
    expect(far.map((e) => e.hp)).toEqual([1000 - def.damage, 1000 - def.damage]); // both, from one stone
    expect(w.insert(t, 'stone', t.x - 1, t.y)).toBe(true);
  });

  it('Basic Defense gives palisades and spike pits; Basic Defense 2 the trebuchet and ballista, before Industry', () => {
    expect(RESEARCH_BY_ID.palisades.name).toBe('Basic Defense');
    expect(RESEARCH_BY_ID.palisades.unlocks).toEqual(['palisade', 'spike_pit']);
    expect(RESEARCH_BY_ID.defense2.unlocks).toEqual(['trebuchet', 'ballista']);
    expect(RESEARCH_BY_ID.industry.requires).toContain('defense2');
    expect(RESEARCH_BY_ID.ballistae).toBeUndefined();
  });

  it('v23 saves with Ballistae get Basic Defense 2 instead', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 23;
    old.researched = ['forestry', 'palisades', 'ballistae'];
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.researched.sort()).toEqual(['defense2', 'forestry', 'palisades']);
    expect(loaded.isUnlocked('ballista') && loaded.isUnlocked('trebuchet')).toBe(true);
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
    w.setRecipe(furnace.id, 'charcoal'); // logs fed to a furnace are fuel unless it's making charcoal (D-114)
    for (let i = 0; i < 2; i++) expect(w.insert(furnace, 'log', furnace.x - 1, furnace.y)).toBe(true);
    expect(furnace.inputs.log).toBe(2);
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
  it('the express belt needs Express Logistics (D-121), and moves items twice as fast', () => {
    const w = emptyWorld();
    const y = w.hub!.y - 8;
    const x = w.hub!.x - 10;
    w.state.researched = w.state.researched.filter((r) => r !== 'express_logistics');
    expect(w.place('express_belt', x, y, 0)).toBe('locked');
    w.state.researched.push('express_logistics');
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

  it('a damaged belt is refunded as demolishing it would be, not as new', () => {
    const w = emptyWorld();
    w.state.ship.blueprints = ['express_belt'];
    const y = w.hub!.y - 8;
    const x0 = w.hub!.x - 20;
    const belt = placed(w.place('belt', x0, y, 0));
    belt.hp = BUILDINGS.belt.hp / 2;
    const plates = w.state.inventory.iron_plate!;
    expect(w.upgradeBeltLine(x0, y)).toEqual({ upgraded: 1, left: 0 });
    expect(w.state.inventory.iron_plate).toBe(plates + Math.floor(BUILDINGS.belt.cost.iron_plate! / 2) - (BUILDINGS.express_belt.cost.iron_plate ?? 0));
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

  it('a tesla arcs from the nearest bug to up to two more within reach, and needs no ammunition (D-126)', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, circuit: 9, coil: 9 });
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
    expect(TURRETS.tesla!.ammoItem).toBeUndefined();
    expect(t.ammo).toBe(0);
    expect(w.insert(t, 'wire', t.x - 1, t.y)).toBe(false);
  });
});

describe('Demo world', () => {
  it.each(DEMO_SCENES.map((s, i) => [s.name, i] as const))('scene "%s" delivers to the hub and keeps its bugs calm (#99)', (_, i) => {
    const w = createDemoWorld(i);
    expect(w.state.buildings.length).toBeGreaterThan(15);
    const before = Object.values(w.delivered).reduce((a, n) => a + n!, 0);
    for (let t = 0; t < 40; t += TICK) {
      w.tick();
      sustainDemo(w);
    }
    expect(Object.values(w.delivered).reduce((a, n) => a + n!, 0)).toBeGreaterThan(before + 10);
    expect(w.state.nests.every((n) => !isAngry(w, n))).toBe(true);
  });

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
  it('starts with an empty hub, nothing to build, and Forestry, paid in logs, to research first (D-093)', () => {
    const w = World.create(3);
    expect(w.state.inventory).toEqual({});
    for (const t of ['furnace', 'extractor', 'belt', 'lumber_camp'] as const) expect(w.isUnlocked(t)).toBe(false);
    expect(w.availableResearch().map((r) => r.id)).toEqual(['forestry']);
    expect(RESEARCH_BY_ID.forestry.cost).toEqual({ log: 15 });
    // Everything Forestry opens is paid in wood, so the Wood Age needs nothing smelted.
    expect(BUILDINGS.lumber_camp.cost).toEqual({ log: 8 });
    expect(BUILDINGS.sawmill.cost).toEqual({ log: 14 });
    expect(RESEARCH_BY_ID.industry.unlocks.sort()).toEqual(['extractor', 'furnace']);
    expect(BUILDINGS.furnace.cost).toEqual({ stone: 6, log: 6 }); // the logs are its first fuel (#180)
    expect(Object.keys(BUILDINGS.extractor.cost).sort()).toEqual(['iron_ore', 'stone']);
  });

  it('eight taps on a tree fell it for two logs, leaving a stump that grows back (D-093)', () => {
    const w = emptyWorld();
    w.state.inventory = {};
    const [x, y] = [w.hub!.x - 6, w.hub!.y];
    w.state.trees[w.idx(x, y)] = TREE;
    stand(w, x + 1, y);
    for (let i = 1; i < HAND_MINING.taps; i++) {
      const tap = w.mineByHand(x, y);
      expect(typeof tap !== 'string' && tap.item).toBe(null);
    }
    const last = w.mineByHand(x, y);
    expect(typeof last !== 'string' && last.item).toBe('log');
    expect(heldOf(w.state.players[0], 'log')).toBe(LUMBER.logsPerTree);
    expect(w.treeAt(x, y)).toBe(STUMP);
    expect(w.felled.length).toBe(1);
    expect(w.state.regrow[w.idx(x, y)]).toBeGreaterThan(w.state.time);
    expect(w.mineByHand(x, y)).toBe('no-ore'); // a stump can't be chopped
    // A tree needs room for both logs.
    const p = w.state.players[0];
    w.state.trees[w.idx(x, y)] = TREE;
    p.slots = p.slots.map(() => ({ item: 'stone', n: 10 }));
    p.slots[0] = { item: 'log', n: 9 };
    expect(w.mineByHand(x, y)).toBe('full');
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
    expect(w.state.players[0].slots[0]).toEqual({ item: 'stone', n: 1 });
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

  it('from nothing: mine, carry it to the hub, build a furnace and an extractor, and collect ingots without belts', () => {
    const w = emptyWorld();
    w.state.researched = ['forestry', 'industry'];
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
    expect(held(w.state.players[0])).toBe(14);
    const hub = w.hub!;
    w.moveTo(hub.x - 1, hub.y + 2); // walking up to the hub drops everything off
    run(w, 8);
    expect(held(w.state.players[0])).toBe(0);
    expect(w.state.inventory).toEqual({ stone: 10, iron_ore: 4 });
    w.state.inventory.log = 6; // left from the Wood Age: the furnace's first fuel
    placed(w.place('extractor', x, y + 3, 0));
    const fu = placed(w.place('furnace', x + 2, y + 3, 0));
    expect(w.state.inventory).toEqual({ stone: 0, iron_ore: 0, log: 0 });
    run(w, 12);
    expect(fu.outputs.length).toBeGreaterThan(0);
    expect(w.collect(fu.id)).toBe(0); // out of reach: the character goes to fetch them
    run(w, 8);
    expect(held(w.state.players[0])).toBeGreaterThan(0);
    expect(w.collect(w.hub!.id)).toBe(0);
    w.moveTo(hub.x - 1, hub.y + 2);
    run(w, 8);
    expect(w.state.inventory.iron_ingot).toBeGreaterThan(0); // furnaces smelt ingots (D-113)
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
      for (let dy = 0; dy < fh; dy++)
        for (let dx = 0; dx < fw; dx++) {
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
    expect(loaded.state.researched.sort()).toEqual(['blacksmith', 'forestry', 'hydraulics', 'industry', 'logistics']); // Industry from v23 (D-093), Blacksmith from v28 (D-113), Hydraulics from v30 (D-115)
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
    const far = placed(w.place('wall', Math.round(cx) + NESTS.giveUp + 12, Math.round(cy), 0));
    n.hp = 0;
    n.destroyed = true;
    w.markFlowDirty();
    run(w, 60);
    expect(isAngry(w, n)).toBe(true);
    expect(far.hp).toBeLessThan(w.maxHp(far));
  });

  it('Chitin Plating opens Tier 2 for defences instead of adding health to them (D-142)', () => {
    const w = emptyWorld();
    w.state.researched = w.state.researched.filter((r) => r !== 'plating');
    const wall = placed(w.place('wall', 20, 20, 0));
    w.state.inventory.chitin = 100;
    expect(w.upgradeMachine(wall.id)).toBe('locked');
    expect(w.researchNow('plating')).toBe(null);
    expect(wall.hp).toBe(BUILDINGS.wall.hp); // no flat bonus any more
    expect(w.upgradeMachine(wall.id)).toBe(null);
    expect(wall.tier).toBe(2);
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
    expect([p.x, p.y]).toEqual([hub.x + HUB_SIZE / 2 + 0.5, hub.y + HUB_SIZE + 0.5]);
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

  it("a command from a player with no engineer moves nobody's", () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    stand(w, 20, 20);
    expect(w.moveTo(30, 20, 7)).toBe(false);
    w.walk(1, 0, 7);
    run(w, 1);
    expect([p.x, p.y]).toEqual([20.5, 20.5]);
  });

  it('walks with the keys out of a building put up where it stands', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    stand(w, 20, 20);
    placed(w.place('wall', 20, 20, 0));
    w.walk(1, 0);
    run(w, 1);
    expect(p.x).toBeGreaterThan(21);
  });

  it('fills its inventory, drops it all into the hub on walking up, and hands buildings what they take', () => {
    const w = emptyWorld();
    w.state.inventory = {};
    const p = w.state.players[0];
    const [x, y] = [w.hub!.x - 10, w.hub!.y];
    ore(w, x, y, 1, 1);
    stand(w, x + 1, y);
    const most = PLAYER.slots * PLAYER.stack;
    for (let i = 0; i < (most + 1) * HAND_MINING.taps; i++) w.mineByHand(x, y);
    expect(held(p)).toBe(most);
    expect(p.slots.every((s) => s?.n === PLAYER.stack)).toBe(true);
    expect(w.mineByHand(x, y)).toBe('full');
    w.state.inventory = { stone: 6, log: 6 };
    const fu = placed(w.place('furnace', x + 3, y + 3, 0));
    expect(w.dropOff(fu.id)).toBe(0); // not in reach yet: walks over, then hands it in
    run(w, 4);
    const left = held(p);
    expect(left).toBeLessThan(most); // the furnace took what it had room for
    expect(left).toBeGreaterThan(0);
    w.moveTo(w.hub!.x - 1, w.hub!.y + 2);
    run(w, 6);
    expect(held(p)).toBe(0);
    expect(w.state.inventory.iron_ore).toBe(left);
  });

  it('stacks each item up to a slot of 10, and Collect leaves what does not fit (#87)', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    const [x, y] = [w.hub!.x - 10, w.hub!.y];
    ore(w, x, y, 3, 1); // stone
    stand(w, x + 1, y);
    for (let i = 0; i < 11 * HAND_MINING.taps; i++) w.mineByHand(x, y);
    expect(p.slots.slice(0, 3)).toEqual([{ item: 'stone', n: 10 }, { item: 'stone', n: 1 }, null]);
    // Every other slot full of plates: one stack of stone has room for 9 more, and nothing else fits.
    for (let i = 2; i < PLAYER.slots; i++) p.slots[i] = { item: 'iron_plate', n: PLAYER.stack };
    const fu = placed(w.place('furnace', x + 2, y + 2, 0));
    fu.outputs = ['brick', 'stone', 'stone'];
    stand(w, x + 1, y + 1);
    expect(w.collect(fu.id)).toBe(2);
    expect(fu.outputs).toEqual(['brick']);
    expect(heldOf(p, 'stone')).toBe(13);
  });

  it('picks items up off a belt, walking over first (#87)', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    const [x, y] = [w.hub!.x - 12, w.hub!.y - 6];
    const belt = placed(w.place('belt', x, y, 0));
    belt.belt = [
      { item: 'iron_ore', pos: 0.8, lane: 1 },
      { item: 'stone', pos: 0.3, lane: 0 },
    ];
    stand(w, x - 6, y);
    expect(w.pickUp(belt.id)).toBe(0); // out of reach: walks over
    run(w, 3);
    expect(belt.belt).toEqual([]);
    expect([heldOf(p, 'iron_ore'), heldOf(p, 'stone')]).toEqual([1, 1]);
    expect(w.pickUp(w.hub!.id)).toBe(0); // only belts, splitters and underground belts
  });

  it('with drop-off at the hub switched off, walking up to the hub keeps the inventory (#87)', () => {
    const w = emptyWorld();
    w.state.inventory = {};
    const p = w.state.players[0];
    p.slots[0] = { item: 'stone', n: 4 };
    applyCommand(w, { kind: 'auto-drop', on: false });
    w.moveTo(w.hub!.x - 1, w.hub!.y + 2);
    run(w, 8);
    expect(heldOf(p, 'stone')).toBe(4);
    expect(w.state.inventory.stone).toBeUndefined();
    expect(w.dropOff(w.hub!.id)).toBe(4); // a Drop off still puts it in
    expect(w.state.inventory.stone).toBe(4);
  });

  it('v22 saves get Forestry and Industry as done: they were played with smelting from the start (D-093)', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 22;
    old.researched = ['logistics'];
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.researched.sort()).toEqual(['blacksmith', 'forestry', 'hydraulics', 'industry', 'logistics']);
    expect(loaded.isUnlocked('furnace') && loaded.isUnlocked('extractor') && loaded.isUnlocked('lumber_camp')).toBe(true);
  });

  it('v20 saves put what the engineer carried into its inventory', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 20;
    delete old.players[0].slots;
    delete old.players[0].autoDrop;
    old.players[0].carry = ['stone', 'iron_ore', 'stone'];
    const p = World.fromJSON(JSON.stringify(old)).state.players[0];
    expect(p.slots.slice(0, 3)).toEqual([{ item: 'stone', n: 2 }, { item: 'iron_ore', n: 1 }, null]);
    expect(p.slots.length).toBe(PLAYER.slots);
    expect(p.autoDrop).toBe(true);
    expect('carry' in p).toBe(false);
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

  it('v24 saves grow the 5×5 hub to 8×8 about its centre, refunding what is in the way (D-108)', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    const [hx, hy] = [hub.x, hub.y];
    const keep = placed(w.place('belt', hx + HUB_SIZE + 1, hy, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 24;
    // As saved before: a 5×5 hub a tile in from the 8×8 one, a belt just right of it, an engineer inside.
    const oh = old.buildings.find((b: Building) => b.type === 'hub');
    [oh.x, oh.y] = [hx + 1, hy + 1];
    const inWay = { ...old.buildings.find((b: Building) => b.id === keep.id), id: 999, x: hx + 6, y: hy + 1 };
    old.buildings.push(inWay);
    old.inventory = {};
    old.players[0].x = hx + 3;
    old.players[0].y = hy + 3;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect([loaded.hub!.x, loaded.hub!.y]).toEqual([hx, hy]);
    expect(loaded.byId.has(999)).toBe(false);
    expect(loaded.byId.has(keep.id)).toBe(true);
    expect(loaded.state.inventory.iron_plate).toBe(BUILDINGS.belt.cost.iron_plate! + BUILDINGS.well.cost.iron_plate!); // and a well for its belt (D-115)
    expect(loaded.state.players[0].y).toBeGreaterThan(hy + HUB_SIZE);
  });

  it('v16 saves get a character just below the hub', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 16;
    old.players = [{ id: 0 }];
    const hub = old.buildings.find((b: Building) => b.type === 'hub');
    [hub.x, hub.y] = [hub.x + 1, hub.y + 1]; // where a 5×5 hub stood (D-108)
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    const p = loaded.state.players[0];
    expect(p.y).toBeGreaterThan(loaded.hub!.y + HUB_SIZE);
    expect(p.y).toBeLessThan(loaded.hub!.y + HUB_SIZE + 2);
    expect(Math.abs(p.x - (loaded.hub!.x + HUB_SIZE / 2))).toBeLessThan(2);
    expect(p.slots).toEqual(emptySlots());
    expect(p.autoDrop).toBe(true);
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

  it('a splitter fed two kinds of item, one on each lane, keeps them apart; one kind alone still alternates (#92)', () => {
    const w = emptyWorld();
    const sp = placed(w.place('splitter', 20, 20, 0)); // lane 0 at (20,20), lane 1 at (20,21)
    const top = placed(w.place('belt', 21, 20, 0));
    const bottom = placed(w.place('belt', 21, 21, 0));
    const feed = (item: ItemId, y: number) => {
      expect(w.insert(sp, item, 19, y)).toBe(true);
      for (let i = 0; i < 10; i++) w.tick();
    };
    // Only gears, from one lane: they take turns.
    for (let i = 0; i < 4; i++) feed('gear', 20);
    const items = (b: Building) => b.belt.map((it) => it.item);
    expect(items(top).length).toBe(2);
    expect(items(bottom).length).toBe(2);
    top.belt = [];
    bottom.belt = [];
    // Gears on lane 0 and wire on lane 1: each goes straight through.
    for (let i = 0; i < 3; i++) {
      feed('gear', 20);
      feed('wire', 21);
    }
    expect(items(top).every((it) => it === 'gear')).toBe(true);
    expect(items(bottom).every((it) => it === 'wire')).toBe(true);
    expect(items(top).length + items(bottom).length).toBe(6);
    // Once the wire stops coming, the gears take turns again.
    top.belt = [];
    bottom.belt = [];
    for (let t = 0; t < SPLITTER_SORT_WINDOW + 1; t += TICK) w.tick();
    for (let i = 0; i < 4; i++) feed('gear', 20);
    expect(items(top).length).toBe(2);
    expect(items(bottom).length).toBe(2);
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
    expect(n.brood).toEqual({ crawler: 3, runner: 0, brute: 0, wasp: 0, beetle: 0 });
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

  it('makes newly bred bugs tougher, and more often runners or brutes, without growing the nest', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 0);
    n.brood = { crawler: 40, runner: 0, brute: 0, wasp: 0, beetle: 0 };
    w.state.time = NESTS.threatEvery * 6; // level 6: 48% of crawlers hatch as runners
    w.state.nextSpread = Infinity;
    for (let i = 0; i < 40; i++) {
      n.nextBreed = w.state.time;
      run(w, 1);
    }
    const bugs = w.state.enemies.filter((e) => e.nest === n.id);
    expect(bugs.length).toBe(40);
    const worse = bugs.filter((e) => e.type !== 'crawler').length; // runners, or brutes where the nest has them
    expect(worse).toBeGreaterThan(8);
    expect(worse).toBeLessThan(32);
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
    [bug.x, bug.y] = [51.5, 51.5]; // clear of the mound
    const t = placed(w.place('turret', Math.floor(bug.x) + 3, Math.floor(bug.y), 0));
    t.ammo = 20;
    run(w, 1);
    expect(isAngry(w, n)).toBe(true);
    expect(isAngry(w, next)).toBe(true);
    expect(isAngry(w, far)).toBe(false);
  });
});

describe('Night raids (D-065)', () => {
  const nightfall = (day: number) => (day - 1) * (CLOCK.day + CLOCK.night) + CLOCK.day;

  it('from the second night, a nest near buildings sends grown bugs out, without waking, until morning finds nothing in reach', () => {
    const w = emptyWorld('hardcore'); // a raid every night
    const n = addNest(w, 50, 50, 3);
    const wall = placed(w.place('wall', 55 + CLOCK.nightGiveUp + 5, 55, 0)); // beyond an angry bug's reach, in raid range
    const sturdy = (wall.hp = w.maxHp(wall) * 10); // it lasts the night
    w.state.nextSpread = Infinity;
    w.state.time = nightfall(1) - 0.01;
    w.tick();
    expect(w.state.enemies.some((e) => e.raid)).toBe(false); // not on the first night
    w.state.time = nightfall(2) - 0.01;
    w.tick();
    expect(w.state.enemies.filter((e) => e.raid).length).toBe(RAIDS.party + Math.floor(HARDCORE_NESTS.threat / RAIDS.partyThreat)); // Hardcore starts at a higher threat (D-133)
    expect(w.events.some((e) => e.startsWith('Bugs are raiding from the'))).toBe(true);
    run(w, 60);
    expect(wall.hp).toBeLessThan(sturdy);
    expect(isAngry(w, n)).toBe(false); // the rest of the nest stayed calm
    w.state.time = nightfall(2) + CLOCK.night - 0.01;
    run(w, 1);
    expect(w.state.enemies.some((e) => e.raid)).toBe(true); // morning, but still at the wall: they finish
    w.demolish(wall.id);
    w.markFlowDirty();
    run(w, 1);
    expect(w.state.enemies.some((e) => e.raid)).toBe(false); // nothing left in reach: they go home
  });

  it('nests far from buildings, or with only young bugs, do not raid', () => {
    const w = emptyWorld('hardcore');
    const far = addNest(w, 10, 10, 3);
    const young = addNest(w, 140, 30, 0);
    placed(w.place('wall', 145, 60, 0)); // near the young nest only
    w.state.nextSpread = Infinity;
    w.state.time = nightfall(2) - 0.01;
    for (let i = 0; i < 3; i++) w.spawnBug('crawler', young, 1, true); // just hatched
    w.tick();
    expect(w.state.enemies.some((e) => e.raid)).toBe(false);
    expect(far.id).not.toBe(young.id);
  });
});

describe('Bugs notice the engineer (D-074)', () => {
  it('walking close to a calm bug provokes its nest', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    const bug = w.state.enemies[0];
    Object.assign(bug, { x: 55.5, y: 55.5, tx: 55.5, ty: 55.5, wait: 99 });
    stand(w, 60, 55);
    run(w, 1);
    expect(isAngry(w, n)).toBe(false);
    stand(w, 57, 55);
    run(w, 1);
    expect(isAngry(w, n)).toBe(true);
  });

  it('angry bugs bite the engineer; knocked out, it drops what it carries and gets back up at the hub', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 1);
    n.angryUntil = 1e9;
    const bug = w.state.enemies[0];
    Object.assign(bug, { x: 55.5, y: 55.5 });
    stand(w, 57, 55);
    const p = w.state.players[0];
    p.slots[0] = { item: 'stone', n: 2 };
    run(w, 3);
    expect(p.hp).toBeLessThan(PLAYER.hp);
    run(w, PLAYER.hp / 8); // a crawler bites 8 a second
    expect(isDown(p)).toBe(true);
    expect(held(p)).toBe(0);
    expect(w.moveTo(60, 60)).toBe(false);
    ore(w, 60, 60);
    expect(w.mineByHand(60, 60)).toBe('down');
    expect(w.playerEvents).toEqual([expect.objectContaining({ player: 0, mine: expect.stringMatching(/^Your engineer was knocked out/), others: "Player 1's engineer was knocked out." })]);
    run(w, PLAYER.downFor);
    expect(isDown(p)).toBe(false);
    expect(p.hp).toBe(PLAYER.hp);
    expect(Math.abs(p.x - (w.hub!.x + HUB_SIZE / 2 + 0.5))).toBeLessThan(1);
  });

  it('health comes back a while after the last bite', () => {
    const w = emptyWorld();
    const p = w.state.players[0];
    p.hp = 50;
    p.hurtAt = w.state.time;
    run(w, PLAYER.regenAfter - 1);
    expect(p.hp).toBe(50);
    run(w, 3);
    expect(p.hp).toBeGreaterThan(50);
  });

  it('v19 saves give engineers full health', () => {
    const w = emptyWorld();
    const old = JSON.parse(w.toJSON());
    old.version = 19;
    for (const p of old.players) delete p.hp;
    expect(World.fromJSON(JSON.stringify(old)).state.players[0].hp).toBe(PLAYER.hp);
  });
});

describe('The Iron Age: ingots, the Blacksmith and the Machine Shop (D-113)', () => {
  it('furnaces smelt ingots; the blacksmith hammers them into plates or rods, and rods into rivets', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    expect(w.insert(fu, 'iron_ore', 19, 20)).toBe(true);
    expect(fu.recipe).toBe('iron_ingot');
    run(w, 2);
    expect(fu.outputs).toEqual(['iron_ingot']);
    // A new blacksmith fed an ingot starts on plates.
    const bs = placed(w.place('blacksmith', 30, 20, 0));
    expect(w.insert(bs, 'iron_ingot', 29, 20)).toBe(true);
    expect(bs.recipe).toBe('iron_plate');
    run(w, 2);
    expect(bs.outputs).toEqual(['iron_plate']);
    w.setRecipe(bs.id, 'iron_rod');
    bs.outputs = [];
    w.insert(bs, 'iron_ingot', 29, 20);
    run(w, 2);
    expect(bs.outputs).toEqual(['iron_rod', 'iron_rod']);
    w.setRecipe(bs.id, 'rivet');
    bs.outputs = [];
    expect(w.insert(bs, 'iron_ingot', 29, 20)).toBe(false); // rivets are made from rods
    w.insert(bs, 'iron_rod', 29, 20);
    run(w, 2);
    expect(bs.outputs).toEqual(['rivet', 'rivet', 'rivet', 'rivet']);
  });

  it('gears and wire come from the machine shop, not the workshop', () => {
    const w = emptyWorld();
    const ws = placed(w.place('workshop', 20, 20, 0));
    expect(w.insert(ws, 'iron_plate', 19, 20)).toBe(false);
    expect(w.insert(ws, 'copper_ingot', 19, 20)).toBe(false);
    const ms = placed(w.place('machine_shop', 30, 20, 0));
    expect(w.insert(ms, 'copper_ingot', 29, 20)).toBe(true);
    expect(ms.recipe).toBe('wire');
    run(w, 2);
    expect(ms.outputs).toEqual(['wire', 'wire']);
  });

  it('plates need the Blacksmith research, paid in ingots and stone; the Machine Shop needs it, and Assembly needs the Machine Shop', () => {
    expect(RESEARCH_BY_ID.blacksmith.requires).toEqual(['industry']);
    expect(Object.keys(RESEARCH_BY_ID.blacksmith.cost).sort()).toEqual(['iron_ingot', 'stone']);
    expect(Object.keys(BUILDINGS.blacksmith.cost).sort()).toEqual(['iron_ingot', 'log', 'stone']);
    expect(RESEARCH_BY_ID.machine_shop.requires).toEqual(['blacksmith']);
    expect(RESEARCH_BY_ID.assembly.requires).toEqual(['machine_shop']);
    // Everything that costs plates comes after the Blacksmith.
    const after = (id: string, need: string): boolean => id === need || RESEARCH_BY_ID[id].requires.some((r) => after(r, need));
    for (const r of RESEARCH) if (r.cost.iron_plate) expect(after(r.id, 'blacksmith'), r.id).toBe(true);
    for (const r of RESEARCH) if (r.cost.gear || r.cost.wire) expect(after(r.id, 'machine_shop'), r.id).toBe(true);
  });

  it('v27 saves: furnaces making plates make ingots, workshops making gears or wire become machine shops, and the shops are researched', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    const gears = placed(w.place('workshop', 30, 20, 0));
    const rope = placed(w.place('workshop', 40, 20, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 27;
    old.researched = ['forestry', 'industry', 'logistics', 'workshop'];
    const byId = (id: number) => old.buildings.find((b: { id: number }) => b.id === id);
    byId(fu.id).recipe = 'iron_plate';
    byId(gears.id).recipe = 'gear';
    byId(gears.id).inputs = { iron_plate: 2 };
    byId(rope.id).recipe = 'rope';
    const loaded = World.fromJSON(JSON.stringify(old));
    const get = (id: number) => loaded.state.buildings.find((b) => b.id === id)!;
    expect(get(fu.id).recipe).toBe('iron_ingot');
    expect(get(gears.id).type).toBe('machine_shop');
    expect(get(gears.id).inputs).toEqual({ iron_plate: 2 }); // it keeps what it held
    expect(get(rope.id).type).toBe('workshop');
    expect(loaded.state.researched).toContain('blacksmith');
    expect(loaded.state.researched).toContain('machine_shop');
    // A game that had only just reached Industry researches the shops itself.
    old.researched = ['forestry', 'industry'];
    byId(gears.id).recipe = 'rope';
    expect(World.fromJSON(JSON.stringify(old)).state.researched.sort()).toEqual(['forestry', 'industry']);
  });
});

describe('Fuel (D-114)', () => {
  it('a new furnace arrives fuelled, burns only while working, and stops when the fuel runs out', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    expect(fu.ammo).toBe(FUEL.max);
    run(w, 5);
    expect(fu.ammo).toBe(FUEL.max); // idle: nothing burns
    fu.ammo = 1;
    fu.inputs = { iron_ore: 3 };
    fu.recipe = 'iron_ingot';
    run(w, 3);
    expect(fu.ammo).toBe(0);
    expect(outOfFuel(fu)).toBe(true);
    expect(fu.outputs).toEqual([]); // the first ingot needs 1.6 s of fire; it had 1
    const progress = fu.progress;
    run(w, 3);
    expect(fu.progress).toBe(progress); // stopped
    // A log is 8 s more, and it carries on.
    expect(w.insert(fu, 'log', 19, 20)).toBe(true);
    expect(fu.ammo).toBe(FUEL.burns.log);
    run(w, 1);
    expect(fu.outputs).toEqual(['iron_ingot']);
  });

  it('logs and charcoal fill the store up to its limit; other machines take no fuel', () => {
    const w = emptyWorld();
    const bs = placed(w.place('blacksmith', 20, 20, 0));
    bs.ammo = 0;
    expect(w.insert(bs, 'charcoal', 19, 20)).toBe(true);
    expect(bs.ammo).toBe(FUEL.burns.charcoal);
    expect(w.insert(bs, 'charcoal', 19, 20)).toBe(true);
    expect(w.insert(bs, 'log', 19, 20)).toBe(false); // full
    expect(bs.recipe).toBeNull(); // fuel doesn't pick a recipe
    const ws = placed(w.place('workshop', 30, 20, 0));
    expect(w.insert(ws, 'log', 29, 20)).toBe(true);
    expect(ws.recipe).toBe('rope'); // logs are rope there
    expect(ws.ammo).toBe(0);
  });

  it('a furnace making charcoal takes logs as its input first, and burns the rest', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    fu.ammo = 0;
    w.setRecipe(fu.id, 'charcoal');
    for (let i = 0; i < 7; i++) expect(w.insert(fu, 'log', 19, 20)).toBe(true);
    expect(fu.inputs.log).toBe(6); // three batches
    expect(fu.ammo).toBe(FUEL.burns.log);
  });

  it('charcoal needs its research, which needs the Blacksmith', () => {
    expect(RESEARCH_BY_ID.charcoal.requires).toEqual(['blacksmith']);
    const w = emptyWorld();
    w.state.researched = w.state.researched.filter((r) => r !== 'charcoal');
    const fu = placed(w.place('furnace', 20, 20, 0));
    w.setRecipe(fu.id, 'charcoal');
    expect(fu.recipe).toBeNull();
  });

  it('v28 saves: furnaces and blacksmiths start with a full store; a game making charcoal gets its research', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    const bs = placed(w.place('blacksmith', 30, 20, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 28;
    old.researched = ['forestry', 'industry', 'blacksmith'];
    for (const b of old.buildings) if (b.id === fu.id || b.id === bs.id) b.ammo = 0;
    old.buildings.find((b: { id: number }) => b.id === fu.id).recipe = 'charcoal';
    const loaded = World.fromJSON(JSON.stringify(old));
    for (const id of [fu.id, bs.id]) expect(loaded.state.buildings.find((b) => b.id === id)!.ammo).toBe(FUEL.max);
    expect(loaded.state.researched).toContain('charcoal');
    old.buildings.find((b: { id: number }) => b.id === fu.id).recipe = 'iron_ingot';
    expect(World.fromJSON(JSON.stringify(old)).state.researched).not.toContain('charcoal');
  });
});

describe('Ponds and water power (D-115)', () => {
  it('a new map has ponds, none near the hub, with no ore or trees on them; nothing is built on water, and engineers go round', () => {
    const w = World.create(4);
    expect(w.state.water.length).toBeGreaterThan(50);
    const hub = w.hub!;
    const [cx, cy] = [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2];
    for (const i of w.state.water) {
      const [x, y] = [i % w.state.width, Math.floor(i / w.state.width)];
      expect(Math.hypot(x - cx, y - cy)).toBeGreaterThanOrEqual(PONDS.minDist);
      expect(w.state.resources[i]).toBe(0);
      expect(w.state.trees[i]).toBe(NO_TREE);
    }
    const i = w.state.water[0];
    const [x, y] = [i % w.state.width, Math.floor(i / w.state.width)];
    w.state.researched = RESEARCH.map((r) => r.id);
    w.state.inventory = { brick: 99, iron_plate: 99, iron_rod: 99 };
    expect(w.place('well', x, y, 0)).toBe('water');
    expect(blocked(w, x, y)).toBe(true);
  });

  it('a water wheel goes with its front tile in a pond and the other two on land', () => {
    const w = emptyWorld();
    w.state.water = [];
    const pond = [w.idx(32, 20), w.idx(33, 20), w.idx(32, 21), w.idx(33, 21)];
    (w as unknown as { addWater(t: number[]): void }).addWater(pond);
    expect(w.place('water_wheel', 28, 20, 0)).toBe('needs-water'); // all on land
    expect(w.place('water_wheel', 31, 20, 0)).toBe('water'); // two tiles in the water
    expect(placed(w.place('water_wheel', 30, 20, 0)).type).toBe('water_wheel'); // front (east) tile at 32
    expect(w.wheelFront(32, 18, 1)).toEqual({ x: 32, y: 20 }); // facing south, its bottom tile
    expect(placed(w.place('water_wheel', 33, 18, 1)).type).toBe('water_wheel');
  });

  it('belts without power roll at roller speed; a well and a shaft power the whole line', () => {
    const w = emptyWorld();
    w.freePower = false;
    const line = [20, 21, 22, 23, 24].map((x) => placed(w.place('belt', x, 30, 0)));
    expect(w.speedOf(line[0])).toBeCloseTo(ROLLER.speed);
    placed(w.place('well', 20, 26, 0));
    expect(w.speedOf(line[0])).toBeCloseTo(ROLLER.speed); // not touching
    placed(w.place('shaft', 20, 28, 1));
    placed(w.place('shaft', 20, 29, 1));
    for (const b of line) expect(w.speedOf(b)).toBeCloseTo(BELT_SPEED);
    expect(w.powerNet(line[4])).toEqual({ supply: POWER.sources.well, demand: 5 * POWER.uses.belt! });
    // Items really move faster.
    line[0].belt.push({ item: 'gear', pos: 0, lane: RIGHT });
    run(w, 0.5);
    expect(line[0].belt[0].pos).toBeGreaterThan(BELT_SPEED * 0.5 - 0.1); // not ROLLER.speed * 0.5
  });

  it('a network short of power slows its belts evenly; a pair of underground belts carries power across', () => {
    const w = emptyWorld();
    w.freePower = false;
    placed(w.place('well', 10, 10, 0));
    const n = Math.round((2 * POWER.sources.well!) / POWER.uses.belt!); // twice what a well can power
    const line: Building[] = [];
    for (let i = 0; i < n; i++) line.push(placed(w.place('belt', 12 + (i % 60), 10 + Math.floor(i / 60) * 4, 0)));
    for (let r = 0; r < Math.ceil(n / 60); r++) for (let y = 11 + r * 4; y < 14 + r * 4; y++) placed(w.place('shaft', 12, y, 1));
    expect(w.powered(line[0])).toBeCloseTo(0.5);
    expect(w.speedOf(line[n - 1])).toBeCloseTo(ROLLER.speed + (BELT_SPEED - ROLLER.speed) * 0.5);
    // Underground: power crosses with the items.
    const v = emptyWorld();
    v.freePower = false;
    placed(v.place('well', 10, 20, 0));
    placed(v.place('tunnel', 12, 20, 0));
    placed(v.place('tunnel', 16, 20, 0));
    const far = placed(v.place('belt', 17, 20, 0));
    expect(v.powered(far)).toBe(1);
  });

  it('v29 saves get ponds away from their buildings, Hydraulics with Logistics, and stock for wells', () => {
    const w = emptyWorld();
    for (let x = 20; x < 30; x++) placed(w.place('belt', x, 30, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 29;
    delete old.water;
    old.researched = ['forestry', 'industry', 'blacksmith', 'logistics'];
    old.inventory = {};
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.water.length).toBeGreaterThan(50);
    for (const i of loaded.state.water) expect(loaded.tiles[i]).toBe(0);
    expect(loaded.state.researched).toContain('hydraulics');
    expect(loaded.state.inventory.brick).toBe(BUILDINGS.well.cost.brick);
    expect(loaded.state.inventory.iron_rod).toBeGreaterThanOrEqual(10);
    // The same save loads with the same ponds.
    expect(World.fromJSON(JSON.stringify(old)).state.water).toEqual(loaded.state.water);
  });

  it('Hydraulics comes after the Blacksmith, and Metal Logistics (belts) after Hydraulics', () => {
    expect(RESEARCH_BY_ID.hydraulics.requires).toEqual(['blacksmith']);
    expect(RESEARCH_BY_ID.hydraulics.unlocks.sort()).toEqual(['shaft', 'water_wheel', 'well']);
    expect(RESEARCH_BY_ID.logistics.requires).toEqual(['hydraulics']);
    expect(RESEARCH_BY_ID.logistics.name).toBe('Metal Logistics');
  });
});

describe('The Storage Unit (#87, D-116)', () => {
  it('holds six stacks of 50, mixed; takes from the back and sides, not its front; sends them out first in, first out', () => {
    const w = emptyWorld();
    const su = placed(w.place('storage', 20, 20, 0)); // 1×2 facing east: (20, 20) and (20, 21)
    expect(w.insert(su, 'gear', 21, 20)).toBe(false); // from the front
    expect(w.insert(su, 'gear', 21, 21)).toBe(false);
    expect(w.insert(su, 'gear', 19, 21)).toBe(true); // behind
    expect(w.insert(su, 'wire', 20, 19)).toBe(true); // the side
    for (let i = 0; i < 4 * STORAGE.stack - 1; i++) expect(w.insert(su, 'gear', 19, 20)).toBe(true); // four stacks of gears
    expect(w.insert(su, 'plank', 19, 20)).toBe(true); // the sixth stack
    expect(w.insert(su, 'log', 19, 20)).toBe(false); // no stack left for a seventh kind
    expect(w.insert(su, 'plank', 19, 20)).toBe(true); // but planks fit in theirs
    expect(su.outputs.length).toBe(4 * STORAGE.stack + 3);
    // A belt leaving its front takes them out, in the order they came.
    const out = placed(w.place('belt', 21, 20, 0));
    run(w, 0.2);
    expect(out.belt[0].item).toBe('gear');
    expect(su.outputs[0]).toBe('wire');
  });

  it('comes with Metal Logistics, and the engineer can Collect from it', () => {
    expect(RESEARCH_BY_ID.logistics.unlocks).toContain('storage');
    const w = emptyWorld();
    const su = placed(w.place('storage', 20, 20, 0));
    su.outputs = ['gear', 'gear', 'wire'];
    stand(w, 19, 20);
    expect(w.collect(su.id)).toBe(3);
    expect(su.outputs).toEqual([]);
  });
});

describe('Hydraulic defences (D-117)', () => {
  it("turrets don't fire without power, fire with it, and fire more slowly when their network runs short", () => {
    const w = emptyWorld();
    w.freePower = false;
    addNest(w, 50, 50, 0);
    const t = placed(w.place('turret', 57, 54, 0)); // a mound in reach to shoot at
    t.ammo = 40;
    run(w, 3);
    expect(t.ammo).toBe(40);
    expect(w.powered(t)).toBe(0);
    placed(w.place('well', 58, 54, 0)); // touching it
    expect(w.powered(t)).toBe(1);
    run(w, 3);
    const full = 40 - t.ammo;
    expect(full).toBeGreaterThan(0);
    // Eight more turrets on the same well, in a row touching the first: they share 8 power among 9.
    for (let y = 55; y < 63; y++) placed(w.place('turret', 57, y, 0));
    expect(w.powerNet(t)).toEqual({ supply: POWER.sources.well, demand: 9 * POWER.uses.turret! });
    t.ammo = 40;
    run(w, 3);
    expect(40 - t.ammo).toBeLessThan(full);
    expect(40 - t.ammo).toBeGreaterThan(0);
  });

  it('cannons need power too; the hub, ballistae and trebuchets do not', () => {
    expect([...HYDRAULIC].sort()).toEqual(['cannon', 'turret']);
    const w = emptyWorld();
    w.freePower = false;
    const c = placed(w.place('cannon', 20, 20, 0));
    expect(w.powered(c)).toBe(0);
    placed(w.place('shaft', 21, 20, 0));
    placed(w.place('well', 22, 20, 0));
    expect(w.powered(c)).toBe(1);
  });

  it('Advanced Defense gives turrets and brick walls after Hydraulics; Advanced Defense 2 cannons and reinforced walls', () => {
    expect(RESEARCH_BY_ID.defense.requires).toEqual(['hydraulics']);
    expect(RESEARCH_BY_ID.defense.unlocks.sort()).toEqual(['turret', 'wall']);
    expect(RESEARCH_BY_ID.ordnance.name).toBe('Advanced Defense 2');
    expect(RESEARCH_BY_ID.ordnance.requires.sort()).toEqual(['defense', 'machine_shop']);
    expect(RESEARCH_BY_ID.ordnance.unlocks.sort()).toEqual(['cannon', 'reinforced_wall']);
    expect(RESEARCH_BY_ID.masonry).toBeUndefined();
    const w = emptyWorld();
    const r = placed(w.place('reinforced_wall', 20, 20, 0));
    expect(w.maxHp(r)).toBeGreaterThan(2 * w.maxHp(placed(w.place('wall', 21, 20, 0))));
  });

  it('v30 saves trade Masonry for Advanced Defense (with Hydraulics), refund what was paid, and get stock for wells for their turrets', () => {
    const w = emptyWorld();
    for (let x = 20; x < 30; x++) placed(w.place('turret', x, 30, 0));
    placed(w.place('cannon', 20, 32, 0));
    const old = JSON.parse(w.toJSON());
    old.version = 30;
    old.researched = ['forestry', 'industry', 'masonry'];
    old.research = { active: 'masonry', paid: { masonry: { brick: 5 } }, budget: 0, stalled: false };
    old.inventory = {};
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.researched.sort()).toEqual(['blacksmith', 'defense', 'forestry', 'hydraulics', 'industry']);
    expect(loaded.state.research.active).toBeNull();
    const wells = Math.ceil((10 * POWER.uses.turret! + POWER.uses.cannon!) / POWER.sources.well!);
    expect(wells).toBe(2);
    expect(loaded.state.inventory.brick).toBe(5 + wells * BUILDINGS.well.cost.brick!);
    expect(loaded.state.inventory.iron_rod).toBe(wells * (BUILDINGS.well.cost.iron_rod! + 10) + 11 * 4);
  });
});

describe('The Steam Age: Engineering, steel and the Steel Works (D-119, D-120)', () => {
  it('Engineering opens the age after Assembly and Advanced Defense 2; steel needs Steelmaking', () => {
    expect(RESEARCH_BY_ID.engineering.requires.sort()).toEqual(['assembly', 'ordnance']);
    expect(RESEARCH_BY_ID.steelmaking.requires.sort()).toEqual(['charcoal', 'engineering']);
    expect(RESEARCH_BY_ID.steel_works.requires).toEqual(['steelmaking']);
    const w = emptyWorld();
    w.state.researched = w.state.researched.filter((r) => r !== 'steelmaking');
    const fu = placed(w.place('furnace', 20, 20, 0));
    expect(w.recipesFor('furnace').map((r) => r.id)).not.toContain('steel');
    w.state.researched.push('steelmaking');
    w.setRecipe(fu.id, 'steel');
    expect(fu.recipe).toBe('steel');
  });

  it('the Steel Works rolls steel into beams, and steel and gears into bearings', () => {
    const w = emptyWorld();
    w.state.inventory.steel = 99;
    const sw = placed(w.place('steel_works', 20, 20, 0));
    expect(w.insert(sw, 'iron_plate', 19, 20)).toBe(false);
    expect(w.insert(sw, 'steel', 19, 20)).toBe(true);
    expect(sw.recipe).toBe('steel_beam');
    w.insert(sw, 'steel', 19, 20);
    run(w, 4);
    expect(sw.outputs).toEqual(['steel_beam']);
    w.setRecipe(sw.id, 'bearing');
    sw.outputs = [];
    w.insert(sw, 'steel', 19, 20);
    w.insert(sw, 'gear', 19, 20);
    run(w, 4);
    expect(sw.outputs).toEqual(['bearing', 'bearing']);
  });

  it('v32 saves already making or holding steel get Steelmaking and Engineering', () => {
    const w = emptyWorld();
    const fu = placed(w.place('furnace', 20, 20, 0));
    fu.recipe = 'steel';
    const old = JSON.parse(w.toJSON());
    old.version = 32;
    old.researched = ['forestry', 'industry', 'charcoal'];
    expect(World.fromJSON(JSON.stringify(old)).state.researched).toEqual(expect.arrayContaining(['engineering', 'steelmaking']));
    old.buildings.find((b: Building) => b.id === fu.id).recipe = null;
    old.inventory = {};
    expect(World.fromJSON(JSON.stringify(old)).state.researched).not.toContain('steelmaking');
  });
});

describe('Electricity (D-119, D-121)', () => {
  /** A boiler touching a well, a turbine touching the boiler, and a pole by the turbine. */
  function plant(w: World, x: number, y: number) {
    w.state.inventory.steel = 999;
    const well = placed(w.place('well', x, y, 0));
    const boiler = placed(w.place('boiler', x + 2, y, 0));
    const turbine = placed(w.place('steam_turbine', x + 4, y, 0));
    const pole = placed(w.place('power_pole', x + 6, y, 0));
    return { well, boiler, turbine, pole };
  }

  it('networks are worked out again when buildings change, not when trees or ore do', () => {
    const w = emptyWorld();
    const { pole } = plant(w, 20, 20);
    const net = w.electricNet(pole);
    expect(net).toBeDefined();
    w.layout += 5; // trees felled or growing back, ore running out
    expect(w.electricNet(pole)).toBe(net);
    placed(w.place('power_pole', 30, 20, 0));
    expect(w.electricNet(pole)).not.toBe(net);
  });

  it('a boiler with fuel and water makes steam for its turbine, burning fuel; without water or fuel it stops', () => {
    const w = emptyWorld();
    w.freePower = false;
    const { boiler, turbine, pole } = plant(w, 20, 20);
    expect(boiler.ammo).toBe(FUEL.max); // arrives with a full store, like a furnace
    expect(w.boilerWorks(boiler)).toBe(true);
    expect(w.steam(turbine)).toBe(1);
    expect(w.electricSupply(w.electricNet(pole)!)).toBe(ELECTRIC.turbine);
    run(w, 2);
    expect(boiler.ammo).toBeCloseTo(FUEL.max - 2, 1);
    expect(w.insert(boiler, 'iron_plate', 21, 19)).toBe(false); // fuel only
    expect(w.insert(boiler, 'charcoal', 21, 19)).toBe(false); // no room for 24 s more
    boiler.ammo = 10;
    expect(w.insert(boiler, 'charcoal', 21, 19)).toBe(true);
    boiler.ammo = 0;
    expect(w.steam(turbine)).toBe(0);
    boiler.ammo = 10;
    const dry = emptyWorld();
    dry.state.inventory.steel = 999;
    const b2 = placed(dry.place('boiler', 30, 30, 0));
    placed(dry.place('steam_turbine', 32, 30, 0));
    expect(dry.hasWater(b2)).toBe(false);
    expect(dry.boilerWorks(b2)).toBe(false);
  });

  it('poles link within reach and power express belts near them; a line of express belts passes it along', () => {
    const w = emptyWorld();
    w.freePower = false;
    const { pole } = plant(w, 20, 20);
    const line = [9, 10, 11, 12, 13, 14].map((x) => placed(w.place('express_belt', 20 + x, 20, 0)));
    expect(w.electrified(line[5])).toBe(0); // out of the first pole's reach
    expect(w.speedOf(line[5])).toBeCloseTo(ROLLER.speed);
    const far = placed(w.place('power_pole', 31, 22, 0)); // within 6 tiles of the first, and 2 of the belts
    expect(w.electricNet(far)).toBe(w.electricNet(pole));
    expect(w.electrified(line[5])).toBe(1);
    expect(w.speedOf(line[0])).toBeCloseTo(EXPRESS_BELT_SPEED);
    expect(w.electricNet(line[0])!.demand).toBeCloseTo(6 * ELECTRIC.uses.express_belt!);
    // A pole too far from the others is a network of its own, with no turbine.
    const alone = placed(w.place('power_pole', 60, 60, 0));
    expect(w.electricNet(alone)).not.toBe(w.electricNet(pole));
  });

  it('a network short of electricity slows its express belts evenly; a boiler feeding two turbines shares its steam', () => {
    const w = emptyWorld();
    w.freePower = false;
    const { boiler, turbine } = plant(w, 20, 20);
    const second = placed(w.place('steam_turbine', 22, 22, 0)); // below the boiler, touching it too
    expect(w.touching(boiler).filter((b) => b.type === 'steam_turbine')).toHaveLength(2);
    expect(w.steam(turbine)).toBeCloseTo(0.5);
    expect(w.steam(second)).toBeCloseTo(0.5);
    // 0.5 × 60 = 30 supply, as many belts as use 60.
    const n = Math.round((2 * 0.5 * ELECTRIC.turbine) / ELECTRIC.uses.express_belt!);
    for (let i = 0; i < n; i++) placed(w.place('express_belt', 27 + (i % 20), 22 + Math.floor(i / 20), 0)); // the pole reaches the first
    const b = w.buildingAt(46, 27)!;
    expect(w.electrified(b)).toBeCloseTo(0.5, 1);
  });

  it('Steam Power comes after Steelmaking; Express Logistics, with the express belt, after Steam Power', () => {
    expect(RESEARCH_BY_ID.steam_power.requires).toEqual(['steelmaking']);
    expect(RESEARCH_BY_ID.steam_power.unlocks.sort()).toEqual(['boiler', 'power_pole', 'steam_turbine']);
    expect(RESEARCH_BY_ID.express_logistics.requires).toEqual(['steam_power']);
    expect(RESEARCH_BY_ID.express_logistics.unlocks).toContain('express_belt');
  });
});

describe('Mk2 machines and the Storage Silo (D-122)', () => {
  it('a furnace upgraded in place keeps what it holds, and works twice as fast with electricity, Mk1 speed without', () => {
    const w = emptyWorld();
    w.freePower = false;
    Object.assign(w.state.inventory, { steel_beam: 99, bearing: 99, steel: 999 });
    const fu = placed(w.place('furnace', 20, 20, 0));
    w.insert(fu, 'iron_ore', 19, 20);
    w.state.researched = w.state.researched.filter((r) => r !== 'mk2');
    expect(w.upgradeMachine(fu.id)).toBe('locked');
    w.state.researched.push('mk2');
    const beams = w.state.inventory.steel_beam!;
    expect(w.upgradeMachine(fu.id)).toBeNull();
    expect(fu.tier).toBe(2);
    expect(w.state.inventory.steel_beam).toBe(beams - MK2.cost.steel_beam!);
    expect(fu.recipe).toBe('iron_ingot');
    expect(w.upgradeMachine(fu.id)).toBe('cost'); // next is Mk3 (D-127), and there are no circuits
    expect(w.speedUp(fu)).toBe(1); // no electricity yet
    // A plant, and a pole by the furnace.
    placed(w.place('well', 30, 20, 0));
    placed(w.place('boiler', 32, 20, 0));
    placed(w.place('steam_turbine', 34, 20, 0));
    placed(w.place('power_pole', 36, 22, 0));
    placed(w.place('power_pole', 23, 22, 0)); // by the furnace, 13 tiles away: not linked
    expect(w.speedUp(fu)).toBe(1);
    placed(w.place('power_pole', 30, 22, 0));
    placed(w.place('power_pole', 26, 22, 0)); // links them
    expect(w.electricNet(fu)!.demand).toBe(MK2.uses);
    expect(w.speedUp(fu)).toBe(MK2.speed);
    expect(w.upgradeMachine(placed(w.place('steel_works', 40, 30, 0)).id)).toBe('occupied'); // only extractors and furnaces
  });

  it('a Mk2 extractor mines twice as fast with electricity; demolishing it returns the upgrade too', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel_beam: 99, bearing: 99 });
    for (let y = 20; y < 22; y++) for (let x = 20; x < 22; x++) w.state.resources[w.idx(x, y)] = 1;
    const a = placed(w.place('extractor', 20, 20, 0));
    for (let y = 30; y < 32; y++) for (let x = 20; x < 22; x++) w.state.resources[w.idx(x, y)] = 1;
    const b = placed(w.place('extractor', 20, 30, 0));
    w.upgradeMachine(b.id); // freePower: full electricity
    run(w, EXTRACTOR_PERIOD / 2 + 0.05);
    expect(a.outputs.length).toBe(0);
    expect(b.outputs.length).toBeGreaterThan(0);
    const beams = w.state.inventory.steel_beam!;
    w.demolish(b.id);
    expect(w.state.inventory.steel_beam).toBe(beams + MK2.cost.steel_beam!);
  });

  it('the Storage Silo holds twelve stacks of 100, mixed, first in, first out', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, steel_beam: 99 });
    const si = placed(w.place('storage_silo', 20, 20, 0));
    expect(w.insert(si, 'gear', 22, 20)).toBe(false); // from its front
    for (let i = 0; i < SILO.slots * SILO.stack; i++) expect(w.insert(si, i < 200 ? 'gear' : 'brick', 19, 20)).toBe(true);
    expect(w.insert(si, 'brick', 19, 20)).toBe(false);
    expect(RESEARCH_BY_ID.express_logistics.unlocks).toContain('storage_silo');
    expect(RESEARCH_BY_ID.mk2.requires.sort()).toEqual(['steam_power', 'steel_works']);
  });
});

describe('Gunpowder weapons: sulfur, the Powder Mill and the Turret Mk.2 (D-123)', () => {
  it('new maps have sulfur deposits far from the hub, the same for the same seed; v34 saves get them on free ground', () => {
    const w = World.create(5);
    const hub = w.hub!;
    const [cx, cy] = [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2];
    const sulfur = w.state.resources.flatMap((r, i) => (r === 4 ? [i] : []));
    expect(sulfur.length).toBeGreaterThan(SULFUR.count * 4);
    for (const i of sulfur) {
      const [x, y] = [i % w.state.width, Math.floor(i / w.state.width)];
      expect(Math.hypot(x - cx, y - cy)).toBeGreaterThanOrEqual(SULFUR.minDist - 1);
      expect(w.resourceAt(x, y)).toBe('sulfur');
    }
    expect(World.create(5).state.resources).toEqual(w.state.resources);
    const old = JSON.parse(w.toJSON());
    old.version = 34;
    old.resources = old.resources.map((r: number) => (r === 4 ? 0 : r));
    const loaded = World.fromJSON(JSON.stringify(old));
    const again = loaded.state.resources.filter((r) => r === 4).length;
    expect(again).toBeGreaterThan(SULFUR.count * 4);
    for (const b of loaded.state.buildings) expect(loaded.resourceAt(b.x, b.y)).not.toBe('sulfur');
  });

  it('powder mills make gunpowder, the Steel Works casings and the assembler bullets, after Heavy Defense', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99 });
    const pm = placed(w.place('powder_mill', 20, 20, 0));
    expect(w.insert(pm, 'sulfur', 19, 20)).toBe(true);
    w.insert(pm, 'charcoal', 19, 20);
    run(w, 3.2);
    expect(pm.outputs).toEqual(['gunpowder', 'gunpowder']);
    expect(w.recipesFor('steel_works').map((r) => r.id)).toContain('casing');
    expect(w.recipesFor('assembler').map((r) => r.id)).toContain('bullet');
    w.state.researched = w.state.researched.filter((r) => r !== 'heavy_defense');
    expect(w.recipesFor('assembler').map((r) => r.id)).not.toContain('bullet');
    expect(RESEARCH_BY_ID.heavy_defense.requires.sort()).toEqual(['steam_power', 'steelmaking']);
    expect(RESEARCH_BY_ID.heavy_defense.unlocks.sort()).toEqual(['powder_mill', 'steel_wall', 'turret2']);
  });

  it("the Turret Mk.2 fires bullets with electricity, and doesn't without", () => {
    const w = emptyWorld();
    w.freePower = false;
    Object.assign(w.state.inventory, { steel: 999, steel_beam: 99 });
    addNest(w, 50, 50, 0);
    const t = placed(w.place('turret2', 57, 54, 0)); // a mound in reach
    t.ammo = 60;
    run(w, 2);
    expect(t.ammo).toBe(60);
    expect(w.insert(t, 'iron_plate', 58, 54)).toBe(false);
    placed(w.place('well', 57, 57, 0));
    placed(w.place('boiler', 59, 57, 0));
    placed(w.place('steam_turbine', 61, 57, 0));
    placed(w.place('power_pole', 59, 55, 0)); // within reach of the turret and the turbine
    expect(w.electrified(t)).toBe(1);
    run(w, 2);
    expect(t.ammo).toBeLessThan(60);
    const wall = placed(w.place('steel_wall', 70, 70, 0));
    expect(wall.hp).toBe(w.maxHp(wall)); // Chitin Plating counts it too
    expect(BUILDINGS.steel_wall.hp).toBeGreaterThan(BUILDINGS.reinforced_wall.hp);
  });
});

describe('Heavy Defense 2 and the hull (D-124)', () => {
  it('mortars and artillery fire shells with electricity, splashing where they land; the assembler makes shells', () => {
    expect(RESEARCH_BY_ID.heavy_defense2.requires.sort()).toEqual(['heavy_defense', 'steel_works']);
    expect(RESEARCH_BY_ID.heavy_defense2.unlocks.sort()).toEqual(['artillery', 'mortar']);
    expect(TURRETS.artillery!.range).toBeGreaterThan(TURRETS.trebuchet!.range);
    expect(TURRETS.mortar!.splash).toBeGreaterThan(0);
    for (const type of ['mortar', 'artillery'] as const) {
      const w = emptyWorld();
      w.freePower = false;
      Object.assign(w.state.inventory, { steel: 999, steel_beam: 99, bearing: 99 });
      const n = addNest(w, 50, 50, 0);
      const [mx, my] = nestCentre(n);
      const g = placed(w.place(type, Math.round(mx) + 9, Math.round(my), 0)); // past both blind spots
      g.ammo = 10;
      run(w, 6);
      expect(g.ammo).toBe(10); // no electricity
      expect(ELECTRIC_DEFENCES).toContain(type);
      w.freePower = true;
      run(w, 6);
      expect(g.ammo).toBeLessThan(10);
    }
    const w = emptyWorld();
    expect(w.recipesFor('assembler').map((r) => r.id)).toContain('shell');
  });
});

describe('The Electric Age: Electronics and the Circuit Works (D-125)', () => {
  it('Electronics opens the age after Mk2 Machines and Heavy Defense 2; Circuit Works comes after it', () => {
    expect(RESEARCH_BY_ID.electronics.requires.sort()).toEqual(['heavy_defense2', 'mk2']);
    expect(RESEARCH_BY_ID.circuit_works.requires).toEqual(['electronics']);
    expect(RESEARCH_BY_ID.circuit_works.unlocks).toEqual(['circuit_works']);
  });

  it('the Circuit Works makes circuit boards and coils, but only with electricity', () => {
    const w = emptyWorld();
    w.freePower = false;
    Object.assign(w.state.inventory, { steel: 999, steel_beam: 99, motor: 9 });
    const cw = placed(w.place('circuit_works', 29, 20, 0));
    expect(w.insert(cw, 'gear', 28, 20)).toBe(false);
    expect(w.insert(cw, 'wire', 28, 20)).toBe(true);
    expect(cw.recipe).toBe('circuit');
    for (let i = 0; i < 2; i++) w.insert(cw, 'wire', 28, 20);
    w.insert(cw, 'iron_plate', 28, 20);
    run(w, 5);
    expect(cw.outputs).toEqual([]); // no electricity: it can't work
    expect(w.speedUp(cw)).toBe(0);
    // A boiler, a turbine and a pole by it.
    placed(w.place('well', 20, 20, 0));
    placed(w.place('boiler', 22, 20, 0));
    placed(w.place('steam_turbine', 24, 20, 0));
    placed(w.place('power_pole', 27, 20, 0));
    expect(w.electrified(cw)).toBe(1);
    expect(w.electricNet(cw)!.demand).toBe(ELECTRIC.uses.circuit_works);
    run(w, 4);
    expect(cw.outputs).toEqual(['circuit']);
    w.setRecipe(cw.id, 'coil');
    cw.outputs = [];
    for (let i = 0; i < 4; i++) w.insert(cw, 'wire', 28, 20);
    w.insert(cw, 'iron_rod', 28, 20);
    run(w, 4);
    expect(cw.outputs).toEqual(['coil']);
  });
});

describe('Electric Defense: the Tesla, the Arc Fence and Floodlights (D-126)', () => {
  it('Electric Defense comes after Circuit Works, with the tesla, arc fence and floodlight; no blueprint is needed', () => {
    expect(RESEARCH_BY_ID.electric_defense.requires).toEqual(['circuit_works']);
    expect(RESEARCH_BY_ID.electric_defense.unlocks.sort()).toEqual(['arc_fence', 'floodlight', 'tesla']);
    const w = emptyWorld();
    expect(w.state.ship.blueprints).toEqual([]);
    expect(w.isUnlocked('tesla')).toBe(true);
  });

  it("a tesla doesn't fire without electricity", () => {
    const w = emptyWorld();
    w.freePower = false;
    Object.assign(w.state.inventory, { steel: 99, circuit: 9, coil: 9 });
    const t = placed(w.place('tesla', w.hub!.x - 20, w.hub!.y - 10, 0));
    const e = w.spawnBug('crawler', addNest(w, 0, 0, 0), 1);
    Object.assign(e, { x: t.x + 3.5, y: t.y + 0.5, hp: 1000, maxHp: 1000 });
    run(w, 2);
    expect(e.hp).toBe(1000);
  });

  /** A bug walking at the hub's west side from `dx` tiles out, with a building of `type` in its way. */
  function biter(type: 'arc_fence' | 'steel_wall', power = true) {
    const w = emptyWorld();
    w.freePower = power;
    Object.assign(w.state.inventory, { steel: 999, steel_beam: 999, coil: 999, wire: 999 });
    const hub = w.hub!;
    const y = hub.y + 2;
    // A wall across the whole way in, so the bug has to bite through it.
    for (let dy = -12; dy <= 12; dy++) placed(w.place(type, hub.x - 6, y + dy, 0));
    const n = addNest(w, 0, 0, 0);
    n.angryUntil = 1e9;
    const e = w.spawnBug('crawler', n, 1);
    Object.assign(e, { x: hub.x - 7.5, y: y + 0.5, hp: 1e6, maxHp: 1e6 });
    w.rebuildPaths();
    run(w, 3);
    return { w, e, fence: w.buildingAt(hub.x - 6, y)! };
  }

  it('an arc fence shocks the bugs biting it, with electricity; a steel wall or an unpowered fence does not', () => {
    const { w, e, fence } = biter('arc_fence');
    expect(fence.hp).toBeLessThan(w.maxHp(fence)); // it was bitten
    expect(e.hp).toBeLessThan(1e6 - ARC_FENCE.dps); // and shocked back for more than a second of it
    expect(biter('steel_wall').e.hp).toBe(1e6);
    expect(biter('arc_fence', false).e.hp).toBe(1e6);
  });

  it('a lit floodlight slows bugs around it at night, and only then; it sees far into the fog', () => {
    const w = emptyWorld();
    w.freePower = false;
    Object.assign(w.state.inventory, { circuit: 9, iron_rod: 99, wire: 99 });
    const hub = w.hub!;
    const f = placed(w.place('floodlight', hub.x - 30, hub.y, 0));
    const [cx, cy] = w.centreOf(f);
    w.state.time = CLOCK.day + 10; // night
    expect(w.inFloodlight(cx + 3, cy)).toBe(false); // no electricity: dark
    w.freePower = true;
    w.state.time += 1; // a new tick works it out again
    expect(w.inFloodlight(cx + 3, cy)).toBe(true);
    expect(w.inFloodlight(cx + FLOODLIGHT.radius + 1, cy)).toBe(false);
    w.state.time = 10; // day
    expect(w.inFloodlight(cx + 3, cy)).toBe(false);
    // A bug crossing its light at night moves at FLOODLIGHT.slow of its speed.
    const walk = (night: boolean) => {
      const v = emptyWorld();
      v.state.inventory = { ...v.state.inventory, circuit: 9, iron_rod: 99, wire: 99 };
      const h = v.hub!;
      const y = h.y + 2;
      placed(v.place('floodlight', h.x - 12, y + 3, 0));
      v.state.time = night ? CLOCK.day + 10 : 10;
      const n = addNest(v, 0, 0, 0);
      n.angryUntil = 1e9;
      const e = v.spawnBug('crawler', n, 1);
      Object.assign(e, { x: h.x - 14.5, y: y + 0.5, hp: 1e6, maxHp: 1e6 });
      v.rebuildPaths();
      run(v, 1);
      return e.x - (h.x - 14.5);
    };
    expect(walk(true) / walk(false)).toBeCloseTo(FLOODLIGHT.slow, 1);
    expect(sightOf(f)).toBe(FLOODLIGHT.sight);
  });
});

describe('Mk3 machines (D-127)', () => {
  it('Mk3 Machines comes after Circuit Works and Mk2 Machines', () => {
    expect(RESEARCH_BY_ID.mk3.requires.sort()).toEqual(['circuit_works', 'mk2']);
  });

  it('a Mk2 furnace upgrades to Mk3 and works three times as fast with electricity; a Mk1 one goes to Mk2 first', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel_beam: 99, bearing: 99, motor: 99, circuit: 99, coil: 99 });
    const fu = placed(w.place('furnace', 20, 20, 0));
    expect(w.upgradeMachine(fu.id)).toBeNull();
    expect(fu.tier).toBe(2);
    w.state.researched = w.state.researched.filter((r) => r !== 'mk3');
    expect(w.upgradeMachine(fu.id)).toBe('locked');
    w.state.researched.push('mk3');
    const circuits = w.state.inventory.circuit!;
    expect(w.upgradeMachine(fu.id)).toBeNull();
    expect(fu.tier).toBe(3);
    expect(w.state.inventory.circuit).toBe(circuits - MK3.cost.circuit!);
    expect(w.upgradeMachine(fu.id)).toBe('occupied'); // nothing past Mk3
    expect(w.speedUp(fu)).toBe(MK3.speed); // freePower: full electricity
    w.freePower = false;
    expect(w.speedUp(fu)).toBe(1); // no electricity: Mk1 speed
    expect(electricUse(fu)).toBe(MK3.uses);
  });

  it('an assembler upgrades straight to Mk3; demolishing it returns the upgrade; other machines have none', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel_beam: 99, steel: 99 });
    const as = placed(w.place('assembler', 20, 20, 0));
    expect(w.upgradeMachine(as.id)).toBeNull();
    expect(as.tier).toBe(3);
    w.setRecipe(as.id, 'motor');
    for (const [k, n] of Object.entries({ gear: 1, wire: 2, iron_plate: 1 })) for (let i = 0; i < n; i++) w.insert(as, k as ItemId, 19, 20);
    run(w, 4 / MK3.speed + 0.1);
    expect(as.outputs).toEqual(['motor']);
    const coils = w.state.inventory.coil!;
    w.demolish(as.id);
    expect(w.state.inventory.coil).toBe(coils + MK3.cost.coil!);
    expect(w.upgradeMachine(placed(w.place('steel_works', 40, 30, 0)).id)).toBe('occupied');
  });

  it('a Mk3 furnace demolished returns both upgrades', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel_beam: 99, bearing: 99, circuit: 99, coil: 99 });
    const fu = placed(w.place('furnace', 20, 20, 0));
    w.upgradeMachine(fu.id);
    w.upgradeMachine(fu.id);
    const [beams, bearings] = [w.state.inventory.steel_beam!, w.state.inventory.bearing!];
    w.demolish(fu.id);
    expect(w.state.inventory.steel_beam).toBe(beams + MK2.cost.steel_beam! + MK3.cost.steel_beam!);
    expect(w.state.inventory.bearing).toBe(bearings + MK2.cost.bearing!);
  });
});

describe('Drone pads (D-128)', () => {
  /** A sending pad holding `n` iron plates and a pad receiving them `dx` tiles east. */
  function pads(dx: number, n = 20) {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, motor: 99, steel_beam: 99 });
    const send = placed(w.place('drone_pad', 20, 20, 0));
    const get = placed(w.place('drone_pad', 20 + dx, 20, 0));
    for (let i = 0; i < n; i++) expect(w.insert(send, 'iron_plate', 19, 20)).toBe(true);
    w.setFilter(get.id, 'iron_plate');
    return { w, send, get };
  }

  it('Drone Logistics comes after Circuit Works', () => {
    expect(RESEARCH_BY_ID.drones.requires).toEqual(['circuit_works']);
    expect(RESEARCH_BY_ID.drones.unlocks).toEqual(['drone_pad']);
  });

  it('a sending pad takes one kind of item from belts; a receiving pad takes none from belts', () => {
    const { w, send, get } = pads(10);
    expect(w.insert(send, 'gear', 19, 20)).toBe(false); // one kind only
    expect(w.insert(get, 'iron_plate', 29, 20)).toBe(false);
  });

  it('a drone flies a load to the pad that asks, comes home, and goes again until it is full', () => {
    const { w, send, get } = pads(10);
    w.tick();
    expect(w.state.drones).toHaveLength(1);
    expect(w.state.drones[0]).toMatchObject({ home: send.id, to: get.id, item: 'iron_plate', count: DRONES.load });
    expect(send.outputs.length).toBe(20 - DRONES.load);
    const leg = 10 / DRONES.speed;
    run(w, leg + 0.1);
    expect(get.outputs.length).toBe(DRONES.load);
    expect(w.state.drones[0].back).toBe(true);
    run(w, leg + 0.2); // home, and off again
    expect(w.state.drones).toHaveLength(1);
    expect(w.state.drones[0].back).toBe(false);
    run(w, 3 * (2 * leg + 0.2));
    expect(get.outputs.length).toBe(20);
    expect(send.outputs.length).toBe(0);
  });

  it('a receiving pad puts what it gets on a belt leaving its front', () => {
    const { w, get } = pads(6, 8);
    const belt = placed(w.place('belt', 27, 20, 0));
    run(w, 2 * (6 / DRONES.speed) + 1);
    expect(get.outputs.length + belt.belt.length).toBeGreaterThan(0);
    expect(belt.belt.length).toBeGreaterThan(0);
  });

  it('pads out of range, or without electricity, send nothing', () => {
    const far = pads(DRONES.range + 2);
    far.w.tick();
    expect(far.w.state.drones).toHaveLength(0);
    const dark = pads(10);
    dark.w.freePower = false;
    dark.w.tick();
    expect(dark.w.state.drones).toHaveLength(0);
  });

  it('a drone whose pad is demolished on the way comes home with its load; switching a pad empties it into the hub', () => {
    const { w, send, get } = pads(10, 8);
    w.tick();
    expect(send.outputs.length).toBe(0);
    w.demolish(get.id);
    run(w, 1);
    expect(w.state.drones).toHaveLength(0);
    expect(send.outputs.length).toBe(8);
    const plates = w.state.inventory.iron_plate ?? 0;
    w.setFilter(send.id, 'gear');
    expect(send.outputs.length).toBe(0);
    expect(w.state.inventory.iron_plate).toBe(plates + 8);
  });

  it('a pad switched to sending while a drone flies to it sends the load home; pickups never mix items', () => {
    const { w, send, get } = pads(10, 8);
    w.tick();
    expect(w.state.drones[0]).toMatchObject({ to: get.id, item: 'iron_plate', count: 8 });
    w.setFilter(get.id, null); // now a sending pad
    for (let i = 0; i < 4; i++) expect(w.insert(get, 'gear', 29, 20)).toBe(true);
    run(w, 2 * (10 / DRONES.speed) + 1);
    expect(get.outputs).toEqual(['gear', 'gear', 'gear', 'gear']);
    expect(send.outputs.filter((i) => i === 'iron_plate').length).toBe(8);
    // A pad asking for gears takes only the gears at the front of a mixed pad.
    const mixed = placed(w.place('drone_pad', 20, 26, 0));
    mixed.outputs.push('gear', 'gear', 'iron_plate');
    const want = placed(w.place('drone_pad', 26, 26, 0));
    w.setFilter(want.id, 'gear');
    w.demolish(get.id);
    w.tick();
    const d = w.state.drones.find((x) => x.to === want.id)!;
    expect(d).toMatchObject({ home: mixed.id, item: 'gear', count: 2 });
    expect(mixed.outputs).toEqual(['iron_plate']);
  });

  it('v37 saves get an empty list of drones', () => {
    const w = emptyWorld();
    const old = JSON.parse(w.toJSON());
    old.version = 37;
    delete old.drones;
    expect(World.fromJSON(JSON.stringify(old)).state.drones).toEqual([]);
  });
});

describe('Electric Defense 2: the Shield Pylon and the Railgun (D-129)', () => {
  it('Electric Defense 2 comes after Electric Defense, with the shield pylon and railgun', () => {
    expect(RESEARCH_BY_ID.electric_defense2.requires).toEqual(['electric_defense']);
    expect(RESEARCH_BY_ID.electric_defense2.unlocks.sort()).toEqual(['railgun', 'shield_pylon']);
  });

  it('a shield pylon charges with electricity and takes the bites on buildings near it until its shield is gone', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel_beam: 99, steel: 999 });
    const hub = w.hub!;
    const pylon = placed(w.place('shield_pylon', hub.x - 8, hub.y + 2, 0));
    expect(pylon.ammo).toBe(0); // it arrives empty
    run(w, 2);
    expect(pylon.ammo).toBeCloseTo(2 * SHIELD.recharge, 0);
    const wall = placed(w.place('steel_wall', hub.x - 10, hub.y + 2, 0)); // within reach
    const far = placed(w.place('steel_wall', hub.x - 20, hub.y + 2, 0));
    pylon.ammo = 30;
    const hp = wall.hp;
    expect(w.shielded(wall, 20)).toBe(0);
    expect(pylon.ammo).toBe(10);
    expect(w.shielded(wall, 20)).toBe(10); // what the shield can't take gets through
    expect(pylon.ammo).toBe(0);
    expect(wall.hp).toBe(hp); // shielded() only works out the damage; the bite takes it
    pylon.ammo = 30;
    expect(w.shielded(far, 20)).toBe(20); // out of reach
    w.freePower = false;
    pylon.ammo = 0;
    run(w, 1);
    expect(pylon.ammo).toBe(0); // no electricity: no recharge
  });

  it('a bug biting a shielded wall wears down the shield before the wall', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel_beam: 999, steel: 999 });
    const hub = w.hub!;
    const y = hub.y + 2;
    for (let dy = -12; dy <= 12; dy++) placed(w.place('steel_wall', hub.x - 6, y + dy, 0));
    const pylon = placed(w.place('shield_pylon', hub.x - 4, y, 0));
    pylon.ammo = SHIELD.max;
    w.freePower = false; // no recharge, so the bites show on the shield
    const n = addNest(w, 0, 0, 0);
    n.angryUntil = 1e9;
    const e = w.spawnBug('crawler', n, 1);
    Object.assign(e, { x: hub.x - 7.5, y: y + 0.5, hp: 1e6, maxHp: 1e6 });
    w.rebuildPaths();
    run(w, 3);
    const wall = w.buildingAt(hub.x - 6, y)!;
    expect(wall.hp).toBe(w.maxHp(wall));
    expect(pylon.ammo).toBeLessThan(SHIELD.max);
  });

  it('a railgun slug goes through every bug near its line, up to its range, and needs electricity', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel_beam: 99, bearing: 99 });
    const rg = placed(w.place('railgun', w.hub!.x - 40, w.hub!.y - 20, 0));
    const [cx, cy] = w.centreOf(rg);
    const n = addNest(w, 0, 0, 0);
    const def = TURRETS.railgun!;
    // Three in a line east of it, one beside the line, one past its range.
    const at = (dx: number, dy: number) => {
      const e = w.spawnBug('crawler', n, 1);
      Object.assign(e, { x: cx + dx, y: cy + dy, hp: 1000, maxHp: 1000 });
      return e;
    };
    const line = [at(4, 0), at(9, 0.3), at(15, -0.4)];
    const beside = at(9, 3);
    const past = at(def.range + 2, 0);
    w.tick();
    expect(line.map((e) => e.hp)).toEqual([1000 - def.damage, 1000 - def.damage, 1000 - def.damage]);
    expect(beside.hp).toBe(1000);
    expect(past.hp).toBe(1000);
    expect(w.shots.some((s) => s.beam)).toBe(true);
    const dark = emptyWorld();
    dark.freePower = false;
    Object.assign(dark.state.inventory, { circuit: 99, coil: 99, steel_beam: 99, bearing: 99 });
    const r2 = placed(dark.place('railgun', dark.hub!.x - 40, dark.hub!.y - 20, 0));
    const [x2, y2] = dark.centreOf(r2);
    const e2 = dark.spawnBug('crawler', addNest(dark, 0, 0, 0), 1);
    Object.assign(e2, { x: x2 + 5, y: y2, hp: 1000, maxHp: 1000 });
    dark.tick();
    expect(e2.hp).toBe(1000);
  });
});

describe("The colony's special buildings (D-131)", () => {
  it('a greenhouse grows logs from nothing but electricity', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, circuit: 99 });
    w.state.ship.blueprints.push('greenhouse');
    const g = placed(w.place('greenhouse', 20, 20, 0));
    expect(g.recipe).toBe('greenhouse_log');
    expect(w.insert(g, 'log', 19, 20)).toBe(false); // it takes nothing
    run(w, RECIPE_BY_ID.greenhouse_log.time + 0.2);
    expect(g.outputs).toEqual(['log', 'log']);
    w.freePower = false;
    g.outputs = [];
    run(w, RECIPE_BY_ID.greenhouse_log.time + 0.2);
    expect(g.outputs).toEqual([]);
  });

  it('a receiving teleporter pulls its item at once from any sending one, however far', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel_beam: 99 });
    w.state.ship.blueprints.push('teleporter');
    const send = placed(w.place('teleporter', 20, 20, 0));
    const get = placed(w.place('teleporter', 200, 200, 0));
    for (let i = 0; i < 10; i++) w.insert(send, 'gear', 19, 20);
    w.setFilter(get.id, 'gear');
    run(w, 1);
    expect(get.outputs.length).toBe(TELEPORT.rate);
    expect(send.outputs.length).toBe(10 - TELEPORT.rate);
    w.freePower = false;
    run(w, 1);
    expect(get.outputs.length).toBe(TELEPORT.rate);
  });

  it('a strike beacon charges over a day, then strikes an explored spot: bugs and a nest there are wrecked', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { circuit: 99, coil: 99, steel: 99 });
    w.state.ship.blueprints.push('strike_beacon');
    const b = placed(w.place('strike_beacon', w.hub!.x - 6, w.hub!.y, 0));
    const n = addNest(w, w.hub!.x - 40, w.hub!.y - 40, 0);
    const [mx, my] = nestCentre(n);
    const bug = w.spawnBug('crawler', n, 1);
    Object.assign(bug, { x: mx + 1, y: my, hp: 1000, maxHp: 1000 });
    const far = w.spawnBug('crawler', n, 1);
    Object.assign(far, { x: mx + STRIKE.radius + 3, y: my, hp: 1000, maxHp: 1000 });
    expect(w.strike(b.id, Math.floor(mx), Math.floor(my))).toBe('not-ready');
    run(w, 2);
    expect(b.ammo).toBeCloseTo(2, 1);
    b.ammo = STRIKE.charge;
    w.state.explored.fill(0);
    expect(w.strike(b.id, Math.floor(mx), Math.floor(my))).toBe('unexplored');
    w.state.explored.fill(1);
    expect(w.strike(b.id, Math.floor(mx), Math.floor(my))).toBeNull();
    expect(bug.hp).toBeLessThan(0);
    expect(far.hp).toBe(1000);
    expect(n.destroyed).toBe(true);
    expect(b.ammo).toBe(0);
    expect(w.blasts).toHaveLength(1);
    expect(w.strike(b.id, Math.floor(mx), Math.floor(my))).toBe('not-ready'); // a day to charge again
  });
});

describe('Nest kinds, growth and merging (D-132)', () => {
  /** A calm nest of `kind` at stage `stage`, with its brood all hatched. */
  const nestOf = (w: World, x: number, y: number, kind: Nest['kind'], stage = 1, queen = false): Nest => {
    const n = newNest(w.state.nests.length, x, y, 80, 1, kind, queen);
    n.stage = stage;
    w.state.nests.push(n);
    w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
    for (const t of ['crawler', 'runner', 'brute', 'wasp', 'beetle'] as const) for (let i = 0; i < n.brood[t]; i++) w.spawnBug(t, n, 1);
    return n;
  };

  it.each([42, 1, 7])('a new map has a kind of nest for each bug, by distance, and 1 to 3 queen nests near the edge, seed %i', (seed) => {
    const w = World.create(seed);
    const s = w.state;
    const queens = s.nests.filter((n) => n.queen);
    expect(queens.length).toBeGreaterThanOrEqual(QUEENS.count[0]);
    expect(queens.length).toBeLessThanOrEqual(QUEENS.count[1]);
    for (const q of queens) expect(Math.min(q.x, q.y, s.width - q.x - NESTS.cell, s.height - q.y - NESTS.cell)).toBeLessThan(QUEENS.edge);
    for (const n of s.nests) {
      const d = hubDistance(w, n);
      if (d < NESTS.runnelFrom - NESTS.kindBlend) expect(n.kind).toBe('warren');
      if (d > NESTS.barrowFrom + NESTS.kindBlend) expect(n.kind).toBe('barrow');
      // Each kind is mostly its own bug.
      if (n.kind === 'warren') expect(n.brood.runner + n.brood.brute + n.brood.wasp + n.brood.beetle).toBe(0);
      if (n.kind === 'runnel') expect(n.brood.runner).toBeGreaterThan(n.brood.crawler);
      if (n.kind === 'hive') expect(n.brood.wasp).toBeGreaterThan(n.brood.runner);
      if (n.kind === 'den') expect(n.brood.brute).toBeGreaterThan(0);
      if (n.kind === 'barrow') expect(n.brood.beetle).toBeGreaterThan(0);
      expect(n.stage).toBe(1);
      expect(n.age).toBeLessThan(NESTS.stageEvery);
    }
    expect(new Set(s.nests.map((n) => n.kind)).size).toBeGreaterThanOrEqual(4);
    // Every nest's bugs are there, all of its brood.
    for (const n of s.nests) expect(s.enemies.filter((e) => e.nest === n.id).length).toBe(broodSize(n.brood));
  });

  it('kinds mix where zones meet', () => {
    expect(nestKindFor(NESTS.runnelFrom, 0.25)).toBe('runnel');
    expect(nestKindFor(NESTS.runnelFrom, 0.75)).toBe('warren');
    expect(nestKindFor(NESTS.hiveFrom, 0.25)).toBe('hive');
    expect(nestKindFor(NESTS.hiveFrom, 0.75)).toBe('runnel');
    expect(nestKindFor(NESTS.denFrom, 0.25)).toBe('den');
    expect(nestKindFor(NESTS.denFrom, 0.75)).toBe('hive');
    expect(nestKindFor(NESTS.barrowFrom, 0.25)).toBe('barrow');
    expect(nestKindFor(NESTS.barrowFrom, 0.75)).toBe('den');
    expect(nestKindFor(NESTS.runnelFrom - NESTS.kindBlend - 1, 0)).toBe('warren');
    expect(nestKindFor(NESTS.barrowFrom + NESTS.kindBlend + 1, 0.99)).toBe('barrow');
  });

  it('a queen nest has a tougher mound and a bigger brood, breeds twice as fast and drops three times the chitin', () => {
    const w = emptyWorld();
    const q = nestOf(w, 50, 50, 'den', 1, true);
    const plain = nestOf(w, 80, 80, 'den');
    expect(q.maxHp).toBe(plain.maxHp * QUEENS.mound);
    expect(q.brood.crawler).toBe(Math.round(plain.brood.crawler * QUEENS.brood));
    w.state.enemies = w.state.enemies.filter((e) => e.nest !== q.id || e.type !== 'crawler'); // short of crawlers
    run(w, 1.05);
    expect(q.nextBreed - w.state.time).toBeLessThanOrEqual(NESTS.breedEvery[1] / QUEENS.breed);
    w.state.inventory.chitin = 0;
    damageMound(w, q, q.hp);
    expect(w.state.inventory.chitin).toBe(Math.round(Math.min(10, 3 + Math.floor(hubDistance(w, q) / 25)) * QUEENS.chitin));
  });

  it('when a queen nest falls its queen comes out: a slow, tough, hard-biting version of its bug, dropping chitin when killed', () => {
    const w = emptyWorld();
    const q = nestOf(w, 50, 50, 'barrow', 1, true);
    expect(w.state.enemies.some((e) => e.queen)).toBe(false); // she stays in the chamber while the mound stands
    damageMound(w, q, q.hp);
    const queen = w.state.enemies.find((e) => e.queen)!;
    expect(queen.type).toBe('beetle');
    expect(queen.nest).toBe(q.id);
    const [cx, cy] = nestCentre(q);
    expect([queen.x, queen.y]).toEqual([cx, cy]);
    expect(queen.maxHp).toBeGreaterThanOrEqual(ENEMIES.beetle.hp * QUEENS.bug.hp);
    const def = bugDef(queen);
    expect(def.dps).toBe(ENEMIES.beetle.dps * QUEENS.bug.dps);
    expect(def.speed).toBe(ENEMIES.beetle.speed * QUEENS.bug.speed);
    expect(def.radius).toBe(ENEMIES.beetle.radius * QUEENS.bug.size);
    expect(bugDef(w.state.enemies.find((e) => !e.queen)!)).toBe(ENEMIES[w.state.enemies.find((e) => !e.queen)!.type]);
    // An ordinary nest has no queen.
    const plain = nestOf(w, 80, 80, 'barrow');
    damageMound(w, plain, plain.hp);
    expect(w.state.enemies.filter((e) => e.queen)).toHaveLength(1);
    w.state.inventory.chitin = 0;
    queen.hp = 0;
    w.tick();
    expect(w.state.enemies.includes(queen)).toBe(false);
    expect(w.state.inventory.chitin).toBe(Math.min(10, 3 + Math.floor(hubDistance(w, q) / 25)) * QUEENS.bugChitin);
  });

  it("a crawler bred under threat hatches as its nest's own bug, and a warren's as a runner", () => {
    for (const [kind, bug] of [
      ['warren', 'runner'],
      ['runnel', 'runner'],
      ['hive', 'wasp'],
      ['den', 'brute'],
      ['barrow', 'beetle'],
    ] as const) {
      const w = emptyWorld();
      w.state.time = NESTS.threatEvery * NESTS.threatMax; // the most swaps
      const n = nestOf(w, 50, 50, kind);
      w.state.enemies = [];
      n.brood = { crawler: 40, runner: 0, brute: 0, wasp: 0, beetle: 0 };
      for (let i = 0; i < 40; i++) {
        n.nextBreed = 1; // due now
        run(w, 1);
      }
      const types = new Set(w.state.enemies.filter((e) => e.nest === n.id).map((e) => e.type)); // not a spread nest's
      expect(types.has(bug)).toBe(true);
      expect([...types].every((t) => t === 'crawler' || t === bug)).toBe(true);
    }
  });

  it('a calm nest grows a stage after 3 days of calm: a bigger brood and mound; not while angry, and only to stage 3', () => {
    const w = emptyWorld();
    const n = nestOf(w, 50, 50, 'warren');
    const brood = n.brood.crawler;
    const hp = n.maxHp;
    n.age = NESTS.stageEvery - 1;
    n.angryUntil = w.state.time + 5;
    run(w, 2);
    expect(n.stage).toBe(1); // angry: no growing
    w.state.enemies = []; // nothing to keep it angry
    n.angryUntil = 0;
    run(w, 2);
    expect(n.stage).toBe(2);
    expect(n.brood.crawler).toBe(Math.round(brood * stageSize(2)));
    expect(n.maxHp).toBe(Math.round(hp * stageSize(2)));
    n.age = NESTS.stageEvery - 1;
    run(w, 2);
    expect(n.stage).toBe(3);
    n.age = NESTS.stageEvery - 1;
    run(w, 2);
    expect(n.stage).toBe(NESTS.stageMax);
    // It breeds up to its bigger brood.
    expect(w.state.nests[n.id].brood.crawler).toBeGreaterThan(brood);
  });

  it('two grown, calm nests of a kind whose territories touch merge into one, owning both cells', () => {
    const w = emptyWorld();
    w.state.nextSpread = Infinity;
    const a = nestOf(w, 50, 50, 'warren', 2);
    const b = nestOf(w, 60, 50, 'warren', 3);
    const other = nestOf(w, 50, 60, 'hive', 2); // another kind
    const young = nestOf(w, 40, 50, 'warren', 1); // too young
    const bugs = w.state.enemies.length;
    const brood = a.brood.crawler + b.brood.crawler;
    const hp = a.maxHp + b.maxHp;
    w.state.time = w.state.nextMerge - 0.01;
    w.tick();
    const [into, from] = b.brood.crawler > a.brood.crawler ? [b, a] : [a, b];
    expect(from.destroyed).toBe(true);
    expect(from.into).toBe(into.id);
    expect(into.brood.crawler).toBe(brood);
    expect(into.maxHp).toBe(hp);
    expect(into.stage).toBe(3);
    expect(territory(into)).toHaveLength(2);
    expect(nestAt(w, 51, 51)).toBe(into);
    expect(nestAt(w, 61, 51)).toBe(into);
    expect(w.state.enemies.length).toBe(bugs);
    expect(w.state.enemies.some((e) => e.nest === from.id)).toBe(false);
    expect(other.destroyed).toBeFalsy();
    expect(young.destroyed).toBeFalsy();
    expect(w.events).toContain('Two nests have merged into one bigger nest.');
    // Its calm bugs stroll over both cells, and the territory survives saving and loading.
    run(w, 60);
    for (const e of w.state.enemies.filter((e) => e.nest === into.id)) expect(nestAt(w, e.x, e.y)).toBe(into);
    const loaded = World.fromJSON(w.toJSON());
    expect(nestAt(loaded, 61, 51)?.id).toBe(into.id);
    expect(nestAt(loaded, 51, 51)?.id).toBe(into.id);
    // Building in the other cell provokes the merged nest.
    placed(w.place('wall', 65, 58, 0));
    expect(isAngry(w, into)).toBe(true);
    // Destroying it drops chitin for both cells.
    w.state.inventory.chitin = 0;
    damageMound(w, into, into.hp);
    expect(w.state.inventory.chitin).toBe(Math.round(Math.min(10, 3 + Math.floor(hubDistance(w, into) / 25)) * stageSize(3) * 2));
  });

  it('v39 saves: nests get the kind their bugs suggest, stage 1, and merging starts a while after loading', () => {
    const w = emptyWorld();
    const old = JSON.parse(w.toJSON());
    old.version = 39;
    old.time = 500;
    const brood = (crawler: number, runner: number, brute: number) => ({ crawler, runner, brute });
    old.nests = [brood(3, 0, 0), brood(2, 1, 0), brood(2, 1, 1)].map((b, i) => {
      const n = newNest(i, 50 + i * 10, 50, 80) as Partial<Nest>;
      delete n.kind;
      delete n.stage;
      delete n.age;
      return { ...n, brood: b };
    });
    delete old.nextMerge;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.nests.map((n) => n.kind)).toEqual(['warren', 'hive', 'den']);
    expect(loaded.state.nests.every((n) => n.stage === 1 && n.age === 0)).toBe(true);
    expect(loaded.state.nextMerge).toBe(500 + NESTS.mergeEvery);
    expect(loaded.state.version).toBe(SAVE_VERSION);
  });
});

describe('Hardcore nests (D-133)', () => {
  const nest = (w: World): Nest => {
    const n = newNest(0, 50, 50, 80, 1, 'warren');
    w.state.nests.push(n);
    w.nestCells.set(cellKey(5, 5), n);
    return n;
  };

  it('Hardcore starts at a higher threat level', () => {
    expect(threatAt(0, 'hardcore')).toBe(HARDCORE_NESTS.threat);
    expect(threatAt(0)).toBe(0);
    expect(threatAt(NESTS.threatEvery * 100, 'hardcore')).toBe(NESTS.threatMax);
  });

  it("a mound can't be shot down; covering it and the ring around it with buildings destroys it", () => {
    const w = emptyWorld('hardcore');
    const n = nest(w);
    const hp = n.hp;
    damageMound(w, n, hp * 2);
    expect(n.destroyed).toBeFalsy();
    expect(n.hp).toBe(hp);
    expect(isAngry(w, n)).toBe(true); // it still wakes
    // A turret in range with no bugs about leaves it alone.
    const [mx, my] = moundTile(n);
    const t = placed(w.place('turret', mx - 3, my, 0));
    t.ammo = 20;
    run(w, 2);
    expect(t.ammo).toBe(20);
    w.remove(t);
    // Walls on the mound and its ring: the last one destroys it.
    const tiles = coverTiles(n);
    expect(tiles).toHaveLength(16);
    w.state.inventory.chitin = 0;
    for (const [x, y] of tiles.slice(0, -1)) placed(w.place('wall', x, y, 0));
    expect(n.destroyed).toBeFalsy();
    const [lx, ly] = tiles[tiles.length - 1];
    placed(w.place('belt', lx, ly, 0)); // belts count
    expect(n.destroyed).toBe(true);
    expect(w.state.inventory.chitin).toBeGreaterThan(0);
  });

  it('moving a building onto the last open tile destroys it too; in Standard the mound stays unbuildable', () => {
    const w = emptyWorld('hardcore');
    const n = nest(w);
    const tiles = coverTiles(n);
    for (const [x, y] of tiles.slice(0, -1)) placed(w.place('wall', x, y, 0));
    const wall = placed(w.place('wall', 40, 40, 0));
    const [lx, ly] = tiles[tiles.length - 1];
    expect(w.relocate(wall.id, lx, ly, 0)).toBe(wall);
    expect(n.destroyed).toBe(true);
    const s = emptyWorld();
    const m = nest(s);
    const [mx, my] = moundTile(m);
    expect(s.place('wall', mx, my, 0)).toBe('nest');
  });

  it('nests breed faster in Hardcore, and faster again while being built over', () => {
    const gap = (mode: 'standard' | 'hardcore', cover: boolean): number => {
      const w = emptyWorld(mode);
      const n = nest(w);
      if (cover) placed(w.place('wall', ...coverTiles(n)[0], 0));
      n.angryUntil = 0;
      w.state.time = 10;
      run(w, 1.05);
      return n.nextBreed - w.state.time;
    };
    expect(gap('standard', false)).toBeGreaterThanOrEqual(NESTS.breedEvery[0] - 1.1);
    expect(gap('hardcore', false)).toBeLessThanOrEqual(NESTS.breedEvery[1] / HARDCORE_NESTS.faster);
    expect(gap('hardcore', true)).toBeLessThanOrEqual(NESTS.breedEvery[1] / HARDCORE_NESTS.faster / HARDCORE_NESTS.builtOver);
  });
});

describe('Forests and bugs (D-134)', () => {
  it('cutting a tree inside a live territory provokes its nest; outside, it does not', () => {
    const w = emptyWorld();
    const n = addNest(w, 50, 50, 3);
    const p = w.state.players[0];
    for (const [x, y] of [
      [40, 52],
      [52, 52],
    ] as const) {
      w.state.trees[w.idx(x, y)] = TREE;
      [p.x, p.y] = [x - 0.5, y + 0.5];
      for (let k = 0; k < HAND_MINING.taps; k++) w.mineByHand(x, y);
      expect(w.treeAt(x, y)).toBe(STUMP);
      expect(isAngry(w, n)).toBe(x === 52);
    }
  });

  it("trees slow bugs, and cost more on a bug's path, so paths go round forest", () => {
    const w = emptyWorld();
    placed(w.place('wall', 50, 50, 0));
    w.computeFlow();
    const open = w.flow[w.idx(50, 60)];
    for (let y = 52; y < 59; y++) for (let x = 47; x < 54; x++) w.state.trees[w.idx(x, y)] = TREE;
    w.computeFlow();
    expect(w.flow[w.idx(50, 60)]).toBeGreaterThan(open); // it goes round, or pushes through slowly
    // A chasing bug among trees moves at FOREST.bugSlow of its speed.
    const n = addNest(w, 80, 80, 0);
    const bug = w.spawnBug('crawler', n, 1);
    [bug.x, bug.y] = [50.5, 55.5];
    n.angryUntil = 1e9;
    const y0 = bug.y;
    w.tick();
    expect(y0 - bug.y).toBeCloseTo(ENEMIES.crawler.speed * FOREST.bugSlow * TICK, 5);
  });

  it.each([42, 1, 7])('a new map has nests deep in forest, and every mound and its ring clear of trees, seed %i', (seed) => {
    const w = World.create(seed);
    const s = w.state;
    const wooded = s.nests.filter((n) => {
      let trees = 0;
      for (let y = n.y; y < n.y + NESTS.cell; y++) for (let x = n.x; x < n.x + NESTS.cell; x++) if (s.trees[w.idx(x, y)] === TREE) trees++;
      return trees >= 40;
    });
    expect(wooded.length).toBeGreaterThan(0);
    for (const n of s.nests) {
      const [mx, my] = moundTile(n);
      for (let y = my - 1; y <= my + 2; y++) for (let x = mx - 1; x <= mx + 2; x++) expect(s.trees[w.idx(x, y)]).not.toBe(TREE);
    }
  });

  it('a Tree Nursery plants a tree on open ground nearby every so often, never on buildings or ore', () => {
    const w = emptyWorld();
    w.state.ship.blueprints.push('tree_nursery');
    Object.assign(w.state.inventory, { steel: 99 });
    const b = placed(w.place('tree_nursery', 60, 60, 0));
    placed(w.place('wall', 63, 61, 0));
    w.state.resources[w.idx(58, 61)] = 1;
    w.state.trees[w.idx(59, 60)] = STUMP;
    w.state.cuts = { [w.idx(59, 60)]: 3 };
    run(w, NURSERY.period * 90 + 1); // long enough to fill every open tile in range
    const [cx, cy] = w.centreOf(b);
    let planted = 0;
    for (let y = 50; y < 72; y++) {
      for (let x = 50; x < 72; x++) {
        if (w.state.trees[w.idx(x, y)] !== TREE) continue;
        planted++;
        expect(Math.hypot(x + 0.5 - cx, y + 0.5 - cy)).toBeLessThanOrEqual(NURSERY.range);
        expect(w.buildingAt(x, y)).toBeUndefined();
        expect(w.state.resources[w.idx(x, y)]).toBe(0);
      }
    }
    expect(planted).toBeGreaterThan(20);
    expect(w.state.trees[w.idx(59, 60)]).toBe(TREE); // a stump grows anew
    expect(w.state.cuts?.[w.idx(59, 60)]).toBeUndefined(); // with its cuts reset
  });
});

describe('Wasps and beetles (D-135)', () => {
  it('a wasp flies over a wall to the building behind it, where a crawler has to chew through the wall', () => {
    const w = emptyWorld();
    const n = addNest(w, 80, 50, 0);
    n.angryUntil = 1e9;
    const target = placed(w.place('palisade', 60, 55, 0));
    for (let y = 50; y < 61; y++) placed(w.place('wall', 63, y, 0));
    const wasp = w.spawnBug('wasp', n, 1);
    const crawler = w.spawnBug('crawler', n, 1);
    [wasp.x, wasp.y, crawler.x, crawler.y] = [70.5, 55.5, 70.5, 55.5];
    w.markFlowDirty();
    // The palisade is a wall too: give the wasp a target past it.
    const crate = placed(w.place('crate', 60, 57, 0));
    run(w, 12);
    expect(Math.floor(wasp.x)).toBe(60);
    expect(crate.hp).toBeLessThan(w.maxHp(crate)); // landed and biting
    expect(target.hp).toBe(w.maxHp(target)); // walls are flown over
    expect(crawler.x).toBeGreaterThan(63); // still at the wall
  });

  it("lobbed shots can't hit a wasp, and spike pits don't touch it; turrets can", () => {
    const w = emptyWorld();
    const n = addNest(w, 80, 80, 0);
    Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, bearing: 99 });
    const mortar = placed(w.place('mortar', 50, 50, 0));
    mortar.ammo = 10;
    const wasp = w.spawnBug('wasp', n, 1);
    [wasp.x, wasp.y] = [56.5, 50.5];
    const spikes = placed(w.place('spike_pit', 56, 50, 0));
    spikes.ammo = 10;
    const hp = wasp.hp;
    w.tick();
    expect(wasp.hp).toBe(hp);
    expect(mortar.ammo).toBe(10);
    const t = placed(w.place('turret', 53, 50, 0));
    t.ammo = 10;
    run(w, 1);
    expect(wasp.hp).toBeLessThan(hp);
  });

  it('a beetle shrugs off small shots: each hit does its armour less, down to 1', () => {
    for (const [type, dealt] of [
      ['turret', 1],
      ['cannon', 30 - ENEMIES.beetle.armour!],
    ] as const) {
      const w = emptyWorld();
      const n = addNest(w, 80, 80, 0);
      const t = placed(w.place(type, 50, 50, 0));
      t.ammo = 10;
      const beetle = w.spawnBug('beetle', n, 1);
      [beetle.x, beetle.y] = [53.5, 50.5];
      const hp = beetle.hp;
      w.tick();
      expect(hp - beetle.hp).toBe(dealt);
    }
  });

  it('each kind of nest is mostly its own bug, with some crawlers (D-152)', () => {
    const at = (kind: Parameters<typeof nestComposition>[1], d: number) => nestComposition(d, kind);
    expect(at('warren', 50)).toMatchObject({ runners: 0, brutes: 0, wasps: 0, beetles: 0 });
    expect(at('runnel', 70).runners).toBeGreaterThan(at('runnel', 70).crawlers);
    expect(at('runnel', 70)).toMatchObject({ brutes: 0, wasps: 0, beetles: 0 });
    expect(at('hive', 90).wasps).toBeGreaterThan(at('hive', 90).runners);
    expect(at('hive', 90)).toMatchObject({ brutes: 0, beetles: 0 });
    expect(at('den', 110).brutes).toBeGreaterThan(0);
    expect(at('den', 200)).toMatchObject({ runners: 0, wasps: 0, beetles: 0 });
    expect(at('barrow', 130).beetles).toBe(2);
    expect(at('barrow', 200)).toMatchObject({ runners: 0, brutes: 0, wasps: 0 });
  });

  it('v43 saves: a queen nest becomes a queen nest of the kind that lives that far out, keeping its bugs', () => {
    const w = emptyWorld();
    const old = JSON.parse(w.toJSON());
    old.version = 43;
    const far = newNest(0, 0, 0, 170, 1, 'den');
    const near = newNest(1, 120, 120, 30, 1, 'warren');
    old.nests = [{ ...far, kind: 'queen', brood: { crawler: 4, runner: 3, brute: 2, wasp: 1, beetle: 1 } }, near];
    const loaded = World.fromJSON(JSON.stringify(old));
    const [q, n] = loaded.state.nests;
    expect(q.queen).toBe(true);
    expect(q.kind).toBe(nestKindFor(hubDistance(loaded, q), 0.5));
    expect(q.brood).toEqual({ crawler: 4, runner: 3, brute: 2, wasp: 1, beetle: 1 });
    expect(n.queen).toBeUndefined();
    expect(n.kind).toBe('warren');
    expect(loaded.state.version).toBe(SAVE_VERSION);
  });

  it('v40 saves: nests get no wasps or beetles of their own', () => {
    const w = emptyWorld();
    addNest(w, 50, 50, 3);
    const old = JSON.parse(w.toJSON());
    old.version = 40;
    old.nests[0].brood = { crawler: 3, runner: 1, brute: 0 };
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.nests[0].brood).toEqual({ crawler: 3, runner: 1, brute: 0, wasp: 0, beetle: 0 });
  });
});

describe('Better ammo (D-136)', () => {
  it('Better Ammo comes after Electric Defense and Heavy Defense 2, and the assembler makes both kinds', () => {
    expect(RESEARCH_BY_ID.better_ammo.requires.sort()).toEqual(['electric_defense', 'heavy_defense2']);
    expect(RECIPE_BY_ID.ap_bullet.requires).toBe('better_ammo');
    expect(RECIPE_BY_ID.he_shell.requires).toBe('better_ammo');
    expect(
      emptyWorld()
        .recipesFor('assembler')
        .map((r) => r.id),
    ).toEqual(expect.arrayContaining(['ap_bullet', 'he_shell']));
  });

  it('a turret takes better ammo as well as its usual ammo, sharing its room, and fires it first', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, motor: 9 });
    const n = addNest(w, 80, 80, 0);
    const t = placed(w.place('turret2', 50, 50, 0));
    t.ammo = 0;
    expect(w.insert(t, 'ap_bullet', 49, 50)).toBe(true);
    expect(w.insert(t, 'bullet', 49, 50)).toBe(true);
    expect(w.insert(t, 'he_shell', 49, 50)).toBe(false); // not its kind
    expect([t.ammo, t.better]).toEqual([5, 5]);
    t.ammo = TURRETS.turret2!.maxShots - 5;
    expect(w.insert(t, 'bullet', 49, 50)).toBe(false); // full
    const bug = w.spawnBug('brute', n, 1);
    [bug.x, bug.y] = [53.5, 50.5];
    w.tick();
    expect(t.better).toBe(4);
    expect(t.ammo).toBe(TURRETS.turret2!.maxShots - 5);
  });

  it("armour-piercing bullets go through a beetle's armour", () => {
    const dealt = (better: boolean): number => {
      const w = emptyWorld();
      Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, motor: 9 });
      const n = addNest(w, 80, 80, 0);
      const t = placed(w.place('turret2', 50, 50, 0));
      t.ammo = better ? 0 : 10;
      t.better = better ? 10 : 0;
      const beetle = w.spawnBug('beetle', n, 1);
      [beetle.x, beetle.y] = [53.5, 50.5];
      const hp = beetle.hp;
      w.tick();
      return hp - beetle.hp;
    };
    expect(dealt(false)).toBe(Math.max(1, TURRETS.turret2!.damage - ENEMIES.beetle.armour!));
    expect(dealt(true)).toBe(TURRETS.turret2!.damage * TURRETS.turret2!.better!.damage);
  });

  it('explosive shells hit harder over a wider blast', () => {
    const hits = (better: boolean): { hurt: number; dealt: number } => {
      const w = emptyWorld();
      Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, bearing: 99 });
      const n = addNest(w, 80, 80, 0);
      const m = placed(w.place('mortar', 50, 50, 0));
      m.ammo = better ? 0 : 5;
      m.better = better ? 5 : 0;
      const near = w.spawnBug('brute', n, 1);
      const far = w.spawnBug('brute', n, 1);
      [near.x, near.y] = [58.5, 50.5];
      [far.x, far.y] = [58.5, 50.5 + TURRETS.mortar!.splash + 0.3]; // outside the usual blast only
      const hp = near.hp;
      w.tick();
      return { hurt: [near, far].filter((e) => e.hp < hp).length, dealt: hp - near.hp };
    };
    expect(hits(false)).toEqual({ hurt: 1, dealt: TURRETS.mortar!.damage });
    expect(hits(true)).toEqual({ hurt: 2, dealt: TURRETS.mortar!.damage * TURRETS.mortar!.better!.damage });
  });

  it('a turret by the hub takes better ammo from stock first', () => {
    const w = emptyWorld();
    const hub = w.hub!;
    Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, motor: 9, bullet: 17, ap_bullet: 1 });
    const t = placed(w.place('turret2', hub.x + HUB_SIZE, hub.y + 2, 0)); // its first 12 bullets paid (#180)
    t.ammo = 0;
    w.tick();
    expect(w.state.inventory.ap_bullet).toBe(0);
    expect(t.better).toBe(TURRETS.turret2!.shotsPerItem);
    w.tick();
    expect(w.state.inventory.bullet).toBe(4);
  });
});

describe('Enemy targeting (D-137)', () => {
  const setup = (type: 'crawler' | 'brute', wall = false) => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, steel_beam: 99, motor: 9 });
    const n = addNest(w, 80, 80, 0);
    n.angryUntil = 1e9;
    const t = placed(w.place('turret2', 50, 50, 0));
    t.ammo = 60;
    const crate = placed(w.place('crate', 56, 51, 0)); // the nearest building to the bug
    if (wall) for (let y = 47; y < 56; y++) placed(w.place('wall', 53, y, 0));
    const bug = w.spawnBug(type, n, 1);
    [bug.x, bug.y] = [55.5, 53.5];
    bug.hp = bug.maxHp = 1e6;
    w.markFlowDirty();
    return { w, t, crate, bug };
  };

  it('a crawler bites the nearest building, even while a turret shoots it', () => {
    const { w, t, crate, bug } = setup('crawler');
    run(w, 8);
    expect(crate.hp).toBeLessThan(w.maxHp(crate));
    expect(t.hp).toBe(w.maxHp(t));
    expect(bug.foe).toBeUndefined();
  });

  it('a brute goes for the turret that shoots it instead', () => {
    expect(ENEMIES.brute.vengeful && ENEMIES.beetle.vengeful).toBe(true);
    const { w, t, crate, bug } = setup('brute');
    run(w, 12);
    expect(bug.foe?.id).toBe(t.id);
    expect(t.hp).toBeLessThan(w.maxHp(t));
    expect(crate.hp).toBe(w.maxHp(crate));
  });

  it("with a wall in the way, it doesn't stand still: it follows its path, and forgets a turret that's gone", () => {
    const { w, t, bug } = setup('brute', true);
    const [x, y] = [bug.x, bug.y];
    run(w, 3);
    expect(bug.foe?.id).toBe(t.id);
    expect(Math.abs(bug.x - x) + Math.abs(bug.y - y)).toBeGreaterThan(0.3);
    w.demolish(t.id);
    run(w, 1);
    expect(bug.foe).toBeUndefined();
  });
});

describe('Difficulty settings (D-138)', () => {
  it('Easy has fewer nests and weaker bugs than Normal, and Hard more and tougher; Hardcore is always Normal', () => {
    const nests = (d: 'easy' | 'normal' | 'hard') => World.create(42, 'standard', d).state.nests.length;
    expect(nests('easy')).toBeLessThan(nests('normal'));
    expect(nests('hard')).toBeGreaterThan(nests('normal'));
    expect(World.create(42, 'hardcore', 'easy').state.difficulty).toBe('normal');
    const hp = (d: 'easy' | 'normal' | 'hard') => {
      const w = emptyWorld();
      w.state.difficulty = d;
      return w.spawnBug('brute', addNest(w, 80, 80, 0), 1).maxHp;
    };
    expect(hp('normal')).toBe(ENEMIES.brute.hp);
    expect(hp('easy')).toBe(Math.round(ENEMIES.brute.hp * DIFFICULTY.easy.toughness));
    expect(hp('hard')).toBe(Math.round(ENEMIES.brute.hp * DIFFICULTY.hard.toughness));
  });

  it('v41 saves load as Normal', () => {
    const old = JSON.parse(emptyWorld().toJSON());
    old.version = 41;
    delete old.difficulty;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.difficulty).toBe('normal');
    expect(loaded.state.version).toBe(SAVE_VERSION);
  });
});

describe('Clearing a belt line (D-141)', () => {
  it('empties every item off a whole line, express belts included, into hub stock, and leaves the belts', () => {
    const w = emptyWorld();
    Object.assign(w.state.inventory, { steel: 99, iron_plate: 99, gear: 99 });
    const line = [0, 1, 2].map((i) => placed(w.place('belt', 40 + i, 40, 0)));
    line.push(placed(w.place('express_belt', 43, 40, 0)));
    const other = placed(w.place('belt', 40, 45, 0)); // not joined
    for (const b of [...line, other]) b.belt.push({ item: 'gear', pos: 0.5, lane: 1 });
    const gears = w.state.inventory.gear!;
    expect(applyCommand(w, { kind: 'clear-belts', id: line[1].id })).toBe(4);
    expect(w.state.inventory.gear).toBe(gears + 4);
    expect(line.every((b) => w.byId.get(b.id) === b && !b.belt.length)).toBe(true);
    expect(other.belt.length).toBe(1);
    expect(applyCommand(w, { kind: 'clear-belts', id: line[0].id })).toBe(0);
  });
});

describe('Defence tiers (D-142)', () => {
  it('a defence goes up to Tier 4, each tier costing its own materials times the tier and chitin, with more health; demolishing gives it all back', () => {
    const w = emptyWorld();
    w.state.inventory = { ...Object.fromEntries(Object.keys(BUILDINGS.wall.cost).map((k) => [k, 999])), chitin: 99 };
    const wall = placed(w.place('wall', 20, 20, 0));
    const stock = { ...w.state.inventory };
    wall.hp -= 10;
    for (const t of [2, 3, 4]) {
      expect(w.upgradeMachine(wall.id)).toBe(null);
      expect(wall.tier).toBe(t);
      expect(w.maxHp(wall)).toBe(Math.round(BUILDINGS.wall.hp * (1 + DEFENCE_TIERS.hp * (t - 1))));
    }
    expect(wall.hp).toBe(w.maxHp(wall) - 10); // each tier's health added, the damage kept
    expect(w.upgradeMachine(wall.id)).toBe('occupied'); // the top
    const paid = [2, 3, 4].reduce((n, t) => n + defenceTierCost('wall', t).chitin!, 0);
    expect(stock.chitin! - w.state.inventory.chitin!).toBe(paid);
    expect(defenceTierCost('wall', 3)).toEqual({ ...Object.fromEntries(Object.entries(BUILDINGS.wall.cost).map(([k, n]) => [k, n! * 3])), chitin: DEFENCE_TIERS.chitin[3] });
    expect(electricUse(wall)).toBe(0); // not a Mk2 machine
    wall.hp = w.maxHp(wall);
    w.demolish(wall.id);
    expect(w.state.inventory.chitin).toBe(stock.chitin! + (BUILDINGS.wall.cost.chitin ?? 0));
  });

  it('each tier needs its research: Heavy Defense for Tier 3, Electric Defense for Tier 4; poor stock refuses', () => {
    const w = emptyWorld();
    w.state.researched = w.state.researched.filter((r) => r !== 'heavy_defense' && r !== 'electric_defense');
    w.state.inventory = { ...Object.fromEntries(Object.keys(BUILDINGS.wall.cost).map((k) => [k, 999])), chitin: 4 };
    const wall = placed(w.place('wall', 20, 20, 0));
    expect(w.upgradeMachine(wall.id)).toBe('cost');
    w.state.inventory.chitin = 99;
    expect(w.upgradeMachine(wall.id)).toBe(null);
    expect(w.upgradeMachine(wall.id)).toBe('locked');
  });

  it('a turret at a higher tier hits harder and reaches further', () => {
    const shot = (tier: number, at: number) => {
      const w = emptyWorld();
      const n = addNest(w, 80, 80, 0);
      const t = placed(w.place('turret', 50, 50, 0));
      t.tier = tier;
      t.ammo = 10;
      const bug = w.spawnBug('brute', n, 1);
      [bug.x, bug.y] = [50.5 + at, 50.5];
      const hp = bug.hp;
      w.tick();
      return hp - bug.hp;
    };
    const base = TURRETS.turret!;
    expect(shot(1, 3)).toBe(base.damage);
    expect(shot(3, 3)).toBeCloseTo(base.damage * (1 + 2 * DEFENCE_TIERS.damage));
    expect(shot(1, base.range + 0.4)).toBe(0);
    expect(shot(4, base.range + 0.4)).toBeGreaterThan(0);
  });

  it('v42 saves: plated defences become Tier 3, keeping their health; without plating they stay Tier 1', () => {
    for (const plated of [true, false]) {
      const w = emptyWorld();
      const wall = placed(w.place('wall', 20, 20, 0));
      const furnace = placed(w.place('furnace', 30, 20, 0));
      const old = JSON.parse(w.toJSON());
      old.version = 42;
      old.researched = old.researched.filter((r: string) => plated || r !== 'plating');
      for (const b of old.buildings) if (b.id === wall.id) b.hp = Math.round(BUILDINGS.wall.hp * (plated ? 1.5 : 1));
      const loaded = World.fromJSON(JSON.stringify(old));
      const lw = loaded.byId.get(wall.id)!;
      expect(lw.tier ?? 1).toBe(plated ? 3 : 1);
      expect(loaded.maxHp(lw)).toBe(lw.hp);
      expect(loaded.byId.get(furnace.id)!.tier).toBeUndefined();
    }
  });
});

describe('What a building arrives holding is paid for (#180)', () => {
  it("a defence's tier upgrade costs its frame times the tier, without its starting load", () => {
    expect(defenceTierCost('trebuchet', 2)).toEqual({ plank: 80, rope: 20, truss: 16, chitin: DEFENCE_TIERS.chitin[2] });
    expect(defenceTierCost('turret', 3).iron_plate).toBe(30);
  });

  it("every stocked building's cost includes its starting load, and every turret that takes ammo is stocked", () => {
    for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
      for (const [item, n] of Object.entries(startLoad(type))) expect(BUILDINGS[type].cost[item as ItemId] ?? 0, `${type} ${item}`).toBeGreaterThanOrEqual(n!);
      if (TURRETS[type]?.ammoItem) expect(Object.keys(startLoad(type)), type).toEqual([TURRETS[type]!.ammoItem]);
    }
    expect(BUILDINGS.trebuchet.cost.stone).toBe(TURRETS.trebuchet!.maxShots);
  });

  it("a trebuchet's stone comes back only while it's unfired: an empty one rebuilt isn't a free refill", () => {
    const w = emptyWorld();
    w.state.inventory.stone = 100;
    const t = placed(w.place('trebuchet', 40, 40, 0));
    expect(t.ammo).toBe(TURRETS.trebuchet!.maxShots);
    expect(w.state.inventory.stone).toBe(100 - 12);
    t.ammo = 5; // seven stones fired
    w.demolish(t.id);
    expect(w.state.inventory.stone).toBe(100 - 12 + 5);
    expect(w.state.inventory.plank).toBe(999); // the frame comes back as before
    const again = placed(w.place('trebuchet', 40, 40, 0));
    again.ammo = 0;
    w.demolish(again.id);
    expect(w.state.inventory.stone).toBe(100 - 12 + 5 - 12);
  });

  it('spike pits, repair stations, furnaces and turrets give back what is left of their load, never more than they came with', () => {
    const w = emptyWorld();
    const before = { ...w.state.inventory };
    const pit = placed(w.place('spike_pit', 40, 40, 0));
    pit.ammo = SPIKES.perStake * 3 + 1;
    w.demolish(pit.id);
    expect(w.state.inventory.stake).toBe(before.stake! - 10 + 3);
    const repair = placed(w.place('repair', 40, 40, 0));
    repair.ammo = REPAIR.maxCharge; // topped up with planks: still only its five plates come back
    w.demolish(repair.id);
    expect(w.state.inventory.iron_plate).toBe(before.iron_plate!);
    const fu = placed(w.place('furnace', 40, 40, 0));
    fu.ammo = FUEL.burns.log! * 2;
    w.demolish(fu.id);
    expect(w.state.inventory.log).toBe(before.log! - 6 + 2);
    const tu = placed(w.place('turret', 40, 40, 0));
    tu.ammo = 9; // two plates' worth and a bit
    w.demolish(tu.id);
    expect(w.state.inventory.iron_plate).toBe(before.iron_plate! - 10 + 2);
  });
});

describe('Bugs keep apart (#181)', () => {
  /** Twenty crawlers dropped on one spot, going for a crate walled in on every side. */
  const crowd = () => {
    const w = emptyWorld();
    const n = addNest(w, 80, 80, 0);
    n.angryUntil = 1e9;
    const crate = placed(w.place('crate', 60, 50, 0));
    crate.hp = 1e9;
    for (const [x, y] of [
      [59, 49],
      [60, 49],
      [61, 49],
      [59, 50],
      [61, 50],
      [59, 51],
      [60, 51],
      [61, 51],
    ])
      placed(w.place('wall', x, y, 0)).hp = 1e9;
    for (let i = 0; i < 20; i++) {
      const e = w.spawnBug('crawler', n, 1);
      e.x = 66.5;
      e.y = 50.5;
    }
    run(w, 10);
    return w;
  };

  it('a crowd chasing the same way spreads out: their sprites cover no spot more than three deep', () => {
    const w = crowd();
    const bugs = w.state.enemies;
    expect(bugs.length).toBe(20);
    const r = ENEMIES.crawler.radius;
    for (const a of bugs) for (const b of bugs) if (a !== b) expect(hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * r * BUG_SPACING * 0.75);
    const drawn = r * 2.1; // sprites are drawn about 2.1 radii across each way
    let deepest = 0;
    for (let y = 46; y < 56; y += 0.05) for (let x = 56; x < 70; x += 0.05) deepest = Math.max(deepest, bugs.filter((e) => (e.x - x) ** 2 + (e.y - y) ** 2 < drawn * drawn).length);
    expect(deepest).toBeLessThanOrEqual(3);
    expect(deepest).toBeGreaterThan(1); // they do still overlap a little
  });

  it('pushing never moves a bug into a wall, and two bugs on exactly the same spot part the same way every time', () => {
    const w = crowd();
    for (const e of w.state.enemies) expect(w.buildingAt(Math.floor(e.x), Math.floor(e.y))?.type).not.toBe('wall');
    expect(JSON.stringify(crowd().state.enemies)).toBe(JSON.stringify(w.state.enemies));
  });

  it("a crowd isn't pushed through two walls that meet only at a corner", () => {
    const w = emptyWorld();
    placed(w.place('wall', 45, 44, 0));
    placed(w.place('wall', 44, 45, 0));
    const n = addNest(w, 40, 40, 0); // around the walls: its bugs go for them
    for (let i = 0; i < 12; i++) {
      const e = w.spawnBug('crawler', n, 1);
      [e.x, e.y, e.tx, e.ty, e.wait] = [44.95, 44.95, 44.95, 44.95, 100];
    }
    run(w, 1);
    for (const e of w.state.enemies) expect(Math.floor(e.x) > 44 && Math.floor(e.y) > 44, `${e.x}, ${e.y}`).toBe(false);
  });

  it('a wasp flies over walking bugs without pushing them', () => {
    const w = emptyWorld();
    const n = addNest(w, 80, 80, 0);
    const a = w.spawnBug('crawler', n, 1);
    const b = w.spawnBug('wasp', n, 1);
    for (const e of [a, b]) [e.x, e.y, e.tx, e.ty, e.wait] = [84.5, 84.5, 84.5, 84.5, 100];
    run(w, 0.5);
    expect([a.x, a.y, b.x, b.y]).toEqual([84.5, 84.5, 84.5, 84.5]);
  });
});
