// Two more looks for ore patches, tile by tile like the game would draw them.
import { hash, ORE } from './veins.mjs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';

function bedRect(x, y, k, at) {
  const m = 0.1;
  const [l, r, t, b] = [at(x - 1, y) === k ? 0 : m, at(x + 1, y) === k ? 0 : m, at(x, y - 1) === k ? 0 : m, at(x, y + 1) === k ? 0 : m];
  return [x + l, y + t, 1 - l - r, 1 - t - b, Math.min(l, r, t, b) ? 0.25 : 0.12];
}

/** The vein's path in one tile: through shared, slanted crossings on its edges, bending at a point of its own. */
function veinPath(x, y, k, at, style) {
  const count = (X, Y) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([a, b]) => at(X + a, Y + b) === k).length;
  const crosses = (X, Y, d) => hash(X, Y, d + 7) % 100 < (d === 0 ? style.across : style.down) || (count(X, Y) <= 2 && count(X + (d === 0 ? 1 : 0), Y + (d === 1 ? 1 : 0)) <= 2);
  const pos = (X, Y, d) => 0.32 + (hash(X, Y, d + 11) % 36) / 100;
  const dir = (X, Y, d, nx, ny) => {
    const t = ((hash(X, Y, d + 13) % 100) / 100 - 0.5) * 1.75;
    return [nx * Math.cos(t) - ny * Math.sin(t), nx * Math.sin(t) + ny * Math.cos(t)];
  };
  const ends = [];
  if (at(x, y - 1) === k && crosses(x, y - 1, 1)) ends.push([x + pos(x, y - 1, 1), y, ...dir(x, y - 1, 1, 0, 1)]);
  if (at(x, y + 1) === k && crosses(x, y, 1)) ends.push([x + pos(x, y, 1), y + 1, ...dir(x, y, 1, 0, -1)]);
  if (at(x - 1, y) === k && crosses(x - 1, y, 0)) ends.push([x, y + pos(x - 1, y, 0), ...dir(x - 1, y, 0, 1, 0)]);
  if (at(x + 1, y) === k && crosses(x, y, 0)) ends.push([x + 1, y + pos(x, y, 0), ...dir(x, y, 0, -1, 0)]);
  const mx = x + 0.38 + (hash(x, y, 9) % 24) / 100, my = y + 0.38 + ((hash(x, y, 9) >>> 8) % 24) / 100;
  let d = '';
  for (const [ex, ey, nx, ny] of ends) d += `M${f(ex * T)} ${f(ey * T)} Q${f((ex + nx * 0.3) * T)} ${f((ey + ny * 0.3) * T)} ${f(mx * T)} ${f(my * T)} `;
  if (ends.length === 1) d += `L${f((mx + (mx - ends[0][0]) * 0.3) * T)} ${f((my + (my - ends[0][1]) * 0.3) * T)}`;
  return { d, mx, my, n: ends.length };
}

