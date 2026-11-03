import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { iosSafariTab, readSave, saveFileName, saveSummary } from './saves';

describe('Saves to take away (D-172)', () => {
  it('reads back an exported save, and says what it is', () => {
    const w = World.create(7);
    w.state.time = 125;
    const r = readSave(w.toJSON());
    expect('world' in r && r.world.state.time).toBe(125);
    expect(saveSummary(w)).toBe('Standard · 2 min played');
    w.state.ship.runs = 1;
    expect(saveSummary(w)).toBe('Standard · 1 supply run delivered');
  });

  it("refuses what isn't a save, or a run that has ended", () => {
    expect(readSave('not json')).toHaveProperty('error');
    expect(readSave('{"hello":1}')).toEqual({ error: "That file isn't a Nestfall save, or it's damaged." });
    expect(readSave('[1,2]')).toHaveProperty('error');
    // A real save from before v8 still says why.
    expect(readSave('{"version":5,"buildings":[]}')).toEqual({ error: expect.stringContaining('early version') });
    const w = World.create(7);
    w.state.gameOver = true;
    expect(readSave(w.toJSON())).toHaveProperty('error');
  });

  it('names the file after the game and the day', () => {
    const w = World.create(7);
    w.state.time = 3600;
    expect(saveFileName(w, new Date('2026-11-03T12:00:00Z'))).toBe('nestfall-standard-60min-2026-11-03.json');
  });

  it('tells Safari tabs on an iPhone or iPad apart from the home screen app and other browsers', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.2 Mobile/15E148 Safari/604.1';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.2 Safari/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';
    expect(iosSafariTab(iphone, 5, false)).toBe(true);
    expect(iosSafariTab(iphone, 5, true)).toBe(false);
    expect(iosSafariTab(ipad, 5, false)).toBe(true);
    expect(iosSafariTab(ipad, 0, false)).toBe(false); // a Mac
    expect(iosSafariTab(android, 5, false)).toBe(false);
  });
});
