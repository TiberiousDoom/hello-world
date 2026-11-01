// Four more takes on worn spots and cracks in bedrock (I reinvented). All share the slab, the spots (one on
// some tiles, placed by the tile's hash) and the glow (how close a point is to a spot), so cracks and seams
// join from tile to tile; they differ in how the spots, cracks and glow are drawn.
import { hash, ORE } from './veins.mjs';
const T = 64;
const f = (n) => Math.round(n * 10) / 10;
const INK = '#0f1a2e';
let uid = 0;

function base(grid, st) {
  const H = grid.length, W = grid[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : 0);
  const inOre = (px, py, k) => at(Math.floor(px), Math.floor(py)) === k;
  const joined = (x, y, k) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => at(x + a, y + b) === k);
  const corner = (i, j, k, step = 0.5, off = 0) => {
    const px = (i + off) * step, py = (j + off) * step, e = 0.02;
    if (![[e, e], [-e, e], [e, -e], [-e, -e]].every(([a, b]) => inOre(px + a, py + b, k))) return [px, py];
    const h = hash(i, j, 61);
    return [px + ((h % 100) / 100 - 0.5) * 0.52 * step, py + (((h >>> 8) % 100) / 100 - 0.5) * 0.52 * step];
  };
  const spot = (x, y) => {
    const k = at(x, y);
    if (!k || !joined(x, y, k) || hash(x, y, 91) % 100 >= st.spots) return null;
    const h = hash(x, y, 93);
    // On a seam, the spot sits where the seam crosses its tile.
    const [sx, sy] = st.snap ? corner(x, y, k, 1, 0.5) : [x + 0.3 + (h % 40) / 100, y + 0.3 + ((h >>> 8) % 40) / 100];
    return { x: sx, y: sy, r: st.r + ((h >>> 16) % 5) / 100, h, a: ((h >>> 20) % 100) / 100 };
  };
  const spotsNear = (px, py) => {
    const out = [];
    for (let y = Math.floor(py) - 2; y <= Math.floor(py) + 2; y++) for (let x = Math.floor(px) - 2; x <= Math.floor(px) + 2; x++) { const s = spot(x, y); if (s) out.push(s); }
    return out;
  };
  const glow = (px, py) => {
    let best = 0;
    for (const s of spotsNear(px, py)) best = Math.max(best, 1 - Math.max(0, Math.hypot(px - s.x, py - s.y) - s.r) / st.reach);
    return Math.max(0, best);
  };
  const L = { bed: '', clip: '', shadow: '', ink: '', rock: '', tone: '', bevel: '', single: '', hair: '' };
  const tiles = [];
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
      tiles.push([x, y, k, o]);
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
      if ((h >>> 25) % 3 === 0 && glow(x + 0.5, y + 0.5) < 0.15) {
        const a = ((h >>> 4) % 628) / 100, hx = (x + 0.3 + ((h >>> 11) % 40) / 100) * T, hy = (y + 0.3 + ((h >>> 16) % 40) / 100) * T;
        L.hair += `<path d="M${f(hx)} ${f(hy)} l${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 8)} l${f(Math.cos(a + 0.6) * 6)} ${f(Math.sin(a + 0.6) * 6)}" stroke="${o.dark}" />`;
      }
    }
  /** Lattice cracks near spots, as tapered pieces: calls piece(P0, P1, g, o) for each. */
  const latticeCracks = (piece, opts = {}) => {
    const step = opts.step ?? 0.5, off = opts.off ?? 0, per = Math.round(1 / step);
    for (const [x, y, k, o] of tiles)
      for (let jj = -1; jj <= per; jj++)
        for (let ii = -1; ii <= per; ii++) {
          const ci = x * per + ii, cj = y * per + jj;
          for (const [di, dj] of [[1, 0], [0, 1]]) {
            const mx = (ci + di / 2 + off) * step, my = (cj + dj / 2 + off) * step;
            if (Math.floor(mx) !== x || Math.floor(my) !== y) continue;
            if (!inOre((ci + off) * step, (cj + off) * step, k) || !inOre((ci + di + off) * step, (cj + dj + off) * step, k)) continue;
            const pk = di ? opts.along ?? st.keep : opts.across ?? st.keep;
            if (glow(mx, my) <= st.fade || hash(ci, cj, 95 + di) % 100 >= pk) continue;
            const A = corner(ci, cj, k, step, off), B = corner(ci + di, cj + dj, k, step, off);
            for (let q = 0; q < 4; q++) {
              const P0 = [A[0] + (B[0] - A[0]) * q / 4, A[1] + (B[1] - A[1]) * q / 4], P1 = [A[0] + (B[0] - A[0]) * (q + 1) / 4, A[1] + (B[1] - A[1]) * (q + 1) / 4];
              const g = glow((P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2);
              if (g > st.fade) piece(P0, P1, g, o);
            }
          }
        }
  };
  const allSpots = () => tiles.map(([x, y, k, o]) => [spot(x, y), k, o]).filter(([s]) => s);
  const wrap = (id, inner, extraDefs = '') => `<defs><clipPath id="${id}">${L.clip}</clipPath><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter><filter id="${id}b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>${extraDefs}</defs><g>${L.bed}</g>
<g fill="#0a1322" opacity="0.35" transform="translate(3 5)">${L.shadow}</g>
<g fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round">${L.ink}</g>
<g>${L.rock}</g><g clip-path="url(#${id})"><g>${L.tone}</g>
<g fill="none" stroke-width="2.2" stroke-linecap="round" opacity="0.9">${L.bevel}</g>
<g fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${L.hair}</g>${inner}</g><g>${L.single}</g>`;
  return { at, spot, glow, latticeCracks, allSpots, wrap, tiles };
}
const seg = (P0, P1) => `M${f(P0[0] * T)} ${f(P0[1] * T)} L${f(P1[0] * T)} ${f(P1[1] * T)}`;
const blob = (s, n, jag, sx = 1, sy = 0.85, rot = 0) => {
  const pts = [];
  for (let q = 0; q < n; q++) {
    const a = (q / n) * Math.PI * 2;
    const rq = s.r * (q % 2 && jag ? 1 - jag : 1) * (0.85 + ((s.h >>> (q * 3)) % 6) / 20);
    const ux = Math.cos(a) * rq * sx, uy = Math.sin(a) * rq * sy;
    pts.push(`${f((s.x + ux * Math.cos(rot) - uy * Math.sin(rot)) * T)} ${f((s.y + ux * Math.sin(rot) + uy * Math.cos(rot)) * T)}`);
  }
  return `M${pts.join(' L')} Z`;
};
/** A sunken opening: dark, shadowed on the top-left, its floor lit and glowing towards the bottom-right. */
function sunk(id, s, d, o, deep = 0.55) {
  const gid = `${id}s${Math.round(s.x * 100)}_${Math.round(s.y * 100)}`;
  return `<clipPath id="${gid}c"><path d="${d}" /></clipPath><radialGradient id="${gid}f" cx="60%" cy="62%" r="60%"><stop offset="0" stop-color="${o.veinLight}" /><stop offset="0.55" stop-color="${o.vein}" /><stop offset="1" stop-color="${o.veinDark}" /></radialGradient><g clip-path="url(#${gid}c)"><path d="${d}" fill="#0a1322" /><path d="${d}" fill="url(#${gid}f)" transform="translate(${f(s.r * deep * T)} ${f(s.r * deep * 1.2 * T)})" /></g><path d="${d}" fill="none" stroke="${o.dark}" stroke-width="1.3" stroke-linejoin="round" />`;
}

