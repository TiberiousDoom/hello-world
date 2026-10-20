// A small pre-built factory that runs behind the main menu.

import { Dir, RESEARCH } from './data';
import { World } from './world';

const IRON = 1;
const COPPER = 2;
const STONE = 3;

export function createDemoWorld(seed = 20261019): World {
  const w = World.create(seed);
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.inventory = { iron_plate: 9999, copper_ingot: 9999, brick: 9999, gear: 9999, wire: 9999, motor: 9999 };
  s.nextWaveAt = 20; // some action soon after the menu opens
  const hub = w.hub!;
  const hx = hub.x;
  const hy = hub.y;

  // Clear random nodes near the hub and lay out our own.
  for (let y = hy - 14; y <= hy + 16; y++) {
    for (let x = hx - 16; x <= hx + 18; x++) if (w.inBounds(x, y)) s.resources[w.idx(x, y)] = 0;
  }
  const node = (x: number, y: number, kind: number) => (s.resources[w.idx(x, y)] = kind);
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
  const iy = hy + 1;
  for (const [x, y] of [[hx - 12, iy], [hx - 13, iy], [hx - 12, iy + 1], [hx - 13, iy - 1]]) node(x, y, IRON);
  put('extractor', hx - 12, iy, 0);
  put('belt', hx - 11, iy, 0);
  put('furnace', hx - 10, iy, 0);
  line(hx - 9, iy, hx - 7, iy, 0);
  put('splitter', hx - 6, iy, 0);
  line(hx - 5, iy, hx - 1, iy, 0);
  put('belt', hx - 6, iy - 1, 3);
  put('turret', hx - 6, iy - 2, 0);

  // Copper from the east into a workshop making wire, then the hub.
  const cy = hy + 1;
  for (const [x, y] of [[hx + 14, cy], [hx + 15, cy], [hx + 14, cy - 1], [hx + 15, cy + 1]]) node(x, y, COPPER);
  put('extractor', hx + 14, cy, 2);
  put('belt', hx + 13, cy, 2);
  put('furnace', hx + 12, cy, 2);
  put('belt', hx + 11, cy, 2);
  put('workshop', hx + 10, cy, 2);
  line(hx + 9, cy, hx + 3, cy, 2);

  // Stone from the south, under a wall, into the hub.
  const sx = hx + 1;
  for (const [x, y] of [[sx, hy + 13], [sx + 1, hy + 13], [sx, hy + 14], [sx - 1, hy + 14]]) node(x, y, STONE);
  put('extractor', sx, hy + 13, 3);
  put('belt', sx, hy + 12, 3);
  put('furnace', sx, hy + 11, 3);
  put('belt', sx, hy + 10, 3);
  put('tunnel', sx, hy + 9, 3);
  put('tunnel', sx, hy + 6, 3);
  line(sx, hy + 5, sx, hy + 3, 3);

  // Defenses around the hub.
  for (let x = hx - 3; x <= hx + 5; x++) if (x !== sx) put('wall', x, hy + 7, 0);
  put('turret', hx - 2, hy - 2, 0);
  put('turret', hx + 4, hy - 2, 0);
  put('cannon', hx + 4, hy + 5, 0);
  put('repair', hx - 2, hy + 5, 0);
  return w;
}

/** Keeps the demo going forever: the hub never falls and turrets never run dry. */
export function sustainDemo(w: World): void {
  const hub = w.hub;
  if (hub && hub.hp < 300) hub.hp = 600;
  for (const b of w.state.buildings) if ((b.type === 'turret' || b.type === 'cannon') && b.ammo < 6) b.ammo += 6;
}
