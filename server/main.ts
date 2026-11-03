// The dedicated server (D-084): hosts co-op rooms around the clock, so friends can come and go without
// anyone keeping a browser open as host. Each room is a host like any other, run by Node instead of a
// page: the same Coop and lockstep code, connected to the same relay, with no screen. It keeps its rooms'
// codes and key on disk, so a restart takes them back, and saves each world every minute.
//
// Players can make more rooms on it (D-164), each with its own world: they ask its desk, a room that never
// starts a game, and its main room lists them for the Play together screen. Rooms nobody plays in for
// FOUNDRY_ROOM_DAYS are put away in the archive folder.
//
// Settings come from the environment (all optional):
//   FOUNDRY_DATA        where the rooms, the saves and their backups live (default: server-data/)
//   FOUNDRY_ROOM        the main room's code (6 letters and digits); without it one is made on first start and kept
//   FOUNDRY_RELAY       the relay (default: the one on Cloudflare; ws://localhost:8787 for `wrangler dev`)
//   FOUNDRY_ORIGIN      the page origin the relay lets in (default: the game on GitHub Pages)
//   FOUNDRY_PAUSE_EMPTY "0" keeps the games running with nobody in them (default: each paused until someone joins)
//   FOUNDRY_NAME        the main room's name on the Play together screen (default: none, shown as "Dedicated server")
//   FOUNDRY_PASSWORD    a password players must type to join, or to make a room (default: none) (D-140)
//   FOUNDRY_MAX_ROOMS   how many rooms players may make (default: 4; 0 turns it off)
//   FOUNDRY_ROOM_DAYS   days a made room may go unplayed before it's archived (default: 30)
//
// A connection that dies without closing (a router restarting, a new IP address) is noticed by the
// heartbeat in Coop (D-085): the server reconnects and the relay hands it the room.

import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { Coop } from '../src/net/coop';
import { RELAY_URL } from '../src/net/client';
import { DeskAsk, DeskReply, MAX_SERVER_ROOMS, RoomInfo, cleanAsk, makeCode, passHash, serverPrefix, sha256, validCode } from '../src/net/protocol';
import { clockAt } from '../src/sim/clock';
import { OldSaveError, TICK, World } from '../src/sim/world';

const env = process.env;
const DATA = env.FOUNDRY_DATA ?? 'server-data';
const RELAY = env.FOUNDRY_RELAY ?? RELAY_URL;
const ORIGIN = env.FOUNDRY_ORIGIN ?? 'https://tiberiousdoom.github.io';
const PAUSE_EMPTY = env.FOUNDRY_PAUSE_EMPTY !== '0';
const NAME = env.FOUNDRY_NAME?.trim() || undefined;
const PASSWORD = env.FOUNDRY_PASSWORD ?? '';
/** Rooms players may make, at most (the main room's list holds MAX_SERVER_ROOMS). */
const MAX_ROOMS = Math.max(0, Math.min(MAX_SERVER_ROOMS, Number(env.FOUNDRY_MAX_ROOMS ?? 4) || 0));
/** Days a made room may go without players before it's archived. */
const ROOM_DAYS = Math.max(1, Number(env.FOUNDRY_ROOM_DAYS ?? 30) || 30);
/** The game's version, which every player must match: package.json's, kept equal to the changelog's by a test. */
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** How often the worlds are saved (ms), and how many hourly backups each keeps. */
const SAVE_MS = 60_000;
const BACKUPS = 24;
/** How long a room waits before opening again after losing it (ms). */
const REOPEN_MS = 15_000;
/** How long it waits before trying again to start a game it couldn't send (too big for the relay) (ms). */
const RETRY_START_MS = 5 * 60_000;
/** The loop's beat (ms), and the most ticks a room runs in one beat when it falls behind. */
const BEAT_MS = 25;
const MAX_TICKS_PER_BEAT = 20;
/** How long a new room has to open before the desk gives up on it (ms). */
const MAKE_WAIT_MS = 15_000;
const DAY_MS = 24 * 3600_000;

