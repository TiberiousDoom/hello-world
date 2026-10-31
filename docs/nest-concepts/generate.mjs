/* global console */
// Nest concept art: three directions in which a nest's art changes as it grows, not only its size.
// Run `node docs/nest-concepts/generate.mjs`; it writes one SVG per direction, kind and stage into
// docs/nest-concepts/svg/. Concepts only: the game doesn't load these.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'svg');
const INK = '#24180e';

/** A small seeded RNG, so the concepts redraw the same each run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

/** A smooth, lumpy closed shape (Catmull-Rom through jittered points round an ellipse). */
function blob(cx, cy, rx, ry, jit, n, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const k = 1 + (r() * 2 - 1) * jit;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

/** A wandering open line from (x,y) heading at angle a, for veins, tunnels and cracks. */
function wander(x, y, a, len, steps, wob, r) {
  let d = `M${f(x)} ${f(y)}`;
  const seg = len / steps;
  for (let i = 0; i < steps; i++) {
    a += (r() * 2 - 1) * wob;
    const nx = x + Math.cos(a) * seg,
      ny = y + Math.sin(a) * seg;
    d += ` Q${f(x + Math.cos(a) * seg * 0.5 + (r() - 0.5) * 3)} ${f(y + Math.sin(a) * seg * 0.5 + (r() - 0.5) * 3)} ${f(nx)} ${f(ny)}`;
    x = nx;
    y = ny;
  }
  return { d, end: [x, y] };
}

// Each kind's colours, from its bugs' sprites: crawler orange, runner/wasp navy and yellow, brute/beetle crimson and blue.
const KINDS = {
  warren: { soil: ['#8a6a44', '#5e4630', '#3e2c1c'], accent: '#c8682c', accent2: '#e08a3c', dark: '#5a2c10' },
  hive: { soil: ['#7a6c5a', '#4e4436', '#2e281f'], accent: '#f2c14e', accent2: '#ffe08a', dark: '#1c2236' },
  den: { soil: ['#7c6450', '#55402e', '#33241a'], accent: '#8a1c24', accent2: '#c0343c', dark: '#3a0c10' },
  queen: { soil: ['#8a6a44', '#5a3e2a', '#36231a'], accent: '#e0a030', accent2: '#ffd36a', dark: '#4a1a40' },
};

/** Gradients and filters every concept shares; ids carry a prefix so many SVGs can sit inline on one page. */
function defs(p, k) {
  const [s0, s1, s2] = KINDS[k].soil;
  const { accent, accent2, dark } = KINDS[k];
  return `<defs>
<filter id="${p}blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
<radialGradient id="${p}mound" cx="36%" cy="32%" r="70%"><stop offset="0" stop-color="${s0}"/><stop offset="0.55" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></radialGradient>
<radialGradient id="${p}pit" cx="44%" cy="44%" r="58%"><stop offset="0" stop-color="#040302"/><stop offset="0.45" stop-color="#120c07"/><stop offset="0.8" stop-color="#33251a"/><stop offset="1" stop-color="#4e3a26"/></radialGradient>
<radialGradient id="${p}glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${accent2}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}pod" cx="34%" cy="28%" r="72%"><stop offset="0" stop-color="${accent2}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
<radialGradient id="${p}shell" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="${k === 'hive' ? '#4a4e66' : k === 'den' ? '#b03a40' : k === 'queen' ? '#8a4a7a' : '#d07a3a'}"/><stop offset="0.55" stop-color="${k === 'hive' ? '#252a3c' : k === 'den' ? '#6a1820' : k === 'queen' ? '#4a1a40' : '#8a4418'}"/><stop offset="1" stop-color="${k === 'hive' ? '#10121c' : k === 'den' ? '#2a080c' : k === 'queen' ? '#1e0a1a' : '#3a1a08'}"/></radialGradient>
<radialGradient id="${p}egg" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff6e0"/><stop offset="0.6" stop-color="#e8d2a8"/><stop offset="1" stop-color="#b09670"/></radialGradient>
<linearGradient id="${p}cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s0}"/><stop offset="0.45" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>
<linearGradient id="${p}paper" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c8c0b0"/><stop offset="0.45" stop-color="#948a7a"/><stop offset="1" stop-color="#5a5248"/></linearGradient>
<linearGradient id="${p}stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8a49a"/><stop offset="0.5" stop-color="#76726a"/><stop offset="1" stop-color="#46423c"/></linearGradient>
</defs>`;
}

const svg = (p, k, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${defs(p, k)}${body}</svg>`;

/** A burrow entrance: a raised rim, a dark pit and a lit lip, like today's nests. */
function hole(p, cx, cy, r, rr, rim = true) {
  let s = '';
  if (rim) {
    s += `<path d="${blob(cx + 1.5, cy + 2, r * 1.45, r * 1.38, 0.08, 8, rr)}" fill="#000" opacity="0.35" filter="url(#${p}soft)"/>`;
    s += `<path d="${blob(cx, cy, r * 1.45, r * 1.38, 0.08, 8, rr)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<path d="M${f(cx - r * 1.25)} ${f(cy - r * 0.2)} A${f(r * 1.3)} ${f(r * 1.25)} 0 0 1 ${f(cx + r * 0.2)} ${f(cy - r * 1.25)}" fill="none" stroke="#b09068" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`;
  }
  s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * 0.94)}" fill="url(#${p}pit)" stroke="#1a120b" stroke-width="1.2"/>`;
  s += `<ellipse cx="${f(cx - r * 0.12)}" cy="${f(cy - r * 0.12)}" rx="${f(r * 0.62)}" ry="${f(r * 0.56)}" fill="#040302"/>`;
  return s;
}

