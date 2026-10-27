// The dedicated server (D-084): hosts one co-op room around the clock, so friends can come and go
// without anyone keeping a browser open as host. It is a host like any other, run by Node instead of a
// page: the same Coop and lockstep code, connected to the same relay, with no screen. It keeps the room's
// code and key on disk, so a restart takes the room back, and saves the world every minute.
//
// Settings come from the environment (all optional):
//   FOUNDRY_DATA        where the room, the save and its backups live (default: server-data/)
//   FOUNDRY_ROOM        the room code (6 letters and digits); without it one is made on first start and kept
//   FOUNDRY_RELAY       the relay (default: the one on Cloudflare; ws://localhost:8787 for `wrangler dev`)
//   FOUNDRY_ORIGIN      the page origin the relay lets in (default: the game on GitHub Pages)
//   FOUNDRY_PAUSE_EMPTY "0" keeps the game running with nobody in it (default: paused until someone joins)
//   FOUNDRY_NAME        the name players see on the Play together screen (default: none, shown as "Dedicated server")
//   FOUNDRY_PASSWORD    a password players must type to join (default: none, open to anyone with the code) (D-140)
//
// A connection that dies without closing (a router restarting, a new IP address) is noticed by the
// heartbeat in Coop (D-085): the server reconnects and the relay hands it the room.

import { chmodSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Coop } from '../src/net/coop';
import { RELAY_URL } from '../src/net/client';
import { makeCode, passHash, sha256, validCode } from '../src/net/protocol';
import { clockAt } from '../src/sim/clock';
import { OldSaveError, TICK, World } from '../src/sim/world';

const env = process.env;
const DATA = env.FOUNDRY_DATA ?? 'server-data';
const RELAY = env.FOUNDRY_RELAY ?? RELAY_URL;
const ORIGIN = env.FOUNDRY_ORIGIN ?? 'https://tiberiousdoom.github.io';
const PAUSE_EMPTY = env.FOUNDRY_PAUSE_EMPTY !== '0';
const NAME = env.FOUNDRY_NAME?.trim() || undefined;
const PASSWORD = env.FOUNDRY_PASSWORD ?? '';
/** The game's version, which every player must match: package.json's, kept equal to the changelog's by a test. */
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** How often the world is saved (ms), and how many hourly backups are kept. */
const SAVE_MS = 60_000;
const BACKUPS = 24;
/** How long the server waits before opening its room again after losing it (ms). */
const REOPEN_MS = 15_000;
/** How long it waits before trying again to start a game it couldn't send (too big for the relay) (ms). */
const RETRY_START_MS = 5 * 60_000;
/** The loop's beat (ms), and the most ticks it runs in one beat when it falls behind. */
const BEAT_MS = 25;
const MAX_TICKS_PER_BEAT = 20;

const WORLD_FILE = join(DATA, 'world.json');
const ROOM_FILE = join(DATA, 'room.json');
const STATUS_FILE = join(DATA, 'status.json');
const BACKUP_DIR = join(DATA, 'backups');

function log(text: string): void {
  console.log(`${new Date().toISOString()} ${text}`);
}

