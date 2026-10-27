import { describe, expect, it } from 'vitest';
import { BLUEPRINTS, BLUEPRINT_BY_ID, BUILDINGS, ItemId, NESTS, RESEARCH, RESEARCH_BY_ID, SHIP, SHIP_SITE, cargoFor } from './data';
import { Nest, cellKey, isAngry, newNest } from './nests';
import { cargoLoaded, insertShip, launch, nestsToWake, pickBlueprint, shipAway, shipyard, stageNeeds, wakeRadius } from './ship';
import { Building, SAVE_VERSION, TICK, World } from './world';

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

/** A quiet world (no bugs) with everything researched and plenty of stock. */
function quiet(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(21, mode);
  w.freePower = true; // power has tests of its own (D-115)
  w.clearWater();
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.resources.fill(0);
  s.trees.fill(0);
  s.nests = [];
  s.enemies = [];
  w.nestCells.clear();
  s.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, gear: 999, wire: 999, motor: 999, plank: 999, log: 999, truss: 999, rope: 999, rivet: 999, iron_rod: 999, steel: 999, steel_beam: 999, bearing: 999 };
  return w;
}

/** The shipyard, on a site staked out 20 tiles west of the hub. */
function yard(w: World): Building {
  const hub = w.hub!;
  w.state.shipSite = { x: hub.x - 20, y: hub.y };
  return placed(w.place('shipyard', hub.x - 20, hub.y, 0));
}

/** Feeds every stage's items straight into the shipyard. */
function finishShip(w: World): void {
  for (const stage of SHIP.stages) {
    for (const [item, n] of Object.entries(stage.items)) for (let i = 0; i < n!; i++) insertShip(w, item as ItemId);
  }
}

/** Feeds the next run's cargo straight into the shipyard. */
function loadCargo(w: World): void {
  for (const [item, n] of Object.entries(cargoFor(w.state.ship.runs))) for (let i = 0; i < n!; i++) insertShip(w, item as ItemId);
}

/** Builds the ship if needed, then loads, launches and delivers one run, and waits for the ship's return. */
function deliverRun(w: World): void {
  if (w.state.ship.stage < SHIP.stages.length) finishShip(w);
  loadCargo(w);
  expect(launch(w)).toBeNull();
  run(w, SHIP.launchTime + 1);
  run(w, SHIP.returnTime);
}

function addNest(w: World, x: number, y: number): Nest {
  const n: Nest = newNest(w.state.nests.length, x, y, 0);
  w.state.nests.push(n);
  w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
  w.spawnBug('crawler', n, 1);
  return n;
}

