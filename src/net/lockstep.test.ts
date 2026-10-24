import { describe, expect, it } from 'vitest';
import { applyCommand } from '../sim/commands';
import { fightingWorld } from '../sim/scenario';
import { Session, summaryHash } from '../sim/session';
import { TICK, World } from '../sim/world';
import { Coop } from './coop';
import { FLUSH_MS, GuestLockstep, HostLockstep, HostMessage, INPUT_DELAY, validCommand } from './lockstep';
import { pack, unpack } from './pack';

/** A host and a guest on the same world, wired together with message queues standing in for the relay. */
function pair() {
  const { w, cx, cy } = fightingWorld(5);
  applyCommand(w, { kind: 'add-player', id: 1 });
  const hostSession = new Session(w, 0);
  /** Every turn the host has sent, as each guest receives it (a copy). */
  const turns: HostMessage[] = [];
  const toHost: [number, string][] = [];
  const host = new HostLockstep(hostSession, (m) => turns.push(JSON.parse(JSON.stringify(m)) as HostMessage));
  const guests = new Map<number, GuestLockstep>();
  const delivered = new Map<number, number>();
  const addGuest = (slot: number, g: GuestLockstep, from = turns.length) => {
    guests.set(slot, g);
    delivered.set(slot, from);
  };
  const guest = new GuestLockstep(new Session(World.fromJSON(hostSession.start), 1), (t) => toHost.push([1, t]));
  addGuest(1, guest);
  let now = 0;
  const deliver = () => {
    for (const [slot, t] of toHost.splice(0)) host.receive(slot, t);
    for (const [slot, g] of guests) {
      for (const m of turns.slice(delivered.get(slot))) g.receive(m);
      delivered.set(slot, turns.length);
    }
  };
  /** One frame: each game runs a tick if it can, then messages travel. */
  const frame = () => {
    now += 1000 * TICK;
    host.tick();
    host.flush(1, now);
    for (const g of guests.values()) g.flush(now);
    deliver();
    for (const g of guests.values()) g.tick();
  };
  /** A last turn, after which every guest runs every tick the host has. */
  const settle = () => {
    host.flush(1, (now += 1000));
    deliver();
    for (const g of guests.values()) while (g.canTick) g.tick();
  };
  /**
   * A guest joining under way: the host's copy reaches it `late` frames after it's taken, and it then
   * hears every turn the host has sent so far (as a guest does, from its recent turns).
   */
  const join = (slot: number, late: number) => {
    const snapshot = host.snapshot(slot, true);
    for (let i = 0; i < late; i++) frame();
    const g = new GuestLockstep(new Session(World.fromJSON(snapshot.world), slot), (t) => toHost.push([slot, t]), snapshot);
    addGuest(slot, g, 0);
    return g;
  };
  return { host, guest, frame, settle, join, cx, cy };
}