/** J · Glowing fissures: dark slits with a bright core of ore deep in them, a jagged break at each spot, and a soft glow bleeding onto the rock. */
export function fissures(grid, st) {
  const B = base(grid, st), id = `j${uid++}`;
  let soft = '', slit = '', core = '', spots = '';
  B.latticeCracks((P0, P1, g, o) => {
    const d = seg(P0, P1), w = 0.6 + 3.2 * g * g;
    soft += `<path d="${d}" stroke="${o.vein}" stroke-width="${f(w + 9 * g)}" opacity="${f(0.75 * g * 100) / 100}" />`;
    slit += `<path d="${d}" stroke="#0a1322" stroke-width="${f(w + 1.2)}" />`;
    core += `<path d="${d}" stroke="${g > 0.55 ? o.veinLight : o.vein}" stroke-width="${f(Math.max(0.6, w * 0.6))}" opacity="${f((0.35 + 0.65 * g) * 100) / 100}" />`;
  });
  for (const [s, k, o] of B.allSpots()) {
    const d = blob(s, 14, 0.16);
    soft += `<circle cx="${f(s.x * T)}" cy="${f(s.y * T)}" r="${f(s.r * T * 2.2)}" fill="${o.vein}" opacity="0.5" />`;
    spots += sunk(id, s, d, o, 0.22);
  }
  return B.wrap(id, `<g fill="none" stroke-linecap="round" filter="url(#${id}b)">${soft}</g><g fill="none" stroke-linecap="round">${slit}</g><g fill="none" stroke-linecap="round">${core}</g>${spots}`);
}

