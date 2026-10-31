/* global console */
// Nest concept art, direction A (Earthworks), round 2: a nest kind for every bug, a queen nest of each kind,
// and a queen of each bug. Each stage is its own drawing, not a scaled copy.
// Run `node docs/nest-concepts/generate.mjs`; it writes the SVGs into docs/nest-concepts/svg/.
// Concepts only: the game doesn't load these.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'svg');
const ENEMIES = join(HERE, '..', '..', 'src', 'art', 'enemies');
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

/**
 * The five nest kinds, one per bug, with the bug's colours. `from` is the proposed distance from the hub
 * where the kind starts (warrens near the hub; the others follow today's hive, wasp, den and beetle lines).
 */
export const KINDS = {
  warren: { bug: 'crawler', from: 0, soil: ['#8a6a44', '#5e4630', '#3e2c1c'], accent: '#c8682c', glow: ['#ffd36a', '#e0a030'] },
  runnel: { bug: 'runner', from: 60, soil: ['#6e6658', '#47413a', '#2a2622'], accent: '#3b4152', glow: ['#d8e8ff', '#6a8ac0'] },
  hive: { bug: 'wasp', from: 80, soil: ['#8a7c62', '#5a4e3a', '#342c20'], accent: '#f2c14e', glow: ['#fff0a0', '#f2c14e'] },
  den: { bug: 'brute', from: 100, soil: ['#7c6450', '#55402e', '#33241a'], accent: '#8a1c24', glow: ['#ff9a80', '#c0343c'] },
  barrow: { bug: 'beetle', from: 120, soil: ['#9a7458', '#6a4a36', '#3e2a1e'], accent: '#4a74a0', glow: ['#bfe6ff', '#4a90c8'] },
};

/** Gradients and filters every drawing shares; ids carry a prefix so many SVGs can sit inline on one page. */
function defs(p, k) {
  const [s0, s1, s2] = KINDS[k].soil;
  const [g0, g1] = KINDS[k].glow;
  return `<defs>
<filter id="${p}blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
<radialGradient id="${p}mound" cx="36%" cy="32%" r="70%"><stop offset="0" stop-color="${s0}"/><stop offset="0.55" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></radialGradient>
<radialGradient id="${p}pit" cx="44%" cy="44%" r="58%"><stop offset="0" stop-color="#040302"/><stop offset="0.45" stop-color="#120c07"/><stop offset="0.8" stop-color="#33251a"/><stop offset="1" stop-color="#4e3a26"/></radialGradient>
<radialGradient id="${p}glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${g0}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${g1}" stop-opacity="0.5"/><stop offset="1" stop-color="${g1}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}egg" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff6e0"/><stop offset="0.6" stop-color="#e8d2a8"/><stop offset="1" stop-color="#b09670"/></radialGradient>
<radialGradient id="${p}ball" cx="34%" cy="30%" r="70%"><stop offset="0" stop-color="#b08a64"/><stop offset="0.6" stop-color="#6e4e34"/><stop offset="1" stop-color="#3a2618"/></radialGradient>
<radialGradient id="${p}shell" cx="36%" cy="26%" r="80%"><stop offset="0" stop-color="#9cc6ea"/><stop offset="0.35" stop-color="#4a74a0"/><stop offset="0.75" stop-color="#22385a"/><stop offset="1" stop-color="#121e32"/></radialGradient>
<linearGradient id="${p}stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8a49a"/><stop offset="0.5" stop-color="#76726a"/><stop offset="1" stop-color="#46423c"/></linearGradient>
</defs>`;
}

