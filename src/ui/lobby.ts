// The Play together dialog (D-078, D-079): host a new game, your own factory or a co-op game saved in
// this browser, or join one with its room code (in the lobby or under way). The room is in net/coop.ts.

import type { Coop } from '../net/coop';
import { PLAYER_COLORS } from './state';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** What the host shares: a new game, their own saved factory, or the co-op game saved in this browser. */
export type HostChoice = 'new' | 'solo' | 'coop';

export interface LobbyActions {
  /** A line about each saved game, or null where there's none to host. */
  saves(): { solo: string | null; coop: string | null };
  /** The host presses Start. */
  start(choice: HostChoice): void;
  openModal(id: string): void;
  closeModals(): void;
}

export class Lobby {
  /** What the host chose to share, kept until Start. */
  private choice: HostChoice = 'new';

  constructor(
    private coop: Coop,
    private actions: LobbyActions,
  ) {
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
    if (c.phase === 'connecting') this.status(c.role === 'host' ? 'Opening a room…' : 'Joining…');
    if (!inRoom) return;
    $('coop-room-code').textContent = c.code;
    $('coop-players').innerHTML = c.players
      .map((s) => {
        const who = s === c.slot ? 'You' : `Player ${s + 1}`;
        const role = s === 0 ? ' (host)' : '';
        return `<li><span class="swatch" style="background:${PLAYER_COLORS[s]}"></span>${who}${role}</li>`;
      })
      .join('');
    const host = c.role === 'host';
    const start = $<HTMLButtonElement>('coop-start');
    start.hidden = !host;
    start.disabled = c.players.length < 2 || c.phase === 'starting';
    if (c.phase === 'starting') this.status('Starting…');
    else if (host) this.status(c.players.length < 2 ? 'Share the code. Start once everyone is in.' : 'Everyone in? Press Start.');
    else this.status('Waiting for the host to start.');
  }

  private host(choice: HostChoice): void {
    this.choice = choice;
    this.coop.hostRoom();
  }

  private status(text: string): void {
    $('coop-status').textContent = text;
  }
}
