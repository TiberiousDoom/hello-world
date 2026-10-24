// Which sprite of a wall or palisade run to draw, from its same-type neighbours.
// East–west runs and north–south runs are drawn differently (a palisade shows its
// log tops one way and its side the other), so a corner needs its own piece.

import type { Building, World } from '../sim/world';

/**
 * The sprite suffix for a run piece, given which neighbours (north, south, east,
 * west) are the same type: '' east–west, '_v' north–south, '_nw' … '_se' the
 * corner at that end of an enclosure, '_end_w' / '_end_e' where a run stops
 * (a gate or an end), and `lone` for a piece with no neighbours.
 */
export function runSuffix(n: boolean, s: boolean, e: boolean, w: boolean, lone: string): string {
  if ((n || s) && (e || w)) return `_${s ? 'n' : 's'}${e ? 'w' : 'e'}`;
  if (n || s) return '_v';
  if (e && w) return '';
  if (w) return '_end_w';
  if (e) return '_end_e';
  return lone;
}

/** The run piece for a wall or palisade building. */
export function runPiece(world: World, b: Building): string {
  const same = (dx: number, dy: number) => world.buildingAt(b.x + dx, b.y + dy)?.type === b.type;
  return runSuffix(same(0, -1), same(0, 1), same(1, 0), same(-1, 0), b.type === 'wall' ? '_pier' : '_post');
}
