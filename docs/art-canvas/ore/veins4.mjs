// Bedrock looks, gentler than E: one slab for the whole patch, with a few cracks of ore, long seams, or ore
// showing through in worn patches. Tile by tile, with everything shared across an edge decided by a hash of
// where it is, so it carries on from tile to tile.
import { hash, ORE } from './veins.mjs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';

export function bedrock(grid, style) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  const m = 0.12;
  const s = style.step; // the lattice the cracks follow, in tiles
  const inOre = (px, py, k) => at(Math.floor(px), Math.floor(py)) === k;
  // A lattice corner, nudged unless it's near the patch's edge.
  const off = style.offset ?? 0;
  const corner = (i, j, k) => {
    const px = (i + off) * s, py = (j + off) * s;
    const e = 0.02;
    if (![[e, e], [-e, e], [e, -e], [-e, -e]].every(([a, b]) => inOre(px + a, py + b, k))) return style.inside ? null : [px, py];
    const h = hash(i, j, 71);
    const jj = s * 0.28;
    return [px + ((h % 100) / 100 - 0.5) * 2 * jj, py + (((h >>> 8) % 100) / 100 - 0.5) * 2 * jj];
  };
  const L = { bed: '', shadow: '', ink: '', rock: '', tone: '', bevel: '', hair: '', cInk: '', cDark: '', cOre: '', cHi: '', pocket: '', single: '' };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (!k) continue;
      const o = ORE[k];
      const n = at(x, y - 1) === k, e = at(x + 1, y) === k, so = at(x, y + 1) === k, w = at(x - 1, y) === k;
      const bm = 0.1;
      const [bl, br, bt, bb] = [w ? 0 : bm, e ? 0 : bm, n ? 0 : bm, so ? 0 : bm];
      L.bed += `<rect x="${f((x + bl) * T)}" y="${f((y + bt) * T)}" width="${f((1 - bl - br) * T)}" height="${f((1 - bt - bb) * T)}" rx="${f((Math.min(bl, br, bt, bb) ? 0.25 : 0.12) * T)}" fill="${o.bed}" />`;
      if (!(n || e || so || w)) {
        L.single += `<use href="#nd${k}" x="${f((x + 0.07) * T)}" y="${f((y + 0.07) * T)}" transform="rotate(${((x * 7 + y * 13) % 4) * 90} ${(x + 0.5) * T} ${(y + 0.5) * T})" />`;
        continue;
      }
      // The slab: the patch's shape, rounded where its corners are open.
      const [l, r, t, b] = [w ? 0 : m, e ? 0 : m, n ? 0 : m, so ? 0 : m];
      const X0 = (x + l) * T, X1 = (x + 1 - r) * T, Y0 = (y + t) * T, Y1 = (y + 1 - b) * T, rr = 0.2 * T;
      const c = { tl: !n && !w, tr: !n && !e, br: !so && !e, bl: !so && !w };
      const d = `M${f(X0 + (c.tl ? rr : 0))} ${f(Y0)} H${f(X1 - (c.tr ? rr : 0))} ${c.tr ? `Q${f(X1)} ${f(Y0)} ${f(X1)} ${f(Y0 + rr)}` : ''} V${f(Y1 - (c.br ? rr : 0))} ${c.br ? `Q${f(X1)} ${f(Y1)} ${f(X1 - rr)} ${f(Y1)}` : ''} H${f(X0 + (c.bl ? rr : 0))} ${c.bl ? `Q${f(X0)} ${f(Y1)} ${f(X0)} ${f(Y1 - rr)}` : ''} V${f(Y0 + (c.tl ? rr : 0))} ${c.tl ? `Q${f(X0)} ${f(Y0)} ${f(X0 + rr)} ${f(Y0)}` : ''} Z`;
      L.shadow += `<path d="${d}" />`;
      L.ink += `<path d="${d}" />`;
      L.rock += `<path d="${d}" fill="${o.rock}" />`;
      const i = 0.06 * T;
      if (!n) L.bevel += `<path d="M${f(X0 + (c.tl ? rr : i))} ${f(Y0 + i)} H${f(X1 - (c.tr ? rr : 0))}" stroke="${o.light}" />`;
      if (!w) L.bevel += `<path d="M${f(X0 + i)} ${f(Y0 + (c.tl ? rr : i))} V${f(Y1 - (c.bl ? rr : 0))}" stroke="${o.light}" />`;
      if (!so) L.bevel += `<path d="M${f(X0 + (c.bl ? rr : 0))} ${f(Y1 - i)} H${f(X1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
      if (!e) L.bevel += `<path d="M${f(X1 - i)} ${f(Y0 + (c.tr ? rr : 0))} V${f(Y1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
      // Soft tones in the rock, so it isn't flat.
      const h = hash(x, y, 73);
      const tx = x + 0.2 + (h % 45) / 100, ty = y + 0.2 + ((h >>> 7) % 45) / 100;
      L.tone += `<ellipse cx="${f(tx * T)}" cy="${f(ty * T)}" rx="${f(10 + (h >>> 14) % 8)}" ry="${f(7 + (h >>> 18) % 6)}" fill="${(h >>> 22) % 2 ? o.light : o.dark}" opacity="0.22" />`;
      L.tone += `<circle cx="${f((x + 0.15 + ((h >>> 3) % 70) / 100) * T)}" cy="${f((y + 0.15 + ((h >>> 9) % 70) / 100) * T)}" r="1.4" fill="${o.light}" opacity="0.6" />`;
      // Hairline cracks (no ore), here and there.
      if (style.hair && (h >>> 25) % 3 === 0) {
        const a = ((h >>> 4) % 628) / 100, hx = (x + 0.3 + ((h >>> 11) % 40) / 100) * T, hy = (y + 0.3 + ((h >>> 16) % 40) / 100) * T;
        L.hair += `<path d="M${f(hx)} ${f(hy)} l${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 8)} l${f(Math.cos(a + 0.6) * 6)} ${f(Math.sin(a + 0.6) * 6)}" stroke="${o.dark}" />`;
      }
      // Cracks of ore along the lattice's edges inside this tile (each edge drawn by the tile holding its middle).
      if (style.cracks) {
        const per = Math.round(1 / s);
        for (let jj = -1; jj <= per; jj++)
          for (let ii = -1; ii <= per; ii++) {
            const ci = x * per + ii, cj = y * per + jj;
            for (const [di, dj, dir] of [[1, 0, 0], [0, 1, 1]]) {
              const mxp = (ci + di / 2 + off) * s, myp = (cj + dj / 2 + off) * s;
              // Only edges with ore on both sides: none along the slab's own outline.
              if (!inOre(mxp + (dir === 1 ? 0.06 : 0), myp + (dir === 0 ? 0.06 : 0), k) || !inOre(mxp - (dir === 1 ? 0.06 : 0), myp - (dir === 0 ? 0.06 : 0), k)) continue;
              if (!inOre(mxp, myp, k)) continue;
              if (Math.floor(mxp + (dir === 0 ? 0.001 : 0)) !== x || Math.floor(myp + (dir === 1 ? 0.001 : 0)) !== y) continue;
              if (mxp === x + 1 || myp === y + 1) continue;
              const p = dir === 0 ? style.along : style.across;
              if (hash(ci, cj, 75 + dir) % 100 >= p) continue;
              // Both ends must lie in the ore too.
              if (!inOre((ci + off) * s, (cj + off) * s, k) || !inOre((ci + di + off) * s, (cj + dj + off) * s, k)) continue;
              const A = corner(ci, cj, k), B = corner(ci + di, cj + dj, k);
              if (!A || !B) continue;
              // Bend it a little at its middle.
              const hm = hash(ci, cj, 77 + dir);
              const bx = (A[0] + B[0]) / 2 + ((hm % 100) / 100 - 0.5) * s * 0.3, by = (A[1] + B[1]) / 2 + (((hm >>> 8) % 100) / 100 - 0.5) * s * 0.3;
              const dd = `M${f(A[0] * T)} ${f(A[1] * T)} Q${f(bx * T)} ${f(by * T)} ${f(B[0] * T)} ${f(B[1] * T)}`;
              L.cInk += `<path d="${dd}" />`;
              L.cDark += `<path d="${dd}" stroke="${o.veinDark}" />`;
              L.cOre += `<path d="${dd}" stroke="${o.vein}" />`;
              L.cHi += `<path d="${dd}" stroke="${o.veinLight}" />`;
            }
          }
      }
      // Ore showing through where the rock is worn away.
      if (style.pockets && hash(x, y, 79) % 100 < style.pockets) {
        const hp = hash(x, y, 81);
        const px = (x + 0.3 + (hp % 40) / 100) * T, py = (y + 0.3 + ((hp >>> 8) % 40) / 100) * T;
        const R = 9 + ((hp >>> 16) % 6);
        const pts = [];
        for (let q = 0; q < 7; q++) {
          const a = (q / 7) * Math.PI * 2;
          const rq = R * (0.7 + ((hp >>> (q * 4)) % 8) / 20);
          pts.push(`${f(px + Math.cos(a) * rq * 1.2)} ${f(py + Math.sin(a) * rq * 0.85)}`);
        }
        const pd = `M${pts.join(' L')} Z`;
        L.pocket += `<g stroke-linejoin="round"><path d="${pd}" fill="${o.vein}" stroke="${INK}" stroke-width="1.6" /><path d="${pd}" fill="none" stroke="${o.veinDark}" stroke-width="2.2" transform="translate(1.2 1.6)" clip-path="none" opacity="0.7" /><circle cx="${f(px - R * 0.3)}" cy="${f(py - R * 0.2)}" r="1.6" fill="${o.veinLight}" /><circle cx="${f(px + R * 0.35)}" cy="${f(py + R * 0.1)}" r="1.1" fill="${o.veinLight}" /></g>`;
      }
    }
  const V = style.width ?? 3;
  return `<g>${L.bed}</g>
<g fill="#0a1322" opacity="0.35" transform="translate(3 5)">${L.shadow}</g>
<g fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round">${L.ink}</g>
<g>${L.rock}</g><g>${L.tone}</g>
<g fill="none" stroke-width="2.2" stroke-linecap="round" opacity="0.9">${L.bevel}</g>
<g fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${L.hair}</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${INK}" stroke-width="${V + 2.6}">${L.cInk}</g><g stroke-width="${V + 1}">${L.cDark}</g><g stroke-width="${V}">${L.cOre}</g><g stroke-width="${Math.max(0.8, V * 0.3)}" transform="translate(-0.6 -0.6)" opacity="0.8">${L.cHi}</g></g>
<g>${L.pocket}</g><g>${L.single}</g>`;
}
