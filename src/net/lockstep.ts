// Co-op lockstep, game side (D-056, D-077, D-078). Every game runs the same simulation; only commands
// travel. The host stamps each command with a tick a few steps ahead of its own and sends it out to
// every game in turns; a guest runs a tick only once the host has run it, so guests trail the host by
// the time turns take to arrive, and a command reaches them before its tick does. Nothing
// here touches the DOM or a socket: the host and guest send text through a function they're given, so
// two games can be wired together in a unit test.

import { BLUEPRINT_BY_ID, BUILDINGS, ITEMS, RECIPE_BY_ID, RESEARCH_BY_ID } from '../sim/data';
import { type Command, PASTE_MAX } from '../sim/commands';
import { LoggedCommand, Session, summaryHash } from '../sim/session';
import { MAX_GUEST_MESSAGE, MAX_HOST_MESSAGE } from './protocol';

/** Ticks between the host stamping a command and every game applying it (150 ms). */
export const INPUT_DELAY = 3;
/** The host sends turns at most this often (ms): 20 a second at most, a few commands each. */
export const FLUSH_MS = 45;
/**
 * The most command text one turn carries. A turn travels as text inside the relay's message, escaped a
 * second time, and the relay closes a host that sends more than MAX_HOST_MESSAGE; a host tab that stalled
 * while guests kept sending can have far more waiting, so it goes out over several turns.
 */
export const TURN_BUDGET = MAX_HOST_MESSAGE / 4;
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
/**
 * Every other command, from each guest: the host sends each one on to every game, so one guest
 * flooding them would load everyone. Generous for real play: a long belt drag is a few hundred at once.
 */
export const COMMAND_RATE = 100;
export const COMMAND_BURST = 400;
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
  'clear-belts': ['id'],
  paste: ['x', 'y'],
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
  if (o.kind === 'paste' && !(Array.isArray(o.items) && o.items.length <= PASTE_MAX && o.items.every(validPasteItem))) return false;
  return true;
}

/** Fields a command can have, and a paste's buildings: anything else a guest sends is left out. */
const COMMAND_FIELDS = ['kind', 'type', 'x', 'y', 'dir', 'id', 'replaceBelt', 'recipe', 'item', 'side', 'on', 'dx', 'dy'] as const;
const PASTE_FIELDS = ['type', 'dx', 'dy', 'dir', 'recipe', 'filter', 'side'] as const;

function pick(o: object, keys: readonly string[]): Record<string, unknown> {
  const from = o as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (from[k] !== undefined) out[k] = from[k];
  return out;
}

/** A guest's command with only the fields commands have. */
export function commandFields(c: Command): Command {
  const out = pick(c, COMMAND_FIELDS);
  if (c.kind === 'paste') out.items = c.items.map((it) => pick(it, PASTE_FIELDS));
  return out as Command;
}

