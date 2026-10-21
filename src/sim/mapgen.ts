// Procedural map generation (D-038): ore fields from layered value noise, a
// guaranteed starter patch of each ore near the hub, and bug territories in
// cells away from it. Everything comes from the world's seeded random
// generator, so the same seed always makes the same map.

import { NESTS, nestComposition } from './data';
import type { Nest } from './nests';
import type { World } from './world';

/** Smooth value noise in [0, 1), from a lattice of random values. */
class ValueNoise {
  private grid: Float32Array;
  constructor(
    private size: number,
    random: () => number,
  ) {
    this.grid = new Float32Array(size * size).map(() => random());
  }

  private at(ix: number, iy: number): number {
    const n = this.size;
    return this.grid[(((iy % n) + n) % n) * n + (((ix % n) + n) % n)];
  }

  sample(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = this.at(ix, iy) + (this.at(ix + 1, iy) - this.at(ix, iy)) * sx;
    const bottom = this.at(ix, iy + 1) + (this.at(ix + 1, iy + 1) - this.at(ix, iy + 1)) * sx;
    return top + (bottom - top) * sy;
  }

  /** Two octaves, for ragged edges. */
  fbm(x: number, y: number): number {
    return (this.sample(x, y) * 2 + this.sample(x * 2.3 + 17, y * 2.3 + 31)) / 3;
  }
}

/** How rich each ore is: [resource index, share of the map, noise scale in tiles]. */
const ORES: [number, number, number][] = [
  [1, 0.05, 15], // iron
  [2, 0.035, 14], // copper
  [3, 0.035, 13], // stone
];

/** Fills the resource layer: noise fields, then a starter patch of each ore near the hub. */
export function generateResources(w: World, hubCx: number, hubCy: number, hubRadius: number): void {
  const { width, height } = w.state;
  const res = w.state.resources;
  const random = () => w.random();
  for (const [kind, share, scale] of ORES) {
    const noise = new ValueNoise(64, random);
    // Each ore keeps the tiles where its noise is highest (about `share` of the map).
    const values = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values[y * width + x] = noise.fbm(x / scale, y / scale);
    const cut = [...values].sort((a, b) => b - a)[Math.floor(values.length * share)];
    for (let i = 0; i < values.length; i++) if (values[i] > cut && !res[i]) res[i] = kind;
  }
  // Clear the hub's surroundings, then put one patch of each ore within easy reach.
  const clear = hubRadius + 4;
  for (let y = hubCy - clear; y <= hubCy + clear; y++) for (let x = hubCx - clear; x <= hubCx + clear; x++) if (w.inBounds(x, y)) res[w.idx(x, y)] = 0;
  const base = w.random() * Math.PI * 2;
  [1, 2, 3].forEach((kind, i) => {
    const a = base + (i * Math.PI * 2) / 3;
    const d = hubRadius + 8 + w.random() * 4;
    blob(w, Math.round(hubCx + Math.cos(a) * d), Math.round(hubCy + Math.sin(a) * d), kind, 2.6);
  });
}

/** A round, slightly ragged patch of one ore. */
function blob(w: World, cx: number, cy: number, kind: number, r: number): void {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!w.inBounds(x, y)) continue;
      if (Math.hypot(x - cx, y - cy) <= r + (w.random() - 0.5) * 0.8) w.state.resources[w.idx(x, y)] = kind;
    }
  }
}

/** Picks the cells that hold bug territories and populates them. */
export function generateNests(w: World, hubCx: number, hubCy: number): Nest[] {
  const { width, height } = w.state;
  const c = NESTS.cell;
  const nests: Nest[] = [];
  for (let cy = 0; cy + c <= height; cy += c) {
    for (let cx = 0; cx + c <= width; cx += c) {
      // Distance from the hub to the nearest tile of the cell.
      const nx = Math.max(cx, Math.min(hubCx, cx + c - 1));
      const ny = Math.max(cy, Math.min(hubCy, cy + c - 1));
      if (Math.hypot(nx - hubCx, ny - hubCy) < NESTS.safeRadius) continue;
      if (w.random() >= NESTS.chance) continue;
      nests.push({ id: nests.length, x: cx, y: cy, angryUntil: 0 });
    }
  }
  for (const nest of nests) {
    const dist = Math.hypot(nest.x + c / 2 - hubCx, nest.y + c / 2 - hubCy);
    const comp = nestComposition(dist);
    const types = [
      ...Array<'crawler'>(comp.crawlers).fill('crawler'),
      ...Array<'runner'>(comp.runners).fill('runner'),
      ...Array<'brute'>(comp.brutes).fill('brute'),
    ];
    for (const type of types) w.spawnBug(type, nest, comp.hpMult);
  }
  return nests;
}
