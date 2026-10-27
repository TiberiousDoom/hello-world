import { BuildingType, DX, DY, Dir, footprint, isBelt } from '../sim/data';
import type { World } from '../sim/world';

export type Tool = BuildingType | 'demolish' | null;

/**
 * A blueprint waiting to be confirmed (soft placement, D-030): the tiles to
 * build on, in the order they were dragged.
 */
export interface Plan {
  tool: BuildingType;
  tiles: Spot[];
  /** An underground belt's exit blueprint slides only along the line ahead of its entrance (#64). */
  along?: { x: number; y: number; dir: Dir };
}

/** UI state shared between input, rendering and the HUD. */
export interface UIState {
  tool: Tool;
  dir: Dir;
  /** The player has turned the building being placed: their facing wins over lining up with belts (#85). */
  dirSet: boolean;
  hover: Spot | null;
  selected: number | null;
  speed: number; // 0 = paused
  plan: Plan | null;
  /** Touch placement shows a blueprint to confirm first (on by default). */
  confirmTouch: boolean;
  /** This player's engineer (their slot in a co-op game; 0 alone). */
  player: number;
  /** In a co-op game (D-078): nothing pauses it but the host, and only the host sets its speed. */
  coop: 'host' | 'guest' | null;
  /** Spots co-op players pointed at (D-080), newest last; `at` is the page clock (ms). */
  pings: Ping[];
  /** A building being moved (#76, #83): the tool in hand is its type, and the next tap puts it there. */
  moving: number | null;
  /** A charged strike beacon whose target the next tap on the map picks (D-131). */
  aiming: number | null;
}

/** A co-op ping: player `player` points at tile (x, y). */
export interface Ping {
  player: number;
  x: number;
  y: number;
  at: number;
}

/** How long a ping shows (ms). */
export const PING_MS = 5000;

export function createUIState(): UIState {
  return { tool: null, dir: 0, dirSet: false, hover: null, selected: null, speed: 1, plan: null, confirmTouch: true, player: 0, coop: null, pings: [], moving: null, aiming: null };
}

/**
 * Each co-op player's colour, by slot: their engineer's ring and their name in the lobby. One per slot up
 * to MAX_PLAYERS (a test checks), picked to stay apart from each other on the map.
 */
export const PLAYER_COLORS = ['#ffcc33', '#4fd1ff', '#ff7ab8', '#8be36b', '#b48cff', '#f2f2f2', '#ff8c1a', '#2fd6a8', '#5b7cff', '#d9b77a'];

/** True when a plan is a dragged belt line, whose belts each point at the next. */
export function isBeltPath(plan: Plan): boolean {
  return isBelt(plan.tool) && plan.tiles.length > 1;
}

function dirBetween(a: { x: number; y: number }, b: { x: number; y: number }): Dir {
  if (b.x > a.x) return 0;
  if (b.y > a.y) return 1;
  if (b.x < a.x) return 2;
  return 3;
}

/** The direction each planned building faces: `dir` (the tool's facing), except along a belt line. */
export function planDirs(plan: Plan, dir: Dir): Dir[] {
  const t = plan.tiles;
  if (!isBeltPath(plan)) return t.map(() => dir);
  return t.map((p, i) => (i < t.length - 1 ? dirBetween(p, t[i + 1]) : dirBetween(t[i - 1], p)));
}

/**
 * A splitter dropped onto a belt (#63): it faces along the belt, and its second lane goes on the side
 * of the belt the pointer is nearer, or the other side if that one is blocked.
 */
function splitterOnBelt(world: World, t: Spot, dir: Dir): { x: number; y: number; dir: Dir } {
  // Its two tiles run east (facing north or south) or south (facing east or west) from its top-left.
  const acrossX = dir % 2 === 1;
  const frac = acrossX ? (t.fx ?? 0.75) : (t.fy ?? 0.75);
  const before = { x: acrossX ? t.x - 1 : t.x, y: acrossX ? t.y : t.y - 1, dir };
  const after = { x: t.x, y: t.y, dir };
  const [first, second] = frac < 0.5 ? [before, after] : [after, before];
  const fits = (p: { x: number; y: number }) => {
    const err = world.checkPlace('splitter', p.x, p.y, dir, true);
    return !err || err === 'cost' || err === 'locked';
  };
  return fits(first) || !fits(second) ? first : second;
}

/** Where a building's top-left goes when placed at tile `t` facing `dir`: bigger buildings centre on it. */
export function anchorAt(type: BuildingType, t: { x: number; y: number }, dir: Dir = 0): { x: number; y: number } {
  const [w, h] = footprint(type, dir);
  return { x: t.x - Math.floor((w - 1) / 2), y: t.y - Math.floor((h - 1) / 2) };
}

/** Whether a building takes more than one tile (placed one at a time, never dragged out in a line). */
export const isBig = (type: BuildingType): boolean => {
  const [w, h] = footprint(type);
  return w * h > 1;
};

/** Buildings that send items out of one side, and so can line up with a belt. */
const ALIGNS: BuildingType[] = ['extractor', 'lumber_camp', 'furnace', 'workshop', 'assembler', 'sawmill', 'blacksmith', 'machine_shop', 'steel_works', 'powder_mill', 'circuit_works', 'greenhouse', 'splitter'];

