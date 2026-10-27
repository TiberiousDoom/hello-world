// Co-op lockstep, game side (D-056, D-077, D-078). Every game runs the same simulation; only commands
// travel. The host stamps each command with a tick a few steps ahead of its own and sends it out to
// every game in turns; a guest runs a tick only once the host has run it, so guests trail the host by
// the time turns take to arrive, and a command reaches them before its tick does. Nothing
// here touches the DOM or a socket: the host and guest send text through a function they're given, so
// two games can be wired together in a unit test.

import { BLUEPRINT_BY_ID, BUILDINGS, ITEMS, RECIPE_BY_ID, RESEARCH_BY_ID } from '../sim/data';
import type { Command } from '../sim/commands';
import { LoggedCommand, Session, summaryHash } from '../sim/session';
import { MAX_GUEST_MESSAGE } from './protocol';

/** Ticks between the host stamping a command and every game applying it (150 ms). */
export const INPUT_DELAY = 3;
/** The host sends turns at most this often (ms): 20 a second at most, a few commands each. */
export const FLUSH_MS = 45;
/**
 * The host sends a turn at least this often (ms), even paused with nothing new, so a guest that hears
 * nothing for a while knows its connection is gone (D-081).
 */
export const KEEPALIVE_MS = 5000;
/** The host fingerprints its game every this many ticks (once a second) so guests can check theirs. */
export const HASH_EVERY = 20;
/** A guest this many ticks behind the host catches up faster than real time. */
export const CATCH_UP = INPUT_DELAY * 3;
/**
 * A guest this far behind (20 s: a phone that slept, a tab in the background) asks for a fresh copy of
 * the game instead of running every tick it missed (D-079).
 */
export const FAR_BEHIND = 400;
/**
 * Commands that send an engineer walking: each finds a path, which can take tens of milliseconds in
 * every game. A player taps for them one at a time, so the host takes at most WALK_RATE a second from
 * each guest (bursts of twice that) and drops the rest: one guest can't stall everyone's game.
 */
export const WALKING: readonly string[] = ['move', 'mine', 'collect', 'drop', 'pickup'];
export const WALK_RATE = 5;
/** Commands the host stamps for itself (adding engineers, checkpoints): first on their tick. */
export const BOOKKEEPING = -1;

/** A copy of the host's game for one guest: its first, or a fresh one (D-079). */
export interface Snapshot {
  /** The world just before tick `tick` (a save, as JSON; packed before it travels). */
  world: string;
  /** Turns sent so far: the guest ignores those, since `cmds` holds what it needs from them. */
  seq: number;
  /** Commands already sent that are due on or after the snapshot's tick. */
  cmds: LoggedCommand[];
  speed: number;
}

/** From the host to a guest. */
export type HostMessage =
  /**
   * Your game begins, or begins again from a fresh copy: your engineer's slot, and a snapshot whose
   * world is packed (see pack.ts).
   */
  | ({ t: 'start'; slot: number } & Snapshot)
  /**
   * Every command stamped since the last turn, and how far a guest may now run: every tick before
   * `through`, the ticks the host has run. Also the host's game speed (it alone sets it) and its
   * fingerprints, as [tick, hash].
   */
  | { t: 'turn'; seq: number; through: number; speed: number; cmds: LoggedCommand[]; hashes: [number, string][]; pings?: [number, number, number][] };

/**
 * From a guest to the host: its commands, a request for a fresh copy of the game, or a ping. Pings
 * (D-080) aren't commands: they change nothing in the world, so they travel beside the lockstep and
 * show as soon as they arrive.
 */
export type GuestMessage = { t: 'cmds'; cmds: Command[] } | { t: 'resync' } | { t: 'ping'; x: number; y: number };

/**
 * Command kinds a guest may send (not the host's own bookkeeping: checkpoints, adding engineers), and
 * the whole numbers each must carry.
 */
