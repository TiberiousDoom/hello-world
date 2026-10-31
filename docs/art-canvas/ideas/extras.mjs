// "Extras" board: things drawn in code that could be sprites, the app and browser icons, a Hardcore look,
// and small touches (an idle belt, worn terraces, snowfall).
// node docs/art-canvas/ideas/extras.mjs [repo] [out]
import { read, over, make, inner, box, uri, rng, idea, still, play, frames, board, INK, GRASS } from './lib.mjs';

const TAU = Math.PI * 2;
const f1 = (n) => n.toFixed(1);

// --- Drone: a quadcopter seen from above, its rotors turning (4 frames), with nav lights.
const droneNow = make(
  '0 0 64 64',
  // The code's drone, at the same proportions: an X frame, four pale rotor discs with a line, a square body.
  `<path d="M19 19 L45 45 M45 19 L19 45" stroke="${INK}" stroke-width="3.2" />` +
    [[19, 19], [45, 19], [19, 45], [45, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="rgba(200,220,235,0.35)" /><path d="M${x - 6.4} ${y} H${x + 6.4}" stroke="rgba(15,26,46,0.7)" stroke-width="3.2" />`).join('') +
    `<rect x="24.3" y="24.3" width="15.4" height="15.4" rx="3.2" fill="#3a5a6a" stroke="${INK}" stroke-width="3.2" />`,
);
const drone = [0, 1, 2, 3].map((i) =>
  make(
    '0 0 64 64',
    `<defs><radialGradient id="dB" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#7fa8bd" /><stop offset="1" stop-color="#2b4552" /></radialGradient></defs>` +
      // Arms
      `<g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M18 18 L46 46 M46 18 L18 46" /></g><g stroke="#8d99a6" stroke-width="2.6" stroke-linecap="round"><path d="M18 18 L46 46 M46 18 L18 46" /></g>` +
      // Rotors: a blurred disc and two blades turning 22.5° a frame (a quarter of the way to looking the same)
      [[16, 16, 1], [48, 16, -1], [16, 48, -1], [48, 48, 1]]
        .map(([x, y, dir]) => {
          const a = dir * i * 22.5 + (x + y) * 2;
          return `<circle cx="${x}" cy="${y}" r="11" fill="#dfeaf2" opacity="0.28" stroke="${INK}" stroke-opacity="0.35" stroke-width="1" />` +
            `<g transform="rotate(${a} ${x} ${y})"><path d="M${x - 10} ${y} H${x + 10}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" /><path d="M${x - 10} ${y} H${x + 10}" stroke="#c9d2de" stroke-width="1.6" stroke-linecap="round" /></g>` +
            `<path d="M${x} ${y}" transform="rotate(${a + 90} ${x} ${y})" />` +
            `<path d="M${x - 9} ${y}" transform="rotate(${a + 60} ${x} ${y})" stroke="#c9d2de" stroke-width="1" opacity="0.35" />` +
            `<circle cx="${x}" cy="${y}" r="2.6" fill="#3a4656" stroke="${INK}" stroke-width="1.2" />`;
        })
        .join('') +
      // Body: a rounded shell with a hazard stripe, a camera eye and nav lights (green right, red left, as on aircraft)
      `<rect x="22" y="23" width="20" height="18" rx="6" fill="url(#dB)" stroke="${INK}" stroke-width="2.4" />` +
      `<path d="M25 37 H39" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round" />` +
      `<circle cx="38" cy="32" r="2.6" fill="#0f1a2e" /><circle cx="38.6" cy="31.4" r="0.9" fill="#9ad4ff" />` +
      `<path d="M26 26.5 Q30 24.5 35 25.5" stroke="#d6ecff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.8" />` +
      `<circle cx="32" cy="22" r="1.6" fill="${i % 2 ? '#6ee07a' : '#2f6a3a'}" stroke="${INK}" stroke-width="0.6" /><circle cx="32" cy="42" r="1.6" fill="${i % 2 ? '#7a2a22' : '#ff6a5a'}" stroke="${INK}" stroke-width="0.6" />`,
  ),
);

// --- Hub breach: a shockwave of blue light, with chunks and dust thrown out (6 frames).
const breach = (() => {
  const r = rng(5);
  const chunks = Array.from({ length: 10 }, () => [r() * TAU, 0.7 + r() * 0.5, 2 + r() * 2.5, r() * 360]);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const t = i / 5;
    const R = 10 + t * 50;
    const fade = 1 - t;
    let s = '';
    if (i < 2) s += `<circle cx="64" cy="64" r="${18 - i * 4}" fill="#e8f6ff" opacity="${0.9 - i * 0.35}" />`;
    s += `<circle cx="64" cy="64" r="${f1(R)}" fill="none" stroke="#3fa9f5" stroke-width="${f1(10 * fade + 1)}" opacity="${f1(0.35 * fade + 0.05)}" />`;
    s += `<circle cx="64" cy="64" r="${f1(R)}" fill="none" stroke="#bfe4ff" stroke-width="${f1(2.6 * fade + 0.4)}" opacity="${f1(0.9 * fade + 0.1)}" />`;
    // Dust ring a little behind the light
    const dr = rng(8);
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU + dr() * 0.3;
      const rr = R * (0.7 + dr() * 0.2);
      s += `<circle cx="${f1(64 + rr * Math.cos(a))}" cy="${f1(64 + rr * Math.sin(a))}" r="${f1((2 + t * 5) * (0.6 + dr() * 0.8))}" fill="#a89a84" opacity="${f1(0.4 * fade * (0.5 + dr() * 0.5))}" />`;
    }
    for (const [a, sp, sz, rot] of chunks) {
      const d = 8 + sp * t * 52;
      const x = 64 + d * Math.cos(a), y = 64 + d * Math.sin(a) - 10 * Math.sin(t * Math.PI) * sp;
      s += `<rect x="${f1(x - sz)}" y="${f1(y - sz)}" width="${f1(sz * 2)}" height="${f1(sz * 1.5)}" rx="0.8" transform="rotate(${f1(rot + t * 300)} ${f1(x)} ${f1(y)})" fill="#5a6478" stroke="${INK}" stroke-width="1" opacity="${f1(1 - t * 0.7)}" />`;
    }
    return make('0 0 128 128', s);
  });
})();
const breachNow = [0, 1, 2, 3, 4, 5].map((i) => {
  const t = i / 5;
  return make('0 0 128 128', `<circle cx="64" cy="64" r="${f1(8 + t * 52)}" fill="none" stroke="rgb(63,169,245)" stroke-width="3" opacity="${f1(1 - t)}" />`);
});