const ROOM_FILE = join(DATA, 'room.json');
const STATUS_FILE = join(DATA, 'status.json');
/** Made rooms live in rooms/<code>/; archived ones in archive/<code>-<date>/. */
const ROOMS_DIR = join(DATA, 'rooms');
const ARCHIVE_DIR = join(DATA, 'archive');

function log(text: string): void {
  console.log(`${new Date().toISOString()} ${text}`);
}

/**
 * Why a connection to the relay ended, for the log: its WebSocket close code (1006: cut off with no goodbye,
 * as a network drop is; 1001 or 1012: the relay restarting) and how long it had lasted.
 */
function dropText(code: number | undefined, reason: string, ms: number): string {
  const lasted = ms < 120_000 ? `${Math.round(ms / 1000)} s` : ms < 2 * 3600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3600_000).toFixed(1)} h`;
  const why = code == null ? 'no answer to its heartbeat' : `close code ${code}${reason ? ` "${reason}"` : ''}`;
  return `connection to the relay ended after ${lasted} (${why}).`;
}

/** Writes a file whole or not at all: a crash mid-write leaves the old one. `mode`: its permissions. */
function writeAtomic(file: string, text: string, mode = 0o644): void {
  // Written in full and flushed to the disk before it takes the old file's place: a crash or power
  // cut leaves the old file or the new one, never a half-written one.
  const fd = openSync(`${file}.tmp`, 'w', mode);
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  chmodSync(`${file}.tmp`, mode); // openSync's mode only applies to a new file
  renameSync(`${file}.tmp`, file);
}

/**
 * Node's WebSocket sends no Origin, and the relay only lets in the game's own page (relay/src/index.ts).
 * The server says it's that page: the check keeps other websites off the relay, not other programs.
 */
const NodeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = class extends NodeWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, { protocols, headers: { Origin: ORIGIN } } as unknown as string[]);
  }
} as typeof WebSocket;

/** A new code with the server's prefix (D-164) that isn't one of `used`. */
function prefixedCode(prefix: string, used: Set<string>): string {
  for (;;) {
    const code = prefix + makeCode(crypto.getRandomValues(new Uint8Array(6))).slice(prefix.length);
    if (!used.has(code)) return code;
  }
}

/**
 * The main room's code, the desk's, and the key that hosts them all: the same every start, so players keep
 * one code and a restart gets the rooms back.
 */
function loadMain(): { code: string; key: string; desk: string } {
  let room: { code: string; key: string; desk?: string } | null = null;
  try {
    room = JSON.parse(readFileSync(ROOM_FILE, 'utf8')) as { code: string; key: string; desk?: string };
  } catch {
    // First start.
  }
  const code = (env.FOUNDRY_ROOM ?? room?.code ?? makeCode(crypto.getRandomValues(new Uint8Array(6)))).toUpperCase();
  if (!validCode(code)) throw new Error(`FOUNDRY_ROOM must be 6 letters and digits, without 0, O, 1, I or L (got "${code}").`);
  const key = room?.key ?? [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  // The desk shares the main room's prefix, so the same reservation covers it.
  const desk = room?.desk && serverPrefix(room.desk) === serverPrefix(code) && room.desk !== code ? room.desk : prefixedCode(serverPrefix(code), new Set([code]));
  // The key lets whoever holds it take the rooms (D-085): readable by the server's user alone.
  if (code !== room?.code || key !== room?.key || desk !== room?.desk) writeAtomic(ROOM_FILE, JSON.stringify({ code, key, desk }), 0o600);
  else chmodSync(ROOM_FILE, 0o600); // tighten one written before this rule
  return { code, key, desk };
}

/** The saved world in `file`, or a new one. A save too old to load is moved aside, not lost. */
function loadWorld(file: string, label: string): World {
  let json: string;
  try {
    json = readFileSync(file, 'utf8');
  } catch {
    log(`${label}: no saved world, starting a new one.`);
    return World.create(undefined, 'standard');
  }
  try {
    return World.fromJSON(json);
  } catch (err) {
    const aside = `${file}.unloadable-${Date.now()}`;
    renameSync(file, aside);
    log(`${label}: ${err instanceof OldSaveError ? 'the save is from an older version of the game' : `the save couldn't be loaded (${String(err)})`}. Moved it to ${aside} and started a new world.`);
    return World.create(undefined, 'standard');
  }
}

/** What a made room keeps about itself in its folder (rooms/<code>/room.json). */
interface MadeRoom {
  code: string;
  name: string;
  /** Its password, hashed with its code (passHash): the maker's, or the server's. Empty for none. */
  pass: string;
  /** When it was made, and when someone last played in it (ms since 1970). */
  made: number;
  usedAt: number;
  /** The SHA-256 of its maker's key (D-165): whoever gives that key may rename or delete it. None for rooms made before. */
  owner?: string;
}

/** One room and its world: the main room, or one players made. */
class Hosted {
  readonly coop = new Coop(RELAY, VERSION);
  world: World;
  private lastBackupHour = '';
  /** The world's game time when it was last saved: a paused world isn't written again and again. */
  private savedTime: number;
  /** No game is started before this time (ms): set after a start that failed, so it isn't retried at once. */
  private startAfter = 0;
  /** A start is under way. */
  private starting = false;
  private lastInfo = '';
  private lastPlayers = '';
  private acc = 0;
  /** It was put away: don't open it again. */
  closed = false;
  /** Called once when its game is up and running (a new room, so the desk can answer). */
  onReady: (() => void) | null = null;

  constructor(
    readonly code: string,
    /** Its folder: world.json and backups/. */
    readonly dir: string,
    private readonly key: string,
    private readonly pass: string,
    public name: string | undefined,
    /** Extra info for the Play together screen: the main room lists the made rooms (D-164). */
    private readonly extra: () => Pick<RoomInfo, 'rooms' | 'desk'> = () => ({}),
    /** Players came in: a made room remembers when it was last played. */
    private readonly onUsed: () => void = () => {},
  ) {
    mkdirSync(join(dir, 'backups'), { recursive: true });
    this.world = loadWorld(this.worldFile, `Room ${code}`);
    this.savedTime = this.world.state.time;
    const coop = this.coop;
    coop.headless = true; // the server plays no engineer of its own (#184)
    coop.onChange = () => {
      // The room is open: start the game at once, with whoever is in; everyone else joins it under way.
      if (coop.role === 'host' && coop.phase === 'lobby') void this.startGame();
      const players = this.guests()
        .map((s) => s + 1)
        .join(', ');
      if (players !== this.lastPlayers) {
        this.lastPlayers = players;
        log(`Room ${code}: ${players ? `players in: ${players}.` : 'nobody in.'}`);
        if (players) this.onUsed();
      }
      writeStatus();
    };
    coop.onStart = (session) => {
      this.world = session.world;
      this.lastInfo = '';
      this.publish();
      log(`Room ${code} is open.`);
      const ready = this.onReady;
      this.onReady = null;
      ready?.();
    };
    coop.onNotice = (text) => log(`Room ${code}: ${text}`);
    coop.onDrop = (closeCode, reason, ms) => log(`Room ${code}: ${dropText(closeCode, reason, ms)}`);
    coop.onEnd = (why, replaced) => {
      this.save(true);
      if (this.closed) return;
      if (replaced) {
        // Another server with this room's key (a second copy started by mistake) took the room. Taking it back
        // would only start a tug of war, so this one stays out until it's restarted (D-085).
        log(`Room ${code} taken over: ${why} Another server is using it and its key (${ROOM_FILE}). Stop one of them, then restart this one.`);
        return;
      }
      log(`Room ${code} closed: ${why} Opening it again in ${REOPEN_MS / 1000} s.`);
      setTimeout(() => !this.closed && void this.open(), REOPEN_MS);
    };
  }

  get worldFile(): string {
    return join(this.dir, 'world.json');
  }

  async open(): Promise<void> {
    log(`Opening room ${this.code}${this.name ? ` (${this.name})` : ''} on ${RELAY}${this.pass ? ', with a password' : ''}.`);
    this.coop.hostRoom(this.code, this.key, this.pass);
  }

  /** Puts it away: saved, and the room closed on the relay. */
  close(): void {
    this.closed = true;
    this.save(true);
    this.coop.leave();
  }

  /** Saves the world if it changed (`force`: always, when stopping), with an hourly backup. */
  save(force = false): void {
    if (!force && this.world.state.time === this.savedTime) return;
    try {
      const json = this.world.toJSON();
      writeAtomic(this.worldFile, json);
      this.savedTime = this.world.state.time;
      const backups = join(this.dir, 'backups');
      const hour = new Date().toISOString().slice(0, 13).replace('T', '-');
      if (hour !== this.lastBackupHour) {
        this.lastBackupHour = hour;
        writeAtomic(join(backups, `world-${hour}.json`), json);
        const old = readdirSync(backups)
          .filter((f) => f.startsWith('world-'))
          .sort()
          .slice(0, -BACKUPS);
        for (const f of old) rmSync(join(backups, f));
      }
    } catch (err) {
      log(`Room ${this.code}: could not save: ${String(err)}`);
    }
    // The session keeps every command for replays, which only tests use. A browser game lasts hours; the
    // server runs for weeks, so it lets them go once they're saved in the world.
    const session = this.coop.host?.session;
    if (session) session.log.length = 0;
  }

  /** Tells the Play together screen where the game is (D-086): sent when it changes, and with every save. */
  publish(): void {
    const clock = clockAt(this.world.state.time);
    const info = { name: this.name, day: clock.day, season: clock.season.name, ...this.extra() };
    if (JSON.stringify(info) === this.lastInfo && this.coop.phase === 'playing') return;
    this.lastInfo = JSON.stringify(info);
    this.coop.setInfo(info);
  }

  /** The slots of the players in the room, the server's own left out. */
  guests(): number[] {
    return this.coop.players.filter((s) => s !== 0);
  }

  /** Whether the game stands still: with nobody in, unless FOUNDRY_PAUSE_EMPTY=0. */
  paused(): boolean {
    return PAUSE_EMPTY && !this.guests().length;
  }

  /** Runs the game for `elapsed` seconds (none while paused), then sends the guests a turn. */
  beat(elapsed: number, now: number): void {
    const host = this.coop.host;
    if (!host) return;
    const speed = this.paused() ? 0 : 1;
    this.acc += elapsed * speed;
    let ticks = 0;
    while (this.acc >= TICK && ticks < MAX_TICKS_PER_BEAT) {
      host.tick();
      this.acc -= TICK;
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_BEAT) this.acc = 0;
    host.flush(speed, now);
  }

  /** Starts the game in the open room. One that can't be sent (a factory too big for the relay) waits a while. */
  private async startGame(): Promise<void> {
    // A failed start says so through onChange before it returns: don't begin another from in there.
    if (this.starting || Date.now() < this.startAfter) return;
    this.starting = true;
    try {
      await this.coop.start(this.world);
    } catch (err) {
      log(`Room ${this.code}: could not start the game: ${String(err)}`);
    } finally {
      this.starting = false;
    }
    if (this.coop.phase === 'lobby') {
      this.startAfter = Date.now() + RETRY_START_MS;
      log(`Room ${this.code}: the game didn't start; trying again in ${RETRY_START_MS / 60_000} minutes.`);
      setTimeout(() => this.coop.phase === 'lobby' && void this.startGame(), RETRY_START_MS);
    }
  }
}

