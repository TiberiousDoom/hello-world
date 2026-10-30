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
function strip(frames, size = 64) {
  const parts = frames.map((svg, i) => {
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const ids = [...inner.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    let s = inner;
    for (const id of ids) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`).replaceAll(`href="#${id}"`, `href="#${id}-f${i}"`);
    return `<svg x="${i * size}" y="0" width="${size}" height="${size}" viewBox="0 0 64 64">${s}</svg>`;
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