const GUEST_KINDS: Record<string, string[]> = {
  place: ['x', 'y', 'dir'],
  demolish: ['id'],
  rotate: ['id'],
  relocate: ['id', 'x', 'y', 'dir'],
  turn: ['x', 'y', 'dir'],
  recipe: ['id'],
  filter: ['id'],
  'splitter-side': ['id'],
  research: [],
  'pause-research': [],
  'upgrade-belts': ['x', 'y'],
  upgrade: ['id'],
  launch: [],
  strike: ['id', 'x', 'y'],
  'pick-blueprint': [],
  mine: ['x', 'y'],
  collect: ['id'],
  drop: ['id'],
  pickup: ['id'],
  'auto-drop': [],
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
  if (o.kind === 'research' && !(typeof o.id === 'string' && Object.hasOwn(RESEARCH_BY_ID, o.id))) return false;
  if (o.kind === 'pick-blueprint' && !(typeof o.id === 'string' && Object.hasOwn(BLUEPRINT_BY_ID, o.id))) return false;
  // Values the rules store without looking them up: an unknown one would break every game later.
  if (o.kind === 'recipe' && o.recipe !== null && !(typeof o.recipe === 'string' && Object.hasOwn(RECIPE_BY_ID, o.recipe))) return false;
  if (o.kind === 'filter' && o.item !== null && !(typeof o.item === 'string' && Object.hasOwn(ITEMS, o.item))) return false;
  if (o.kind === 'splitter-side' && o.side !== 'left' && o.side !== 'right') return false;
  if (o.kind === 'auto-drop' && typeof o.on !== 'boolean') return false;
  return true;
}

/** The host's side: stamps commands, applies them on their tick, and sends them out in turns. */
export class HostLockstep {
  private pending: LoggedCommand[] = [];
  private hashes: [number, string][] = [];
  private sentThrough = -1;
  private sentSpeed = -1;
  private lastFlush = -Infinity;
  /** Turns sent so far. */
  private seq = 0;
  /** Pings to send with the next turn, as [player, x, y]. */
  private pings: [number, number, number][] = [];
  /** Each guest's allowance of walking commands, as [tokens, at (ms)]. */
  private walks = new Map<number, [number, number]>();
  /** Shows a ping from any player, the host's own included. */
  onPing: (player: number, x: number, y: number) => void = () => {};

  constructor(
    readonly session: Session,
    /** Sends a message to every guest. */
    private send: (message: HostMessage) => void,
    /** A guest asked for a fresh copy of the game. */
    private onResync: (player: number) => void = () => {},
  ) {}

  /** A command from player `player` (the host is 0): it applies INPUT_DELAY ticks from now, in every game. */
  submit(player: number, command: Command): void {
    this.stamp({ tick: this.session.ticks + INPUT_DELAY, player, command });
  }

  /**
   * A copy of the game for a player joining (who gets an engineer, unless their slot has one) or a
   * guest that fell out of step or far behind (D-079). It's the world as it is now, before the host's
   * next tick. Every game runs a checkpoint first thing on that tick, so their path fields match the
   * copy's, which rebuilds them on loading (D-058). No game has run that tick yet (guests run only
   * the ticks the host has), so it can be stamped for it rather than a few ticks ahead.
   */
  snapshot(slot: number, joining: boolean): Snapshot {
    const tick = this.session.ticks;
    // Commands already sent that the copy still needs; the rest go out in the next turn as usual.
    const sent = this.session.queuedFrom(tick).filter((e) => !this.pending.includes(e));
    if (joining) this.stamp({ tick, player: BOOKKEEPING, command: { kind: 'add-player', id: slot } });
    this.stamp({ tick, player: BOOKKEEPING, command: { kind: 'checkpoint' } });
    return { world: this.session.world.toJSON(), seq: this.seq, cmds: sent, speed: Math.max(0, this.sentSpeed) };
  }

  /** The host's own bookkeeping in every game, such as sending a departed player's engineer home. */
  bookkeeping(command: Command): void {
    this.stamp({ tick: this.session.ticks + INPUT_DELAY, player: BOOKKEEPING, command });
  }