/**
 * How well a building at (x, y) facing `dir` joins the belts around it: 2 if
 * its output runs onto a belt, plus 1 if a belt runs into it (1.5 if the
 * building faces the way that belt runs, so the flow carries straight on).
 */
function beltFit(world: World, type: BuildingType, x: number, y: number, dir: Dir): number {
  const [w, h] = footprint(type, dir);
  const fromX = dir === 0 ? x + w - 1 : dir === 2 ? x : x + Math.floor((w - 1) / 2);
  const fromY = dir === 1 ? y + h - 1 : dir === 3 ? y : y + Math.floor((h - 1) / 2);
  const ox = fromX + DX[dir];
  const oy = fromY + DY[dir];
  let score = 0;
  const out = world.buildingAt(ox, oy);
  if (out && isBelt(out.type) && !(out.x + DX[out.dir] === fromX && out.y + DY[out.dir] === fromY)) score += 2;
  // A belt pointing into the footprint from outside it (not the output tile).
  const inside = (px: number, py: number) => px >= x && px < x + w && py >= y && py < y + h;
  let fed = 0;
  for (let py = y - 1; py <= y + h && !fed; py++) {
    for (let px = x - 1; px <= x + w && !fed; px++) {
      if (inside(px, py) || (px === ox && py === oy)) continue;
      const b = world.buildingAt(px, py);
      if (b && isBelt(b.type) && inside(px + DX[b.dir], py + DY[b.dir])) fed = b.dir === dir ? 1.5 : 1;
    }
  }
  score += fed;
  return score;
}

/**
 * For a single placement next to belts: the facing and position, among those
 * covering tile `t`, where the building best joins the belts around it. The
 * player's own facing wins ties, then the usual spot centred on the tile.
 */
function alignToBelts(world: World, type: BuildingType, t: { x: number; y: number }, dir: Dir, keepDir: boolean): { x: number; y: number; dir: Dir } | null {
  let best: { x: number; y: number; dir: Dir } | null = null;
  let bestScore = 0;
  let bestRank = Infinity;
  for (let k = 0; k < (keepDir ? 1 : 4); k++) {
    const d = ((dir + k) % 4) as Dir;
    const [w, h] = footprint(type, d);
    const centred = anchorAt(type, t, d);
    for (let y = t.y - h + 1; y <= t.y; y++) {
      for (let x = t.x - w + 1; x <= t.x; x++) {
        const err = world.checkPlace(type, x, y, d);
        if (err && err !== 'cost' && err !== 'locked') continue;
        const score = beltFit(world, type, x, y, d);
        const rank = k * 100 + Math.abs(x - centred.x) + Math.abs(y - centred.y);
        if (score > bestScore || (score === bestScore && score > 0 && rank < bestRank)) {
          best = { x, y, dir: d };
          bestScore = score;
          bestRank = rank;
        }
      }
    }
  }
  return best;
}

/** A tile, and optionally where in it (0–1 across and down) the pointer is. */
export interface Spot {
  x: number;
  y: number;
  fx?: number;
  fy?: number;
}

/**
 * Where a building goes when the player taps tile `t` with it: its top-left
 * and facing. Tapped onto a belt (when allowed), it faces the way the belt runs.
 * A single placement beside belts lines up with them (output onto a belt, a
 * belt running in); `replaceBelt` marks a single placement, not a drag. Once the player has turned the
 * building (`keepDir`), it keeps their facing and only slides to line up (#85).
 */
export function placementAt(world: World, type: BuildingType, t: Spot, dir: Dir, replaceBelt: boolean, keepDir = false): { x: number; y: number; dir: Dir } {
  // The shipyard has one place: its staked-out site (D-109), wherever the pointer is.
  const site = world.state.shipSite;
  if (type === 'shipyard' && site) return { x: site.x, y: site.y, dir: 0 };
  const belt = replaceBelt ? world.beltToReplace(type, t.x, t.y) : undefined;
  if (belt && type === 'splitter') return splitterOnBelt(world, t, belt.dir);
  if (belt && type !== 'port') {
    if (!keepDir) dir = belt.dir;
  } else if (replaceBelt && ALIGNS.includes(type)) {
    const aligned = alignToBelts(world, type, t, dir, keepDir);
    if (aligned) return aligned;
  }
  return { ...anchorAt(type, t, dir), dir };
}

/**
 * Turns the building being placed by `turns` quarter turns. The first turn starts from the facing the
 * player sees (which lining up with belts may have chosen), and from then on their facing wins (#85).
 */
export function turnTool(world: World, ui: UIState, turns: number): void {
  const plan = ui.plan;
  const spot = plan ? (plan.tiles.length === 1 ? plan.tiles[0] : null) : ui.hover;
  const tool = plan ? plan.tool : ui.tool;
  let from = ui.dir;
  if (!ui.dirSet && spot && tool && tool !== 'demolish') from = placementAt(world, tool, spot, ui.dir, true).dir;
  ui.dir = ((((from + turns) % 4) + 4) % 4) as Dir;
  ui.dirSet = true;
}
