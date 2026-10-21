import { BuildingType, Dir } from '../sim/data';

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
  return plan.tool === 'belt' && plan.tiles.length > 1;
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
