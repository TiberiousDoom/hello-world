import { describe, expect, it } from 'vitest';
import { COMPANY, STORE, buyCrate, contractProgress, unreadCount } from './company';
import { ItemId, RESEARCH } from './data';
import { SAVE_VERSION, TICK, World } from './world';

function run(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += TICK) w.tick();
}

/** A world with no waves, so only the Company acts. */
function quietWorld(): World {
  const w = World.create(3);
  w.state.nextWaveAt = 1e9;
  return w;
}

/** Delivers items to the hub as if they came off a belt. */
function deliver(w: World, item: ItemId, n: number) {
  const hub = w.hub!;
  for (let i = 0; i < n; i++) w.insert(hub, item, hub.x - 1, hub.y);
}

describe('Company', () => {
  it('starts you in debt with a welcome email', () => {
    const w = World.create(1);
    expect(w.state.company.debt).toBe(COMPANY.startingDebt);
    expect(w.state.company.inbox[0].subject).toMatch(/Welcome/);
    expect(unreadCount(w)).toBe(1);
  });

  it('issues the first contract after a short delay', () => {
    const w = quietWorld();
    run(w, COMPANY.firstContractAt - 1);
    expect(w.state.company.contract).toBe(null);
    run(w, 2);
    const c = w.state.company.contract!;
    expect(c.id).toBe(1);
    expect(Object.keys(c.items)).toHaveLength(1);
    expect(w.state.company.inbox[0].subject).toMatch(/Contract #1/);
  });

  it('counts deliveries, ships them from stock and pays when complete', () => {
    const w = quietWorld();
    run(w, COMPANY.firstContractAt + 1);
    const c = w.state.company.contract!;
    const [item, need] = Object.entries(c.items)[0] as [ItemId, number];
    deliver(w, item, need - 1);
    expect(contractProgress(c)).toBeLessThan(1);
    const stockBefore = w.state.inventory[item]!;
    deliver(w, item, 1);
    w.tick();
    expect(w.state.company.contract).toBe(null);
    expect(w.state.company.contractsMet).toBe(1);
    expect(w.state.inventory[item]).toBe(stockBefore + 1 - need);
    expect(w.state.company.inbox[0].subject).toMatch(/Payslip: Contract #1/);
    run(w, COMPANY.contractGap + 1);
    expect(w.state.company.contract?.id).toBe(2);
  });

  it('fines a missed contract and enlarges the next one', () => {
    const w = quietWorld();
    run(w, COMPANY.firstContractAt + 1);
    const first = w.state.company.contract!;
    const [item] = Object.keys(first.items) as ItemId[];
    deliver(w, item, 2);
    const debt = w.state.company.debt;
    run(w, COMPANY.contractTime + 1);
    const c = w.state.company;
    expect(c.contractsMissed).toBe(1);
    expect(c.missedInARow).toBe(1);
    const total = Object.values(first.items).reduce((a, n) => a + n!, 0);
    expect(c.debt).toBe(debt + COMPANY.lateFee + (total - 2) * COMPANY.shortfallFinePerItem);
    expect(c.inbox[0].tone).toBe('bad');
    run(w, COMPANY.contractGap + 1);
    expect(c.inbox[0].body).toMatch(/Performance Improvement Plan/);
  });

  it('counts spent items as a shortfall when shipping', () => {
    const w = quietWorld();
    run(w, COMPANY.firstContractAt + 1);
    const c = w.state.company.contract!;
    const [item, need] = Object.entries(c.items)[0] as [ItemId, number];
    w.state.inventory[item] = 0;
    deliver(w, item, need);
    w.state.inventory[item] = need - 3; // the player spent three before it shipped
    w.tick();
    expect(w.state.company.contractsMissed).toBe(1);
    expect(w.state.inventory[item]).toBe(0);
  });

  it('asks for parts once workshops are researched', () => {
    const w = quietWorld();
    w.state.researched = RESEARCH.map((r) => r.id);
    w.state.company.contractsMet = 10;
    run(w, COMPANY.firstContractAt + 1);
    const items = Object.keys(w.state.company.contract!.items);
    expect(items).toHaveLength(3);
  });

  it('charges licence fees for research and invoices hub breaches', () => {
    const w = quietWorld();
    const debt = w.state.company.debt;
    w.research('defense');
    expect(w.state.company.debt).toBe(debt + COMPANY.researchFee);
    w.hub!.hp = 0;
    w.tick();
    expect(w.state.company.debt).toBe(debt + COMPANY.researchFee + COMPANY.breachInvoice);
    expect(w.state.company.inbox[0].subject).toMatch(/Invoice/);
  });

  it('sells crates on credit up to a limit', () => {
    const w = quietWorld();
    const crate = STORE[0];
    const plates = w.state.inventory.iron_plate!;
    expect(buyCrate(w, crate.id)).toBe(null);
    expect(w.state.inventory.iron_plate).toBe(plates + crate.items.iron_plate!);
    expect(w.state.company.debt).toBe(COMPANY.startingDebt + crate.price);
    w.state.company.debt = COMPANY.creditLimit;
    expect(buyCrate(w, crate.id)).toBe('credit-limit');
  });

  it('warns about wildlife before the first wave', () => {
    const w = World.create(4);
    w.startWave();
    expect(w.state.company.inbox.some((m) => m.subject === 'Wildlife advisory')).toBe(true);
  });

  it('adds the Company to version 3 saves', () => {
    const v3 = JSON.parse(World.create(6).toJSON());
    v3.version = 3;
    delete v3.company;
    v3.time = 500;
    const w = World.fromJSON(JSON.stringify(v3));
    expect(w.state.version).toBe(SAVE_VERSION);
    expect(w.state.company.debt).toBe(COMPANY.startingDebt);
    expect(w.state.company.nextContractAt).toBe(500 + COMPANY.firstContractAt);
    expect(w.state.company.inbox).toHaveLength(1);
  });
});
