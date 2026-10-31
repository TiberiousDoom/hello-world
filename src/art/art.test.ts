import { describe, expect, it } from 'vitest';
import { stripFrames, tilesOf } from './index';

// Animation strips (D-082): square frames side by side, the count in the name.
const sources = import.meta.glob<string>('./**/*_*f.svg', { query: '?raw', import: 'default', eager: true });

describe('Animation strips', () => {
  it('read their frame count from the name', () => {
    expect(stripFrames('enemies/crawler_walk_4f')).toBe(4);
    expect(stripFrames('effects/explosion_6f')).toBe(6);
    expect(stripFrames('enemies/crawler')).toBe(0);
    expect(stripFrames('buildings/ship_life')).toBe(0);
  });

  it('are as wide as their frames side by side', () => {
    const strips = Object.entries(sources).filter(([path]) => stripFrames(path.replace(/\.svg$/, '')) > 0);
    expect(strips.length).toBeGreaterThan(20);
    for (const [path, svg] of strips) {
      const key = path.replace(/^\.\//, '').replace(/\.svg$/, '');
      const n = stripFrames(key);
      const [tw, th] = tilesOf(key.replace(/_\d+f$/, '')); // a frame is as many tiles as the sprite (the water wheel is 3×1)
      const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) ?? [];
      expect(Number(w), path).toBe((n * Number(h) * tw) / th);
    }
  });

  it('cover every machine that works, every bug and the engineer', () => {
    const names = Object.keys(sources).map((p) => p.replace(/^\.\//, '').replace(/\.svg$/, ''));
    for (const type of ['extractor', 'furnace', 'workshop', 'assembler', 'repair', 'lumber_camp', 'sawmill']) expect(names).toContain(`buildings/${type}_working_4f`);
    for (const bug of ['crawler', 'runner', 'brute']) for (const what of ['walk', 'attack']) expect(names).toContain(`enemies/${bug}_${what}_4f`);
    for (const what of ['walk', 'work', 'idle', 'ko']) expect(names).toContain(`units/engineer_${what}_4f`);
  });
});

describe('Nests and queens (D-152)', () => {
  const art = Object.keys(import.meta.glob('./**/*.svg')).map((p) => p.replace(/^\.\//, '').replace(/\.svg$/, ''));

  it('have a drawing for every kind at every stage, a queen nest of every kind and a queen of every bug', () => {
    for (const kind of ['warren', 'runnel', 'hive', 'den', 'barrow']) for (const stage of ['1', '2', '3', 'queen']) expect(art).toContain(`nests/${kind}_${stage}`);
    for (const bug of ['crawler', 'runner', 'brute', 'wasp', 'beetle']) expect(art).toContain(`enemies/${bug}_queen`);
    for (const key of ['nests/angry', 'nests/damaged', 'nests/destroyed']) expect(art).toContain(key);
  });
});
