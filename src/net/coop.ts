// A co-op room from one game's side (D-078, D-079, D-081): host or join by room code, wait in the
// lobby, start together, then pass turns and commands between the relay and the lockstep. A player can
// join a game under way, and a guest that falls out of step, falls far behind or loses its connection
// gets a fresh copy of the game from the host. A host whose connection drops takes its room back with
// its key, and sends everyone a fresh copy.

import { applyCommand } from '../sim/commands';
import { Session } from '../sim/session';
import { World } from '../sim/world';
import { RelayLink, connect } from './client';
import { GuestLockstep, HostLockstep, HostMessage } from './lockstep';
import { pack, unpack } from './pack';
import { HEARTBEAT, HostSend, MAX_HOST_MESSAGE, RoomInfo, infoMessage, RefuseReason, RelayMessage, Role, makeCode, passHash, validCode } from './protocol';

export type CoopPhase = 'idle' | 'connecting' | 'lobby' | 'starting' | 'playing';

/** Tries to get back into the room after the connection drops, and the wait before each (ms). */
export const RECONNECT_WAITS = [500, 1000, 2000, 4000, 8000];
/** Turns a guest keeps (about 20 s), to replay those that came after a fresh copy was taken. */
const RECENT_TURNS = 400;
/** A guest asking again gets at most one copy this often (ms): each one costs the host a save and gzip. */
const RESYNC_MS = 5000;
/**
 * A guest that hears nothing from the host for this long (ms) takes its connection for dead and
 * reconnects (D-081): the host sends something at least every KEEPALIVE_MS, and a dead connection can
 * otherwise go unnoticed for minutes after a phone sleeps.
 */
export const SILENCE_MS = 15_000;
/**
 * The host sends the relay a heartbeat this often (ms), and takes its connection for dead when one goes
 * unanswered for HEARTBEAT_WAIT_MS (D-085). A connection can die without closing, and the host, unlike a
 * guest, may hear nothing for hours when nobody's playing.
 */
export const HEARTBEAT_MS = 10_000;
export const HEARTBEAT_WAIT_MS = 10_000;

/** Why a room couldn't be joined, for the player. */
export function refusalText(reason: RefuseReason, hostVersion: string | undefined, version: string): string {
  switch (reason) {
    case 'version':
      return `The host has version ${hostVersion ?? '?'} and you have ${version}. Both reload the page to get the newest version, then try again.`;
    case 'full':
      return 'That game is full.';
    case 'no-room':
      return 'No game has that code. Check it with the host.';
    case 'taken':
      return 'That room is already taken.';
    case 'bad-request':
      return 'The game server refused the connection.';
    case 'password':
      return 'That game needs a password. Type it below, then join again.';
  }
}

export class Coop {
  phase: CoopPhase = 'idle';
  role: Role | null = null;
  code = '';
  /** This game's slot: 0 for the host, 1 to MAX_PLAYERS − 1 for guests. Its engineer has the same id. */
  slot = 0;
  /** Everyone in the room, by slot. */
  players: number[] = [];
  host: HostLockstep | null = null;
  guest: GuestLockstep | null = null;
  /** A guest whose connection dropped, trying to get back in: the attempt it's on. */
  reconnecting = 0;

  /** The lobby changed (players came or went, the phase moved on). */
  onChange: () => void = () => {};
  /** The shared game begins (`again`: a guest's fresh copy of the game it was already playing). */
  onStart: (session: Session, again: boolean) => void = () => {};
  /** Something for the player to know, during the game. */
  onNotice: (text: string) => void = () => {};
  /** The room is over for this game (refused, closed, connection lost), and why. */
  /** `replaced`: another connection with this room's key took it over (D-085), so trying again would fight it. */
  onEnd: (why: string, replaced?: boolean) => void = () => {};
  /** Another player points at tile (x, y) (D-080). */
  onPing: (player: number, x: number, y: number) => void = () => {};

