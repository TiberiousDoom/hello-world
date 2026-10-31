// Procedural map generation (D-038): ore fields from layered value noise, a
// guaranteed starter patch of each ore near the hub, and bug territories in
// cells away from it. Everything comes from the world's seeded random
// generator, so the same seed always makes the same map.

import { DIFFICULTY, FOREST, NESTS, ORE, PONDS, QUEENS, SULFUR, nestKindFor } from './data';
import { hypot } from './math';
import { Nest, moundTile, nearHub, newNest, populate } from './nests';
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
  // Clear the hub's surroundings, then put one patch of each ore within reach: no ore closer than
  // ORE.minDistance tiles to the hub's edge (D-097).
  const clear = hubRadius + ORE.minDistance;
  for (let y = hubCy - clear; y <= hubCy + clear; y++) for (let x = hubCx - clear; x <= hubCx + clear; x++) if (w.inBounds(x, y)) res[w.idx(x, y)] = 0;
  const base = w.random() * Math.PI * 2;
  [1, 2, 3].forEach((kind, i) => {
    const a = base + (i * Math.PI * 2) / 3;
    // Out to a square around the hub, not a circle, so a patch on a diagonal is as far from its edge.
    const d = hubRadius + ORE.minDistance + 4 + w.random() * 4; // the patch's middle, beyond its radius
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const m = Math.max(Math.abs(ux), Math.abs(uy));
    blob(w, Math.round(hubCx + (ux / m) * d), Math.round(hubCy + (uy / m) * d), kind, 2.6);
  });
}

/** A round, slightly ragged patch of one ore. */
function blob(w: World, cx: number, cy: number, kind: number, r: number): void {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!w.inBounds(x, y)) continue;
      if (hypot(x - cx, y - cy) <= r + (w.random() - 0.5) * 0.8) w.state.resources[w.idx(x, y)] = kind;
    }
  }
}

