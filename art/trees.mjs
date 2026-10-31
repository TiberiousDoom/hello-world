// Draws the bare broadleaf trees and the leaf-covered ground for the end of fall and winter (D-152): the
// tree at the end of fall with its last few leaves, the same tree in winter with snow along its limbs, and
// the ground under a fall of leaves. Run `node art/trees.mjs` to rebuild them; a seeded random number
// generator lays out the branches and leaves, so the result is the same every time.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art', 'terrain');
const INK = '#2a2019';

/** A small seeded random number generator (mulberry32), from 0 to 1. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

/** The tree seen from above: limbs from the trunk, forking out to twigs. Segments are [x0, y0, x1, y1, width, depth]. */
function branches(seed) {
  const r = rng(seed);
  const segs = [];
  const tips = [];
  const grow = (x, y, a, len, w, d) => {
    const a2 = a + (r() - 0.5) * 0.55; // each limb bends a little
    const x1 = x + Math.cos(a2) * len;
    const y1 = y + Math.sin(a2) * len;
    segs.push([x, y, x1, y1, w, d]);
    if (d >= 4 || len < 4) {
      tips.push([x1, y1]);
      return;
    }
    const kids = d === 0 ? 2 : r() < 0.3 ? 3 : r() < 0.15 ? 1 : 2;
    const spread = 0.35 + r() * 0.35;
    for (let k = 0; k < kids; k++) {
      const off = kids === 2 ? (k ? spread : -spread) : kids === 3 ? (k - 1) * spread : 0;
      grow(x1, y1, a2 + off + (r() - 0.5) * 0.35, len * (0.58 + r() * 0.2), Math.max(0.9, w * 0.6), d + 1);
    }
  };
  const limbs = 5;
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < limbs; i++) {
    const a = a0 + (i / limbs) * Math.PI * 2 + (r() - 0.5) * 0.9;
    grow(64 + Math.cos(a) * 2, 64 + Math.sin(a) * 2, a, 13 + r() * 11, 5.5 + r() * 2, 0);
  }
  // Keep the crown inside the sprite.
  let far = 0;
  for (const [x0, y0, x1, y1] of segs) far = Math.max(far, Math.hypot(x0 - 64, y0 - 64), Math.hypot(x1 - 64, y1 - 64));
  const k = Math.min(1, 54 / far);
  const fit = (v) => 64 + (v - 64) * k;
  for (const s of segs) [s[0], s[1], s[2], s[3]] = [fit(s[0]), fit(s[1]), fit(s[2]), fit(s[3])];
  for (const t of tips) [t[0], t[1]] = [fit(t[0]), fit(t[1])];
  return { segs, tips, r };
}

/** The segments as paths, one per stroke width, drawn in `color`, moved by (dx, dy). */
function strokes(segs, color, width, dx = 0, dy = 0) {
  const groups = new Map();
  for (const s of segs) {
    const w = f(width(s));
    if (w <= 0) continue;
    groups.set(w, `${groups.get(w) ?? ''}M${f(s[0] + dx)} ${f(s[1] + dy)} L${f(s[2] + dx)} ${f(s[3] + dy)} `);
  }
  return [...groups].map(([w, d]) => `<path d="${d.trim()}" stroke="${color}" stroke-width="${w}" />`).join('');
}