  private link: RelayLink | null = null;
  /** The host's secret for its room: only it can take the room back after a dropped connection. */
  private key = '';
  /** The room's password, hashed (D-140): set by a host, given by a guest; kept for reconnecting. */
  private pass = '';
  /** Why the relay last refused this game, if it did: the lobby asks for a password after 'password'. */
  refused: RefuseReason | null = null;
  /** The room's code was chosen, not drawn (the dedicated server): a taken code isn't swapped for another. */
  private fixed = false;
  /** When a guest last heard from its host, and the check that notices a silent connection. */
  private heardAt = 0;
  /** The host's connection dropped and the room waits for it: silence is expected meanwhile. */
  private hostAway = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  /** When the host last sent a heartbeat on this connection (D-085). */
  private beatAt = 0;
  /** The relay has answered a heartbeat on this connection. One from before heartbeats never does. */
  private beatAnswered = false;
  /** What this host tells the relay about its room (D-086); sent again on every new connection. */
  private info: RoomInfo | null = null;
  /** The heartbeat's timing (ms): tests shorten it. */
  heartbeatMs = HEARTBEAT_MS;
  heartbeatWaitMs = HEARTBEAT_WAIT_MS;
  /** A guest's recent turns from the host, for replaying after a fresh copy arrives. */
  private recent: HostMessage[] = [];
  private retry: ReturnType<typeof setTimeout> | null = null;
  /** When the host last sent each guest a copy it asked for. */
  private copied = new Map<number, number>();

  constructor(
    private relay: string,
    private version: string,
  ) {}

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * Opens a room with a new code, or (the dedicated server, D-084) with its own code and key, the same
   * every time it starts, so players always know where to find it and a restart takes the room back.
   */
  hostRoom(code?: string, key?: string, pass = ''): void {
    this.fixed = code != null;
    key ??= [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    this.open('host', code ?? makeCode(crypto.getRandomValues(new Uint8Array(6))), key, pass);
  }

  /** Joins the room with this code (letters in any case, spaces ignored), in the lobby or under way. */
  joinRoom(input: string, password = ''): string | null {
    const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validCode(code)) return 'A room code is 6 letters and digits.';
    // A key of its own, so that reconnecting takes back this player's slot (#100).
    const key = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    void passHash(code, password).then((pass) => this.open('guest', code, key, pass));
    return null;
  }

  /**
   * The host starts the game: every guest gets an engineer, then the world as the session begins,
   * packed. Resolves once it's sent; the host's own game starts with it.
   */
  async start(world: World): Promise<void> {
    if (this.role !== 'host' || this.phase !== 'lobby') return;
    this.phase = 'starting';
    this.onChange();
    const starters = [...this.players];
    for (const slot of starters) applyCommand(world, { kind: 'add-player', id: slot });
    const session = new Session(world, 0);
    const packed = await pack(session.start);
    if (this.phase !== 'starting') return; // left while packing
    if (packed.length > MAX_HOST_MESSAGE - 200) {
      this.phase = 'lobby';
      this.onChange();
      this.onNotice('This factory is too big to send. Try a smaller one, or a new game.');
      return;
    }
    for (const slot of starters) if (slot !== 0) this.toGuest({ t: 'start', slot, world: packed, seq: 0, cmds: [], speed: 1 }, slot);
    const host = new HostLockstep(
      session,
      (m) => this.toGuest(m),
      (slot) => {
        if (Date.now() - (this.copied.get(slot) ?? -Infinity) < RESYNC_MS) return;
        this.copied.set(slot, Date.now());
        void this.sendCopy(slot, false);
      },
    );
    host.onPing = (player, x, y) => {
      if (player !== 0) this.onPing(player, x, y);
    };
    this.host = host;
    this.phase = 'playing';
    this.onChange();
    this.onStart(session, false);
    // Anyone who came in while the world was packing joins the game under way.
    for (const slot of this.players) if (!starters.includes(slot)) void this.sendCopy(slot, true);
  }

  /**
   * The host's room info for the Play together screen (D-086): the dedicated server's name, day and
   * season. Sent now if the room is open, and again whenever the host connects.
   */
  setInfo(info: RoomInfo): void {
    this.info = info;
    if (this.role === 'host' && this.phase !== 'connecting') this.link?.send(infoMessage(info));
  }

  /** This player points at tile (x, y), for everyone in the game (D-080). */
  ping(x: number, y: number): void {
    if (this.host) this.host.ping(0, x, y);
    else this.guest?.ping(x, y);
  }

  /** Leaves the room (the host closing it ends it for everyone). */
  leave(): void {
    const link = this.link;
    this.reset();
    link?.close();
  }

  private open(role: Role, code: string, key = '', pass = ''): void {
    this.leave();
    this.role = role;
    this.code = code;
    this.key = key;
    this.pass = pass;
    this.refused = null;
    this.phase = 'connecting';
    this.attach();
    this.onChange();
  }

