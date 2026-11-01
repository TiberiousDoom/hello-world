// Ideas batch 5, part 1 (D-160): feedback when things happen, and bugs. Effects for building and
// demolishing, research finishing, a turret's lock-on, fireworks when a ship stage is done, chitin bursting
// from a destroyed nest, eyes at the forest's edge, and deaths for the wasp, beetle and brute.
// Run `node art/feedback.mjs` after redrawing one of those bugs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art');
const INK = '#0f1a2e';
const f1 = (n) => n.toFixed(1);
const TAU = Math.PI * 2;
const read = (key) => readFileSync(join(ART, `${key}.svg`), 'utf8');
const write = (key, s) => {
  writeFileSync(join(ART, `${key}.svg`), s);
  console.log(`${key}.svg`);
};
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const strip = (size, frames, h = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * frames.length} ${h}">\n` +
  frames
    .map((body, i) => {
      let s = body;
      for (const id of [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`);
      return `<svg x="${i * size}" y="0" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">${s}</svg>`;
    })
    .join('\n') +
  '\n</svg>\n';
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// --- Building: a timber frame round the footprint, a line of light rising up it, then the bolts flash.
write(
  'effects/build_5f',
  strip(
    128,
    [0, 0.3, 0.6, 0.9, 1].map((t, i) => {
      let s = `<rect x="8" y="8" width="112" height="112" fill="none" stroke="#c08a52" stroke-width="3.2" stroke-dasharray="10 5" opacity="${f1(1 - t * 0.8)}" />`;
      if (t > 0 && t < 1) s += `<path d="M6 ${f1(120 - 112 * t)} H122" stroke="#f2c14e" stroke-width="2.6" /><path d="M6 ${f1(120 - 112 * t)} H122" stroke="#fff4c0" stroke-width="1" />`;
      if (i === 4) s += [[12, 12], [116, 12], [12, 116], [116, 116]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff4c0" opacity="0.8" /><path d="M${x - 10} ${y} h20 M${x} ${y - 10} v20" stroke="#ffffff" stroke-width="2" />`).join('');
      return s;
    }),
  ),
);

// --- Demolishing: dust and broken bits bursting out as it comes down.
{
  const r = rng(3);
  const bits = Array.from({ length: 14 }, () => [r() * TAU, 0.5 + r() * 0.5, r(), r() * 360]);
  write(
    'effects/demolish_4f',
    strip(
      128,
      [0, 1, 2, 3].map((i) => {
        const t = i / 3;
        let s = '';
        bits.forEach(([a, sp, sz, rot], k) => {
          const d = 128 * (0.12 + t * 0.32) * sp;
          s += `<circle cx="${f1(64 + d * Math.cos(a))}" cy="${f1(64 + d * Math.sin(a))}" r="${f1(128 * (0.05 + t * 0.06) * (0.5 + sz))}" fill="#b9ad98" opacity="${f1(0.75 - t * 0.5)}" />`;
          if (k < 8) s += `<rect x="${f1(64 + d * 0.9 * Math.cos(a + 0.4))}" y="${f1(64 + d * 0.9 * Math.sin(a + 0.4))}" width="7" height="5" fill="#8a6a4a" stroke="${INK}" stroke-width="1" transform="rotate(${f1(rot)} 64 64)" opacity="${f1(1 - t * 0.6)}" />`;
        });
        return s;
      }),
    ),
  );
}

// --- Research finishing: rings of blue light pulsing out from the hub.
write(
  'effects/research_pulse_4f',
  strip(
    128,
    [0, 1, 2, 3].map((i) => {
      const u = i / 4;
      return (
        [0, 0.5].map((o) => { const v = (u + o) % 1; return `<circle cx="64" cy="64" r="${f1(128 * (0.15 + v * 0.33))}" fill="none" stroke="#7cc4ff" stroke-width="${f1(5 * (1 - v) + 0.5)}" opacity="${f1(0.9 - v * 0.8)}" />`; }).join('') +
        (i === 0 ? '<circle cx="64" cy="64" r="16" fill="#bfe4ff" opacity="0.6" />' : '')
      );
    }),
  ),
);

// --- A turret's lock-on: brackets closing on its target, turning red as they lock.
write(
  'effects/lock_on_4f',
  strip(
    64,
    [14, 10, 7, 6].map((g, i) => {
      const col = i === 3 ? '#ff4a3a' : '#f2c14e';
      const b = (sx, sy) => `<path d="M${32 + sx * g} ${32 + sy * (g - 5)} V${32 + sy * g} H${32 + sx * (g - 5)}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" /><path d="M${32 + sx * g} ${32 + sy * (g - 5)} V${32 + sy * g} H${32 + sx * (g - 5)}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" />`;
      return `<g transform="rotate(${i * 15} 32 32)">${b(-1, -1)}${b(1, -1)}${b(1, 1)}${b(-1, 1)}</g>` + (i === 3 ? `<circle cx="32" cy="32" r="1.8" fill="${col}" />` : '');
    }),
  ),
);

// --- Fireworks over the ship when a stage is finished: three bursts in turn, with confetti.
{
  const r = rng(17);
  const confetti = Array.from({ length: 16 }, () => [r() * 192, r() * 192, r() * 180]);
  write(
    'effects/fireworks_4f',
    strip(
      192,
      [0, 1, 2, 3].map((i) => {
        let s = '';
        for (const [cx, cy, col, o] of [[50, 50, '#ffd36b', 0], [140, 60, '#7cc4ff', 1], [100, 140, '#ff7a6a', 2]]) {
          const t = ((i + o) % 4) / 3;
          if (t === 0) { s += `<circle cx="${cx}" cy="${cy}" r="4" fill="#ffffff" />`; continue; }
          s += `<circle cx="${cx}" cy="${cy}" r="${f1(10 + t * 30)}" fill="${col}" opacity="${f1(0.25 - t * 0.2)}" />`;
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU;
            const d = 8 + t * 34;
            const x = cx + d * Math.cos(a), y = cy + d * Math.sin(a) + t * t * 8;
            s += `<path d="M${f1(cx + d * 0.6 * Math.cos(a))} ${f1(cy + d * 0.6 * Math.sin(a) + t * t * 8)} L${f1(x)} ${f1(y)}" stroke="${col}" stroke-width="${f1(3.6 - t * 2)}" stroke-linecap="round" opacity="${f1(1 - t * 0.6)}" /><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(2.6 - t)}" fill="#ffffff" opacity="${f1(1 - t * 0.6)}" />`;
          }
        }
        confetti.forEach(([x, y, a], k) => (s += `<rect x="${f1(x)}" y="${f1((y + i * 20) % 192)}" width="7" height="4" fill="${['#f2c14e', '#3fa9f5', '#ff7a6a', '#6ee07a'][k % 4]}" transform="rotate(${f1(a + i * 40)} ${f1(x)} ${f1((y + i * 20) % 192)})" />`));
        return s;
      }),
    ),
  );
}

// --- Chitin bursting from a destroyed nest: a piece bounces, settles and glints.
{
  const chitin = inner(read('items/chitin'));
  const vb = /viewBox="([^"]+)"/.exec(read('items/chitin'))[1];
  write(
    'effects/chitin_drop_4f',
    strip(
      64,
      [4, 18, 22, 24].map((y, i) => `<ellipse cx="32" cy="46" rx="${[8, 10, 12, 12][i]}" ry="3" fill="#000" opacity="0.25" /><svg x="16" y="${y}" width="32" height="32" viewBox="${vb}">${chitin}</svg>` + (i === 3 ? '<path d="M40 26 l1.2 -4 l1.2 4 l4 1.2 l-4 1.2 l-1.2 4 l-1.2 -4 l-4 -1.2 Z" fill="#ffffff" />' : '')),
    ),
  );
}

