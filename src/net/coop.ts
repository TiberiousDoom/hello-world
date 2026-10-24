// A co-op room from one game's side (co-op phase 1, D-078): host or join by room code, wait in the
// lobby, start together, then pass turns and commands between the relay and the lockstep. All players
// start together: a guest who arrives once the game is under way is turned away (joining later is
// phase 2).

import { applyCommand } from '../sim/commands';
import { HUB_SIZE } from '../sim/data';
import { Session } from '../sim/session';
import { World } from '../sim/world';
import { RelayLink, connect } from './client';
import { GuestLockstep, HostLockstep, HostMessage } from './lockstep';
import { pack, unpack } from './pack';
import { HostSend, MAX_HOST_MESSAGE, RefuseReason, RelayMessage, Role, makeCode, validCode } from './protocol';

export type CoopPhase = 'idle' | 'connecting' | 'lobby' | 'starting' | 'playing';

/** From the host to a guest who arrives after the start (on top of the lockstep's messages). */
type Busy = { t: 'busy' };

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

  /** The lobby changed (players came or went, the phase moved on). */
  onChange: () => void = () => {};
  /** The shared game begins: play this session. */
  onStart: (session: Session) => void = () => {};
  /** Something for the player to know, during the game. */
  onNotice: (text: string) => void = () => {};
  /** The room is over for this game (refused, closed, connection lost), and why. */
  onEnd: (why: string) => void = () => {};

  private link: RelayLink | null = null;
  /** A guest's host messages that came while its world was still unpacking. */
  private early: HostMessage[] = [];

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

  /** Joins the room with this code (letters in any case, spaces ignored). */
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
    for (const slot of this.players) applyCommand(world, { kind: 'add-player', id: slot });
    const session = new Session(world, 0);
    const packed = await pack(session.start);
    if (this.phase !== 'starting') return; // left while packing
    if (packed.length > MAX_HOST_MESSAGE - 200) {
      this.phase = 'lobby';
      this.onChange();
      this.onNotice('This factory is too big to send. Try a smaller one, or a new game.');
      return;
    }
    for (const slot of this.players) if (slot !== 0) this.toGuest({ t: 'start', slot, world: packed }, slot);
    this.host = new HostLockstep(session, (m) => this.toGuest(m));
    this.phase = 'playing';
    this.onChange();
    this.onStart(session);
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
    const link = connect(this.relay, code, role, this.version);
    this.link = link;
    link.onMessage = (m) => {
      if (this.link === link) this.message(m);
    };
    link.onClose = () => {
      if (this.link !== link) return;
      this.end(this.phase === 'connecting' ? "Couldn't reach the game server. Check your connection and try again." : 'Lost the connection to the game.');
    };
    this.onChange();
  }

  private message(m: RelayMessage): void {
    switch (m.t) {
      case 'welcome':
        this.slot = m.slot;
        this.players = m.players;
        this.phase = 'lobby';
        return this.onChange();
      case 'joined':
        if (this.role === 'host' && this.phase !== 'lobby') {
          // Too late to join this one.
          this.link?.send(JSON.stringify({ to: m.slot, data: JSON.stringify({ t: 'busy' } satisfies Busy) } satisfies HostSend));
          return;
        }
        this.players = [...new Set([...this.players, m.slot])].sort((a, b) => a - b);
        return this.onChange();
      case 'left':
        if (!this.players.includes(m.slot)) return;
        this.players = this.players.filter((s) => s !== m.slot);
        if (this.phase === 'playing') {
          // The engineer of a player who left waits at the hub (D-076), sent there like any move.
          const hub = this.host?.session.world.hub;
          if (hub) this.host!.submit(m.slot, { kind: 'move', x: hub.x + Math.floor(HUB_SIZE / 2), y: hub.y + HUB_SIZE });
          this.onNotice(`Player ${m.slot + 1} left. Their engineer walks back to the hub.`);
        }
        return this.onChange();
      case 'from':
        if (this.phase === 'playing' && this.players.includes(m.slot)) this.host?.receive(m.slot, m.data);
        return;
      case 'host':
        return this.fromHost(m.data);
      case 'refused':
        if (m.reason === 'taken' && this.role === 'host') return this.hostRoom(); // that code is in use: another
        return this.end(refusalText(m.reason, m.hostVersion, this.version));
      case 'closed':
        return this.end('The host left, so the game has ended.');
    }
  }

  private fromHost(data: string): void {
    let msg: HostMessage | Busy;
    try {
      msg = JSON.parse(data) as HostMessage | Busy;
    } catch {
      return;
    }
    if (msg.t === 'busy') return this.end('That game has already started. Joining a game under way comes in a later update.');
    if (msg.t === 'start') {
      if (this.phase !== 'lobby') return;
      this.phase = 'starting';
      this.onChange();
      void this.begin(msg.world, msg.slot);
      return;
    }
    if (this.guest) this.guest.receive(msg);
    else this.early.push(msg);
  }

  private async begin(packed: string, slot: number): Promise<void> {
    let world: World;
    try {
      world = World.fromJSON(await unpack(packed));
    } catch {
      return this.end("The host's game couldn't be loaded.");
    }
    if (this.phase !== 'starting') return;
    const session = new Session(world, slot);
    const link = this.link!;
    this.guest = new GuestLockstep(session, (text) => link.send(text));
    for (const m of this.early.splice(0)) this.guest.receive(m);
    this.slot = slot;
    this.phase = 'playing';
    this.onChange();
    this.onStart(session);
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
    this.link = null;
    this.phase = 'idle';
    this.role = null;
    this.code = '';
    this.slot = 0;
    this.players = [];
    this.host = null;
    this.guest = null;
    this.early = [];
  }
}
