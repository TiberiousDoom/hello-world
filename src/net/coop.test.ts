import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { seatPlayers } from './coop';

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