/** A clutch of pale eggs. */
function eggs(p, cx, cy, n, size, r) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2,
      d = r() * size * 1.2;
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d * 0.8;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size * 0.55)}" ry="${f(size * 0.4)}" transform="rotate(${f(r() * 60 - 30)} ${f(x)} ${f(y)})" fill="url(#${p}egg)" stroke="${INK}" stroke-width="0.8"/>`;
  }
  return s;
}

/** Spoil: loose clods of dug-out soil. */
function clods(p, cx, cy, spread, n, r, color = '#6a5034') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2,
      d = spread * (0.6 + r() * 0.4);
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d;
    s += `<path d="${blob(x, y, 2 + r() * 2.5, 1.6 + r() * 2, 0.25, 5, r)}" fill="${color}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  return s;
}

/** A raised tunnel ridge between two points: a soil bulge with a lit crest. */
function ridge(p, x1, y1, x2, y2, w, r) {
  const mx = (x1 + x2) / 2 + (r() - 0.5) * 14,
    my = (y1 + y2) / 2 + (r() - 0.5) * 14;
  const d = `M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
  return (
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="${w + 3}" stroke-linecap="round" transform="translate(1.5 2)" filter="url(#${p}soft)"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#5e4630" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#9a7a52" stroke-width="${w * 0.35}" stroke-linecap="round" transform="translate(-0.8 -1)" opacity="0.8"/>`
  );
}

/** Factory scrap the bugs dragged home: little orange and steel shards. */
function scrap(cx, cy, spread, n, r) {
  let s = '';
  const cols = ['#b4531a', '#c8682c', '#8a9aa8'];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2,
      d = spread * (0.7 + r() * 0.3);
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d;
    s += `<path d="M${f(x)} ${f(y)} l${f(4 + r() * 2)} ${f(-1 - r() * 2)} l${f(1 + r())} ${f(3 + r())} l${f(-5)} ${f(1.5)} z" fill="${cols[i % 3]}" stroke="#0f1a2e" stroke-width="0.8" stroke-linejoin="round"/>`;
  }
  return s;
}

