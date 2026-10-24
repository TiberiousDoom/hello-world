// A co-op room's rules, apart from Cloudflare's APIs so they can be unit tested (D-077). The Durable
// Object in relay/src/index.ts keeps each connection's details on the socket itself, so a room that sleeps
// between messages wakes up knowing who's in it.

import { CLOSE_LEAVING, GUEST_RATE, HostSend, MAX_GUEST_MESSAGE, MAX_HOST_MESSAGE, MAX_PLAYERS, RefuseReason, RelayMessage, Role, RoomHost } from './protocol';

/** A connection in a room: who it is, and how to reach it. */
export interface Peer {
  slot: number;
  role: Role;
  version: string;
  send(message: RelayMessage): void;
  close(code: number, reason: string): void;
}

/** Normal closure (1000), and a policy violation (1008) for a refusal or a broken rule. */
export const CLOSE_NORMAL = 1000;
export const CLOSE_POLICY = 1008;

/**
 * Who may join: the host only into a room with no host, a guest only into an open room, on the host's
 * version, while there's a free slot. A room whose host dropped out (`room`, D-081) stays open, and
 * only a host with its key may take it back. Returns the new player's slot, or why not.
 */
export function admit(
  peers: Peer[],
  role: Role,
  version: string,
  key = '',
  room: RoomHost | null = null,
): { slot: number } | { refuse: RefuseReason; hostVersion?: string } {
  if (!version || version.length > 40 || key.length > 64) return { refuse: 'bad-request' };
  const host = peers.find((p) => p.role === 'host');
  if (role === 'host') return host || (room && peers.length && room.key !== key) ? { refuse: 'taken' } : { slot: 0 };
  const hostVersion = host?.version ?? (peers.length ? room?.version : undefined);
  if (!hostVersion) return { refuse: 'no-room' };
  if (hostVersion !== version) return { refuse: 'version', hostVersion };
  for (let slot = 1; slot < MAX_PLAYERS; slot++) if (!peers.some((p) => p.slot === slot)) return { slot };
  return { refuse: 'full' };
}

/** Tells the newcomer who's here, and everyone else that it came. */
export function welcome(peers: Peer[], newcomer: Peer): void {
  newcomer.send({ t: 'welcome', slot: newcomer.slot, players: [...peers.map((p) => p.slot), newcomer.slot].sort((a, b) => a - b) });
  for (const p of peers) p.send({ t: 'joined', slot: newcomer.slot });
}

/**
 * Routes one message. A guest's goes to the host; the host's goes to the guest it names, or to every
 * guest. Anything too big, or not text, closes the sender's connection.
 */
export function route(peers: Peer[], from: Peer, raw: string | ArrayBuffer): void {
  if (typeof raw !== 'string') return from.close(CLOSE_POLICY, 'text only');
  if (from.role === 'guest') {
    if (raw.length > MAX_GUEST_MESSAGE) return from.close(CLOSE_POLICY, 'too big');
    peers.find((p) => p.role === 'host')?.send({ t: 'from', slot: from.slot, data: raw });
    return;
  }
  if (raw.length > MAX_HOST_MESSAGE) return from.close(CLOSE_POLICY, 'too big');
  let msg: HostSend;
  try {
    msg = JSON.parse(raw) as HostSend;
  } catch {
    return from.close(CLOSE_POLICY, 'bad message');
  }
  if (typeof msg?.data !== 'string') return from.close(CLOSE_POLICY, 'bad message');
  for (const p of peers) {
    if (p.role === 'host' || (msg.to != null && p.slot !== msg.to)) continue;
    p.send({ t: 'host', data: msg.data });
  }
}

/**
 * Someone left. A host leaving on purpose closes the room, and every guest is told. A host whose
 * connection dropped (any close code but CLOSE_LEAVING) leaves the room waiting for it, and returns
 * 'wait': the room closes with `expire` if the host isn't back within HOST_GRACE_MS (D-081).
 */
export function leave(peers: Peer[], gone: Peer, code = CLOSE_LEAVING): 'wait' | void {
  const rest = peers.filter((p) => p.slot !== gone.slot);
  if (gone.role === 'host') {
    if (code !== CLOSE_LEAVING && rest.length) {
      for (const p of rest) p.send({ t: 'host-away' });
      return 'wait';
    }
    return expire(rest);
  }
  for (const p of rest) p.send({ t: 'left', slot: gone.slot });
}

/** The room closes for good: every guest is told the host left. */
export function expire(peers: Peer[]): void {
  for (const p of peers) {
    if (p.role === 'host') continue;
    p.send({ t: 'closed', reason: 'host-left' });
    p.close(CLOSE_NORMAL, 'host left');
  }
}

/**
 * A guest's message allowance (a token bucket): GUEST_RATE a second on average, with bursts of up to
 * twice that. Kept in memory only; a room that wakes from sleep starts everyone afresh.
 */
export class Allowance {
  private tokens = GUEST_RATE * 2;
  private at: number;

  constructor(now: number) {
    this.at = now;
  }

  /** Whether one more message is allowed at time `now` (ms). */
  take(now: number): boolean {
    this.tokens = Math.min(GUEST_RATE * 2, this.tokens + ((now - this.at) / 1000) * GUEST_RATE);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
