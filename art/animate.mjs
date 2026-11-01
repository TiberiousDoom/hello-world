// Builds the firing and damage animations from their still sprites, as working.mjs does for machines: the
// trebuchet's arm swinging over, the ballista's string snapping forward, and the smoke and flames on a
// damaged building. Run `node art/animate.mjs` after redrawing one of those sprites.
//
// Each change is a find-and-replace on the sprite's own markup, so a redraw that moves a part makes this
// fail loudly rather than animate the wrong thing.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art');

/** Replaces `find` (which must occur exactly once) in `svg`. */
function swap(svg, find, replace, what) {
  const n = svg.split(find).length - 1;
  if (n !== 1) throw new Error(`${what}: expected one match for ${JSON.stringify(find.slice(0, 60))}, found ${n}`);
  return svg.replace(find, replace);
}

/** The frames side by side in one strip; each frame's ids get their own suffix so they don't clash. */
function strip(frames) {
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(frames[0])?.[1] ?? 64);
  const parts = frames.map((svg, i) => {
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    let s = inner;
    for (const id of ids) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`).replaceAll(`href="#${id}"`, `href="#${id}-f${i}"`);
    return `<svg x="${i * size}" y="0" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frames.length * size} ${size}">\n${parts.join('\n')}\n</svg>\n`;
}

const read = (key) => readFileSync(join(ART, `${key}.svg`), 'utf8');
const write = (key, svg) => {
  writeFileSync(join(ART, `${key}.svg`), svg);
  console.log(`${key}.svg`);
};

// --- The trebuchet throws (D-107): seen from above, the arm swinging over its axle shortens and flips.
// Frame by frame: drawn back, nearly upright, past upright with the sling whipping the stone out, flung
// forward with the sling flying free, rebounding, and settled with the sling empty.
{
  const still = read('buildings/trebuchet_barrel');
  const ARM = '<g id="taArm" transform="matrix(1 0 0 1 0 0)">';
  const sling = still.slice(still.indexOf('<g id="taSling">'), still.indexOf('</g>', still.indexOf('<circle cx="42.5" cy="40.4"')) + 4);
  const rope = (d) => `<path d="${d}" fill="none" stroke="#0f1a2e" stroke-width="2" stroke-linecap="round" /><path d="${d}" fill="none" stroke="#d6bf86" stroke-width="1" stroke-linecap="round" />`;
  const pouch = (x, y, stone) =>
    `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.6" fill="#8a6a44" stroke="#0f1a2e" stroke-width="1.3" />` +
    (stone ? `<circle cx="${x}" cy="${y}" r="3" fill="#bdb8ad" stroke="#0f1a2e" stroke-width="1.2" /><circle cx="${x - 1}" cy="${y - 1.1}" r="0.9" fill="#ffffff" opacity="0.6" />` : '');
  const empty = `<g id="taSling">${rope('M57 31 Q53 38 47 40.5 M57 33 Q55 41 48 42')}${pouch(46, 41.5, false)}</g>`;
  // [the arm's x scale about the pivot, its sling, what flies outside the arm]
  const frames = [
    [-1, sling, ''],
    [-0.35, sling, ''],
    [0.4, '<g id="taSling"></g>', rope('M42.8 32 Q52 30 59 28') + pouch(59.5, 27.5, true)],
    [1, '<g id="taSling"></g>', rope('M58 32 Q61 29 62 25') + pouch(61.5, 23.5, false)],
    [0.86, '<g id="taSling"></g>', rope('M54 32 Q59 36 60 40') + pouch(60, 41.5, false)],
    [1, empty, ''],
  ];
  write(
    'buildings/trebuchet_barrel_fire_6f',
    strip(
      frames.map(([sx, sl, extra]) => {
        let svg = swap(still, ARM, `<g id="taArm" transform="matrix(${sx} 0 0 1 ${32 - 32 * sx} 0)">`, 'trebuchet arm');
        svg = swap(svg, sling, sl, 'trebuchet sling');
        return swap(svg, '        <!-- The pivot -->', `${extra}\n        <!-- The pivot -->`, 'trebuchet pivot');
      }),
    ),
  );
}

