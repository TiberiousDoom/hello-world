// The Play together dialog (D-078, D-079, D-086): join the dedicated server with one button, or one of the
// rooms players made on it (D-164), or make one; host a new game, your own factory or a co-op game saved in
// this browser, or join a friend's with its room code (in the lobby or under way). The room is in net/coop.ts.

import { refusalText, type Coop } from '../net/coop';
import { CODE_ALPHABET, CODE_LENGTH, DeskAsk, DeskReply, RefuseReason, RoomStatus, ServerRoom, passHash, roomName, serverPrefix } from '../net/protocol';
import { PLAYER_COLORS } from './state';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** How often the server's status is checked while the dialog is open (ms). */
export const SERVER_POLL_MS = 10_000;

/** What the host shares: a new game, their own saved factory, or the co-op game saved in this browser. */
export type HostChoice = 'new' | 'solo' | 'coop';

export interface LobbyActions {
  /** A line about each saved game, or null where there's none to host. */
  saves(): { solo: string | null; coop: string | null };
  /** The host presses Start. */
  start(choice: HostChoice): void;
  openModal(id: string): void;
  closeModals(): void;
  /**
   * The dedicated server's main room code, how to ask the relay about a room (D-086), and how to ask the
   * server's desk for a new room (D-164).
   */
  server: {
    code: string;
    status(code: string): Promise<RoomStatus | null>;
    ask(desk: string, ask: DeskAsk, pass: string): Promise<DeskReply | { refused: RefuseReason } | null>;
  };
  /** This game's version, which the server must match. */
  version: string;
}

/** How the server's card looks: its light, and whether Join works. */
export type ServerState = 'checking' | 'online' | 'offline' | 'away' | 'full' | 'version' | 'unknown';

export interface ServerView {
  state: ServerState;
  /** The light's label. */
  label: string;
  name: string;
  /** Players, game and version, when the server is there. */
  facts: { players: string; game: string; version: string } | null;
  /** What to do about it, when Join won't work or might not. */
  note: string | null;
  canJoin: boolean;
}

/** -1, 0 or 1 as version a is older than, the same as, or newer than b ("0.44.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * What the server's card says, from the relay's status (null: the relay couldn't be reached, undefined:
 * not checked yet). Kept apart from the page so it can be tested.
 */
export function serverView(status: RoomStatus | null | undefined, version: string): ServerView {
  const name = status?.info?.name ?? 'Dedicated server';
  if (status === undefined) return { state: 'checking', label: 'Checking…', name, facts: null, note: null, canJoin: false };
  // Can't tell: let the player try. Joining says why if it fails.
  if (status === null) return { state: 'unknown', label: 'Unknown', name, facts: null, note: "Couldn't check the server. Your connection may be down.", canJoin: true };
  if (status.away) {
    return { state: 'away', label: 'Reconnecting', name, facts: null, note: 'The server lost its connection and is getting back in. Try again in a minute.', canJoin: false };
  }
  if (!status.open) return { state: 'offline', label: 'Offline', name, facts: null, note: "The server isn't running right now. Host on this device instead, or try again later.", canJoin: false };
  const places = status.max - 1; // the server holds one place itself
  const info = status.info;
  const facts = {
    players: `${status.players} of ${places}`,
    game: info?.day ? `Day ${info.day}${info.season ? ` · ${info.season}` : ''}` : '—',
    version: status.version ?? '?',
  };
  if (status.version && status.version !== version) {
    const older = compareVersions(status.version, version) < 0;
    const note = older
      ? `The server still has version ${status.version}; you have ${version}. It updates itself once nobody is playing on it.`
      : `The server has version ${status.version}; you have ${version}. Reload the page to get the newest version.`;
    return { state: 'version', label: older ? 'Updating' : 'Reload', name, facts, note, canJoin: false };
  }
  if (status.players >= places) return { state: 'full', label: 'Full', name, facts, note: `All ${places} places are taken. Try again soon.`, canJoin: false };
  return { state: 'online', label: 'Online', name, facts, note: null, canJoin: true };
}

/** Tries at making a room whose drawn code turns out taken. */
const MAKE_TRIES = 3;

export class Lobby {
  /** What the host chose to share, kept until Start. */
  private choice: HostChoice = 'new';
  /** Checks the server's status while the dialog shows the choices. */
  private poll: ReturnType<typeof setInterval> | null = null;
  /** The latest check, so an older answer arriving late doesn't replace it. */
  private asked = 0;
  /** The rooms players made on the server, and its desk, from the main room's last status (D-164). */
  private rooms: ServerRoom[] = [];
  private desk: string | null = null;
  /** A room is being made: the form waits. */
  private making = false;