/** One building of a paste (D-144), checked like a place command and the settings commands. */
function validPasteItem(it: unknown): boolean {
  if (!it || typeof it !== 'object') return false;
  const o = it as Record<string, unknown>;
  if (!(typeof o.type === 'string' && Object.hasOwn(BUILDINGS, o.type) && o.type !== 'hub')) return false;
  if (![o.dx, o.dy].every((n) => Number.isInteger(n) && Math.abs(n as number) <= 256)) return false;
  if (!(Number.isInteger(o.dir) && (o.dir as number) >= 0 && (o.dir as number) <= 3)) return false;
  if (o.recipe != null && !(typeof o.recipe === 'string' && Object.hasOwn(RECIPE_BY_ID, o.recipe))) return false;
  if (o.filter != null && !(typeof o.filter === 'string' && Object.hasOwn(ITEMS, o.filter))) return false;
  if (o.side !== undefined && o.side !== 'left' && o.side !== 'right') return false;
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
  private commands = new Map<number, [number, number]>();
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
    for (const c of msg.cmds) {
      if (!validCommand(c)) continue;
      if (WALKING.includes(c.kind) ? !this.mayWalk(player, now) : !this.allow(this.commands, player, now, COMMAND_RATE, COMMAND_BURST)) continue;
      // Applied as every guest will get it: only the fields commands have (nothing extra passed on to
      // everyone), and through JSON, which writes -0 as 0 (a -0 kept here would make this world differ from
      // every other, for good).
      this.submit(player, JSON.parse(JSON.stringify(commandFields(c))) as Command);
    }
  }

  /** Whether a guest may send its engineer walking once more now (a token bucket, see WALKING). */
  private mayWalk(player: number, now: number): boolean {
    return this.allow(this.walks, player, now, WALK_RATE, WALK_RATE * 2);
  }

  /** A token bucket per guest: `rate` a second on average, `burst` at most at once. */
  private allow(buckets: Map<number, [number, number]>, player: number, now: number, rate: number, burst: number): boolean {
    const [tokens, at] = buckets.get(player) ?? [burst, now];
    const left = Math.min(burst, tokens + ((now - at) / 1000) * rate);
    if (left < 1) {
      buckets.set(player, [left, now]);
      return false;
    }
    buckets.set(player, [left - 1, now]);
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
    // Every turn but the last leaves `through` where it was: guests run no further until they have it all.
    const parts = chunks(this.pending, TURN_BUDGET);
    parts.forEach((cmds, i) => {
      const last = i === parts.length - 1;
      this.send(
        last ? { t: 'turn', seq: ++this.seq, through, speed, cmds, hashes: this.hashes, pings } : { t: 'turn', seq: ++this.seq, through: this.sentThrough, speed: this.sentSpeed, cmds, hashes: [] },
      );
    });
    this.pings = [];
    this.pending = [];
    this.hashes = [];
    this.sentThrough = through;
    this.sentSpeed = speed;
    this.lastFlush = now;
  }
}

/**
 * Whether every string and key in a value from the host is a plain name (letters, digits, `_`, `-`, `.`,
 * `:`): every id, recipe, item and mode in a game is one. A guest takes nothing else from a host, so no
 * markup a modified host might slip into its world or its commands can reach this player's screen,
 * wherever the interface shows a value.
 */
export function plainData(value: unknown): boolean {
  const PLAIN = /^[\w.:-]*$/;
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') {
      if (!PLAIN.test(v)) return false;
    } else if (Array.isArray(v)) {
      for (const x of v) stack.push(x);
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (!PLAIN.test(k)) return false;
        stack.push(x);
      }
    }
  }
  return true;
}

/** Commands split into runs of at most `budget` characters of JSON each (always at least one run). */
function chunks(cmds: LoggedCommand[], budget: number): LoggedCommand[][] {
  const out: LoggedCommand[][] = [[]];
  let size = 0;
  for (const c of cmds) {
    const n = JSON.stringify(c).length + 1;
    if (out[out.length - 1].length && size + n > budget) {
      out.push([]);
      size = 0;
    }
    out[out.length - 1].push(c);
    size += n;
  }
  return out;
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
  /**
   * A turn never arrived (the relay drops them while this game is disconnected). Running past it would
   * skip its commands, so this game stops at the gap and asks for a fresh copy instead.
   */
  missed = false;
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
    if (msg.t !== 'turn' || msg.seq <= this.seq || this.missed) return;
    // A turn that isn't plain data is left out: the gap it leaves gets this game a fresh copy (also checked).
    if (!plainData(msg)) return;
    if (msg.seq !== this.seq + 1) {
      this.missed = true;
      return;
    }
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
    if (this.resyncing || (this.desyncedAt == null && !this.missed && this.ahead < FAR_BEHIND)) return;
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
   * Sends waiting commands: one message, well under the relay's size limit, at most about 20 times a
   * second (the relay allows a guest 30, and closes a guest that sends more). What doesn't fit waits
   * for the next flush, so a big paste goes out over a few seconds instead of all at once.
   */
  flush(now: number): void {
    if (!this.out.length || now - this.lastSend < FLUSH_MS) return;
    const cmds: Command[] = [];
    let size = 0;
    while (this.out.length && (cmds.length === 0 || size + JSON.stringify(this.out[0]).length < MAX_GUEST_MESSAGE / 2)) {
      size += JSON.stringify(this.out[0]).length + 1;
      cmds.push(this.out.shift()!);
    }
    this.send(JSON.stringify({ t: 'cmds', cmds } satisfies GuestMessage));
    this.lastSend = now;
  }
}
