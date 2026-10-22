import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../sim/data';
import { Building, World } from '../sim/world';
import { beltLook } from './belts';

function emptyWorld(): World {
  const w = World.create(1);
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999, gear: 999, plank: 999 };
  return w;
}

const put = (w: World, ...args: Parameters<World['place']>): Building => {
  const r = w.place(...args);
  if (typeof r === 'string') throw new Error(r);
  return r;
};

describe('belt looks', () => {
  it('caps the ends of a straight line', () => {
    const w = emptyWorld();
    const [a, b, c] = [5, 6, 7].map((x) => put(w, 'belt', x, 5, 0));
    expect(beltLook(w, a)).toMatchObject({ curved: false, fed: false, joined: true });
    expect(beltLook(w, b)).toMatchObject({ curved: false, fed: true, joined: true, from: 2 });
    expect(beltLook(w, c)).toMatchObject({ fed: true, joined: false });
  });

  it('curves where a line turns', () => {
    const w = emptyWorld();
    put(w, 'belt', 5, 5, 0); // east
    const corner = put(w, 'belt', 6, 5, 1); // then south
    put(w, 'belt', 6, 6, 1);
    expect(beltLook(w, corner)).toMatchObject({ curved: true, from: 2, joined: true });
  });

  it('stays straight when side feeders merge onto a line', () => {
    const w = emptyWorld();
    put(w, 'belt', 5, 5, 0);
    const main = put(w, 'belt', 6, 5, 0);
    put(w, 'belt', 6, 4, 1); // feeds in from the north side
    expect(beltLook(w, main)).toMatchObject({ curved: false, from: 2 });
  });

  it('joins splitters, machines and tunnels', () => {
    const w = emptyWorld();
    put(w, 'splitter', 5, 5, 0);
    const side = put(w, 'belt', 5, 6, 1); // takes the splitter's right output and heads south
    const turned = put(w, 'belt', 5, 4, 0); // takes its left output but heads east: a curve
    expect(beltLook(w, side)).toMatchObject({ curved: false, fed: true, from: 3 });
    expect(beltLook(w, turned)).toMatchObject({ curved: true, from: 1 });
    const intoFurnace = put(w, 'belt', 10, 5, 0);
    put(w, 'furnace', 11, 5, 0);
    expect(beltLook(w, intoFurnace).joined).toBe(true);
    const intoWall = put(w, 'belt', 10, 8, 0);
    put(w, 'wall', 11, 8, 0);
    expect(beltLook(w, intoWall).joined).toBe(false);
    put(w, 'tunnel', 20, 5, 0);
    const exit = put(w, 'tunnel', 23, 5, 0);
    const after = put(w, 'belt', 24, 5, 0);
    expect(exit.link).not.toBeNull();
    expect(beltLook(w, after).fed).toBe(true);
  });

  it('a big machine feeds only the belt at the middle of its front edge', () => {
    const w = emptyWorld();
    put(w, 'workshop', 20, 20, 0); // 3 wide, 2 deep: outputs from (22, 20) to (23, 20)
    const fed = put(w, 'belt', 23, 20, 0);
    const beside = put(w, 'belt', 23, 21, 0);
    expect(beltLook(w, fed).fed).toBe(true);
    expect(beltLook(w, beside).fed).toBe(false);
  });
});
