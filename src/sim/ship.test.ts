import { describe, expect, it } from 'vitest';
import { BUILDINGS, ItemId, NESTS, RESEARCH, RESEARCH_BY_ID, SHIP, SHIP_SITE, cargoFor } from './data';
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
  s.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, gear: 999, wire: 999, motor: 999, plank: 999, log: 999, truss: 999, rope: 999, rivet: 999, iron_rod: 999 };
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
    expect(w.insert(b, 'motor', ...from)).toBe(false); // the hull comes next
    for (let i = 0; i < 150; i++) w.insert(b, 'iron_plate', ...from);
    expect(w.insert(b, 'iron_plate', ...from)).toBe(false); // enough plates
    for (let i = 0; i < 80; i++) w.insert(b, 'brick', ...from);
    expect(w.state.ship.stage).toBe(3);
    expect(w.events.some((e) => e.includes('Hull done'))).toBe(true);
    expect(w.insert(b, 'motor', ...from)).toBe(true); // now the engine
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
          ? { stage: SHIP.stages.length, delivered: {}, launchAt: null, runs: 1, returnAt: null, drawn: [], blueprints: [], offer: ['tesla'] }
          : { stage: 2, delivered: { iron_plate: 20 }, launchAt: null, runs: 0, returnAt: null, drawn: [], blueprints: [], offer: null },
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

  it('after a delivery the colony offers blueprints to pick from, or sends the last one left', () => {
    const w = quiet();
    yard(w);
    expect(w.isUnlocked('tesla')).toBe(false);
    const ship = w.state.ship;
    ship.offer = ['tesla']; // as an offer of two would be, with more blueprints in the pool
    expect(pickBlueprint(w, 'shipyard')).toBe(false);
    expect(pickBlueprint(w, 'tesla')).toBe(true);
    expect(ship.offer).toBeNull();
    expect(w.isUnlocked('tesla')).toBe(true);
    ship.blueprints = [];
    deliverRun(w); // only one left: it's simply sent
    expect(ship.offer).toBeNull();
    expect(w.events.some((e) => e.includes('Tesla Turret blueprint'))).toBe(true);
    deliverRun(w); // none left
    expect(ship.offer).toBeNull();
    expect(ship.blueprints).toEqual(['tesla']);
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
      expect(loaded.state.ship.offer).toEqual(runs ? ['tesla'] : null); // the express belt left the pool (D-121)
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
      expect(loaded.state.ship.delivered).toEqual({ iron_plate: 7 });
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
    expect(loaded.state.ship.offer).toEqual(['tesla']);
    expect(loaded.state.researched).toEqual(expect.arrayContaining(['steam_power', 'express_logistics']));
    expect(loaded.isUnlocked('express_belt')).toBe(true);
    expect(loaded.state.inventory.steel).toBe(BUILDINGS.boiler.cost.steel! + BUILDINGS.steam_turbine.cost.steel!);
  });
});