mkdirSync(ROOMS_DIR, { recursive: true });
const main = loadMain();
const prefix = serverPrefix(main.code);

/** The rooms players made (D-164), by code, with what they keep about themselves. */
const made = new Map<string, { room: Hosted; meta: MadeRoom }>();

function metaFile(code: string): string {
  return join(ROOMS_DIR, code, 'room.json');
}

function saveMeta(meta: MadeRoom): void {
  try {
    writeAtomic(metaFile(meta.code), JSON.stringify(meta, null, 2), 0o600);
  } catch (err) {
    log(`Room ${meta.code}: could not save its details: ${String(err)}`);
  }
}

/** The main room's list of made rooms, for the Play together screen. */
function roomList(): Pick<RoomInfo, 'rooms' | 'desk'> {
  return { rooms: [...made.values()].map(({ meta }) => ({ code: meta.code, name: meta.name })), desk: MAX_ROOMS ? main.desk : undefined };
}

const home = new Hosted(main.code, DATA, main.key, await passHash(main.code, PASSWORD), NAME, roomList);

/** Brings a made room to life from its details (a new one starts a new world). */
function host(meta: MadeRoom): Hosted {
  const room = new Hosted(meta.code, join(ROOMS_DIR, meta.code), main.key, meta.pass, meta.name, undefined, () => {
    meta.usedAt = Date.now();
    saveMeta(meta);
  });
  made.set(meta.code, { room, meta });
  return room;
}