// --- The ballista looses a bolt: the string snaps forward to the bow, quivers, and is drawn back.
{
  const still = read('buildings/ballista_barrel');
  const STRING = '<path d="M45 7 L22 32 L45 57" fill="none" stroke="#efe4c8"';
  const BOW = 'd="M45 7 Q60 20 52 32 Q60 44 45 57"';
  // The bow's curve is drawn twice (its outline, then its wood).
  if (still.split(BOW).length !== 3) throw new Error('ballista bow: expected its curve twice');
  const frame = (string, bow) => swap(still, STRING, `<path d="${string}" fill="none" stroke="#efe4c8"`, 'ballista string').replaceAll(BOW, `d="${bow}"`);
  write(
    'buildings/ballista_barrel_fire_3f',
    strip([frame('M46 9 L50 32 L46 55', 'M46 9 Q56 20 50 32 Q56 44 46 55'), frame('M45.5 8 L38 32 L45.5 56', 'M45.5 8 Q58 20 51 32 Q58 44 45.5 56'), still]),
  );
}

// --- Damage (D-075): smoke drifts up and away from a hurt building; a badly hurt one also burns.
/** Puffs of smoke rising along a line from (x, y) by (dx, dy), at four steps that loop. */
function smoke(x, y, dx, dy, r, fill, opacity, i) {
  let out = '';
  for (let k = 0; k < 3; k++) {
    const t = (k + i / 4) / 3; // 0 at the source, 1 where it has faded away
    out += `<circle cx="${(x + dx * t).toFixed(1)}" cy="${(y + dy * t).toFixed(1)}" r="${(r * (0.7 + 0.6 * t)).toFixed(1)}" fill="${fill}" opacity="${(opacity * Math.min(1, 4 * t) * (1 - t)).toFixed(2)}" />`;
  }
  return out;
}
{
  const still = read('effects/damage_1');
  const SMOKE = still.slice(still.indexOf('<g fill="#8a857c">'), still.indexOf('</g>', still.indexOf('<g fill="#8a857c">')) + 4);
  write('effects/damage_1_4f', strip([0, 1, 2, 3].map((i) => swap(still, SMOKE, `<g>${smoke(38, 24, 16, -22, 6.5, '#8a857c', 0.9, i)}</g>`, 'damage smoke'))));
}
{
  const still = read('effects/damage_2');
  const FLAME = '<path d="M30 44 Q26 36 31 30 Q32 36 36 34 Q36 28 40 26 Q44 34 40 44 Z" fill="#ff8a3d" />';
  const CORE = '<path d="M33 44 Q31 39 34 36 Q35 39 37 38 Q39 41 37 44 Z" fill="#fff3b0" />';
  const SMOKE = still.slice(still.indexOf('<g fill="#3a3632">'), still.indexOf('</g>', still.indexOf('<g fill="#3a3632">')) + 4);
  const SPARK = '<circle cx="22" cy="34" r="6" fill="#ffd36b" opacity="0.3" />';
  // The flames stretch and lean from their base, never the same twice in a row.
  const flames = [
    [1, 0],
    [1.22, -1.5],
    [0.88, 1],
    [1.12, 1.6],
  ];
  write(
    'effects/damage_2_4f',
    strip(
      flames.map(([sy, lean], i) => {
        const at = (s) => `<g transform="matrix(1 0 ${(lean / 10).toFixed(2)} ${sy} ${(-lean * 4.4).toFixed(1)} ${(44 - 44 * sy).toFixed(1)})">${s}</g>`;
        let svg = swap(still, FLAME, at(`${FLAME}<path d="M38 44 Q36 40 39 37 Q41 40 43 44 Z" fill="#ff5a2a" opacity="${i % 2 ? 0.9 : 0.6}" />`), 'damage flame');
        svg = swap(svg, CORE, at(CORE), 'damage core');
        svg = swap(svg, SPARK, `<circle cx="22" cy="34" r="${[6, 4.5, 7, 5][i]}" fill="#ffd36b" opacity="${[0.3, 0.15, 0.4, 0.2][i]}" />`, 'damage spark');
        return swap(svg, SMOKE, `<g>${smoke(40, 22, 14, -24, 8, '#3a3632', 0.85, i)}</g>`, 'damage smoke');
      }),
    ),
  );
}

