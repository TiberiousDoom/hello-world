// The messages the co-op relay passes between games (D-056, D-077). The relay only routes them: it never
// reads a game's commands. Joining players talk to the host; the host talks to everyone. The host
// stamps each command with the tick it applies on and sends it out to every game, its own included.

/** Players in one game, the host included (D-083: 10, so a group of friends fits in one room). */
export const MAX_PLAYERS = 10;
/** Room codes: 6 letters and digits, without ones that are easy to mix up (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
/** The largest message a joining player may send (a command or two), and the host (a snapshot). */
export const MAX_GUEST_MESSAGE = 4 * 1024;
export const MAX_HOST_MESSAGE = 1024 * 1024;
/** Messages a joining player may send each second, on average. */
export const GUEST_RATE = 30;
/** How long a room waits for a host whose connection dropped before it closes (D-081). */
export const HOST_GRACE_MS = 60_000;
/** The close code a host leaving on purpose uses; any other ends its connection by accident. */
export const CLOSE_LEAVING = 1000;
/**
 * A host's heartbeat, and the relay's answer (D-085). A connection can die without closing (a router
 * restarting, a new IP address): nothing arrives, and nothing says so. The host sends this every few
 * seconds and takes a missing answer for a dead connection. The relay answers it without waking the room
 * (Cloudflare's WebSocket auto-response). It's a valid host message that goes to nobody, so a relay
 * from before heartbeats passes it on harmlessly and never answers, and the host then doesn't rely on it.
 */
export const HEARTBEAT = JSON.stringify({ to: -1, data: '' });
export const HEARTBEAT_REPLY = JSON.stringify({ t: 'heartbeat' });

/**
 * What a room remembers about its host while it's open, so the host can come back after a dropped
 * connection: the secret it opened the room with, and its version.
 */
export interface RoomHost {
  key: string;
  version: string;
  /** The room's password, hashed (`passHash`): guests must give the same to come in (D-140). */
  pass?: string;
}

export type Role = 'host' | 'guest';

/** From the relay to a game. */
export type RelayMessage =
  /** You're in: your slot (the host is 0), and the slots of everyone in the room. */
  | { t: 'welcome'; slot: number; players: number[] }
  | { t: 'joined'; slot: number }
  | { t: 'left'; slot: number }
  /** A guest's message, passed to the host. */
  | { t: 'from'; slot: number; data: string }
  /** The host's message, passed to a guest. */
  | { t: 'host'; data: string }
  /** Not let in, or the room has closed; the connection closes after this. */
  | { t: 'refused'; reason: RefuseReason; hostVersion?: string }
  /** `replaced`: the host came back on a new connection while this one still looked open (D-085). */
  | { t: 'closed'; reason: 'host-left' | 'replaced' }
  /** The answer to a host's HEARTBEAT. */
  | { t: 'heartbeat' }
  /** The host's connection dropped: the room waits HOST_GRACE_MS for it (D-081). It's back with `joined` slot 0. */
  | { t: 'host-away' };

/** A player's slot: the host is 0. */
const validSlot = (s: unknown): s is number => Number.isInteger(s) && (s as number) >= 0 && (s as number) < MAX_PLAYERS;

/**
 * Whether a message from the relay has the shape the game expects. The relay is picked by the page's
 * address (`?relay=`), so a link can point a game at any server: its slots end up in the page, and must
 * be small whole numbers, never text.
 */
export function validRelayMessage(m: unknown): m is RelayMessage {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'welcome':
      return validSlot(o.slot) && Array.isArray(o.players) && o.players.length <= MAX_PLAYERS && o.players.every(validSlot);
    case 'joined':
    case 'left':
      return validSlot(o.slot);
    case 'from':
      return validSlot(o.slot) && typeof o.data === 'string';
    case 'host':
      return typeof o.data === 'string';
    case 'refused':
      return typeof o.reason === 'string' && (o.hostVersion === undefined || typeof o.hostVersion === 'string');
    case 'closed':
      return o.reason === 'host-left' || o.reason === 'replaced';
    case 'heartbeat':
    case 'host-away':
      return true;
    default:
      return false;
  }
}

export type RefuseReason = 'version' | 'full' | 'no-room' | 'taken' | 'bad-request' | 'password';

/** From the host to the relay: `data` goes to one guest (`to`), or to every guest. */
export interface HostSend {
  to?: number;
  data: string;
  /** The room's info for the Play together screen (D-086), kept by the relay while the host is in. */
  info?: RoomInfo;
}

/**
 * What a dedicated server says about itself on the Play together screen (D-086): a name, and where
 * its game is (the day and season). Small, and checked by the relay (`cleanInfo`).
 */
export interface RoomInfo {
  name?: string;
  day?: number;
  season?: string;
}

/** A room as the relay reports it at /rooms/<code>/status (D-086), for the Play together screen. */
export interface RoomStatus {
  /** Its host is in. */
  open: boolean;
  /** Its host's connection dropped and the room is waiting for it (D-081). */
  away: boolean;
  /** The host's version, which players must match. */
  version: string | null;
  /** Players in it, the host left out. */
  players: number;
  /** Players it holds, the host included. */
  max: number;
  info: RoomInfo | null;
}

/**
 * A host message setting its room's info: a valid host message that goes to nobody, so a relay from
 * before room info passes it on harmlessly (as with HEARTBEAT).
 */
export function infoMessage(info: RoomInfo): string {
  return JSON.stringify({ to: -1, data: '', info } satisfies HostSend);
}

/** Whether a room code is well formed. */
export function validCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** A new room code from random bytes (crypto.getRandomValues in a browser). */
export function makeCode(random: Uint8Array): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[random[i] % CODE_ALPHABET.length];
  return code;
}

/** SHA-256 of some text, as hex (crypto.subtle: in browsers, Node and Cloudflare Workers alike). */
export async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A room's password as it travels (D-140): hashed with the room's code, so the relay never sees the
 * password itself and the same password gives a different hash in another room. Empty for none.
 */
export async function passHash(code: string, password: string): Promise<string> {
  return password ? sha256(`foundry-front:${code}:${password}`) : '';
}

/**
 * Reserved rooms (D-140), as the relay's RESERVED_ROOMS secret holds them: "CODE:sha256-of-key", comma
 * separated. Only a host whose key hashes to that may open the code, so nobody else can take the
 * dedicated server's room while it's down. Returns the hash for `code`, if it's reserved.
 */
export function reservedHash(reserved: string | undefined, code: string): string | undefined {
  for (const entry of (reserved ?? '').split(',')) {
    const [c, hash] = entry.trim().split(':');
    if (c === code && hash) return hash.toLowerCase();
  }
  return undefined;
}
