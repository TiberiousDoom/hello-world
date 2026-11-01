// "More" board: the ship's launch, the engineer, queens, nests, power, night, weather, items and damage.
// node docs/art-canvas/ideas/more.mjs [repo] [out]
import { read, over, make, inner, box, uri, rng, idea, still, play, frames, board, INK, GRASS } from './lib.mjs';

const TAU = Math.PI * 2;
const f1 = (n) => n.toFixed(1);
const four = [0, 1, 2, 3];
/** A sprite placed in a bigger picture. */
const place = (svg, x, y, w, h = w, extra = '') => `<svg x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" viewBox="${box(svg)}" overflow="visible" ${extra}>${inner(svg)}</svg>`;
const grassTiles = (w, h, key = 'terrain/ground') => {
  const g = read(key);
  let s = '';
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) s += place(g, x, y, 64);
  return s;
};

// --- Ship launch: ignition, smoke spreading over the pad, and the ship rising toward the camera.
const ship = (() => {
  const parts = ['ship_engine', 'ship_hull', 'ship_life', 'ship_nav'].map((k) => read(`buildings/${k}`));
  const pad = read('buildings/ship_pad');
  const stack = parts.map((p) => inner(p)).join('');
  const r = rng(3);
  const puffs = Array.from({ length: 18 }, () => [r() * TAU, 0.6 + r() * 0.5, 0.7 + r() * 0.6]);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const t = i / 5;
    const lift = i < 1 ? 0 : (i - 0.5) / 4.5;
    const k = 1 + 0.9 * lift * lift; // nearer the camera, so bigger
    const dx = 10 * lift * lift, dy = -14 * lift * lift;
    let s = place(pad, 0, 0, 192);
    // The ship's shadow stays on the pad and fades as it climbs.
    s += `<ellipse cx="${f1(104 + 20 * lift)}" cy="${f1(108 + 16 * lift)}" rx="${f1(40 * (1 - lift * 0.4))}" ry="${f1(40 * (1 - lift * 0.4))}" fill="#000" opacity="${f1(0.3 * (1 - lift))}" />`;
    // Ignition glow under the engine
    s += `<circle cx="96" cy="96" r="${f1(30 + i * 8)}" fill="#ffb347" opacity="${f1(i === 0 ? 0.35 : 0.5 - t * 0.35)}" /><circle cx="96" cy="96" r="${f1(14 + i * 3)}" fill="#fff4c0" opacity="${f1(0.7 - t * 0.4)}" />`;
    // Smoke rolling out across the pad
    for (const [a, sp, sz] of puffs) {
      const d = 30 + sp * t * 80;
      if (i === 0) continue;
      s += `<circle cx="${f1(96 + d * Math.cos(a))}" cy="${f1(96 + d * Math.sin(a))}" r="${f1(sz * (10 + t * 18))}" fill="${a > 3 ? '#d7d9dc' : '#bfc3c8'}" opacity="${f1(0.85 - t * 0.35)}" />`;
    }
    s += `<g transform="translate(${f1(96 + dx)} ${f1(96 + dy)}) scale(${f1(k)}) translate(-96 -96)" opacity="${f1(i === 5 ? 0.85 : 1)}">${stack}</g>`;
    return make('0 0 192 192', s);
  });
})();
const shipNow = make('0 0 192 192', place(read('buildings/ship_pad'), 0, 0, 192) + ['ship_engine', 'ship_hull', 'ship_life', 'ship_nav'].map((k) => inner(read(`buildings/${k}`))).join(''));