// --- Mk2 and Mk3 plates on a furnace: the code's flat plate, and a bevelled, riveted one.
const furnace = read('buildings/furnace');
const fw = Number(box(furnace).split(' ')[2]);
const k = fw / 2; // the plate in tile units, scaled to the sprite
const plateNow = (fill, n) =>
  `<rect x="${0.1 * k}" y="${(2 - 0.5) * k}" width="${0.42 * k}" height="${0.36 * k}" rx="${0.06 * k}" fill="${INK}" /><rect x="${0.13 * k}" y="${(2 - 0.47) * k}" width="${0.36 * k}" height="${0.3 * k}" rx="${0.05 * k}" fill="${fill}" />` +
  `<path d="${(n === 3 ? [0.02, 0.09, 0.16] : [0.06, 0.15]).map((dy) => `M${0.2 * k} ${(2 - 0.15 - dy) * k} L${0.31 * k} ${(2 - 0.24 - dy) * k} L${0.42 * k} ${(2 - 0.15 - dy) * k}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="${0.05 * k}" />`;
const plateNew = (light, dark, n, on, id) => {
  const x = 0.08 * k, y = 1.46 * k, w = 0.46 * k, h = 0.4 * k;
  const cx = x + w / 2;
  const chev = (n === 3 ? [-0.075, 0, 0.075] : [-0.04, 0.05]).map((dy) => `M${f1(cx - 0.12 * k)} ${f1(y + h / 2 + (dy + 0.05) * k)} L${f1(cx)} ${f1(y + h / 2 + (dy - 0.04) * k)} L${f1(cx + 0.12 * k)} ${f1(y + h / 2 + (dy + 0.05) * k)}`).join(' ');
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${on ? light : '#8a8a80'}" /><stop offset="1" stop-color="${on ? dark : '#4a4a44'}" /></linearGradient></defs>` +
    (on ? `<rect x="${f1(x - 3)}" y="${f1(y - 3)}" width="${f1(w + 6)}" height="${f1(h + 6)}" rx="6" fill="${light}" opacity="0.3" />` : '') +
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="3" fill="url(#${id})" stroke="${INK}" stroke-width="2" />` +
    `<path d="M${f1(x + 3)} ${f1(y + 2.5)} H${f1(x + w - 3)}" stroke="#ffffff" stroke-width="1.2" opacity="${on ? 0.7 : 0.3}" />` +
    `<path d="${chev}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /><path d="${chev}" fill="none" stroke="${on ? '#ffffff' : '#9a9a90'}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" transform="translate(0 -0.8)" />` +
    [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]].map(([a, b]) => `<circle cx="${f1(a)}" cy="${f1(b)}" r="1.1" fill="${INK}" opacity="0.7" />`).join('')
  );
};
const plates = {
  now: [over(furnace, plateNow('#f2c14e', 2)), over(furnace, plateNow('#8a7a4a', 2)), over(furnace, plateNow('#7fd3ff', 3)), over(furnace, plateNow('#4a6a7a', 3))],
  new: [over(furnace, plateNew('#ffe48a', '#c8901e', 2, true, 'p1')), over(furnace, plateNew('#ffe48a', '#c8901e', 2, false, 'p2')), over(furnace, plateNew('#c8f0ff', '#3f8fc0', 3, true, 'p3')), over(furnace, plateNew('#c8f0ff', '#3f8fc0', 3, false, 'p4'))],
};