/** A mulberry32 generator from `seed`, for map features added to saves made before them. */
export function seeded(seed: number): () => number {
  let state = seed | 0;
  return () => {
    let t = (state = (state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ponds (D-095): PONDS.count small, ragged lakes, none closer than PONDS.minDist tiles to the hub's centre
 * (counting their own size). `free` says which tiles may hold water. Returns the water tiles' indices, in
 * order; the caller clears ore and trees off them.
 */
export function generatePonds(width: number, height: number, hubCx: number, hubCy: number, random: () => number, free: (x: number, y: number) => boolean): number[] {
  const water = new Set<number>();
  const [rMin, rMax] = PONDS.radius;
  for (let n = 0, tries = 0; n < PONDS.count && tries < PONDS.count * 20; tries++) {
    const r = rMin + random() * (rMax - rMin);
    const cx = Math.floor(r + 2 + random() * (width - 2 * r - 4));
    const cy = Math.floor(r + 2 + random() * (height - 2 * r - 4));
    if (hypot(cx - hubCx, cy - hubCy) < PONDS.minDist + r + 1) continue;
    n++;
    // Two overlapping blobs, so ponds aren't all round.
    const [ox, oy] = [(random() - 0.5) * r, (random() - 0.5) * r];
    for (let y = Math.floor(cy - r * 1.6); y <= cy + r * 1.6; y++) {
      for (let x = Math.floor(cx - r * 1.6); x <= cx + r * 1.6; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || !free(x, y)) continue;
        const d = Math.min(hypot(x - cx, y - cy), hypot(x - cx - ox, y - cy - oy) * 1.2);
        if (d <= r + (random() - 0.5) * 0.8) water.add(y * width + x);
      }
    }
  }
  return [...water].sort((a, b) => a - b);
}

/**
 * Fills the tree layer (D-044): forest where noise is highest, never on ore,
 * buildings or the hub's clearing, plus one small grove just outside the
 * clearing so the first Lumber Camp has somewhere to go.
 */
export function generateTrees(w: World, hubCx: number, hubCy: number): void {
  const { width, height } = w.state;
  const trees = w.state.trees;
  const free = (x: number, y: number) => w.inBounds(x, y) && !w.state.resources[w.idx(x, y)] && !w.tiles[w.idx(x, y)] && !w.isWater(x, y) && hypot(x - hubCx, y - hubCy) >= FOREST.clear;
  const noise = new ValueNoise(64, () => w.random());
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values[y * width + x] = noise.fbm(x / FOREST.scale, y / FOREST.scale);
  const cut = [...values].sort((a, b) => b - a)[Math.floor(values.length * FOREST.share)];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (values[y * width + x] > cut && free(x, y)) trees[w.idx(x, y)] = 1;
  const a = w.random() * Math.PI * 2;
  const d = FOREST.clear + FOREST.grove + 1;
  const gx = Math.round(hubCx + Math.cos(a) * d);
  const gy = Math.round(hubCy + Math.sin(a) * d);
  const r = FOREST.grove;
  for (let y = gy - r - 1; y <= gy + r + 1; y++) {
    for (let x = gx - r - 1; x <= gx + r + 1; x++) {
      if (free(x, y) && hypot(x - gx, y - gy) <= r + (w.random() - 0.5) * 0.8) trees[w.idx(x, y)] = 1;
    }
  }
}

/**
 * Picks the cells that hold bug territories and populates them. Each nest's kind comes from its distance,
 * mixed where zones meet, and a few near the map edge are queens (D-132). Nests start part way to their
 * next stage, so they don't all grow at once.
 */
export function generateNests(w: World, hubCx: number, hubCy: number): Nest[] {
  const { width, height } = w.state;
  const c = NESTS.cell;
  const nests: Nest[] = [];
  for (let cy = 0; cy + c <= height; cy += c) {
    for (let cx = 0; cx + c <= width; cx += c) {
      if (nearHub(cx, cy, hubCx, hubCy)) continue;
      if (w.random() >= NESTS.chance * DIFFICULTY[w.state.difficulty].nests) continue;
      const d = hypot(cx + c / 2 - hubCx, cy + c / 2 - hubCy);
      const n = newNest(nests.length, cx, cy, d, 1, nestKindFor(d, w.random()));
      n.age = Math.floor(w.random() * NESTS.stageEvery * 0.5);
      nests.push(n);
    }
  }
  // Queens: a few of the nests near the map edge, picked at random.
  const edge = nests.filter((n) => Math.min(n.x, n.y, width - n.x - c, height - n.y - c) < QUEENS.edge);
  const count = QUEENS.count[0] + Math.floor(w.random() * (QUEENS.count[1] - QUEENS.count[0] + 1));
  for (let k = 0; k < count && edge.length; k++) {
    const [n] = edge.splice(Math.floor(w.random() * edge.length), 1);
    nests[n.id] = { ...newNest(n.id, n.x, n.y, hypot(n.x + c / 2 - hubCx, n.y + c / 2 - hubCy), 1, n.kind, true), age: n.age };
  }
  // Some nests lie deep in forest (D-134): trees over most of the open ground of their cell. Every mound
  // and the ring around it stay clear of trees.
  const s = w.state;
  for (const n of nests) {
    const [mx, my] = moundTile(n);
    const deep = w.random() < FOREST.nestShare;
    for (let y = n.y; y < n.y + c; y++) {
      for (let x = n.x; x < n.x + c; x++) {
        const i = w.idx(x, y);
        if (x >= mx - 1 && x <= mx + 2 && y >= my - 1 && y <= my + 2) s.trees[i] = 0;
        else if (deep && !s.resources[i] && !w.isWater(x, y) && w.random() < FOREST.nestDensity) s.trees[i] = 1;
      }
    }
  }
  for (const nest of nests) populate(w, nest, hypot(nest.x + c / 2 - hubCx, nest.y + c / 2 - hubCy));
  return nests;
}

/**
 * Sulfur deposits (D-123): SULFUR.count small, ragged patches at least SULFUR.minDist tiles from the hub's
 * centre, on tiles `free` allows. Returns their tile indices. It has a generator of its own, so adding it
 * leaves the rest of the map as it was, for new games and old saves alike.
 */
export function generateSulfur(width: number, height: number, hubCx: number, hubCy: number, random: () => number, free: (x: number, y: number) => boolean): number[] {
  const out = new Set<number>();
  for (let n = 0, tries = 0; n < SULFUR.count && tries < SULFUR.count * 20; tries++) {
    const cx = 4 + random() * (width - 8);
    const cy = 4 + random() * (height - 8);
    const [r0, r1] = SULFUR.radius;
    const r = r0 + random() * (r1 - r0);
    if (hypot(cx - hubCx, cy - hubCy) < SULFUR.minDist + r) continue;
    n++;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || !free(x, y)) continue;
        if (hypot(x - cx, y - cy) <= r + (random() - 0.5) * 0.8) out.add(y * width + x);
      }
    }
  }
  return [...out];
}