// --- Engineer: carrying, hammering, waving, built from the idle strip's own pieces.
const idleStrip = read('units/engineer_idle_4f');
const enDefs = idleStrip.match(/<defs>([\s\S]*?)<\/defs>/)[1].replace(/<g id="enI\d">[\s\S]*?<\/g>/g, '');
const eng = (body) => make('0 0 64 64', `<defs>${enDefs}</defs>${body}`);
const crateItem = read('buildings/crate');
const carry = four.map((i) => {
  const step = [3, 0, -3, 0][i];
  const bob = [0, -0.6, 0, -0.6][i];
  return eng(
    `<g stroke="${INK}" stroke-width="2.5"><rect x="${15 + step}" y="15" width="12" height="9" rx="4" fill="#3b4252" /><rect x="${15 - step}" y="40" width="12" height="9" rx="4" fill="#3b4252" /></g>` +
      `<g transform="translate(0 ${bob})"><use href="#enTorso" />${place(crateItem, 38, 20, 24)}<g stroke="${INK}" stroke-width="2.5"><rect x="38" y="18" width="9" height="7" rx="3" fill="#e9c39b" /><rect x="38" y="39" width="9" height="7" rx="3" fill="#e9c39b" /></g><use href="#enHat" /></g>`,
  );
});
const hammer = four.map((i) => {
  const a = [-70, -35, 15, -10][i]; // the swing, about the shoulder
  const spark = i === 2 ? `<g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M58 50 l4 -3 M58 53 l5 1 M56 56 l2 4" /></g><circle cx="57" cy="52" r="2.2" fill="#fff4c0" />` : '';
  return eng(
    `<use href="#enBootN" /><use href="#enTorso" />` +
      `<g stroke="${INK}" stroke-width="2.5"><rect x="36" y="13" width="10" height="7" rx="3" fill="#e9c39b" /></g>` +
      `<g transform="rotate(${a} 36 44)"><path d="M38 47 H56" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" /><path d="M38 47 H56" stroke="#a87642" stroke-width="2.4" stroke-linecap="round" /><rect x="53" y="41" width="7" height="12" rx="1.5" fill="#8d99a6" stroke="${INK}" stroke-width="2" /><rect x="36" y="44" width="10" height="7" rx="3" fill="#e9c39b" stroke="${INK}" stroke-width="2.5" /></g>` +
      `<rect x="44" y="49" width="16" height="8" rx="1.5" fill="#d9a866" stroke="${INK}" stroke-width="1.8" opacity="0.9" />${spark}<use href="#enHat" />`,
  );
});
const wave = four.map((i) => {
  const hx = [30, 36, 30, 24][i];
  return eng(
    `<use href="#enBootN" /><use href="#enTorso" />` +
      `<path d="M30 22 L${hx + 4} 9" stroke="#c8600e" stroke-width="5" stroke-linecap="round" /><path d="M30 22 L${hx + 4} 9" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity="0.3" />` +
      `<g stroke="${INK}" stroke-width="2.5"><rect x="${hx}" y="3" width="9" height="9" rx="4" fill="#e9c39b" /><rect x="36" y="44" width="10" height="7" rx="3" fill="#e9c39b" /></g>` +
      (i % 2 ? `<path d="M${hx - 3} 4 q-2 3 0 6 M${hx + 13} 4 q2 3 0 6" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="0.8" />` : '') +
      `<use href="#enHat" transform="rotate(${[0, 8, 0, -8][i]} 33 32)" />`,
  );
});