/** Paper comb collar: a ring of grey hexagon cells round a hole (wasp hives). */
function comb(p, cx, cy, r, rings, rr) {
  let s = '';
  const h = 4.2;
  for (let q = -rings * 2; q <= rings * 2; q++)
    for (let w = -rings * 2; w <= rings * 2; w++) {
      const x = cx + h * 1.5 * q,
        y = cy + h * Math.sqrt(3) * (w + q / 2);
      const d = Math.hypot(x - cx, y - cy);
      if (d < r * 0.95 || d > r + rings * h * 1.6 || rr() < 0.15) continue;
      let pts = '';
      for (let i = 0; i < 6; i++) pts += `${f(x + Math.cos((i * Math.PI) / 3) * h * 0.92)},${f(y + Math.sin((i * Math.PI) / 3) * h * 0.92)} `;
      const lit = x - cx + (y - cy) < 0;
      s += `<polygon points="${pts}" fill="${lit ? '#a89e8c' : '#6e665a'}" stroke="#3a342c" stroke-width="0.7"/>`;
      if (rr() < 0.35) s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#f2c14e" opacity="0.85"/>`;
    }
  return s;
}

/** A boulder (brute dens). */
function boulder(p, cx, cy, r, rr) {
  return (
    `<path d="${blob(cx + 1.5, cy + 2, r, r * 0.85, 0.18, 6, rr)}" fill="#000" opacity="0.35" filter="url(#${p}soft)"/>` +
    `<path d="${blob(cx, cy, r, r * 0.85, 0.18, 6, rr)}" fill="url(#${p}stone)" stroke="#1e1a16" stroke-width="1.2"/>` +
    `<path d="M${f(cx - r * 0.6)} ${f(cy - r * 0.1)} Q${f(cx - r * 0.4)} ${f(cy - r * 0.6)} ${f(cx + r * 0.1)} ${f(cy - r * 0.62)}" fill="none" stroke="#d4d0c4" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`
  );
}

