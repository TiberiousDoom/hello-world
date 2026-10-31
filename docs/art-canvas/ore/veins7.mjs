// Above-ground ore formations: crystal outcrops, a tor of boulders, terraces and basalt columns. Each is laid
// out from where things are in the world (a hash of position, a shared lattice), so a patch of any shape
// gets one formation, carrying on from tile to tile. Light from the top-left, shadows to the bottom-right.
import { hash, ORE } from './veins.mjs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';

function common(grid) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  const joined = (x, y, k) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => at(x + a, y + b) === k);
  let bed = '', single = '';
  const tiles = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (!k) continue;
      const o = ORE[k];
      const n = at(x, y - 1) === k, e = at(x + 1, y) === k, so = at(x, y + 1) === k, w = at(x - 1, y) === k;
      const bm = 0.1;
      const [bl, br, bt, bb] = [w ? 0 : bm, e ? 0 : bm, n ? 0 : bm, so ? 0 : bm];
      bed += `<rect x="${f((x + bl) * T)}" y="${f((y + bt) * T)}" width="${f((1 - bl - br) * T)}" height="${f((1 - bt - bb) * T)}" rx="${f((Math.min(bl, br, bt, bb) ? 0.25 : 0.12) * T)}" fill="${o.bed}" />`;
      if (!joined(x, y, k)) single += `<use href="#nd${k}" x="${f((x + 0.07) * T)}" y="${f((y + 0.07) * T)}" transform="rotate(${((x * 7 + y * 13) % 4) * 90} ${(x + 0.5) * T} ${(y + 0.5) * T})" />`;
      else tiles.push([x, y, k, o]);
    }
  return { at, tiles, bed, single, H, W };
}
const poly = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;

/** N · Crystal outcrops: clusters of ore crystals pushing up out of low rock. */
export function crystals(grid) {
  const C = common(grid);
  // A low mound of rock under the whole patch, one shape (stroked, then filled).
  let moundInk = '', mound = '', moundHi = '';
  for (const [x, y, k, o] of C.tiles) {
    const same = (dx, dy) => C.at(x + dx, y + dy) === k;
    const n = same(0, -1), e = same(1, 0), so = same(0, 1), w = same(-1, 0);
    const m = 0.14;
    const [l, r, t, b] = [w ? 0 : m, e ? 0 : m, n ? 0 : m, so ? 0 : m];
    // Rounded only at corners open on both sides, so tiles join without notches.
    const X0 = (x + l) * T, X1 = (x + 1 - r) * T, Y0 = (y + t) * T, Y1 = (y + 1 - b) * T, rr = 0.2 * T;
    const c = { tl: !n && !w, tr: !n && !e, br: !so && !e, bl: !so && !w };
    const d = `M${f(X0 + (c.tl ? rr : 0))} ${f(Y0)} H${f(X1 - (c.tr ? rr : 0))} ${c.tr ? `Q${f(X1)} ${f(Y0)} ${f(X1)} ${f(Y0 + rr)}` : ''} V${f(Y1 - (c.br ? rr : 0))} ${c.br ? `Q${f(X1)} ${f(Y1)} ${f(X1 - rr)} ${f(Y1)}` : ''} H${f(X0 + (c.bl ? rr : 0))} ${c.bl ? `Q${f(X0)} ${f(Y1)} ${f(X0)} ${f(Y1 - rr)}` : ''} V${f(Y0 + (c.tl ? rr : 0))} ${c.tl ? `Q${f(X0)} ${f(Y0)} ${f(X0 + rr)} ${f(Y0)}` : ''} Z`;
    const rect = `<path d="${d}"`;
    moundInk += `${rect} />`;
    mound += `${rect} fill="${o.rock}" />`;
    if (!n) moundHi += `<path d="M${f((x + l + 0.12) * T)} ${f((y + t + 0.06) * T)} H${f((x + 1 - r - (e ? 0 : 0.12)) * T)}" stroke="${o.light}" />`;
  }
  const items = [];
  for (const [x, y, k, o] of C.tiles) {
    // One or two clusters per tile, crystals standing up and leaning out a little.
    const nc = 1 + (hash(x, y, 100) % 2);
    for (let c = 0; c < nc; c++) {
      const h = hash(x, y, 101 + c);
      const cx = x + 0.25 + (h % 50) / 100, cy = y + 0.45 + ((h >>> 8) % 40) / 100;
      const n = 3 + (h % 3);
      for (let q = 0; q < n; q++) {
        const hq = hash(x * 3 + c, y, 120 + q);
        const a = -Math.PI / 2 + ((q / (n - 1 || 1)) - 0.5) * 1.3 + ((hq % 20) - 10) / 50;
        const len = (0.3 + (hq >>> 8) % 25 / 100) * T * (q === Math.floor(n / 2) ? 1.25 : 1);
        const wid = (0.075 + (hq >>> 14) % 4 / 100) * T;
        items.push({ y: cy + q * 0.001, k, o, cx: (cx + (q - n / 2) * 0.05) * T, cy: cy * T, a, len, wid });
      }
    }
  }
  items.sort((p, q) => p.y - q.y);
  let shards = '', shadows = '';
  for (const s of items) {
    const ux = Math.cos(s.a), uy = Math.sin(s.a), vx = -uy, vy = ux;
    const P = (t, side) => [s.cx + ux * s.len * t + vx * s.wid * side, s.cy + uy * s.len * t + vy * s.wid * side];
    const L0 = P(0, -1), R0 = P(0, 1), L1 = P(0.78, -1), R1 = P(0.78, 1), tip = P(1, 0), M0 = P(0, 0), M1 = P(0.78, 0);
    // The shadow falls behind and to the right, along the ground.
    shadows += `<path d="${poly([L0, R0, [R0[0] + s.len * 0.5, R0[1] + 2], [L0[0] + s.len * 0.45, L0[1] + 4]])}" fill="#0a1322" opacity="0.3" />`;
    shards += `<path d="${poly([L0, L1, tip, R1, R0])}" fill="${s.o.vein}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" />`;
    // Left face lit, right face shaded, a bright edge down the middle.
    shards += `<path d="${poly([L0, L1, tip, M1, M0])}" fill="${s.o.veinLight}" opacity="0.75" />`;
    shards += `<path d="${poly([R0, R1, tip, M1, M0])}" fill="${s.o.veinDark}" opacity="0.45" />`;
    shards += `<path d="M${f(M0[0])} ${f(M0[1])} L${f(M1[0])} ${f(M1[1])} L${f(tip[0])} ${f(tip[1])}" stroke="#ffffff" stroke-width="0.9" fill="none" opacity="0.7" />`;
  }
  return `<g>${C.bed}</g><g fill="#0a1322" opacity="0.35" transform="translate(3 5)">${moundInk}</g><g fill="none" stroke="${INK}" stroke-width="4">${moundInk}</g><g>${mound}</g><g fill="none" stroke-width="2.2" stroke-linecap="round" opacity="0.8">${moundHi}</g><g>${shadows}</g><g>${shards}</g><g>${C.single}</g>`;
}

