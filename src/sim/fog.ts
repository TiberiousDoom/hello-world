// Fog of war (D-099, D-112). Which parts of the map anyone has seen, kept in the game state so every
// co-op game agrees and a save keeps it. Seeing is shared: what one engineer finds, everyone sees.
// It's only the view; the rules never ask about it.

import { BUILDINGS, FOG, TURRETS } from './data';
import type { Building, GameState } from './world';

/** The fog grid's size in cells along each side. */
export function fogSize(state: GameState): number {
  return Math.ceil(state.width / FOG.cell);
}

/** A grid with nothing explored. */
export function newFog(state: GameState): number[] {
  return new Array(fogSize(state) ** 2).fill(0);
}

/** Whether the tile (x, y) has been seen. */
export function explored(state: GameState, x: number, y: number): boolean {
  const n = fogSize(state);
  const cx = Math.floor(x / FOG.cell);
  const cy = Math.floor(y / FOG.cell);
  return cx >= 0 && cy >= 0 && cx < n && cy < n && state.explored[cy * n + cx] === 1;
}

/** Explores every cell whose middle is within `r` tiles of (x, y). Returns how many were new. */
export function reveal(state: GameState, x: number, y: number, r: number): number {
  const n = fogSize(state);
  const c = FOG.cell;
  const reach = Math.ceil(r / c) + 1;
  const cx0 = Math.floor(x / c);
  const cy0 = Math.floor(y / c);
  let found = 0;
  for (let cy = Math.max(0, cy0 - reach); cy <= Math.min(n - 1, cy0 + reach); cy++) {
    for (let cx = Math.max(0, cx0 - reach); cx <= Math.min(n - 1, cx0 + reach); cx++) {
      const i = cy * n + cx;
      if (state.explored[i]) continue;
      // Squared distances only, so every browser gets the same answer.
      const dx = (cx + 0.5) * c - x;
      const dy = (cy + 0.5) * c - y;
      if (dx * dx + dy * dy > (r + c / 2) * (r + c / 2)) continue;
      state.explored[i] = 1;
      found++;
    }
  }
  return found;
}

/** How far a building sees, from its middle. */
export function sightOf(b: Building): number {
  if (b.type === 'hub') return FOG.hub;
  const [w, h] = BUILDINGS[b.type].size ?? [1, 1];
  return FOG.building + Math.max(w, h) / 2 + (TURRETS[b.type]?.range ?? 0);
}

/** Explores what a building sees. */
export function revealBuilding(state: GameState, b: Building, w: number, h: number): void {
  reveal(state, b.x + w / 2, b.y + h / 2, sightOf(b));
}

/** Each tick: engineers explore as they walk. */
export function tickFog(state: GameState): void {
  for (const p of state.players) reveal(state, p.x, p.y, FOG.player);
}