/** K · Struck: a small pit as if the rock were struck there, chips of rock thrown round it, and fractures running straight out. */
export function struck(grid, st) {
  const B = base(grid, st), id = `k${uid++}`;
  let glowL = '', ink = '', ore = '', hi = '', chips = '', spots = '';
  for (const [s, k, o] of B.allSpots()) {
    glowL += `<circle cx="${f(s.x * T)}" cy="${f(s.y * T)}" r="${f(s.r * T * 2)}" fill="${o.vein}" opacity="0.45" />`;
    const n = 5 + (s.h % 3);
    for (let q = 0; q < n; q++) {
      const hq = hash(Math.round(s.x * 100), Math.round(s.y * 100), 200 + q);
      let a = (q / n) * Math.PI * 2 + (hq % 60) / 100, len = 0.45 + (hq >>> 8) % 60 / 100;
      let px = s.x, py = s.y;
      const parts = 5;
      for (let p = 0; p < parts; p++) {
        a += (((hq >>> (p * 4)) % 9) - 4) / 20;
        const nx = px + Math.cos(a) * len / parts, ny = py + Math.sin(a) * len / parts;
        const g = 1 - (p + 0.5) / parts;
        const w = 0.5 + 3.6 * g * g, d = seg([px, py], [nx, ny]);
        glowL += `<path d="${d}" stroke="${o.vein}" stroke-width="${f(w + 6 * g)}" opacity="${f(0.45 * g * 100) / 100}" fill="none" stroke-linecap="round" />`;
        ink += `<path d="${d}" stroke-width="${f(w + 0.6 + g)}" />`;
        ore += `<path d="${d}" stroke="${g > 0.4 ? o.vein : o.veinDark}" stroke-width="${f(w)}" />`;
        if (g > 0.6) hi += `<path d="${d}" stroke="${o.veinLight}" stroke-width="${f(w * 0.35)}" />`;
        px = nx; py = ny;
      }
    }
    // Chips of rock thrown out round the pit.
    for (let q = 0; q < 6; q++) {
      const hq = hash(Math.round(s.x * 100), Math.round(s.y * 100), 300 + q);
      const a = (hq % 628) / 100, rr = s.r * (1.5 + (hq >>> 9) % 10 / 10);
      const cx = (s.x + Math.cos(a) * rr) * T, cy = (s.y + Math.sin(a) * rr) * T, cs = 1.6 + (hq >>> 13) % 3 * 0.6;
      chips += `<path d="M${f(cx - cs)} ${f(cy)} L${f(cx)} ${f(cy - cs)} L${f(cx + cs * 1.2)} ${f(cy + cs * 0.3)} L${f(cx)} ${f(cy + cs)} Z" fill="${o.light}" stroke="${INK}" stroke-width="0.8" />`;
    }
    spots += sunk(id, s, blob(s, 9, 0.12), o);
  }
  return B.wrap(id, `<g filter="url(#${id}b)">${glowL}</g><g fill="none" stroke-linecap="round" stroke="${INK}">${ink}</g><g fill="none" stroke-linecap="round">${ore}</g><g fill="none" stroke-linecap="round">${hi}</g>${spots}<g>${chips}</g>`);
}

