// "Fifth" board: feedback when things happen, bug deaths and tracks, life in the clearing, co-op players,
// screens and icons, and wear over time.
// node docs/art-canvas/ideas/fifth.mjs [repo] [out]
import fs from 'node:fs';
import path from 'node:path';
import { REPO, read, over, make, inner, box, uri, rng, idea, still, play, frames, board, INK, GRASS } from './lib.mjs';

const TAU = Math.PI * 2;
const f1 = (n) => n.toFixed(1);
const four = [0, 1, 2, 3];
const has = (key) => fs.existsSync(path.join(REPO, 'src/art', `${key}.svg`));
const place = (svg, x, y, w, h = w, extra = '') => `<svg x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" viewBox="${box(svg)}" overflow="visible" ${extra}>${inner(svg)}</svg>`;
const tiles = (w, h, key = 'terrain/ground') => {
  const g = read(key);
  let s = '';
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) s += place(g, x, y, 64);
  return s;
};
const centred = (svg, k, dx = 0, dy = 0, rot = 0, extra = '') => {
  const [, , w, h] = box(svg).split(' ').map(Number);
  return `<g transform="translate(${f1(w / 2 + dx)} ${f1(h / 2 + dy)}) rotate(${rot}) scale(${f1(k)}) translate(${-w / 2} ${-h / 2})" ${extra}>${inner(svg)}</g>`;
};

