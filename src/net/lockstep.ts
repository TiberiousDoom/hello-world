// Co-op lockstep, game side (D-056, D-077, D-078). Every game runs the same simulation; only commands
// travel. The host stamps each command with a tick a few steps ahead of its own and sends it out to
// every game in turns; a guest runs a tick only once the host has run it, so guests trail the host by
// the time turns take to arrive, and a command reaches them before its tick does. Nothing
// here touches the DOM or a socket: the host and guest send text through a function they're given, so
// two games can be wired together in a unit test.

import { BUILDINGS, ITEMS, RECIPE_BY_ID } from '../sim/data';
import type { Command } from '../sim/commands';
import { LoggedCommand, Session, summaryHash } from '../sim/session';
import { MAX_GUEST_MESSAGE } from './protocol';

/** Ticks between the host stamping a command and every game applying it (150 ms). */
export const INPUT_DELAY = 3;
/** The host sends turns at most this often (ms): 20 a second at most, a few commands each. */
export const FLUSH_MS = 45;
/** The host fingerprints its game every this many ticks (once a second) so guests can check theirs. */
export const HASH_EVERY = 20;
/** A guest this many ticks behind the host catches up faster than real time. */
export const CATCH_UP = INPUT_DELAY * 3;

/** From the host to a guest. */
export type HostMessage =
  /** The game begins: your engineer's slot, and the world as the host's session began (packed, see pack.ts). */
  | { t: 'start'; slot: number; world: string }
  /**
   * Every command stamped since the last turn, and how far a guest may now run: every tick before
   * `through`, the ticks the host has run. Also the host's game speed (it alone sets it) and its
   * fingerprints, as [tick, hash].
   */
  | { t: 'turn'; through: number; speed: number; cmds: LoggedCommand[]; hashes: [number, string][] };

/** From a guest to the host. */
export type GuestMessage = { t: 'cmds'; cmds: Command[] };

/**
 * Command kinds a guest may send (not the host's own bookkeeping: checkpoints, adding engineers), and
 * the whole numbers each must carry.
 */
const GUEST_KINDS: Record<string, string[]> = {
  place: ['x', 'y', 'dir'],
  demolish: ['id'],
  rotate: ['id'],
  turn: ['x', 'y', 'dir'],
  recipe: ['id'],
  filter: ['id'],
  'splitter-side': ['id'],
  research: [],
  'pause-research': [],
  'upgrade-belts': ['x', 'y'],
  launch: [],
  'pick-blueprint': [],
  mine: ['x', 'y'],
  collect: ['id'],
  drop: ['id'],
  move: ['x', 'y'],
  walk: ['dx', 'dy'],
};

/**
 * Whether something a guest sent looks like a command every game can apply without throwing. The
 * rules refuse what isn't allowed; this only keeps out what isn't a command at all.
 */
export function validCommand(c: unknown): c is Command {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  const ints = typeof o.kind === 'string' && Object.hasOwn(GUEST_KINDS, o.kind) ? GUEST_KINDS[o.kind] : null;
  if (!ints || !ints.every((k) => Number.isInteger(o[k]))) return false;
  if (o.dir !== undefined && !(Number.isInteger(o.dir) && (o.dir as number) >= 0 && (o.dir as number) <= 3)) return false;
  if ((o.kind === 'place' || o.kind === 'turn') && !(typeof o.type === 'string' && Object.hasOwn(BUILDINGS, o.type) && o.type !== 'hub')) return false;
  if ((o.kind === 'research' || o.kind === 'pick-blueprint') && typeof o.id !== 'string') return false;
  // Values the rules store without looking them up: an unknown one would break every game later.
  if (o.kind === 'recipe' && o.recipe !== null && !(typeof o.recipe === 'string' && Object.hasOwn(RECIPE_BY_ID, o.recipe))) return false;
  if (o.kind === 'filter' && o.item !== null && !(typeof o.item === 'string' && Object.hasOwn(ITEMS, o.item))) return false;
  if (o.kind === 'splitter-side' && o.side !== 'left' && o.side !== 'right') return false;
  return true;
}

/** The host's side: stamps commands, applies them on their tick, and sends them out in turns. */
export class HostLockstep {
  private pending: LoggedCommand[] = [];
  private hashes: [number, string][] = [];
  private sentThrough = -1;
  private sentSpeed = -1;
  private lastFlush = -Infinity;