describe('Co-op lockstep', () => {
  it('keeps a host and a guest in step while both of them build and walk', () => {
    const { host, guest, frame, settle, cx, cy } = pair();
    for (let t = 0; t < 600; t++) {
      if (t === 10) host.submit(0, { kind: 'place', type: 'wall', x: cx - 2, y: cy, dir: 0, replaceBelt: false });
      if (t === 12) guest.submit({ kind: 'place', type: 'turret', x: cx + 1, y: cy, dir: 0, replaceBelt: false });
      if (t === 30) guest.submit({ kind: 'move', x: cx, y: cy + 3 });
      if (t === 31) host.submit(0, { kind: 'walk', dx: 1, dy: 0 });
      if (t === 200) guest.submit({ kind: 'demolish', id: host.session.world.state.buildings.find((b) => b.type === 'wall')!.id });
      frame();
    }
    // The guest trails the host by the time turns take to arrive; a last turn lets it catch up.
    settle();
    expect(guest.session.ticks).toBe(host.session.ticks);
    expect(guest.desyncedAt).toBeNull();
    const hw = host.session.world;
    expect(hw.state.buildings.some((b) => b.type === 'turret')).toBe(true);
    expect(hw.state.buildings.some((b) => b.type === 'wall')).toBe(false);
    // The guest's command moved the guest's engineer, not the host's.
    const [p0, p1] = hw.state.players;
    expect(p1.id).toBe(1);
    expect(Math.abs(p1.y - (cy + 3.5))).toBeLessThan(1);
    expect(p0.x).toBeGreaterThan(p1.x);
    expect(guest.session.world.toJSON()).toBe(hw.toJSON());
  });

  it('lets a player join a game under way and play in step', () => {
    const { host, guest, frame, settle, join, cx, cy } = pair();
    for (let t = 0; t < 100; t++) {
      if (t % 9 === 0) guest.submit({ kind: 'move', x: cx + (t % 4), y: cy + 2 });
      if (t === 98) host.submit(0, { kind: 'place', type: 'wall', x: cx - 3, y: cy - 3, dir: 0, replaceBelt: false }); // sent with the snapshot's own turn
      frame();
    }
    host.submit(0, { kind: 'place', type: 'wall', x: cx - 3, y: cy - 2, dir: 0, replaceBelt: false }); // not sent yet when the copy is taken
    const late = join(2, 5);
    for (let t = 0; t < 200; t++) {
      if (t % 7 === 0) late.submit({ kind: 'move', x: cx - (t % 5), y: cy - 1 });
      frame();
    }
    settle();
    const hw = host.session.world;
    expect(hw.state.players.map((p) => p.id)).toEqual([0, 1, 2]);
    expect(hw.state.buildings.filter((b) => b.type === 'wall').length).toBe(2);
    expect(late.desyncedAt).toBeNull();
    expect(guest.desyncedAt).toBeNull();
    expect(late.session.world.toJSON()).toBe(hw.toJSON());
    expect(guest.session.world.toJSON()).toBe(hw.toJSON());
  });

  it('asks for a fresh copy when out of step, and plays on in step from it', () => {
    const { host, guest, frame, settle, join } = pair();
    const sent: string[] = [];
    let resyncs = 0;
    const h = new HostLockstep(host.session, () => {}, () => resyncs++);
    h.receive(1, JSON.stringify({ t: 'resync' }));
    expect(resyncs).toBe(1);
    // The real one: the guest's game drifts, it notices at the next fingerprint, and asks once.
    for (let t = 0; t < 10; t++) frame();
    guest.session.world.state.inventory.stone = 1;
    (guest as unknown as { send: (t: string) => void }).send = (t) => sent.push(t);
    for (let t = 0; t < 40; t++) {
      frame();
      guest.checkHealth();
    }
    expect(guest.desyncedAt).not.toBeNull();
    expect(sent.filter((t) => t.includes('resync')).length).toBe(1);
    // The host answers with a copy for the same slot (no new engineer); from it the guest is in step.
    const fresh = join(1, 2);
    expect(host.session.world.state.players.length).toBe(2);
    for (let t = 0; t < 60; t++) frame();
    settle();
    expect(fresh.desyncedAt).toBeNull();
    expect(fresh.session.world.toJSON()).toBe(host.session.world.toJSON());
  });

  it('never lets a guest run a tick before it has every command for it', () => {
    const { host, guest, frame, cx, cy } = pair();
    for (let t = 0; t < 50; t++) {
      if (t % 5 === 0) guest.submit({ kind: 'move', x: cx + (t % 3), y: cy });
      if (t % 7 === 0) host.submit(0, { kind: 'walk', dx: t % 2, dy: 0 });
      frame();
      expect(guest.session.ticks).toBeLessThanOrEqual(guest.through);
      expect(guest.session.ticks).toBeLessThanOrEqual(host.session.ticks);
    }
    // Each command applied on the very tick the host stamped it for, in both games.
    expect(guest.session.log.length).toBeGreaterThan(10);
    for (const e of guest.session.log) expect(e.tick).toBeGreaterThanOrEqual(INPUT_DELAY);
    expect(guest.session.log).toEqual(host.session.log.slice(0, guest.session.log.length));
  });

  it('notices when a guest no longer matches the host', () => {
    const { guest, frame } = pair();
    for (let t = 0; t < 10; t++) frame();
    guest.session.world.state.inventory.stone = 1;
    for (let t = 0; t < 60; t++) frame();
    expect(guest.desyncedAt).not.toBeNull();
  });

  it('sends turns at most every FLUSH_MS, and nothing when nothing changed', () => {
    const { w } = fightingWorld(5);
    const sent: HostMessage[] = [];
    const host = new HostLockstep(new Session(w), (m) => sent.push(m));
    host.flush(1, 0);
    host.flush(1, 10);
    expect(sent.length).toBe(1);
    host.flush(1, FLUSH_MS + 1);
    expect(sent.length).toBe(1); // no tick, no command, same speed
    host.flush(0, FLUSH_MS + 2);
    expect(sent.length).toBe(2); // paused
  });

  it("accepts guests' commands, and nothing that would break the rules", () => {
    expect(validCommand({ kind: 'place', type: 'belt', x: 3, y: 4, dir: 1, replaceBelt: false })).toBe(true);
    expect(validCommand({ kind: 'research', id: 'logistics' })).toBe(true);
    expect(validCommand({ kind: 'filter', id: 4, item: null })).toBe(true);
    expect(validCommand({ kind: 'checkpoint' })).toBe(false);
    expect(validCommand({ kind: 'add-player', id: 2 })).toBe(false);
    expect(validCommand({ kind: 'place', type: 'castle', x: 3, y: 4, dir: 1 })).toBe(false);
    expect(validCommand({ kind: 'place', type: 'belt', x: 3, dir: 1 })).toBe(false);
    expect(validCommand({ kind: 'place', type: 'belt', x: 3, y: 4, dir: 7 })).toBe(false);
    expect(validCommand({ kind: 'move', x: 1.5, y: 2 })).toBe(false);
    expect(validCommand({ kind: 'filter', id: 4, item: 'gold' })).toBe(false);
    expect(validCommand({ kind: 'recipe', id: 4, recipe: '__proto__' })).toBe(false);
    expect(validCommand({ kind: 'toString' })).toBe(false);
    expect(validCommand(null)).toBe(false);
  });
});