// --- App icon (1024) and favicon: the logo's factory and shield, set in the clearing at dusk.
const logo = read('ui/logo');
const appIcon = make(
  '0 0 128 128',
  `<defs><linearGradient id="aiSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2f5a" /><stop offset="0.65" stop-color="#3a5a8a" /><stop offset="1" stop-color="#e09a5a" /></linearGradient>
  <clipPath id="aiClip"><rect width="128" height="128" rx="0" /></clipPath>
  <pattern id="aiHaz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#f2c14e" /><rect width="6" height="12" fill="#1b2230" /></pattern></defs>
  <g clip-path="url(#aiClip)"><rect width="128" height="128" fill="url(#aiSky)" />
  <g fill="#ffffff" opacity="0.8"><circle cx="18" cy="16" r="1" /><circle cx="40" cy="9" r="0.8" /><circle cx="58" cy="22" r="0.9" /><circle cx="12" cy="40" r="0.7" /></g>
  ${[[-4, 96, 1.1], [8, 92, 1.3], [112, 92, 1.2], [124, 97, 1]].map(([x, y, s]) => `<path d="M${x} ${y - 30 * s} L${x + 10 * s} ${y} H${x - 10 * s} Z" fill="#14301f" />`).join('')}
  <path d="M0 96 Q64 84 128 96 V128 H0 Z" fill="#2e4d33" /><path d="M0 100 Q64 89 128 100" stroke="#4f7a4a" stroke-width="2" fill="none" />
  <path d="M84 26 q-2 -10 8 -12 q4 -8 14 -3 q10 0 8 10 q-4 7 -12 5 q-8 6 -18 0 Z" fill="#9ab8d8" opacity="0.9" />
  <path d="M16 100 V60 L36 72 V60 L56 72 V60 L76 72 V30 H90 V100 Z" fill="#e8eef6" stroke="#16305a" stroke-width="3" stroke-linejoin="round" />
  <path d="M78 34 V96" stroke="#c4d2e4" stroke-width="3" />
  <g fill="#ffd36b"><rect x="23" y="80" width="9" height="9" rx="1.5" /><rect x="40" y="80" width="9" height="9" rx="1.5" /><rect x="57" y="80" width="9" height="9" rx="1.5" /></g>
  <rect x="0" y="112" width="128" height="16" fill="url(#aiHaz)" opacity="0.95" />
  <path d="M94 58 L116 66 V82 C116 95 106 103 94 108 C82 103 72 95 72 82 V66 Z" fill="#3fa9f5" stroke="#16305a" stroke-width="5" stroke-linejoin="round" />
  <path d="M78 69 L94 63 V103 C85 98 78 92 78 82 Z" fill="#7cc4ff" opacity="0.5" />
  <circle cx="94" cy="84" r="8" fill="#ffffff" /><rect x="94" y="81" width="15" height="6" rx="2" fill="#ffffff" /></g>`,
);
// A favicon has to read at 16 pixels: just the shield and its cannon on navy.
const favicon = make(
  '0 0 32 32',
  `<rect width="32" height="32" rx="7" fill="#1d3b6e" /><path d="M16 4 L27 8 V16 C27 22.5 22 26.5 16 29 C10 26.5 5 22.5 5 16 V8 Z" fill="#3fa9f5" stroke="#0f1a2e" stroke-width="2" stroke-linejoin="round" /><circle cx="16" cy="17" r="4.6" fill="#ffffff" /><rect x="16" y="15" width="9" height="4" rx="1.2" fill="#ffffff" />`,
);

