// The Play together dialog (D-078, D-079, D-086): join the dedicated server with one button, host a new
// game, your own factory or a co-op game saved in this browser, or join a friend's with its room code (in
// the lobby or under way). The room is in net/coop.ts.

import type { Coop } from '../net/coop';
import type { RoomStatus } from '../net/protocol';
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
  /** The dedicated server's room code, and how to ask the relay about it (D-086). */
  server: { code: string; status(): Promise<RoomStatus | null> };
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

export class Lobby {
  /** What the host chose to share, kept until Start. */
  private choice: HostChoice = 'new';
  /** Checks the server's status while the dialog shows the choices. */
  private poll: ReturnType<typeof setInterval> | null = null;
  /** The latest check, so an older answer arriving late doesn't replace it. */
  private asked = 0;

  constructor(
    private coop: Coop,
    private actions: LobbyActions,
  ) {
    $('coop-server-join').addEventListener('click', () => {
      coop.joinRoom(actions.server.code);
      this.status('Joining the server…');
    });
    $('coop-host-new').addEventListener('click', () => this.host('new'));
    $('coop-host-saved').addEventListener('click', () => this.host('solo'));
    $('coop-host-coop').addEventListener('click', () => this.host('coop'));
    $('coop-join').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = coop.joinRoom($<HTMLInputElement>('coop-code').value);
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

  /** The room ended before the game began, or while it ran: say why. */
  ended(why: string): void {
    this.render();
    this.status(why);
  }

  /** Redraws the dialog for the room's phase and players. */
  render(): void {
    const c = this.coop;
    const inRoom = c.phase === 'lobby' || c.phase === 'starting';
    $('coop-choose').hidden = inRoom;
    $('coop-room').hidden = !inRoom;
    const server = c.code === this.actions.server.code;
    if (c.phase === 'connecting') this.status(c.role === 'host' ? 'Opening a room…' : server ? 'Joining the server…' : 'Joining…');
    if (!inRoom) return;
    $('coop-room-code').textContent = c.code;
    $('coop-players').innerHTML = c.players
      .map((s) => {
        const who = s === c.slot ? 'You' : s === 0 && server ? 'Server' : `Player ${s + 1}`;
        const role = s === 0 && !server ? ' (host)' : '';
        return `<li><span class="swatch" style="background:${PLAYER_COLORS[s % PLAYER_COLORS.length]}"></span>${who}${role}</li>`;
      })
      .join('');
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
    const status = await this.actions.server.status();
    if (ask === this.asked) this.showServer(status);
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
