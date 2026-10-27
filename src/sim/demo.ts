// Small pre-built factories that run behind the main menu, one after another (#99).

import { BuildingType, Dir, FUEL, HUB_SIZE, NESTS, RESEARCH, TURRETS, burnsFuel } from './data';
import { cellKey, newNest } from './nests';
import { Building, TREE, World } from './world';

const IRON = 1;
const COPPER = 2;
const STONE = 3;

/** Helpers for laying out a scene around the hub. */
interface Kit {
  w: World;
  hx: number;
  hy: number;
  /** The hub's middle row and column. */
  mx: number;
  my: number;
  put(type: BuildingType, x: number, y: number, dir: Dir): Building | undefined;
  ore(x: number, y: number, kind: number): void;
  /** A straight line of `type` from (x0, y0) to (x1, y1), each one facing `dir`. */
  line(type: BuildingType, x0: number, y0: number, x1: number, y1: number, dir: Dir): void;
  grove(x0: number, y0: number, x1: number, y1: number): void;
  nest(x: number, y: number, bugs: number): void;
}

/** A scene: its caption on the main menu, and how to build it. */
export interface DemoScene {
  name: string;
  seed: number;
  build(k: Kit): void;
}

export const DEMO_SCENES: DemoScene[] = [
  {
    name: 'Industry',
    seed: 20261019,
    build: ({ hx, hy, mx, my, put, ore, line, grove, nest }) => {
      // Iron from the west: extractor → furnace → blacksmith → splitter (its second lane feeds a turret) → hub.
      ore(hx - 16, my, IRON);
      put('extractor', hx - 16, my, 0);
      put('belt', hx - 14, my, 0);
      put('furnace', hx - 13, my, 0);
      put('blacksmith', hx - 11, my, 0);
      put('belt', hx - 9, my, 0);
      put('splitter', hx - 8, my, 0);
      line('belt', hx - 7, my, hx - 1, my, 0);
      put('belt', hx - 7, my + 1, 0);
      put('turret', hx - 6, my + 1, 0);
      // Copper from the east into a machine shop making wire, then the hub.
      const ex = hx + HUB_SIZE;
      ore(ex + 11, my, COPPER);
      put('extractor', ex + 11, my, 2);
      put('belt', ex + 10, my, 2);
      put('furnace', ex + 8, my, 2);
      put('belt', ex + 7, my, 2);
      put('machine_shop', ex + 5, my, 2);
      line('belt', ex + 4, my, ex, my, 2);
      // Stone from the south, under a wall, into the hub.
      const sy = hy + HUB_SIZE;
      ore(mx, sy + 11, STONE);
      put('extractor', mx, sy + 11, 3);
      put('belt', mx, sy + 10, 3);
      put('furnace', mx, sy + 8, 3);
      put('belt', mx, sy + 7, 3);
      put('tunnel', mx, sy + 6, 3);
      put('tunnel', mx, sy + 3, 3);
      line('belt', mx, sy + 2, mx, sy, 3);
      // Wood from the north: a grove, a lumber camp, a sawmill, then planks down into the hub.
      grove(mx - 3, hy - 17, mx + 4, hy - 13);
      put('lumber_camp', mx, hy - 12, 1);
      put('sawmill', mx, hy - 10, 1);
      line('belt', mx, hy - 8, mx, hy - 1, 1);
      // Defences around the hub.
      line('wall', mx - 5, sy + 5, mx - 2, sy + 5, 0);
      line('wall', mx + 2, sy + 5, mx + 5, sy + 5, 0);
      put('turret', hx - 2, hy - 2, 0);
      put('turret', ex + 1, hy - 2, 0);
      put('cannon', ex + 1, sy + 1, 0);
      put('repair', hx - 2, sy + 1, 0);
      nest(hx - 14, hy - 18, 4);
    },
  },
  {
    name: 'The Wood Age',
    seed: 5150,
    build: ({ w, hx, hy, mx, my, put, line, grove, nest }) => {
      // From the west woods: a lumber camp, a sawmill at its arrow, then rollers through a crate into the hub.
      grove(hx - 23, my - 4, hx - 19, my + 3);
      const camp = put('lumber_camp', hx - 18, my - 1, 0);
      if (camp) {
        const o = w.outputTile(camp);
        const saw = put('sawmill', o.x, o.y, 0);
        if (saw) {
          const s = w.outputTile(saw);
          line('roller', s.x, s.y, hx - 5, s.y, 0);
          put('crate', hx - 4, s.y, 0);
          line('roller', hx - 3, s.y, hx - 1, s.y, 0);
        }
      }
      // From the north woods: logs into a workshop twisting rope, rolled down into the hub.
      grove(mx - 3, hy - 20, mx + 4, hy - 15);
      const camp2 = put('lumber_camp', mx, hy - 14, 1);
      if (camp2) {
        const o = w.outputTile(camp2);
        const shop = put('workshop', o.x, o.y, 1);
        if (shop) {
          const s = w.outputTile(shop);
          line('roller', s.x, s.y, s.x, hy - 1, 1);
        }
      }
      // The wooden defences to the south: palisades, spike pits in front, a trebuchet and ballistae behind.
      const sy = hy + HUB_SIZE;
      line('palisade', hx - 4, sy + 6, hx + HUB_SIZE + 3, sy + 6, 0);
      for (let x = hx - 3; x <= hx + HUB_SIZE + 2; x += 2) put('spike_pit', x, sy + 8, 0);
      put('trebuchet', mx - 1, sy + 2, 0);
      put('ballista', hx - 2, sy + 3, 0);
      put('ballista', hx + HUB_SIZE + 1, sy + 3, 0);
      nest(mx - 5, sy + 18, 5);
    },
  },
  {
    name: 'Holding the line',
    seed: 777,
    build: ({ hx, hy, my, put, ore, line, nest }) => {
      // Iron in from the west, to feed the hub; everything else is the wall and what stands behind it.
      ore(hx - 16, my, IRON);
      put('extractor', hx - 16, my, 0);
      put('belt', hx - 14, my, 0);
      put('furnace', hx - 13, my, 0);
      put('blacksmith', hx - 11, my, 0);
      line('belt', hx - 9, my, hx - 1, my, 0);
      // A ring of wall, with turrets, cannons, a tesla, ballistae and repair stations inside it.
      const [x0, y0, x1, y1] = [hx - 6, hy - 6, hx + HUB_SIZE + 5, hy + HUB_SIZE + 5];
      line('wall', x0, y0, x1, y0, 0);
      line('wall', x0, y1, x1, y1, 0);
      line('wall', x1, y0 + 1, x1, y1 - 1, 0);
      line('wall', x0, y0 + 1, x0, my - 1, 0);
      line('wall', x0, my + 1, x0, y1 - 1, 0);
      for (const [x, y] of [
        [x0 + 2, y0 + 2],
        [x1 - 2, y0 + 2],
        [x0 + 2, y1 - 2],
        [x1 - 2, y1 - 2],
      ]) put('turret', x, y, 0);
      put('cannon', hx + 3, y0 + 2, 0);
      put('cannon', hx + 3, y1 - 2, 0);
      put('tesla', x1 - 2, my, 0);
      put('ballista', x0 + 2, my - 3, 0);
      put('ballista', x0 + 2, my + 3, 0);
      put('repair', x1 - 4, y0 + 3, 0);
      put('repair', x0 + 4, y1 - 3, 0);
      nest(x1 + 6, y0 - 8, 6);
      nest(x0 - 16, y1 + 4, 4);
    },
  },
];