// --- Hardcore: the same bugs, but scarred, with glowing red veins and a red haze about them.
const hardFilter = (id, freq) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feColorMatrix in="SourceGraphic" type="matrix" values="0.72 0.1 0 0 0.04  0.04 0.45 0 0 0  0.04 0 0.45 0 0  0 0 0 1 0" result="dark" />
  <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="4" result="noise" />
  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 0.3  0 0 0 0 0.15  1 0 0 0 0" result="field" />
  <feComponentTransfer in="field" result="veinsRaw"><feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0.85 0 0 0 0 0 0 0 0" /></feComponentTransfer>
  <feComposite in="veinsRaw" in2="SourceAlpha" operator="in" result="veins" />
  <feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="fat" />
  <feGaussianBlur in="fat" stdDeviation="2.2" result="blur" />
  <feFlood flood-color="#ff2a1a" flood-opacity="0.55" />
  <feComposite in2="blur" operator="in" result="haze" />
  <feMerge><feMergeNode in="haze" /><feMergeNode in="dark" /><feMergeNode in="veins" /></feMerge>
</filter>`;
const hard = (svg, id, freq = 0.12) => make(box(svg), `<defs>${hardFilter(id, freq)}</defs><g filter="url(#${id})">${inner(svg)}</g>`);
const hardBugs = ['crawler', 'brute', 'beetle', 'wasp'].map((b) => [read(`enemies/${b}`), hard(read(`enemies/${b}`), `h${b}`)]);
const nest = read('nests/warren_3');
const nb = box(nest).split(' ').map(Number);
const hardNestNow = make(box(nest), `<defs><filter id="hn"><feColorMatrix type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 1 0" /><feColorMatrix type="sepia" values="0.35" /><feColorMatrix type="hueRotate" values="-30" /><feColorMatrix type="saturate" values="1.7" /></filter></defs><g filter="url(#hn)">${inner(nest)}</g>`);
const hardNest = (glow) =>
  over(
    hard(nest, `hn${glow}`, 0.05),
    `<defs><radialGradient id="mw${glow}"><stop offset="0" stop-color="#ff5a2a" stop-opacity="${glow}" /><stop offset="1" stop-color="#ff2a1a" stop-opacity="0" /></radialGradient></defs><circle cx="${nb[2] / 2}" cy="${nb[3] / 2}" r="${nb[2] / 7}" fill="url(#mw${glow})" />` +
      // Bones and chitin scattered round the mound
      [[0.3, 0.7, 20], [0.68, 0.32, -30], [0.72, 0.7, 60], [0.28, 0.34, 10]].map(([x, y, a]) => `<g transform="translate(${f1(x * nb[2])} ${f1(y * nb[3])}) rotate(${a}) scale(${nb[2] / 256})"><path d="M-10 0 H10" stroke="${INK}" stroke-width="5" stroke-linecap="round" /><path d="M-10 0 H10" stroke="#e8dcc4" stroke-width="3" stroke-linecap="round" /><circle cx="-11" cy="-2" r="2.6" fill="#e8dcc4" stroke="${INK}" stroke-width="1" /><circle cx="-11" cy="2" r="2.6" fill="#e8dcc4" stroke="${INK}" stroke-width="1" /><circle cx="11" cy="-2" r="2.6" fill="#e8dcc4" stroke="${INK}" stroke-width="1" /><circle cx="11" cy="2" r="2.6" fill="#e8dcc4" stroke="${INK}" stroke-width="1" /></g>`).join(''),
  );
const nestPulse = [0.5, 0.75, 0.95, 0.7].map(hardNest);

// --- An idle belt: a leaf drifts down and settles on it (in fall), and the slats sit still.
const belt = read('buildings/belt');
const leaf = (x, y, a, s = 1) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a}) scale(${s})"><path d="M-6 0 Q0 -5 6 0 Q0 5 -6 0 Z" fill="#d9822b" stroke="${INK}" stroke-width="1" /><path d="M-5 0 H6" stroke="#8a4a1a" stroke-width="0.8" /></g>`;
const beltLeaf = [
  [50, -4, -30, 0.9, 0.9], [44, 12, 20, 1, 1], [40, 26, -15, 1, 1], [38, 34, 10, 1, 1],
].map(([x, y, a, s, o]) => over(belt, `<ellipse cx="${x + 3}" cy="${f1(Math.max(y + 6, 36))}" rx="5" ry="2.4" fill="#000" opacity="${f1(0.1 + (y > 20 ? 0.15 : 0))}" />` + `<g opacity="${o}">${leaf(x, y, a, s)}</g>`));
// A strip of three belts with a few leaves settled, as an idle line would look after a while in fall.
const beltLine = make('0 0 192 64', [0, 64, 128].map((x) => `<svg x="${x}" width="64" height="64" viewBox="0 0 64 64">${inner(belt)}</svg>`).join('') + leaf(38, 34, 10) + leaf(100, 22, -40, 0.9) + leaf(160, 44, 70) + leaf(150, 18, 15, 0.8));

