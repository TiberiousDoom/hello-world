// Bare broadleaf trees seen from above: limbs radiating from the trunk, forking out to twigs.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

/** The branch segments: [x0, y0, x1, y1, width, depth], plus the twig tips. */
export function branches(seed = 7) {
  const r = rng(seed);
  const segs = [];
  const tips = [];
  const grow = (x, y, a, len, w, d) => {
    // Each limb bends a little along its length.
    const a2 = a + (r() - 0.5) * 0.55;
    const x1 = x + Math.cos(a2) * len, y1 = y + Math.sin(a2) * len;
    segs.push([x, y, x1, y1, w, d]);
    if (d >= 4 || len < 4) { tips.push([x1, y1]); return; }
    const kids = d === 0 ? 2 : r() < 0.3 ? 3 : r() < 0.15 ? 1 : 2;
    const spread = 0.35 + r() * 0.35;
    for (let k = 0; k < kids; k++) {
      const off = kids === 2 ? (k ? spread : -spread) : (k - 1) * spread;
      grow(x1, y1, a2 + off + (r() - 0.5) * 0.35, len * (0.58 + r() * 0.2), Math.max(0.9, w * 0.6), d + 1);
    }
  };
  const limbs = 5;
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < limbs; i++) {
    const a = a0 + (i / limbs) * Math.PI * 2 + (r() - 0.5) * 0.9;
    grow(64 + Math.cos(a) * 2, 64 + Math.sin(a) * 2, a, 13 + r() * 11, 5.5 + r() * 2, 0);
  }
  // Keep the crown inside the sprite's box.
  let far = 0;
  for (const [x0, y0, x1, y1] of segs) far = Math.max(far, Math.hypot(x0 - 64, y0 - 64), Math.hypot(x1 - 64, y1 - 64));
  const k = Math.min(1, 54 / far);
  const fit = (v) => 64 + (v - 64) * k;
  for (const sg of segs) [sg[0], sg[1], sg[2], sg[3]] = [fit(sg[0]), fit(sg[1]), fit(sg[2]), fit(sg[3])];
  for (const t of tips) [t[0], t[1]] = [fit(t[0]), fit(t[1])];
  return { segs, tips, r };
}

const line = ([x0, y0, x1, y1]) => `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)}`;
/** Segments grouped by width so each width is one path. */
function byWidth(segs, widen = 0, dx = 0, dy = 0, maxDepth = 9) {
  const groups = new Map();
  for (const s of segs) {
    if (s[5] > maxDepth) continue;
    const w = f(s[4] + widen);
    if (w <= 0) continue;
    const d = line([s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy]);
    groups.set(w, (groups.get(w) ?? '') + d + ' ');
  }
  return [...groups].map(([w, d]) => [w, d.trim()]);
}
const paths = (groups, color, extra = '') => groups.map(([w, d]) => `<path d="${d}" stroke="${color}" stroke-width="${w}"${extra} />`).join('');

/**
 * One bare tree. `kind`: 'bare' (late fall), 'leaves' (a few last leaves), 'snow' (winter).
 */
export function bareTree(kind, seed = 7) {
  const { segs, tips, r } = branches(seed);
  const shadow = paths(byWidth(segs, 0.6, 7, 9), '#000');
  const ink = paths(byWidth(segs.map((s) => [...s.slice(0, 4), s[4] + (s[4] > 3 ? 2.2 : 1.3), s[5]])), '#2a2019');
  const wood = paths(byWidth(segs), '#6e5745');
  // Light from the top-left: a lighter streak along the upper side of the bigger limbs.
  const lit = paths(byWidth(segs.map((s) => [...s.slice(0, 4), s[4] * 0.38, s[5]]), 0, -s0(segs), -s0(segs), 2), '#a3876d');
  let top = '';
  if (kind === 'snow') {
    // Snow lies along the tops of the limbs, thickest on the big ones, and heaped in the fork at the trunk.
    top += paths(byWidth(segs.filter((s) => s[5] < 2 || r() < 0.6).map((s) => [...s.slice(0, 4), Math.max(0.8, s[4] * 0.5), s[5]]), 0, -0.9, -1, 3), '#f4f8ff');
    top += paths(byWidth(segs.map((s) => [...s.slice(0, 4), s[4] * 0.25, s[5]]), 0, -1.1, -1.2, 1), '#ffffff');
    top += '<ellipse cx="63.4" cy="63.4" rx="6.5" ry="5.8" fill="#eef4fc" stroke="#2a2019" stroke-width="1.6" /><ellipse cx="62" cy="62" rx="3" ry="2.4" fill="#ffffff" />';
  } else {
    top += '<circle cx="64" cy="64" r="6" fill="#5e4a3a" stroke="#2a2019" stroke-width="1.8" /><circle cx="64" cy="64" r="3.2" fill="none" stroke="#7d6450" stroke-width="1" /><path d="M59 60.5 Q61 58.5 64 58.3" stroke="#a3876d" stroke-width="1.4" fill="none" stroke-linecap="round" />';
  }
  if (kind === 'leaves') {
    // A few last leaves hanging on at the twig ends.
    const cols = ['#d9792b', '#e8a23a', '#b9532a', '#f0c25a'];
    top += tips.filter(() => r() < 0.3).map(([x, y], i) => `<ellipse cx="${f(x + (r() - 0.5) * 3)}" cy="${f(y + (r() - 0.5) * 3)}" rx="2.4" ry="1.6" transform="rotate(${Math.round(r() * 180)} ${f(x)} ${f(y)})" fill="${cols[i % 4]}" stroke="#2a2019" stroke-width="0.7" />`).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><filter id="bShB" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter></defs>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<g opacity="0.3" filter="url(#bShB)">${shadow}</g>
${ink}${wood}${lit}
${top}
</g></svg>
`;
}
const s0 = () => 0.7;
