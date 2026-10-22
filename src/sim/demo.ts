// A small pre-built factory that runs behind the main menu.

import { Dir, NESTS, RESEARCH } from './data';
import { cellKey } from './nests';
import { TREE, World } from './world';

const IRON = 1;
const COPPER = 2;
const STONE = 3;

export function createDemoWorld(seed = 20261019): World {
  const w = World.create(seed);
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.inventory = { iron_plate: 9999, copper_ingot: 9999, brick: 9999, gear: 9999, wire: 9999, motor: 9999 };
  const hub = w.hub!;
  const hx = hub.x;
  const hy = hub.y;
  const iy = hy + 2; // the hub's middle row

  // Clear random nodes and trees near the hub and lay out our own.
  for (let y = hy - 20; y <= hy + 22; y++) {
    for (let x = hx - 22; x <= hx + 24; x++) if (w.inBounds(x, y)) s.resources[w.idx(x, y)] = s.trees[w.idx(x, y)] = 0;
  }
  const ore = (x: number, y: number, kind: number) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.resources[w.idx(x + dx, y + dy)] = kind;
  };
  const put = (type: Parameters<World['place']>[0], x: number, y: number, dir: Dir) => w.place(type, x, y, dir);
  const line = (x0: number, y0: number, x1: number, y1: number, dir: Dir) => {
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    for (let x = x0, y = y0; ; x += dx, y += dy) {
      put('belt', x, y, dir);
      if (x === x1 && y === y1) break;
    }
  };

  // Iron from the west: extractor → furnace → splitter (branch to a turret) → hub.
  ore(hx - 16, iy, IRON);
  put('extractor', hx - 16, iy, 0);
  put('belt', hx - 14, iy, 0);
  put('furnace', hx - 13, iy, 0);
  line(hx - 11, iy, hx - 9, iy, 0);
  put('splitter', hx - 8, iy, 0);
  line(hx - 7, iy, hx - 1, iy, 0);
  put('belt', hx - 8, iy - 1, 3);
  put('turret', hx - 8, iy - 2, 0);

  // Copper from the east into a workshop making wire, then the hub.
  ore(hx + 16, iy, COPPER);
  put('extractor', hx + 16, iy, 2);
  put('belt', hx + 15, iy, 2);
  put('furnace', hx + 13, iy, 2);
  put('belt', hx + 12, iy, 2);
  put('workshop', hx + 9, iy, 2);
  line(hx + 8, iy, hx + 5, iy, 2);

  // Stone from the south, under a wall, into the hub.
  const sx = hx + 2;
  ore(sx, hy + 16, STONE);
  put('extractor', sx, hy + 16, 3);
  put('belt', sx, hy + 15, 3);
  put('furnace', sx, hy + 13, 3);
  put('belt', sx, hy + 12, 3);
  put('tunnel', sx, hy + 11, 3);
  put('tunnel', sx, hy + 8, 3);
  line(sx, hy + 7, sx, hy + 5, 3);

  // Wood from the north: a grove, a lumber camp, a sawmill, then planks down into the hub.
  const wx = hx + 2;
  for (let y = hy - 17; y <= hy - 13; y++) {
    for (let x = hx - 1; x <= hx + 6; x++) if ((x + y) % 5) s.trees[w.idx(x, y)] = TREE;
  }
  put('lumber_camp', wx, hy - 12, 1);
  put('sawmill', wx, hy - 10, 1);
  line(wx, hy - 8, wx, hy - 1, 1);

  // Defences around the hub.
  for (let x = hx - 3; x <= hx + 7; x++) put('wall', x, hy + 10, 0);
  put('turret', hx - 2, hy - 2, 0);
  put('turret', hx + 6, hy - 2, 0);
  put('cannon', hx + 6, hy + 6, 0);
  put('repair', hx - 2, hy + 6, 0);

  // A calm bug territory in view, so the menu shows some life.
  const c = NESTS.cell;
  const nest = { id: s.nests.length, x: Math.floor((hx - 14) / c) * c, y: Math.floor((hy - 18) / c) * c, angryUntil: 0 };
  s.nests.push(nest);
  w.nestCells.set(cellKey(nest.x / c, nest.y / c), nest);
  for (let i = 0; i < 4; i++) w.spawnBug(i % 3 ? 'crawler' : 'runner', nest, 1);
  return w;
}

/** Keeps the demo going forever: the hub never falls, turrets never run dry, and the bugs stay calm. */
export function sustainDemo(w: World): void {
  const hub = w.hub;
  if (hub && hub.hp < 500) hub.hp = 1000;
  for (const b of w.state.buildings) if ((b.type === 'turret' || b.type === 'cannon') && b.ammo < 6) b.ammo += 6;
  for (const n of w.state.nests) n.angryUntil = 0;
}