// --- Worn terraces: where an extractor has worked a patch, the shelf is scuffed, the ore band cut and gravel spilled.
const T = 40;
const terrace = (worn) => {
  const c = { rock: '#6e5a4c', light: '#97806d', cliff: '#4f4036', ore: '#a0553a', oreLight: '#d9906a' };
  const r = rng(worn ? 9 : 3);
  let s = `<rect width="${5 * T}" height="${4 * T}" fill="${GRASS}" />`;
  const step = (x0, y0, x1, y1, rr) =>
    `<rect x="${x0 + 4}" y="${y0 + 8}" width="${x1 - x0}" height="${y1 - y0}" rx="${rr}" fill="#000" opacity="0.25" />` +
    `<rect x="${x0}" y="${y0 + 6}" width="${x1 - x0}" height="${y1 - y0}" rx="${rr}" fill="${c.cliff}" stroke="${INK}" stroke-width="2" />` +
    `<rect x="${x0 + 2}" y="${y1 + 1}" width="${x1 - x0 - 4}" height="3" rx="1.5" fill="${c.ore}" />` +
    `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${rr}" fill="${c.rock}" stroke="${INK}" stroke-width="2" />` +
    `<path d="M${x0 + rr} ${y0 + 1.5} H${x1 - rr}" stroke="${c.light}" stroke-width="2.4" stroke-linecap="round" />`;
  s += step(0.3 * T, 0.3 * T, 4.7 * T, 3.5 * T, 16) + step(1.2 * T, 1.0 * T, 3.8 * T, 2.7 * T, 12);
  for (let k = 0; k < 22; k++) s += `<circle cx="${f1((0.6 + r() * 3.8) * T)}" cy="${f1((0.5 + r() * 2.8) * T)}" r="${f1(1 + r() * 1.5)}" fill="${c.oreLight}" opacity="0.6" />`;
  if (worn) {
    // A worked tile: the shelf cut down to a scarred pit with tool marks, the ore band chipped, gravel spilled down the cliff.
    const px = 2.5 * T, py = 1.85 * T;
    s += `<ellipse cx="${px}" cy="${py}" rx="${T * 0.62}" ry="${T * 0.5}" fill="#3f332b" stroke="${INK}" stroke-width="1.6" />`;
    s += `<ellipse cx="${px}" cy="${py + 3}" rx="${T * 0.46}" ry="${T * 0.34}" fill="#2a221d" />`;
    s += `<path d="M${px - 14} ${py - 12} l6 4 M${px + 10} ${py - 14} l-4 6 M${px + 16} ${py + 4} l-7 -2 M${px - 18} ${py + 6} l7 -3" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round" />`;
    for (let k = 0; k < 14; k++) s += `<circle cx="${f1(px - 28 + r() * 56)}" cy="${f1(2.75 * T + 6 + r() * 14)}" r="${f1(1.4 + r() * 2)}" fill="${r() < 0.5 ? c.light : c.ore}" stroke="${INK}" stroke-width="0.6" />`;
    s += `<rect x="${px - 16}" y="${2.7 * T + 6}" width="32" height="5" fill="${c.cliff}" />`;
    // Tracks of the engineer's boots in the dust on the lower shelf
    for (let k = 0; k < 5; k++) s += `<ellipse cx="${0.8 * T + k * 7}" cy="${3.1 * T - (k % 2) * 5}" rx="2" ry="1.3" fill="#4f4036" opacity="0.7" />`;
  }
  return make(`0 0 ${5 * T} ${4 * T}`, s);
};