// The rooms made before this start.
for (const code of readdirSync(ROOMS_DIR)) {
  try {
    const meta = JSON.parse(readFileSync(metaFile(code), 'utf8')) as MadeRoom;
    if (meta.code !== code || !validCode(code)) throw new Error('its details name another room');
    host(meta);
  } catch (err) {
    log(`Skipping ${join(ROOMS_DIR, code)}: ${String(err)}`);
  }
}

/** Every room with a world, the main one first. */
function worlds(): Hosted[] {
  return [home, ...[...made.values()].map((m) => m.room)];
}

/** What the server is doing, for people and for the update script (which waits until nobody is in). */
function writeStatus(): void {
  try {
    const rooms = worlds().map((r) => ({ room: r.code, name: r.name ?? null, phase: r.coop.phase, paused: r.paused(), players: r.guests().map((s) => s + 1) }));
    // `players`: everyone in, in every room, so update.sh can tell if anyone is playing. `at` says how fresh this is.
    const players = rooms.flatMap((r) => r.players.map((p) => `${r.room}/${p}`));
    writeAtomic(STATUS_FILE, JSON.stringify({ version: VERSION, room: home.code, desk: main.desk, players, rooms, at: new Date().toISOString() }, null, 2));
  } catch {
    // Only a convenience.
  }
}

