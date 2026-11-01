// H + E: a slab of bedrock with worn spots where ore shows, and cracks of ore spreading out from each spot,
// wide and glowing near it, thinner and dimmer further away. Tile by tile: every spot's place comes from
// its tile's hash, so any tile can find the spots near it, and a crack's width at a point depends only on
// where that point is, so cracks join up across tile edges.
import { hash, ORE } from './veins.mjs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';
let uid = 0;

export function wornBedrock(grid, st) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  const id = `wb${uid++}`;
  const inOre = (px, py, k) => at(Math.floor(px), Math.floor(py)) === k;
  const joined = (x, y, k) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => at(x + a, y + b) === k);
  /** The worn spot on a tile, if it has one: its middle and size, in tiles. */
  const spot = (x, y) => {
    const k = at(x, y);
    if (!k || !joined(x, y, k) || hash(x, y, 91) % 100 >= st.spots) return null;
    const h = hash(x, y, 93);
    return { x: x + 0.3 + (h % 40) / 100, y: y + 0.3 + ((h >>> 8) % 40) / 100, r: 0.11 + ((h >>> 16) % 5) / 100, h };
  };
  /** How strongly the ore shows at a point: 1 at a spot's edge, falling to 0 st.reach tiles away. */
  const glow = (px, py) => {
    let best = 0;
    for (let y = Math.floor(py) - 2; y <= Math.floor(py) + 2; y++)
      for (let x = Math.floor(px) - 2; x <= Math.floor(px) + 2; x++) {
        const s = spot(x, y);
        if (!s) continue;
        const d = Math.max(0, Math.hypot(px - s.x, py - s.y) - s.r);
        best = Math.max(best, 1 - d / st.reach);
      }
    return Math.max(0, best);
  };
  // Lattice corners on a half-tile grid, nudged where they're well inside the patch.
  const corner = (i, j, k) => {
    const px = i / 2, py = j / 2, e = 0.02;
    if (![[e, e], [-e, e], [e, -e], [-e, -e]].every(([a, b]) => inOre(px + a, py + b, k))) return [px, py];
    const h = hash(i, j, 61);
    return [px + ((h % 100) / 100 - 0.5) * 0.26, py + (((h >>> 8) % 100) / 100 - 0.5) * 0.26];
  };
  const L = { cInk: '', cOre: '', cHi: '', bed: '', clip: '', shadow: '', ink: '', rock: '', tone: '', bevel: '', hair: '', halo: '', crack: '', spots: '', single: '' };
  /** A crack from A to B, tapering from one width to the other, in the colour its strength calls for. */
  const crack = (A, B, o, steps = 4) => {
    for (let q = 0; q < steps; q++) {
      const t0 = q / steps, t1 = (q + 1) / steps;
      const P0 = [A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0], P1 = [A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1];
      const g = glow((P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2);
      if (g <= st.fade) continue;
      const w = st.thin + (st.wide - st.thin) * g * g;
      const d = `M${f(P0[0] * T)} ${f(P0[1] * T)} L${f(P1[0] * T)} ${f(P1[1] * T)}`;
      L.halo += `<path d="${d}" stroke="${o.veinLight}" stroke-width="${f(w + 9 * g)}" opacity="${f(0.28 * g * 100) / 100}" />`;
      // Outlines, ore and highlights each go in their own layer, so one piece never paints over the next.
      L.cInk += `<path d="${d}" stroke-width="${f(w + 0.6 + 1.2 * g)}" />`;
      L.cOre += `<path d="${d}" stroke="${g > 0.45 ? o.vein : o.veinDark}" stroke-width="${f(w)}" />`;
      if (g > 0.55) L.cHi += `<path d="${d}" stroke="${o.veinLight}" stroke-width="${f(Math.max(0.8, w * 0.35))}" />`;
    }
  };
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
      // The slab.
      const m = 0.12;
      const [l, r, t, b] = [w ? 0 : m, e ? 0 : m, n ? 0 : m, so ? 0 : m];
      const X0 = (x + l) * T, X1 = (x + 1 - r) * T, Y0 = (y + t) * T, Y1 = (y + 1 - b) * T, rr = 0.2 * T;
      const c = { tl: !n && !w, tr: !n && !e, br: !so && !e, bl: !so && !w };
      const d = `M${f(X0 + (c.tl ? rr : 0))} ${f(Y0)} H${f(X1 - (c.tr ? rr : 0))} ${c.tr ? `Q${f(X1)} ${f(Y0)} ${f(X1)} ${f(Y0 + rr)}` : ''} V${f(Y1 - (c.br ? rr : 0))} ${c.br ? `Q${f(X1)} ${f(Y1)} ${f(X1 - rr)} ${f(Y1)}` : ''} H${f(X0 + (c.bl ? rr : 0))} ${c.bl ? `Q${f(X0)} ${f(Y1)} ${f(X0)} ${f(Y1 - rr)}` : ''} V${f(Y0 + (c.tl ? rr : 0))} ${c.tl ? `Q${f(X0)} ${f(Y0)} ${f(X0 + rr)} ${f(Y0)}` : ''} Z`;
      L.clip += `<path d="${d}" />`;
      L.shadow += `<path d="${d}" />`;
      L.ink += `<path d="${d}" />`;
      L.rock += `<path d="${d}" fill="${o.rock}" />`;
      const i = 0.06 * T;
      if (!n) L.bevel += `<path d="M${f(X0 + (c.tl ? rr : i))} ${f(Y0 + i)} H${f(X1 - (c.tr ? rr : 0))}" stroke="${o.light}" />`;
      if (!w) L.bevel += `<path d="M${f(X0 + i)} ${f(Y0 + (c.tl ? rr : i))} V${f(Y1 - (c.bl ? rr : 0))}" stroke="${o.light}" />`;
      if (!so) L.bevel += `<path d="M${f(X0 + (c.bl ? rr : 0))} ${f(Y1 - i)} H${f(X1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
      if (!e) L.bevel += `<path d="M${f(X1 - i)} ${f(Y0 + (c.tr ? rr : 0))} V${f(Y1 - (c.br ? rr : i))}" stroke="${o.dark}" />`;
      const h = hash(x, y, 73);
      L.tone += `<ellipse cx="${f((x + 0.2 + (h % 45) / 100) * T)}" cy="${f((y + 0.2 + ((h >>> 7) % 45) / 100) * T)}" rx="${f(10 + (h >>> 14) % 8)}" ry="${f(7 + (h >>> 18) % 6)}" fill="${(h >>> 22) % 2 ? o.light : o.dark}" opacity="0.22" />`;
      // Cracks along the half-tile lattice, each edge drawn by the tile holding its middle, kept only where
      // a spot is near enough (and not every one of those, so it isn't a grid).
      for (let jj = 0; jj <= 2; jj++)
        for (let ii = 0; ii <= 2; ii++) {
          const ci = x * 2 + ii, cj = y * 2 + jj;
          for (const [di, dj] of [[1, 0], [0, 1]]) {
            const mx = (ci + di / 2) / 2, my = (cj + dj / 2) / 2;
            if (Math.floor(mx) !== x || Math.floor(my) !== y || mx >= x + 1 || my >= y + 1) continue;
            if (glow(mx, my) <= 0.05 || hash(ci, cj, 95 + di) % 100 >= st.keep) continue;
            crack(corner(ci, cj, k), corner(ci + di, cj + dj, k), o);
          }
        }
      // The worn spot: a hollow in the rock, ore glowing at its bottom, with cracks leading off to the lattice.
      const s = spot(x, y);
      if (s) {
        const ci = Math.floor(s.x * 2), cj = Math.floor(s.y * 2);
        for (const [a, bq] of [[0, 0], [1, 0], [0, 1], [1, 1]]) crack([s.x, s.y], corner(ci + a, cj + bq, k), o, 3);
        const pts = [];
        for (let q = 0; q < 8; q++) {
          const a = (q / 8) * Math.PI * 2;
          const rq = s.r * (0.8 + ((s.h >>> (q * 3)) % 6) / 15);
          pts.push(`${f((s.x + Math.cos(a) * rq) * T)} ${f((s.y + Math.sin(a) * rq * 0.85) * T)}`);
        }
        const pd = `M${pts.join(' L')} Z`;
        const gid = `${id}g${x}_${y}`;
        L.halo += `<circle cx="${f(s.x * T)}" cy="${f(s.y * T)}" r="${f((s.r + 0.45) * T)}" fill="url(#${gid})" />`;
        L.spots += `<radialGradient id="${gid}"><stop offset="0" stop-color="${o.veinLight}" stop-opacity="0.4" /><stop offset="0.35" stop-color="${o.vein}" stop-opacity="0.25" /><stop offset="1" stop-color="${o.vein}" stop-opacity="0" /></radialGradient>`;
        // Sunk into the rock, lit from the top-left: the hole is dark, the rim's shadow falls across its top-left,
        // and only the floor towards the bottom-right catches the light, where the ore glows.
        const sx = s.r * 0.5 * T, sy = s.r * 0.6 * T;
        L.spots += `<clipPath id="${gid}c"><path d="${pd}" /></clipPath><radialGradient id="${gid}f" cx="62%" cy="64%" r="55%"><stop offset="0" stop-color="${o.veinLight}" /><stop offset="0.55" stop-color="${o.vein}" /><stop offset="1" stop-color="${o.veinDark}" /></radialGradient>`;
        L.spots += `<g clip-path="url(#${gid}c)"><path d="${pd}" fill="#0a1322" /><path d="${pd}" fill="${o.veinDark}" opacity="0.6" /><path d="${pd}" fill="url(#${gid}f)" transform="translate(${f(sx)} ${f(sy)})" /></g><path d="${pd}" fill="none" stroke="${o.dark}" stroke-width="1.4" stroke-linejoin="round" /><path d="${pd}" fill="none" stroke="${o.light}" stroke-width="1.2" stroke-linejoin="round" opacity="0.7" clip-path="url(#${gid}c)" transform="translate(-1 -1.2)" />`;
      }
      // A few dark hairline cracks, out in the plain rock.
      if ((h >>> 25) % 3 === 0 && glow(x + 0.5, y + 0.5) < 0.2) {
        const a = ((h >>> 4) % 628) / 100, hx = (x + 0.3 + ((h >>> 11) % 40) / 100) * T, hy = (y + 0.3 + ((h >>> 16) % 40) / 100) * T;
        L.hair += `<path d="M${f(hx)} ${f(hy)} l${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 8)} l${f(Math.cos(a + 0.6) * 6)} ${f(Math.sin(a + 0.6) * 6)}" stroke="${o.dark}" />`;
      }
    }
  return `<defs><clipPath id="${id}">${L.clip}</clipPath></defs><g>${L.bed}</g>
<g fill="#0a1322" opacity="0.35" transform="translate(3 5)">${L.shadow}</g>
<g fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round">${L.ink}</g>
<g>${L.rock}</g><g clip-path="url(#${id})"><g>${L.tone}</g>
<g fill="none" stroke-width="2.2" stroke-linecap="round" opacity="0.9">${L.bevel}</g>
<g fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${L.hair}</g>
<g fill="none" stroke-linecap="round">${L.halo}</g>
<g fill="none" stroke-linecap="round" stroke="${INK}">${L.cInk}</g><g fill="none" stroke-linecap="round">${L.cOre}</g><g fill="none" stroke-linecap="round">${L.cHi}</g>
<g>${L.spots.replace(/<radialGradient[\s\S]*?<\/radialGradient>/g, (m) => m)}</g></g><g>${L.single}</g>`;
}
