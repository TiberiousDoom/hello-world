// Copy and paste for sections of a factory (D-144). Copying reads the world; pasting is a command
// (`paste`), so it works in co-op and can be undone.

import { BuildingType, Dir, footprint } from '../sim/data';
import { PASTE_MAX, type PasteItem } from '../sim/commands';
import type { World } from '../sim/world';

/** A copied section: its buildings from its top-left corner, and its size in tiles. */
export interface Clip {
  items: PasteItem[];
  w: number;
  h: number;
}

/** Buildings that can't be copied: there is one of each, in its own place. */
const UNIQUE: readonly BuildingType[] = ['hub', 'shipyard'];

/**
 * The buildings lying wholly inside the rectangle between two corner tiles, with their facing, recipe,
 * filter and side. In the order they were built, so an underground belt's entrance comes before its exit.
 */
export function copyArea(world: World, ax: number, ay: number, bx: number, by: number): Clip | null {
  const [x0, x1] = [Math.min(ax, bx), Math.max(ax, bx)];
  const [y0, y1] = [Math.min(ay, by), Math.max(ay, by)];
  const inside = world.state.buildings.filter((b) => {
    if (UNIQUE.includes(b.type)) return false;
    const [fw, fh] = world.footprintOf(b);
    return b.x >= x0 && b.y >= y0 && b.x + fw - 1 <= x1 && b.y + fh - 1 <= y1;
  });
  if (!inside.length) return null;
  inside.sort((a, b) => a.id - b.id);
  const items = inside.map((b) => {
    const it: PasteItem = { type: b.type, dx: b.x - x0, dy: b.y - y0, dir: b.dir };
    if (b.recipe) it.recipe = b.recipe;
    if (b.filter) it.filter = b.filter;
    if (b.side) it.side = b.side;
    return it;
  });
  return { items, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The copy turned a quarter clockwise: each building moves and faces round with it. */
export function rotateClip(clip: Clip): Clip {
  const items = clip.items.map((it) => {
    const [, fh] = footprint(it.type, it.dir);
    return { ...it, dx: clip.h - it.dy - fh, dy: it.dx, dir: ((it.dir + 1) % 4) as Dir };
  });
  return { items, w: clip.h, h: clip.w };
}

/** The copy in pieces small enough for one command each (PASTE_MAX). */
export function pasteChunks(items: readonly PasteItem[]): PasteItem[][] {
  const out: PasteItem[][] = [];
  for (let i = 0; i < items.length; i += PASTE_MAX) out.push(items.slice(i, i + PASTE_MAX));
  return out;
}

/** Where a copy's corner goes when it's put down at tile `t`: the copy centres on it. */
export function clipCorner(clip: Clip, t: { x: number; y: number }): { x: number; y: number } {
  return { x: t.x - Math.floor((clip.w - 1) / 2), y: t.y - Math.floor((clip.h - 1) / 2) };
}