// --- Snowfall: a looping overlay of flakes drifting down over winter ground (4 frames, tiling).
const winter = make('0 0 192 128', [0, 64, 128].flatMap((x) => [0, 64].map((y) => `<svg x="${x}" y="${y}" width="64" height="64" viewBox="0 0 64 64">${inner(read('terrain/ground_winter'))}</svg>`)).join('') + `<svg x="20" y="8" width="84" height="84" viewBox="0 0 128 128">${inner(read('terrain/tree_pine_winter'))}</svg><svg x="20" y="8" width="84" height="84" viewBox="0 0 128 128">${inner(read('terrain/tree_pine_winter_snow'))}</svg>`);
const flakes = (() => {
  const r = rng(21);
  return Array.from({ length: 34 }, () => [r() * 192, r() * 128, 1 + r() * 1.6, r() * TAU]);
})();
const snow = [0, 1, 2, 3].map((i) =>
  over(
    winter,
    flakes
      .map(([x, y, s, ph]) => {
        // Big flakes fall faster; each frame moves a quarter of the way to where the loop starts again.
        const yy = (y + i * 32 * (s / 1.8)) % 128;
        const xx = x + 3 * Math.sin(ph + i * 1.6);
        return `<circle cx="${f1(xx)}" cy="${f1(yy)}" r="${f1(s)}" fill="#ffffff" opacity="${f1(0.55 + s * 0.2)}" />`;
      })
      .join(''),
  ),
);