/** O · Boulder tor: a heap of big boulders, with seams of ore that line up from one boulder to the next. */
export function tor(grid, uidp = 't') {
  const C = common(grid);
  const items = [];
  for (const [x, y, k, o] of C.tiles)
    for (let q = 0; q < 2; q++) {
      const h = hash(x, y, 130 + q);
      const r = (0.36 + (h % 12) / 100) * T;
      items.push({ cx: (x + 0.25 + ((h >>> 6) % 50) / 100) * T, cy: (y + 0.25 + ((h >>> 12) % 50) / 100) * T, rx: r, ry: r * (0.82 + ((h >>> 18) % 10) / 100), k, o, h });
    }
  items.sort((p, q) => p.cy - q.cy);
  let s = '', defs = '';
  items.forEach((b, i) => {
    const id = `${uidp}${i}_${Math.round(b.cx)}_${Math.round(b.cy)}`;
    const pts = [];
    for (let q = 0; q < 9; q++) {
      const a = (q / 9) * Math.PI * 2;
      const rr = 0.9 + ((b.h >>> (q * 3)) % 5) / 25;
      pts.push([b.cx + Math.cos(a) * b.rx * rr, b.cy + Math.sin(a) * b.ry * rr]);
    }
    // A rounded outline through the points.
    let d = '';
    for (let q = 0; q < 9; q++) {
      const p = pts[q], nx = pts[(q + 1) % 9];
      const m = [(p[0] + nx[0]) / 2, (p[1] + nx[1]) / 2];
      d += q === 0 ? `M${f((pts[8][0] + p[0]) / 2)} ${f((pts[8][1] + p[1]) / 2)} ` : '';
      d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])} `;
    }
    d += 'Z';
    defs += `<clipPath id="${id}"><path d="${d}" /></clipPath>`;
    s += `<path d="${d}" fill="#0a1322" opacity="0.35" transform="translate(4 6)" />`;
    s += `<path d="${d}" fill="${b.o.rock}" stroke="${INK}" stroke-width="2.2" />`;
    // The seams: lines of one slope across the whole patch, so they carry on from boulder to boulder.
    let seams = '';
    const spacing = 0.55 * T, slope = -0.35;
    const c0 = Math.floor((b.cy - slope * b.cx - b.ry * 2) / spacing), c1 = Math.ceil((b.cy - slope * b.cx + b.ry * 2) / spacing);
    for (let c = c0; c <= c1; c++) {
      if (hash(c, b.k, 141) % 3 === 0) continue; // not every line is a seam
      const yA = slope * (b.cx - b.rx * 1.3) + c * spacing, yB = slope * (b.cx + b.rx * 1.3) + c * spacing;
      const ln = `M${f(b.cx - b.rx * 1.3)} ${f(yA)} L${f(b.cx + b.rx * 1.3)} ${f(yB)}`;
      seams += `<path d="${ln}" stroke="${INK}" stroke-width="5.2" /><path d="${ln}" stroke="${b.o.veinDark}" stroke-width="4" /><path d="${ln}" stroke="${b.o.vein}" stroke-width="2.6" /><path d="${ln}" stroke="${b.o.veinLight}" stroke-width="0.9" transform="translate(0 -0.8)" />`;
    }
    s += `<g clip-path="url(#${id})" fill="none"><path d="${d}" fill="${b.o.dark}" opacity="0.5" transform="translate(${f(b.rx * 0.35)} ${f(b.ry * 0.4)})" /><path d="${d}" fill="${b.o.rock}" transform="translate(${f(b.rx * 0.1)} ${f(b.ry * 0.12)}) scale(1)" opacity="0" />${seams}<path d="${d}" fill="none" stroke="${b.o.light}" stroke-width="3" opacity="0.8" transform="translate(${f(b.rx * 0.12)} ${f(b.ry * 0.15)})" /></g>`;
    s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.2" />`;
  });
  return `<defs>${defs}</defs><g>${C.bed}</g>${s}<g>${C.single}</g>`;
}