/** Three parallel claw gouges. */
function claws(cx, cy, a, len) {
  let s = '';
  for (let i = -1; i <= 1; i++) {
    const ox = Math.cos(a + Math.PI / 2) * i * 3,
      oy = Math.sin(a + Math.PI / 2) * i * 3;
    s += `<path d="M${f(cx + ox)} ${f(cy + oy)} l${f(Math.cos(a) * len)} ${f(Math.sin(a) * len)}" stroke="#2a1a10" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return s;
}

/** A bone, for dens and queens. */
function bone(cx, cy, a, len) {
  const dx = (Math.cos(a) * len) / 2,
    dy = (Math.sin(a) * len) / 2;
  return (
    `<path d="M${f(cx - dx)} ${f(cy - dy)} L${f(cx + dx)} ${f(cy + dy)}" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>` +
    `<path d="M${f(cx - dx)} ${f(cy - dy)} L${f(cx + dx)} ${f(cy + dy)}" stroke="#e8dcc0" stroke-width="2.6" stroke-linecap="round"/>` +
    [-1, 1].map((e) => `<circle cx="${f(cx + e * dx)}" cy="${f(cy + e * dy)}" r="2.6" fill="#e8dcc0" stroke="${INK}" stroke-width="0.8"/>`).join('')
  );
}

/** Pale chitin spikes round a point (queens, dens). */
function spikes(cx, cy, r, n, len, rot, col = '#e8dcc0') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const bx = cx + Math.cos(a) * r,
      by = cy + Math.sin(a) * r;
    const tx = cx + Math.cos(a) * (r + len),
      ty = cy + Math.sin(a) * (r + len);
    const px = Math.cos(a + Math.PI / 2) * 2.4,
      py = Math.sin(a + Math.PI / 2) * 2.4;
    s += `<path d="M${f(bx + px)} ${f(by + py)} L${f(tx)} ${f(ty)} L${f(bx - px)} ${f(by - py)} Z" fill="${col}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`;
  }
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Direction A: Earthworks. The nest digs outward: one hole becomes a mound with side burrows, then a
// sprawling dig site with tunnel ridges heading off the mound, spoil heaps and stolen scrap.
// ---------------------------------------------------------------------------------------------------
function earthworks(k, stage, seed) {
  const p = `a${k[0]}${stage}`;
  const r = rng(seed);
  const C = 64;
  const R = [0, 26, 40, 54][stage];
  let s = '';
  // Ground stain and the mound.
  s += `<path d="${blob(C + 2, C + 3, R * 1.18, R * 1.1, 0.12, 9, r)}" fill="#3a2c1e" opacity="0.55" filter="url(#${p}blur)"/>`;
  // Tunnels leaving the mound (under it): stage 3 only.
  const holes = [[C - 2, C - 2, [0, 10, 13, 15][stage]]];
  if (stage >= 2) holes.push([C + 25, C - 16, 7]);
  if (stage >= 3) holes.push([C - 30, C + 22, 7.5], [C + 22, C + 30, 6], [C - 26, C - 30, 5.5]);
  if (stage >= 3)
    for (const a of [0.4, 2.6, 4.3]) {
      const x0 = C + Math.cos(a) * R * 0.8,
        y0 = C + Math.sin(a) * R * 0.8;
      const ex = C + Math.cos(a) * 58,
        ey = C + Math.sin(a) * 58;
      s += ridge(p, x0, y0, ex, ey, 5, r) + hole(p, ex, ey, 3.2, r);
    }
  s += `<path d="${blob(C + 2, C + 3, R, R * 0.94, 0.1, 10, r)}" fill="#000" opacity="0.4" filter="url(#${p}blur)"/>`;
  s += `<path d="${blob(C, C, R, R * 0.94, stage === 1 ? 0.08 : 0.13, 10, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M${f(C - R * 0.85)} ${f(C - R * 0.15)} C${f(C - R * 0.8)} ${f(C - R * 0.6)} ${f(C - R * 0.4)} ${f(C - R * 0.85)} ${f(C + R * 0.05)} ${f(C - R * 0.88)}" fill="none" stroke="#b09068" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>`;
  // Tunnel ridges on the mound, joining the holes.
  for (let i = 1; i < holes.length; i++) s += ridge(p, holes[0][0], holes[0][1], holes[i][0], holes[i][1], 4, r);
  // Kind dressing under the holes.
  if (k === 'hive') for (const [x, y, hr] of holes) s += comb(p, x, y, hr * 1.25, stage >= 3 && hr > 10 ? 2 : 1, r);
  if (k === 'den' && stage >= 2)
    for (let i = 0; i < stage + 1; i++) {
      const a = 0.5 + i * 1.7;
      s += boulder(p, C + Math.cos(a) * R * 0.78, C + Math.sin(a) * R * 0.78, 6 + stage * 1.5, r);
    }
  for (const [x, y, hr] of holes) s += hole(p, x, y, hr, r, k !== 'hive');
  // Spoil, eggs, scrap, kind details.
  s += clods(p, C, C, R + 4, 3 + stage * 4, r);
  if (stage >= 2) s += eggs(p, C + 10, C + 18, 3 + stage * 2, 4.2, r);
  if (stage >= 3) s += eggs(p, C - 16, C - 14, 4, 3.6, r) + scrap(C, C, R + 6, 5, r);
  if (k === 'warren') {
    // Shed crawler husks: orange segments by the holes.
    for (let i = 0; i < stage * 2; i++) {
      const a = r() * Math.PI * 2,
        d = R * (0.55 + r() * 0.3);
      const x = C + Math.cos(a) * d,
        y = C + Math.sin(a) * d;
      s += `<path d="M${f(x)} ${f(y)} q4 -3 8 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${f(x)} ${f(y)} q4 -3 8 0" fill="none" stroke="#c8682c" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2.2 1"/>`;
    }
  }
  if (k === 'den') {
    for (let i = 0; i < stage; i++) s += claws(C - 20 + i * 18, C + 26 - i * 30, -0.6 + i, 9);
    if (stage >= 3) s += bone(C + 30, C + 8, 0.7, 12) + bone(C - 8, C + 40, -0.3, 10);
  }
  return svg(p, k, s);
}

// ---------------------------------------------------------------------------------------------------
// Direction B: Brood. The nest is alive: a single glossy pod, then a cluster of pods with veins
// creeping out, then a ribbed chitin dome with a maw, ringed by egg sacs, its roots reaching the edge.
// ---------------------------------------------------------------------------------------------------
function pod(p, cx, cy, rx, ry, rot, r, open) {
  let s = `<ellipse cx="${f(cx + 1.5)}" cy="${f(cy + 2)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(cx + 1.5)} ${f(cy + 2)})" fill="#000" opacity="0.4" filter="url(#${p}soft)"/>`;
  s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="url(#${p}pod)" stroke="${INK}" stroke-width="1.4"/>`;
  // Membrane lines along its length.
  s += `<path d="M${f(cx - rx * 0.6)} ${f(cy)} Q${f(cx)} ${f(cy - ry * 0.5)} ${f(cx + rx * 0.6)} ${f(cy)}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.9"/>`;
  s += `<ellipse cx="${f(cx - rx * 0.35)}" cy="${f(cy - ry * 0.4)}" rx="${f(rx * 0.3)}" ry="${f(ry * 0.18)}" transform="rotate(${f(rot - 20)} ${f(cx)} ${f(cy)})" fill="#fff" opacity="0.55"/>`;
  if (open)
    s += `<path d="M${f(cx - rx * 0.4)} ${f(cy + ry * 0.1)} Q${f(cx)} ${f(cy + ry * 0.45)} ${f(cx + rx * 0.4)} ${f(cy + ry * 0.1)} Q${f(cx)} ${f(cy - ry * 0.05)} ${f(cx - rx * 0.4)} ${f(cy + ry * 0.1)} Z" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="#120808" stroke="${INK}" stroke-width="0.8"/>`;
  return s;
}

function veins(p, k, cx, cy, n, len, w, r) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const v = wander(cx, cy, a, len * (0.7 + r() * 0.3), 5, 0.45, r);
    s += `<path d="${v.d}" fill="none" stroke="${INK}" stroke-width="${w + 1.6}" stroke-linecap="round" opacity="0.8"/>`;
    s += `<path d="${v.d}" fill="none" stroke="${KINDS[k].dark}" stroke-width="${w}" stroke-linecap="round"/>`;
    s += `<path d="${v.d}" fill="none" stroke="${KINDS[k].accent}" stroke-width="${w * 0.35}" stroke-linecap="round" opacity="0.7"/>`;
    if (w > 2.5 && r() < 0.7) {
      const b = wander(v.end[0], v.end[1], a + (r() - 0.5) * 1.6, len * 0.3, 3, 0.5, r);
      s += `<path d="${b.d}" fill="none" stroke="${KINDS[k].dark}" stroke-width="${w * 0.5}" stroke-linecap="round"/>`;
    }
  }
  return s;
}

function brood(k, stage, seed) {
  const p = `b${k[0]}${stage}`;
  const r = rng(seed);
  const C = 64;
  let s = `<path d="${blob(C + 2, C + 3, [0, 30, 44, 58][stage], [0, 28, 40, 54][stage], 0.15, 9, r)}" fill="#2e2418" opacity="0.5" filter="url(#${p}blur)"/>`;
  s += veins(p, k, C, C, 3 + stage * 2, [0, 26, 44, 62][stage], [0, 1.8, 2.6, 3.4][stage], r);
  if (stage === 1) {
    // A single pod, half sunk in turned soil.
    s += `<path d="${blob(C, C + 4, 20, 14, 0.12, 8, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="1.4"/>`;
    s += pod(p, C, C, 15, 11, -20, r, true);
    s += clods(p, C, C + 2, 22, 5, r);
    return svg(p, k, s);
  }
  if (stage === 2) {
    s += `<path d="${blob(C, C + 3, 32, 26, 0.15, 9, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="1.6"/>`;
    for (const [dx, dy, rx, ry, rot] of [
      [-16, -10, 11, 8, 30],
      [18, -8, 10, 7, -40],
      [12, 18, 9, 7, 70],
    ])
      s += pod(p, C + dx, C + dy, rx, ry, rot, r, false);
    s += pod(p, C - 2, C + 2, 18, 14, -15, r, true);
    s += eggs(p, C - 18, C + 16, 5, 3.8, r) + clods(p, C, C, 34, 7, r);
    return svg(p, k, s);
  }
  // Stage 3: a ribbed dome with a maw, ringed by egg sacs.
  s += `<path d="${blob(C, C + 3, 46, 40, 0.12, 11, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="1.8"/>`;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    s += pod(p, C + Math.cos(a) * 36, C + Math.sin(a) * 31, 10, 7.5, (a * 180) / Math.PI + 90, r, false);
  }
  s += `<ellipse cx="${C + 2}" cy="${C + 4}" rx="30" ry="27" fill="#000" opacity="0.45" filter="url(#${p}blur)"/>`;
  s += `<ellipse cx="${C}" cy="${C}" rx="29" ry="26" fill="url(#${p}shell)" stroke="${INK}" stroke-width="2"/>`;
  // Overlapping chitin plates, like a bug's back.
  for (const t of [0.78, 0.56, 0.34])
    s += `<ellipse cx="${f(C - 2 * (1 - t))}" cy="${f(C - 3 * (1 - t))}" rx="${f(29 * t)}" ry="${f(26 * t)}" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1.3"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s += `<path d="M${f(C + Math.cos(a) * 9)} ${f(C + Math.sin(a) * 8)} L${f(C + Math.cos(a) * 28)} ${f(C + Math.sin(a) * 25)}" stroke="${INK}" stroke-opacity="0.4" stroke-width="1"/>`;
  }
  s += `<path d="M${C - 22} ${C - 12} Q${C - 14} ${C - 24} ${C} ${C - 24}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2.4" stroke-linecap="round"/>`;
  if (k === 'hive') s += comb(p, C, C, 9, 1, r);
  s += `<circle cx="${C}" cy="${C}" r="13" fill="url(#${p}glow)"/>`;
  s += `<ellipse cx="${C}" cy="${C}" rx="8" ry="7" fill="#0a0404" stroke="${INK}" stroke-width="1.2"/>`;
  s += spikes(C, C, 8, 6, 4, 0.2, k === 'hive' ? '#f2c14e' : '#e8dcc0');
  if (k === 'den') s += spikes(C, C, 27, 9, 7, 0.1);
  s += eggs(p, C + 30, C + 30, 6, 4, r) + eggs(p, C - 34, C - 26, 4, 3.6, r);
  return svg(p, k, s);
}

// ---------------------------------------------------------------------------------------------------
// Direction C: Spires. The bugs build upward, seen from above with a 3/4 lean and long shadows: a lump,
// then a chimney with a younger one beside it, then a cluster of towers round the tallest.
// ---------------------------------------------------------------------------------------------------
function spire(p, k, bx, by, w, h) {
  // Base ellipse at (bx,by), apex h above; shaded from the left, shadow cast down-right.
  let s = `<path d="M${f(bx - w)} ${f(by)} L${f(bx + h * 0.55 + w * 0.2)} ${f(by + h * 0.45)} L${f(bx + w)} ${f(by)} Z" fill="#000" opacity="0.3" filter="url(#${p}soft)"/>`;
  s += `<ellipse cx="${f(bx + 1)}" cy="${f(by + 1.5)}" rx="${f(w * 1.05)}" ry="${f(w * 0.5)}" fill="#000" opacity="0.4" filter="url(#${p}soft)"/>`;
  const ax = bx - w * 0.06,
    ay = by - h;
  const tw = w * (k === 'den' ? 0.5 : 0.32);
  const body = `M${f(bx - w)} ${f(by)} C${f(bx - w * 0.9)} ${f(by - h * 0.5)} ${f(ax - tw * 1.4)} ${f(ay + h * 0.25)} ${f(ax - tw)} ${f(ay)} L${f(ax + tw)} ${f(ay)} C${f(ax + tw * 1.4)} ${f(ay + h * 0.25)} ${f(bx + w * 0.9)} ${f(by - h * 0.5)} ${f(bx + w)} ${f(by)} A${f(w)} ${f(w * 0.45)} 0 0 1 ${f(bx - w)} ${f(by)} Z`;
  const fill = k === 'hive' ? `url(#${p}paper)` : k === 'den' ? `url(#${p}stone)` : `url(#${p}cone)`;
  s += `<path d="${body}" fill="${fill}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  if (k === 'hive') {
    // Paper bands, wrapped round the tower.
    for (let i = 1; i < 6; i++) {
      const t = i / 6,
        y = by - h * t,
        hw = w * (1 - t) + tw * t;
      s += `<path d="M${f(bx - hw)} ${f(y)} Q${f(bx)} ${f(y + hw * 0.4)} ${f(bx + hw)} ${f(y)}" fill="none" stroke="#3a342c" stroke-width="0.9" opacity="0.7"/>`;
    }
  } else if (k === 'den') {
    // Stacked stones: lines across, and a red crust.
    for (let i = 1; i < 4; i++) {
      const t = i / 4,
        y = by - h * t,
        hw = w * (1 - t) + tw * t;
      s += `<path d="M${f(bx - hw)} ${f(y)} Q${f(bx)} ${f(y + hw * 0.35)} ${f(bx + hw)} ${f(y)}" fill="none" stroke="#1e1a16" stroke-width="1.2"/>`;
      s += `<path d="M${f(bx - hw * 0.2)} ${f(y + 1)} l0 ${f(h / 4 - 2)}" stroke="#1e1a16" stroke-width="1"/>`;
    }
    s += `<path d="M${f(bx + w * 0.3)} ${f(by - h * 0.1)} q${f(w * 0.3)} ${f(-h * 0.3)} ${f(w * 0.05)} ${f(-h * 0.55)}" fill="none" stroke="#8a1c24" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>`;
  } else {
    // Mud ribs running up.
    for (const t of [-0.55, -0.15, 0.3, 0.65])
      s += `<path d="M${f(bx + w * t)} ${f(by + 1)} Q${f(bx + w * t * 0.7)} ${f(by - h * 0.5)} ${f(ax + tw * t)} ${f(ay + 2)}" fill="none" stroke="${INK}" stroke-opacity="0.45" stroke-width="1"/>`;
  }
  // Lit edge and the opening on top.
  s += `<path d="M${f(bx - w * 0.8)} ${f(by - 2)} C${f(bx - w * 0.75)} ${f(by - h * 0.45)} ${f(ax - tw * 1.2)} ${f(ay + h * 0.25)} ${f(ax - tw * 0.8)} ${f(ay + 2)}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.8" stroke-linecap="round"/>`;
  s += `<ellipse cx="${f(ax)}" cy="${f(ay)}" rx="${f(tw)}" ry="${f(tw * 0.55)}" fill="url(#${p}pit)" stroke="${INK}" stroke-width="1.1"/>`;
  // Side vents.
  if (h > 22) s += `<ellipse cx="${f(bx + w * 0.2)}" cy="${f(by - h * 0.35)}" rx="${f(w * 0.16)}" ry="${f(w * 0.12)}" fill="#0a0604" stroke="${INK}" stroke-width="0.8"/>`;
  if (h > 34) s += `<ellipse cx="${f(bx - w * 0.3)}" cy="${f(by - h * 0.55)}" rx="${f(w * 0.12)}" ry="${f(w * 0.09)}" fill="#0a0604" stroke="${INK}" stroke-width="0.8"/>`;
  return s;
}

function spires(k, stage, seed) {
  const p = `c${k[0]}${stage}`;
  const r = rng(seed);
  const C = 64;
  const R = [0, 26, 40, 54][stage];
  let s = `<path d="${blob(C + 3, C + 6, R * 1.1, R * 0.95, 0.12, 9, r)}" fill="#3a2c1e" opacity="0.55" filter="url(#${p}blur)"/>`;
  s += `<path d="${blob(C, C + 8, R * 0.9, R * 0.7, 0.12, 9, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="1.6"/>`;
  // Towers, back to front so nearer ones overlap.
  const towers = {
    1: [[C, C + 14, 15, 18]],
    2: [
      [C + 14, C + 4, 9, 22],
      [C - 4, C + 20, 16, 40],
    ],
    3: [
      [C - 22, C - 2, 9, 26],
      [C + 18, C - 6, 11, 34],
      [C - 2, C + 18, 18, 60],
      [C + 28, C + 24, 8, 20],
      [C - 28, C + 28, 7, 16],
    ],
  }[stage];
  s += clods(p, C, C + 10, R * 0.85, 3 + stage * 3, r);
  for (const [x, y, w, h] of [...towers].sort((a, b) => a[1] - b[1])) s += spire(p, k, x, y, w, h);
  if (stage >= 2) s += eggs(p, C + 26, C + 34, 2 + stage * 2, 3.8, r);
  if (stage >= 3) s += scrap(C, C + 8, R, 4, r);
  if (k === 'hive' && stage >= 2) s += comb(p, C - 24, C + 32, 4, 1, r);
  if (k === 'den' && stage >= 3) s += bone(C + 36, C + 4, 0.5, 11);
  return svg(p, k, s);
}

