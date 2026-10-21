import { describe, expect, it } from 'vitest';
import { BLACK_MARKET, ItemId } from './data';
import { FRIEND_SUBJECT, auditSweep, startBlackMarketResearch, stashCapacity, stashTotal, watchedContraband } from './blackmarket';
import { COMPANY } from './company';
import { Building, SAVE_VERSION, TICK, World } from './world';

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

/** A quiet world (no waves, no contracts) where A Friend has already been in touch. */
function contacted(mode: 'standard' | 'hardcore' = 'standard'): World {
  const w = World.create(12, mode);
  w.state.nextWaveAt = 1e9;
  w.state.company.nextContractAt = 1e9;
  w.state.blackMarket.contacted = true;
  w.state.inventory = { iron_plate: 500, brick: 500, gear: 100, wire: 100, copper_ingot: 100 };
  return w;
}

/** A tile far from the hub, outside the Company's watch radius. */
function far(w: World): [number, number] {
  const hub = w.hub!;
  return [hub.x - BLACK_MARKET.watchRadius - 6, hub.y + 1];
}

describe('Black market', () => {
  it('A Friend gets in touch after the first contract closes; reading the email unlocks the stash', () => {
    const w = World.create(3);
    w.state.nextWaveAt = 1e9;
    expect(w.isUnlocked('stash')).toBe(false);
    run(w, COMPANY.firstContractAt + COMPANY.contractTime + 2); // first contract lapses
    expect(w.state.blackMarket.contacted).toBe(false);
    run(w, BLACK_MARKET.contactDelay + 1);
    expect(w.state.blackMarket.contacted).toBe(true);
    expect(w.isUnlocked('stash')).toBe(false); // not until the email is read
    w.state.company.inbox.find((m) => m.subject === FRIEND_SUBJECT)!.read = true;
    expect(w.isUnlocked('stash')).toBe(true);
    expect(w.isUnlocked('skimmer')).toBe(false);
    expect(w.state.company.inbox.some((m) => m.from.startsWith('A Friend'))).toBe(true);
  });

  it('stashes hold items off the books, up to their capacity', () => {
    const w = contacted();
    const [x, y] = far(w);
    const stash = placed(w.place('stash', x, y, 0));
    const plates = w.state.inventory.iron_plate!;
    for (let i = 0; i < BLACK_MARKET.stashCapacity; i++) expect(w.insert(stash, 'gear', x - 1, y)).toBe(true);
    expect(w.insert(stash, 'gear', x - 1, y)).toBe(false);
    expect(stashTotal(w)).toBe(BLACK_MARKET.stashCapacity);
    expect(w.state.inventory.iron_plate).toBe(plates); // hub stock untouched
    w.demolish(stash.id);
    expect(stashCapacity(w)).toBe(0);
    expect(stashTotal(w)).toBe(0); // the only stash took everything with it
  });

  it('black-market research draws from the stash and unlocks the skimmer', () => {
    const w = contacted();
    const [x, y] = far(w);
    const stash = placed(w.place('stash', x, y, 0));
    const put = (item: ItemId, n: number) => {
      for (let i = 0; i < n; i++) w.insert(stash, item, x - 1, y);
    };
    put('iron_plate', 20);
    put('gear', 6);
    const hubPlates = w.state.inventory.iron_plate!;
    expect(startBlackMarketResearch(w, 'skimmer')).toBe(null);
    run(w, 61);
    expect(w.isUnlocked('skimmer')).toBe(true);
    expect(stashTotal(w)).toBe(0);
    expect(w.state.inventory.iron_plate).toBe(hubPlates);
  });

  it('skimmers divert every 4th item to their right and raise suspicion', () => {
    const w = contacted();
    w.state.blackMarket.researched.push('skimmer');
    const [x, y] = far(w);
    const sk = placed(w.place('skimmer', x, y, 0)); // facing east; right is south
    const front = placed(w.place('belt', x + 1, y, 0));
    const side = placed(w.place('belt', x, y + 1, 1));
    const sus = w.state.blackMarket.suspicion;
    for (let i = 0; i < 8; i++) {
      expect(w.insert(sk, 'iron_plate', x - 1, y)).toBe(true);
      run(w, 0.5);
      front.belt = [];
      side.belt.length = Math.min(side.belt.length, 99);
    }
    expect(w.state.blackMarket.skimmed).toBe(2);
    expect(w.state.blackMarket.suspicion).toBeGreaterThan(sus);
  });

  it('contraband near the hub raises suspicion; far away it fades', () => {
    const w = contacted();
    const hub = w.hub!;
    placed(w.place('stash', hub.x - 3, hub.y + 1, 0));
    expect(watchedContraband(w)).toHaveLength(1);
    run(w, 60);
    const near = w.state.blackMarket.suspicion;
    expect(near).toBeGreaterThan(0);
    const w2 = contacted();
    const [x, y] = far(w2);
    placed(w2.place('stash', x, y, 0));
    w2.state.blackMarket.suspicion = 10;
    run(w2, 60);
    expect(w2.state.blackMarket.suspicion).toBeLessThan(10);
  });

  it('missed contracts raise suspicion and met ones lower it', () => {
    const w = World.create(5);
    w.state.nextWaveAt = 1e9;
    run(w, COMPANY.firstContractAt + COMPANY.contractTime + 2);
    expect(w.state.blackMarket.suspicion).toBeGreaterThan(BLACK_MARKET.suspicion.contractMissed - 1);
  });

  it('high suspicion brings an audit that fines contraband in range (Standard)', () => {
    const w = contacted();
    const hub = w.hub!;
    placed(w.place('stash', hub.x - 3, hub.y + 1, 0));
    const [x, y] = far(w);
    placed(w.place('stash', x, y, 0)); // out of the drone's range
    w.state.blackMarket.suspicion = BLACK_MARKET.suspicion.auditAt;
    const debt = w.state.company.debt;
    w.tick();
    expect(w.state.blackMarket.audit).not.toBe(null);
    expect(w.state.company.inbox[0].subject).toBe('Notice of routine audit');
    run(w, BLACK_MARKET.audit.notice + 1);
    expect(auditSweep(w)).not.toBe(null);
    run(w, BLACK_MARKET.audit.sweep);
    const a = BLACK_MARKET.audit;
    expect(w.state.company.debt).toBeGreaterThanOrEqual(debt + a.fee + a.finePerItem);
    expect(w.state.buildings.filter((b) => b.type === 'stash')).toHaveLength(2); // Standard keeps them
    expect(w.state.blackMarket.suspicion).toBeLessThanOrEqual(a.after + 1);
    expect(w.state.company.inbox.find((m) => m.subject.startsWith('Audit findings'))?.body).toMatch(/Stash/);
  });

  it('Hardcore audits confiscate and destroy contraband in range', () => {
    const w = contacted('hardcore');
    const hub = w.hub!;
    placed(w.place('stash', hub.x - 3, hub.y + 1, 0));
    const [x, y] = far(w);
    placed(w.place('stash', x, y, 0));
    w.state.blackMarket.suspicion = 100;
    run(w, BLACK_MARKET.audit.urgentNotice + BLACK_MARKET.audit.sweep + 1);
    const stashes = w.state.buildings.filter((b) => b.type === 'stash');
    expect(stashes).toHaveLength(1);
    expect(stashes[0].x).toBe(x);
  });

  it('a disguise kit hides most contraband from audits', () => {
    let foundPlain = 0;
    let foundDisguised = 0;
    for (const disguise of [false, true]) {
      for (let seed = 0; seed < 8; seed++) {
        const w = contacted();
        w.state.rng = seed;
        if (disguise) w.state.blackMarket.researched.push('disguise');
        const hub = w.hub!;
        for (let i = 0; i < 4; i++) placed(w.place('stash', hub.x - 2 - i, hub.y - 3, 0));
        w.state.blackMarket.suspicion = 100;
        run(w, BLACK_MARKET.audit.urgentNotice + BLACK_MARKET.audit.sweep + 1);
        const fines = (w.state.company.debt - 48_750 - BLACK_MARKET.audit.fee) / BLACK_MARKET.audit.finePerItem;
        if (disguise) foundDisguised += fines;
        else foundPlain += fines;
      }
    }
    expect(foundPlain).toBe(32);
    expect(foundDisguised).toBeLessThan(20);
  });

  it('adds the black market to version 5 saves', () => {
    const v5 = JSON.parse(World.create(6).toJSON());
    v5.version = 5;
    delete v5.blackMarket;
    const w = World.fromJSON(JSON.stringify(v5));
    expect(w.state.version).toBe(SAVE_VERSION);
    expect(w.state.blackMarket.suspicion).toBe(0);
  });
});