  /** Connects to the room (again, when reconnecting), keeping whatever game is under way. */
  private attach(): void {
    const link = connect(this.relay, this.code, this.role!, this.version, this.key, this.pass);
    this.link = link;
    this.heardAt = Date.now();
    this.beatAt = 0;
    this.beatAnswered = false;
    link.onMessage = (m) => {
      if (this.link !== link) return;
      this.heardAt = Date.now();
      if (m.t === 'heartbeat') {
        this.beatAnswered = true;
        return;
      }
      this.message(m);
    };
    if (!this.watchdog) this.watchdog = setInterval(() => this.watch(), Math.min(1000, this.heartbeatMs / 4));
    link.onClose = () => {
      if (this.link !== link) return;
      // A game under way tries to get back in (D-079, D-081). A guest carries on from a fresh copy; the
      // host plays on meanwhile, and sends everyone a fresh copy once it's back.
      if (this.phase === 'playing' && this.reconnecting < RECONNECT_WAITS.length) return this.reconnect();
      this.end(this.phase === 'connecting' ? "Couldn't reach the game server. Check your connection and try again." : 'Lost the connection to the game.');
    };
  }

  /** Notices a connection that died without closing, and treats it as closed: the game reconnects. */
  private watch(): void {
    const link = this.link;
    if (!link) return;
    const now = Date.now();
    if (this.role === 'guest') {
      // A guest hears from its host at least every KEEPALIVE_MS.
      if (this.phase === 'playing' && !this.hostAway && now - this.heardAt > SILENCE_MS) {
        link.onClose();
        link.close();
      }
      return;
    }
    if (this.phase !== 'lobby' && this.phase !== 'starting' && this.phase !== 'playing') return;
    // The host (D-085): anything from the relay since the last heartbeat shows the connection is alive.
    // Dead only once this relay has answered heartbeats before, so an older relay is never taken for dead.
    if (this.beatAnswered && this.beatAt > this.heardAt && now - this.beatAt > this.heartbeatWaitMs) {
      this.onNotice('No answer from the game server: reconnecting.');
      link.onClose();
      // Dropped, not left: if this reaches the relay at all, the room waits for the host to come back.
      (link.drop ?? link.close)();
      return;
    }
    if (now - this.beatAt >= this.heartbeatMs && this.beatAt <= this.heardAt) {
      this.beatAt = now;
      link.send(HEARTBEAT);
    }
  }

  private reconnect(): void {
    this.link = null;
    if (!this.reconnecting) this.onNotice(this.host ? 'Connection lost. Getting the room back…' : 'Connection lost. Getting back into the game…');
    this.retry = setTimeout(() => {
      this.retry = null;
      if (this.phase === 'playing') this.attach();
    }, RECONNECT_WAITS[this.reconnecting++]);
  }

  private message(m: RelayMessage): void {
    switch (m.t) {
      case 'welcome':
        if (this.role === 'host' && this.info) this.link?.send(infoMessage(this.info));
        if (this.host && this.phase === 'playing') return this.hostBack(m.players);
        this.slot = m.slot;
        this.players = m.players;
        // Back in after a dropped connection: the host sends a fresh copy, as to anyone joining.
        if (this.phase !== 'playing') this.phase = 'lobby';
        return this.onChange();
      case 'joined': {
        // A slot already here is a player back on a new connection (#100): no new player, but a fresh copy.
        const back = this.players.includes(m.slot);
        this.players = [...new Set([...this.players, m.slot])].sort((a, b) => a - b);
        if (m.slot === 0 && this.guest) {
          this.hostAway = false;
          // Turns from before the host came back mean nothing now. A restarted server (D-084) counts its
          // turns from 0 again, and old turns with higher counts would make this game ignore its new ones.
          this.recent = [];
          this.onNotice('The host is back.');
        }
        if (this.host && this.phase === 'playing') {
          if (!back) this.onNotice(`Player ${m.slot + 1} joined.`);
          void this.sendCopy(m.slot, true);
        }
        return this.onChange();
      }
      case 'left':
        if (!this.players.includes(m.slot)) return;
        this.players = this.players.filter((s) => s !== m.slot);
        if (this.host && this.phase === 'playing') {
          // Their engineer is back at the hub at once, with what it carried in stock (D-079).
          this.host.bookkeeping({ kind: 'send-home', id: m.slot });
          this.onNotice(`Player ${m.slot + 1} left. Their engineer is back at the hub.`);
        }
        return this.onChange();
      case 'from':
        if (this.phase === 'playing' && this.players.includes(m.slot)) this.host?.receive(m.slot, m.data);
        return;
      case 'host':
        return this.fromHost(m.data);
      case 'refused':
        if (m.reason === 'taken' && this.role === 'host' && this.phase === 'connecting' && !this.fixed) return this.hostRoom(); // that code is in use: another
        if (m.reason === 'no-room' && this.reconnecting) return this.end('The host left, so the game has ended.');
        this.refused = m.reason;
        return this.end(refusalText(m.reason, m.hostVersion, this.version));
      case 'closed':
        if (m.reason === 'replaced') return this.end('This game was opened in the room again from somewhere else, so this copy left it.', true);
        return this.end('The host left, so the game has ended.');
      case 'host-away':
        this.hostAway = true;
        return this.onNotice("The host's connection dropped. Waiting a minute for them to come back…");
    }
  }