const svg = (p, k, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${defs(p, k)}${body}</svg>`;

/** A burrow entrance: a raised rim, a dark pit and a lit lip. */
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
function clods(cx, cy, spread, n, r, color = '#6a5034') {
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

/** A raised tunnel ridge between two points: a soil bulge with a lit crest. `bend` 0 makes it straight. */
function ridge(p, x1, y1, x2, y2, w, r, bend = 14) {
  const mx = (x1 + x2) / 2 + (r() - 0.5) * bend,
    my = (y1 + y2) / 2 + (r() - 0.5) * bend;
  const d = `M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
  return (
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="${w + 3}" stroke-linecap="round" transform="translate(1.5 2)" filter="url(#${p}soft)"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="url(#${p}mound)" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#a8865c" stroke-width="${w * 0.35}" stroke-linecap="round" transform="translate(-0.8 -1)" opacity="0.7"/>`
  );
}

/** A sunken trench (runnels): soil banks thrown up either side of a dark groove, tapering to its far end. */
function trench(p, x1, y1, x2, y2, w) {
  const d = `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`;
  const nx = -(y2 - y1),
    ny = x2 - x1,
    l = Math.hypot(nx, ny);
  const ox = (nx / l) * w * 0.8,
    oy = (ny / l) * w * 0.8;
  const groove = `M${f(x1 + ox)} ${f(y1 + oy)} L${f(x2 + ox * 0.3)} ${f(y2 + oy * 0.3)} L${f(x2 - ox * 0.3)} ${f(y2 - oy * 0.3)} L${f(x1 - ox)} ${f(y1 - oy)} Z`;
  return (
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="${w * 2.2}" stroke-linecap="round" transform="translate(1 1.5)" filter="url(#${p}soft)"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="0.6" stroke-width="${w * 2.2 + 1.4}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#5a5248" stroke-width="${w * 2.2}" stroke-linecap="round"/>` +
    `<path d="${groove}" fill="#120e0a" stroke="${INK}" stroke-width="0.8"/>` +
    `<path d="M${f(x1 - ox)} ${f(y1 - oy)} L${f(x2 - ox * 0.3)} ${f(y2 - oy * 0.3)}" stroke="#b8a888" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`
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
    s += `<path d="M${f(x)} ${f(y)} l${f(4 + r() * 2)} ${f(-1 - r() * 2)} l${f(1 + r())} ${f(3 + r())} l-5 1.5 z" fill="${cols[i % 3]}" stroke="#0f1a2e" stroke-width="0.8" stroke-linejoin="round"/>`;
  }
  return s;
}

/** Paper comb collar: a ring of grey hexagon cells round a hole, some with yellow grubs (hives). */
function comb(cx, cy, r, rings, rr) {
  let s = '';
  const h = 4.2;
  for (let q = -rings * 3; q <= rings * 3; q++)
    for (let w = -rings * 3; w <= rings * 3; w++) {
      const x = cx + h * 1.5 * q,
        y = cy + h * Math.sqrt(3) * (w + q / 2);
      const d = Math.hypot(x - cx, y - cy);
      if (d < r * 0.95 || d > r + rings * h * 1.6 || rr() < 0.15) continue;
      let pts = '';
      for (let i = 0; i < 6; i++) pts += `${f(x + Math.cos((i * Math.PI) / 3) * h * 0.92)},${f(y + Math.sin((i * Math.PI) / 3) * h * 0.92)} `;
      const lit = x - cx + (y - cy) < 0;
      s += `<polygon points="${pts}" fill="${lit ? '#c4b898' : '#857a64'}" stroke="#3a342c" stroke-width="0.7"/>`;
      if (rr() < 0.35) s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#f2c14e" stroke="#3a2c08" stroke-width="0.4"/>`;
    }
  return s;
}

/** A boulder (dens). */
function boulder(p, cx, cy, r, rr) {
  return (
    `<path d="${blob(cx + 1.5, cy + 2, r, r * 0.85, 0.18, 6, rr)}" fill="#000" opacity="0.35" filter="url(#${p}soft)"/>` +
    `<path d="${blob(cx, cy, r, r * 0.85, 0.18, 6, rr)}" fill="url(#${p}stone)" stroke="#1e1a16" stroke-width="1.2"/>` +
    `<path d="M${f(cx - r * 0.6)} ${f(cy - r * 0.1)} Q${f(cx - r * 0.4)} ${f(cy - r * 0.6)} ${f(cx + r * 0.1)} ${f(cy - r * 0.62)}" fill="none" stroke="#d4d0c4" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`
  );
}