// Queens: the stage 3 drawing of each direction with a royal chamber added.
function queen(dir, seed) {
  const r = rng(seed);
  const C = 64;
  if (dir === 'earthworks') {
    let s = earthworks('queen', 3, seed).replace(/<\/svg>$/, '');
    s += `<circle cx="${C - 2}" cy="${C - 2}" r="22" fill="url(#aq3glow)"/>`;
    s += `<ellipse cx="${C - 2}" cy="${C}" rx="7" ry="5" fill="url(#aq3egg)" stroke="${INK}" stroke-width="1"/>`;
    s += spikes(C - 2, C - 2, 19, 10, 7, 0.2) + bone(C + 38, C - 2, 1.2, 12);
    return s + '</svg>';
  }
  if (dir === 'brood') {
    let s = brood('queen', 3, seed).replace(/<\/svg>$/, '');
    s += spikes(C, C, 27, 12, 9, 0.1, '#ffd36a');
    s += `<ellipse cx="${C}" cy="${C + 1}" rx="5" ry="3.6" fill="url(#bq3egg)" stroke="${INK}" stroke-width="0.8"/>`;
    return s + '</svg>';
  }
  let s = spires('queen', 3, seed).replace(/<\/svg>$/, '');
  s += `<circle cx="${C - 3}" cy="${C - 42}" r="16" fill="url(#cq3glow)"/>`;
  s += eggs('cq3', C - 30, C + 36, 5, 4, r) + eggs('cq3', C + 32, C - 18, 4, 3.6, r);
  r();
  return s + '</svg>';
}

mkdirSync(OUT, { recursive: true });
const DIRS = { earthworks, brood, spires };
let seed = 11;
for (const [dir, draw] of Object.entries(DIRS)) {
  for (const k of ['warren', 'hive', 'den']) for (const st of [1, 2, 3]) writeFileSync(join(OUT, `${dir}_${k}_${st}.svg`), draw(k, st, seed++));
  writeFileSync(join(OUT, `${dir}_queen.svg`), queen(dir, seed++));
}
console.log(`Wrote concepts to ${OUT}`);