// --- Queens: a walk (a tripod gait, as for the beetle), a lunge and a summoning call.
const legRe = /<path d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)" fill="none"/g;
function queenWalk(svg, phase) {
  let k = 0;
  const seen = new Map();
  return svg.replace(legRe, (m, hx, hy, kx, ky, fx, fy) => {
    const key = `${hx},${hy}`;
    if (!seen.has(key)) seen.set(key, k++);
    const n = seen.get(key);
    const set = (n % 2) ^ (Math.floor(n / 2) % 2);
    const dx = (set ? 1 : -1) * 3.4 * Math.sin(phase);
    return `<path d="M${hx} ${hy} L${f1(+kx + dx * 0.55)} ${ky} L${f1(+fx + dx)} ${fy}" fill="none"`;
  });
}
const queens = ['crawler', 'brute', 'beetle'].map((kind) => {
  const q = read(`enemies/${kind}_queen`);
  const vb = box(q).split(' ').map(Number);
  const c = vb[2] / 2;
  const walk = four.map((i) => queenWalk(q, (i / 4) * TAU + Math.PI / 2));
  const lunge = [0, -3, 6, 2].map((dx, i) => make(box(q), `<g transform="translate(${dx} 0) translate(${c} ${c}) scale(${[1, 0.97, 1.05, 1][i]} ${[1, 1.03, 0.96, 1][i]}) translate(${-c} ${-c})">${inner(q)}</g>`));
  const summon = four.map((i) => {
    const rings = [0, 0.5].map((o) => {
      const t = (i / 4 + o) % 1;
      return `<circle cx="${c}" cy="${c}" r="${f1(c * (0.45 + t * 0.55))}" fill="none" stroke="#ff4a3a" stroke-width="${f1(4.5 - t * 3)}" opacity="${f1(0.95 - t * 0.75)}" />`;
    });
    const k = [1, 1.06, 1.1, 1.04][i];
    return make(box(q), rings.join('') + `<g transform="translate(${c} ${c}) scale(${k}) translate(${-c} ${-c})">${inner(q)}</g>`);
  });
  return { kind, q, walk, lunge, summon };
});

// --- Bugs coming out of a nest: one crawls up out of the main burrow and away.
const nest = read('nests/warren_3');
const crawler = read('enemies/crawler');
const emerge = [
  [0.22, 0, 0.5, true], [0.34, 3, 0.8, true], [0.42, 12, 1, false], [0.44, 26, 1, false],
].map(([k, d, op, clip], i) => {
  const size = 128 * k;
  const x = 60.2 + d - size / 2, y = 60.2 - size / 2 + d * 0.3;
  const bug = place(crawler, x, y, size, size, clip ? 'clip-path="url(#hole)"' : '');
  const dirt = i < 3 ? [0, 1, 2, 3, 4].map((j) => `<circle cx="${f1(60 + Math.cos(j * 1.3 + i) * (10 + i * 4))}" cy="${f1(60 + Math.sin(j * 1.3 + i) * (9 + i * 4))}" r="${f1(1.6 - i * 0.3)}" fill="#6b4a2c" stroke="${INK}" stroke-width="0.5" />`).join('') : '';
  return make('0 0 128 128', `<defs><clipPath id="hole" clipPathUnits="userSpaceOnUse"><ellipse cx="60.2" cy="${f1(60.2 - (1 - op) * 6)}" rx="${12 + i * 8}" ry="${11 + i * 8}" /></clipPath></defs>${inner(nest)}${bug}${dirt}`);
});