const f1 = (n) => n.toFixed(1);

// --- The wasp (D-156): a wingbeat that loops (the wings sweep and shorten as they rise, blurring on the
// fast frames), and a sting: the abdomen draws back and stabs forward, with a drop of venom on the strike.
{
  const still = read('enemies/wasp');
  const WINGS = still.slice(still.indexOf('<g fill="#dff2ff" fill-opacity="0.55"'), still.indexOf('</g>', still.indexOf('<g fill="#dff2ff" fill-opacity="0.55"')) + 4);
  const wing = (d, rx, ry, a, s) => `<path d="${d}" transform="translate(${rx} ${ry}) rotate(${a}) scale(1 ${s}) translate(${-rx} ${-ry})" />`;
  // Upper wings turn about their root at (35, 28), lower ones mirrored about (35, 36).
  const set = (a, s, op) =>
    `<g fill="#dff2ff" fill-opacity="${op}" stroke="#0f1a2e" stroke-width="1.2" stroke-opacity="${op > 0.3 ? 1 : 0.3}">` +
    wing('M34 28 Q30 6 44 4 Q50 10 38 28 Z', 35, 28, a, s) + wing('M34 36 Q30 58 44 60 Q50 54 38 36 Z', 35, 36, -a, s) +
    wing('M32 28 Q20 12 26 8 Q34 12 36 28 Z', 34, 28, a, s) + wing('M32 36 Q20 52 26 56 Q34 52 36 36 Z', 34, 36, -a, s) + '</g>';
  const wings = (a, s, blur) => (blur ? set(a, s, 0.18) + set(a, s, 0.45) : set(a, s, 0.55));
  write('enemies/wasp_walk_4f', strip([[-16, 1, false], [0, 0.72, true], [16, 0.5, true], [2, 0.8, false]].map(([a, s, b]) => swap(still, WINGS, wings(a, s, b), 'wasp wings'))));

  const STINGER = '<path d="M4 32 L10 30 L10 34 Z"';
  const STRIPES_END = still.indexOf('</g>', still.indexOf('<g fill="#1a1408"><rect')) + 4;
  write(
    'enemies/wasp_attack_4f',
    strip(
      [1, 0.86, 1.14, 1].map((sx, i) => {
        let w = swap(still, WINGS, wings(-6, [0.8, 0.7, 0.6, 0.75][i], false), 'wasp wings');
        // The abdomen and stinger pull back and stab forward about the waist (x 31).
        const a = w.indexOf(STINGER);
        const b = w.indexOf('</g>', w.indexOf('<g fill="#1a1408"><rect')) + 4;
        if (a < 0 || STRIPES_END < 4) throw new Error('wasp abdomen: not found');
        w = w.slice(0, a) + `<g transform="translate(31 32) scale(${sx} ${Math.min(1, 2 - sx)}) translate(-31 -32)">${w.slice(a, b)}</g>` + w.slice(b);
        const tip = 31 - 27 * sx;
        if (i === 2) w = w.replace(/<\/svg>\s*$/, `<path d="M${f1(tip)} 32 l-3 0" stroke="#fff3c4" stroke-width="1.2" stroke-linecap="round" /><circle cx="${f1(tip - 4)}" cy="32" r="1.6" fill="#a8f06a" stroke="#0f1a2e" stroke-width="0.6" /></svg>`);
        if (i === 3) w = w.replace(/<\/svg>\s*$/, `<circle cx="${f1(tip - 2)}" cy="34.5" r="1.2" fill="#a8f06a" opacity="0.8" /></svg>`);
        return w;
      }),
    ),
  );
}

