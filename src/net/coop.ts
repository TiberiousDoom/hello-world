// A co-op room from one game's side (D-078, D-079): host or join by room code, wait in the lobby,
// start together, then pass turns and commands between the relay and the lockstep. A player can join a
// game under way, and a guest that falls out of step, falls far behind or loses its connection gets a
// fresh copy of the game from the host.

import { applyCommand } from '../sim/commands';
import { Session } from '../sim/session';
import { World } from '../sim/world';
import { RelayLink, connect } from './client';
import { GuestLockstep, HostLockstep, HostMessage } from './lockstep';
import { pack, unpack } from './pack';
import { HostSend, MAX_HOST_MESSAGE, RefuseReason, RelayMessage, Role, makeCode, validCode } from './protocol';

export type CoopPhase = 'idle' | 'connecting' | 'lobby' | 'starting' | 'playing';

/** Tries to get back into the room after the connection drops, and the wait before each (ms). */
export const RECONNECT_WAITS = [500, 1000, 2000, 4000, 8000];
/** Turns a guest keeps (about 20 s), to replay those that came after a fresh copy was taken. */
const RECENT_TURNS = 400;
/** A guest asking again gets at most one copy this often (ms): each one costs the host a save and gzip. */
const RESYNC_MS = 5000;

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
  }
}

export class Coop {
  phase: CoopPhase = 'idle';
  role: Role | null = null;
  code = '';
  /** This game's slot: 0 for the host, 1–3 for guests. Its engineer has the same id. */
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
  onEnd: (why: string) => void = () => {};

  private link: RelayLink | null = null;
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

  /** Opens a room with a new code. */
  hostRoom(): void {
    this.open('host', makeCode(crypto.getRandomValues(new Uint8Array(6))));
  }

  /** Joins the room with this code (letters in any case, spaces ignored), in the lobby or under way. */
  joinRoom(input: string): string | null {
    const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validCode(code)) return 'A room code is 6 letters and digits.';
    this.open('guest', code);
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
    this.host = new HostLockstep(session, (m) => this.toGuest(m), (slot) => {
      if (Date.now() - (this.copied.get(slot) ?? -Infinity) < RESYNC_MS) return;
      this.copied.set(slot, Date.now());
      void this.sendCopy(slot, false);
    });
    this.phase = 'playing';
    this.onChange();
    this.onStart(session, false);
    // Anyone who came in while the world was packing joins the game under way.
    for (const slot of this.players) if (!starters.includes(slot)) void this.sendCopy(slot, true);
  }

  /** Leaves the room (the host closing it ends it for everyone). */
  leave(): void {
    const link = this.link;
    this.reset();
    link?.close();
  }

  private open(role: Role, code: string): void {
    this.leave();
    this.role = role;
    this.code = code;
    this.phase = 'connecting';
    this.attach();
    this.onChange();
  }

  /** Connects to the room (again, when reconnecting), keeping whatever game is under way. */
  private attach(): void {
    const link = connect(this.relay, this.code, this.role!, this.version);
    this.link = link;
    link.onMessage = (m) => {
      if (this.link === link) this.message(m);
    };
    link.onClose = () => {
      if (this.link !== link) return;
      // A guest whose game is under way tries to get back in; it carries on from a fresh copy (D-079).
      if (this.role === 'guest' && this.phase === 'playing' && this.reconnecting < RECONNECT_WAITS.length) return this.reconnect();
      this.end(this.phase === 'connecting' ? "Couldn't reach the game server. Check your connection and try again." : 'Lost the connection to the game.');
    };
  }

  private reconnect(): void {
    this.link = null;
    if (!this.reconnecting) this.onNotice('Connection lost. Getting back into the game…');
    this.retry = setTimeout(() => {
      this.retry = null;
      if (this.phase === 'playing') this.attach();
    }, RECONNECT_WAITS[this.reconnecting++]);
  }

  private message(m: RelayMessage): void {
    switch (m.t) {
      case 'welcome':
        this.slot = m.slot;
        this.players = m.players;
        // Back in after a dropped connection: the host sends a fresh copy, as to anyone joining.
        if (this.phase !== 'playing') this.phase = 'lobby';
        return this.onChange();
      case 'joined':
        this.players = [...new Set([...this.players, m.slot])].sort((a, b) => a - b);
        if (this.host && this.phase === 'playing') {
          this.onNotice(`Player ${m.slot + 1} joined.`);
          void this.sendCopy(m.slot, true);
        }
        return this.onChange();
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
        if (m.reason === 'taken' && this.role === 'host' && this.phase === 'connecting') return this.hostRoom(); // that code is in use: another
        if (m.reason === 'no-room' && this.reconnecting) return this.end('The host left, so the game has ended.');
        return this.end(refusalText(m.reason, m.hostVersion, this.version));
      case 'closed':
        return this.end('The host left, so the game has ended.');
    }
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

  private end(why: string): void {
    const link = this.link;
    this.reset();
    link?.close();
    this.onEnd(why);
  }

  private reset(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
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
    this.reconnecting = 0;
  }
}
