// The messages the co-op relay passes between games (D-056, D-077). The relay only routes them: it never
// reads a game's commands. Joining players talk to the host; the host talks to everyone. The host
// stamps each command with the tick it applies on and sends it out to every game, its own included.

/** Players in one game, the host included. */
export const MAX_PLAYERS = 4;
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
 * What a room remembers about its host while it's open, so the host can come back after a dropped
 * connection: the secret it opened the room with, and its version.
 */
export interface RoomHost {
  key: string;
  version: string;
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
  | { t: 'closed'; reason: 'host-left' }
  /** The host's connection dropped: the room waits HOST_GRACE_MS for it (D-081). It's back with `joined` slot 0. */
  | { t: 'host-away' };

export type RefuseReason = 'version' | 'full' | 'no-room' | 'taken' | 'bad-request';

/** From the host to the relay: `data` goes to one guest (`to`), or to every guest. */
export interface HostSend {
  to?: number;
  data: string;
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
