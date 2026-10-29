import { describe, expect, it } from 'vitest';
import { benchWorld } from './scenario';
import { BLOCK, TICK } from './world';

describe('Performance budget (ROADMAP: 1,000 buildings and 200 bugs)', () => {
  it('a big base under attack at night ticks well inside its share of a frame', () => {
    const w = benchWorld();
    expect(w.state.buildings.length).toBeGreaterThan(1000);
    expect(w.state.enemies.length).toBe(200);
    for (let i = 0; i < 40; i++) w.tick(TICK); // paths worked out, the fight under way
    const times: number[] = [];
    for (let i = 0; i < 300; i++) {
      const t0 = performance.now();
      w.tick(TICK);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b) / times.length;
    console.log(`tick: ${avg.toFixed(2)} ms on average`);
    // 20 ticks a second must leave most of each 16 ms frame for drawing, on a phone several times slower
    // than this machine. About 1 ms here when this was set; a repair station looking through every
    // building every tick had made it 8.
    expect(avg).toBeLessThan(5);
  }, 60_000);

  it('keeps a count of building tiles per block, for searches that skip empty ground', () => {
    const w = benchWorld();
    const count = () => {
      const c = new Uint16Array(w.blocks.length);
      for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i]) c[w.blockOf(i % w.state.width, Math.floor(i / w.state.width))]++;
      return c;
    };
    expect(w.blocks).toEqual(count());
    for (const b of w.state.buildings.filter((b) => b.type === 'furnace').slice(0, 20)) w.demolish(b.id);
    for (let i = 0; i < 100; i++) w.tick(TICK); // bugs destroy some too
    expect(w.blocks).toEqual(count());
    expect(BLOCK).toBe(8);
  }, 60_000);
});
