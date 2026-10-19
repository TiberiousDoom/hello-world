import { BuildingType, Dir } from '../sim/data';

export type Tool = BuildingType | 'demolish' | null;

/** UI state shared between input, rendering and the HUD. */
export interface UIState {
  tool: Tool;
  dir: Dir;
  hover: { x: number; y: number } | null;
  selected: number | null;
  speed: number; // 0 = paused
}

export function createUIState(): UIState {
  return { tool: null, dir: 0, hover: null, selected: null, speed: 1 };
}
