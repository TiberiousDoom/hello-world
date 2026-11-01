// Prototype: ore patches drawn as one outcrop with veins running through it, tile by tile, so the
// game can draw it the same way (each tile looks only at its four neighbours and hashes shared by both sides).
import fs from 'node:fs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
export const hash = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
export const ORE = {
  1: { name: 'Iron', rock: '#6e5a4c', light: '#97806d', dark: '#4f4036', vein: '#a0553a', veinDark: '#5e2c1c', veinLight: '#d9906a', glint: '#e6ebf2', bed: 'rgba(70,48,34,0.8)' },
  2: { name: 'Copper', rock: '#4f4a46', light: '#7c756e', dark: '#36322f', vein: '#3fbfa0', veinDark: '#1e6b58', veinLight: '#b6fae6', glint: '#e08a4a', bed: 'rgba(26,74,62,0.75)' },
  3: { name: 'Stone', rock: '#a8a296', light: '#dad4c9', dark: '#6f6a62', vein: '#d6d0c4', veinDark: '#8d877c', veinLight: '#f4f0e8', glint: '#ffffff', bed: 'rgba(80,76,70,0.75)' },
  4: { name: 'Sulfur', rock: '#4f4a46', light: '#7c756e', dark: '#36322f', vein: '#e8d23a', veinDark: '#8a7a18', veinLight: '#fff7b0', glint: '#fff7b0', bed: 'rgba(96,86,34,0.75)' },
};
const INK = '#0f1a2e';

/** Does the edge between tile (x, y) and its neighbour in direction d (0 E, 1 S) carry the vein across? */
function crosses(x, y, d, style) {
  const h = hash(x, y, d + 7) % 100;
  return d === 0 ? h < style.across : h < style.down;
}
/** Where on the shared edge the vein crosses, 0–1 along it. */
const at = (x, y, d) => 0.3 + (hash(x, y, d + 11) % 40) / 100;