/** A bare tree: 'late' keeps a few last leaves on its twigs, 'winter' has snow along its limbs. */
function bareTree(kind, seed = 11) {
  const { segs, tips, r } = branches(seed);
  const id = `bt${kind}`;
  let s = `<g opacity="0.3" filter="url(#${id})">${strokes(segs, '#000', (g) => g[4] + 0.6, 7, 9)}</g>`;
  s += strokes(segs, INK, (g) => g[4] + (g[4] > 3 ? 2.2 : 1.3));
  s += strokes(segs, '#6e5745', (g) => g[4]);
  // Light from the top-left: a lighter streak along the upper side of the bigger limbs.
  s += strokes(
    segs.filter((g) => g[5] <= 2),
    '#a3876d',
    (g) => g[4] * 0.38,
    -0.7,
    -0.7,
  );
  if (kind === 'winter') {
    // Snow along the tops of the limbs (thinning out on the twigs), heaped in the fork over the trunk.
    s += strokes(
      segs.filter((g) => g[5] < 2 || (r() < 0.6 && g[5] <= 3)),
      '#f4f8ff',
      (g) => Math.max(0.8, g[4] * 0.5),
      -0.9,
      -1,
    );
    s += strokes(
      segs.filter((g) => g[5] <= 1),
      '#ffffff',
      (g) => g[4] * 0.25,
      -1.1,
      -1.2,
    );
    s += `<ellipse cx="63.4" cy="63.4" rx="6.5" ry="5.8" fill="#eef4fc" stroke="${INK}" stroke-width="1.6" /><ellipse cx="62" cy="62" rx="3" ry="2.4" fill="#ffffff" />`;
  } else {
    s += `<circle cx="64" cy="64" r="6" fill="#5e4a3a" stroke="${INK}" stroke-width="1.8" /><circle cx="64" cy="64" r="3.2" fill="none" stroke="#7d6450" stroke-width="1" /><path d="M59 60.5 Q61 58.5 64 58.3" stroke="#a3876d" stroke-width="1.4" fill="none" stroke-linecap="round" />`;
    // The last few leaves hanging on at the twig ends.
    const cols = ['#d9792b', '#e8a23a', '#b9532a', '#f0c25a'];
    s += tips
      .filter(() => r() < 0.3)
      .map(
        ([x, y], i) =>
          `<ellipse cx="${f(x + (r() - 0.5) * 3)}" cy="${f(y + (r() - 0.5) * 3)}" rx="2.4" ry="1.6" transform="rotate(${Math.round(r() * 180)} ${f(x)} ${f(y)})" fill="${cols[i % 4]}" stroke="${INK}" stroke-width="0.7" />`,
      )
      .join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter></defs>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">${s}</g></svg>
`;
}

/** The ground under fallen leaves: fall's ground, browner, with leaves lying all over it (wrapping at the edges, so tiles join). */
function leafGround(seed = 5) {
  const r = rng(seed);
  const cols = ['#d9772a', '#c2451f', '#e39a2e', '#a8742e', '#b9532a', '#f0c25a', '#8a5a2e'];
  let leaves = '';
  for (let i = 0; i < 34; i++) {
    const x = r() * 64;
    const y = r() * 64;
    const rx = f(2.2 + r() * 1.1);
    const ry = f(rx * (0.45 + r() * 0.15));
    const rot = Math.round(r() * 180);
    const col = cols[Math.floor(r() * cols.length)];
    const dark = r() < 0.3; // some lie in the shade, underneath
    for (const ox of [-64, 0, 64])
      for (const oy of [-64, 0, 64]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -5 || cx > 69 || cy < -5 || cy > 69) continue;
        leaves += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${rx}" ry="${ry}" fill="${col}"${dark ? ' opacity="0.6"' : ''} transform="rotate(${rot} ${f(cx)} ${f(cy)})" />`;
        if (!dark) leaves += `<path d="M${f(cx - rx * 0.7)} ${f(cy)} H${f(cx + rx * 0.7)}" stroke="#5a3a1e" stroke-width="0.4" opacity="0.6" transform="rotate(${rot} ${f(cx)} ${f(cy)})" />`;
      }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#45462a" /><circle cx="28" cy="56" r="7" fill="#4d4a2c" opacity="0.7" /><circle cx="57" cy="42" r="6" fill="#3c3e24" opacity="0.7" /><circle cx="12" cy="18" r="6" fill="#504a2a" opacity="0.6" />${leaves}<rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="#363f25" stroke-width="1" /></svg>
`;
}

writeFileSync(join(ART, 'tree_round_late.svg'), bareTree('late'));
writeFileSync(join(ART, 'tree_round_winter.svg'), bareTree('winter'));
writeFileSync(join(ART, 'ground_leaves.svg'), leafGround());
console.log('wrote tree_round_late, tree_round_winter, ground_leaves');