/** A rolled ball of packed earth, with a groove where it was rolled (barrows). */
function ball(p, cx, cy, r) {
  return (
    `<ellipse cx="${f(cx + 1.5)}" cy="${f(cy + 2)}" rx="${f(r)}" ry="${f(r * 0.92)}" fill="#000" opacity="0.4" filter="url(#${p}soft)"/>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="url(#${p}ball)" stroke="${INK}" stroke-width="1.2"/>` +
    `<path d="M${f(cx - r * 0.8)} ${f(cy + r * 0.2)} Q${f(cx)} ${f(cy + r * 0.6)} ${f(cx + r * 0.8)} ${f(cy + r * 0.1)}" fill="none" stroke="${INK}" stroke-opacity="0.4" stroke-width="0.9"/>` +
    `<ellipse cx="${f(cx - r * 0.35)}" cy="${f(cy - r * 0.4)}" rx="${f(r * 0.3)}" ry="${f(r * 0.18)}" fill="#e8d0a8" opacity="0.5"/>`
  );
}

/** Half of a shed beetle wing case: a blue shell shard (barrows). */
function shard(p, cx, cy, a, len) {
  return `<path d="M0 0 Q${f(len * 0.5)} ${f(-len * 0.55)} ${f(len)} 0 Q${f(len * 0.5)} ${f(-len * 0.12)} 0 0 Z" transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})" fill="url(#${p}shell)" stroke="#0f1a2e" stroke-width="0.9"/>`;
}

/** A shed runner segment row: small navy plates in a line (runnels). */
function segments(cx, cy, a, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = cx + Math.cos(a) * i * 4.2,
      y = cy + Math.sin(a) * i * 4.2;
    s += `<rect x="${f(x - 2)}" y="${f(y - 2.6)}" width="4" height="5.2" rx="1.6" transform="rotate(${f((a * 180) / Math.PI)} ${f(x)} ${f(y)})" fill="#3b4152" stroke="#0f1a2e" stroke-width="0.8"/>`;
  }
  return s;
}

/** A shed crawler husk: an orange curl (warrens). */
const husk = (x, y) =>
  `<path d="M${f(x)} ${f(y)} q4 -3 8 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${f(x)} ${f(y)} q4 -3 8 0" fill="none" stroke="#c8682c" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2.2 1"/>`;

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

/** A bone (dens). */
function bone(cx, cy, a, len) {
  const dx = (Math.cos(a) * len) / 2,
    dy = (Math.sin(a) * len) / 2;
  return (
    `<path d="M${f(cx - dx)} ${f(cy - dy)} L${f(cx + dx)} ${f(cy + dy)}" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>` +
    `<path d="M${f(cx - dx)} ${f(cy - dy)} L${f(cx + dx)} ${f(cy + dy)}" stroke="#e8dcc0" stroke-width="2.6" stroke-linecap="round"/>` +
    [-1, 1].map((e) => `<circle cx="${f(cx + e * dx)}" cy="${f(cy + e * dy)}" r="2.6" fill="#e8dcc0" stroke="${INK}" stroke-width="0.8"/>`).join('')
  );
}