// --- Eyes at the forest's edge at night: a pair, glowing, blinking shut now and then (64 × 32 frames).
write(
  'effects/eyes_4f',
  strip(
    64,
    [1, 1, 0.2, 1].map((open) => `<circle cx="32" cy="16" r="14" fill="#ff4a3a" opacity="${f1(0.18 * open)}" /><ellipse cx="24" cy="16" rx="4.4" ry="${f1(3.2 * open)}" fill="#ff4a3a" /><ellipse cx="40" cy="16" rx="4.4" ry="${f1(3.2 * open)}" fill="#ff4a3a" /><circle cx="25" cy="15" r="1.2" fill="#ffd0c0" opacity="${open}" /><circle cx="41" cy="15" r="1.2" fill="#ffd0c0" opacity="${open}" />`),
    32,
  ),
);

// --- Deaths by kind. The wasp spirals down to its shadow; the beetle flinches, curls its legs in, its wing
// cases part, and it dulls to a husk; the brute crumples and darkens into a stain.
{
  const wasp = read('enemies/wasp');
  const centred = (svg, k, dx, dy, rot, op) => `<g opacity="${op}" transform="translate(${32 + dx} ${32 + dy}) rotate(${rot}) scale(${k}) translate(-32 -32)">${inner(svg)}</g>`;
  write('enemies/wasp_death_4f', strip(64, [0, 1, 2, 3].map((i) => `<ellipse cx="${32 + i * 2}" cy="${36 + i * 2}" rx="${10 - i}" ry="${5 - i * 0.5}" fill="#000" opacity="${f1(0.15 + i * 0.1)}" />` + centred(wasp, f1(1 - i * 0.18), i * 2, i * 1.5, i * 110, f1(1 - i * 0.12)))));

  const brute = read('enemies/brute');
  write(
    'enemies/brute_death_4f',
    strip(
      64,
      [0, 1, 2, 3].map((i) => {
        const dark = [1, 0.8, 0.6, 0.5][i];
        return (
          `<defs><filter id="dk"><feColorMatrix type="matrix" values="${dark} 0 0 0 0  0 ${dark} 0 0 0  0 0 ${dark} 0 0  0 0 0 1 0" /></filter></defs>` +
          (i >= 2 ? `<ellipse cx="32" cy="34" rx="${18 + i * 3}" ry="${10 + i * 2}" fill="#4a0e0e" opacity="0.5" />` : '') +
          `<g filter="url(#dk)" transform="translate(32 32) scale(${[1, 1.06, 1.12, 1.15][i]} ${[1, 0.8, 0.6, 0.5][i]}) translate(-32 -32)">${inner(brute)}</g>`
        );
      }),
    ),
  );

  const beetle = read('enemies/beetle');
  const LEGS = 'M22 17 L19 11 L13 7 M32 16 L33 9 L30 4 M41 22 L46 16 L51 12 M22 47 L19 53 L13 57 M32 48 L33 55 L30 60 M41 42 L46 48 L51 52';
  const legs = [[22, 17, 19, 11, 13, 7], [32, 16, 33, 9, 30, 4], [41, 22, 46, 16, 51, 12], [22, 47, 19, 53, 13, 57], [32, 48, 33, 55, 30, 60], [41, 42, 46, 48, 51, 52]];
  const curl = (k) => legs.map(([hx, hy, kx, ky, fx, fy]) => {
    const kx2 = hx + (kx - hx) * (1 - 0.35 * k), ky2 = hy + (ky - hy) * (1 - 0.45 * k);
    const fx2 = kx2 + (fx - kx) * (1 - 0.6 * k) + (hx > 30 ? -3 : 3) * k, fy2 = ky2 + (fy - ky) * (1 - 0.7 * k) + (32 - ky2) * 0.35 * k;
    return `M${hx} ${hy} L${f1(kx2)} ${f1(ky2)} L${f1(fx2)} ${f1(fy2)}`;
  }).join(' ');
  const UPPER = '<path d="M9 32 Q9 15 26 14.5 Q38 14.5 41 22 L41 32 Z"';
  const LOWER = '<path d="M9 32 Q9 49 26 49.5 Q38 49.5 41 42 L41 32 Z"';
  if (beetle.split(LEGS).length !== 3 || !beetle.includes(UPPER) || !beetle.includes(LOWER)) throw new Error('beetle: its legs or wing cases have moved');
  write(
    'enemies/beetle_death_4f',
    strip(
      64,
      [[0.15, 0, 1, '#ffffff', 1.5], [0.55, 8, 0.8, '#7ad0ff', 0], [0.85, 15, 0.55, '#1a2a3a', 0], [1, 18, 0.35, '#1a2a3a', 0]].map(([lg, open, light, eye, jerk], i) => {
        let s = beetle.split(LEGS).join(curl(lg));
        s = s.replace(UPPER, `<ellipse cx="27" cy="32" rx="15" ry="11" fill="#141c2a" /><path d="M16 32 H38 M20 27 Q28 25 36 27 M20 37 Q28 39 36 37" stroke="#2a3446" stroke-width="1.4" fill="none" /><path transform="rotate(${-open} 41 30)" d="M9 32 Q9 15 26 14.5 Q38 14.5 41 22 L41 32 Z"`);
        s = s.replace(LOWER, `<path transform="rotate(${open} 41 34)" d="M9 32 Q9 49 26 49.5 Q38 49.5 41 42 L41 32 Z"`);
        s = s.replace('<path d="M14 23 Q20 16.5 32 17"', `<path transform="rotate(${-open} 41 30)" d="M14 23 Q20 16.5 32 17"`).replace('<path d="M14 37 Q18 44 26 45.5"', `<path transform="rotate(${open} 41 34)" d="M14 37 Q18 44 26 45.5"`);
        if (open) s = s.replace('<circle cx="21" cy="21" r="1.4" fill="#ffffff" opacity="0.8" />', '');
        s = s.replace('<path d="M8.5 32 H41" stroke="#0f1a2e" stroke-width="1.8" />', `<path d="M10 32 Q24 ${32 - open * 0.3} 41 32 Q24 ${32 + open * 0.3} 10 32 Z" fill="#141c2a" stroke="#0f1a2e" stroke-width="1.8" />`);
        s = s.replace('<g fill="#7ad0ff" stroke="#0f1a2e" stroke-width="0.6">', `<g fill="${eye}" stroke="#0f1a2e" stroke-width="0.6">`);
        const dim = `<defs><filter id="bd" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${f1(light)}" /><feComponentTransfer><feFuncR type="linear" slope="${f1(0.55 + light * 0.45)}" /><feFuncG type="linear" slope="${f1(0.55 + light * 0.45)}" /><feFuncB type="linear" slope="${f1(0.55 + light * 0.45)}" /></feComponentTransfer></filter></defs>`;
        const dust = i === 3 ? [[14, 20], [10, 44], [30, 54], [46, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#b9ad98" opacity="0.5" />`).join('') : '';
        return `${dim}<g filter="url(#bd)" transform="translate(${jerk} 0)">${inner(s)}</g>${dust}`;
      }),
    ),
  );
}
