// Prototype 2: an ore patch as one lumpy outcrop of rock, a vein of ore winding through it. Each tile looks
// only at its neighbours and at hashes both sides of an edge agree on, so the game can draw it tile by tile.
// Every layer is drawn for all tiles before the next, so neither the outcrop nor the vein shows a seam.
import { hash, ORE } from './veins.mjs';
export { ORE };
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';

export function patchSvg(grid, style, sprites) {
  const H = grid.length, W = grid[0].length;
  const kindAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  const L = { facet: '', nug: '', bed: '', shadow: '', ink: '', rock: '', hi: '', lo: '', crack: '', vInk: '', vDark: '', vOre: '', vHi: '', glint: '', single: '' };
  const lumps = []; // [cx, cy, rx, ry]
  const bars = []; // rect [x, y, w, h]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = kindAt(x, y);
      if (!k) continue;
      const o = ORE[k];
      const same = (dx, dy) => kindAt(x + dx, y + dy) === k;
      const n = same(0, -1), e = same(1, 0), s = same(0, 1), w = same(-1, 0);
      const bm = 0.1;
      const [bl, br, bt, bb] = [w ? 0 : bm, e ? 0 : bm, n ? 0 : bm, s ? 0 : bm];
      L.bed += `<rect x="${f((x + bl) * T)}" y="${f((y + bt) * T)}" width="${f((1 - bl - br) * T)}" height="${f((1 - bt - bb) * T)}" rx="${f((Math.min(bl, br, bt, bb) ? 0.25 : 0.12) * T)}" fill="${o.bed}" />`;
      if (!(n || e || s || w)) {
        L.single += `<image href="${sprites[k]}" x="${f((x + 0.07) * T)}" y="${f((y + 0.07) * T)}" width="${f(0.86 * T)}" height="${f(0.86 * T)}" />`;
        continue;
      }
      // The outcrop: a rounded lump of rock on each tile, bridged to its neighbours; where four tiles meet, the gap is filled.
      const h = hash(x, y, 21);
      const cx = x + 0.5 + ((h % 11) - 5) / 100, cy = y + 0.5 + (((h >>> 6) % 11) - 5) / 100;
      const rx = 0.4 + ((h >>> 12) % 8) / 100, ry = 0.38 + ((h >>> 16) % 8) / 100;
      const lump = (X, Y, RX, RY) => `M${f((X - RX) * T)} ${f(Y * T)} a${f(RX * T)} ${f(RY * T)} 0 1 0 ${f(2 * RX * T)} 0 a${f(RX * T)} ${f(RY * T)} 0 1 0 ${f(-2 * RX * T)} 0 Z`;
      const shapes = [lump(cx, cy, rx, ry)];
      // Smaller boulders round the edge where the outcrop ends, so its outline is lumpy, not round.
      for (let q = 0; q < 2; q++) {
        const a = (((h >>> (20 + q * 5)) % 32) / 32) * Math.PI * 2;
        const ox = Math.cos(a), oy = Math.sin(a);
        // Only towards open sides.
        if ((ox > 0.5 && e) || (ox < -0.5 && w) || (oy > 0.5 && s) || (oy < -0.5 && n)) continue;
        shapes.push(lump(cx + ox * 0.26, cy + oy * 0.26, 0.2, 0.18));
      }
      const B = 0.34;
      if (e) shapes.push(`M${f((x + 0.5) * T)} ${f((y + 0.5 - B) * T)} h${T} v${f(2 * B * T)} h${-T} Z`);
      if (s) shapes.push(`M${f((x + 0.5 - B) * T)} ${f((y + 0.5) * T)} h${f(2 * B * T)} v${T} h${f(-2 * B * T)} Z`);
      if (e && s && same(1, 1)) shapes.push(`M${f((x + 0.5) * T)} ${f((y + 0.5) * T)} h${T} v${T} h${-T} Z`);
      for (const shape of shapes) {
        L.shadow += `<path d="${shape}" />`;
        L.ink += `<path d="${shape}" />`;
        L.rock += `<path d="${shape}" fill="${o.rock}" />`;
      }
      // Light on the lump's top-left, where it isn't joined on.
      if (!n || !w) L.hi += `<path d="M${f((cx - rx * 0.75) * T)} ${f((cy - ry * 0.05) * T)} Q${f((cx - rx * 0.6) * T)} ${f((cy - ry * 0.7) * T)} ${f((cx + rx * 0.05) * T)} ${f((cy - ry * 0.78) * T)}" stroke="${o.light}" />`;
      if (!s || !e) L.lo += `<path d="M${f((cx + rx * 0.75) * T)} ${f((cy + ry * 0.1) * T)} Q${f((cx + rx * 0.6) * T)} ${f((cy + ry * 0.7) * T)} ${f((cx - rx * 0.05) * T)} ${f((cy + ry * 0.8) * T)}" stroke="${o.dark}" />`;
      const a = ((h >>> 3) % 628) / 100;
      // Facets: a lighter chip and a darker hollow somewhere in the rock.
      const fx = x + 0.2 + ((h >>> 9) % 50) / 100, fy = y + 0.2 + ((h >>> 14) % 50) / 100;
      L.facet += `<path d="M${f(fx * T)} ${f(fy * T)} l7 -4 l6 3 l-2 6 l-8 1 z" fill="${o.light}" opacity="0.35" />`;
      const gx2 = x + 0.25 + ((h >>> 18) % 50) / 100, gy2 = y + 0.25 + ((h >>> 23) % 50) / 100;
      L.facet += `<path d="M${f(gx2 * T)} ${f(gy2 * T)} q5 -4 11 -1 q-2 5 -8 5 z" fill="${o.dark}" opacity="0.45" />`;
      L.facet += `<circle cx="${f((x + 0.15 + ((h >>> 5) % 70) / 100) * T)}" cy="${f((y + 0.15 + ((h >>> 11) % 70) / 100) * T)}" r="1.5" fill="${o.light}" opacity="0.7" />`;
      L.crack += `<path d="M${f((cx + Math.cos(a) * 0.2) * T)} ${f((cy + Math.sin(a) * 0.2) * T)} l${f(Math.cos(a + 1) * 7)} ${f(Math.sin(a + 1) * 7)} l${f(Math.cos(a + 0.3) * 5)} ${f(Math.sin(a + 0.3) * 5)}" stroke="${o.dark}" />`;
      // The vein crosses shared edges where both tiles agree, entering square to the edge, and bends through
      // a point of its own in each tile.
      // Thin parts of a patch (a tile with two or fewer of its own ore beside it, on both sides of the edge)
      // always carry the vein, so a pair or a line has one running through it.
      const count = (X, Y) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([a, b]) => kindAt(X + a, Y + b) === k).length;
      const crosses = (X, Y, d) => hash(X, Y, d + 7) % 100 < (d === 0 ? style.across : style.down) || (count(X, Y) <= 2 && count(X + (d === 0 ? 1 : 0), Y + (d === 1 ? 1 : 0)) <= 2);
      const at = (X, Y, d) => 0.32 + (hash(X, Y, d + 11) % 36) / 100;
      // The slant the vein crosses at: up to 50° off square, the same seen from either side.
      const slant = (X, Y, d) => (((hash(X, Y, d + 13) % 100) / 100) - 0.5) * 1.75;
      const dir = (X, Y, d, nx, ny) => {
        const t = slant(X, Y, d);
        // Both sides turn their inward normal by the same angle, so the two halves leave the edge as one line.
        return [nx * Math.cos(t) - ny * Math.sin(t), nx * Math.sin(t) + ny * Math.cos(t)];
      };
      const ends = [];
      if (n && crosses(x, y - 1, 1)) ends.push([x + at(x, y - 1, 1), y, ...dir(x, y - 1, 1, 0, 1)]);
      if (s && crosses(x, y, 1)) ends.push([x + at(x, y, 1), y + 1, ...dir(x, y, 1, 0, -1)]);
      if (w && crosses(x - 1, y, 0)) ends.push([x, y + at(x - 1, y, 0), ...dir(x - 1, y, 0, 1, 0)]);
      if (e && crosses(x, y, 0)) ends.push([x + 1, y + at(x, y, 0), ...dir(x, y, 0, -1, 0)]);
      if (!ends.length) continue;
      const mx = x + 0.38 + (hash(x, y, 9) % 24) / 100, my = y + 0.38 + ((hash(x, y, 9) >>> 8) % 24) / 100;
      let d = '';
      for (const [ex, ey, nx, ny] of ends) d += `M${f(ex * T)} ${f(ey * T)} Q${f((ex + nx * 0.3) * T)} ${f((ey + ny * 0.3) * T)} ${f(mx * T)} ${f(my * T)} `;
      if (ends.length === 1) {
        // A dead end: the vein runs on a little and peters out.
        const [ex, ey] = ends[0];
        d += `M${f(mx * T)} ${f(my * T)} L${f((mx + (mx - ex) * 0.25) * T)} ${f((my + (my - ey) * 0.25) * T)}`;
      }
      if (style.chunks) {
        // The vein as a chain of ore chunks along the same curves, each a little different.
        let q = 0;
        const chunk = (px, py, size) => {
          const hq = hash(Math.round(px * 7), Math.round(py * 7), 41);
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + (hq % 7) / 10;
            const rr = size * (0.75 + ((hq >>> (i * 3)) % 6) / 20);
            pts.push(`${f(px + Math.cos(a) * rr)} ${f(py + Math.sin(a) * rr * 0.85)}`);
          }
          const dd = `M${pts.join(' L')} Z`;
          L.vInk += `<path d="${dd}" />`;
          L.vOre += `<path d="${dd}" fill="${o.vein}" />`;
          // The lit facet on its top-left, the shaded one on its bottom-right.
          L.vHi += `<path d="M${f(px - size * 0.55)} ${f(py - size * 0.05)} L${f(px - size * 0.15)} ${f(py - size * 0.6)} L${f(px + size * 0.25)} ${f(py - size * 0.35)} L${f(px - size * 0.1)} ${f(py)} Z" fill="${o.veinLight}" />`;
          L.vDark += `<path d="M${f(px + size * 0.6)} ${f(py + size * 0.05)} L${f(px + size * 0.2)} ${f(py + size * 0.6)} L${f(px - size * 0.1)} ${f(py + size * 0.3)} Z" fill="${o.veinDark}" />`;
          q++;
        };
        const curves = ends.map(([ex, ey, nx, ny]) => [ex * T, ey * T, (ex + nx * 0.3) * T, (ey + ny * 0.3) * T, mx * T, my * T]);
        for (const [x0, y0, x1, y1, x2, y2] of curves) {
          // From just inside the edge (the neighbour draws the chunk on the edge itself) to the middle.
          for (let t = 0.12; t < 1.01; t += 0.22) {
            const u = 1 - t;
            const px = u * u * x0 + 2 * u * t * x1 + t * t * x2, py = u * u * y0 + 2 * u * t * y1 + t * t * y2;
            chunk(px, py, style.width * (0.55 + (hash(Math.round(px), Math.round(py), 43) % 5) / 10));
          }
        }
        continue;
      }
      L.vInk += `<path d="${d}" />`;
      L.vDark += `<path d="${d}" stroke="${o.veinDark}" />`;
      L.vOre += `<path d="${d}" stroke="${o.vein}" />`;
      L.vHi += `<path d="${d}" stroke="${o.veinLight}" />`;
      if (style.nuggets && hash(x, y, 33) % 2 === 0) {
        // A nugget of ore where the vein bends: a few crystals, lit from the top-left.
        const gx = mx * T, gy = my * T;
        L.nug += `<g stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"><path d="M${f(gx - 6)} ${f(gy + 1)} l3 -6 l6 1 l2 6 l-5 4 z" fill="${o.vein}" /><path d="M${f(gx - 3)} ${f(gy - 5)} l6 1 l-3 4 z" fill="${o.veinLight}" stroke="none" /><path d="M${f(gx + 1)} ${f(gy + 6)} l4 -3 l3 4 l-4 3 z" fill="${o.veinDark}" /></g>`;
      }
      if (hash(x, y, 31) % 3 === 0) {
        const gx = mx * T, gy = my * T;
        L.glint += `<path d="M${f(gx)} ${f(gy - 3.4)} l2.4 3.4 l-2.4 3.4 l-2.4 -3.4 z" fill="${o.glint}" stroke="${INK}" stroke-width="0.8" />`;
      }
    }
  const V = style.width;
  return `<g>${L.bed}</g>
<g fill="#0a1322" opacity="0.35" transform="translate(3 5)">${L.shadow}</g>
<g fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round">${L.ink}</g>
<g>${L.rock}</g><g>${L.facet}</g>
<g fill="none" stroke-width="2.6" stroke-linecap="round" opacity="0.9">${L.hi}${L.lo}</g>
<g fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${L.crack}</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
${style.chunks ? `<g fill="${INK}" stroke="${INK}" stroke-width="3.4">${L.vInk}</g><g stroke="none">${L.vOre}${L.vHi}${L.vDark}</g>` : `<g stroke="${INK}" stroke-width="${V + 3}">${L.vInk}</g><g stroke-width="${V}">${L.vDark}</g><g stroke-width="${V - 2.2}">${L.vOre}</g><g stroke-width="${Math.max(1, V * 0.2)}" transform="translate(-0.8 -0.8)" opacity="0.85">${L.vHi}</g>`}
</g><g>${L.nug}</g><g>${L.glint}</g><g>${L.single}</g>`;
}
