import { describe, expect, it } from 'vitest';
import type { RoomStatus } from '../net/protocol';
import { compareVersions, serverView } from './lobby';

const online = (o: Partial<RoomStatus> = {}): RoomStatus => ({
  open: true,
  away: false,
  version: '0.44.0',
  players: 3,
  max: 10,
  info: { name: "Stephen's server", day: 12, season: 'Winter' },
  ...o,
});

describe('The dedicated server on the Play together screen (D-086)', () => {
  it('compares versions by number', () => {
    expect(compareVersions('0.44.0', '0.44.0')).toBe(0);
    expect(compareVersions('0.9.0', '0.10.0')).toBe(-1);
    expect(compareVersions('1.0', '0.99.9')).toBe(1);
  });

  it('shows an online server with its name, players, day and version, and lets you join', () => {
    expect(serverView(online(), '0.44.0')).toEqual({
      state: 'online',
      label: 'Online',
      name: "Stephen's server",
      facts: { players: '3 of 9', game: 'Day 12 · Winter', version: '0.44.0' },
      note: null,
      canJoin: true,
    });
    expect(serverView(online({ info: null }), '0.44.0')).toMatchObject({ name: 'Dedicated server', facts: { game: '—' } });
  });

  it("says why Join won't work: offline, reconnecting, full, or another version", () => {
    const v = (s: RoomStatus | null | undefined, mine = '0.44.0') => serverView(s, mine);
    expect(v(undefined)).toMatchObject({ state: 'checking', canJoin: false });
    expect(v(online({ open: false, info: null, version: null }))).toMatchObject({ state: 'offline', canJoin: false });
    expect(v(online({ open: false, away: true }))).toMatchObject({ state: 'away', canJoin: false });
    expect(v(online({ players: 9 }))).toMatchObject({ state: 'full', label: 'Full', canJoin: false });
    const older = v(online({ version: '0.43.0' }));
    expect(older).toMatchObject({ state: 'version', label: 'Updating', canJoin: false });
    expect(older.note).toMatch(/updates itself once nobody is playing/);
    const newer = v(online({ version: '0.45.0' }));
    expect(newer).toMatchObject({ state: 'version', label: 'Reload', canJoin: false });
    expect(newer.note).toMatch(/Reload the page/);
  });

  it("lets you try when the server can't be checked", () => {
    expect(serverView(null, '0.44.0')).toMatchObject({ state: 'unknown', canJoin: true });
  });
});
