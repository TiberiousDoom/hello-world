import { describe, expect, it } from 'vitest';
import { GUEST_RATE, HEARTBEAT, MAX_GUEST_MESSAGE, MAX_PLAYERS, RelayMessage, Role, makeCode, validCode } from './protocol';
import { Allowance, CLOSE_POLICY, CLOSE_REPLACED, Peer, admit, expire, leave, retire, route, welcome } from './room';

/** A connection that records what it was sent, and whether it was closed. */
function peer(slot: number, role: Role = slot === 0 ? 'host' : 'guest', version = '1.0.0') {
  const got: RelayMessage[] = [];
  const p: Peer & { got: RelayMessage[]; closed?: number } = {
    slot,
    role,
    version,
    got,
    send: (m) => got.push(m),
    close: (code) => (p.closed = code),
  };
  return p;
}

describe('Co-op relay rooms (D-077)', () => {
  it('room codes are 6 easy-to-read letters and digits', () => {
    const code = makeCode(new Uint8Array([0, 1, 2, 3, 250, 255]));
    expect(validCode(code)).toBe(true);
    expect(validCode('ABC')).toBe(false);
    expect(validCode('ABCDE0')).toBe(false); // no zero: it looks like an O
  });

  it('lets in one host, then guests on the same version, up to MAX_PLAYERS players', () => {
    expect(admit([], 'guest', '1.0.0')).toEqual({ refuse: 'no-room' });
    expect(admit([], 'host', '1.0.0')).toEqual({ slot: 0 });
    const host = peer(0);
    expect(admit([host], 'host', '1.0.0')).toEqual({ refuse: 'taken' });
    expect(admit([host], 'guest', '1.0.1')).toEqual({ refuse: 'version', hostVersion: '1.0.0' });
    expect(admit([host], 'guest', '1.0.0')).toEqual({ slot: 1 });
    expect(admit([host, peer(1), peer(3)], 'guest', '1.0.0')).toEqual({ slot: 2 }); // a free slot is reused
    const full = [host, ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => peer(i + 1))];
    expect(MAX_PLAYERS).toBe(10); // D-083
    expect(admit(full.slice(0, -1), 'guest', '1.0.0')).toEqual({ slot: MAX_PLAYERS - 1 });
    expect(admit(full, 'guest', '1.0.0')).toEqual({ refuse: 'full' });
    expect(admit([], 'host', '')).toEqual({ refuse: 'bad-request' });
  });

  it("lets a host with its key take over from its own old connection, and nobody else (D-085)", () => {
    const host = peer(0);
    const room = { key: 'secret', version: '1.0.0' };
    expect(admit([host, peer(1)], 'host', '1.0.0', 'secret', room)).toEqual({ slot: 0 });
    expect(admit([host, peer(1)], 'host', '1.0.0', 'wrong', room)).toEqual({ refuse: 'taken' });
    expect(admit([host, peer(1)], 'host', '1.0.0', '', room)).toEqual({ refuse: 'taken' });
    expect(admit([host], 'host', '1.0.0', 'secret', null)).toEqual({ refuse: 'taken' });
    // The old connection is told, then closed; guests are left alone.
    const guest = peer(1);
    expect(retire([host, guest])).toBe(host);
    expect(host.got).toEqual([{ t: 'closed', reason: 'replaced' }]);
    expect(host.closed).toBe(CLOSE_REPLACED);
    expect(guest.got).toEqual([]);
    expect(retire([guest])).toBeUndefined();
  });

  it('answers a heartbeat to its sender only, and passes it to nobody (D-085)', () => {
    const host = peer(0);
    const guest = peer(1);
    route([host, guest], host, HEARTBEAT);
    expect(host.got).toEqual([{ t: 'heartbeat' }]);
    expect(guest.got).toEqual([]);
    expect(host.closed).toBeUndefined();
  });

  it('welcomes a newcomer with everyone in the room, and tells the others', () => {
    const host = peer(0);
    const a = peer(1);
    const b = peer(2);
    welcome([host, a], b);
    expect(b.got).toEqual([{ t: 'welcome', slot: 2, players: [0, 1, 2] }]);
    expect(host.got).toEqual([{ t: 'joined', slot: 2 }]);
    expect(a.got).toEqual([{ t: 'joined', slot: 2 }]);
  });

  it("passes a guest's messages to the host only, and the host's to one guest or all", () => {
    const host = peer(0);
    const a = peer(1);
    const b = peer(2);
    const all = [host, a, b];
    route(all, a, '{"kind":"place"}');
    expect(host.got).toEqual([{ t: 'from', slot: 1, data: '{"kind":"place"}' }]);
    expect(b.got).toEqual([]);
    route(all, host, JSON.stringify({ data: 'turn 12' }));
    expect(a.got).toEqual([{ t: 'host', data: 'turn 12' }]);
    expect(b.got).toEqual([{ t: 'host', data: 'turn 12' }]);
    route(all, host, JSON.stringify({ to: 2, data: 'snapshot' }));
    expect(a.got.length).toBe(1);
    expect(b.got.at(-1)).toEqual({ t: 'host', data: 'snapshot' });
  });

  it('closes a connection that sends something too big, not text, or not a host message', () => {
    const host = peer(0);
    const a = peer(1);
    route([host, a], a, 'x'.repeat(MAX_GUEST_MESSAGE + 1));
    expect(a.closed).toBe(CLOSE_POLICY);
    expect(host.got).toEqual([]);
    const b = peer(2);
    route([host, b], b, new ArrayBuffer(4));
    expect(b.closed).toBe(CLOSE_POLICY);
    route([host], host, 'not json');
    expect(host.closed).toBe(CLOSE_POLICY);
  });

  it('a guest leaving is announced; the host leaving closes the room', () => {
    const host = peer(0);
    const a = peer(1);
    const b = peer(2);
    leave([host, a, b], peer(2));
    expect(host.got).toEqual([{ t: 'left', slot: 2 }]);
    leave([host, a], peer(0));
    expect(a.got).toEqual([{ t: 'left', slot: 2 }, { t: 'closed', reason: 'host-left' }]);
    expect(a.closed).toBe(1000);
  });

  it('waits for a host whose connection dropped, and lets only that host back in (D-081)', () => {
    const host = peer(0);
    const a = peer(1);
    const b = peer(2);
    expect(leave([host, a, b], host, 1006)).toBe('wait');
    expect(a.got).toEqual([{ t: 'host-away' }]);
    expect(a.closed).toBeUndefined();
    const room = { key: 'secret', version: '1.0.0' };
    // Guests may still come in, on the host's version; only the host with the key may take it back.
    expect(admit([a, b], 'guest', '1.0.0', '', room)).toEqual({ slot: 3 });
    expect(admit([a, b], 'guest', '0.9.0', '', room)).toEqual({ refuse: 'version', hostVersion: '1.0.0' });
    expect(admit([a, b], 'host', '1.0.0', 'guess', room)).toEqual({ refuse: 'taken' });
    expect(admit([a, b], 'host', '1.0.0', 'secret', room)).toEqual({ slot: 0 });
    // An empty room is new again: anyone may open it.
    expect(admit([], 'host', '1.0.0', 'other', room)).toEqual({ slot: 0 });
    expect(admit([], 'guest', '1.0.0', '', room)).toEqual({ refuse: 'no-room' });
    // Not back in time: the room closes.
    expire([a, b]);
    expect(a.got.at(-1)).toEqual({ t: 'closed', reason: 'host-left' });
    expect(b.closed).toBe(1000);
    // A host leaving on purpose closes it at once.
    const c = peer(1);
    expect(leave([peer(0), c], peer(0), 1000)).toBeUndefined();
    expect(c.got).toEqual([{ t: 'closed', reason: 'host-left' }]);
  });

  it("limits a guest's messages to GUEST_RATE a second, with short bursts", () => {
    const allowance = new Allowance(0);
    let sent = 0;
    while (allowance.take(0)) sent++;
    expect(sent).toBe(GUEST_RATE * 2);
    expect(allowance.take(1000 / GUEST_RATE)).toBe(true); // one more, a moment later
    expect(allowance.take(1000 / GUEST_RATE)).toBe(false);
  });
});