/** L · Seam pools: seams of ore running mostly one way, widening into sunken lens-shaped pools at the worn spots. */
export function pools(grid, st) {
  const B = base(grid, st), id = `l${uid++}`;
  let glowL = '', ink = '', ore = '', hi = '', spots = '';
  B.latticeCracks((P0, P1, g, o) => {
    const d = seg(P0, P1), w = 0.5 + 5 * g * g;
    glowL += `<path d="${d}" stroke="${o.vein}" stroke-width="${f(w + 7 * g)}" opacity="${f(0.4 * g * 100) / 100}" />`;
    ink += `<path d="${d}" stroke-width="${f(w + 0.6 + g)}" />`;
    ore += `<path d="${d}" stroke="${g > 0.4 ? o.vein : o.veinDark}" stroke-width="${f(w)}" />`;
    if (g > 0.6) hi += `<path d="${d}" stroke="${o.veinLight}" stroke-width="${f(w * 0.35)}" />`;
  }, { step: 1, off: 0.5, along: 90, across: 18 });
  for (const [s, k, o] of B.allSpots()) {
    glowL += `<ellipse cx="${f(s.x * T)}" cy="${f(s.y * T)}" rx="${f(s.r * T * 2.6)}" ry="${f(s.r * T * 1.4)}" fill="${o.vein}" opacity="0.45" />`;
    spots += sunk(id, s, blob(s, 12, 0, 1.9, 0.75, (s.a - 0.5) * 0.5), o, 0.2);
  }
  return B.wrap(id, `<g fill="none" stroke-linecap="round" filter="url(#${id}b)">${glowL}</g><g fill="none" stroke-linecap="round" stroke="${INK}">${ink}</g><g fill="none" stroke-linecap="round">${ore}</g><g fill="none" stroke-linecap="round">${hi}</g>${spots}`);
}

/** M · Under the surface: no holes. The ore glows through the rock in soft patches, fine glowing cracks spreading from them. */
export function underneath(grid, st) {
  const B = base(grid, st), id = `m${uid++}`;
  let deep = '', ink = '', ore = '', patches = '';
  B.latticeCracks((P0, P1, g, o) => {
    const d = seg(P0, P1), w = 0.4 + 2.2 * g;
    deep += `<path d="${d}" stroke="${o.vein}" stroke-width="${f(w + 10 * g)}" opacity="${f(0.5 * g * 100) / 100}" />`;
    ink += `<path d="${d}" stroke-width="${f(w + 0.8)}" opacity="${f((0.4 + 0.4 * g) * 100) / 100}" />`;
    ore += `<path d="${d}" stroke="${g > 0.5 ? o.veinLight : o.vein}" stroke-width="${f(w)}" opacity="${f((0.5 + 0.5 * g) * 100) / 100}" />`;
  });
  for (const [s, k, o] of B.allSpots()) {
    const gid = `${id}p${Math.round(s.x * 100)}_${Math.round(s.y * 100)}`;
    patches += `<radialGradient id="${gid}"><stop offset="0" stop-color="${o.veinLight}" stop-opacity="0.95" /><stop offset="0.3" stop-color="${o.vein}" stop-opacity="0.75" /><stop offset="1" stop-color="${o.vein}" stop-opacity="0" /></radialGradient><ellipse cx="${f(s.x * T)}" cy="${f(s.y * T)}" rx="${f(s.r * T * 2.4)}" ry="${f(s.r * T * 2)}" fill="url(#${gid})" />`;
    // The rock over it is thin: a faint lighter skin with a few specks.
    patches += `<path d="${blob(s, 9, 0.1, 1.3, 1.1)}" fill="${o.light}" opacity="0.18" />`;
  }
  return B.wrap(id, `<g fill="none" stroke-linecap="round" filter="url(#${id}b)">${deep}</g>${patches}<g fill="none" stroke-linecap="round" stroke="${INK}">${ink}</g><g fill="none" stroke-linecap="round">${ore}</g>`);
}