/** Tells the Play together screen about the made rooms, now. */
function relist(): void {
  home.publish();
}

/**
 * Puts away made rooms nobody has played in for ROOM_DAYS: saved, closed, and moved to the archive
 * folder, where the owner can bring one back by moving it into rooms/ and restarting.
 */
function archiveIdle(): void {
  const now = Date.now();
  for (const [code, { room, meta }] of made) {
    if (room.guests().length || now - meta.usedAt < ROOM_DAYS * DAY_MS) continue;
    archive(code, `had no players for ${ROOM_DAYS} days`);
  }
  relist();
}

/** Closes a made room and moves it to the archive folder, where the owner can bring it back. */
function archive(code: string, why: string): void {
  const entry = made.get(code);
  if (!entry) return;
  const { room, meta } = entry;
  room.close();
  made.delete(code);
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const to = join(ARCHIVE_DIR, `${code}-${new Date().toISOString().slice(0, 10)}`);
  try {
    renameSync(room.dir, existsSync(to) ? `${to}-${Date.now()}` : to);
    log(`Room ${code} (${meta.name}) ${why}: archived it in ${to}.`);
  } catch (err) {
    log(`Room ${code}: closed, but could not move it to the archive: ${String(err)}`);
  }
}

/**
 * A maker's change to their room (D-165): renamed, or deleted (archived, so the server's owner can bring
 * it back). Only with the key whose hash the room keeps, and a room with players in it isn't deleted.
 */
async function change(ask: Extract<DeskAsk, { t: 'rename' | 'delete' }>, slot: number): Promise<DeskReply> {
  const entry = made.get(ask.code);
  if (!entry) return { t: 'no', reason: 'gone' };
  const { room, meta } = entry;
  if (!meta.owner || (await sha256(ask.key)) !== meta.owner) return { t: 'no', reason: 'denied' };
  if (ask.t === 'rename') {
    log(`Player ${slot + 1} at the desk renamed room ${ask.code} from ${meta.name} to ${ask.name}.`);
    meta.name = ask.name;
    room.name = ask.name;
    saveMeta(meta);
    room.publish();
  } else {
    if (room.guests().length) return { t: 'no', reason: 'in-use' };
    archive(ask.code, `was deleted by its maker (player ${slot + 1} at the desk)`);
  }
  relist();
  return { t: 'done' };
}