/** P · Terraces: the patch rises in steps, a band of ore showing in each cliff face. */
export function terraces(grid) {
  const C = common(grid);
  const level = (x, y, k) => {
    if (C.at(x, y) !== k) return 0;
    let l = 1;
    for (let r = 1; r <= 2; r++) {
      let all = true;
      for (let j = -r; j <= r && all; j++) for (let i = -r; i <= r && all; i++) if (C.at(x + i, y + j) !== k) all = false;
      if (all) l = r + 1;
    }
    return l;
  };
  const cliff = 0.2 * T;
  let out = '';
  for (let lv = 1; lv <= 3; lv++) {
    let side = '', sideFill = '', band = '', bandHi = '', topInk = '', top = '', bevel = '', specks = '';
    for (const [x, y, k, o] of C.tiles) {
      if (level(x, y, k) < lv) continue;
      const same = (dx, dy) => level(x + dx, y + dy, k) >= lv;
      const n = same(0, -1), e = same(1, 0), so = same(0, 1), w = same(-1, 0);
      const m = lv === 1 ? 0.1 : 0.22;
      const [l, r, t, b] = [w ? 0 : m, e ? 0 : m, n ? 0 : m, so ? 0 : m];
      const lift = (lv - 1) * cliff;
      const X0 = (x + l) * T, X1 = (x + 1 - r) * T, Y0 = (y + t) * T - lift, Y1 = (y + 1 - b) * T - lift, rr = 0.16 * T;
      const c = { tl: !n && !w, tr: !n && !e, br: !so && !e, bl: !so && !w };
      const d = `M${f(X0 + (c.tl ? rr : 0))} ${f(Y0)} H${f(X1 - (c.tr ? rr : 0))} ${c.tr ? `Q${f(X1)} ${f(Y0)} ${f(X1)} ${f(Y0 + rr)}` : ''} V${f(Y1 - (c.br ? rr : 0))} ${c.br ? `Q${f(X1)} ${f(Y1)} ${f(X1 - rr)} ${f(Y1)}` : ''} H${f(X0 + (c.bl ? rr : 0))} ${c.bl ? `Q${f(X0)} ${f(Y1)} ${f(X0)} ${f(Y1 - rr)}` : ''} V${f(Y0 + (c.tl ? rr : 0))} ${c.tl ? `Q${f(X0)} ${f(Y0)} ${f(X0 + rr)} ${f(Y0)}` : ''} Z`;
      // The cliff below the top, seen on the near (south) side: rock, with a band of ore through it.
      side += `<path d="${d}" transform="translate(0 ${f(cliff)})" />`;
      sideFill += `<path d="${d}" transform="translate(0 ${f(cliff)})" fill="${o.dark}" />`;
      band += `<path d="${d}" transform="translate(0 ${f(cliff * 0.5)})" fill="${o.vein}" />`;
      bandHi += `<path d="${d}" transform="translate(0 ${f(cliff * 0.5 - 1.2)})" fill="${o.veinLight}" />`;
      topInk += `<path d="${d}" />`;
      top += `<path d="${d}" fill="${lv === 2 ? o.light : o.rock}" />`;
      const i = 0.05 * T;
      if (!n) bevel += `<path d="M${f(X0 + (c.tl ? rr : i))} ${f(Y0 + i)} H${f(X1 - (c.tr ? rr : 0))}" stroke="${lv === 2 ? '#ffffff' : o.light}" opacity="0.6" />`;
      const h = hash(x, y, 150 + lv);
      if (h % 3 === 0) specks += `<path d="M${f((x + 0.35 + (h >>> 4) % 30 / 100) * T)} ${f((y + 0.4 + (h >>> 9) % 30 / 100) * T - lift)} l3 -3 l3 3 l-3 2 z" fill="${o.veinLight}" stroke="${INK}" stroke-width="0.7" />`;
    }
    // Each level as one shape: every tile's outline is stroked, then every tile filled, so only the level's own edge stays inked.
    out += `<g fill="#0a1322" opacity="0.3" transform="translate(3 4)">${side}</g><g fill="none" stroke="${INK}" stroke-width="4">${side}</g><g>${sideFill}</g><g>${bandHi}</g><g>${band}</g><g fill="none" stroke="${INK}" stroke-width="4">${topInk}</g><g>${top}</g><g fill="none" stroke-width="2" stroke-linecap="round">${bevel}</g><g>${specks}</g>`;
  }
  // Seams between a tile's top and its neighbour's are inked; cover them by redrawing tops without ink happens per level above.
  return `<g>${C.bed}</g><g fill="#0a1322" opacity="0.3">${''}</g>${out}<g>${C.single}</g>`;
}