describe('Packing a world', () => {
  it('gives back the same text, much smaller', async () => {
    const json = World.create(9).toJSON();
    const packed = await pack(json);
    expect(packed.length).toBeLessThan(json.length / 4);
    expect(await unpack(packed)).toBe(json);
  });
});

describe('A co-op room', () => {
  // The local room (a BroadcastChannel, as two tabs use) runs the relay's own rules from room.ts.
  it('lets a guest join with the code, start with the host, and play the same game', async () => {
    const host = new Coop('local', '1.0.0');
    const guest = new Coop('local', '1.0.0');
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(ok()).toBe(true);
    };
    host.hostRoom();
    await until(() => host.phase === 'lobby');
    expect(guest.joinRoom(host.code.toLowerCase())).toBeNull();
    await until(() => host.players.length === 2 && guest.phase === 'lobby');
    expect(guest.slot).toBe(1);

    let shared: Session | null = null;
    guest.onStart = (s) => (shared = s);
    await host.start(World.create(4));
    await until(() => shared != null);
    const g = shared! as Session;
    expect(g.player).toBe(1);
    expect(g.world.state.players.map((p) => p.id)).toEqual([0, 1]);
    expect(summaryHash(g.world)).toBe(summaryHash(host.host!.session.world));

    // A guest who leaves: its engineer is back below the hub at once, and what it carried is in stock.
    const hw = host.host!.session.world;
    const away = hw.state.players[1];
    const home = { x: away.x, y: away.y };
    away.x += 6;
    away.carry = ['iron_ore', 'iron_ore'];
    const ore = hw.state.inventory.iron_ore ?? 0;
    guest.leave();
    await until(() => host.players.length === 1);
    for (let i = 0; i <= INPUT_DELAY; i++) host.host!.tick();
    expect([away.x, away.y, away.carry.length]).toEqual([home.x, home.y, 0]);
    expect(hw.state.inventory.iron_ore).toBe(ore + 2);

    // A player joining under way gets a copy of the game, and the free slot's engineer.
    const late = new Coop('local', '1.0.0');
    let lateGame: Session | null = null;
    late.onStart = (s) => (lateGame = s);
    late.joinRoom(host.code);
    await until(() => lateGame != null);
    expect((lateGame! as Session).player).toBe(1);
    expect(host.players).toEqual([0, 1]);
    late.leave();
    host.leave();
  });

  it('gets a guest whose connection dropped back into the game', async () => {
    const host = new Coop('local', '1.0.0');
    const guest = new Coop('local', '1.0.0');
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 300 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(ok()).toBe(true);
    };
    host.hostRoom();
    await until(() => host.phase === 'lobby');
    guest.joinRoom(host.code);
    await until(() => host.players.length === 2);
    const starts: boolean[] = [];
    const notices: string[] = [];
    guest.onStart = (_, again) => starts.push(again);
    guest.onNotice = (n) => notices.push(n);
    await host.start(World.create(4));
    await until(() => starts.length === 1);
    // The connection drops (a phone asleep, a train tunnel): the game stays, and comes back in step.
    (guest as unknown as { link: { close(): void } }).link.close();
    expect(guest.phase).toBe('playing');
    await until(() => starts.length === 2);
    expect(starts).toEqual([false, true]);
    expect(notices).toEqual(['Connection lost. Getting back into the game…', 'Back in the game.']);
    expect(guest.slot).toBe(1);
    expect(summaryHash(guest.guest!.session.world)).toBe(summaryHash(host.host!.session.world));
    host.leave();
  });

  it('ends the game for the guests when the host leaves', async () => {
    const host = new Coop('local', '1.0.0');
    const guest = new Coop('local', '1.0.0');
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(ok()).toBe(true);
    };
    host.hostRoom();
    await until(() => host.phase === 'lobby');
    guest.joinRoom(host.code);
    await until(() => guest.phase === 'lobby');
    host.leave();
    let why = '';
    guest.onEnd = (w) => (why = w);
    await until(() => guest.phase === 'idle');
    expect(why).toMatch(/host left/);
  });

  it('turns away a guest on another version, saying which', async () => {
    const host = new Coop('local', '1.0.0');
    const guest = new Coop('local', '0.9.0');
    host.hostRoom();
    for (let i = 0; i < 100 && host.phase !== 'lobby'; i++) await new Promise((r) => setTimeout(r, 10));
    let why = '';
    guest.onEnd = (w) => (why = w);
    guest.joinRoom(host.code);
    for (let i = 0; i < 100 && !why; i++) await new Promise((r) => setTimeout(r, 10));
    expect(why).toMatch(/1\.0\.0.*0\.9\.0/);
    host.leave();
  });
});