/** Chitin spikes round a point. */
function spikes(cx, cy, r, n, len, rot, col) {
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
// The nest: one hole in a low mound at stage 1, a wider mound with a side burrow at stage 2, a dig site
// with five burrows and tunnels leaving the mound at stage 3. Each kind dresses it its own way.
// A queen nest is stage 3 again, wider, with a glowing royal chamber in place of the main burrow.
// ---------------------------------------------------------------------------------------------------
function nest(k, stage, seed, queen = false) {
  const p = `${k.slice(0, 2)}${stage}${queen ? 'q' : ''}`;
  const r = rng(seed);
  const C = 64;
  const R = queen ? 55 : [0, 26, 40, 54][stage];
  let s = '';
  s += `<path d="${blob(C + 2, C + 3, R * 1.16, R * 1.08, 0.12, 9, r)}" fill="#3a2c1e" opacity="0.55" filter="url(#${p}blur)"/>`;

  const holes = [[C - 2, C - 2, queen ? 16 : [0, 10, 13, 15][stage]]];
  if (stage >= 2) holes.push([C + 25, C - 16, 7]);
  if (stage >= 3) holes.push([C - 30, C + 22, 7.5], [C + 22, C + 30, 6], [C - 26, C - 30, 5.5]);
  if (queen) holes.push([C + 36, C + 4, 5], [C - 40, C - 4, 5]);

  // Tunnels leaving the mound, under it (stage 3). Runnels dig long straight trenches instead, from stage 2.
  if (k === 'runnel') {
    const n = [0, 2, 4, 6][stage] + (queen ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.35;
      s += trench(p, C + Math.cos(a) * R * 0.7, C + Math.sin(a) * R * 0.7, C + Math.cos(a) * Math.min(60, R + 14 + stage * 2), C + Math.sin(a) * Math.min(60, R + 14 + stage * 2), 3.2);
    }
  } else if (stage >= 3) {
    for (const a of queen ? [0.4, 1.5, 2.6, 3.6, 4.3, 5.4] : [0.4, 2.6, 4.3]) {
      const x0 = C + Math.cos(a) * R * 0.8,
        y0 = C + Math.sin(a) * R * 0.8;
      const ex = C + Math.cos(a) * 59,
        ey = C + Math.sin(a) * 59;
      s += ridge(p, x0, y0, ex, ey, 5, r) + hole(p, ex, ey, 3.2, r);
    }
  }

  // The mound.
  s += `<path d="${blob(C + 2, C + 3, R, R * 0.94, 0.1, 10, r)}" fill="#000" opacity="0.4" filter="url(#${p}blur)"/>`;
  s += `<path d="${blob(C, C, R, R * 0.94, stage === 1 ? 0.08 : 0.13, 10, r)}" fill="url(#${p}mound)" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M${f(C - R * 0.85)} ${f(C - R * 0.15)} C${f(C - R * 0.8)} ${f(C - R * 0.6)} ${f(C - R * 0.4)} ${f(C - R * 0.85)} ${f(C + R * 0.05)} ${f(C - R * 0.88)}" fill="none" stroke="#c8a87c" stroke-width="2.4" stroke-linecap="round" opacity="0.45"/>`;

  // Tunnel ridges on the mound join the burrows: straight for runnels, winding for the rest.
  for (let i = 1; i < holes.length; i++) s += ridge(p, holes[0][0], holes[0][1], holes[i][0], holes[i][1], 4, r, k === 'runnel' ? 0 : 14);

  // What each kind puts round its burrows, before the burrows themselves.
  if (k === 'hive') for (const [x, y, hr] of holes) s += comb(x, y, hr * 1.25, hr > 10 ? (queen ? 3 : stage >= 3 ? 2 : 1) : 1, r);
  if (k === 'den' && stage >= 2)
    for (let i = 0; i < stage + 1 + (queen ? 2 : 0); i++) {
      const a = 0.5 + i * 1.7;
      s += boulder(p, C + Math.cos(a) * R * 0.78, C + Math.sin(a) * R * 0.78, 6 + stage * 1.5, r);
    }
  if (k === 'barrow') for (const [x, y, hr] of holes.slice(1)) s += ball(p, x + hr * 0.9, y - hr * 0.7, hr * 0.75); // each side burrow plugged half shut with a ball

  for (const [x, y, hr] of holes) s += hole(p, x, y, hr, r, k !== 'hive');

  // Spoil, eggs and scrap; more of everything as it grows.
  s += clods(C, C, R + 4, 3 + stage * 4, r, k === 'runnel' ? '#4e4840' : '#6a5034');
  if (stage >= 2) s += eggs(p, C + 10, C + 18, 3 + stage * 2, 4.2, r);
  if (stage >= 3) s += eggs(p, C - 16, C - 14, 4, 3.6, r) + scrap(C, C, R + 6, 5, r);

  // Each kind's own signs, growing with the stage.
  if (k === 'warren')
    for (let i = 0; i < stage * 2; i++) {
      const a = r() * Math.PI * 2,
        d = R * (0.55 + r() * 0.3);
      s += husk(C + Math.cos(a) * d, C + Math.sin(a) * d);
    }
  if (k === 'runnel') for (let i = 0; i < stage; i++) s += segments(C - 24 + i * 22, C + 20 - i * 14, -0.4 + i * 0.9, 4 + stage);
  if (k === 'den') {
    for (let i = 0; i < stage; i++) s += claws(C - 20 + i * 18, C + 26 - i * 30, -0.6 + i, 9);
    if (stage >= 3) s += bone(C + 30, C + 8, 0.7, 12) + bone(C - 8, C + 40, -0.3, 10);
  }
  if (k === 'hive' && stage >= 3) s += `<path d="M${C + 34} ${C + 38} q6 -2 10 2" stroke="${INK}" stroke-width="1" fill="none"/>`;
  if (k === 'barrow') {
    for (let i = 0; i < stage; i++) s += shard(p, C - 30 + i * 26, C + 32 - i * 8, -20 + i * 50, 9);
    s += ball(p, C + [0, 18, 30, 30][stage], C + [0, 14, 22, 22][stage], 4 + stage * 1.5);
    if (stage >= 3) s += ball(p, C - 36, C - 6, 8) + ball(p, C - 28, C - 14, 5.5);
  }

  // The queen's chamber: a glow from the main burrow, a royal egg, a crown of spikes in the kind's colour.
  if (queen) {
    const [x, y] = holes[0];
    const spike = { warren: '#e0a030', runnel: '#c8d4e8', hive: '#f2c14e', den: '#e8dcc0', barrow: '#9cc6ea' }[k];
    s += spikes(x, y, 21, 12, 7, 0.2, spike);
    s += `<circle cx="${x}" cy="${y}" r="22" fill="url(#${p}glow)"/>`;
    s += `<ellipse cx="${x}" cy="${y + 2}" rx="7" ry="5" fill="url(#${p}egg)" stroke="${INK}" stroke-width="1"/>`;
    if (k === 'den') s += bone(C + 40, C - 22, 1.2, 12) + bone(C - 36, C + 38, 0.3, 11);
    if (k === 'warren') for (let i = 0; i < 6; i++) s += husk(x + Math.cos(i * 1.05) * 30 - 4, y + Math.sin(i * 1.05) * 28);
    if (k === 'barrow') s += ball(p, x + 26, y + 20, 11) + ball(p, x - 24, y + 26, 8);
    if (k === 'runnel') for (let i = 0; i < 3; i++) s += segments(x - 30 + i * 6, y + 30 - i * 2, -0.2, 6);
  }
  return svg(p, k, s);
}

// ---------------------------------------------------------------------------------------------------
// Queen bugs: each bug as it is, on top of a swollen egg-laden abdomen trailing behind it, with a gold
// crown at its head. Drawn facing right like the bugs (viewBox 96, so a queen reads about 1.5× a bug).
// ---------------------------------------------------------------------------------------------------
const QUEENS = {
  // Where each bug's head is in its 64-unit sprite, and how its queen's abdomen looks.
  crawler: { head: 56, tail: 9, sac: 'segmented', colors: ['#f0b47a', '#c8682c', '#5a2c10'] },
  runner: { head: 54, tail: 12, sac: 'long', colors: ['#7a8298', '#3b4152', '#141824'] },
  brute: { head: 47, tail: 6, sac: 'armoured', colors: ['#c0343c', '#7a1820', '#2a0608'] },
  wasp: { head: 50, tail: 5, sac: 'striped', colors: ['#ffd860', '#c88a10', '#1a1408'] },
  beetle: { head: 54, tail: 9, sac: 'shell', colors: ['#9cc6ea', '#4a74a0', '#121e32'] },
};

function queenBug(bug) {
  const q = QUEENS[bug];
  const p = `q${bug.slice(0, 2)}`;
  const [c0, c1, c2] = q.colors;
  const src = readFileSync(join(ENEMIES, `${bug}.svg`)).toString('base64');
  const ox = 28,
    oy = 16; // where the bug's own 64-unit sprite sits
  const tailX = ox + q.tail + 4,
    hx = ox + q.head,
    hy = 48;
  let s = `<defs>
<radialGradient id="${p}sac" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#fff2d8"/><stop offset="0.35" stop-color="${c0}"/><stop offset="0.8" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<radialGradient id="${p}gold" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff0a0"/><stop offset="0.5" stop-color="#e8b030"/><stop offset="1" stop-color="#8a5a10"/></radialGradient>
<filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
</defs>`;
  // The abdomen, behind the bug: centre and size by kind.
  const long = q.sac === 'long';
  const rx = long ? 26 : 22,
    ry = long ? 10 : q.sac === 'shell' ? 19 : 16;
  const sx = tailX - rx + 6,
    sy = hy;
  s += `<ellipse cx="${sx + 2}" cy="${sy + 3}" rx="${rx}" ry="${ry}" fill="#000" opacity="0.35" filter="url(#${p}soft)"/>`;
  s += `<ellipse cx="${sx}" cy="${sy}" rx="${rx}" ry="${ry}" fill="url(#${p}sac)" stroke="#0f1a2e" stroke-width="2"/>`;
  if (q.sac === 'striped') {
    for (const t of [-0.55, -0.15, 0.25]) {
      const x = sx + rx * t;
      const h = ry * Math.sqrt(1 - t * t) * 0.96;
      s += `<path d="M${f(x)} ${f(sy - h)} Q${f(x - 3)} ${sy} ${f(x)} ${f(sy + h)} L${f(x + 6)} ${f(sy + h * 0.95)} Q${f(x + 3)} ${sy} ${f(x + 6)} ${f(sy - h * 0.95)} Z" fill="${c2}"/>`;
    }
    s += `<path d="M${sx - rx + 1} ${sy} L${sx - rx - 7} ${sy}" stroke="#0f1a2e" stroke-width="2.6" stroke-linecap="round"/>`; // stinger
  } else {
    // Segment rings across the abdomen.
    const n = long ? 7 : 4;
    for (let i = 1; i <= n; i++) {
      const t = -1 + (2 * i) / (n + 1);
      const x = sx + rx * t,
        h = ry * Math.sqrt(1 - t * t);
      s += `<path d="M${f(x + 2)} ${f(sy - h)} Q${f(x - 3)} ${sy} ${f(x + 2)} ${f(sy + h)}" fill="none" stroke="${c2}" stroke-width="${q.sac === 'armoured' ? 2 : 1.2}" stroke-opacity="0.75"/>`;
    }
  }
  // Eggs showing through the skin, and a gleam.
  const r = rng(bug.length * 7);
  for (let i = 0; i < 7; i++) {
    const x = sx + (r() - 0.5) * rx * 1.2,
      y = sy + (r() - 0.3) * ry * 0.9;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.4" ry="1.7" fill="#fff6e0" opacity="0.45"/>`;
  }
  s += `<path d="M${f(sx - rx * 0.7)} ${f(sy - ry * 0.45)} Q${f(sx - rx * 0.2)} ${f(sy - ry * 0.95)} ${f(sx + rx * 0.4)} ${f(sy - ry * 0.75)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="2.2" stroke-linecap="round"/>`;
  if (q.sac === 'shell') {
    // The beetle queen's wing cases have split over her abdomen.
    s += `<path d="M${tailX + 4} ${sy - 18} Q${sx - 4} ${sy - 30} ${sx - 12} ${sy - 16} Q${sx} ${sy - 14} ${tailX + 4} ${sy - 10} Z" fill="url(#${p}sac)" stroke="#0f1a2e" stroke-width="1.4"/>`;
    s += `<path d="M${tailX + 4} ${sy + 18} Q${sx - 4} ${sy + 30} ${sx - 12} ${sy + 16} Q${sx} ${sy + 14} ${tailX + 4} ${sy + 10} Z" fill="url(#${p}sac)" stroke="#0f1a2e" stroke-width="1.4"/>`;
  }
  // The bug itself, a little larger than a worker, then the crown at its head.
  s += `<image href="data:image/svg+xml;base64,${src}" x="${ox - 2}" y="${oy - 2}" width="68" height="68"/>`;
  const cr = bug === 'brute' ? 8 : bug === 'beetle' ? 7 : 6;
  const crown = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i - 2) * 0.5; // fanned out over the back of the head
    const bx = hx - 2 + Math.cos(a) * cr,
      by = hy + Math.sin(a) * cr;
    const tx = hx - 2 + Math.cos(a) * (cr + 7.5),
      ty = hy + Math.sin(a) * (cr + 7.5);
    const px = Math.cos(a + Math.PI / 2) * 2,
      py = Math.sin(a + Math.PI / 2) * 2;
    crown.push(`<path d="M${f(bx + px)} ${f(by + py)} L${f(tx)} ${f(ty)} L${f(bx - px)} ${f(by - py)} Z" fill="url(#${p}gold)" stroke="#3a2408" stroke-width="0.9" stroke-linejoin="round"/>`);
    crown.push(`<circle cx="${f(tx)}" cy="${f(ty)}" r="1.1" fill="#fff6c0" stroke="#3a2408" stroke-width="0.5"/>`);
  }
  s += crown.join('');
  s += `<path d="M${f(hx - 2 - cr * 0.6)} ${f(hy - cr * 0.8)} A${cr} ${cr} 0 0 0 ${f(hx - 2 - cr * 0.6)} ${f(hy + cr * 0.8)}" fill="none" stroke="#3a2408" stroke-width="3.4" stroke-linecap="round"/>`;
  s += `<path d="M${f(hx - 2 - cr * 0.6)} ${f(hy - cr * 0.8)} A${cr} ${cr} 0 0 0 ${f(hx - 2 - cr * 0.6)} ${f(hy + cr * 0.8)}" fill="none" stroke="url(#${p}gold)" stroke-width="2" stroke-linecap="round"/>`;
  // Fit the whole queen, abdomen to jaws, inside the 96-unit box.
  const left = sx - rx - (q.sac === 'striped' ? 9 : 2),
    right = ox + 66;
  const k = Math.min(1, 92 / (right - left));
  const dx = (96 - (right - left) * k) / 2 - left * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${s.replace('</defs>', `</defs><g transform="translate(${f(dx)} ${f(48 - 48 * k)}) scale(${f(k * 100) / 100})">`)}</g></svg>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let seed = 11;
for (const k of Object.keys(KINDS)) {
  for (const st of [1, 2, 3]) writeFileSync(join(OUT, `nest_${k}_${st}.svg`), nest(k, st, seed++));
  writeFileSync(join(OUT, `nest_${k}_queen.svg`), nest(k, 3, seed++, true));
}
for (const bug of Object.keys(QUEENS)) writeFileSync(join(OUT, `queen_${bug}.svg`), queenBug(bug));
console.log(`Wrote concepts to ${OUT}`);