/** Q · Columns: a cluster of hexagonal rock columns of different heights, some of them ore. */
export function columns(grid) {
  const C = common(grid);
  const R = 0.27; // hexagon radius, in tiles
  const dx = Math.sqrt(3) * R, dy = 1.5 * R;
  const hexes = [];
  const W = C.W, H = C.H;
  for (let j = -1; j < H / dy + 1; j++)
    for (let i = -1; i < W / dx + 1; i++) {
      const cx = (i + (j & 1) * 0.5) * dx, cy = j * dy;
      const tx = Math.floor(cx), ty = Math.floor(cy);
      const k = C.at(tx, ty);
      if (!k || !C.tiles.some(([x, y]) => x === tx && y === ty)) continue;
      const h = hash(i, j, 160);
      hexes.push({ cx, cy, k, o: ORE[k], ht: 1 + (h % 4), ore: h % 100 < 22 });
    }
  hexes.sort((a, b) => a.ht - b.ht || a.cy - b.cy);
  let s = '';
  for (const hx of hexes) {
    const lift = hx.ht * 3;
    const pts = [];
    for (let q = 0; q < 6; q++) {
      const a = Math.PI / 6 + (q * Math.PI) / 3;
      pts.push([(hx.cx + Math.cos(a) * R * 0.97) * T, (hx.cy + Math.sin(a) * R * 0.97) * T - lift]);
    }
    s += `<path d="${poly(pts.map(([x, y]) => [x + lift * 0.8, y + lift * 1.6]))}" fill="#0a1322" opacity="0.3" />`;
    // The column's side, seen below its top.
    s += `<path d="${poly([pts[0], pts[1], pts[2], [pts[2][0], pts[2][1] + lift], [pts[1][0], pts[1][1] + lift], [pts[0][0], pts[0][1] + lift]])}" fill="${hx.ore ? hx.o.veinDark : hx.o.dark}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" />`;
    const topFill = hx.ore ? hx.o.vein : [hx.o.rock, hx.o.light, hx.o.rock, hx.o.dark][hx.ht - 1] ?? hx.o.rock;
    s += `<path d="${poly(pts)}" fill="${topFill}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" />`;
    if (hx.ore) s += `<path d="${poly([pts[3], pts[4], pts[5], [(hx.cx) * T, (hx.cy) * T - lift]])}" fill="${hx.o.veinLight}" opacity="0.7" />`;
    else s += `<path d="M${f(pts[3][0] + 1)} ${f(pts[3][1])} L${f(pts[4][0])} ${f(pts[4][1] + 1.2)} L${f(pts[5][0] - 1)} ${f(pts[5][1])}" stroke="${hx.o.light}" stroke-width="1.4" fill="none" opacity="0.8" stroke-linecap="round" />`;
  }
  return `<g>${C.bed}</g>${s}<g>${C.single}</g>`;
}