/** 1 · Today's rocks, a little smaller, with a vein of ore running through the bed between them. */
export function originalWithVein(grid, style) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  let bed = '', vInk = '', vDark = '', vOre = '', vHi = '', rocks = '', glints = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (!k) continue;
      const o = ORE[k];
      const [bx, by, bw, bh, br] = bedRect(x, y, k, at);
      bed += `<rect x="${f(bx * T)}" y="${f(by * T)}" width="${f(bw * T)}" height="${f(bh * T)}" rx="${f(br * T)}" fill="${o.bed}" />`;
      const lone = ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => at(x + a, y + b) === k);
      const turn = ((x * 7 + y * 13) % 4) * 90;
      const sc = lone ? 0.86 : style.rock;
      rocks += `<use href="#nd${k}" transform="rotate(${turn} ${(x + 0.5) * T} ${(y + 0.5) * T}) translate(${f((x + 0.5 - sc / 2) * T)} ${f((y + 0.5 - sc / 2) * T)}) scale(${f(sc / 0.86 * 100) / 100})" />`;
      if (lone) continue;
      const v = veinPath(x, y, k, at, style);
      if (!v.n) continue;
      vInk += `<path d="${v.d}" />`;
      vDark += `<path d="${v.d}" stroke="${o.veinDark}" />`;
      vOre += `<path d="${v.d}" stroke="${o.vein}" />`;
      vHi += `<path d="${v.d}" stroke="${o.veinLight}" />`;
      // Specks of ore glinting in the bed beside it.
      const h = hash(x, y, 51);
      for (let q = 0; q < 3; q++) {
        const gx = x + 0.15 + ((h >>> (q * 7)) % 70) / 100, gy = y + 0.15 + ((h >>> (q * 7 + 3)) % 70) / 100;
        glints += `<circle cx="${f(gx * T)}" cy="${f(gy * T)}" r="1.4" fill="${o.vein}" />`;
      }
    }
  const V = style.width;
  return `<g>${bed}</g><g>${glints}</g><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${INK}" stroke-width="${V + 3}" opacity="0.85">${vInk}</g><g stroke-width="${V}">${vDark}</g><g stroke-width="${V - 2.2}">${vOre}</g><g stroke-width="${Math.max(1, V * 0.22)}" transform="translate(-0.8 -0.8)">${vHi}</g></g><g>${rocks}</g>`;
}

/**
 * 2 · Cracked bedrock: the patch is flat rock broken into slabs, ore filling the cracks between them, crystals
 * of ore pushing up where cracks meet. The slabs' corners lie on a half-tile grid, each corner nudged by a hash
 * of where it is, so neighbouring tiles share them and the cracks run on from tile to tile.
 */