  /** Player `player` points at tile (x, y): shown here, and to every guest with the next turn. */
  ping(player: number, x: number, y: number): void {
    const w = this.session.world;
    if (!w.inBounds(x, y)) return;
    this.pings.push([player, x, y]);
    this.onPing(player, x, y);
  }

  private stamp(entry: LoggedCommand): void {
    this.pending.push(entry);
    this.session.queue([entry]);
  }

  /** A guest's message, passed on by the relay. Anything that isn't a list of commands is ignored. */
  receive(player: number, data: string, now = performance.now()): void {
    let msg: GuestMessage;
    try {
      msg = JSON.parse(data) as GuestMessage;
    } catch {
      return;
    }
    if (msg?.t === 'resync') return this.onResync(player);
    if (msg?.t === 'ping') {
      if (Number.isInteger(msg.x) && Number.isInteger(msg.y)) this.ping(player, msg.x, msg.y);
      return;
    }
    if (msg?.t !== 'cmds' || !Array.isArray(msg.cmds)) return;
    for (const c of msg.cmds) if (validCommand(c) && (!WALKING.includes(c.kind) || this.mayWalk(player, now))) this.submit(player, c);
  }

  /** Whether a guest may send its engineer walking once more now (a token bucket, see WALKING). */
  private mayWalk(player: number, now: number): boolean {
    const [tokens, at] = this.walks.get(player) ?? [WALK_RATE * 2, now];
    const left = Math.min(WALK_RATE * 2, tokens + ((now - at) / 1000) * WALK_RATE);
    if (left < 1) {
      this.walks.set(player, [left, now]);
      return false;
    }
    this.walks.set(player, [left - 1, now]);
    return true;
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
    const quiet = !this.pending.length && !this.pings.length && through === this.sentThrough && speed === this.sentSpeed;
    if (quiet && now - this.lastFlush < KEEPALIVE_MS) return;
    if (now - this.lastFlush < FLUSH_MS) return;
    const pings = this.pings.length ? this.pings : undefined;
    this.send({ t: 'turn', seq: ++this.seq, through, speed, cmds: this.pending, hashes: this.hashes, pings });
    this.pings = [];
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
  /** A fresh copy of the game has been asked for (D-079). */
  resyncing = false;
  private out: Command[] = [];
  private expected = new Map<number, string>();
  private lastSend = -Infinity;
  /** The last turn taken in: a fresh copy already holds what earlier turns said. */
  private seq: number;

  constructor(
    readonly session: Session,
    /** Sends text to the host. */
    private send: (data: string) => void,
    /** Where this game began: a snapshot's turn count and the commands it came with. */
    start: { seq: number; cmds: LoggedCommand[]; speed: number } = { seq: 0, cmds: [], speed: 1 },
  ) {
    this.through = session.ticks;
    this.seq = start.seq;
    this.speed = start.speed;
    this.session.queue(start.cmds);
  }

  /** This player's command: it goes to the host, which says when it applies. */
  submit(command: Command): void {
    this.out.push(command);
  }

  /** This player points at tile (x, y): straight to the host, which passes it on to everyone (D-080). */
  ping(x: number, y: number): void {
    this.send(JSON.stringify({ t: 'ping', x, y } satisfies GuestMessage));
  }

  /** A message from the host. */
  receive(msg: HostMessage): void {
    if (msg.t !== 'turn' || msg.seq <= this.seq) return;
    this.seq = msg.seq;
    const now = this.session.ticks;
    this.session.queue(msg.cmds.filter((e) => e.tick >= now)); // earlier ones were in this game's snapshot
    this.through = Math.max(this.through, msg.through);
    this.speed = msg.speed;
    for (const [tick, hash] of msg.hashes) if (tick > now) this.expected.set(tick, hash);
  }

  /**
   * Asks the host for a fresh copy of the game, once: when it no longer matches the host's, or has
   * fallen far behind (D-079). The game carries on until the copy arrives.
   */
  checkHealth(): void {
    if (this.resyncing || (this.desyncedAt == null && this.ahead < FAR_BEHIND)) return;
    this.resyncing = true;
    this.send(JSON.stringify({ t: 'resync' } satisfies GuestMessage));
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