// --- The beetle (D-156): a tripod gait (three legs swing while the other three hold, then they trade),
// and a bite: the mandibles spread, the head pulls back, then lunges and snaps shut.
{
  const still = read('enemies/beetle');
  const LEGS = 'M22 17 L19 11 L13 7 M32 16 L33 9 L30 4 M41 22 L46 16 L51 12 M22 47 L19 53 L13 57 M32 48 L33 55 L30 60 M41 42 L46 48 L51 52';
  if (still.split(LEGS).length !== 3) throw new Error('beetle legs: expected their path twice');
  const legs = [
    [[22, 17], [19, 11], [13, 7], 1], [[32, 16], [33, 9], [30, 4], -1], [[41, 22], [46, 16], [51, 12], 1],
    [[22, 47], [19, 53], [13, 57], -1], [[32, 48], [33, 55], [30, 60], 1], [[41, 42], [46, 48], [51, 52], -1],
  ];
  const step = (phase) => legs.map(([h, k, f, set]) => { const dx = set * 3.2 * Math.sin(phase); return `M${h[0]} ${h[1]} L${f1(k[0] + dx * 0.55)} ${k[1]} L${f1(f[0] + dx)} ${f[1]}`; }).join(' ');
  write('enemies/beetle_walk_4f', strip([0, 1, 2, 3].map((i) => still.split(LEGS).join(step((i / 4) * Math.PI * 2 + Math.PI / 2)))));

  const MANDIBLES = '<path d="M56 28 Q61.5 25.5 62.5 29.5 Q60 29 57.5 30.5 M56 36 Q61.5 38.5 62.5 34.5 Q60 35 57.5 33.5" fill="#2a2f3c" stroke="#0f1a2e" stroke-width="1.4" stroke-linejoin="round" />';
  const jaw = (d, cx, cy, a) => `<path d="${d}" transform="rotate(${a} ${cx} ${cy})" fill="#2a2f3c" stroke="#0f1a2e" stroke-width="1.4" stroke-linejoin="round" />`;
  write(
    'enemies/beetle_attack_4f',
    strip(
      [[18, 0], [32, -1.2], [-4, 2.4], [6, 1]].map(([open, lunge]) => {
        let s = swap(still, MANDIBLES, jaw('M56 28 Q61.5 25.5 62.5 29.5 Q60 29 57.5 30.5', 56.5, 29.5, -open) + jaw('M56 36 Q61.5 38.5 62.5 34.5 Q60 35 57.5 33.5', 56.5, 34.5, open), 'beetle mandibles');
        s = swap(s, '<!-- Armoured collar, head and mandibles -->', `<g transform="translate(${lunge} 0)">`, 'beetle head');
        return s.replace(/<\/svg>\s*$/, '</g></svg>');
      }),
    ),
  );
}

