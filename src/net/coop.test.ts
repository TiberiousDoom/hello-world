import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { askDesk } from './client';
import { Coop, seatPlayers } from './coop';
import { DeskAsk, HEARTBEAT, cleanAsk, passHash } from './protocol';
import type { Session } from '../sim/session';

describe('Starting a co-op game', () => {
  it('gives every player in the room an engineer', () => {
    const w = World.create(1);
    seatPlayers(w, [0, 1, 2], false);
    expect(w.state.players.map((p) => p.id)).toEqual([0, 1, 2]);
  });

  it('gives a headless host (the dedicated server) none, taking away the one a game came with (#184)', () => {
    const w = World.create(1);
    expect(w.state.players.map((p) => p.id)).toEqual([0]);
    seatPlayers(w, [0, 1, 3], true);
    expect(w.state.players.map((p) => p.id)).toEqual([1, 3]);
    // The game still runs with no engineer 0.
    for (let i = 0; i < 40; i++) w.tick();
    expect(w.state.players.map((p) => p.id)).toEqual([1, 3]);
  });
});

describe("The dedicated server's desk (D-164)", () => {
  // The local room (a BroadcastChannel, as two tabs use) runs the relay's own rules from room.ts.
  it('answers a request from a player with the password, and turns away one without it', async () => {
    const desk = new Coop('local', '1.0.0');
    const asked: DeskAsk[] = [];
    desk.onAsk = (slot, data) => {
      const ask = cleanAsk(data);
      if (ask) asked.push(ask);
      desk.reply(slot, JSON.stringify(ask ? { t: 'made', code: ask.code } : { t: 'no', reason: 'bad' }));
    };
    desk.hostRoom('764DZZ', 'k', await passHash('764DZZ', 'hunter2'));
    for (let i = 0; i < 100 && desk.phase !== 'lobby'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(desk.phase).toBe('lobby');

    const ask: DeskAsk = { t: 'new', code: '764DAB', name: 'Night shift', pass: '' };
    expect(await askDesk('local', '764DZZ', '1.0.0', await passHash('764DZZ', 'hunter2'), ask)).toEqual({ t: 'made', code: '764DAB' });
    expect(asked).toEqual([ask]);
    expect(await askDesk('local', '764DZZ', '1.0.0', '', ask)).toEqual({ refused: 'password' });
    expect(await askDesk('local', '764DZZ', '2.0.0', await passHash('764DZZ', 'hunter2'), ask)).toEqual({ refused: 'version' });
    // The desk never starts a game, and the player who asked goes again (its leaving arrives after the answer).
    expect(desk.phase).toBe('lobby');
    for (let i = 0; i < 100 && desk.players.length > 1; i++) await new Promise((r) => setTimeout(r, 10));
    expect(desk.players).toEqual([0]);
    desk.leave();
    // Nobody there: no answer.
    expect(await askDesk('local', '764DZZ', '1.0.0', '', ask, 2000)).toEqual({ refused: 'no-room' });
  });

  it('gets its room back quietly after its connection drops, and answers again', async () => {
    const desk = new Coop('local', '1.0.0');
    const notices: string[] = [];
    let ended = false;
    desk.onNotice = (text) => notices.push(text);
    desk.onEnd = () => (ended = true);
    desk.onAsk = (slot, data) => desk.reply(slot, JSON.stringify({ t: 'made', code: cleanAsk(data)!.code }));
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 300 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(ok()).toBe(true);
    };
    desk.hostRoom('764DYY', 'k');
    await until(() => desk.phase === 'lobby');
    (desk as unknown as { link: { drop(): void } }).link.drop();
    await until(() => notices.includes('Back in the room.'));
    expect(notices).toEqual(['Connection lost. Getting the room back…', 'Back in the room.']);
    expect(ended).toBe(false);
    expect(desk.phase).toBe('lobby');
    const ask: DeskAsk = { t: 'new', code: '764DAB', name: 'Again', pass: '' };
    expect(await askDesk('local', '764DYY', '1.0.0', '', ask)).toEqual({ t: 'made', code: '764DAB' });
    desk.leave();
  });
});

describe('An empty room', () => {
  it("sends the relay nothing but heartbeats, so the relay's room can sleep, and turns start again once someone joins", async () => {
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 300 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(ok()).toBe(true);
    };
    const host = new Coop('local', '1.0.0');
    host.headless = true;
    host.hostRoom('764DQQ', 'k');
    await until(() => host.phase === 'lobby');
    await host.start(World.create(3));
    const sent: string[] = [];
    const link = (host as unknown as { link: { send(text: string): void } }).link;
    const send = link.send.bind(link);
    link.send = (text) => {
      if (text !== HEARTBEAT) sent.push(text);
      send(text);
    };
    // A minute of game time, paused and running: no turns, no keepalives.
    let now = 0;
    const beat = (speed: number) => {
      host.host!.tick();
      host.host!.flush(speed, (now += 50));
    };
    for (let i = 0; i < 1200; i++) beat(i < 600 ? 0 : 1);
    expect(sent).toEqual([]);

    const guest = new Coop('local', '1.0.0');
    let shared: Session | null = null;
    guest.onStart = (s) => (shared = s);
    guest.joinRoom('764DQQ');
    await until(() => shared != null);
    sent.length = 0;
    for (let i = 0; i < 40; i++) beat(1);
    expect(sent.length).toBeGreaterThan(0);
    guest.leave();
    host.leave();
  });
});
