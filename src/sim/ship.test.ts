import { describe, expect, it } from 'vitest';
import { BLACK_MARKET, ItemId, SHIP, waveComposition } from './data';
import { awaitingReturn, comeBack, insertShip, launch, shipyard } from './ship';
import { Building, SAVE_VERSION, TICK, World } from './world';

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

/** A quiet world with the shipyard plans researched and plenty of stock. */
function withPlans(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(21, mode);
  const s = w.state;
  s.nextWaveAt = 1e9;
  s.company.nextContractAt = 1e9;
  s.blackMarket.contacted = true;
  s.blackMarket.researched.push('shipyard');
  s.resources.fill(0);
  s.inventory = { iron_plate: 999, brick: 999 };
  return w;
}

/** Places the shipyard well outside the Company's watch radius. */
function yard(w: World): Building {
  const hub = w.hub!;
  return placed(w.place('shipyard', hub.x - BLACK_MARKET.watchRadius - 8, hub.y, 0));
}

/** Feeds every stage's items straight into the shipyard. */
function finishShip(w: World): void {
  for (const stage of SHIP.stages) {
    for (const [item, n] of Object.entries(stage.items)) for (let i = 0; i < n!; i++) insertShip(w, item as ItemId);
  }
}

describe('Escape ship', () => {
  it('the shipyard is unlocked by black-market research, takes 3×3 tiles, and only one can be built', () => {
    const w = World.create(21);
    w.state.inventory = { iron_plate: 999, brick: 999 };
    expect(w.isUnlocked('shipyard')).toBe(false);
    w.state.blackMarket.contacted = true;
    w.state.blackMarket.researched.push('shipyard');
    w.state.resources.fill(0);
    expect(w.isUnlocked('shipyard')).toBe(true);
    const b = yard(w);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) expect(w.buildingAt(b.x + dx, b.y + dy)).toBe(b);
    expect(w.place('shipyard', b.x + 10, b.y, 0)).toBe('unique');
    expect(w.checkPlace('belt', b.x + 2, b.y + 2)).toBe('occupied');
  });

  it('stages take only the parts they still need, in order, and a Friend writes as each one is done', () => {
    const w = withPlans();
    const b = yard(w);
    const from = [b.x - 1, b.y] as const;
    expect(w.insert(b, 'motor', ...from)).toBe(false); // the hull comes first
    expect(w.insert(b, 'iron_plate', ...from)).toBe(true);
    expect(w.state.ship.delivered.iron_plate).toBe(1);
    for (let i = 1; i < 150; i++) w.insert(b, 'iron_plate', ...from);
    expect(w.insert(b, 'iron_plate', ...from)).toBe(false); // enough plates
    for (let i = 0; i < 80; i++) w.insert(b, 'brick', ...from);
    expect(w.state.ship.stage).toBe(1);
    expect(w.state.ship.delivered).toEqual({});
    expect(w.state.company.inbox[0].subject).toBe('Re: Hull');
    expect(w.insert(b, 'motor', ...from)).toBe(true); // now the engine
  });

  it('launching needs a finished ship and brings an early, doubled wave that also targets the shipyard', () => {
    const w = withPlans();
    const b = yard(w);
    expect(launch(w)).toBe('not-ready');
    finishShip(w);
    w.state.nextWaveAt = w.state.time + 500;
    expect(launch(w)).toBeNull();
    expect(w.state.ship.launchAt).toBeCloseTo(w.state.time + SHIP.launchTime);
    expect(w.state.nextWaveAt).toBeCloseTo(w.state.time + SHIP.launchWaveIn);
    expect(launch(w)).toBe('launching');
    run(w, SHIP.launchWaveIn + 0.5);
    const queued = w.state.spawnQueue.length + w.state.enemies.length;
    const comp = waveComposition(w.state.wave);
    expect(queued).toBe(SHIP.finaleMultiplier * (comp.crawlers + comp.runners + comp.brutes));
    // The shipyard is a destination for enemies while it launches.
    expect(w.flow[w.idx(b.x + 1, b.y + 1)]).toBe(0);
  });

  it('holding the shipyard until lift-off wins; the game waits, then coming back is endless mode', () => {
    const w = withPlans();
    yard(w);
    finishShip(w);
    launch(w);
    w.state.enemies = [];
    w.state.spawnQueue = [];
    w.state.nextWaveAt = 1e9;
    run(w, SHIP.launchTime + 1);
    expect(w.state.ship.escaped).toBe(true);
    expect(awaitingReturn(w)).toBe(true);
    const t = w.state.time;
    run(w, 5);
    expect(w.state.time).toBe(t); // frozen on the victory screen

    const debt = w.state.company.debt;
    comeBack(w);
    expect(w.state.ship.endless).toBe(true);
    expect(shipyard(w)).toBeUndefined();
    expect(w.state.company.debt).toBe(debt + SHIP.returnDebt);
    expect(w.state.company.inbox[0].subject).toBe('Welcome back!');
    expect(w.state.nextWaveAt).toBeCloseTo(t + SHIP.endlessGrace);
    expect(w.place('shipyard', w.hub!.x - 30, w.hub!.y, 0)).toBe('unique'); // no second escape
    run(w, 1);
    expect(w.state.time).toBeGreaterThan(t); // the game goes on
  });

  it('losing the shipyard stops a launch; Standard keeps the stages built, Hardcore loses the ship', () => {
    for (const mode of ['standard', 'hardcore'] as const) {
      const w = withPlans(mode);
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
    const w = withPlans('hardcore');
    const b = yard(w);
    for (let i = 0; i < 20; i++) insertShip(w, 'iron_plate');
    w.demolish(b.id);
    expect(w.state.ship.delivered.iron_plate).toBe(20);
  });

  it('migrates v6 saves', () => {
    const w = World.create(5);
    const old = JSON.parse(w.toJSON());
    old.version = 6;
    delete old.ship;
    const loaded = World.fromJSON(JSON.stringify(old));
    expect(loaded.state.version).toBe(SAVE_VERSION);
    expect(loaded.state.ship.stage).toBe(0);
  });
});