export function patchSvg(grid, style, sprites) {
  const H = grid.length, W = grid[0].length;
  const kindAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  let bed = '', shadow = '', ink = '', fill = '', bevel = '', cracks = '', veins = '', singles = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = kindAt(x, y);
      if (!k) continue;
      const o = ORE[k];
      const n = kindAt(x, y - 1) === k, e = kindAt(x + 1, y) === k, s = kindAt(x, y + 1) === k, w = kindAt(x - 1, y) === k;
      // The bed of earth, as now.
      const bm = 0.1;
      const [bl, br, bt, bb] = [w ? 0 : bm, e ? 0 : bm, n ? 0 : bm, s ? 0 : bm];
      bed += `<rect x="${f((x + bl) * T)}" y="${f((y + bt) * T)}" width="${f((1 - bl - br) * T)}" height="${f((1 - bt - bb) * T)}" rx="${f((Math.min(bl, br, bt, bb) ? 0.25 : 0.12) * T)}" fill="${o.bed}" />`;
      if (!(n || e || s || w)) {
        // On its own: the node as drawn now.
        singles += `<image href="${sprites[k]}" x="${f((x + 0.07) * T)}" y="${f((y + 0.07) * T)}" width="${f(0.86 * T)}" height="${f(0.86 * T)}" />`;
        continue;
      }
      // The outcrop: a slab reaching to each neighbour, rounded where it ends.
      const m = style.margin;
      const [l, r, t, b] = [w ? 0 : m, e ? 0 : m, n ? 0 : m, s ? 0 : m];
      const rr = 0.22 * T;
      const X0 = (x + l) * T, X1 = (x + 1 - r) * T, Y0 = (y + t) * T, Y1 = (y + 1 - b) * T;
      // Each corner rounded only where both its sides are open.
      const c = { tl: !n && !w, tr: !n && !e, br: !s && !e, bl: !s && !w };
      const d = `M${f(X0 + (c.tl ? rr : 0))} ${f(Y0)} H${f(X1 - (c.tr ? rr : 0))} ${c.tr ? `Q${f(X1)} ${f(Y0)} ${f(X1)} ${f(Y0 + rr)}` : ''} V${f(Y1 - (c.br ? rr : 0))} ${c.br ? `Q${f(X1)} ${f(Y1)} ${f(X1 - rr)} ${f(Y1)}` : ''} H${f(X0 + (c.bl ? rr : 0))} ${c.bl ? `Q${f(X0)} ${f(Y1)} ${f(X0)} ${f(Y1 - rr)}` : ''} V${f(Y0 + (c.tl ? rr : 0))} ${c.tl ? `Q${f(X0)} ${f(Y0)} ${f(X0 + rr)} ${f(Y0)}` : ''} Z`;
      if (style.slab) {
        shadow += `<path d="${d}" transform="translate(${f(0.05 * T)} ${f(0.08 * T)})" />`;
        ink += `<path d="${d}" />`;
        fill += `<path d="${d}" fill="${o.rock}" />`;
        // A bevel: light along open top and left edges, dark along open bottom and right.
        const i = 0.07 * T;
        if (!n) bevel += `<path d="M${f(X0 + (c.tl ? rr : i))} ${f(Y0 + i)} H${f(X1 - (c.tr ? rr : 0))}" stroke="${o.light}" />`;
        if (!w) bevel += `<path d="M${f(X0 + i)} ${f(Y0 + (c.tl ? rr : i))} V${f(Y1 - (c.bl ? rr : 0))}" stroke="${o.light}" />`;
        if (!s) bevel += `<path d="M${f(X0 + (c.bl ? rr : 0))} ${f(Y1 - i)} H${f(X1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
        if (!e) bevel += `<path d="M${f(X1 - i)} ${f(Y0 + (c.tr ? rr : 0))} V${f(Y1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
        // A few cracks and chips in the rock.
        const h = hash(x, y, 3);
        const cx = x + 0.25 + (h % 50) / 100, cy = y + 0.25 + ((h >>> 8) % 50) / 100;
        const a = ((h >>> 16) % 628) / 100;
        cracks += `<path d="M${f(cx * T)} ${f(cy * T)} l${f(Math.cos(a) * 9)} ${f(Math.sin(a) * 9)} l${f(Math.cos(a + 0.7) * 6)} ${f(Math.sin(a + 0.7) * 6)}" stroke="${o.dark}" />`;
        if ((h >>> 24) % 2) cracks += `<path d="M${f((x + 0.62) * T)} ${f((y + 0.3) * T)} l5 -3 l4 3 l-4 3 z" fill="${o.light}" stroke="none" />`;
      } else {
        // No slab: a few rocks along the seam.
        const h = hash(x, y, 5);
        for (let q = 0; q < 2; q++) {
          const rx = x + 0.2 + ((h >>> (q * 8)) % 60) / 100, ry = y + 0.2 + ((h >>> (q * 8 + 4)) % 60) / 100;
          const rs = 5 + ((h >>> (q * 3)) % 4);
          fill += `<ellipse cx="${f(rx * T)}" cy="${f(ry * T)}" rx="${rs + 2}" ry="${rs}" fill="${o.rock}" stroke="${INK}" stroke-width="2" /><path d="M${f(rx * T - rs)} ${f(ry * T - 1)} q${rs * 0.6} ${-rs * 0.8} ${rs * 1.4} ${-rs * 0.6}" stroke="${o.light}" stroke-width="1.6" fill="none" />`;
        }
      }
      // The vein: it crosses shared edges at points both tiles agree on, entering square to the edge,
      // and meets in the tile's middle.
      const ends = [];
      if (n && crosses(x, y - 1, 1, style)) ends.push([x + at(x, y - 1, 1), y, 0, 1]);
      if (s && crosses(x, y, 1, style)) ends.push([x + at(x, y, 1), y + 1, 0, -1]);
      if (w && crosses(x - 1, y, 0, style)) ends.push([x, y + at(x - 1, y, 0), 1, 0]);
      if (e && crosses(x, y, 0, style)) ends.push([x + 1, y + at(x, y, 0), -1, 0]);
      const h = hash(x, y, 9);
      const mx = x + 0.4 + (h % 20) / 100, my = y + 0.4 + ((h >>> 8) % 20) / 100;
      let vd = '';
      for (const [ex, ey, nx, ny] of ends) vd += `M${f(ex * T)} ${f(ey * T)} Q${f((ex + nx * 0.3) * T)} ${f((ey + ny * 0.3) * T)} ${f(mx * T)} ${f(my * T)} `;
      if (ends.length < 2) {
        // A dead end or a lone pocket: the vein swells into a lump of ore.
        vd += `M${f(mx * T - 5)} ${f(my * T)} L${f(mx * T + 5)} ${f(my * T + 1)} `;
      }
      const W0 = style.width;
      veins += `<g data-k="${k}"><path d="${vd}" stroke="${INK}" stroke-width="${W0 + 4}" /><path d="${vd}" stroke="${o.veinDark}" stroke-width="${W0 + 1}" /><path d="${vd}" stroke="${o.vein}" stroke-width="${W0 - 1.5}" /><path d="${vd}" stroke="${o.veinLight}" stroke-width="${Math.max(1, W0 * 0.22)}" transform="translate(-1 -1)" opacity="0.9" />`;
      // Glints of ore along it.
      const gx = mx * T + ((h >>> 16) % 9) - 4, gy = my * T + ((h >>> 20) % 9) - 4;
      veins += `<path d="M${f(gx)} ${f(gy - 3.5)} l2.5 3.5 l-2.5 3.5 l-2.5 -3.5 z" fill="${o.glint}" stroke="${INK}" stroke-width="0.8" /></g>`;
    }
  return `<g>${bed}</g>${style.slab ? `<g fill="#0a1322" opacity="0.35">${shadow}</g><g fill="none" stroke="${INK}" stroke-width="5">${ink}</g><g>${fill}</g><g fill="none" stroke-width="2.4" stroke-linecap="round">${bevel}</g><g fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${cracks}</g>` : `<g>${fill}</g>`}<g fill="none" stroke-linecap="round" stroke-linejoin="round">${veins}</g><g>${singles}</g>`;
}

/** A sample of ground: a round, ragged patch, a pair, a thin line, and a single node. */
export function sample(k) {
  const W = 11, H = 8;
  const g = Array.from({ length: H }, () => Array(W).fill(0));
  const r = 2.6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 3, y - 3.5) <= r + ((hash(x, y, k) % 100) / 100 - 0.5) * 0.8) g[y][x] = k;
  g[1][8] = g[1][9] = k; // a pair
  for (const [x, y] of [[7, 4], [8, 4], [8, 5], [8, 6], [9, 6]]) g[y][x] = k; // a thin winding line
  g[3][10] = k; // on its own
  return g;
}
