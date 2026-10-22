import { describe, expect, it } from 'vitest';
import { BUILDINGS, ItemId, NESTS, RESEARCH, SHIP, cargoFor } from './data';
import { Nest, cellKey, isAngry } from './nests';
import { cargoLoaded, insertShip, launch, nestsToWake, shipAway, shipyard } from './ship';
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
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.resources.fill(0);
  s.trees.fill(0);
  s.nests = [];
  s.enemies = [];
  w.nestCells.clear();
  s.inventory = { iron_plate: 999, brick: 999, gear: 999, wire: 999, motor: 999 };
  return w;
}

function yard(w: World): Building {
  const hub = w.hub!;
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

function addNest(w: World, x: number, y: number): Nest {
  const n: Nest = { id: w.state.nests.length, x, y, angryUntil: 0 };
  w.state.nests.push(n);
  w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
  w.spawnBug('crawler', n, 1);
  return n;
}

describe('Supply ship', () => {
  it('the shipyard is researched, takes 3×3 tiles, and only one can be built', () => {
    const w = quiet();
    w.state.researched = w.state.researched.filter((r) => r !== 'shipyard');
    expect(w.isUnlocked('shipyard')).toBe(false);
    w.state.researched.push('shipyard');
    const b = yard(w);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) expect(w.buildingAt(b.x + dx, b.y + dy)).toBe(b);
    expect(w.place('shipyard', b.x + 10, b.y, 0)).toBe('unique');
  });

  it('stages take only the parts they still need, in order', () => {
    const w = quiet();
    const b = yard(w);
    const from = [b.x - 1, b.y] as const;
    expect(w.insert(b, 'motor', ...from)).toBe(false); // the hull comes first
    for (let i = 0; i < 150; i++) w.insert(b, 'iron_plate', ...from);
    expect(w.insert(b, 'iron_plate', ...from)).toBe(false); // enough plates
    for (let i = 0; i < 80; i++) w.insert(b, 'brick', ...from);
    expect(w.state.ship.stage).toBe(1);
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
    // A nest whose centre is 35 tiles west of the yard: well beyond the 22-tile leash.
    const n = addNest(w, Math.floor((b.x - 40) / 10) * 10, Math.floor(b.y / 10) * 10);
    finishShip(w);
    loadCargo(w);
    expect(nestsToWake(w)).toEqual([n]);
    launch(w);
    expect(w.state.ship.drawn).toEqual([n.id]);
    run(w, 60);
    const bug = w.state.enemies.find((e) => e.nest === n.id)!;
    const [yx, yy] = w.centreOf(b);
    expect(Math.hypot(bug.x - yx, bug.y - yy)).toBeLessThan(3);
    expect(b.hp).toBeLessThan(BUILDINGS.shipyard.hp);
  });

  it('without a launch, the same nest stays on its leash and never reaches the shipyard', () => {
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
      for (let i = 0; i < 20; i++) insertShip(w, 'iron_plate');
      const old = JSON.parse(w.toJSON());
      old.version = 9;
      old.ship = { stage: escaped ? SHIP.stages.length : 0, delivered: old.ship.delivered, launchAt: null, escaped, endless: escaped };
      const loaded = World.fromJSON(JSON.stringify(old));
      expect(loaded.state.version).toBe(SAVE_VERSION);
      expect(loaded.state.ship).toEqual(
        escaped
          ? { stage: SHIP.stages.length, delivered: {}, launchAt: null, runs: 1, returnAt: null, drawn: [] }
          : { stage: 0, delivered: { iron_plate: 20 }, launchAt: null, runs: 0, returnAt: null, drawn: [] },
      );
    }
  });

  it('demolishing the shipyard yourself keeps the ship in either mode', () => {
    const w = quiet('hardcore');
    const b = yard(w);
    for (let i = 0; i < 20; i++) insertShip(w, 'iron_plate');
    w.demolish(b.id);
    expect(w.state.ship.delivered.iron_plate).toBe(20);
  });
});
