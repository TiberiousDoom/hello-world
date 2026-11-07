import { describe, expect, it } from 'vitest';
import { moveOldStorage } from './storage-move';

/** A plain in-memory Storage. */
function memory(entries: Record<string, string>): Storage {
  const m = new Map(Object.entries(entries));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('moving storage from the old name (D-194)', () => {
  it('moves foundry-front keys to nestfall keys, keeps newer ones and leaves others alone', () => {
    const s = memory({ 'foundry-front-profile': '{"a":1}', 'foundry-front-save': 'old', 'nestfall-save': 'new', other: 'x' });
    moveOldStorage(s);
    expect(s.getItem('nestfall-profile')).toBe('{"a":1}');
    expect(s.getItem('nestfall-save')).toBe('new');
    expect(s.getItem('foundry-front-profile')).toBeNull();
    expect(s.getItem('foundry-front-save')).toBeNull();
    expect(s.getItem('other')).toBe('x');
  });
});
