// "Nests: growing and merging" board: the game as it is (screenshots), and three directions drawn at map scale.
import fs from 'node:fs';
const [repo, out, shots] = process.argv.slice(2);
const art = (p) => `data:image/svg+xml;base64,${fs.readFileSync(`${repo}/src/art/${p}`).toString('base64')}`;
const T = 20; // pixels a tile
const f = (n) => Math.round(n * 10) / 10;
const INK = '#24180e';
let rnd = 7;
const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };

const DEFS = `<defs>
<pattern id="gr" width="${T}" height="${T}" patternUnits="userSpaceOnUse"><image href="${art('terrain/ground.svg')}" width="${T}" height="${T}" /></pattern>
<image id="mound" href="${art('nests/warren.svg')}" width="128" height="128" />
<image id="grown" href="${art('nests/grown.svg')}" width="128" height="128" />
<radialGradient id="bl"><stop offset="0" stop-color="rgb(110,90,52)" stop-opacity="0.75" /><stop offset="0.5" stop-color="rgb(138,122,66)" stop-opacity="0.45" /><stop offset="1" stop-color="rgb(122,122,64)" stop-opacity="0" /></radialGradient>
<filter id="soft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${20 * T + 200}" height="${20 * T + 200}"><feGaussianBlur stdDeviation="${T * 0.5}" /></filter>
<filter id="hollow" x="-30%" y="-30%" width="160%" height="160%">
<feMorphology in="SourceAlpha" operator="dilate" radius="${0.32 * T}" result="rimA" />
<feMorphology in="SourceAlpha" operator="dilate" radius="${0.32 * T + 1.6}" result="inkA" />
<feOffset in="inkA" dx="${0.14 * T}" dy="${0.2 * T}" result="dropA" />
<feFlood flood-color="#000" flood-opacity="0.28" /><feComposite in2="dropA" operator="in" result="drop" />
<feFlood flood-color="#24180e" /><feComposite in2="inkA" operator="in" result="ink" />
<feFlood flood-color="#7a5a38" /><feComposite in2="rimA" operator="in" result="rim" />
<feOffset in="rimA" dx="${-0.1 * T}" dy="${-0.12 * T}" result="rimShift" />
<feComposite in="rimA" in2="rimShift" operator="out" result="rimLowA" />
<feFlood flood-color="#4e3a26" /><feComposite in2="rimLowA" operator="in" result="rimLow" />
<feOffset in="SourceAlpha" dx="${0.3 * T}" dy="${0.42 * T}" result="sh" />
<feComposite in="SourceAlpha" in2="sh" operator="out" result="shA" />
<feGaussianBlur in="shA" stdDeviation="1.5" result="shB" />
<feFlood flood-color="#000" flood-opacity="0.55" /><feComposite in2="shB" operator="in" /><feComposite in2="SourceAlpha" operator="in" result="shadow" />
<feOffset in="SourceAlpha" dx="${-0.16 * T}" dy="${-0.2 * T}" result="li" />
<feComposite in="SourceAlpha" in2="li" operator="out" result="liA" />
<feFlood flood-color="#8a6a44" flood-opacity="0.5" /><feComposite in2="liA" operator="in" result="light" />
<feMerge><feMergeNode in="drop" /><feMergeNode in="ink" /><feMergeNode in="rim" /><feMergeNode in="rimLow" /><feMergeNode in="SourceGraphic" /><feMergeNode in="light" /><feMergeNode in="shadow" /></feMerge>
</filter>
<filter id="fume" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
<radialGradient id="egg" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#fff6dc" /><stop offset="0.6" stop-color="#e6d3a2" /><stop offset="1" stop-color="#b59c66" /></radialGradient>
</defs>`;