// ===== Feedback =====
const furnace = read('buildings/furnace');
const FV = Number(box(furnace).split(' ')[2]);
// Construction: a timber frame goes up, the building fills in from the bottom, bolts flash as it's finished.
const build = [0, 0.3, 0.6, 0.9, 1].map((t, i) => {
  const frame = `<g fill="none" stroke="#c08a52" stroke-width="${FV / 40}" opacity="${f1(1 - t * 0.8)}"><rect x="${FV * 0.08}" y="${FV * 0.08}" width="${FV * 0.84}" height="${FV * 0.84}" stroke-dasharray="${FV / 12} ${FV / 24}" /></g>`;
  const fill = `<defs><clipPath id="bc"><rect x="0" y="${f1(FV * (1 - t))}" width="${FV}" height="${f1(FV * t)}" /></clipPath></defs><g clip-path="url(#bc)">${inner(furnace)}</g>`;
  const bolts = i === 4 ? [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([x, y]) => `<circle cx="${FV * x}" cy="${FV * y}" r="${FV / 18}" fill="#fff4c0" opacity="0.8" /><path d="M${FV * x - FV / 12} ${FV * y} h${FV / 6} M${FV * x} ${FV * y - FV / 12} v${FV / 6}" stroke="#ffffff" stroke-width="${FV / 60}" />`).join('') : '';
  const edge = t > 0 && t < 1 ? `<path d="M${FV * 0.06} ${f1(FV * (1 - t))} H${FV * 0.94}" stroke="#f2c14e" stroke-width="${FV / 50}" />` : '';
  return make(box(furnace), `<rect x="${FV * 0.06}" y="${FV * 0.06}" width="${FV * 0.88}" height="${FV * 0.88}" rx="${FV / 20}" fill="#5a4630" opacity="0.5" />${t > 0 ? fill : ''}${frame}${edge}${bolts}`);
});
// Demolish: the building drops and crumbles into a burst of dust and bits.
const demolish = four.map((i) => {
  const r = rng(3);
  const t = i / 3;
  let s = i < 3 ? centred(furnace, 1 - t * 0.35, 0, t * FV * 0.05, 0, `opacity="${f1(1 - t * 0.8)}"`) : '';
  for (let k = 0; k < 14; k++) {
    const a = r() * TAU, d = FV * (0.15 + t * 0.4) * (0.5 + r() * 0.5);
    s += `<circle cx="${f1(FV / 2 + d * Math.cos(a))}" cy="${f1(FV / 2 + d * Math.sin(a))}" r="${f1(FV * (0.05 + t * 0.06) * (0.5 + r()))}" fill="#b9ad98" opacity="${f1(0.75 - t * 0.5)}" />`;
    if (k < 8) s += `<rect x="${f1(FV / 2 + d * 0.9 * Math.cos(a + 0.4))}" y="${f1(FV / 2 + d * 0.9 * Math.sin(a + 0.4))}" width="${FV / 18}" height="${FV / 26}" fill="#a0553a" stroke="${INK}" stroke-width="${FV / 160}" transform="rotate(${f1(r() * 360)} ${FV / 2} ${FV / 2})" />`;
  }
  return make(box(furnace), s);
});
// Deliveries: an item arcs into the hub and pops, and a blue pulse when research finishes.
const hub = read('buildings/hub');
const HV = Number(box(hub).split(' ')[2]);
const plate = read('items/iron_plate');
const delivery = four.map((i) => {
  const t = i / 3;
  const x = HV * (1.12 - 0.62 * t), y = HV * (0.75 - 0.45 * Math.sin(t * Math.PI) - 0.25 * t);
  let s = place(hub, 0, 0, HV);
  if (i < 3) s += `<ellipse cx="${f1(x)}" cy="${f1(HV * 0.92)}" rx="${HV * 0.05}" ry="${HV * 0.02}" fill="#000" opacity="0.25" />` + place(plate, x - HV * 0.11, y - HV * 0.11, HV * 0.22);
  else s += `<circle cx="${HV / 2}" cy="${HV / 2}" r="${HV * 0.12}" fill="none" stroke="#ffd36b" stroke-width="${HV / 60}" /><text x="${HV / 2 + HV * 0.1}" y="${HV / 2 - HV * 0.12}" font-family="Montserrat, sans-serif" font-weight="800" font-size="${HV * 0.12}" fill="#ffffff" stroke="${INK}" stroke-width="${HV / 160}">+1</text>`;
  return make(`0 0 ${HV * 1.3} ${HV}`, s);
});
const research = four.map((i) => {
  const t = i / 4;
  return make(box(hub), inner(hub) + [0, 0.5].map((o) => { const u = (t + o) % 1; return `<circle cx="${HV / 2}" cy="${HV / 2}" r="${f1(HV * (0.15 + u * 0.4))}" fill="none" stroke="#7cc4ff" stroke-width="${f1(HV / 40 * (1 - u))}" opacity="${f1(0.9 - u * 0.8)}" />`; }).join('') + (i === 0 ? `<circle cx="${HV / 2}" cy="${HV / 2}" r="${HV * 0.1}" fill="#bfe4ff" opacity="0.6" />` : ''));
});
// Turrets: a lock-on mark closing on the bug being aimed at; a low-ammo blink on the ammo box.
const crawler = read('enemies/crawler');
const lockOn = four.map((i) => {
  const g = [14, 10, 7, 6][i];
  const col = i === 3 ? '#ff4a3a' : '#f2c14e';
  const b = (sx, sy) => `<path d="M${32 + sx * g} ${32 + sy * (g - 5)} V${32 + sy * g} H${32 + sx * (g - 5)}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" />`;
  return make('0 0 64 64', inner(crawler) + `<g transform="rotate(${i * 15} 32 32)">${b(-1, -1)}${b(1, -1)}${b(1, 1)}${b(-1, 1)}</g>` + (i === 3 ? `<circle cx="32" cy="32" r="1.6" fill="${col}" />` : ''));
});
const turret = make('0 0 64 64', inner(read('buildings/turret_base')) + inner(read('buildings/turret_barrel')));
const lowAmmo = [0, 1].map((on) => over(turret, on ? `<rect x="11" y="21" width="16" height="22" rx="4" fill="#ff3a2a" opacity="0.45" /><rect x="14" y="24" width="10" height="16" rx="2" fill="none" stroke="#ff5a4a" stroke-width="2" /><text x="19" y="54" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="9" fill="#ff5a4a" stroke="${INK}" stroke-width="0.6">!</text>` : ''));
// Raids: a red glow along the map's edge and a turning siren light on the hub.
const raid = four.map((i) => {
  const pulse = [0.25, 0.45, 0.6, 0.4][i];
  const a = i * 90;
  return make('0 0 320 200', `<defs><linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2a1a" stop-opacity="${pulse}" /><stop offset="1" stop-color="#ff2a1a" stop-opacity="0" /></linearGradient></defs>` + tiles(320, 200) + `<rect width="320" height="70" fill="url(#edge)" />` + place(hub, 110, 70, 100) +
    `<g transform="rotate(${a} 160 120)"><path d="M160 120 L240 96 L240 144 Z" fill="#ff5a3a" opacity="0.3" /></g><circle cx="160" cy="120" r="6" fill="#ff5a3a" stroke="${INK}" stroke-width="1.5" /><circle cx="160" cy="120" r="2.5" fill="#ffd0c0" />` +
    [40, 120, 230, 290].map((x, k) => place(read(`enemies/${['crawler', 'runner', 'brute', 'crawler'][k]}`), x, 6 + (k % 2) * 8, 22, 22, `opacity="${f1(0.5 + pulse)}"`)).join(''));
});
// Ship: fireworks when a stage is finished, and countdown lights round the pad before launch.
const shipStack = make('0 0 192 192', place(read('buildings/ship_pad'), 0, 0, 192) + ['ship_engine', 'ship_hull', 'ship_life', 'ship_nav'].map((k) => inner(read(`buildings/${k}`))).join(''));
const fireworks = four.map((i) => {
  const r = rng(17);
  let s = inner(shipStack);
  for (const [cx, cy, col, o] of [[50, 50, '#ffd36b', 0], [140, 60, '#7cc4ff', 1], [100, 140, '#ff7a6a', 2]]) {
    const t = ((i + o) % 4) / 3;
    if (t === 0) { s += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff" />`; continue; }
    s += `<circle cx="${cx}" cy="${cy}" r="${f1(10 + t * 30)}" fill="${col}" opacity="${f1(0.25 - t * 0.2)}" />`; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; const d = 8 + t * 34; s += `<path d="M${f1(cx + d * 0.6 * Math.cos(a))} ${f1(cy + d * 0.6 * Math.sin(a) + t * t * 8)} L${f1(cx + d * Math.cos(a))} ${f1(cy + d * Math.sin(a) + t * t * 8)}" stroke="${col}" stroke-width="${f1(3.6 - t * 2)}" stroke-linecap="round" opacity="${f1(1 - t * 0.6)}" /><circle cx="${f1(cx + d * Math.cos(a))}" cy="${f1(cy + d * Math.sin(a) + t * t * 8)}" r="${f1(2.6 - t)}" fill="#ffffff" opacity="${f1(1 - t * 0.6)}" />`; }
  }
  for (let k = 0; k < 12; k++) s += `<rect x="${f1(r() * 192)}" y="${f1((r() * 192 + i * 20) % 192)}" width="7" height="4" fill="${['#f2c14e', '#3fa9f5', '#ff7a6a', '#6ee07a'][k % 4]}" transform="rotate(${f1(r() * 180 + i * 40)} ${f1(r() * 192)} ${f1(r() * 192)})" />`;
  return make('0 0 192 192', s);
});
const countdown = [0, 1, 2, 3, 4].map((n) => {
  const lamps = [[20, 20], [172, 20], [172, 172], [20, 172]];
  return make('0 0 192 192', inner(shipStack) + lamps.map(([x, y], k) => { const on = k < n; const col = n === 4 ? '#6ee07a' : '#ff5a3a'; return (on ? `<circle cx="${x}" cy="${y}" r="12" fill="${col}" opacity="0.35" />` : '') + `<circle cx="${x}" cy="${y}" r="6" fill="${on ? col : '#3a2a28'}" stroke="${INK}" stroke-width="2" />`; }).join(''));
});

