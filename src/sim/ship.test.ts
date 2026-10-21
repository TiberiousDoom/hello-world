import { describe, expect, it } from 'vitest';
import { ItemId, NESTS, RESEARCH, SHIP } from './data';
import { Nest, cellKey, isAngry } from './nests';
import { awaitingChoice, insertShip, keepPlaying, launch, shipyard } from './ship';
import { Building, TICK, World } from './world';

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

function addNest(w: World, x: number, y: number): Nest {
  const n: Nest = { id: w.state.nests.length, x, y, angryUntil: 0 };
  w.state.nests.push(n);
  w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
  w.spawnBug('crawler', n, 1);
  return n;
}

describe('Escape ship', () => {
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

  it('launching needs a finished ship and wakes the nests within reach', () => {
    const w = quiet();
    const b = yard(w);
    const near = addNest(w, Math.floor((b.x - 30) / 10) * 10, Math.floor(b.y / 10) * 10);
    const far = addNest(w, 0, 0);
    expect(launch(w)).toBe('not-ready');
    finishShip(w);
    expect(launch(w)).toBeNull();
    expect(w.state.ship.launchAt).toBeCloseTo(w.state.time + SHIP.launchTime);
    expect(isAngry(w, near)).toBe(true);
    expect(isAngry(w, far)).toBe(false);
    expect(near.angryUntil).toBeGreaterThan(w.state.ship.launchAt!);
    expect(launch(w)).toBe('launching');
  });

  it('holding the shipyard until lift-off wins; the game waits, then keeps going on request', () => {
    const w = quiet();
    yard(w);
    finishShip(w);
    launch(w);
    run(w, SHIP.launchTime + 1);
    expect(w.state.ship.escaped).toBe(true);
    expect(awaitingChoice(w)).toBe(true);
    const t = w.state.time;
    run(w, 5);
    expect(w.state.time).toBe(t); // frozen on the victory screen
    keepPlaying(w);
    expect(w.state.ship.endless).toBe(true);
    expect(shipyard(w)).toBeUndefined();
    expect(w.place('shipyard', w.hub!.x - 40, w.hub!.y, 0)).toBe('unique'); // no second escape
    run(w, 1);
    expect(w.state.time).toBeGreaterThan(t);
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

  it('demolishing the shipyard yourself keeps the ship in either mode', () => {
    const w = quiet('hardcore');
    const b = yard(w);
    for (let i = 0; i < 20; i++) insertShip(w, 'iron_plate');
    w.demolish(b.id);
    expect(w.state.ship.delivered.iron_plate).toBe(20);
  });
});