// --- Guns recoil (D-156): the barrel kicks back under the turret's head and eases out over five frames,
// with a wisp of smoke at the muzzle; the bigger the gun, the harder the kick.
{
  /** The sprite's top-level elements, keeping a <g>…</g> block whole, with the ones `isTube` picks moved by dx. */
  const recoil = (svg, isTube, dx) => {
    const vb = /viewBox="([^"]+)"/.exec(svg)[1];
    const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const defs = /<defs>[\s\S]*?<\/defs>/.exec(body)?.[0] ?? '';
    const rest = body.replace(defs, '');
    const parts = rest.match(/<g\b[^>]*>[\s\S]*?<\/g>|<[a-z]+\b[^>]*\/>/g);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs}${parts.map((p) => (isTube(p) ? `<g transform="translate(${f1(dx)} 0)">${p}</g>` : p)).join('')}</svg>`;
  };
  const first = (p) => {
    const m = /\b(?:x|cx)="([\d.]+)"|d="M\s*([\d.]+)/.exec(p);
    return m ? Number(m[1] ?? m[2]) : 0;
  };
  const puff = (x, y, k, sc) =>
    k === 0 ? '' : `<g opacity="${f1(0.75 - k * 0.17)}">${[0, 1, 2].map((j) => `<circle cx="${f1(x - sc * (1 + k * 1.5 + j * 1.5))}" cy="${f1(y - sc * (1 + k * 2) + sc * (j - 1) * 1.5)}" r="${f1(sc * (1.2 + k * 0.7))}" fill="#dfe4ea" />`).join('')}</g>`;
  const notHead = (p) => !p.startsWith('<circle');
  const GUNS = [
    ['turret', (p) => first(p) >= 34 && notHead(p), 4, [[61, 27], [61, 37]], 1],
    ['turret2', (p) => first(p) >= 34 && notHead(p), 3, [[61, 30], [61, 34]], 1],
    ['cannon', (p) => first(p) >= 34 && notHead(p) && !p.startsWith('<ellipse cx="28'), 6, [[62, 32]], 1.2],
    ['mortar', (p) => first(p) >= 30 && notHead(p) && !p.startsWith('<g'), 3.5, [[57, 32]], 1.3],
    ['artillery', (p) => first(p) >= 58, 11, [[124, 64]], 2.6],
  ];
  for (const [key, isTube, d, muzzles, sc] of GUNS) {
    const still = read(`buildings/${key}_barrel`);
    const moved = still.match(/<rect\b[^>]*\/>|<path\b[^>]*\/>|<ellipse\b[^>]*\/>|<g\b[^>]*>[\s\S]*?<\/g>/g).filter(isTube);
    if (moved.length < 2) throw new Error(`${key} barrel: found only ${moved.length} parts to move`);
    write(
      `buildings/${key}_barrel_fire_5f`,
      strip([1, 0.62, 0.32, 0.12, 0].map((k, i) => recoil(still, isTube, -d * k).replace(/<\/svg>$/, `${muzzles.map(([x, y]) => puff(x - d * k, y, i, sc)).join('')}</svg>`))),
    );
  }
}

// --- The railgun charges (D-157): its copper coils heat from the back forward and glow white along the
// rails, it fires, and they cool. Frames: charging (3), firing, cooling.
{
  const still = read('buildings/railgun_barrel');
  const COILS = '<g fill="#d98a3a" stroke="#0f1a2e" stroke-width="1.5"><rect x="76" y="46" width="6" height="36" rx="2" /><rect x="94" y="46" width="6" height="36" rx="2" /></g>';
  const LINE = '<path d="M66 64 H118" stroke="#6ec8ff" stroke-width="3" stroke-linecap="round" opacity="0.85" />';
  const glow = (x, c) => (c === '#d98a3a' ? '' : `<rect x="${x - 4}" y="42" width="14" height="44" rx="5" fill="${c}" opacity="0.35" />`);
  write(
    'buildings/railgun_barrel_charge_5f',
    strip(
      [
        ['#e8a050', '#d98a3a', 0.5, 0],
        ['#ffd6a0', '#e8a050', 0.7, 0],
        ['#eaf8ff', '#cfefff', 1, 0],
        ['#ffffff', '#ffffff', 1, 1],
        ['#f0b070', '#d98a3a', 0.6, 0],
      ].map(([back, front, line, fire]) => {
        let t = swap(still, COILS, `${glow(76, back)}${glow(94, front)}<g stroke="#0f1a2e" stroke-width="1.5"><rect x="76" y="46" width="6" height="36" rx="2" fill="${back}" /><rect x="94" y="46" width="6" height="36" rx="2" fill="${front}" /></g>`, 'railgun coils');
        t = swap(t, LINE, `<path d="M66 64 H118" stroke="#6ec8ff" stroke-width="${2 + line * 3}" stroke-linecap="round" opacity="${line}" />${line === 1 ? '<path d="M66 64 H118" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />' : ''}`, 'railgun line');
        return fire ? t.replace(/<\/svg>\s*$/, '<circle cx="122" cy="64" r="5.5" fill="#bfe9ff" opacity="0.6" /><circle cx="122" cy="64" r="3" fill="#ffffff" /></svg>') : t;
      }),
    ),
  );
}

// --- The tesla's bolt (D-157): three jagged bolts, each with a glow, a white core and forks, drawn
// stretched from the tesla to the bug (the code drew one bolt itself before). 128 × 32, from left to right.
{
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const bolt = () => {
    const pts = [[4, 16]];
    for (let x = 14; x < 124; x += 10) pts.push([x + (rnd() - 0.5) * 4, 16 + (rnd() - 0.5) * 16]);
    pts.push([124, 16]);
    const d = 'M' + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L');
    let forks = '';
    for (let k = 0; k < 3; k++) {
      const [x, y] = pts[2 + Math.floor(rnd() * (pts.length - 4))];
      const dir = rnd() < 0.5 ? -1 : 1;
      forks += `M${f1(x)} ${f1(y)} L${f1(x + 6 + rnd() * 4)} ${f1(y + dir * (4 + rnd() * 3))} L${f1(x + 12 + rnd() * 4)} ${f1(y + dir * (6 + rnd() * 4))}`;
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 32">` +
      `<path d="${d}" fill="none" stroke="#3fa9f5" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity="0.25" />` +
      `<path d="${d}${forks}" fill="none" stroke="#8fd0ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />` +
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />` +
      `<circle cx="124" cy="16" r="5" fill="#bfe9ff" opacity="0.6" /><circle cx="124" cy="16" r="2.4" fill="#ffffff" /></svg>`
    );
  };
  const frames = [bolt(), bolt(), bolt()];
  // Not square, so laid out here rather than by strip().
  write('effects/tesla_bolt_3f', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 32">\n${frames.map((f, i) => f.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 32">', `<svg x="${i * 128}" y="0" width="128" height="32" viewBox="0 0 128 32">`)).join('\n')}\n</svg>\n`);
}