// --- Power: a spark runs along a wire that sags between poles (the wire is a straight line in code now).
const pole = read('buildings/power_pole');
const wireScene = (spark, sag) => {
  const ax = 32, ay = 14, bx = 224, by = 14;
  const my = ay + sag;
  const at = (t) => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * 128 + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * (my * 2 - ay) / 1 + t * t * by];
  let s = grassTiles(256, 72);
  s += place(pole, 0, -4, 64) + place(pole, 192, -4, 64);
  const d = sag ? `M${ax} ${ay} Q128 ${2 * my - ay} ${bx} ${by}` : `M${ax} ${ay} L${bx} ${by}`;
  s += `<path d="${d}" stroke="${INK}" stroke-width="3.4" fill="none" /><path d="${d}" stroke="#d27a3c" stroke-width="1.6" fill="none" />`;
  if (spark !== null) {
    const [x, y] = sag ? at(spark) : [ax + (bx - ax) * spark, ay];
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="#bfe4ff" opacity="0.45" /><circle cx="${f1(x)}" cy="${f1(y)}" r="3" fill="#ffffff" />`;
    s += `<path d="M${f1(x - 10)} ${f1(y)} L${f1(x - 4)} ${f1(y)}" stroke="#bfe4ff" stroke-width="2" stroke-linecap="round" opacity="0.6" />`;
  }
  return make('0 0 256 72', s);
};
const wires = [0.15, 0.38, 0.62, 0.85].map((t) => wireScene(t, 14));

// --- Night: a floodlight's beam sweeping, and fireflies as a sprite.
const flood = read('buildings/floodlight');
const nightScene = (i) => {
  const a = [-14, -4, 6, -4][i];
  let s = grassTiles(256, 192) + `<rect width="256" height="192" fill="#06101e" opacity="0.62" />`;
  s += `<defs><radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2b0" stop-opacity="0.55" /><stop offset="1" stop-color="#fff2b0" stop-opacity="0" /></radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.55" /><stop offset="1" stop-color="#fff6c8" stop-opacity="0" /></linearGradient></defs>`;
  s += `<g transform="rotate(${a} 128 50)"><path d="M118 52 L138 52 L196 190 L60 190 Z" fill="url(#beam)" /><ellipse cx="128" cy="160" rx="60" ry="30" fill="url(#pool)" /></g>`;
  s += place(flood, 96, 18, 64);
  return make('0 0 256 192', s);
};
const night = four.map(nightScene);
const firefly = four.map((i) => {
  const glow = [0.2, 0.7, 1, 0.4][i];
  return make('0 0 32 32', `<circle cx="16" cy="16" r="${f1(6 + 6 * glow)}" fill="#e8ff7a" opacity="${f1(0.3 * glow)}" /><circle cx="16" cy="16" r="${f1(2 + 2 * glow)}" fill="#f4ffb0" opacity="${f1(0.4 + 0.6 * glow)}" /><ellipse cx="13" cy="16" rx="3" ry="2" fill="#3a3020" stroke="${INK}" stroke-width="0.8" /><path d="M12 14 l-2 -3 M12 18 l-2 3" stroke="#dff2ff" stroke-width="1.2" opacity="${i % 2 ? 0.3 : 0.7}" />`);
});
const fireflies = (() => {
  const r = rng(13);
  const spots = Array.from({ length: 9 }, () => [r() * 240 + 8, r() * 170 + 10, Math.floor(r() * 4)]);
  return four.map((i) => make('0 0 256 192', grassTiles(256, 192) + `<rect width="256" height="192" fill="#06101e" opacity="0.62" />` + spots.map(([x, y, o]) => place(firefly[(i + o) % 4], x + Math.sin(i + o) * 3, y + Math.cos(i * 1.3 + o) * 3, 32)).join('')));
})();