// The desk (D-164): a room that never starts a game. Players with the server's password ask it for new rooms.
const desk = new Coop(RELAY, VERSION);
desk.headless = true;
/** Desk requests being answered, so one player asking twice doesn't make two rooms. */
const making = new Set<string>();
desk.onAsk = (slot, data) => {
  const answer = (reply: DeskReply) => desk.reply(slot, JSON.stringify(reply));
  const ask = cleanAsk(data);
  if (!ask || serverPrefix(ask.code) !== prefix) return answer({ t: 'no', reason: 'bad' });
  if (ask.t !== 'new') return void change(ask, slot).then(answer);
  if (ask.code === home.code || ask.code === main.desk || made.has(ask.code) || making.has(ask.code)) return answer({ t: 'no', reason: 'taken' });
  if (made.size + making.size >= MAX_ROOMS) return answer({ t: 'no', reason: 'full' });
  making.add(ask.code);
  void (async () => {
    const now = Date.now();
    // No password of the maker's own: the server's, as for its other rooms.
    const meta: MadeRoom = { code: ask.code, name: ask.name, pass: ask.pass || (await passHash(ask.code, PASSWORD)), made: now, usedAt: now, ...(ask.owner ? { owner: ask.owner } : {}) };
    mkdirSync(join(ROOMS_DIR, ask.code), { recursive: true });
    saveMeta(meta);
    const room = host(meta);
    log(`Player ${slot + 1} at the desk made room ${ask.code} (${ask.name}).`);
    const timer = setTimeout(() => {
      if (!making.delete(ask.code)) return;
      answer({ t: 'no', reason: 'busy' });
    }, MAKE_WAIT_MS);
    room.onReady = () => {
      clearTimeout(timer);
      if (making.delete(ask.code)) answer({ t: 'made', code: ask.code });
      relist();
    };
    await room.open();
    room.save(true);
    relist();
  })();
};
desk.onNotice = (text) => log(`Desk ${main.desk}: ${text}`);
desk.onDrop = (code, reason, ms) => log(`Desk ${main.desk}: ${dropText(code, reason, ms)}`);
desk.onEnd = (why, replaced) => {
  if (replaced) return log(`Desk ${main.desk} taken over: ${why} Stop the other server, then restart this one.`);
  log(`Desk ${main.desk} closed: ${why} Opening it again in ${REOPEN_MS / 1000} s.`);
  setTimeout(openDesk, REOPEN_MS);
};
function openDesk(): void {
  if (!MAX_ROOMS) return;
  void passHash(main.desk, PASSWORD).then((pass) => desk.hostRoom(main.desk, main.key, pass));
}

// The game loop, as the browser host runs it (main.ts) but without drawing: each room ticks at the game's
// speed, then sends a turn to its guests. Paused while nobody's in, so bugs don't take a factory overnight.
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  for (const room of worlds()) room.beat(elapsed, now);
}, BEAT_MS);

setInterval(() => {
  for (const room of worlds()) {
    room.save();
    room.publish();
  }
  writeStatus();
}, SAVE_MS);
setInterval(archiveIdle, 3600_000);

// Stopping (systemd, Ctrl+C): save, and let the connections drop rather than close the rooms, so a
// restart within a minute takes them back and nobody is sent away (D-081).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log(`${signal}: saving and stopping.`);
    for (const room of worlds()) room.save(true);
    process.exit(0);
  });
}

// Anything unexpected stops the server with a clear log line; systemd starts it again from the last save.
// The worlds aren't saved then: an error in the middle of a tick can leave one half-updated.
process.on('uncaughtException', (err) => {
  log(`Stopping on an unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log(`Stopping on an unexpected error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});

// Only this server may ever open its rooms once the relay reserves them (D-140, D-164): this is the line to give it.
const keyHash = await sha256(main.key);
log(`To reserve this server's rooms on the relay, add "${prefix}*:${keyHash}" to its RESERVED_ROOMS secret (see server/README.md).`);
log(`Version ${VERSION}. Main room ${home.code}${PASSWORD ? ', with a password' : ''}; ${MAX_ROOMS ? `desk ${main.desk}, up to ${MAX_ROOMS} made rooms` : 'players may not make rooms'}.`);
archiveIdle();
for (const room of worlds()) void room.open();
openDesk();
writeStatus();