const blight = (cx, cy, rad = 5.5) => `<circle cx="${f(cx * T)}" cy="${f(cy * T)}" r="${f(rad * T)}" fill="url(#bl)" />`;
const mound = (cx, cy, size, stage = 1) => {
  const k = (size * T) / 128, x = (cx - size / 2) * T, y = (cy - size / 2) * T;
  let s = `<use href="#mound" transform="translate(${f(x)} ${f(y)}) scale(${f(k * 1000) / 1000})" />`;
  if (stage >= 2) s += `<use href="#grown" transform="translate(${f(x)} ${f(y)}) scale(${f(k * 1000) / 1000})" />`;
  if (stage >= 3) s += `<use href="#grown" transform="rotate(180 ${f(cx * T)} ${f(cy * T)}) translate(${f(x)} ${f(y)}) scale(${f(k * 1000) / 1000})" />`;
  return s;
};
const moundSize = (stage, merged) => 2 * (0.7 + 0.15 * stage) * (merged ? 1.3 : 1);
/** A smooth path through points, in tiles. */
const smooth = (pts) => {
  let d = `M${f(pts[0][0] * T)} ${f(pts[0][1] * T)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    // Bend each leg a little to one side.
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.18 * (i % 2 ? 1 : -1), my = (y0 + y1) / 2 - (x1 - x0) * 0.18 * (i % 2 ? 1 : -1);
    d += ` Q${f(mx * T)} ${f(my * T)} ${f(x1 * T)} ${f(y1 * T)}`;
  }
  return d;
};

// A · Tunnels and vents.
const ridge = (pts) => {
  const d = smooth(pts);
  return `<path d="${d}" stroke="#000" stroke-width="${f(0.62 * T)}" opacity="0.3" transform="translate(${0.12 * T} ${0.18 * T})" /><path d="${d}" stroke="${INK}" stroke-width="${f(0.62 * T)}" /><path d="${d}" stroke="#6b4a2e" stroke-width="${f(0.48 * T)}" /><path d="${d}" stroke="#a88660" stroke-width="${f(0.13 * T)}" opacity="0.7" transform="translate(${-0.08 * T} ${-0.1 * T})" />`;
};
const blightAlong = (pts) => `<path d="${smooth(pts)}" stroke="rgb(124,104,58)" stroke-width="${f(2.6 * T)}" opacity="0.45" filter="url(#soft)" />`;
const vent = (cx, cy, s = 0.95) => mound(cx, cy, s);

// B · Creep: a dark organic mat, as overlapping lobes.
function creep(lobes, eggs) {
  let ink = '', fill = '', veins = '', sacs = '';
  for (const [cx, cy, rad] of lobes) {
    for (let q = 0; q < 6; q++) {
      const a = (q / 6) * Math.PI * 2 + r();
      const rr = rad * (0.45 + r() * 0.25), ox = cx + Math.cos(a) * rad * 0.45, oy = cy + Math.sin(a) * rad * 0.45;
      const c = `<circle cx="${f(ox * T)}" cy="${f(oy * T)}" r="${f(rr * T)}"`;
      ink += `${c} />`;
      fill += `${c} />`;
    }
    const c = `<circle cx="${f(cx * T)}" cy="${f(cy * T)}" r="${f(rad * 0.6 * T)}"`;
    ink += `${c} />`;
    fill += `${c} />`;
    for (let q = 0; q < 5; q++) {
      const a = r() * Math.PI * 2, l = rad * (0.6 + r() * 0.35);
      veins += `<path d="M${f(cx * T)} ${f(cy * T)} q${f(Math.cos(a + 0.5) * l * 0.5 * T)} ${f(Math.sin(a + 0.5) * l * 0.5 * T)} ${f(Math.cos(a) * l * T)} ${f(Math.sin(a) * l * T)}" />`;
    }
  }
  for (const [cx, cy, n] of eggs)
    for (let q = 0; q < n; q++) {
      const a = r() * Math.PI * 2, d = 0.35 + r() * 0.5;
      sacs += `<ellipse cx="${f((cx + Math.cos(a) * d) * T)}" cy="${f((cy + Math.sin(a) * d) * T)}" rx="${f(0.2 * T)}" ry="${f(0.15 * T)}" fill="url(#egg)" stroke="${INK}" stroke-width="0.8" />`;
    }
  return `<g fill="none" stroke="${INK}" stroke-width="3">${ink}</g><g fill="#3a2632">${fill}</g><g fill="none" stroke="#6d4a5c" stroke-width="1.6" stroke-linecap="round" opacity="0.8">${veins}</g><g fill="#4a3240" opacity="0.6">${''}</g>${sacs}`;
}

// C · Daughter mounds and worn trails.
const trail = (pts) => `<path d="${smooth(pts)}" stroke="#a8956a" stroke-width="${f(0.55 * T)}" opacity="0.55" /><path d="${smooth(pts)}" stroke="#7a6a48" stroke-width="${f(0.12 * T)}" opacity="0.5" stroke-dasharray="${0.2 * T} ${0.35 * T}" />`;
const cone = (cx, cy, s = 0.8) => `<ellipse cx="${f((cx + 0.1) * T)}" cy="${f((cy + 0.15) * T)}" rx="${f(s * 0.55 * T)}" ry="${f(s * 0.45 * T)}" fill="#000" opacity="0.3" /><ellipse cx="${f(cx * T)}" cy="${f(cy * T)}" rx="${f(s * 0.5 * T)}" ry="${f(s * 0.42 * T)}" fill="#7a5a38" stroke="${INK}" stroke-width="1.6" /><path d="M${f((cx - s * 0.32) * T)} ${f((cy - s * 0.08) * T)} q${f(s * 0.15 * T)} ${f(-s * 0.25 * T)} ${f(s * 0.42 * T)} ${f(-s * 0.26 * T)}" stroke="#a88660" stroke-width="1.6" fill="none" stroke-linecap="round" /><circle cx="${f(cx * T)}" cy="${f(cy * T)}" r="${f(s * 0.16 * T)}" fill="#120c07" />`;

// The scenes: where cells and mounds sit in a 20×20-tile view.
const SCENES = [
  { name: 'Small', stage: 1, main: [10, 10], cells: [] },
  { name: 'Medium', stage: 2, main: [10, 10], cells: [] },
  { name: 'Large', stage: 3, main: [10, 10], cells: [] },
  { name: 'Merged, 2 cells', stage: 3, main: [5, 10], cells: [[15.5, 9.5]] },
  { name: 'Merged, 4 cells', stage: 3, main: [5, 5], cells: [[15, 5.5], [5.5, 15], [15.5, 15.5]] },
];
const ring = (c, n, rad, a0 = 0.6) => Array.from({ length: n }, (_, i) => [c[0] + Math.cos(a0 + (i / n) * Math.PI * 2) * rad, c[1] + Math.sin(a0 + (i / n) * Math.PI * 2) * rad * 0.85]);

function panel(look, sc) {
  rnd = 11;
  const merged = sc.cells.length > 0;
  const [mx, my] = sc.main;
  let under = '', over = '';
  if (look === 'A') {
    const vents = sc.stage >= 2 ? ring(sc.main, sc.stage === 2 ? 1 : 2, 3.2, 0.5) : [];
    for (const c of sc.cells) vents.push(c);
    under += blight(mx, my, 4.5);
    for (const v of vents) {
      const far = sc.cells.includes(v);
      const path = [[mx, my], [(mx + v[0]) / 2 + (v[1] - my) * 0.12, (my + v[1]) / 2 - (v[0] - mx) * 0.12], v];
      under += blightAlong(path) + blight(v[0], v[1], far ? 3.5 : 2);
      over += `<g fill="none" stroke-linecap="round">${ridge(path)}</g>`;
    }
    for (const v of vents) over += vent(v[0], v[1], sc.cells.includes(v) ? 1.3 : 0.95);
  } else if (look === 'B') {
    const rad = [0, 1.7, 2.6, 3.4][sc.stage];
    const lobes = [[mx, my, rad]];
    const eggs = sc.stage >= 2 ? ring(sc.main, sc.stage === 2 ? 2 : 4, rad * 0.75, 1).map(([x, y]) => [x, y, 4]) : [];
    for (const c of sc.cells) {
      lobes.push([c[0], c[1], 2.8]);
      eggs.push([c[0], c[1], 6]);
      // Bridges of creep between the cells.
      for (let t = 0.25; t < 0.8; t += 0.25) lobes.push([mx + (c[0] - mx) * t + (r() - 0.5), my + (c[1] - my) * t + (r() - 0.5), 1.6]);
    }
    under += blight(mx, my, 5.5);
    for (const c of sc.cells) under += blight(c[0], c[1], 5);
    under += creep(lobes, eggs);
  } else {
    const kids = sc.stage >= 2 ? ring(sc.main, sc.stage === 2 ? 2 : 4, 3, 0.3) : [];
    under += blight(mx, my, 4.5);
    for (const k of kids) under += `<g fill="none" stroke-linecap="round">${trail([[mx, my], k])}</g>`;
    for (const c of sc.cells) {
      const path = [[mx, my], [(mx + c[0]) / 2 + (c[1] - my) * 0.1, (my + c[1]) / 2 - (c[0] - mx) * 0.1], c];
      under += blightAlong(path) + blight(c[0], c[1], 4);
      under += `<g fill="none" stroke-linecap="round">${trail(path)}</g>`;
      for (const k of ring(c, 2, 1.8, 2)) under += `<g fill="none" stroke-linecap="round">${trail([c, k])}</g>`;
    }
    for (const k of kids) over += cone(k[0], k[1], 0.95);
    for (const c of sc.cells) {
      over += mound(c[0], c[1], 1.5);
      for (const k of ring(c, 2, 1.8, 2)) over += cone(k[0], k[1], 0.75);
    }
  }
  over += mound(mx, my, moundSize(sc.stage, merged), sc.stage);
  return `<svg width="${20 * T}" height="${20 * T}" viewBox="0 0 ${20 * T} ${20 * T}" style="border-radius: 8px; display: block"><rect width="${20 * T}" height="${20 * T}" fill="url(#gr)" />${under}${over}</svg>`;
}


// Ways of showing the link between burrows without raised tunnels. Each follows the same gentle curve.
const curve = (a, b) => {
  const c = [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.12];
  return (t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
};
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const curvePath = (a, b) => { const c = [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.12]; return `M${f(a[0] * T)} ${f(a[1] * T)} Q${f(c[0] * T)} ${f(c[1] * T)} ${f(b[0] * T)} ${f(b[1] * T)}`; };
function holes(a, b) {
  const at = curve(a, b), n = Math.max(2, Math.round(len(a, b) / 1.1));
  let s = '';
  for (let i = 1; i < n; i++) {
    const [x, y] = at(i / n + (r() - 0.5) * 0.05);
    const rr = 0.13 + r() * 0.07;
    s += `<ellipse cx="${f((x + 0.05) * T)}" cy="${f((y + 0.07) * T)}" rx="${f((rr + 0.1) * T)}" ry="${f((rr + 0.07) * T)}" fill="#6b4a2e" stroke="${INK}" stroke-width="1" /><ellipse cx="${f(x * T)}" cy="${f(y * T)}" rx="${f(rr * T)}" ry="${f(rr * 0.8 * T)}" fill="#120c07" /><path d="M${f((x + rr * 0.2) * T)} ${f((y + rr * 0.9) * T)} q${f(rr * 0.6 * T)} 0 ${f(rr * 0.9 * T)} ${f(-rr * 0.6 * T)}" stroke="#a88660" stroke-width="1.2" fill="none" stroke-linecap="round" />`;
  }
  return s;
}
function spoil(a, b) {
  const at = curve(a, b), n = Math.round(len(a, b) * 2.2);
  let s = '';
  for (let i = 1; i < n; i++) {
    const [x0, y0] = at(i / n);
    const x = x0 + (r() - 0.5) * 0.7, y = y0 + (r() - 0.5) * 0.7, sz = (0.12 + r() * 0.16) * T;
    const pts = Array.from({ length: 6 }, (_, q) => { const ang = (q / 6) * Math.PI * 2; const rq = sz * (0.7 + r() * 0.4); return `${f(x * T + Math.cos(ang) * rq)} ${f(y * T + Math.sin(ang) * rq * 0.8)}`; });
    s += `<path d="M${pts.join(' L')} Z" fill="${r() < 0.3 ? '#5e4630' : '#7a5a38'}" stroke="${INK}" stroke-width="1" stroke-linejoin="round" /><path d="M${f(x * T - sz * 0.5)} ${f(y * T - sz * 0.2)} q${f(sz * 0.3)} ${f(-sz * 0.4)} ${f(sz * 0.8)} ${f(-sz * 0.35)}" stroke="#a88660" stroke-width="1" fill="none" stroke-linecap="round" />`;
  }
  return s;
}
function cracks(a, b) {
  const at = curve(a, b), n = Math.round(len(a, b) * 3);
  let main = `M${f(a[0] * T)} ${f(a[1] * T)}`, side = '';
  for (let i = 1; i <= n; i++) {
    const [x, y] = at(i / n);
    const jx = i < n ? (r() - 0.5) * 0.35 : 0, jy = i < n ? (r() - 0.5) * 0.35 : 0;
    main += ` L${f((x + jx) * T)} ${f((y + jy) * T)}`;
    if (i < n && r() < 0.4) { const ang = r() * Math.PI * 2, l = (0.3 + r() * 0.5) * T; side += `M${f((x + jx) * T)} ${f((y + jy) * T)} l${f(Math.cos(ang) * l)} ${f(Math.sin(ang) * l)} l${f(Math.cos(ang + 0.6) * l * 0.5)} ${f(Math.sin(ang + 0.6) * l * 0.5)} `; }
  }
  return `<path d="${curvePath(a, b)}" stroke="#8a7a50" stroke-width="${f(1.1 * T)}" opacity="0.35" fill="none" stroke-linecap="round" /><path d="${main}" stroke="#a88660" stroke-width="3.4" fill="none" stroke-linejoin="round" opacity="0.6" transform="translate(-0.8 -0.8)" /><path d="${main}" stroke="#1e140c" stroke-width="2.2" fill="none" stroke-linejoin="round" /><path d="${side}" stroke="#1e140c" stroke-width="1.2" fill="none" stroke-linecap="round" />`;
}
function tracks(a, b) {
  const at = curve(a, b), n = Math.round(len(a, b) * 4);
  let feet = '';
  for (let i = 1; i < n; i++) {
    const [x, y] = at(i / n), [x2, y2] = at(Math.min(1, i / n + 0.01));
    const ang = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(ang), ny = Math.cos(ang);
    for (const side of [-1, 1]) {
      const fx = x + nx * side * 0.14 + (r() - 0.5) * 0.06, fy = y + ny * side * 0.14 + (r() - 0.5) * 0.06;
      feet += `<path d="M${f(fx * T)} ${f(fy * T)} l${f(Math.cos(ang + side * 0.6) * 3.2)} ${f(Math.sin(ang + side * 0.6) * 3.2)}" />`;
    }
  }
  return `<path d="${curvePath(a, b)}" stroke="#a8956a" stroke-width="${f(0.75 * T)}" opacity="0.4" fill="none" stroke-linecap="round" /><g stroke="#4a3624" stroke-width="1.2" stroke-linecap="round" opacity="0.75">${feet}</g>`;
}
const LINKS = { D: holes, E: spoil, F: cracks, G: tracks };
function linked(look, sc) {
  rnd = 11;
  const merged = sc.cells.length > 0;
  const [mx, my] = sc.main;
  const vents = sc.stage >= 2 ? ring(sc.main, sc.stage === 2 ? 1 : 2, 3.2, 0.5) : [];
  let under = blight(mx, my, 4.5), links = '', over = '';
  const join = (a, b, far) => {
    under += blightAlong([a, [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.12], b]) + blight(b[0], b[1], far ? 4 : 2);
    links += LINKS[look](a, b);
  };
  for (const v of vents) join(sc.main, v, false);
  for (const c of sc.cells) {
    join(sc.main, c, true);
    // The daughter burrow digs a vent or two of its own.
    for (const k of ring(c, 2, 2, 2)) join(c, k, false);
  }
  for (const v of vents) over += vent(v[0], v[1], 0.95);
  for (const c of sc.cells) {
    over += mound(c[0], c[1], 1.5);
    for (const k of ring(c, 2, 2, 2)) over += vent(k[0], k[1], 0.8);
  }
  over += mound(mx, my, moundSize(sc.stage, merged), sc.stage);
  return `<svg width="${20 * T}" height="${20 * T}" viewBox="0 0 ${20 * T} ${20 * T}" style="border-radius: 8px; display: block"><rect width="${20 * T}" height="${20 * T}" fill="url(#gr)" />${under}${links}${over}</svg>`;
}

// H and I: the nest as a sunken hollow with a rim of thrown-up earth, joining into one shape when nests merge,
// and fumes rising from its burrows.
let hid = 0;
const blobPath = (cx, cy, rad) => {
  const n = 14, pts = [];
  for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI * 2; const rr = rad * (0.9 + r() * 0.2); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]); }
  let d = '';
  for (let q = 0; q < n; q++) { const p = pts[q], nx = pts[(q + 1) % n]; const m = [(p[0] + nx[0]) / 2, (p[1] + nx[1]) / 2]; if (!q) d += `M${f((pts[n - 1][0] + p[0]) / 2 * T)} ${f((pts[n - 1][1] + p[1]) / 2 * T)} `; d += `Q${f(p[0] * T)} ${f(p[1] * T)} ${f(m[0] * T)} ${f(m[1] * T)} `; }
  return d + 'Z';
};
function hollow(parts) {
  // The pieces filled as one shape; a filter then shades that shape as a whole: a rim of thrown-up earth round
  // it with an ink edge, a shadow inside its top-left where the rim blocks the light, the far wall lit.
  const all = parts.map(([x, y, rad]) => `<path d="${blobPath(x, y, rad)}" />`).join('');
  return `<g fill="#35271a" filter="url(#hollow)">${all}</g>`;
}
function fumes(x, y, size) {
  let s = '';
  for (let q = 0; q < 7; q++) {
    const t = q / 6;
    const px = x + t * size * 1.1 + Math.sin(q * 1.7) * 0.25 * size, py = y - t * size * 2.4;
    const rx = (0.35 + t * 0.9) * size, ry = (0.3 + t * 0.6) * size;
    s += `<ellipse cx="${f(px * T)}" cy="${f(py * T)}" rx="${f(rx * T)}" ry="${f(ry * T)}" fill="#e9e4cc" opacity="${f((0.55 - t * 0.4) * 100) / 100}" />`;
  }
  return `<g filter="url(#fume)">${s}</g>`;
}
function sunken(look, sc) {
  rnd = 13;
  const merged = sc.cells.length > 0;
  const [mx, my] = sc.main;
  const R = [0, 1.7, 2.3, 2.9][sc.stage];
  const vents = sc.stage >= 2 ? ring(sc.main, sc.stage === 2 ? 1 : 2, R * 0.85, 0.5) : [];
  const parts = [[mx, my, R], ...vents.map(([x, y]) => [x, y, 1.15])];
  for (const c of sc.cells) {
    if (look === 'H') {
      parts.push([c[0], c[1], 1.9]);
      const at = curve(sc.main, c), n = Math.ceil(len(sc.main, c) / 0.7);
      for (let i = 1; i < n; i++) { const [x, y] = at(i / n); parts.push([x, y, 0.75]); }
    } else {
      // One crater: the cells' hollows swell into each other along wide lobes.
      parts.push([c[0], c[1], 2.6]);
      const at = curve(sc.main, c), n = Math.ceil(len(sc.main, c) / 1.6);
      for (let i = 1; i < n; i++) { const [x, y] = at(i / n); parts.push([x + (r() - 0.5) * 0.8, y + (r() - 0.5) * 0.8, 1.6 + r() * 0.7]); }
    }
  }
  let s = blight(mx, my, R + 3.2);
  for (const c of sc.cells) s += blight(c[0], c[1], 4.5);
  s += hollow(parts);
  for (const v of vents) s += vent(v[0], v[1], 0.95);
  for (const c of sc.cells) { s += mound(c[0], c[1], 1.5); if (look === 'H') for (const k of ring(c, 1, 1.1, 2.3)) s += vent(k[0], k[1], 0.75); }
  s += mound(mx, my, moundSize(sc.stage, merged), sc.stage);
  // Fumes: H vents through every burrow, I gathers it into one big plume.
  if (look === 'H') {
    s += fumes(mx + 0.2, my - 0.3, 0.55 + 0.2 * sc.stage);
    for (const c of sc.cells) s += fumes(c[0] + 0.1, c[1] - 0.2, 0.45);
  } else {
    s += fumes(mx + 0.2, my - 0.3, (0.55 + 0.2 * sc.stage) * (merged ? 1 + 0.25 * sc.cells.length : 1));
  }
  return `<svg width="${20 * T}" height="${20 * T}" viewBox="0 0 ${20 * T} ${20 * T}" style="border-radius: 8px; display: block; overflow: hidden"><rect width="${20 * T}" height="${20 * T}" fill="url(#gr)" />${s}</svg>`;
}

const shotImg = (name) => {
  const p = `${shots}/${name}.jpg`;
  return fs.existsSync(p) ? `<img src="data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}" width="${20 * T}" height="${20 * T * 6 / 7}" style="border-radius: 8px; display: block; object-fit: cover" />` : '';
};
const ROWS = [
  ['Now', 'In the game today. A nest grows only by its burrow getting a little bigger, with eggs. A merged nest\u2019s other cells are just patches of dead grass with nothing in them.', null],
  ['H \u00b7 Hollows and trenches', 'The nest digs itself a hollow, with a rim of thrown-up earth, shaded inside where the rim blocks the light. It widens and puts out lobes with side vents as it grows. A merged nest has a smaller hollow and daughter burrow in each cell it took over, joined to the main one by a sunken trench. Pale fumes rise from every burrow (drifting and fading in the game).', 'H'],
  ['I \u00b7 One crater', 'The same hollow, but merging nests swell into one big lobed crater across their cells. Its fumes gather into one big plume from the main burrow, bigger for each cell the nest owns.', 'I'],
  ['D \u00b7 Breathing holes (last round)', 'For reference.', 'D'],
  ['G \u00b7 Worn track (last round)', 'For reference.', 'G'],
];
const rows = ROWS.map(([title, sub, look]) => `<div style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; gap: 14px"><div style="font-weight: 700; font-size: 20px; color: #ffffff; min-width: 260px">${title}</div><div style="font-size: 14px; color: #a9b6c9; max-width: 1500px">${sub}</div></div>
<div style="display: flex; gap: 12px">${SCENES.map((sc, i) => `<div style="display: flex; flex-direction: column; gap: 6px">${look === 'H' || look === 'I' ? sunken(look, sc) : look ? linked(look, sc) : shotImg(['stage1', 'stage2', 'stage3', 'merged2', 'merged4'][i])}<div style="font-size: 13px; color: #a9b6c9">${sc.name}</div></div>`).join('')}</div></div>`);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Nests growing and merging</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="width: 2240px; min-height: 2600px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 30px">
<svg width="0" height="0" style="position: absolute">${DEFS}</svg>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Nests · proposed, not in the game</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">Nests growing and merging</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1500px">A nest grows from small to medium to large after long calm, and two grown nests whose territories touch can merge into one that owns up to four cells. Today neither shows much. Round 3, after your concepts: the nest sinks into a hollow that grows and joins up as nests merge, with fumes rising from it, each drawn at map scale on 20 × 20 tiles: one nest at each stage, then a large nest merged over two and four cells (cells are 10 × 10 tiles). The burrow and egg clutches are today's sprites.</p>
</div>
${rows.join('\n')}
</div>
</x-dc>
</body>
</html>`;
fs.writeFileSync(out, html);
console.log('ok', html.length);