// --- Weather: rain on spring ground, ripples on a pond, fog drifting at dawn.
const rain = (() => {
  const r = rng(31);
  const drops = Array.from({ length: 40 }, () => [r() * 256, r() * 192]);
  const splashes = Array.from({ length: 8 }, () => [r() * 256, r() * 192, Math.floor(r() * 4)]);
  return four.map((i) =>
    make(
      '0 0 256 192',
      grassTiles(256, 192, 'terrain/ground_spring') + `<rect width="256" height="192" fill="#20304a" opacity="0.25" />` +
        drops.map(([x, y]) => { const yy = (y + i * 48) % 192; const xx = (x - i * 12 + 256) % 256; return `<path d="M${f1(xx)} ${f1(yy)} l-3 9" stroke="#cfe6ff" stroke-width="1.3" stroke-linecap="round" opacity="0.7" />`; }).join('') +
        splashes.map(([x, y, o]) => { const t = ((i + o) % 4) / 3; return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(1 + t * 5)}" ry="${f1(0.6 + t * 3)}" fill="none" stroke="#e8f4ff" stroke-width="1" opacity="${f1(0.9 - t * 0.8)}" />`; }).join(''),
    ),
  );
})();
const pond = four.map((i) => {
  let s = grassTiles(256, 192) + `<path d="M40 60 Q60 20 130 30 Q220 36 222 100 Q216 170 128 168 Q40 166 34 110 Q30 80 40 60 Z" fill="#6b5236" /><path d="M50 64 Q68 32 130 40 Q208 46 210 100 Q204 158 128 156 Q50 154 46 108 Q44 82 50 64 Z" fill="#2f6f8f" /><path d="M80 80 Q100 60 140 66 Q180 74 178 104 Q172 134 128 132 Q84 130 80 106 Z" fill="#245a78" />`;
  for (const [cx, cy, o] of [[110, 90, 0], [160, 120, 2], [90, 128, 1]]) for (const j of [0, 1]) {
    const t = (((i + o) % 4) / 4 + j * 0.5) % 1;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${f1(3 + t * 22)}" ry="${f1(2 + t * 13)}" fill="none" stroke="#cdeefc" stroke-width="${f1(1.6 - t)}" opacity="${f1(0.85 - t * 0.8)}" />`;
  }
  s += `<path d="M70 60 q8 -3 16 0 M150 48 q10 -3 20 0" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.5" />`;
  return make('0 0 256 192', s);
});
const fog = (() => {
  const r = rng(41);
  const banks = Array.from({ length: 12 }, () => [r() * 300, 10 + r() * 175, 70 + r() * 60, 0.6 + r() * 0.8]);
  return four.map((i) =>
    make(
      '0 0 256 192',
      `<defs><filter id="fg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter></defs>` + grassTiles(256, 192) + `<rect width="256" height="192" fill="#ffd9b0" opacity="0.12" />` +
        `<g filter="url(#fg)">${banks.map(([x, y, w, sp]) => `<ellipse cx="${f1(((x + i * 10 * sp) % 300) - 20)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(w * 0.16)}" fill="#eef2f6" opacity="0.38" />`).join('')}</g>`,
    ),
  );
})();

// --- Items: ore that glints, and an ingot still hot from the furnace, cooling as it rides the belt.
const ore = read('items/iron_ore');
const glint = four.map((i) => (i === 3 ? ore : over(ore, `<g transform="translate(${[18, 26, 34][i]} ${[14, 20, 26][i]}) scale(${[0.6, 1, 0.6][i]})"><path d="M0 -6 L1.2 -1.2 L6 0 L1.2 1.2 L0 6 L-1.2 1.2 L-6 0 L-1.2 -1.2 Z" fill="#ffffff" /><circle r="2" fill="#ffffff" /></g>`)));
const ingot = read('items/iron_ingot');
const hot = [1, 0.66, 0.33, 0].map((h) =>
  h === 0 ? ingot : make(box(ingot), `<defs><filter id="ht" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${f1(1 - 0.3 * h)} 0 0 0 ${f1(0.9 * h)}  0 ${f1(1 - 0.5 * h)} 0 0 ${f1(0.35 * h)}  0 0 ${f1(1 - 0.8 * h)} 0 0  0 0 0 1 0" /></filter></defs><circle cx="${Number(box(ingot).split(' ')[2]) / 2}" cy="${Number(box(ingot).split(' ')[3]) / 2}" r="${Number(box(ingot).split(' ')[2]) * 0.45}" fill="#ff7a2a" opacity="${f1(0.35 * h)}" /><g filter="url(#ht)">${inner(ingot)}</g>`),
);

// --- Damage: scaffolding while a building is repaired, and a burnt-out ruin that smoulders.
const furnace = read('buildings/furnace');
const fv = Number(box(furnace).split(' ')[2]);
const scaffold = four.map((i) => {
  const s = fv / 128;
  const poles = `<g transform="scale(${s})"><g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M10 10 V118 M118 10 V118 M10 10 H118 M10 118 H118 M10 10 L118 118" /></g><g stroke="#c08a52" stroke-width="3" stroke-linecap="round"><path d="M10 10 V118 M118 10 V118 M10 10 H118 M10 118 H118 M10 10 L118 118" /></g>` +
    `<g fill="#d9a866" stroke="${INK}" stroke-width="1.6"><rect x="14" y="56" width="100" height="10" rx="2" /><rect x="56" y="14" width="10" height="44" rx="2" /></g>` +
    `<g fill="#c9d2de" stroke="${INK}" stroke-width="1.2"><circle cx="10" cy="10" r="3" /><circle cx="118" cy="10" r="3" /><circle cx="10" cy="118" r="3" /><circle cx="118" cy="118" r="3" /></g>` +
    (i === 1 || i === 3 ? `<g transform="translate(${i === 1 ? 86 : 30} 92)"><circle r="6" fill="#fff4c0" opacity="0.7" /><path d="M-8 -6 l4 3 M8 -6 l-4 3 M0 -9 v4 M-7 6 l4 -3 M7 6 l-4 -3" stroke="#ffd36b" stroke-width="2" stroke-linecap="round" /></g>` : '') + '</g>';
  return over(furnace, poles);
});
const ruin = four.map((i) => {
  const r = rng(7);
  let s = `<defs><filter id="burn" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.12 0.1 0.04 0 0.04  0.09 0.09 0.04 0 0.035  0.08 0.08 0.04 0 0.035  0 0 0 1 0" /></filter></defs>`;
  s += `<g filter="url(#burn)" transform="translate(${fv / 2} ${fv / 2}) scale(0.92 0.86) rotate(-3) translate(${-fv / 2} ${-fv / 2})">${inner(furnace)}</g>`;
  const sc = fv / 128;
  for (let k = 0; k < 7; k++) {
    const x = (20 + r() * 88) * sc, y = (20 + r() * 88) * sc, on = (k + i) % 3 === 0;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(3 * sc)}" fill="${on ? '#ff8a2a' : '#7a2a10'}" opacity="${on ? 0.95 : 0.7}" />` + (on ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(7 * sc)}" fill="#ff5a1a" opacity="0.3" />` : '');
  }
  for (let k = 0; k < 3; k++) {
    const t = ((i + k * 1.3) % 4) / 4;
    s += `<circle cx="${f1((40 + k * 25 + t * 12) * sc)}" cy="${f1((70 - t * 60) * sc)}" r="${f1((6 + t * 12) * sc)}" fill="#5a5a5e" opacity="${f1(0.55 - t * 0.45)}" />`;
  }
  return make(box(furnace), s);
});

const B = 140;
board('IdeasMore.dc.html', {
  title: 'Ideas · More',
  kicker: 'Ideas · proposed, not in the game',
  heading: 'More: launch, people, queens, power, night and weather',
  intro: 'The second list: the ship\'s launch, the engineer, queens and nests, power lines, night, weather, items on belts and damage. As on the other boards, each is built from the game\'s own sprites where it has them.',
  ideas: [
    idea('Ship launch', 'At launch the game shakes the shipyard and draws engine flames in code. As a sequence: the pad lights up, smoke rolls out across it, and the ship rises toward the camera (growing as it climbs), its shadow left fading on the pad.', [['Now', still(shipNow, 170)], ['6 frames', frames(ship, 104)], ['Played', play(ship, 5, 200)]], 'effects/launch_6f, drawn with the ship'),
    idea('Engineer', 'Three new strips from the engineer\'s own pieces: carrying a crate in both hands, with a bob in its step; hammering, with a spark on the strike, for building and repairs; and waving, for when a co-op player joins.', [
      [['Carry · 4 frames', frames(carry, 84)], ['Played', play(carry, 8, 120)]],
      [['Hammer · 4 frames', frames(hammer, 84)], ['Played', play(hammer, 8, 120)]],
      [['Wave · 4 frames', frames(wave, 84)], ['Played', play(wave, 6, 120)]],
    ], 'units/engineer_carry_4f, engineer_build_4f, engineer_wave_4f'),
    ...queens.map((q) =>
      idea(`${q.kind[0].toUpperCase() + q.kind.slice(1)} queen`, `Queens only sway as they walk now. A walk like the beetle\'s, a lunge when she attacks, and a summoning call, with red rings of scent going out, when a raid comes from her nest.`, [
        [['Now', still(q.q, 96)], ['Walk', frames(q.walk, 80)], ['Played', play(q.walk, 6, 112)]],
        [['Attack', frames(q.lunge, 80)], ['Played', play(q.lunge, 8, 112)], ['Summon', frames(q.summon, 80)], ['Played', play(q.summon, 5, 112)]],
      ], `enemies/${q.kind}_queen_walk_4f, _attack_4f, _summon_4f`),
    ),
    idea('Bugs leaving a nest', 'A bug crawls up out of the main burrow: its head in the hole, half out, then out and away, with dirt kicked up. Played whenever a nest sends one out.', [['4 frames', frames(emerge, 120)], ['Played', play(emerge, 4, 170)]], 'effects/nest_emerge_4f'),
    idea('Power lines', 'The wires between poles are straight lines in code now. They could sag between the poles, with a spark running along them while power flows.', [['Now (drawn in code)', still(wireScene(null, 0), 256)], ['Proposed · 4 frames', frames(wires, 150)], ['Played', play(wires, 6, 256)]], 'drawn in code; effects/wire_spark'),
    idea('Floodlight at night', 'The light at night is a pool drawn in code now. A beam could sweep slowly from side to side, lighting a pool where it lands.', [['4 frames', frames(night, 160)], ['Played', play(night, 2, 300)]], 'drawn in code'),
    idea('Fireflies', 'Fireflies are dots drawn in code now. As a sprite: a tiny beetle whose tail glows up and fades, wings flickering. A few drift over the clearing at night, each blinking in its own time.', [['Sprite · 4 frames (32 × 32)', frames(firefly, 72, '#0e1726')], ['At night', play(fireflies, 4, 300)]], 'effects/firefly_4f'),
    idea('Rain in spring', 'Streaks of rain slant across the map, and splashes ring out where drops land.', [['4 frames', frames(rain, 150)], ['Played', play(rain, 10, 300)]], 'effects/rain_4f (a tiling overlay)'),
    idea('Pond ripples', 'Ponds are drawn in code with glints close up. Rings could spread out over the water, as if fish rise or rain falls.', [['4 frames', frames(pond, 150)], ['Played', play(pond, 4, 300)]], 'drawn in code with the ponds'),
    idea('Dawn fog', 'Soft banks of fog drift slowly across the clearing at dawn and thin out as the day comes on.', [['4 frames', frames(fog, 150)], ['Played', play(fog, 2, 300)]], 'effects/fog (a tiling overlay)'),
    idea('Items on belts', 'Ore glints now and then as it rides a belt. An ingot leaves the furnace glowing hot and cools to its own colour over a few tiles.', [['Ore glint · 4 frames', frames(glint, 72, '#262b35')], ['Played', play(glint, 6, 110, '#262b35')], ['Hot ingot, cooling', frames(hot, 72, '#262b35')], ['Played', play(hot, 2, 110, '#262b35')]], 'items: a glint overlay; iron_ingot_hot'),
    idea('Repairs and ruins', 'While a building is repaired, timber scaffolding stands round it, with sparks where the work is. A building that is destroyed could leave a burnt-out ruin that smoulders, with embers and smoke, until it is cleared.', [['Under repair · 4 frames', frames(scaffold, 84)], ['Played', play(scaffold, 6, 120)], ['Ruin · 4 frames', frames(ruin, 84)], ['Played', play(ruin, 4, 120)]], 'effects/scaffold (sized to the building), ruin_4f'),
  ],
});