const B = 140;
board('IdeasExtras.dc.html', {
  title: 'Ideas · Extras',
  kicker: 'Ideas · proposed, not in the game',
  heading: 'Sprites for code, icons, Hardcore and small touches',
  intro: 'The rest of the list: things the renderer draws in code that could be sprites, the app and browser icons the art list still needs, a Hardcore look, and a few small touches.',
  ideas: [
    idea('Drone', 'Drawn in code now: an X with pale discs. As a sprite: a shell with a hazard stripe and a camera eye, two blades on each rotor turning (opposite corners turn the same way, as on a real quadcopter), and nav lights that blink. The item it carries and its shadow stay drawn in code.', [['Now (drawn in code)', still(droneNow, 104)], ['4 frames', frames(drone, 96)], ['Played', play(drone, 16, B)]], 'units/drone_4f'),
    idea('Hub breach', 'Drawn in code now: one blue ring that grows and fades. As a strip: a flash, the shockwave of blue light with a soft edge, a ring of dust behind it, and chunks of the hub thrown out tumbling.', [['Now (drawn in code)', play(breachNow, 7, B, '#24303f')], ['6 frames', frames(breach, 96, '#24303f')], ['Played', play(breach, 7, 200, '#24303f')]], 'effects/hub_breach_6f'),
    idea('Mk2 and Mk3 plates', 'Drawn in code now as a flat plate in the corner. As sprites: a bevelled, riveted plate with raised chevrons and a soft glow while the machine has electricity, and dull without. Shown on the furnace: Mk2 on and off, Mk3 on and off.', [['Now (drawn in code)', frames(plates.now, 110)], ['Proposed', frames(plates.new, 110)]], 'ui/plate_mk2, plate_mk3 (+ _off)'),
    idea('App icon and favicon', 'The app icon is still needed for the stores (1024 × 1024, no transparency). This one sets the logo\'s factory and shield in the clearing at dusk, with pines behind and the hazard stripe along the bottom. The favicon keeps only the shield and its cannon, so it still reads at 16 pixels.', [['Now · logo', still(logo, 160, '#24303f')], ['App icon', still(appIcon, 220, '#24303f')], ['Favicon at 64, 32 and 16', `<div style="display: flex; gap: 14px; align-items: flex-end; background: #24303f; border-radius: 10px; padding: 14px"><img src="${uri(favicon)}" width="64" height="64"><img src="${uri(favicon)}" width="32" height="32"><img src="${uri(favicon)}" width="16" height="16"></div>`]], 'public icons: icon-1024, icon-512, icon-192, favicon'),
    idea('Hardcore bugs', 'From the first art review: more horrifying bugs for Hardcore. The same sprites, darker, with glowing red veins under the shell and a red haze about them. Done as a filter like this, it would cover every bug and its walk and attack strips without redrawing them.', hardBugs.map(([a, h]) => ['Now · Hardcore', frames([a, h], 96)]), 'a filter, or _hard variants'),
    idea('Hardcore nests', 'Hardcore nests are drawn darker and redder in code now. They could also glow red from the burrow and be ringed with bones and chitin. The glow pulses slowly.', [['Now (Hardcore filter)', still(hardNestNow, 170)], ['Proposed · 4 frames', frames(nestPulse, 120)], ['Played', play(nestPulse, 3, 200)]], 'a filter plus an overlay, nests/hard_glow_4f'),
    idea('An idle belt in fall', 'Belts and rollers that carry nothing show nothing. In fall a leaf could drift down and settle on an idle belt, and an idle line slowly gathers a few (blown off again once it runs).', [['4 frames', frames(beltLeaf, 96)], ['Played', play(beltLeaf, 4, 120)], ['A line left idle', still(beltLine, 330)]], 'effects/leaf_settle_4f'),
    idea('Worn terraces', 'Where an extractor has worked a terrace, the shelf could show it: a scarred pit with tool marks, the ore band chipped, gravel spilled down the cliff, and boot prints in the dust.', [['Now', still(terrace(false), 260)], ['Worked', still(terrace(true), 260)]], 'drawn in code with the terraces'),
    idea('Snowfall', 'Leaves already fall at the end of fall; flakes could drift down in winter. A tiling overlay: big flakes fall faster and sway a little.', [['4 frames', frames(snow, 150)], ['Played', play(snow, 5, 300)]], 'effects/snowfall_4f'),
  ],
});