describe('Supply ship', () => {
  it('the shipyard is researched, takes 5×5 tiles on its site only, and only one can be built (D-109)', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'shipyard');
    expect(w.isUnlocked('shipyard')).toBe(false);
    w.state.researched.push('shipyard');
    const site = w.state.shipSite!;
    expect(w.place('shipyard', site.x + 7, site.y, 0)).toBe('site');
    const b = placed(w.place('shipyard', site.x, site.y, 0));
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) expect(w.buildingAt(b.x + dx, b.y + dy)).toBe(b);
    expect(w.place('shipyard', b.x + 10, b.y, 0)).toBe('unique');
  });

  it('a new game stakes out a clear 5×5 site for the shipyard within 15 tiles of the hub (D-109)', () => {
    for (const seed of [1, 2, 3]) {
      const w = World.create(seed);
      const site = w.state.shipSite!;
      expect(site).toBeDefined();
      const hub = w.hub!;
      const d = Math.hypot(site.x + 2.5 - (hub.x + 4), site.y + 2.5 - (hub.y + 4));
      expect(d).toBeGreaterThanOrEqual(SHIP_SITE.minDist);
      expect(d).toBeLessThanOrEqual(SHIP_SITE.maxDist);
      for (let y = site.y; y < site.y + 5; y++) for (let x = site.x; x < site.x + 5; x++) expect([w.buildingAt(x, y), w.resourceAt(x, y), w.treeAt(x, y)]).toEqual([undefined, null, 0]);
    }
  });

  it('v25 saves: the 3×3 shipyard is refunded, a site is staked out, and a ship under way counts its scaffolding as built', () => {
    const w = quiet();
    const hub = w.hub!;
    const old = JSON.parse(w.toJSON());
    old.version = 25;
    delete old.shipSite;
    old.buildings.push({ ...old.buildings.find((b: Building) => b.id === hub.id), id: 999, type: 'shipyard', x: hub.x - 20, y: hub.y });
    old.inventory = {};
    old.ship.stage = 1; // the hull was done; the engine next
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(shipyard(loaded)).toBeUndefined();
    expect(loaded.state.inventory).toEqual({ brick: 30, iron_plate: 30, plank: 20 });
    expect(loaded.state.ship.stage).toBe(3); // scaffolding, launch pad and hull done; the engine next
    expect(loaded.state.shipSite).toBeDefined();
    expect(loaded.checkPlace('shipyard', loaded.state.shipSite!.x, loaded.state.shipSite!.y, 0)).toBe('cost');
  });

  it('stages take only the parts they still need, in order', () => {
    const w = quiet();
    const b = yard(w);
    const from = [b.x - 1, b.y] as const;
    expect(w.insert(b, 'iron_plate', ...from)).toBe(false); // the scaffolding comes first (D-109)
    for (const [item, n] of Object.entries(SHIP.stages[0].items)) for (let i = 0; i < n!; i++) w.insert(b, item as ItemId, ...from);
    expect(w.state.ship.stage).toBe(1);
    expect(w.events.some((e) => e.includes('Scaffolding done'))).toBe(true);
    expect(w.insert(b, 'motor', ...from)).toBe(false); // the launch pad comes next
    for (const [item, n] of Object.entries(SHIP.stages[1].items)) for (let i = 0; i < n!; i++) w.insert(b, item as ItemId, ...from);
    expect(w.state.ship.stage).toBe(2);
    expect(w.events.some((e) => e.includes('Launch pad done'))).toBe(true);
    expect(w.insert(b, 'brick', ...from)).toBe(false); // the hull comes next, all steel (D-124)
    for (let i = 0; i < 120; i++) w.insert(b, 'steel', ...from);
    expect(w.insert(b, 'steel', ...from)).toBe(false); // enough steel
    for (const [item, n] of Object.entries(SHIP.stages[2].items)) for (let i = 0; i < n!; i++) w.insert(b, item as ItemId, ...from);
    expect(w.state.ship.stage).toBe(3);
    expect(w.events.some((e) => e.includes('Hull done'))).toBe(true);
    expect(w.insert(b, 'gear', ...from)).toBe(false); // the engine is built of coils and steel now (D-130)
    expect(w.insert(b, 'coil', ...from)).toBe(true); // now the engine
  });

  it('once built, the ship takes only the cargo the run still needs', () => {
    const w = quiet();
    const b = yard(w);
    finishShip(w);
    const from = [b.x - 1, b.y] as const;
    const cargo = cargoFor(0);
    expect(w.insert(b, 'motor', ...from)).toBe(cargo.motor !== undefined);
    expect(cargoLoaded(w)).toBe(false);
    loadCargo(w);
    expect(cargoLoaded(w)).toBe(true);
    expect(w.insert(b, 'iron_plate', ...from)).toBe(false);
    expect(w.events.some((e) => e.includes('cargo is loaded'))).toBe(true);
  });

  it('launching needs a finished, loaded ship and wakes the nests within reach', () => {
    const w = quiet();
    const b = yard(w);
    const near = addNest(w, Math.floor((b.x - 30) / 10) * 10, Math.floor(b.y / 10) * 10);
    // Three more, all out of reach: only the nearest two make up the floor of three.
    addNest(w, Math.floor((b.x + 70) / 10) * 10, Math.floor(b.y / 10) * 10);
    addNest(w, Math.floor((b.x + 90) / 10) * 10, Math.floor(b.y / 10) * 10);
    const far = addNest(w, 0, 0);
    expect(launch(w)).toBe('not-ready');
    finishShip(w);
    expect(launch(w)).toBe('not-ready'); // no cargo yet
    loadCargo(w);
    expect(launch(w)).toBeNull();
    expect(w.state.ship.launchAt).toBeCloseTo(w.state.time + SHIP.launchTime);
    expect(isAngry(w, near)).toBe(true);
    expect(w.state.ship.drawn.length).toBe(SHIP.minWake);
    expect(isAngry(w, far)).toBe(false);
    expect(near.angryUntil).toBeGreaterThan(w.state.ship.launchAt!);
    expect(launch(w)).toBe('launching');
  });

  it('woken bugs come for the shipyard from past their usual leash, and chew it', () => {
    const w = quiet();
    const b = yard(w);
    // A nest whose centre is 35 tiles west of the yard: far beyond the 20 tiles an angry bug looks for targets.
    const n = addNest(w, Math.floor((b.x - 40) / 10) * 10, Math.floor(b.y / 10) * 10);
    finishShip(w);
    loadCargo(w);
    expect(nestsToWake(w)).toEqual([n]);
    launch(w);
    expect(w.state.ship.drawn).toEqual([n.id]);
    run(w, 60);
    const bug = w.state.enemies.find((e) => e.nest === n.id)!;
    const [yx, yy] = w.centreOf(b);
    expect(Math.hypot(bug.x - yx, bug.y - yy)).toBeLessThan(BUILDINGS.shipyard.size![0] / 2 + 1.5); // at its edge
    expect(b.hp).toBeLessThan(BUILDINGS.shipyard.hp);
  });

  it('without a launch, the same nest finds nothing in reach and never reaches the shipyard', () => {
    const w = quiet();
    const b = yard(w);
    const n = addNest(w, Math.floor((b.x - 40) / 10) * 10, Math.floor(b.y / 10) * 10);
    n.angryUntil = 1e9;
    run(w, 60);
    expect(b.hp).toBe(BUILDINGS.shipyard.hp);
  });

  it('holding the shipyard until lift-off delivers the run; the game goes on and the ship comes back', () => {
    const w = quiet();
    const b = yard(w);
    finishShip(w);
    loadCargo(w);
    launch(w);
    run(w, SHIP.launchTime + 1);
    const ship = w.state.ship;
    expect(ship.runs).toBe(1);
    expect(ship.drawn).toEqual([]);
    expect(ship.delivered).toEqual({});
    expect(shipAway(w)).toBe(true);
    expect(shipyard(w)).toBe(b);
    const t = w.state.time;
    run(w, 1);
    expect(w.state.time).toBeGreaterThan(t); // no waiting on a victory screen
    expect(w.insert(b, 'iron_plate', b.x - 1, b.y)).toBe(false); // nothing to load while it's away
    expect(launch(w)).toBe('away');
    run(w, SHIP.returnTime);
    expect(shipAway(w)).toBe(false);
    expect(w.events.some((e) => e.includes('ship is back'))).toBe(true);
    expect(ship.stage).toBe(SHIP.stages.length); // built once
    loadCargo(w); // the second run's, bigger cargo
    expect(launch(w)).toBeNull();
  });

  it('each run asks for more, and runs past the listed ones keep growing', () => {
    const total = (run: number) => Object.values(cargoFor(run)).reduce((a, n) => a + n!, 0);
    for (let r = 1; r < SHIP.cargo.length + 3; r++) expect(total(r)).toBeGreaterThan(total(r - 1));
    expect(Object.keys(cargoFor(SHIP.cargo.length + 2))).toEqual(Object.keys(SHIP.cargo[SHIP.cargo.length - 1]));
  });

  it('losing the shipyard stops a launch; Standard keeps the stages built, Hardcore loses the ship', () => {
    for (const mode of ['standard', 'hardcore'] as const) {
      const w = quiet(mode);
      const b = yard(w);
      finishShip(w);
      launch(w);
      b.hp = 0;
      w.tick();
      expect(shipyard(w)).toBeUndefined();
      expect(w.state.ship.launchAt).toBeNull();
      expect(w.state.ship.stage).toBe(mode === 'standard' ? SHIP.stages.length : 0);
    }
  });

  it('a ship away at the colony survives losing the shipyard, even in Hardcore', () => {
    const w = quiet('hardcore');
    const b = yard(w);
    finishShip(w);
    loadCargo(w);
    launch(w);
    run(w, SHIP.launchTime + 1);
    b.hp = 0;
    w.tick();
    expect(w.state.ship.stage).toBe(SHIP.stages.length);
    expect(w.state.ship.runs).toBe(1);
  });

  it('v9 saves: an escaped game counts one run delivered, with the ship back and built', () => {
    for (const escaped of [true, false]) {
      const w = quiet();
      yard(w);
      const old = JSON.parse(w.toJSON());
      old.version = 9;
      // Before the scaffolding (D-109) and the launch pad (D-118), the ship had two stages fewer and began with the hull.
      old.ship = { stage: escaped ? SHIP.stages.length - 2 : 0, delivered: { iron_plate: 20 }, launchAt: null, escaped, endless: escaped };
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.version).toBe(SAVE_VERSION);
      expect(loaded.state.ship).toEqual(
        escaped
          ? { stage: SHIP.stages.length, delivered: {}, launchAt: null, runs: 1, returnAt: null, drawn: [], blueprints: [], offer: ['teleporter', 'strike_beacon'] } // the first two in the pool (D-131)
          : { stage: 2, delivered: {}, launchAt: null, runs: 0, returnAt: null, drawn: [], blueprints: [], offer: null },
      );
    }
  });

  it('demolishing the shipyard yourself keeps the ship in either mode', () => {
    const w = quiet('hardcore');
    const b = yard(w);
    for (let i = 0; i < 20; i++) insertShip(w, 'plank');
    w.demolish(b.id);
    expect(w.state.ship.delivered.plank).toBe(20);
  });

  it('after a delivery the colony offers two of its special buildings to pick from, then sends the last one (D-131, D-134)', () => {
    const w = quiet();
    yard(w);
    expect(BLUEPRINTS.map((b) => b.id).sort()).toEqual(['greenhouse', 'strike_beacon', 'teleporter', 'tree_nursery']);
    for (const t of ['teleporter', 'strike_beacon', 'greenhouse', 'tree_nursery'] as const) expect(w.isUnlocked(t)).toBe(false); // never researched
    const ship = w.state.ship;
    deliverRun(w); // four left: an offer of two
    expect(ship.offer).toHaveLength(2);
    expect(pickBlueprint(w, 'shipyard')).toBe(false);
    const first = ship.offer![0];
    expect(pickBlueprint(w, first)).toBe(true);
    expect(ship.offer).toBeNull();
    expect(w.isUnlocked(BLUEPRINT_BY_ID[first].unlocks[0])).toBe(true);
    deliverRun(w); // three left: an offer of two again
    expect(ship.offer).toHaveLength(2);
    pickBlueprint(w, ship.offer![0]);
    deliverRun(w); // two left: both on offer
    expect([...ship.offer!].sort()).toEqual(BLUEPRINTS.map((b) => b.id).filter((id) => !ship.blueprints.includes(id)).sort());
    pickBlueprint(w, ship.offer![1]);
    deliverRun(w); // only one left: it's simply sent
    expect(ship.offer).toBeNull();
    expect(ship.blueprints).toHaveLength(4);
    expect(w.events.some((e) => e.includes('blueprint'))).toBe(true);
    deliverRun(w); // none left
    expect(ship.offer).toBeNull();
  });

  it('v36 saves: the Tesla blueprint becomes Electric Defense, with stock to power its teslas (D-126)', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'electric_defense');
    const old = JSON.parse(w.toJSON());
    old.version = 36;
    old.ship.blueprints = ['tesla'];
    old.ship.offer = null;
    old.inventory = {};
    old.buildings.push({ ...old.buildings[0], id: 9001, type: 'tesla', x: 3, y: 3, dir: 0, ammo: 20 });
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.ship.blueprints).toEqual([]);
    expect(loaded.state.researched).toContain('electric_defense');
    expect(loaded.isUnlocked('tesla')).toBe(true);
    expect(loaded.state.buildings.find((b) => b.id === 9001)!.ammo).toBe(0);
    expect(loaded.state.inventory.steel).toBe(BUILDINGS.boiler.cost.steel! + BUILDINGS.steam_turbine.cost.steel!);
    // An offer holding it is dropped; a game with neither gets nothing.
    old.ship.blueprints = [];
    old.ship.offer = ['tesla'];
    old.buildings.pop();
    const plain = World.fromJSON(JSON.stringify(old));
    expect(plain.state.ship.offer).toBeNull();
    expect(plain.state.researched).not.toContain('electric_defense');
  });

  it('each run wakes nests further out, up to a limit, as the loaded ship gets heavier', () => {
    const w = quiet();
    const radii = [0, 1, 2, 3, 6, 7, 20].map((runs) => {
      w.state.ship.runs = runs;
      return wakeRadius(w);
    });
    expect(radii).toEqual([48, 56, 64, 72, 96, 96, 96]);
    // A nest 60 tiles out wakes from the second run on, not the first.
    const b = yard(w);
    const [yx, yy] = w.centreOf(b);
    const n = addNest(w, Math.floor((yx - 60 - 5) / 10) * 10, Math.floor((yy - 5) / 10) * 10);
    for (let i = 0; i < 3; i++) addNest(w, Math.floor((yx + 20 + i * 10) / 10) * 10, Math.floor((yy + 20) / 10) * 10); // the nearest three
    w.state.ship.runs = 0;
    expect(nestsToWake(w)).not.toContain(n);
    w.state.ship.runs = 2;
    expect(nestsToWake(w)).toContain(n);
  });

  it('v10 saves: a game with runs delivered gets a blueprint to pick', () => {
    for (const runs of [0, 2]) {
      const w = quiet();
      const old = JSON.parse(w.toJSON());
      old.version = 10;
      old.ship.runs = runs;
      delete old.ship.blueprints;
      delete old.ship.offer;
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.version).toBe(SAVE_VERSION);
      expect(loaded.state.ship.blueprints).toEqual([]);
      expect(loaded.state.ship.offer).toEqual(runs ? ['teleporter', 'strike_beacon'] : null); // the first two in today's pool (D-131)
    }
  });

  it('the launch pad (D-118) comes after the scaffolding and waits for its research', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'launch_pad');
    const b = yard(w);
    const from = [b.x - 1, b.y] as const;
    for (const [item, n] of Object.entries(SHIP.stages[0].items)) for (let i = 0; i < n!; i++) w.insert(b, item as ItemId, ...from);
    expect(SHIP.stages[1].id).toBe('pad');
    expect(stageNeeds(w)).toBe('launch_pad');
    expect(w.insert(b, 'brick', ...from)).toBe(false);
    expect(RESEARCH_BY_ID.launch_pad.requires.sort()).toEqual(['blacksmith', 'shipyard']);
    w.state.researched.push('launch_pad');
    expect(stageNeeds(w)).toBeNull();
    expect(w.insert(b, 'brick', ...from)).toBe(true);
  });

  it('v31 saves: a ship past the scaffolding counts the launch pad as built and keeps its stage going', () => {
    for (const [stage, after] of [[0, 0], [1, 2], [5, 6]]) {
      const w = quiet();
      w.state.researched = w.state.researched.filter((r) => r !== 'launch_pad');
      const old = JSON.parse(w.toJSON());
      old.version = 31;
      old.ship.stage = stage;
      old.ship.delivered = { iron_plate: 7 };
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.ship.stage).toBe(after);
      // At the hull, what was brought in for the old one comes back (D-124).
      expect(loaded.state.ship.delivered).toEqual(after === 2 ? {} : { iron_plate: 7 });
      expect(loaded.state.researched.includes('launch_pad')).toBe(stage > 0);
    }
    expect(SHIP.stages.length).toBe(6);
  });

  it('v33 saves: the Express Belt blueprint becomes Steam Power and Express Logistics, with stock to power its belts', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'steam_power' && r !== 'express_logistics');
    const old = JSON.parse(w.toJSON());
    old.version = 33;
    old.ship.blueprints = ['express_belt'];
    old.ship.offer = ['express_belt', 'tesla'];
    old.inventory = {};
    old.buildings.push({ ...old.buildings[0], id: 9001, type: 'express_belt', x: 3, y: 3, dir: 0 });
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.ship.blueprints).toEqual([]);
    expect(loaded.state.ship.offer).toBeNull(); // then the Tesla left too (D-126)
    expect(loaded.state.researched).toEqual(expect.arrayContaining(['steam_power', 'express_logistics']));
    expect(loaded.isUnlocked('express_belt')).toBe(true);
    expect(loaded.state.inventory.steel).toBe(BUILDINGS.boiler.cost.steel! + BUILDINGS.steam_turbine.cost.steel!);
  });

  it('v35 saves: the hull is steel now; a hull under way gives back its parts, and a ship past it gets the research', () => {
    for (const stage of [2, SHIP.stages.length]) {
      // A ship past the hull: here a finished one, since a stage after it under way is refunded by v39 (D-130).
      const w = quiet();
      w.state.researched = w.state.researched.filter((r) => r !== 'hull');
      const old = JSON.parse(w.toJSON());
      old.version = 35;
      old.ship.stage = stage;
      old.ship.delivered = { iron_plate: 40, brick: 10 };
      old.inventory = {};
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.ship.stage).toBe(stage);
      expect(loaded.state.researched.includes('hull')).toBe(stage > 2);
      expect(loaded.state.ship.delivered).toEqual(stage === 2 ? {} : { iron_plate: 40, brick: 10 });
      if (stage === 2) expect(loaded.state.inventory).toEqual({ iron_plate: 40, brick: 10 });
    }
    expect(SHIP.stages[2]).toMatchObject({ id: 'hull', research: 'hull' });
  });

  it('the engines, life support and navigation wait for Ship Systems (D-130)', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'ship_systems');
    const b = yard(w);
    const from = [b.x - 1, b.y] as const;
    for (const st of SHIP.stages.slice(0, 3)) for (const [item, n] of Object.entries(st.items)) for (let i = 0; i < n!; i++) w.insert(b, item as ItemId, ...from);
    expect(w.state.ship.stage).toBe(3);
    expect(SHIP.stages.slice(3).map((st) => st.research)).toEqual(['ship_systems', 'ship_systems', 'ship_systems']);
    expect(stageNeeds(w)).toBe('ship_systems');
    expect(w.insert(b, 'coil', ...from)).toBe(false);
    expect(RESEARCH_BY_ID.ship_systems.requires.sort()).toEqual(['electronics', 'hull']);
    w.state.researched.push('ship_systems');
    expect(w.insert(b, 'coil', ...from)).toBe(true);
  });

  it('v38 saves: a ship past the engines gets Ship Systems; one building an Electric Age stage gets its parts back', () => {
    for (const stage of [3, 4, SHIP.stages.length]) {
      const w = quiet();
      w.state.researched = w.state.researched.filter((r) => r !== 'ship_systems');
      const old = JSON.parse(w.toJSON());
      old.version = 38;
      old.ship.stage = stage;
      old.ship.delivered = { wire: 50, gear: 20 };
      old.inventory = {};
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.ship.stage).toBe(stage);
      expect(loaded.state.researched.includes('ship_systems')).toBe(stage > 3);
      const refunded = stage < SHIP.stages.length;
      expect(loaded.state.ship.delivered).toEqual(refunded ? {} : { wire: 50, gear: 20 });
      if (refunded) expect(loaded.state.inventory).toEqual({ wire: 50, gear: 20 });
    }
  });
});