/** Writes a file whole or not at all: a crash mid-write leaves the old one. `mode`: its permissions. */
function writeAtomic(file: string, text: string, mode = 0o644): void {
  writeFileSync(`${file}.tmp`, text, { mode });
  chmodSync(`${file}.tmp`, mode); // writeFileSync's mode only applies to a new file
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

/** The room's code and the host's key: the same every start, so players keep one code and a restart gets the room back. */
function loadRoom(): { code: string; key: string } {
  let room: { code: string; key: string } | null = null;
  try {
    room = JSON.parse(readFileSync(ROOM_FILE, 'utf8')) as { code: string; key: string };
  } catch {
    // First start.
  }
  const code = (env.FOUNDRY_ROOM ?? room?.code ?? makeCode(crypto.getRandomValues(new Uint8Array(6)))).toUpperCase();
  if (!validCode(code)) throw new Error(`FOUNDRY_ROOM must be 6 letters and digits, without 0, O, 1, I or L (got "${code}").`);
  const key = room?.key ?? [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  // The key lets whoever holds it take the room (D-085): readable by the server's user alone.
  if (code !== room?.code || key !== room?.key) writeAtomic(ROOM_FILE, JSON.stringify({ code, key }), 0o600);
  else chmodSync(ROOM_FILE, 0o600); // tighten one written before this rule
  return { code, key };
}

/** The saved world, or a new one. A save too old to load is moved aside, not lost. */
function loadWorld(): World {
  let json: string;
  try {
    json = readFileSync(WORLD_FILE, 'utf8');
  } catch {
    log('No saved world: starting a new one.');
    return World.create(undefined, 'standard');
  }
  try {
    return World.fromJSON(json);
  } catch (err) {
    const aside = `${WORLD_FILE}.unloadable-${Date.now()}`;
    renameSync(WORLD_FILE, aside);
    log(`${err instanceof OldSaveError ? 'The save is from an older version of the game' : `The save couldn't be loaded (${String(err)})`}: moved it to ${aside} and started a new world.`);
    return World.create(undefined, 'standard');
  }
}

mkdirSync(BACKUP_DIR, { recursive: true });
const room = loadRoom();
let world = loadWorld();
const coop = new Coop(RELAY, VERSION);
let lastBackupHour = '';
/** The world's game time when it was last saved: a paused world isn't written again and again. */
let savedTime = world.state.time;
/** No game is started before this time (ms): set after a start that failed, so it isn't retried at once. */
let startAfter = 0;
/** A start is under way. */
let starting = false;

/** Saves the world if it changed (`force`: always, when stopping), with an hourly backup. */
function save(force = false): void {
  status();
  if (!force && world.state.time === savedTime) return;
  try {
    const json = world.toJSON();
    writeAtomic(WORLD_FILE, json);
    savedTime = world.state.time;
    const hour = new Date().toISOString().slice(0, 13).replace('T', '-');
    if (hour !== lastBackupHour) {
      lastBackupHour = hour;
      writeFileSync(join(BACKUP_DIR, `world-${hour}.json`), json);
      const old = readdirSync(BACKUP_DIR).filter((f) => f.startsWith('world-')).sort().slice(0, -BACKUPS);
      for (const f of old) rmSync(join(BACKUP_DIR, f));
    }
  } catch (err) {
    log(`Could not save: ${String(err)}`);
  }
  // The session keeps every command for replays, which only tests use. A browser game lasts hours; the
  // server runs for weeks, so it lets them go once they're saved in the world.
  const session = coop.host?.session;
  if (session) session.log.length = 0;
}

/** What the server is doing, for people and for the update script (which waits for an empty room). */
function status(): void {
  try {
    // Players by number, as the game names them (the server is player 1). `at` says how fresh this is.
    const players = guests().map((s) => s + 1);
    writeAtomic(STATUS_FILE, JSON.stringify({ version: VERSION, room: room.code, phase: coop.phase, paused: paused(), players, tick: coop.host?.session.ticks ?? null, at: new Date().toISOString() }, null, 2));
  } catch {
    // Only a convenience.
  }
}

/** Tells the Play together screen where the game is (D-086): sent when it changes, and with every save. */
let lastInfo = '';
function publish(): void {
  const clock = clockAt(world.state.time);
  const info = { name: NAME, day: clock.day, season: clock.season.name };
  if (JSON.stringify(info) === lastInfo && coop.phase === 'playing') return;
  lastInfo = JSON.stringify(info);
  coop.setInfo(info);
}

/** The slots of the players in the room, the server's own left out. */
function guests(): number[] {
  return coop.players.filter((s) => s !== 0);
}

/** Whether the game stands still: with nobody in, unless FOUNDRY_PAUSE_EMPTY=0. */
function paused(): boolean {
  return PAUSE_EMPTY && !guests().length;
}

/** Starts the game in the open room. One that can't be sent (a factory too big for the relay) waits a while. */
async function startGame(): Promise<void> {
  // A failed start says so through onChange before it returns: don't begin another from in there.
  if (starting || Date.now() < startAfter) return;
  starting = true;
  try {
    await coop.start(world);
  } catch (err) {
    log(`Could not start the game: ${String(err)}`);
  } finally {
    starting = false;
  }
  if (coop.phase === 'lobby') {
    startAfter = Date.now() + RETRY_START_MS;
    log(`The game didn't start; trying again in ${RETRY_START_MS / 60_000} minutes.`);
    setTimeout(() => coop.phase === 'lobby' && void startGame(), RETRY_START_MS);
  }
}

async function open(): Promise<void> {
  log(`Opening room ${room.code} on ${RELAY} (version ${VERSION})${PASSWORD ? ', with a password' : ''}.`);
  coop.hostRoom(room.code, room.key, await passHash(room.code, PASSWORD));
}

let lastPlayers = '';
coop.onChange = () => {
  // The room is open: start the game at once, with whoever is in; everyone else joins it under way.
  if (coop.role === 'host' && coop.phase === 'lobby') void startGame();
  const players = guests().map((s) => s + 1).join(', ');
  if (players !== lastPlayers) {
    lastPlayers = players;
    log(players ? `Players in: ${players}.` : 'Nobody in.');
  }
  status();
};
coop.onStart = (session) => {
  world = session.world;
  lastInfo = '';
  publish();
  log(`Room ${room.code} is open. Join with that code under Play together.`);
};
coop.onNotice = (text) => log(text);
coop.onEnd = (why, replaced) => {
  save(true);
  if (replaced) {
    // Another server with this room's key (a second copy started by mistake) took the room. Taking it back
    // would only start a tug of war, so this one stays out until it's restarted (D-085).
    log(`Room taken over: ${why} Another server is using room ${room.code} and its key (${ROOM_FILE}). Stop one of them, then restart this one.`);
    return;
  }
  log(`Room closed: ${why} Opening it again in ${REOPEN_MS / 1000} s.`);
  setTimeout(() => void open(), REOPEN_MS);
};

// The game loop, as the browser host runs it (main.ts) but without drawing: ticks at the game's speed,
// then a turn for the guests. Paused while nobody's in, so bugs don't take the factory overnight.
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  const host = coop.host;
  if (!host) return;
  const speed = paused() ? 0 : 1;
  acc += elapsed * speed;
  let ticks = 0;
  while (acc >= TICK && ticks < MAX_TICKS_PER_BEAT) {
    host.tick();
    acc -= TICK;
    ticks++;
  }
  if (ticks === MAX_TICKS_PER_BEAT) acc = 0;
  host.flush(speed, now);
}, BEAT_MS);

setInterval(() => {
  save();
  publish();
}, SAVE_MS);

// Stopping (systemd, Ctrl+C): save, and let the connection drop rather than close the room, so a
// restart within a minute takes it back and nobody is sent away (D-081).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log(`${signal}: saving and stopping.`);
    save(true);
    process.exit(0);
  });
}

// Only this server may ever open its room once the relay reserves it (D-140): this is the line to give it.
log(`To reserve room ${room.code} on the relay, add "${room.code}:${await sha256(room.key)}" to its RESERVED_ROOMS secret (see server/README.md).`);
void open();
