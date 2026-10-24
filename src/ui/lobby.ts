// The Play together dialog (co-op phase 1, D-078): host a new or saved game, or join one with its room
// code, then wait in the room until the host starts. The room itself is in net/coop.ts.

import type { Coop } from '../net/coop';
import { PLAYER_COLORS } from './state';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface LobbyActions {
  /** A line about the saved game, or null if there's none to host. */
  savedGame(): string | null;
  /** Whether hosting a new game replaces a saved one. */
  hasGame(): boolean;
  /** The host presses Start: share a new game, or the saved one. */
  start(saved: boolean): void;
  openModal(id: string): void;
  closeModals(): void;
}

export class Lobby {
  /** What the host chose to share, kept until Start. */
  private saved = false;

  constructor(
    private coop: Coop,
    private actions: LobbyActions,
  ) {
    $('coop-host-new').addEventListener('click', () => this.host(false));
    $('coop-host-saved').addEventListener('click', () => this.host(true));
    $('coop-join').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = coop.joinRoom($<HTMLInputElement>('coop-code').value);
      this.status(err ?? 'Joining…');
    });
    $('coop-start').addEventListener('click', () => actions.start(this.saved));
    $('coop-leave').addEventListener('click', () => {
      coop.leave();
      this.render();
      this.status('');
    });
    // Closing the dialog while waiting in a room leaves it.
    for (const el of $('coop').querySelectorAll('[data-close]')) el.addEventListener('click', () => coop.phase !== 'playing' && coop.leave());
  }

  open(): void {
    const saved = this.actions.savedGame();
    $('coop-host-saved').hidden = !saved;
    $('coop-saved-note').textContent = saved ?? '';
    $('coop-new-note').textContent = this.actions.hasGame() ? 'Standard mode. Your saved factory will be lost.' : 'Standard mode.';
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

  private host(saved: boolean): void {
    this.saved = saved;
    this.coop.hostRoom();
  }

  private status(text: string): void {
    $('coop-status').textContent = text;
  }
}