  constructor(
    private coop: Coop,
    private actions: LobbyActions,
  ) {
    $('coop-server-join').addEventListener('click', () => {
      coop.joinRoom(actions.server.code, this.password(actions.server.code));
      this.status('Joining the server…');
    });
    $('coop-room-list').addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-code]');
      if (!button) return;
      const code = button.dataset.code!;
      coop.joinRoom(code, this.password(code));
      this.status(`Joining ${this.rooms.find((r) => r.code === code)?.name ?? 'the room'}…`);
    });
    $('coop-make').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.make();
    });
    $('coop-host-new').addEventListener('click', () => this.host('new'));
    $('coop-host-saved').addEventListener('click', () => this.host('solo'));
    $('coop-host-coop').addEventListener('click', () => this.host('coop'));
    $('coop-join').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $<HTMLInputElement>('coop-code').value;
      const err = coop.joinRoom(input, this.password(input.toUpperCase().replace(/[^A-Z0-9]/g, '')));
      this.status(err ?? 'Joining…');
    });
    $('coop-start').addEventListener('click', () => actions.start(this.choice));
    $('coop-leave').addEventListener('click', () => {
      coop.leave();
      this.render();
      this.status('');
    });
    // Closing the dialog while waiting in a room leaves it.
    for (const el of $('coop').querySelectorAll('[data-close]')) el.addEventListener('click', () => coop.phase !== 'playing' && coop.leave());
  }

  open(): void {
    const { solo, coop } = this.actions.saves();
    $('coop-host-saved').hidden = !solo;
    $('coop-saved-note').textContent = solo ?? '';
    $('coop-host-coop').hidden = !coop;
    $('coop-coop-note').textContent = coop ?? '';
    // A new co-op game saves over the last one, never over your own factory.
    $('coop-new-note').textContent = coop ? 'Standard mode. Replaces your saved co-op game.' : 'Standard mode.';
    this.status('');
    this.render();
    this.actions.openModal('coop');
    this.showServer(undefined);
    void this.checkServer();
    if (!this.poll) this.poll = setInterval(() => void this.checkServer(), SERVER_POLL_MS);
  }

  /**
   * The password for a room (D-140): the one typed, kept in this browser for next time, or the one kept
   * from before. Empty for none.
   */
  private password(code: string): string {
    const typed = $<HTMLInputElement>('coop-password').value;
    try {
      if (typed) localStorage.setItem(passKey(code), typed);
      // A room made on the server without a password of its own has the server's (D-164).
      const main = this.actions.server.code;
      const fallback = code !== main && this.rooms.some((r) => r.code === code) ? localStorage.getItem(passKey(main)) : null;
      return typed || (localStorage.getItem(passKey(code)) ?? fallback ?? '');
    } catch {
      return typed;
    }
  }

  /**
   * Asks the server's desk for a new room (D-164), then joins it. The code is drawn here, with the server's
   * prefix, so its password can be sent hashed with it; a code that's taken is drawn again.
   */
  private async make(): Promise<void> {
    if (this.making || !this.desk || this.coop.phase !== 'idle') return;
    const name = roomName($<HTMLInputElement>('coop-make-name').value);
    if (!name) return this.status('Give the room a name.');
    const own = $<HTMLInputElement>('coop-make-pass').value;
    const main = this.actions.server.code;
    // The desk has the server's password, like its main room.
    const serverPass = this.password(main);
    const desk = this.desk;
    this.making = true;
    this.setMaking(true);
    this.status('Making the room…');
    try {
      const deskPass = await passHash(desk, serverPass);
      for (let i = 0; i < MAKE_TRIES; i++) {
        const used = new Set([main, desk, ...this.rooms.map((r) => r.code)]);
        const code = drawCode(serverPrefix(main), used);
        const reply = await this.actions.server.ask(desk, { t: 'new', code, name, pass: own ? await passHash(code, own) : '' }, deskPass);
        if (reply && 'refused' in reply) {
          if (reply.refused === 'password') {
            $('coop-pass-row').hidden = false;
            $<HTMLInputElement>('coop-password').focus();
            return this.status("Making a room needs the server's password. Type it below, then try again.");
          }
          return this.status(refusalText(reply.refused, undefined, this.actions.version));
        }
        if (!reply) return this.status("The server didn't answer. Try again in a minute.");
        if (reply.t === 'made') {
          if (own) {
            try {
              localStorage.setItem(passKey(code), own);
            } catch {
              // Typed again when joining next time.
            }
          }
          this.rooms = [...this.rooms, { code, name }];
          $<HTMLInputElement>('coop-make-name').value = '';
          $<HTMLInputElement>('coop-make-pass').value = '';
          this.coop.joinRoom(code, own || serverPass);
          return this.status(`Made ${name}. Joining…`);
        }
        if (reply.reason === 'taken') continue;
        return this.status(
          reply.reason === 'full'
            ? 'The server has as many rooms as it allows. Join one of them, or ask its owner to make space.'
            : reply.reason === 'busy'
              ? "The server couldn't open the room in time. Try again in a minute."
              : "The server couldn't make that room.",
        );
      }
      this.status("The server couldn't find a free code. Try again.");
    } finally {
      this.making = false;
      this.setMaking(false);
    }
  }

  private setMaking(on: boolean): void {
    $('coop-make').querySelector('button')!.disabled = on;
  }

  /** The room ended before the game began, or while it ran: say why. A room with a password asks for it. */
  ended(why: string): void {
    this.render();
    if (this.coop.refused === 'password') {
      $('coop-pass-row').hidden = false;
      $<HTMLInputElement>('coop-password').focus();
    }
    this.status(why);
  }

  /** Redraws the dialog for the room's phase and players. */
  render(): void {
    const c = this.coop;
    const inRoom = c.phase === 'lobby' || c.phase === 'starting';
    $('coop-choose').hidden = inRoom;
    $('coop-room').hidden = !inRoom;
    const server = c.code === this.actions.server.code || this.rooms.some((r) => r.code === c.code);
    if (c.phase === 'connecting') this.status(c.role === 'host' ? 'Opening a room…' : server ? 'Joining the server…' : 'Joining…');
    if (!inRoom) return;
    $('coop-room-code').textContent = c.code;
    // Built from elements, not HTML: the slots come from the relay, which the page's address picks.
    $('coop-players').replaceChildren(
      ...c.players.map((s) => {
        const li = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = PLAYER_COLORS[s % PLAYER_COLORS.length];
        const who = s === c.slot ? 'You' : s === 0 && server ? 'Server' : `Player ${s + 1}`;
        li.append(swatch, who + (s === 0 && !server ? ' (host)' : ''));
        return li;
      }),
    );
    const host = c.role === 'host';
    const start = $<HTMLButtonElement>('coop-start');
    start.hidden = !host;
    start.disabled = c.players.length < 2 || c.phase === 'starting';
    if (c.phase === 'starting') this.status('Starting…');
    else if (host) this.status(c.players.length < 2 ? 'Share the code. Start once everyone is in.' : 'Everyone in? Press Start.');
    // The server's game is already running: it sends a copy at once.
    else this.status(server ? 'Getting the game from the server…' : 'Waiting for the host to start.');
  }

  /** Asks the relay how the server is, while the dialog shows the choices; stops once it's closed. */
  private async checkServer(): Promise<void> {
    if ($('coop').hidden) {
      if (this.poll) clearInterval(this.poll);
      this.poll = null;
      return;
    }
    if (this.coop.phase !== 'idle') return;
    const ask = ++this.asked;
    const status = await this.actions.server.status(this.actions.server.code);
    if (ask !== this.asked) return;
    this.showServer(status);
    // The rooms players made, listed by the main room (D-164), each with its own status.
    // Shown while the server is up on this version, even when its main room is full.
    const up = status?.open && status.version === this.actions.version ? status : null;
    this.rooms = up?.info?.rooms ?? [];
    this.desk = up?.info?.desk ?? null;
    const statuses = await Promise.all(this.rooms.map((r) => this.actions.server.status(r.code)));
    if (ask === this.asked) this.showRooms(statuses);
  }

  /** The made rooms' rows, and the form to make one when the server has a desk. */
  private showRooms(statuses: (RoomStatus | null)[]): void {
    $('coop-rooms').hidden = !this.desk && !this.rooms.length;
    $('coop-make-box').hidden = !this.desk;
    $('coop-room-list').replaceChildren(
      ...this.rooms.map((room, i) => {
        // Built from elements, not HTML: the names come from players, through the relay.
        const v = serverView(statuses[i], this.actions.version);
        const li = document.createElement('li');
        li.dataset.state = v.state;
        const text = document.createElement('div');
        text.className = 'coop-room-text';
        const head = document.createElement('div');
        head.className = 'coop-room-head';
        const name = document.createElement('b');
        name.textContent = room.name;
        const state = document.createElement('span');
        state.className = 'coop-state';
        state.textContent = v.label;
        head.append(name, state);
        const facts = document.createElement('small');
        facts.textContent = v.facts ? `${v.facts.game} · ${v.facts.players} players` : (v.note ?? '');
        text.append(head, facts);
        const join = document.createElement('button');
        join.dataset.code = room.code;
        join.textContent = 'Join';
        join.disabled = !v.canJoin;
        li.append(text, join);
        return li;
      }),
    );
  }

  private showServer(status: RoomStatus | null | undefined): void {
    const v = serverView(status, this.actions.version);
    $('coop-server').dataset.state = v.state;
    $('coop-server-name').textContent = v.name;
    $('coop-server-state').textContent = v.label;
    $('coop-server-facts').hidden = !v.facts;
    if (v.facts) {
      $('coop-server-players').textContent = v.facts.players;
      $('coop-server-game').textContent = v.facts.game;
      $('coop-server-version').textContent = v.facts.version;
    }
    $('coop-server-note').hidden = !v.note;
    $('coop-server-note').textContent = v.note ?? '';
    $<HTMLButtonElement>('coop-server-join').disabled = !v.canJoin;
  }

  private host(choice: HostChoice): void {
    this.choice = choice;
    this.coop.hostRoom();
  }

  private status(text: string): void {
    $('coop-status').textContent = text;
  }
}

/** Where a room's password is kept in this browser (D-140). */
function passKey(code: string): string {
  return `foundry-front-pass-${code}`;
}

/** A new room code starting with `prefix` (the server's, D-164) that isn't one of `used`. */
export function drawCode(prefix: string, used: Set<string>): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    let code = prefix;
    for (let i = prefix.length; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (!used.has(code)) return code;
  }
}
