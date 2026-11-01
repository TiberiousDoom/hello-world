import { describe, expect, it } from 'vitest';
import { joinedOre, terraceLevel, terracePiece } from './terraces';

/** A map from rows of characters: digits are ore kinds, anything else empty ground. */
function map(rows: string[]): (x: number, y: number) => number {
  return (x, y) => Number(rows[y]?.[x]) || 0;
}

describe('terraces', () => {
  const ground = map([
    '1111111', //
    '1111111',
    '1111111',
    '1111111',
    '1111111',
    '..11...',
    '..2...2',
  ]);

  it('raises a tile to the second step when its 3×3 block is all the same ore, and no higher', () => {
    expect(terraceLevel(ground, 0, 0, 1)).toBe(1); // on the patch's edge
    expect(terraceLevel(ground, 1, 1, 1)).toBe(2); // its 3×3 block is all iron
    expect(terraceLevel(ground, 3, 2, 1)).toBe(2); // deep inside: still the second step
    expect(terraceLevel(ground, 1, 4, 1)).toBe(1); // the 3×3 block reaches the gap in row 5
    expect(terraceLevel(ground, 2, 6, 1)).toBe(0); // another ore
  });

  it('leaves a tile on its own to its rocks', () => {
    expect(joinedOre(ground, 6, 6)).toBe(false);
    expect(joinedOre(ground, 2, 6)).toBe(false); // copper beside iron is still alone
    expect(joinedOre(ground, 3, 5)).toBe(true);
    expect(joinedOre(ground, 0, 6)).toBe(false); // no ore at all
  });

  it('joins neighbouring pieces of a step and insets it where it ends', () => {
    const corner = terracePiece(ground, 0, 0, 1, 1)!;
    expect([corner.x0, corner.y0, corner.x1, corner.y1]).toEqual([0.1, 0.1, 1, 1]);
    expect(corner.round).toEqual([true, false, false, false]);
    expect(corner.radius).toBeCloseTo(0.42);
    expect(corner.openNorth).toBe(true);
    // Inside the patch the piece fills its tile: no gap, nothing rounded.
    const inner = terracePiece(ground, 3, 2, 1, 1)!;
    expect([inner.x0, inner.y0, inner.x1, inner.y1]).toEqual([3, 2, 4, 3]);
    expect(inner.round).toEqual([false, false, false, false]);
    // A tile below a step has no piece of it.
    expect(terracePiece(ground, 0, 0, 1, 2)).toBeNull();
  });

  it("fills a step's inside corners and keeps rounded corners from overlapping", () => {
    // Tile (2, 4) is joined on all four sides, but (1, 5) on its south-west diagonal is empty: an inside corner.
    expect(terracePiece(ground, 2, 4, 1, 1)!.notch).toEqual([false, false, false, true]);
    // Tile (4, 4) is open to the south, so its south corners are outside the step: nothing to fill.
    expect(terracePiece(ground, 4, 4, 1, 1)!.notch).toEqual([false, false, false, false]);
    // A one-tile-wide step: its two rounded corners share the side, so each curves at most half its width.
    const thin = terracePiece(map(['11']), 0, 0, 1, 1)!;
    expect(thin.radius).toBeCloseTo(0.4);
  });
});
