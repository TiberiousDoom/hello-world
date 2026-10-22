import { BuildingType, DX, DY, Dir, footprint, isBelt } from '../sim/data';
import type { World } from '../sim/world';

export type Tool = BuildingType | 'demolish' | null;

/**
 * A blueprint waiting to be confirmed (soft placement, D-030): the tiles to
 * build on, in the order they were dragged.
 */
export interface Plan {
  tool: BuildingType;
  tiles: { x: number; y: number }[];
}

/** UI state shared between input, rendering and the HUD. */
export interface UIState {
  tool: Tool;
  dir: Dir;
  hover: { x: number; y: number } | null;
  selected: number | null;
  speed: number; // 0 = paused
  plan: Plan | null;
  /** Touch placement shows a blueprint to confirm first (on by default). */
  confirmTouch: boolean;
}

export function createUIState(): UIState {
  return { tool: null, dir: 0, hover: null, selected: null, speed: 1, plan: null, confirmTouch: true };
}

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
const ALIGNS: BuildingType[] = ['extractor', 'lumber_camp', 'furnace', 'workshop', 'assembler', 'sawmill', 'splitter'];

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
function alignToBelts(world: World, type: BuildingType, t: { x: number; y: number }, dir: Dir): { x: number; y: number; dir: Dir } | null {
  let best: { x: number; y: number; dir: Dir } | null = null;
  let bestScore = 0;
  let bestRank = Infinity;
  for (let k = 0; k < 4; k++) {
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

/**
 * Where a building goes when the player taps tile `t` with it: its top-left
 * and facing. Tapped onto a belt (when allowed), it faces the way the belt runs.
 * A single placement beside belts lines up with them (output onto a belt, a
 * belt running in); `replaceBelt` marks a single placement, not a drag.
 */
export function placementAt(
  world: World,
  type: BuildingType,
  t: { x: number; y: number },
  dir: Dir,
  replaceBelt: boolean,
): { x: number; y: number; dir: Dir } {
  const belt = replaceBelt ? world.beltToReplace(type, t.x, t.y) : undefined;
  if (belt && type !== 'port') dir = belt.dir;
  else if (replaceBelt && ALIGNS.includes(type)) {
    const aligned = alignToBelts(world, type, t, dir);
    if (aligned) return aligned;
  }
  return { ...anchorAt(type, t, dir), dir };
}
