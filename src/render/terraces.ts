// Ore patches drawn as terraces (D-153): where tiles of one ore touch, the patch rises from the ground in
// steps. Every tile of the patch is the first step, and a tile whose whole 3×3 block is the same ore is the
// second, so a big field is a wide shelf on a base. Each step is drawn as one shape: the tiles' outlines are
// inset where the step ends, outside corners are rounded off and inside corners filled with a curve, so a
// step follows the patch's shape rather than the grid's stairs.

/** The highest step drawn. */
export const TERRACE_TOP = 2;

/** How high a tile of ore `k` stands: 0 if it isn't that ore, else 1 to TERRACE_TOP. */
export function terraceLevel(kindAt: (x: number, y: number) => number, x: number, y: number, k: number): number {
  if (kindAt(x, y) !== k) return 0;
  let level = 1;
  for (let r = 1; r < TERRACE_TOP; r++) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (kindAt(x + i, y + j) !== k) return level;
    level = r + 1;
  }
  return level;
}

/** Does this ore tile touch another of its kind? A tile on its own keeps its pile of rocks instead. */
export function joinedOre(kindAt: (x: number, y: number) => number, x: number, y: number): boolean {
  const k = kindAt(x, y);
  return !!k && (kindAt(x, y - 1) === k || kindAt(x + 1, y) === k || kindAt(x, y + 1) === k || kindAt(x - 1, y) === k);
}

/** One tile's share of a step: its rectangle in tiles and which corners are rounded. */
export interface TerracePiece {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Rounded corners (open on both sides): top-left, top-right, bottom-right, bottom-left. */
  round: [boolean, boolean, boolean, boolean];
  /** How far the rounded corners curve, in tiles. */
  radius: number;
  /** Inside corners (joined on both sides, open on the diagonal), filled with a curve the size of the inset. */
  notch: [boolean, boolean, boolean, boolean];
  /** The step's inset where it ends. */
  inset: number;
  /** Is the step open (it ends) on the north side here? Its top edge catches the light. */
  openNorth: boolean;
}

/** How far a step's edge sits inside its tiles: the first step a little, higher ones more. */
export const TERRACE_INSET = [0, 0.1, 0.22];
/** The largest curve on a rounded corner, in tiles: big enough to smooth a diagonal's stairs. */
export const TERRACE_ROUND = 0.42;

/** Tile (x, y)'s piece of step `level`, or null if it doesn't reach that step. */
export function terracePiece(kindAt: (x: number, y: number) => number, x: number, y: number, k: number, level: number): TerracePiece | null {
  const on = (dx: number, dy: number) => terraceLevel(kindAt, x + dx, y + dy, k) >= level;
  if (!on(0, 0)) return null;
  const n = on(0, -1);
  const e = on(1, 0);
  const s = on(0, 1);
  const w = on(-1, 0);
  const m = TERRACE_INSET[level];
  const x0 = x + (w ? 0 : m);
  const y0 = y + (n ? 0 : m);
  const x1 = x + 1 - (e ? 0 : m);
  const y1 = y + 1 - (s ? 0 : m);
  return {
    x0,
    y0,
    x1,
    y1,
    round: [!n && !w, !n && !e, !s && !e, !s && !w],
    // Two rounded corners on one side must not overlap.
    radius: Math.min(TERRACE_ROUND, (x1 - x0) / 2, (y1 - y0) / 2),
    notch: [n && w && !on(-1, -1), n && e && !on(1, -1), s && e && !on(1, 1), s && w && !on(-1, 1)],
    inset: m,
    openNorth: !n,
  };
}