// ===== Bugs =====
const wasp = read('enemies/wasp'), beetle = read('enemies/beetle'), brute = read('enemies/brute');
const waspDeath = four.map((i) => make('0 0 64 64', `<ellipse cx="${32 + i * 2}" cy="${36 + i * 2}" rx="${10 - i}" ry="${5 - i * 0.5}" fill="#000" opacity="${0.15 + i * 0.1}" />` + centred(wasp, 1 - i * 0.18, i * 2, i * 1.5, i * 110, `opacity="${f1(1 - i * 0.12)}"`)));
const LEGS = 'M22 17 L19 11 L13 7 M32 16 L33 9 L30 4 M41 22 L46 16 L51 12 M22 47 L19 53 L13 57 M32 48 L33 55 L30 60 M41 42 L46 48 L51 52';
const legHips = [[22, 17, 19, 11, 13, 7], [32, 16, 33, 9, 30, 4], [41, 22, 46, 16, 51, 12], [22, 47, 19, 53, 13, 57], [32, 48, 33, 55, 30, 60], [41, 42, 46, 48, 51, 52]];
const curl = (k) => legHips.map(([hx, hy, kx, ky, fx, fy]) => {
  // Each leg folds in toward the body: the knee pulls in and the foot tucks back under.
  const mid = 32;
  const kx2 = hx + (kx - hx) * (1 - 0.35 * k), ky2 = hy + (ky - hy) * (1 - 0.45 * k);
  const fx2 = kx2 + (fx - kx) * (1 - 0.6 * k) + (hx > 30 ? -3 : 3) * k, fy2 = ky2 + (fy - ky) * (1 - 0.7 * k) + (mid - ky2) * 0.35 * k;
  return `M${hx} ${hy} L${f1(kx2)} ${f1(ky2)} L${f1(fx2)} ${f1(fy2)}`;
}).join(' ');
const UPPER = '<path d="M9 32 Q9 15 26 14.5 Q38 14.5 41 22 L41 32 Z"';
const LOWER = '<path d="M9 32 Q9 49 26 49.5 Q38 49.5 41 42 L41 32 Z"';
const beetleDeath = [
  [0.15, 0, 1, '#ffffff', 1.5],
  [0.55, 8, 0.8, '#7ad0ff', 0],
  [0.85, 15, 0.55, '#1a2a3a', 0],
  [1, 18, 0.35, '#1a2a3a', 0],
].map(([legs, open, light, eye, jerk], i) => {
  let s2 = beetle.split(LEGS).join(curl(legs));
  // The wing cases part at the back, hinged at the collar, showing the dark body beneath.
  s2 = s2.replace(UPPER, `<ellipse cx="27" cy="32" rx="15" ry="11" fill="#141c2a" /><path d="M16 32 H38 M20 27 Q28 25 36 27 M20 37 Q28 39 36 37" stroke="#2a3446" stroke-width="1.4" fill="none" /><path transform="rotate(${-open} 41 30)" d="M9 32 Q9 15 26 14.5 Q38 14.5 41 22 L41 32 Z"`).replace(UPPER.replace('<path', '<path'), '');
  s2 = s2.replace(LOWER, `<path transform="rotate(${open} 41 34)" d="M9 32 Q9 49 26 49.5 Q38 49.5 41 42 L41 32 Z"`);
  // The highlights and spots ride on the upper and lower cases.
  s2 = s2.replace('<path d="M14 23 Q20 16.5 32 17"', `<path transform="rotate(${-open} 41 30)" d="M14 23 Q20 16.5 32 17"`).replace('<path d="M14 37 Q18 44 26 45.5"', `<path transform="rotate(${open} 41 34)" d="M14 37 Q18 44 26 45.5"`).replace('<circle cx="21" cy="21" r="1.4" fill="#ffffff" opacity="0.8" />', open ? '' : '<circle cx="21" cy="21" r="1.4" fill="#ffffff" opacity="0.8" />');
  s2 = s2.replace('<path d="M8.5 32 H41" stroke="#0f1a2e" stroke-width="1.8" />', `<path d="M10 32 Q24 ${32 - open * 0.3} 41 32 Q24 ${32 + open * 0.3} 10 32 Z" fill="#141c2a" stroke="#0f1a2e" stroke-width="1.8" />`);
  s2 = s2.replace('<g fill="#7ad0ff" stroke="#0f1a2e" stroke-width="0.6">', `<g fill="${eye}" stroke="#0f1a2e" stroke-width="0.6">`).replace('<g fill="#ffffff"><circle cx="53" cy="28.5"', `<g fill="#ffffff" opacity="${i < 2 ? 1 : 0}"><circle cx="53" cy="28.5"`);
  // A dull, dusty husk at the end; a jolt on the first frame.
  const dim = `<filter id="bd" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${f1(light)}" /><feComponentTransfer><feFuncR type="linear" slope="${f1(0.55 + light * 0.45)}" /><feFuncG type="linear" slope="${f1(0.55 + light * 0.45)}" /><feFuncB type="linear" slope="${f1(0.55 + light * 0.45)}" /></feComponentTransfer></filter>`;
  const dust = i === 3 ? [[14, 20], [10, 44], [30, 54], [46, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#b9ad98" opacity="0.5" />`).join('') : '';
  return make('0 0 64 64', `<defs>${dim}</defs><g filter="url(#bd)" transform="translate(${jerk} 0)">${inner(s2)}</g>${dust}`);
});
const bruteDeath = four.map((i) => make('0 0 64 64', (i >= 2 ? `<ellipse cx="32" cy="34" rx="${18 + i * 3}" ry="${10 + i * 2}" fill="#4a0e0e" opacity="0.5" />` : '') + `<g transform="translate(32 32) scale(${[1, 1.06, 1.12, 1.15][i]} ${[1, 0.8, 0.6, 0.5][i]}) translate(-32 -32)" filter="${i >= 1 ? 'url(#dk)' : ''}">${inner(brute)}</g><defs><filter id="dk"><feColorMatrix type="matrix" values="${[1, 0.8, 0.6, 0.5][i]} 0 0 0 0  0 ${[1, 0.8, 0.6, 0.5][i]} 0 0 0  0 0 ${[1, 0.8, 0.6, 0.5][i]} 0 0  0 0 0 1 0" /></filter></defs>`));
const tracks = (key, ink, op) => {
  let s = tiles(256, 128, key);
  for (let k = 0; k < 14; k++) {
    const x = 10 + k * 18, y = 64 + Math.sin(k * 0.6) * 22;
    const fade = op * (0.25 + (k / 14) * 0.75);
    for (const side of [-1, 1]) s += `<ellipse cx="${f1(x + side * 2)}" cy="${f1(y + side * 7)}" rx="4" ry="2.6" fill="${ink}" opacity="${f1(fade)}" transform="rotate(20 ${f1(x)} ${f1(y)})" />`;
  }
  return make('0 0 256 128', s + place(crawler, 250, 56 + Math.sin(14 * 0.6) * 22, 26));
};
const eyes = four.map((i) => {
  let s = tiles(320, 160) + `<rect width="320" height="160" fill="#06101e" opacity="0.6" />`;
  for (let x = -20; x < 340; x += 44) s += place(read('terrain/tree_pine'), x, -40, 90, 90, 'opacity="0.95"');
  s += `<rect y="0" width="320" height="60" fill="#06101e" opacity="0.5" />`;
  for (const [x, y, col, o] of [[48, 40, '#ff4a3a', 0], [132, 30, '#ffd36b', 1], [210, 44, '#ff4a3a', 2], [276, 34, '#b6ff6a', 3]]) {
    const open = (i + o) % 4 !== 0;
    s += open ? `<g><circle cx="${x}" cy="${y}" r="7" fill="${col}" opacity="0.18" /><ellipse cx="${x - 4}" cy="${y}" rx="2.2" ry="1.6" fill="${col}" /><ellipse cx="${x + 4}" cy="${y}" rx="2.2" ry="1.6" fill="${col}" /></g>` : `<path d="M${x - 6} ${y} h4 M${x + 2} ${y} h4" stroke="${col}" stroke-width="0.8" opacity="0.5" />`;
  }
  return make('0 0 320 160', s);
});
const chitin = read('items/chitin');
const chitinDrop = four.map((i) => make('0 0 64 64', `<ellipse cx="32" cy="46" rx="${[8, 10, 12, 12][i]}" ry="3" fill="#000" opacity="0.25" />` + `<svg x="16" y="${[4, 18, 22, 24][i]}" width="32" height="32" viewBox="${box(chitin)}">${inner(chitin)}</svg>` + (i === 3 ? `<path d="M40 26 l1.2 -4 l1.2 4 l4 1.2 l-4 1.2 l-1.2 4 l-1.2 -4 l-4 -1.2 Z" fill="#ffffff" />` : '')));

// ===== Life =====
const clouds = four.map((i) => make('0 0 320 200', `<defs><filter id="cs" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" /></filter></defs>` + tiles(320, 200) + place(read('buildings/furnace'), 60, 60, 64) + place(read('buildings/belt'), 124, 76, 32) + place(read('buildings/belt'), 156, 76, 32) +
  `<g filter="url(#cs)" fill="#0a1422" opacity="0.35">${[[40, 50, 70, 35], [220, 140, 90, 40], [300, 40, 60, 30]].map(([x, y, w, h]) => `<ellipse cx="${(x + i * 22) % 380 - 30}" cy="${y}" rx="${w}" ry="${h}" />`).join('')}</g>`));
const bird = four.map((i) => {
  const w = [14, 6, -6, 6][i];
  return make('0 0 32 32', `<path d="M16 16 Q${16 - 7} ${16 - w} 4 ${16 - w * 0.6} M16 16 Q${16 + 7} ${16 - w} 28 ${16 - w * 0.6}" fill="none" stroke="#2a2a30" stroke-width="2.4" stroke-linecap="round" /><ellipse cx="16" cy="16" rx="2" ry="3.4" fill="#3a3a44" /><circle cx="16" cy="12" r="1.6" fill="#3a3a44" />`);
});
const flock = four.map((i) => make('0 0 320 200', tiles(320, 200) + place(crawler, 40, 150, 30) + [[90, 140], [110, 130], [130, 150], [100, 160]].map(([x, y], k) => place(bird[(i + k) % 4], x + i * 40, y - i * 34 - k * 4, 40)).join('')));
const rabbit = four.map((i) => {
  const hop = [0, -4, -6, -2][i];
  const stretch = [1, 1.15, 1.1, 0.95][i];
  return make('0 0 64 64', `<ellipse cx="32" cy="36" rx="11" ry="7" fill="#000" opacity="${0.25 - Math.abs(hop) * 0.02}" />` + `<g transform="translate(${i * 3} ${hop})">` +
    `<g transform="translate(30 32) scale(${stretch} 1) translate(-30 -32)"><ellipse cx="28" cy="32" rx="11" ry="8" fill="#9a8270" stroke="${INK}" stroke-width="1.8" /><circle cx="17" cy="32" r="3.4" fill="#f4efe6" stroke="${INK}" stroke-width="1.2" /></g>` +
    `<circle cx="40" cy="32" r="6" fill="#a88c78" stroke="${INK}" stroke-width="1.8" /><path d="M38 28 Q34 20 28 ${20 + i % 2} M38 36 Q34 44 28 ${44 - i % 2}" stroke="${INK}" stroke-width="4.6" stroke-linecap="round" fill="none" /><path d="M38 28 Q34 20 28 ${20 + i % 2} M38 36 Q34 44 28 ${44 - i % 2}" stroke="#c8a898" stroke-width="2.6" stroke-linecap="round" fill="none" /><circle cx="43" cy="30" r="1" fill="${INK}" /><circle cx="43" cy="34" r="1" fill="${INK}" /><circle cx="46" cy="32" r="1" fill="#e08a8a" /></g>`);
});
const deer = four.map((i) => {
  const head = [0, 6, 12, 4][i]; // grazing: the head dips down and comes up
  return make('0 0 96 96', `<ellipse cx="48" cy="52" rx="24" ry="12" fill="#000" opacity="0.25" />` +
    `<ellipse cx="44" cy="48" rx="20" ry="11" fill="#9a6a3a" stroke="${INK}" stroke-width="2" /><path d="M30 44 Q44 40 58 44" stroke="#c89a6a" stroke-width="2" fill="none" /><g fill="#f4efe6"><circle cx="40" cy="44" r="1.3" /><circle cx="48" cy="45" r="1.3" /><circle cx="44" cy="51" r="1.3" /></g><circle cx="24" cy="48" r="3" fill="#f4efe6" stroke="${INK}" stroke-width="1.2" />` +
    `<g transform="translate(${-head * 0.2} 0) rotate(${head} 62 48)"><path d="M60 48 L72 48" stroke="${INK}" stroke-width="7" stroke-linecap="round" /><path d="M60 48 L72 48" stroke="#9a6a3a" stroke-width="5" stroke-linecap="round" /><ellipse cx="76" cy="48" rx="6" ry="4.4" fill="#a8784a" stroke="${INK}" stroke-width="1.8" /><path d="M72 44 L68 36 M72 52 L68 60 M70 40 l-4 -2 M70 56 l-4 2" stroke="#6a4a2a" stroke-width="2" stroke-linecap="round" /><circle cx="81" cy="48" r="1.4" fill="${INK}" /></g>`);
});
const blossom = (() => {
  const t = read('terrain/tree_round_spring');
  const r = rng(51);
  const dots = Array.from({ length: 34 }, () => [24 + r() * 80, 24 + r() * 80, 2 + r() * 2.2]).filter(([x, y]) => (x - 64) ** 2 + (y - 64) ** 2 < 40 ** 2);
  return over(t, `<g>${dots.map(([x, y, s]) => `<g transform="translate(${f1(x)} ${f1(y)})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f1(s * 0.7 * Math.cos((a * Math.PI) / 180))}" cy="${f1(s * 0.7 * Math.sin((a * Math.PI) / 180))}" r="${f1(s * 0.55)}" fill="#ffd6e6" />`).join('')}<circle r="${f1(s * 0.3)}" fill="#ffb347" /></g>`).join('')}</g>`);
})();
const butterfly = four.map((i) => {
  const w = [1, 0.6, 0.15, 0.6][i];
  const wing = (sy) => `<g transform="translate(16 16) scale(1 ${f1(sy * w)})"><path d="M0 0 Q-10 -12 -2 -13 Q4 -12 1 0 Z" fill="#f2a03a" stroke="${INK}" stroke-width="0.9" /><path d="M0 0 Q8 -9 10 -4 Q8 1 1 0 Z" fill="#ffd36b" stroke="${INK}" stroke-width="0.9" /><circle cx="-3" cy="-8" r="1.4" fill="${INK}" /></g>`;
  return make('0 0 32 32', wing(1) + wing(-1) + `<ellipse cx="16" cy="16" rx="5" ry="1.4" fill="${INK}" /><path d="M21 15.5 l3 -2 M21 16.5 l3 2" stroke="${INK}" stroke-width="0.7" />`);
});
const flower = [0, 0.4, 0.8, 1].map((o) => {
  let s = '';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const d = 4 + o * 6;
    s += `<ellipse cx="${f1(16 + d * Math.cos(a))}" cy="${f1(16 + d * Math.sin(a))}" rx="${f1(2 + o * 3)}" ry="${f1(2 + o)}" transform="rotate(${f1((a * 180) / Math.PI)} ${f1(16 + d * Math.cos(a))} ${f1(16 + d * Math.sin(a))})" fill="${o < 0.5 ? '#e89ab8' : '#ffd6e6'}" stroke="${INK}" stroke-width="0.8" />`;
  }
  return make('0 0 32 32', `<circle cx="16" cy="16" r="15" fill="${GRASS}" />` + s + `<circle cx="16" cy="16" r="${f1(2 + o * 1.4)}" fill="#ffd36b" stroke="${INK}" stroke-width="0.8" />`);
});
const splash = four.map((i) => {
  // The game's own turning strip, one frame of it, with spray flung off the rim as the paddles come round.
  const strip = read('buildings/water_wheel_working_4f');
  const r = rng(61 + i);
  let spray = '';
  for (let k = 0; k < 9; k++) {
    const a = ((k / 9) * 0.9 + i * 0.22) * Math.PI + Math.PI * 0.3; // the lower and right side of the wheel
    const d = 30 + r() * 7;
    spray += `<circle cx="${f1(160 + d * Math.cos(a))}" cy="${f1(32 + d * Math.sin(a))}" r="${f1(1.2 + r() * 1.4)}" fill="#e8f8ff" stroke="#3a7aa8" stroke-width="0.5" opacity="${f1(0.7 + r() * 0.3)}" />`;
  }
  const foam = `<ellipse cx="160" cy="32" rx="${31 + i}" ry="${31 + i}" fill="none" stroke="#e8f8ff" stroke-width="1.6" stroke-dasharray="${3 + i} 5" stroke-dashoffset="${i * 4}" opacity="0.7" />`;
  return make('0 0 192 64', `<svg width="192" height="64" viewBox="${i * 192} 0 192 64">${inner(strip)}</svg>${foam}${spray}`);
});
const bucket = four.map((i) => {
  const w = read('buildings/well');
  const V = Number(box(w).split(' ')[2]);
  const d = [0.14, 0.07, 0, 0.07][i]; // the bucket comes up and goes back down
  const scale = 1 - d * 2;
  return over(w, `<path d="M${V / 2} ${V * 0.3} V${f1(V * (0.42 + d))}" stroke="#c9a06a" stroke-width="${V / 90}" /><g transform="translate(${V / 2} ${f1(V * (0.48 + d))}) scale(${f1(scale)})"><rect x="${-V * 0.09}" y="${-V * 0.09}" width="${V * 0.18}" height="${V * 0.18}" rx="${V * 0.02}" fill="#8a6234" stroke="${INK}" stroke-width="${V / 80}" /><rect x="${-V * 0.07}" y="${-V * 0.07}" width="${V * 0.14}" height="${V * 0.14}" rx="${V * 0.015}" fill="${i === 2 ? '#7fc4ec' : '#3a2a1c'}" /></g>`);
});

// ===== People =====
const idleStrip = read('units/engineer_idle_4f');
const enDefs = idleStrip.match(/<defs>([\s\S]*?)<\/defs>/)[1].replace(/<g id="enI\d">[\s\S]*?<\/g>/g, '');
const suits = [['#ffa24a', '#c8600e'], ['#5ab0ff', '#1f5fa8'], ['#7ee07a', '#2f8a3a'], ['#d68aff', '#7a3aa8']];
const players = suits.map(([a, b]) => make('0 0 64 64', `<defs>${enDefs.replace('<stop offset="0" stop-color="#ffa24a" /><stop offset="1" stop-color="#c8600e" />', `<stop offset="0" stop-color="${a}" /><stop offset="1" stop-color="${b}" />`)}</defs><use href="#enBootN" /><use href="#enTorso" /><use href="#enHandN" /><use href="#enHat" />`));
const eng = (body, suit = 0) => `<defs>${enDefs.replace('<stop offset="0" stop-color="#ffa24a" /><stop offset="1" stop-color="#c8600e" />', `<stop offset="0" stop-color="${suits[suit][0]}" /><stop offset="1" stop-color="${suits[suit][1]}" />`).replace(/id="en/g, `id="s${suit}en`).replace(/#en/g, `#s${suit}en`)}</defs>${body.replace(/#en/g, `#s${suit}en`)}`;
const revive = four.map((i) => {
  const lying = [90, 90, 50, 0][i];
  const stars = i < 2 ? `<g fill="#ffd36b">${[0, 1, 2].map((k) => { const a = (k / 3) * TAU + i; return `<path transform="translate(${f1(40 + 9 * Math.cos(a))} ${f1(26 + 4 * Math.sin(a))}) scale(0.5)" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" />`; }).join('')}</g>` : '';
  const helperX = [70, 58, 54, 56][i];
  return make('0 0 128 64',
    `<g transform="translate(${16} 0)"><g transform="rotate(${lying} 32 32)">${eng('<use href="#enBootN" /><use href="#enTorso" /><use href="#enHandN" /><use href="#enHat" />', 1)}</g></g>${stars}` +
    `<g transform="translate(${helperX} 0) scale(-1 1) translate(-64 0)">${eng('<use href="#enBootN" /><use href="#enTorso" /><use href="#enHandN" /><use href="#enHat" />', 0)}</g>` +
    (i >= 1 ? `<circle cx="${helperX + 18}" cy="${[0, 34, 32, 30][i]}" r="4" fill="#ffffff" opacity="0.5" />` : '') +
    (i === 3 ? `<path d="M48 8 l2 -5 M54 10 l4 -3 M42 10 l-3 -4" stroke="#6ee07a" stroke-width="1.8" stroke-linecap="round" />` : ''));
});

// ===== Screens and UI =====
// Research icons: each topic's first unlock (or its main cost) on a badge coloured by its age.
const data = fs.readFileSync(path.join(REPO, 'src/sim/data.ts'), 'utf8');
const topics = [...data.matchAll(/\{ id: '([a-z0-9_]+)', name: '([^']+)', cost: \{ ([a-z_]+)[^}]*\}[^\n]*?unlocks: \[([^\]]*)\]/g)].map((m) => ({ id: m[1], name: m[2], cost: m[3], unlocks: [...m[4].matchAll(/'([a-z0-9_]+)'/g)].map((u) => u[1]) }));
const AGE = (t) => (['log', 'plank', 'stone', 'dowel', 'rope', 'truss'].includes(t.cost) ? ['#7a5a32', '#c8a06a'] : ['iron_ingot', 'iron_plate', 'iron_rod', 'rivet', 'brick', 'copper_ingot', 'gear', 'chitin'].includes(t.cost) ? ['#4a5a6c', '#a8b8c8'] : ['#2a4a7a', '#7cc4ff']);
const badge = (t) => {
  const art = t.unlocks.map((u) => `buildings/${u}`).find(has) ?? t.unlocks.map((u) => `buildings/${u}_base`).find(has) ?? `items/${t.cost}`;
  const [dark, light] = AGE(t);
  const s = make('0 0 64 64', `<path d="M32 3 L57 17 V47 L32 61 L7 47 V17 Z" fill="${dark}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" /><path d="M32 7 L53 19 V45 L32 57 L11 45 V19 Z" fill="none" stroke="${light}" stroke-width="1.5" opacity="0.8" />` + (has(art) ? place(read(art), 15, 15, 34) : ''));
  return `<div style="display: flex; flex-direction: column; align-items: center; gap: 3px; width: 76px"><img src="${uri(s)}" width="60" height="60"><div style="font-size: 10.5px; color: #a9b6c9; text-align: center; line-height: 1.2">${t.name}</div></div>`;
};
const researchIcons = `<div style="display: flex; flex-wrap: wrap; gap: 8px; max-width: 1240px; background: #24303f; border-radius: 10px; padding: 12px">${topics.map(badge).join('')}</div>`;
const medal = (metal, iconKey, label) => {
  const [a, b] = { bronze: ['#e8a868', '#8a5a2a'], silver: ['#f0f4f8', '#8a96a6'], gold: ['#ffe48a', '#c8901e'] }[metal];
  return make('0 0 64 80', `<defs><radialGradient id="m${metal}" cx="40%" cy="35%"><stop offset="0" stop-color="${a}" /><stop offset="1" stop-color="${b}" /></radialGradient></defs><path d="M20 0 H30 L34 26 H24 Z" fill="#3fa9f5" stroke="${INK}" stroke-width="1.5" /><path d="M44 0 H34 L30 26 H40 Z" fill="#c84a3a" stroke="${INK}" stroke-width="1.5" /><circle cx="32" cy="48" r="24" fill="url(#m${metal})" stroke="${INK}" stroke-width="2.5" /><circle cx="32" cy="48" r="19" fill="none" stroke="${b}" stroke-width="1.5" />` + place(read(iconKey), 18, 34, 28) + `<text x="32" y="78" text-anchor="middle" font-size="0">${label}</text>`);
};
const medals = [['bronze', 'items/log', 'First log'], ['silver', 'buildings/turret_base', 'First defence'], ['gold', 'enemies/crawler_queen', 'Queen slain'], ['gold', 'buildings/ship_nav', 'Escaped']].map(([m, k, l]) => ({ svg: medal(m, k, l), l }));
const toolbarIcon = read('ui/factory');
const hover = four.map((i) => make('0 0 64 64', `<rect x="4" y="4" width="56" height="56" rx="12" fill="${i ? '#2a4a7a' : '#1d2a3c'}" stroke="${i ? '#7cc4ff' : '#3a4a5c'}" stroke-width="2" />` + `<g transform="translate(32 ${32 + [0, -3, -1, -2][i]}) rotate(${[0, -6, 4, 0][i]}) scale(${[1, 1.12, 1.06, 1.08][i]}) translate(-32 -32)">${place(toolbarIcon, 14, 14, 36)}</g>`));

// ===== Wear =====
const wall = read('buildings/wall');
const crack = (stage) => {
  const paths = ['M20 14 L26 22 L23 30', 'M23 30 L30 36 L28 46 M26 22 L34 20', 'M30 36 L40 40 L44 50 M34 20 L42 14 M28 46 L22 52'].slice(0, stage).join(' ');
  return stage ? over(wall, `<path d="${paths}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /><path d="${paths}" fill="none" stroke="#e8e0d0" stroke-width="0.8" opacity="0.5" transform="translate(0.8 0.8)" />` + (stage === 3 ? `<g fill="#9a8a78" stroke="${INK}" stroke-width="0.8"><path d="M44 52 l4 1 l-1 3 Z" /><path d="M20 54 l3 -1 l1 3 Z" /></g>` : '')) : wall;
};
const pit = read('buildings/spike_pit');
const pitWear = [0, 1, 2, 3].map((st) => {
  if (!st) return pit;
  const r = rng(80 + st);
  let s = `<rect x="6" y="6" width="52" height="52" rx="4" fill="#5a4026" opacity="${0.1 * st}" />`;
  for (let k = 0; k < st * 4; k++) { const x = 12 + r() * 40, y = 12 + r() * 40; s += `<path d="M${f1(x)} ${f1(y)} l${f1(4 + r() * 3)} ${f1(1 + r() * 2)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" /><path d="M${f1(x)} ${f1(y)} l${f1(4 + r() * 3)} ${f1(1 + r() * 2)}" stroke="#a87642" stroke-width="1.4" stroke-linecap="round" />`; }
  if (st === 3) s += `<g fill="#3a3a30" opacity="0.6"><ellipse cx="22" cy="40" rx="6" ry="3" /><ellipse cx="42" cy="24" rx="5" ry="2.4" /></g>`;
  return over(pit, s);
});
const pathWear = [0, 1, 2].map((st) => {
  let s = tiles(256, 128);
  if (st) s += `<path d="M0 92 C60 ${92 - st * 2} 120 ${96 + st * 2} 256 90" stroke="#8a6a44" stroke-width="${10 + st * 6}" fill="none" opacity="${0.25 + st * 0.25}" stroke-linecap="round" /><path d="M0 92 C60 ${92 - st * 2} 120 ${96 + st * 2} 256 90" stroke="#a88a5a" stroke-width="${4 + st * 3}" fill="none" opacity="${0.2 + st * 0.2}" stroke-dasharray="6 9" />`;
  for (let x = 0; x < 256; x += 32) s += place(read('buildings/belt'), x, 32, 32);
  return make('0 0 256 128', s);
});

const B = 130;
board('IdeasFifth.dc.html', {
  title: 'Ideas · Fifth',
  kicker: 'Ideas · proposed, not in the game',
  heading: 'Feedback, bugs, life, people, icons and wear',
  intro: 'The third list: feedback when things happen, bug deaths and tracks, life in the clearing, co-op players, research icons, medals and the toolbar, and wear that builds up over time.',
  ideas: [
    idea('Building and demolishing', 'A new building rises inside a timber frame, filling in from the bottom, and its bolts flash when it\'s done. Demolished, it sinks and crumbles into dust and broken bits.', [['Build · 5 frames', frames(build, 92)], ['Played', play([...build, build[4], build[4]], 6, B)], ['Demolish · 4 frames', frames(demolish, 92)], ['Played', play([...demolish, demolish[3]], 6, B)]], 'effects/build_5f (sized to the building), demolish_4f'),
    idea('Deliveries and research', 'An item arcs into the hub and pops with a count. When research finishes, rings of blue light pulse out from the hub.', [['Delivery · 4 frames', frames(delivery, 120)], ['Played', play(delivery, 5, 170)], ['Research done · 4 frames', frames(research, 100)], ['Played', play(research, 6, B)]], 'effects/deliver_4f, research_pulse_4f'),
    idea('Turrets aiming and running low', 'Brackets close on the bug a turret aims at and turn red when it\'s locked on. A turret short of ammo blinks red round its ammo box.', [['Lock-on · 4 frames', frames(lockOn, 92)], ['Played', play(lockOn, 6, B)], ['Low ammo · 2 frames', frames(lowAmmo, 92)], ['Played', play(lowAmmo, 2, B)]], 'effects/lock_on_4f, low_ammo'),
    idea('A raid is coming', 'A red glow pulses along the edge of the map the raid comes from, and a siren light turns on the hub.', [['4 frames', frames(raid, 180)], ['Played', play(raid, 5, 330)]], 'drawn in code; effects/siren_4f'),
    idea('Ship milestones', 'Fireworks and confetti over the ship when a stage is finished. Before launch, four lamps round the pad light one by one, then all turn green.', [[['Stage done · 4 frames', frames(fireworks, 104)], ['Played', play(fireworks, 6, 160)]], [['Countdown · 5 frames', frames(countdown, 104)], ['Played', play([...countdown, countdown[4]], 1.5, 160)]]], 'effects/fireworks_4f, ship_countdown_5f'),
    idea('Deaths by kind', 'Bugs all share one splat now. A wasp spirals down to its shadow. A beetle flinches, curls its legs in under it, and its wing cases part as it dulls to a dusty husk. A brute crumples and darkens into a stain.', [['Wasp', frames(waspDeath, 80)], ['Played', play([...waspDeath, waspDeath[3]], 6, 110)], ['Beetle', frames(beetleDeath, 80)], ['Played', play([...beetleDeath, beetleDeath[3], beetleDeath[3]], 5, 110)], ['Brute', frames(bruteDeath, 80)], ['Played', play([...bruteDeath, bruteDeath[3]], 5, 110)]], 'enemies/wasp_death_4f, beetle_death_4f, brute_death_4f'),
    idea('Tracks', 'Bugs leave footprints in the snow that fade behind them.', [['In snow', still(tracks('terrain/ground_winter', '#5a6a7a', 0.85), 330)]], 'drawn in code'),
    idea('Eyes in the forest', 'At night, pairs of eyes watch from the forest edge, blinking now and then.', [['4 frames', frames(eyes, 200)], ['Played', play(eyes, 3, 360)]], 'effects/eyes_4f'),
    idea('Chitin to pick up', 'A dropped piece of chitin bounces, settles and glints until it\'s picked up.', [['4 frames', frames(chitinDrop, 84)], ['Played', play(chitinDrop, 6, 110)]], 'effects/drop_4f'),
    idea('Cloud shadows', 'Soft shadows of clouds drift slowly over the whole map, buildings and all.', [['4 frames', frames(clouds, 180)], ['Played', play(clouds, 2, 330)]], 'drawn in code (a tiling overlay)'),
    idea('Birds and animals', 'Birds that take off when bugs come near, a rabbit hopping at the forest edge, and a deer grazing there.', [['Bird · 4 frames', frames(bird, 56, GRASS)], ['Birds scatter', play(flock, 5, 230)], ['Rabbit', frames(rabbit, 72)], ['Played', play(rabbit, 6, 100)], ['Deer grazing', frames(deer, 80)], ['Played', play(deer, 2, 110)]], 'units/bird_4f, rabbit_4f, deer_4f'),
    idea('Seasons', 'Pink blossom on the broadleaf trees in spring, butterflies in summer, and flowers that open in the morning and close at dusk.', [['Spring tree now', still(read('terrain/tree_round_spring'), 110)], ['In blossom', still(blossom, 110)], ['Butterfly · 4 frames', frames(butterfly, 56)], ['Played', play(butterfly, 10, 90)], ['Flower opening', frames(flower, 56)]], 'terrain/tree_round_blossom, effects/butterfly_4f, flower_open_4f'),
    idea('Water', 'Splashes where the water wheel dips into the stream, and the well\'s bucket coming up full and going back down.', [['Water wheel', frames(splash, 150)], ['Played', play(splash, 8, 220)], ['Well', frames(bucket, 92)], ['Played', play(bucket, 3, B)]], 'over the working strips'),
    idea('Co-op players', 'Each player\'s engineer in their own overalls: orange, blue, green and purple.', [['4 players', frames(players, 96)]], 'units/engineer tinted per player'),
    idea('Help up', 'When an engineer is knocked out, another walks up, offers a hand and pulls them to their feet, and the stars clear.', [['4 frames', frames(revive, 170)], ['Played', play([...revive, revive[3]], 2, 260)]], 'units/engineer_revive_4f'),
    idea('Research icons', 'A badge for every research topic, from its first unlock (or what it costs), coloured by its age: wood, iron, then steel and electricity.', [['Every topic', researchIcons]], 'ui/research/<id>'),
    idea('Achievements and the toolbar', 'Medals for achievements in bronze, silver and gold. Toolbar buttons that lift and tilt a little when the pointer is over them.', [['Medals', `<div style="display: flex; gap: 14px; background: #24303f; border-radius: 10px; padding: 12px">${medals.map((m) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><img src="${uri(m.svg)}" width="80" height="100"><div style="font-size: 11px; color: #a9b6c9">${m.l}</div></div>`).join('')}</div>`], ['Toolbar hover · 4 frames', frames(hover, 72, '#121a28')], ['Played', play(hover, 8, 100, '#121a28')]], 'ui/medal_*, toolbar hover'),
    idea('Walls that crack', 'Cracks spread across a wall as it\'s damaged, until chips fall off.', [['Whole to badly damaged', frames([0, 1, 2, 3].map(crack), 92)]], 'buildings/wall_crack_1 to _3 (and the other wall sets)'),
    idea('Spike pits that wear', 'As a spike pit\'s charge runs down, stakes break and splinter and the pit fills with dirt.', [['Full to worn out', frames(pitWear, 92)]], 'buildings/spike_pit_1 to _3'),
    idea('Worn paths', 'Where the engineer walks most, beside long belt lines, the grass wears to a dirt path over time.', [['New, worn, well worn', frames(pathWear, 220)]], 'drawn in code'),
  ],
});