  /**
   * The host has its room back after a dropped connection. The others' games stood still while it played
   * on, so each gets a fresh copy; players who left meanwhile have their engineers sent home.
   */
  private hostBack(players: number[]): void {
    for (const slot of this.players) if (slot !== 0 && !players.includes(slot)) this.host!.bookkeeping({ kind: 'send-home', id: slot });
    this.players = players;
    this.reconnecting = 0;
    this.onNotice('Back in the room.');
    for (const slot of players) if (slot !== 0) void this.sendCopy(slot, true);
    this.onChange();
  }

  /** The host sends a guest a copy of the game: a player joining under way, or a guest that asked again. */
  private async sendCopy(slot: number, joining: boolean): Promise<void> {
    const host = this.host;
    if (!host) return;
    const snapshot = host.snapshot(slot, joining);
    const packed = await pack(snapshot.world);
    if (this.host !== host) return;
    if (packed.length > MAX_HOST_MESSAGE - 200) return this.onNotice(`The factory is too big to send to player ${slot + 1}.`);
    this.toGuest({ t: 'start', slot, ...snapshot, world: packed }, slot);
  }

  private fromHost(data: string): void {
    let msg: HostMessage;
    try {
      msg = JSON.parse(data) as HostMessage;
    } catch {
      return;
    }
    if (msg.t === 'start') {
      if (this.phase !== 'lobby' && this.phase !== 'playing') return;
      if (this.phase === 'lobby') {
        this.phase = 'starting';
        this.onChange();
      }
      void this.begin(msg);
      return;
    }
    this.recent.push(msg);
    if (this.recent.length > RECENT_TURNS) this.recent.shift();
    // Pings go once, as they arrive; this player's own showed when it was made.
    if (msg.t === 'turn') for (const [player, x, y] of msg.pings ?? []) if (player !== this.slot) this.onPing(player, x, y);
    this.guest?.receive(msg);
  }

  /** A guest starts from the host's copy of the game, then takes in the turns that came after it. */
  private async begin(start: Extract<HostMessage, { t: 'start' }>): Promise<void> {
    const again = this.guest != null;
    let world: World;
    try {
      world = World.fromJSON(await unpack(start.world));
    } catch {
      return this.end("The host's game couldn't be loaded.");
    }
    if (this.phase !== 'starting' && this.phase !== 'playing') return;
    const session = new Session(world, start.slot);
    this.guest = new GuestLockstep(session, (text) => this.link?.send(text), start);
    for (const m of this.recent) this.guest.receive(m);
    this.slot = start.slot;
    this.phase = 'playing';
    if (this.reconnecting) this.onNotice('Back in the game.');
    else if (again) this.onNotice("Caught up with the host's game.");
    this.reconnecting = 0;
    this.onChange();
    this.onStart(session, again);
  }

  /** A lockstep message to one guest, or to all. */
  private toGuest(message: HostMessage, to?: number): void {
    this.link?.send(JSON.stringify({ to, data: JSON.stringify(message) } satisfies HostSend));
  }

  private end(why: string, replaced = false): void {
    const link = this.link;
    this.reset();
    link?.close();
    this.onEnd(why, replaced);
  }

  private reset(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.hostAway = false;
    this.link = null;
    this.phase = 'idle';
    this.role = null;
    this.code = '';
    this.slot = 0;
    this.players = [];
    this.host = null;
    this.guest = null;
    this.recent = [];
    this.copied.clear();
    this.key = '';
    this.reconnecting = 0;
  }
}