// --- Storage that shows how full it is (D-157). The crate opens to show what it holds (the game draws the
// item in it); the Storage Unit's compartments fill with goods; the silo lights a gauge round its roof.
{
  const crate = read('buildings/crate');
  let open = swap(crate, '<path d="M9 9 L55 55 M55 9 L9 55" stroke="#7a4a22"', '<path d="M9 9 L55 55 M55 9 L9 55" opacity="0" stroke="#7a4a22"', 'crate lid');
  open = swap(open, '<path d="M9 9 L55 55 M55 9 L9 55" stroke="#c48f52"', '<path d="M9 9 L55 55 M55 9 L9 55" opacity="0" stroke="#c48f52"', 'crate lid');
  open = swap(open, '<path d="M5 18 H59 M5 32 H59 M5 46 H59" stroke="#8a5a32"', '<rect x="8" y="8" width="48" height="48" rx="2" fill="#4a2f18" /><path d="M8 8 H56" stroke="#2a1a0c" stroke-width="3" opacity="0.6" /><path d="M5 18 H59 M5 32 H59 M5 46 H59" opacity="0" stroke="#8a5a32"', 'crate inside');
  write('buildings/crate_open', open);

  const unit = read('buildings/storage');
  const slots = [[10, 10], [34, 10], [10, 48], [34, 48], [10, 86], [34, 86]];
  /** Goods in a compartment: sacks and boxes, not any one item (the unit holds a mix). */
  const goods = (x, y, k) =>
    k % 2
      ? `<g stroke="#0f1a2e" stroke-width="1.2"><rect x="${x + 3}" y="${y + 14}" width="14" height="14" rx="1.5" fill="#c89a5a" /><path d="M${x + 3} ${y + 21} H${x + 17}" stroke="#8a5a32" /><rect x="${x + 5}" y="${y + 4}" width="10" height="10" rx="1.5" fill="#d9a866" /></g>`
      : `<g stroke="#0f1a2e" stroke-width="1.2"><ellipse cx="${x + 10}" cy="${y + 20}" rx="7.5" ry="8" fill="#b8a07a" /><path d="M${x + 7} ${y + 13} q3 -3 6 0" fill="none" /><ellipse cx="${x + 10}" cy="${y + 9}" rx="5" ry="4.5" fill="#9aa8b8" /></g>`;
  for (const [n, level] of [[2, 1], [4, 2], [6, 3]]) write(`buildings/storage_${level}`, unit.replace(/<\/svg>\s*$/, `${slots.slice(0, n).map(([x, y], k) => goods(x, y + 2, k)).join('')}</svg>`));

  const silo = read('buildings/storage_silo');
  for (const level of [1, 2, 3]) {
    let g = '';
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a0 = -Math.PI / 2 + (k / n) * Math.PI * 2 + 0.03;
      const a1 = -Math.PI / 2 + ((k + 1) / n) * Math.PI * 2 - 0.03;
      const lit = k < Math.round((level / 3) * n);
      g += `<path d="M${f1(60 + 53 * Math.cos(a0))} ${f1(64 + 53 * Math.sin(a0))} A53 53 0 0 1 ${f1(60 + 53 * Math.cos(a1))} ${f1(64 + 53 * Math.sin(a1))}" stroke="${lit ? '#3fa9f5' : '#2a3442'}" stroke-width="4" fill="none" />`;
    }
    write(`buildings/storage_silo_${level}`, silo.replace(/<\/svg>\s*$/, `${g}</svg>`));
  }
}
