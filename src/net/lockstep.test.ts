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
  const toGuest: HostMessage[] = [];
  const toHost: string[] = [];
  const host = new HostLockstep(hostSession, (m) => toGuest.push(JSON.parse(JSON.stringify(m)) as HostMessage));
  const guest = new GuestLockstep(new Session(World.fromJSON(hostSession.start), 1), (t) => toHost.push(t));
  let now = 0;
  /** One frame: each game runs a tick if it can, then messages travel. */
  const frame = () => {
    now += 1000 * TICK;
    host.tick();
    host.flush(1, now);
    guest.flush(now);
    for (const t of toHost.splice(0)) host.receive(1, t);
    for (const m of toGuest.splice(0)) guest.receive(m);
    guest.tick();
  };
  /** A last turn, after which the guest runs every tick the host has. */
  const settle = () => {
    host.flush(1, (now += 1000));
    for (const m of toGuest.splice(0)) guest.receive(m);
    while (guest.canTick) guest.tick();
  };
  return { host, guest, frame, settle, cx, cy };
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

    // A guest who leaves: its engineer walks back to the hub.
    const hw = host.host!.session.world;
    const away = hw.state.players[1];
    away.x += 6;
    guest.leave();
    await until(() => host.players.length === 1);
    for (let i = 0; i <= INPUT_DELAY; i++) host.host!.tick();
    expect(away.path.length).toBeGreaterThan(0);

    // Joining again once the game is under way isn't possible yet.
    const again = new Coop('local', '1.0.0');
    let why = '';
    again.onEnd = (w) => (why = w);
    again.joinRoom(host.code);
    await until(() => why !== '');
    expect(why).toMatch(/already started/);
    expect(host.players).toEqual([0]);
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