/** A demo world with one scene laid out around its hub. */
export function createDemoWorld(scene = 0): World {
  const def = DEMO_SCENES[scene % DEMO_SCENES.length];
  const w = World.create(def.seed);
  w.freePower = true; // the menu shows belts at full speed without laying shafts or poles to every one
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.inventory = { iron_plate: 9999, stone: 9999, iron_ore: 9999, copper_ingot: 9999, brick: 9999, gear: 9999, wire: 9999, motor: 9999, plank: 9999, log: 9999, dowel: 9999, peg: 9999, rope: 9999, truss: 9999, stake: 9999, iron_ingot: 9999, iron_rod: 9999, rivet: 9999, steel: 9999, circuit: 9999, coil: 9999 };
  const hub = w.hub!;
  const hx = hub.x;
  const hy = hub.y;
  // Clear random nodes and trees near the hub and lay out our own.
  for (let y = hy - 24; y <= hy + HUB_SIZE + 24; y++) {
    for (let x = hx - 26; x <= hx + HUB_SIZE + 26; x++) if (w.inBounds(x, y)) s.resources[w.idx(x, y)] = s.trees[w.idx(x, y)] = 0;
  }
  // Bug territories near the factory go, so the scene's own calm nest is the one in view.
  const c = NESTS.cell;
  s.nests = s.nests.filter((n) => Math.abs(n.x + c / 2 - (hx + HUB_SIZE / 2)) > 40 || Math.abs(n.y + c / 2 - (hy + HUB_SIZE / 2)) > 40);
  s.nests.forEach((n, i) => (n.id = i));
  s.enemies = [];
  s.explored.fill(1); // no fog of war behind the menu
  w.nestCells.clear();
  for (const n of s.nests) w.nestCells.set(cellKey(n.x / c, n.y / c), n);
  const kit: Kit = {
    w,
    hx,
    hy,
    mx: hx + HUB_SIZE / 2,
    my: hy + HUB_SIZE / 2,
    put: (type, x, y, dir) => {
      const b = w.place(type, x, y, dir);
      return typeof b === 'string' ? undefined : b;
    },
    ore: (x, y, kind) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.resources[w.idx(x + dx, y + dy)] = kind;
    },
    line: (type, x0, y0, x1, y1, dir) => {
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      for (let x = x0, y = y0; ; x += dx, y += dy) {
        w.place(type, x, y, dir);
        if (x === x1 && y === y1) break;
      }
    },
    grove: (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 5) s.trees[w.idx(x, y)] = TREE;
    },
    nest: (x, y, bugs) => {
      // A calm bug territory in view, so the menu shows some life.
      const n = newNest(s.nests.length, Math.floor(x / c) * c, Math.floor(y / c) * c, 20);
      if (w.nestCells.has(cellKey(n.x / c, n.y / c))) return;
      s.nests.push(n);
      w.nestCells.set(cellKey(n.x / c, n.y / c), n);
      for (let i = 0; i < bugs; i++) w.spawnBug(i % 3 ? 'crawler' : 'runner', n, 1);
    },
  };
  def.build(kit);
  return w;
}

/** Keeps the demo going forever: the hub never falls, turrets never run dry, and the bugs stay calm. */
export function sustainDemo(w: World): void {
  const hub = w.hub;
  if (hub && hub.hp < 500) hub.hp = 1000;
  for (const b of w.state.buildings) {
    if (TURRETS[b.type] && b.ammo < 6) b.ammo += 6;
    if (b.type === 'spike_pit' && b.ammo < 10) b.ammo = 60;
    if (burnsFuel(b.type) && b.ammo < 10) b.ammo = FUEL.max;
  }
  for (const n of w.state.nests) n.angryUntil = 0;
}