  constructor(
    readonly session: Session,
    /** Sends a message to every guest. */
    private send: (message: HostMessage) => void,
  ) {}

  /** A command from player `player` (the host is 0): it applies INPUT_DELAY ticks from now, in every game. */
  submit(player: number, command: Command): void {
    const entry: LoggedCommand = { tick: this.session.ticks + INPUT_DELAY, player, command };
    this.pending.push(entry);
    this.session.queue([entry]);
  }

  /** A guest's message, passed on by the relay. Anything that isn't a list of commands is ignored. */
  receive(player: number, data: string): void {
    let msg: GuestMessage;
    try {
      msg = JSON.parse(data) as GuestMessage;
    } catch {
      return;
    }
    if (msg?.t !== 'cmds' || !Array.isArray(msg.cmds)) return;
    for (const c of msg.cmds) if (validCommand(c)) this.submit(player, c);
  }

  /** Runs one tick, noting a fingerprint every HASH_EVERY ticks. */
  tick(): void {
    this.session.tick();
    const t = this.session.ticks;
    if (t % HASH_EVERY === 0) this.hashes.push([t, summaryHash(this.session.world)]);
  }

  /**
   * Sends a turn if anything changed and the last one went out long enough ago. Every command stamped
   * so far goes with it; all are due after `through`, so a guest that may run up to it has them all.
   */
  flush(speed: number, now: number): void {
    const through = this.session.ticks;
    if (!this.pending.length && through === this.sentThrough && speed === this.sentSpeed) return;
    if (now - this.lastFlush < FLUSH_MS) return;
    this.send({ t: 'turn', through, speed, cmds: this.pending, hashes: this.hashes });
    this.pending = [];
    this.hashes = [];
    this.sentThrough = through;
    this.sentSpeed = speed;
    this.lastFlush = now;
  }
}

/** A guest's side: sends its commands to the host, and runs ticks only as far as the host's turns allow. */
export class GuestLockstep {
  /** Ticks before this one may run. */
  through: number;
  /** The host's game speed. */
  speed = 1;
  /** Set once this game's fingerprint differs from the host's: the games no longer agree. */
  desyncedAt: number | null = null;
  private out: Command[] = [];
  private expected = new Map<number, string>();
  private lastSend = -Infinity;

  constructor(
    readonly session: Session,
    /** Sends text to the host. */
    private send: (data: string) => void,
  ) {
    this.through = session.ticks;
  }

  /** This player's command: it goes to the host, which says when it applies. */
  submit(command: Command): void {
    this.out.push(command);
  }

  /** A message from the host. */
  receive(msg: HostMessage): void {
    if (msg.t !== 'turn') return;
    this.session.queue(msg.cmds);
    this.through = Math.max(this.through, msg.through);
    this.speed = msg.speed;
    for (const [tick, hash] of msg.hashes) this.expected.set(tick, hash);
  }

  /** Whether the host has said what happens on the next tick. */
  get canTick(): boolean {
    return this.session.ticks < this.through;
  }

  /** How many ticks this game may run before it waits for the host. */
  get ahead(): number {
    return this.through - this.session.ticks;
  }

  /** Runs one tick (when allowed), and checks the host's fingerprint for it if there is one. */
  tick(): void {
    if (!this.canTick) return;
    this.session.tick();
    const t = this.session.ticks;
    const hash = this.expected.get(t);
    if (hash == null) return;
    this.expected.delete(t);
    if (this.desyncedAt == null && hash !== summaryHash(this.session.world)) this.desyncedAt = t;
  }

  /**
   * Sends waiting commands, a few at a time, at most about 20 messages a second (the relay allows a
   * guest 30), each well under the relay's size limit.
   */
  flush(now: number): void {
    if (!this.out.length || now - this.lastSend < FLUSH_MS) return;
    while (this.out.length) {
      const cmds: Command[] = [];
      let size = 0;
      while (this.out.length && (cmds.length === 0 || size + JSON.stringify(this.out[0]).length < MAX_GUEST_MESSAGE / 2)) {
        size += JSON.stringify(this.out[0]).length + 1;
        cmds.push(this.out.shift()!);
      }
      this.send(JSON.stringify({ t: 'cmds', cmds } satisfies GuestMessage));
    }
    this.lastSend = now;
  }
}