export function crackedBedrock(grid, style) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  // A corner of the half-tile grid, in tiles: nudged unless it lies on the patch's outer edge.
  const corner = (cx, cy) => {
    // A corner touching a tile outside the patch stays on the grid, so no slab pokes out over the grass.
    const xs = cx % 2 ? [(cx - 1) / 2] : [cx / 2 - 1, cx / 2];
    const ys = cy % 2 ? [(cy - 1) / 2] : [cy / 2 - 1, cy / 2];
    const ks = xs.flatMap((tx) => ys.map((ty) => at(tx, ty)));
    if (!ks.every((v) => v && v === ks[0])) return [cx / 2, cy / 2];
    const h = hash(cx, cy, 61);
    const j = 0.13;
    return [cx / 2 + ((h % 100) / 100 - 0.5) * 2 * j, cy / 2 + (((h >>> 8) % 100) / 100 - 0.5) * 2 * j];
  };
  let bed = '', seam = '', shadow = '', ink = '', slab = '', bevel = '', crystals = '', single = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (!k) continue;
      const o = ORE[k];
      const [bx, by, bw, bh, br] = bedRect(x, y, k, at);
      bed += `<rect x="${f(bx * T)}" y="${f(by * T)}" width="${f(bw * T)}" height="${f(bh * T)}" rx="${f(br * T)}" fill="${o.bed}" />`;
      const lone = ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => at(x + a, y + b) === k);
      if (lone) {
        single += `<use href="#nd${k}" x="${f((x + 0.07) * T)}" y="${f((y + 0.07) * T)}" transform="rotate(${((x * 7 + y * 13) % 4) * 90} ${(x + 0.5) * T} ${(y + 0.5) * T})" />`;
        continue;
      }
      // The ore that shows in the cracks: the patch's shape, a little inside the bed.
      const m = 0.13;
      const [l, r, t, b] = [at(x - 1, y) === k ? 0 : m, at(x + 1, y) === k ? 0 : m, at(x, y - 1) === k ? 0 : m, at(x, y + 1) === k ? 0 : m];
      seam += `<rect fill="${o.vein}" stroke="${o.veinDark}" stroke-width="2" x="${f((x + l) * T)}" y="${f((y + t) * T)}" width="${f((1 - l - r) * T)}" height="${f((1 - t - b) * T)}" rx="${f((Math.min(l, r, t, b) ? 0.22 : 0.06) * T)}" />`;
      // Four slabs per tile.
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const gx = x * 2 + i, gy = y * 2 + j;
          let pts = [corner(gx, gy), corner(gx + 1, gy), corner(gx + 1, gy + 1), corner(gx, gy + 1)];
          // Keep slabs on the patch's outer edge inside it.
          // Only on the patch's open sides: elsewhere the corner is shared with the next tile and stays put.
          pts = pts.map(([px, py]) => [l ? Math.max(px, x + l) : px, t ? Math.max(py, y + t) : py]).map(([px, py]) => [r ? Math.min(px, x + 1 - r) : px, b ? Math.min(py, y + 1 - b) : py]);
          const ccx = pts.reduce((a, p) => a + p[0], 0) / 4, ccy = pts.reduce((a, p) => a + p[1], 0) / 4;
          // Shrink towards the middle, leaving the crack.
          const g = style.crack;
          const sp = pts.map(([px, py]) => {
            const dx = ccx - px, dy = ccy - py, dl = Math.hypot(dx, dy);
            return [px + (dx / dl) * g, py + (dy / dl) * g];
          });
          const d = `M${sp.map(([px, py]) => `${f(px * T)} ${f(py * T)}`).join(' L')} Z`;
          const tone = [o.rock, o.light, o.dark][hash(gx, gy, 63) % 5 === 0 ? 2 : hash(gx, gy, 63) % 5 === 1 ? 1 : 0];
          shadow += `<path d="${d}" />`;
          ink += `<path d="${d}" />`;
          slab += `<path d="${d}" fill="${tone === o.light ? o.rock : tone}" />`;
          // A lit top-left edge on each slab.
          bevel += `<path d="M${f(sp[3][0] * T + 2)} ${f(sp[3][1] * T - 3)} L${f(sp[0][0] * T + 2.5)} ${f(sp[0][1] * T + 2.5)} L${f(sp[1][0] * T - 3)} ${f(sp[1][1] * T + 2)}" stroke="${o.light}" />`;
        }
      // Crystals where cracks meet, inside the patch.
      for (const [cx, cy] of [[x * 2 + 1, y * 2 + 1], [x * 2 + 2, y * 2 + 1], [x * 2 + 1, y * 2 + 2]]) {
        const h = hash(cx, cy, 67);
        if (h % 2) continue;
        const [px, py] = corner(cx, cy);
        if (px < x + l + 0.1 || px > x + 1 - r - 0.1 || py < y + t + 0.1 || py > y + 1 - b - 0.1) continue;
        const X = px * T, Y = py * T;
        crystals += `<g stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"><path d="M${f(X - 7)} ${f(Y + 4)} L${f(X - 4)} ${f(Y - 8)} L${f(X)} ${f(Y + 4)} Z" fill="${o.vein}" /><path d="M${f(X - 1)} ${f(Y + 5)} L${f(X + 3)} ${f(Y - 5)} L${f(X + 8)} ${f(Y + 5)} Z" fill="${o.veinDark}" /><path d="M${f(X - 4)} ${f(Y + 5)} L${f(X - 1)} ${f(Y - 2)} L${f(X + 2)} ${f(Y + 5)} Z" fill="${o.vein}" /><path d="M${f(X - 4)} ${f(Y - 8)} L${f(X - 3)} ${f(Y + 1)} L${f(X - 5.5)} ${f(Y + 2)} Z" fill="${o.veinLight}" stroke="none" /></g>`;
      }
    }
  return `<g>${bed}</g>
<g>${seam}</g>
<g fill="#0a1322" opacity="0.4" transform="translate(1.5 2.5)">${shadow}</g>
<g fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round">${ink}</g>
<g>${slab}</g>
<g fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">${bevel}</g>
<g>${crystals}</g><g>${single}</g>`;
}
