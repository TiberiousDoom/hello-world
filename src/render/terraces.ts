// Ore patches drawn as terraces (D-153): where tiles of one ore touch, the patch rises from the ground in
// steps. Every tile of the patch is the first step; a tile whose whole 3×3 block is the same ore is the
// second, and one whose 5×5 block is, the third. Each step is drawn as one shape: the tiles' outlines are
// inset where the step ends and rounded at corners open on both sides, so neighbouring tiles join up.

/** The highest step drawn. */
export const TERRACE_TOP = 3;

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
  /** Rounded corners: top-left, top-right, bottom-right, bottom-left. */
  round: [boolean, boolean, boolean, boolean];
  /** Is the step open (it ends) on the north side here? Its top edge catches the light. */
  openNorth: boolean;
}

/** How far a step's edge sits inside its tiles: the first step a little, higher ones more. */
export const TERRACE_INSET = [0, 0.1, 0.22, 0.3];

/** Tile (x, y)'s piece of step `level`, or null if it doesn't reach that step. */
export function terracePiece(kindAt: (x: number, y: number) => number, x: number, y: number, k: number, level: number): TerracePiece | null {
  const on = (dx: number, dy: number) => terraceLevel(kindAt, x + dx, y + dy, k) >= level;
  if (!on(0, 0)) return null;
  const n = on(0, -1);
  const e = on(1, 0);
  const s = on(0, 1);
  const w = on(-1, 0);
  const m = TERRACE_INSET[level];
  return {
    x0: x + (w ? 0 : m),
    y0: y + (n ? 0 : m),
    x1: x + 1 - (e ? 0 : m),
    y1: y + 1 - (s ? 0 : m),
    round: [!n && !w, !n && !e, !s && !e, !s && !w],
    openNorth: !n,
  };
}
