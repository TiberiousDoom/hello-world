// A co-op room's rules, apart from Cloudflare's APIs so they can be unit tested (D-077). The Durable
// Object in relay/src/index.ts keeps each connection's details on the socket itself, so a room that sleeps
// between messages wakes up knowing who's in it.

import { CLOSE_LEAVING, GUEST_RATE, HEARTBEAT, HostSend, MAX_GUEST_MESSAGE, MAX_HOST_MESSAGE, MAX_PLAYERS, RefuseReason, RelayMessage, Role, RoomHost, RoomInfo, RoomStatus } from './protocol';

/** A connection in a room: who it is, and how to reach it. */
export interface Peer {
  slot: number;
  role: Role;
  version: string;
  /** A guest's own random key (#100), so that when it reconnects it takes back its slot. */
  key?: string;
  send(message: RelayMessage): void;
  close(code: number, reason: string): void;
}

/** Normal closure (1000), and a policy violation (1008) for a refusal or a broken rule. */
export const CLOSE_NORMAL = 1000;
export const CLOSE_POLICY = 1008;
/** An old connection, closed because its host (D-085) or guest (#100) came back on a new one. */
export const CLOSE_REPLACED = 4001;

/**
 * Who may join: the host into a new or empty room, a guest only into an open room, on the host's
 * version, while there's a free slot. A room whose host dropped out (`room`, D-081) stays open, and
 * only a host with its key may take it back, even while its old connection still looks open (D-085).
 * A guest back with its key while its old connection still looks open (a phone that slept) takes back
 * its own slot, instead of coming in as a new player (#100). Returns the new player's slot, or why not.
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
  if (role === 'host') {
    // A new room, or one with nobody in it: any host. A room with people in it (its host there, or away):
    // only its own host, with its key. The host's old connection may still look open when the host is
    // back on a new one (D-085); the new one takes over, and the old is closed (`retire`).
    if (!host && !(room && peers.length)) return { slot: 0 };
    return room && key && room.key === key ? { slot: 0 } : { refuse: 'taken' };
  }
  const hostVersion = host?.version ?? (peers.length ? room?.version : undefined);
  if (!hostVersion) return { refuse: 'no-room' };
  if (hostVersion !== version) return { refuse: 'version', hostVersion };
  const old = key ? peers.find((p) => p.role === 'guest' && p.key === key) : undefined;
  if (old) return { slot: old.slot };
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
export function route(peers: Peer[], from: Peer, raw: string | ArrayBuffer, onInfo?: (info: RoomInfo) => void): void {
  if (typeof raw !== 'string') return from.close(CLOSE_POLICY, 'text only');
  // The relay on Cloudflare answers heartbeats before they reach the room; this is for the local room.
  if (raw === HEARTBEAT) return from.send({ t: 'heartbeat' });
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
  if (msg.info !== undefined) {
    // The room's info (D-086): kept if it's well formed, otherwise ignored; never a reason to close.
    const info = cleanInfo(msg.info);
    if (info) onInfo?.(info);
  }
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

/**
 * A player is back on a new connection in `slot` (the host's is 0) while its old one still looks open
 * (D-085, #100): the old one is told, then closed. Returns it, for the caller to forget before welcoming
 * the new one, so that its closing later isn't taken for the player leaving.
 */
export function retire(peers: Peer[], slot = 0): Peer | undefined {
  const old = peers.find((p) => p.slot === slot);
  if (!old) return undefined;
  old.send({ t: 'closed', reason: 'replaced' });
  old.close(CLOSE_REPLACED, 'replaced');
  return old;
}

/**
 * A host's room info, if it's well formed (D-086): only the known fields, short, so it fits on the
 * host's socket (Cloudflare keeps at most 2 KB there) and on the screen.
 */
export function cleanInfo(raw: unknown): RoomInfo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const info: RoomInfo = {};
  if (typeof r.name === 'string' && r.name.trim()) info.name = r.name.trim().slice(0, 40);
  if (Number.isInteger(r.day) && (r.day as number) >= 1 && (r.day as number) < 1e7) info.day = r.day as number;
  if (typeof r.season === 'string' && r.season) info.season = r.season.slice(0, 12);
  return info;
}

/** What the relay says about a room (D-086): open, waiting for its host, or not there. */
export function status(peers: Peer[], room: RoomHost | null, info: RoomInfo | null): RoomStatus {
  const host = peers.find((p) => p.role === 'host');
  const away = !host && !!room && peers.length > 0;
  return {
    open: !!host,
    away,
    version: host?.version ?? (away ? room!.version : null),
    players: peers.filter((p) => p.role === 'guest').length,
    max: MAX_PLAYERS,
    info: host || away ? info : null,
  };
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
